'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  
  const lastCountRef = useRef<number>(0)

  // --- YETKİ KONTROLLERİ (Büyük/Küçük Harf ve Boşluk Duyarsız) ---
  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole === 'ADMIN';
  const isSaha = normalizedRole === 'SAHA PERSONELI';

  const canCreateJob = isAdmin || ['ÇAĞRI MERKEZİ', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canManageUsers = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeReports = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeTV = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZİ'].includes(normalizedRole);
  const canManageGroups = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const seePool = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZİ'].includes(normalizedRole);

  const playSound = (url: string) => {
    const audio = new Audio(url)
    audio.play().catch(e => console.log("Ses çalınamadı:", e))
  }

  const playAlert = useCallback(() => {
    playSound('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
  }, [])

  const playNewJobSound = () => {
    playSound('https://assets.mixkit.co/active_storage/sfx/2211/2211-preview.mp3')
  }

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    
    let query = supabase.from('ihbarlar').select(`*, profiles (full_name), calisma_gruplari (grup_adi)`)
    
    if (role.trim().toUpperCase() === 'SAHA PERSONELI') {
      query = query.eq('atanan_personel', id)
    } 

    const { data: ihbarData } = await query.order('created_at', { ascending: false })
    
    if (ihbarData) {
      if (isSaha && ihbarData.length > lastCountRef.current && lastCountRef.current !== 0) {
        playNewJobSound()
      }
      lastCountRef.current = ihbarData.length

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
  }, [playAlert, seePool, isSaha])

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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    const isDelayed = ihbar.durum === 'Beklemede' && diff >= 30
    const isOnHold = ihbar.durum === 'Durduruldu';

    return (
      <div 
        onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)}
        className={`p-4 rounded-2xl shadow-sm border mb-3 cursor-pointer transition-all active:scale-[0.98] ${
          isDelayed ? 'bg-red-600 border-red-400 text-white animate-pulse shadow-lg' : 
          isOnHold ? 'bg-orange-50 border-orange-200 text-orange-900 border-l-8 border-l-orange-500' :
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
          </div>
          <span className={`text-[9px] font-bold ${isDelayed ? 'text-white' : 'opacity-60'}`}>⏱️ {Math.floor(diff)} dk</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row text-black font-sans">
      
      {/* 📱 MOBİL HEADER */}
      <div className="md:hidden bg-blue-950 text-white p-4 sticky top-0 z-50 shadow-xl border-b border-blue-800">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <h2 className="text-xs font-black italic text-blue-400 leading-none mb-1 uppercase tracking-tighter">Saha 360</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black truncate max-w-[120px] uppercase italic">{userName}</span>
              <span className="text-[7px] bg-blue-800 px-1.5 py-0.5 rounded font-bold text-blue-200 uppercase">{userRole}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/saha-haritasi')} className="bg-blue-600 p-2 rounded-xl text-[10px] font-black">🛰️ HARİTA</button>
            <button onClick={handleLogout} className="bg-red-600 p-2 rounded-xl text-[10px] font-black uppercase">ÇIKIŞ</button>
          </div>
        </div>
        {!isSaha && canCreateJob && (
          <button onClick={() => router.push('/dashboard/yeni-ihbar')} className="w-full bg-orange-500 text-white p-4 rounded-2xl font-black text-xs uppercase italic animate-bounce shadow-xl border-b-4 border-orange-700 active:scale-95">
            + YENİ İHBAR KAYDI AÇ
          </button>
        )}
      </div>

      {/* 💻 PC SOL MENÜ (SIDEBAR) */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full z-50">
        <h2 className="text-xl font-black mb-8 italic uppercase text-blue-100 tracking-tighter">Saha 360</h2>
        <nav className="space-y-3 flex-1 font-bold text-sm">
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-xl cursor-pointer flex items-center gap-2 border-l-4 border-blue-400">🏠 Ana Sayfa</div>
          
          {/* HARİTA BUTONU: ŞARTSIZ VE EN ÜSTE YAKIN */}
          <div onClick={() => router.push('/dashboard/saha-haritasi')} className="p-3 hover:bg-orange-600 bg-orange-500/20 rounded-xl cursor-pointer transition-all uppercase text-[11px] flex items-center gap-2 border border-orange-500/30 text-white shadow-lg animate-pulse">🛰️ Saha Haritası</div>
          
          {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all uppercase text-[11px]">📢 İhbar Kayıt</div>}
          {canManageUsers && <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all uppercase text-[11px]">👤 Personel Yönetimi</div>}
          {canManageGroups && <div onClick={() => router.push('/dashboard/calisma-gruplari')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all uppercase text-[11px]">👥 Çalışma Grupları</div>}
          {canSeeTV && <div onClick={() => router.push('/dashboard/izleme-ekrani')} className="p-3 bg-red-600 rounded-xl cursor-pointer animate-pulse transition-all uppercase text-[11px]">📺 TV Paneli</div>}
          {canSeeReports && <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition-all uppercase text-[11px]">📊 Raporlama</div>}
        </nav>
        <div className="mt-auto border-t border-blue-800 pt-4 space-y-4">
          <div className="bg-blue-950/50 p-3 rounded-2xl border border-blue-800/50">
            <span className="text-[11px] font-black text-white truncate uppercase italic block">{userName}</span>
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{userRole}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-xl hover:bg-red-700 transition font-black shadow-lg text-xs uppercase italic">Çıkış Yap</button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold flex flex-col gap-6">
        
        {/* HARİTA WIDGET (ANA EKRAN PENCERESİ) */}
        {!isSaha && (
          <div className="w-full bg-white rounded-[2.5rem] border-2 border-gray-200 overflow-hidden shadow-sm hidden md:block">
            <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase italic tracking-widest text-white">🛰️ CANLI SAHA DURUMU</h3>
              <button onClick={() => router.push('/dashboard/saha-haritasi')} className="text-[9px] bg-blue-600 px-3 py-1 rounded-full font-black text-white">TAM EKRAN HARİTA →</button>
            </div>
            <div className="h-[300px] bg-gray-100 relative">
               <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0, filter: 'grayscale(0.2) contrast(1.1)' }}
                src="https://www.google.com/maps?q=$"
                allowFullScreen
              ></iframe>
              <div className="absolute top-4 left-4 bg-white/95 p-3 rounded-2xl shadow-xl border border-gray-100">
                <p className="text-[8px] font-black text-blue-600 uppercase">Aktif Çalışan</p>
                <p className="text-xl font-black text-gray-800">{stats.islemde}</p>
              </div>
            </div>
          </div>
        )}

        {/* İŞ LİSTELERİ SÜTUNLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seePool && (
            <div className="flex flex-col bg-yellow-50/50 rounded-[2rem] border-2 border-yellow-200 shadow-sm overflow-hidden h-[450px] md:h-[calc(100vh-100px)]">
              <div className="p-4 bg-yellow-400 text-yellow-900 flex justify-between items-center shadow-md">
                <h3 className="text-[11px] font-black uppercase italic tracking-tighter">🟡 Açık İhbarlar (Havuz)</h3>
                <span className="bg-yellow-900/10 px-3 py-1 rounded-full text-[10px] font-black">{stats.bekleyen}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {ihbarlar.filter(i => i.durum === 'Beklemede').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)}
              </div>
            </div>
          )}

          <div className={`flex flex-col bg-blue-50/50 rounded-[2rem] border-2 border-blue-200 shadow-sm overflow-hidden h-[450px] md:h-[calc(100vh-100px)] ${!seePool ? 'lg:col-span-2' : ''}`}>
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center shadow-md">
              <h3 className="text-[11px] font-black uppercase italic tracking-tighter">🔵 İşlemde / Durdu</h3>
              <span className="bg-blue-900/20 px-3 py-1 rounded-full text-[10px] font-black">{stats.islemde}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').map(ihbar => <JobCard key={ihbar.id} ihbar={ihbar} />)}
            </div>
          </div>

          <div className="flex flex-col bg-green-50/50 rounded-[2rem] border-2 border-green-200 shadow-sm overflow-hidden h-[450px] md:h-[calc(100vh-100px)]">
            <div className="p-4 bg-green-600 text-white flex justify-between items-center shadow-md">
              <h3 className="text-[11px] font-black uppercase italic tracking-tighter">🟢 Tamamlananlar</h3>
              <span className="bg-green-900/20 px-3 py-1 rounded-full text-[10px] font-black">{stats.tamamlanan}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
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
