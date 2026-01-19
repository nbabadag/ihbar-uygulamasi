'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null) // Kullanıcı ismi için
  const [now, setNow] = useState(new Date())

  const canCreateJob = ['Çağrı Merkezi', 'Formen', 'Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole || '')
  const canManageUsers = ['Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole || '')
  const canSeeReports = ['Formen', 'Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole || '')
  const canManageMaterials = userRole !== 'Saha Personeli'

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const playAlert = useCallback(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.play().catch(error => console.log("Ses engellendi.", error))
  }, [])

  const fetchData = useCallback(async (role: string, id: string) => {
    let query = supabase.from('ihbarlar').select(`
      *,
      profiles (full_name),
      calisma_gruplari (grup_adi)
    `)
    
    if (role === 'Saha Personeli') {
      const { data: userGroups } = await supabase.from('grup_uyeleri').select('grup_id').eq('profil_id', id)
      const groupIds = userGroups?.map(g => g.grup_id) || []
      if (groupIds.length > 0) {
        query = query.or(`atanan_personel.eq.${id},atanan_grup_id.in.(${groupIds.join(',')})`)
      } else {
        query = query.eq('atanan_personel', id)
      }
    }
    
    const { data: ihbarData, error } = await query.order('created_at', { ascending: false })
    
    if (ihbarData) {
      setIhbarlar(ihbarData)
      setStats({
        bekleyen: ihbarData.filter(i => i.durum === 'Beklemede').length,
        islemde: ihbarData.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').length,
        tamamlanan: ihbarData.filter(i => i.durum === 'Tamamlandi').length
      })

      const hasDelayedJob = ihbarData.some(i => {
        if (i.durum !== 'Beklemede') return false
        const diff = (new Date().getTime() - new Date(i.created_at).getTime()) / 60000
        return diff >= 30
      })
      if (hasDelayedJob) playAlert()
    }
  }, [playAlert])

  useEffect(() => {
    const checkUserAndInitialFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        const role = profile?.role || 'Saha Personeli'
        setUserName(profile?.full_name || 'Kullanıcı')
        setUserRole(role)
        fetchData(role, user.id)
      } else {
        router.push('/')
      }
    }
    checkUserAndInitialFetch()
  }, [router, fetchData])

  useEffect(() => {
    if (!userId || !userRole) return
    const channel = supabase.channel('canli-is-takibi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => {
        playAlert()
        fetchData(userRole, userId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, userRole, fetchData, playAlert])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    const isDelayed = ihbar.durum === 'Beklemede' && diff >= 30

    return (
      <div 
        onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)}
        className={`p-4 rounded-2xl shadow-sm border mb-3 cursor-pointer transition-all group ${
          isDelayed 
          ? 'bg-red-600 border-red-400 animate-pulse text-white' 
          : 'bg-white border-gray-100 text-black hover:shadow-md hover:border-blue-400'
        }`}
      >
        <div className="flex justify-between items-start mb-1">
          <div className={`font-black text-[12px] uppercase leading-tight tracking-tighter ${isDelayed ? 'text-white' : 'text-gray-800 group-hover:text-blue-600'}`}>
            {ihbar.musteri_adi}
          </div>
          <div className={`text-[9px] font-bold ${isDelayed ? 'text-red-100' : 'text-gray-400'}`}>
            {new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        <div className={`text-[10px] font-bold uppercase mb-3 truncate italic ${isDelayed ? 'text-red-50' : 'text-gray-500'}`}>{ihbar.konu}</div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            {ihbar.atanan_grup_id ? (
              <span className={`text-[8px] font-black px-2 py-1 rounded-lg border ${isDelayed ? 'bg-red-700 border-red-400 text-white' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>👥 {ihbar.calisma_gruplari?.grup_adi}</span>
            ) : (
              <span className={`text-[8px] font-black px-2 py-1 rounded-lg border ${isDelayed ? 'bg-red-700 border-red-400 text-white' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>👤 {ihbar.profiles?.full_name?.split(' ')[0] || 'Atanmadı'}</span>
            )}
          </div>
          {isDelayed && <span className="text-[8px] font-black bg-white text-red-600 px-2 py-0.5 rounded animate-bounce">GECİKME!</span>}
          {ihbar.durum === 'Calisiliyor' && <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-black font-sans">
      
      {/* SOL MENÜ */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full">
        <h2 className="text-xl font-black mb-8 italic uppercase text-blue-100 tracking-tighter">Saha 360 Paneli</h2>
        <nav className="space-y-3 flex-1 font-bold text-sm">
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-blue-700 transition border-l-4 border-blue-400">🏠 Ana Sayfa</div>
          {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 bg-sky-600 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-sky-500 transition border-l-4 border-sky-300">📢 İhbar Kayıt</div>}
          {canManageUsers && <div onClick={() => router.push('/dashboard/kullanici-ekle')} className="p-3 bg-emerald-600 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-emerald-500 transition border-l-4 border-emerald-300">👤 Personel Yönetimi</div>}
          {canManageUsers && <div onClick={() => router.push('/dashboard/calisma-gruplari')} className="p-3 bg-orange-600 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-orange-500 transition border-l-4 border-orange-300">👥 Çalışma Grupları</div>}
          {canManageMaterials && <div onClick={() => router.push('/dashboard/malzeme-yonetimi')} className="p-3 bg-purple-600 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-purple-500 transition border-l-4 border-purple-300">⚙️ Malzeme Kataloğu</div>}
          {canSeeReports && <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 bg-teal-700 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-teal-600 transition border-l-4 border-teal-300">📊 Raporlama</div>}
          <div onClick={() => router.push('/dashboard/izleme-ekrani')} className="p-3 bg-red-600 rounded-xl cursor-pointer flex items-center gap-2 hover:bg-red-500 transition border-l-4 border-red-300 animate-pulse">📺 TV İzleme Paneli</div>
        </nav>

        {/* KULLANICI KARTI VE ÇIKIŞ */}
        <div className="mt-auto border-t border-blue-800 pt-4 space-y-4">
          <div className="bg-blue-950/50 p-3 rounded-2xl border border-blue-800/50 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-black text-xs shadow-lg">
              {userName?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[11px] font-black text-white truncate uppercase italic">{userName}</span>
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{userRole}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-xl hover:bg-red-700 transition font-black shadow-lg text-xs uppercase italic">Çıkış Yap</button>
        </div>
      </div>

      {/* ANA İÇERİK - 3 SÜTUNLU KANBAN */}
      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)] lg:h-[calc(100vh-60px)]">
          <div className="flex flex-col bg-yellow-50/40 rounded-[2.5rem] border-2 border-yellow-100 shadow-sm overflow-hidden text-black">
            <div className="p-5 bg-yellow-400 text-yellow-900 flex justify-between items-center shadow-md">
              <h3 className="text-xs font-black uppercase italic tracking-tighter">🟡 Açık İhbarlar</h3>
              <span className="bg-yellow-900/10 px-3 py-1 rounded-full text-[10px] font-black">{stats.bekleyen}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {ihbarlar.filter(i => i.durum === 'Beklemede').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)}
            </div>
          </div>
          <div className="flex flex-col bg-blue-50/40 rounded-[2.5rem] border-2 border-blue-100 shadow-sm overflow-hidden text-black">
            <div className="p-5 bg-blue-600 text-white flex justify-between items-center shadow-md">
              <h3 className="text-xs font-black uppercase italic tracking-tighter">🔵 Atanan / İşlemde</h3>
              <span className="bg-blue-900/20 px-3 py-1 rounded-full text-[10px] font-black">{stats.islemde}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)}
            </div>
          </div>
          <div className="flex flex-col bg-green-50/40 rounded-[2.5rem] border-2 border-green-100 shadow-sm overflow-hidden text-black">
            <div className="p-5 bg-green-600 text-white flex justify-between items-center shadow-md">
              <h3 className="text-xs font-black uppercase italic tracking-tighter">🟢 Tamamlananlar</h3>
              <span className="bg-green-900/20 px-3 py-1 rounded-full text-[10px] font-black">{stats.tamamlanan}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {ihbarlar.filter(i => i.durum === 'Tamamlandi').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  )
}