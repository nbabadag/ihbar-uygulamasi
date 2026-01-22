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
<<<<<<< HEAD
  
  const lastCountRef = useRef<number>(0)

  // --- YETKİ KONTROLLERİ (Orijinal Mantığına Sadık Kalındı) ---
  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole === 'ADMIN';
  const isSaha = normalizedRole === 'SAHA PERSONELI';

  const canCreateJob = isAdmin || ['ÇAĞRI MERKEZİ', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canManageUsers = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeReports = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeTV = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZİ'].includes(normalizedRole);
  const canManageGroups = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const seePool = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZİ'].includes(normalizedRole);

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    const { data: ihbarData } = await supabase.from('ihbarlar')
      .select(`*, profiles (full_name), calisma_gruplari (grup_adi)`)
      .order('created_at', { ascending: false })
    
    if (ihbarData) {
      const filtered = role.trim().toUpperCase() === 'SAHA PERSONELI' ? ihbarData.filter(i => i.atanan_personel === id) : ihbarData
      setIhbarlar(filtered)
      setStats({
        bekleyen: filtered.filter(i => i.durum === 'Beklemede').length,
        islemde: filtered.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').length,
        tamamlanan: filtered.filter(i => i.durum === 'Tamamlandi').length
      })
    }
  }, [])
=======
  const lastCountRef = useRef<number>(0)

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const canCreateJob = ['ADMIN', 'ÇAĞRI MERKEZİ', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    const { data } = await supabase.from('ihbarlar')
      .select(`*, profiles(full_name), calisma_gruplari(grup_adi)`)
      .order('created_at', { ascending: false });
    
    if (data) {
      const filteredData = role.trim().toUpperCase() === 'SAHA PERSONELI' 
        ? data.filter(i => i.atanan_personel === id) 
        : data;

      setIhbarlar(filteredData);
      setStats({
        bekleyen: filteredData.filter(i => i.durum === 'Beklemede').length,
        islemde: filteredData.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').length,
        tamamlanan: filteredData.filter(i => i.durum === 'Tamamlandi').length
      });
    }
  }, []);
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        setUserName(profile?.full_name || 'Kullanıcı')
        setUserRole(profile?.role || 'Saha Personeli')
        fetchData(profile?.role || 'Saha Personeli', user.id)
      } else {
        router.push('/')
      }
    }
    checkUser()
  }, [router, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

<<<<<<< HEAD
  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    return (
      <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="p-4 rounded-2xl shadow-sm border mb-3 bg-white border-gray-100 text-black cursor-pointer active:scale-95 transition-all">
        <div className="flex justify-between items-start mb-1 font-black text-black">
          <span className="text-[10px] italic text-blue-500">#{ihbar.ifs_is_emri_no || 'IFS YOK'}</span>
          <span className="text-[9px] text-gray-400">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="font-black text-[12px] uppercase leading-tight tracking-tighter text-gray-800">{ihbar.musteri_adi}</div>
        <div className="text-[10px] font-bold uppercase mb-3 truncate italic text-gray-500">{ihbar.konu}</div>
        <div className="flex justify-between items-center text-[9px] font-bold opacity-60 text-black">
           <span>👤 {ihbar.profiles?.full_name?.split(' ')[0] || 'HAVUZDA'}</span>
           <span>⏱️ {Math.floor(diff)} dk</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row text-black font-sans">
      
      {/* 💻 PC SOL MENÜ (SIDEBAR) */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full z-50">
        <h2 className="text-xl font-black mb-8 italic uppercase text-blue-100 tracking-tighter">Saha 360</h2>
        <nav className="space-y-3 flex-1 font-bold text-sm overflow-y-auto custom-scrollbar">
          
          {/* HARİTA BUTONU */}
          <button 
            onClick={() => router.push('/dashboard/saha-haritasi')}
            className="w-full text-left p-4 bg-orange-600 hover:bg-orange-700 rounded-2xl flex items-center gap-3 transition-all shadow-lg animate-pulse mb-2"
=======
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row text-black font-sans">
      
      {/* 💻 PC SIDEBAR */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full z-50">
        <h2 className="text-xl font-black mb-8 italic uppercase text-blue-100 tracking-tighter">Saha 360</h2>
        
        <nav className="space-y-4 flex-1 font-bold text-sm">
          {/* HARİTA BUTONU - ŞARTSIZ EN ÜSTTE */}
          <button 
            onClick={() => router.push('/dashboard/saha-haritasi')}
            className="w-full p-4 bg-orange-600 hover:bg-orange-700 rounded-2xl flex items-center gap-3 transition-all shadow-lg animate-pulse"
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
          >
            <span className="text-xl">🛰️</span>
            <span className="font-black uppercase italic">Saha Haritası</span>
          </button>

<<<<<<< HEAD
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-xl cursor-pointer flex items-center gap-2 border-l-4 border-blue-400">🏠 Ana Sayfa</div>
          
          {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer">📢 İhbar Kayıt</div>}
          {canManageUsers && <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer">👤 Personel Yönetimi</div>}
          {canManageGroups && <div onClick={() => router.push('/dashboard/calisma-gruplari')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer">👥 Çalışma Grupları</div>}
          {canSeeTV && <div onClick={() => router.push('/dashboard/izleme-ekrani')} className="p-3 bg-red-600 rounded-xl cursor-pointer animate-pulse uppercase text-[12px]">📺 TV Paneli</div>}
          {canSeeReports && <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer">📊 Raporlama</div>}
        </nav>

        <div className="mt-auto bg-blue-950/50 p-3 rounded-2xl border border-blue-800/50">
          <span className="text-[11px] font-black uppercase italic block">{userName}</span>
          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{userRole}</span>
          <button onClick={handleLogout} className="w-full mt-3 bg-red-600 p-2 rounded-xl font-black text-[10px] uppercase">ÇIKIŞ Yap</button>
        </div>
      </div>

      {/* ANA İÇERİK ALANI */}
      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold flex flex-col gap-6">
        
       {/* HARİTA WIDGET - CANLI VERİ ENTEGRELİ */}
{!isSaha && (
  <div className="w-full bg-white rounded-[2.5rem] border-2 border-gray-200 overflow-hidden shadow-sm hidden md:block">
    <div className="p-4 bg-gray-800 text-white flex justify-between items-center font-black italic">
      <h3 className="text-[10px] uppercase tracking-widest text-white">🛰️ CANLI SAHA DURUMU // TERSANE</h3>
      <button 
        onClick={() => router.push('/dashboard/saha-haritasi')} 
        className="text-[9px] bg-blue-600 px-4 py-1.5 rounded-full font-black text-white hover:bg-blue-700 transition-all shadow-lg"
      >
        TAM EKRAN HARİTA →
      </button>
    </div>
    
    <div className="h-[300px] bg-slate-100 relative">
      {/* Google Maps: Tersane Bölgesi (Dark Stil Filtreli) */}
      <iframe
      id="saha-haritasi-frame"
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ border: 0, filter: 'grayscale(0.2) contrast(1.1)' }}
        src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d4364.785224510651!2d29.510035505498912!3d40.732240003592516!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1str!2str!4v1769106998126!5m2!1str!2str"
        allowFullScreen
      ></iframe>
      
      {/* Harita Üzerinde Yüzen Bilgi Paneli */}
      <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-[2rem] shadow-2xl border border-gray-100 flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30">📡</div>
        <div>
          <p className="text-[9px] font-black text-blue-600 uppercase leading-none mb-1">Aktif Operasyon</p>
          <div className="flex items-end gap-1">
            <p className="text-3xl font-black text-gray-900 leading-none">{stats.islemde}</p>
            <p className="text-[10px] font-bold text-gray-400 mb-1 tracking-tighter uppercase italic">İş Bölgesi</p>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

        {/* LİSTELER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col bg-yellow-50 p-4 rounded-[2rem] border-2 border-yellow-200 h-[500px] overflow-hidden flex flex-col">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-yellow-700">🟡 Havuz ({stats.bekleyen})</h3>
            <div className="overflow-y-auto flex-1">{ihbarlar.filter(i => i.durum === 'Beklemede').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
          <div className="flex flex-col bg-blue-50 p-4 rounded-[2rem] border-2 border-blue-200 h-[500px] overflow-hidden flex flex-col">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-blue-700">🔵 İşlemde ({stats.islemde})</h3>
            <div className="overflow-y-auto flex-1">{ihbarlar.filter(i => i.durum !== 'Beklemede' && i.durum !== 'Tamamlandi').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
          <div className="flex flex-col bg-green-50 p-4 rounded-[2rem] border-2 border-green-200 h-[500px] overflow-hidden flex flex-col">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-green-700">🟢 Biten ({stats.tamamlanan})</h3>
            <div className="overflow-y-auto flex-1">{ihbarlar.filter(i => i.durum === 'Tamamlandi').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
=======
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-xl cursor-pointer border-l-4 border-blue-400">🏠 Ana Sayfa</div>
          {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer">📢 İhbar Kayıt</div>}
          <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer">👤 Personel Yönetimi</div>
        </nav>

        <div className="mt-auto border-t border-blue-800 pt-4">
          <p className="text-[10px] font-black uppercase text-blue-300">{userName}</p>
          <button onClick={handleLogout} className="w-full mt-2 bg-red-600 p-2 rounded-xl font-black text-[10px] uppercase">ÇIKIŞ</button>
        </div>
      </div>

      {/* 📱 MOBİL HEADER */}
      <div className="md:hidden bg-blue-950 text-white p-4 sticky top-0 z-50 flex justify-between items-center">
        <h2 className="text-xs font-black italic text-blue-400 uppercase">Saha 360</h2>
        <div className="flex gap-2">
          <button onClick={() => router.push('/dashboard/saha-haritasi')} className="bg-blue-600 p-2 rounded-xl text-[10px] font-black uppercase tracking-tighter">🛰️ Harita</button>
          <button onClick={handleLogout} className="bg-red-600 p-2 rounded-xl text-[10px] font-black uppercase">Çıkış</button>
        </div>
      </div>

      {/* ANA İÇERİK */}
      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold flex flex-col gap-6">
        
        {/* HARİTA PENCERESİ */}
        <div className="w-full bg-white rounded-[2.5rem] border-2 border-gray-200 overflow-hidden shadow-sm hidden md:block">
          <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase italic tracking-widest">🛰️ CANLI SAHA DURUMU</h3>
            <button onClick={() => router.push('/dashboard/saha-haritasi')} className="text-[9px] bg-blue-600 px-3 py-1 rounded-full font-black">TAM EKRAN HARİTA</button>
          </div>
          <div className="h-[250px] bg-gray-100">
             <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src="https://www.google.com/maps?q=$" allowFullScreen></iframe>
          </div>
        </div>

        {/* LİSTELER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col bg-yellow-50 p-4 rounded-[2rem] border-2 border-yellow-200 h-[450px]">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-yellow-700 font-black">🟡 Havuz ({stats.bekleyen})</h3>
            <div className="overflow-y-auto space-y-2">
              {ihbarlar.filter(i => i.durum === 'Beklemede').map(i => (
                <div key={i.id} onClick={() => router.push(`/dashboard/ihbar-detay/${i.id}`)} className="p-3 bg-white rounded-xl shadow-sm border border-yellow-100 uppercase text-[10px] font-black cursor-pointer">{i.musteri_adi} - {i.konu}</div>
              ))}
            </div>
          </div>
          <div className="flex flex-col bg-blue-50 p-4 rounded-[2rem] border-2 border-blue-200 h-[450px]">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-blue-700 font-black">🔵 İşlemde ({stats.islemde})</h3>
            <div className="overflow-y-auto space-y-2">
              {ihbarlar.filter(i => i.durum !== 'Beklemede' && i.durum !== 'Tamamlandi').map(i => (
                <div key={i.id} onClick={() => router.push(`/dashboard/ihbar-detay/${i.id}`)} className="p-3 bg-white rounded-xl shadow-sm border border-blue-100 uppercase text-[10px] font-black cursor-pointer">{i.musteri_adi} - {i.konu}</div>
              ))}
            </div>
          </div>
          <div className="flex flex-col bg-green-50 p-4 rounded-[2rem] border-2 border-green-200 h-[450px]">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-green-700 font-black">🟢 Biten ({stats.tamamlanan})</h3>
            <div className="overflow-y-auto space-y-2">
              {ihbarlar.filter(i => i.durum === 'Tamamlandi').map(i => (
                <div key={i.id} onClick={() => router.push(`/dashboard/ihbar-detay/${i.id}`)} className="p-3 bg-white rounded-xl shadow-sm border border-green-100 uppercase text-[10px] font-black cursor-pointer">{i.musteri_adi} - {i.konu}</div>
              ))}
            </div>
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
          </div>
        </div>
      </div>
    </div>
  )
}
