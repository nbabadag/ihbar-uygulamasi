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
  const [userName, setUserName] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  // --- YETKİ KONTROLLERİ ---
  const normalizedRole = userRole?.trim() || '';
  
  const canCreateJob = ['Çağrı Merkezi', 'Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);
  const canManageUsers = ['Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);
  const canSeeReports = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);
  const canSeeTV = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Çağrı Merkezi', 'Admin'].includes(normalizedRole);
  const canManageGroups = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);

  const seePool = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Çağrı Merkezi', 'Admin'].includes(normalizedRole);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const playAlert = useCallback(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.play().catch(error => console.log("Ses engellendi.", error))
  }, [])

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    
    let query = supabase.from('ihbarlar').select(`*, profiles (full_name), calisma_gruplari (grup_adi)`)
    
    // --- QUERY LOGIC DÜZELTİLDİ ---
    if (role === 'Saha Personeli') {
      // Saha Personeli sadece kendine atananları görür
      query = query.eq('atanan_personel', id)
    } 
    else if (role === 'Formen' || role === 'Çağrı Merkezi' || role === 'Mühendis-Yönetici' || role === 'Müdür' || role === 'Admin') {
      // Formen ve üstü roller havuzu ve tüm aktif işleri görmeli. 
      // Herhangi bir kısıtlama koymuyoruz ki tüm tabloyu alabilsinler.
    }

    const { data: ihbarData } = await query.order('created_at', { ascending: false })
    
    if (ihbarData) {
      setIhbarlar(ihbarData)
      setStats({
        bekleyen: ihbarData.filter(i => i.durum === 'Beklemede').length,
        islemde: ihbarData.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').length,
        tamamlanan: ihbarData.filter(i => i.durum === 'Tamamlandi').length
      })

      if (seePool) {
        const hasDelayedJob = ihbarData.some(i => {
          if (i.durum !== 'Beklemede') return false
          const diff = (new Date().getTime() - new Date(i.created_at).getTime()) / 60000
          return diff >= 30
        })
        if (hasDelayedJob) playAlert()
      }
    }
  }, [playAlert, seePool])

  useEffect(() => {
    const checkUser = async () => {
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
    checkUser()
  }, [router, fetchData])

  useEffect(() => {
    if (!userId || !userRole) return
    const channel = supabase.channel('canli-is-takibi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => {
        fetchData(userRole, userId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, userRole, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    const isDelayed = ihbar.durum === 'Beklemede' && diff >= 30
    const isUnassigned = !ihbar.atanan_personel && !ihbar.atanan_grup_id;
    const isOnHold = ihbar.durum === 'Durduruldu';

    return (
      <div 
        onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)}
        className={`p-4 rounded-2xl shadow-sm border mb-3 cursor-pointer transition-all active:scale-[0.98] ${
          isDelayed ? 'bg-red-600 border-red-400 text-white animate-pulse shadow-lg shadow-red-200' : 
          isOnHold ? 'bg-orange-50 border-orange-200 text-orange-900 border-l-8 border-l-orange-500' :
          isUnassigned ? 'bg-blue-50 border-blue-200 border-dashed text-black hover:bg-blue-100' :
          'bg-white border-gray-100 text-black hover:shadow-md hover:border-blue-400'
        }`}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col">
            <span className={`text-[10px] font-black italic ${isDelayed ? 'text-red-200' : 'text-blue-500'}`}>
                #{ihbar.ifs_is_emri_no || 'IFS YOK'}
            </span>
            <div className={`font-black text-[12px] uppercase leading-tight tracking-tighter ${isDelayed ? 'text-white' : 'text-gray-800'}`}>
              {ihbar.musteri_adi}
            </div>
          </div>
          <div className={`text-[9px] font-bold ${isDelayed ? 'text-red-100' : 'text-gray-400'}`}>
            {new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
        <div className={`text-[10px] font-bold uppercase mb-3 truncate italic ${isDelayed ? 'text-red-50' : 'text-gray-500'}`}>{ihbar.konu}</div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <span className={`text-[8px] font-black px-2 py-1 rounded-lg border ${isDelayed ? 'bg-red-700 border-red-400 text-white' : 'bg-gray-50 border-gray-100'}`}>
              {ihbar.atanan_grup_id ? `👥 ${ihbar.calisma_gruplari?.grup_adi}` : `👤 ${ihbar.profiles?.full_name?.split(' ')[0] || 'HAVUZDA'}`}
            </span>
            {isDelayed && <span className="text-[7px] font-black bg-white text-red-600 px-1.5 py-0.5 rounded animate-bounce">KRİTİK!</span>}
            {isOnHold && <span className="text-[7px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded animate-bounce">DURDU!</span>}
          </div>
          <span className={`text-[9px] font-bold ${isDelayed ? 'text-white' : 'opacity-60'}`}>⏱️ {Math.floor(diff)} dk</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row text-black font-sans">
      
      <div className="md:hidden bg-blue-950 text-white p-4 sticky top-0 z-50 shadow-xl flex justify-between items-center border-b border-blue-800">
        <div className="flex flex-col">
          <h2 className="text-xs font-black italic text-blue-400 leading-none mb-1 uppercase tracking-tighter">Saha 360</h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black truncate max-w-[120px] uppercase italic">{userName}</span>
            <span className="text-[8px] bg-blue-800 px-1.5 py-0.5 rounded font-bold text-blue-200 uppercase">{userRole}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-red-600 p-2.5 rounded-xl text-[10px] font-black uppercase active:scale-90 border-b-2 border-red-800">ÇIKIŞ</button>
      </div>

      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full">
        <h2 className="text-xl font-black mb-8 italic uppercase text-blue-100 tracking-tighter">Saha 360</h2>
        <nav className="space-y-3 flex-1 font-bold text-sm">
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-xl cursor-pointer flex items-center gap-2 border-l-4 border-blue-400">🏠 Ana Sayfa</div>
          {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all">📢 İhbar Kayıt</div>}
          {canManageUsers && <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all">👤 Personel Yönetimi</div>}
          {canManageGroups && <div onClick={() => router.push('/dashboard/calisma-gruplari')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all">👥 Çalışma Grupları</div>}
          {canSeeTV && <div onClick={() => router.push('/dashboard/izleme-ekrani')} className="p-3 bg-red-600 rounded-xl cursor-pointer animate-pulse transition-all">📺 TV İzleme Paneli</div>}
          {canSeeReports && <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all">📊 Raporlama</div>}
        </nav>
        <div className="mt-auto border-t border-blue-800 pt-4 space-y-4">
          <div className="bg-blue-950/50 p-3 rounded-2xl border border-blue-800/50">
            <span className="text-[11px] font-black text-white truncate uppercase italic block">{userName}</span>
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{userRole}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-xl hover:bg-red-700 transition font-black shadow-lg text-xs uppercase italic">Çıkış Yap</button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {seePool && (
            <div className="flex flex-col bg-yellow-50/50 rounded-[2rem] border-2 border-yellow-200 shadow-sm overflow-hidden h-[450px] md:h-[calc(100vh-100px)]">
              <div className="p-4 bg-yellow-400 text-yellow-900 flex justify-between items-center shadow-md">
                <h3 className="text-[11px] font-black uppercase italic tracking-tighter">🟡 Açık İhbarlar (Havuz)</h3>
                <span className="bg-yellow-900/10 px-3 py-1 rounded-full text-[10px] font-black">{stats.bekleyen}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {ihbarlar.filter(i => i.durum === 'Beklemede').length > 0 ? (
                  ihbarlar.filter(i => i.durum === 'Beklemede').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)
                ) : (
                  <div className="text-center text-gray-400 text-xs py-10 italic">Açık ihbar bulunmuyor.</div>
                )}
              </div>
            </div>
          )}

          <div className={`flex flex-col bg-blue-50/50 rounded-[2rem] border-2 border-blue-200 shadow-sm overflow-hidden h-[450px] md:h-[calc(100vh-100px)] ${!seePool ? 'lg:col-span-2' : ''}`}>
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center shadow-md">
              <h3 className="text-[11px] font-black uppercase italic tracking-tighter">🔵 İşlemde / Durdu</h3>
              <span className="bg-blue-900/20 px-3 py-1 rounded-full text-[10px] font-black">{stats.islemde}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').length > 0 ? (
                ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)
              ) : (
                <div className="text-center text-gray-400 text-xs py-10 italic">Devam eden iş bulunmuyor.</div>
              )}
            </div>
          </div>

          <div className="flex flex-col bg-green-50/50 rounded-[2rem] border-2 border-green-200 shadow-sm overflow-hidden h-[450px] md:h-[calc(100vh-100px)]">
            <div className="p-4 bg-green-600 text-white flex justify-between items-center shadow-md">
              <h3 className="text-[11px] font-black uppercase italic tracking-tighter">🟢 Tamamlananlar</h3>
              <span className="bg-green-900/20 px-3 py-1 rounded-full text-[10px] font-black">{stats.tamamlanan}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {ihbarlar.filter(i => i.durum === 'Tamamlandi').length > 0 ? (
                ihbarlar.filter(i => i.durum === 'Tamamlandi').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)
              ) : (
                <div className="text-center text-gray-400 text-xs py-10 italic">Tamamlanmış iş bulunmuyor.</div>
              )}
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