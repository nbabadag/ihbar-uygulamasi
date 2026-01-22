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
  
  const [bildirimSayisi, setBildirimSayisi] = useState(0)
  const [bildirimler, setBildirimler] = useState<any[]>([])
  const [isBildirimAcik, setIsBildirimAcik] = useState(false)
  
  const lastCountRef = useRef<number>(0)

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole === 'ADMIN';
  const isSaha = normalizedRole === 'SAHA PERSONELI';

  const canCreateJob = isAdmin || ['CAGRI MERKEZI', 'ÇAĞRI MERKEZI', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canManageUsers = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeReports = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canSeeTV = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZI'].includes(normalizedRole);
  const canManageGroups = isAdmin || ['FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const canManageMaterials = isAdmin || ['MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'FORMEN'].includes(normalizedRole);

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    
    const { data: ihbarData } = await supabase.from('ihbarlar')
      .select(`*, profiles (full_name), calisma_gruplari (grup_adi)`)
      .order('created_at', { ascending: false })
    
    if (ihbarData) {
      // 🕒 TÜRKİYE SAATİNE SABİTLEME (UTC+3)
      const simdi = new Date();
      const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const saat = turkiyeZamani.getHours();
      const dakika = turkiyeZamani.getMinutes();
      const toplamDakika = saat * 60 + dakika;

      // Mesai: 08:01 (481. dk) - 16:44 (1004. dk)
      const isMesaiSaatleri = toplamDakika >= 481 && toplamDakika <= 1004;

      let filtered = [];

      if (role.trim().toUpperCase() === 'SAHA PERSONELI') {
        filtered = ihbarData.filter(i => {
          // 1. Kendisine atanmış işler
          const kendisineAtanmis = i.atanan_personel === id;
          
          // 2. Mesai dışıysa ve Vardiya Modu etiketi varsa Ali havuzda görebilmeli
          const vardiyaModundaGor = !isMesaiSaatleri && i.oncelik_durumu === 'VARDİYA_MODU';

          return kendisineAtanmis || vardiyaModundaGor;
        });
      } else {
        filtered = ihbarData;
      }

      setIhbarlar(filtered)
      setStats({
        bekleyen: filtered.filter(i => i.durum === 'Beklemede').length,
        islemde: filtered.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').length,
        tamamlanan: filtered.filter(i => i.durum === 'Tamamlandi').length
      })
    }

    const { data: bData, count } = await supabase
      .from('bildirimler')
      .select('*', { count: 'exact' })
      .eq('is_read', false)
      .contains('hedef_roller', [role.trim()])
      .order('created_at', { ascending: false })
      .limit(20)

    setBildirimler(bData || [])
    setBildirimSayisi(count || 0)
  }, [])

  useEffect(() => {
    let channel: any;
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        const currentRole = profile?.role || 'Saha Personeli';
        setUserName(profile?.full_name || 'Kullanıcı')
        setUserRole(currentRole)
        fetchData(currentRole, user.id)

        channel = supabase
          .channel('db-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => { fetchData(currentRole, user.id); })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirimler' }, () => { fetchData(currentRole, user.id); })
          .subscribe()
      } else {
        router.push('/')
      }
    }
    checkUser()
    const timer = setInterval(() => {
      setNow(new Date());
      if (userRole && userId) fetchData(userRole, userId);
    }, 60000)
    return () => { clearInterval(timer); if (channel) supabase.removeChannel(channel); }
  }, [router, fetchData, userRole, userId])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    const isVardiya = ihbar.oncelik_durumu === 'VARDİYA_MODU' && ihbar.durum === 'Beklemede';

    return (
      <div 
        onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} 
        className={`p-4 rounded-2xl shadow-xl border mb-3 backdrop-blur-md transition-all active:scale-95 relative z-10 ${isVardiya ? 'bg-orange-600/20 border-orange-500 animate-pulse' : 'bg-[#1a1c23]/80 border-gray-700/50 hover:border-orange-500/50'}`}
      >
        <div className="flex justify-between items-start mb-1 font-black">
          <span className={`text-[10px] italic font-black tracking-widest uppercase ${isVardiya ? 'text-white' : 'text-orange-400'}`}>
            {isVardiya ? '🚨 VARDİYA İHBARI' : `#${ihbar.ifs_is_emri_no || 'IFS YOK'}`}
          </span>
          <span className="text-[9px] text-gray-500 font-bold">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="font-black text-[12px] uppercase leading-tight tracking-tighter text-gray-100 mb-1">{ihbar.musteri_adi}</div>
        <div className="text-[10px] font-bold uppercase mb-3 truncate italic text-gray-400">{ihbar.konu}</div>
        <div className="flex justify-between items-center text-[9px] font-black opacity-60 text-gray-300">
           <span>👤 {isVardiya ? 'VARDİYA HAVUZU' : (ihbar.profiles?.full_name?.split(' ')[0] || 'HAVUZDA')}</span>
           <span className="flex items-center gap-1">⏱️ {Math.floor(diff)} DK</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{backgroundImage: "url('/logo.png')", backgroundSize: '80%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: 'brightness(0.5) contrast(1.2) grayscale(0.5)'}}></div>

      <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-[#111318] shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[100] transform transition-transform duration-500 ease-out p-6 flex flex-col border-l border-orange-500/20 ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8 font-black uppercase italic">
          <h3 className="text-xl font-black italic uppercase text-orange-500 tracking-tighter">Bildirimler</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="bg-gray-800 hover:bg-orange-600 p-2 rounded-full text-[10px] font-black uppercase italic transition-colors">Kapat ×</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
          {bildirimler.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 italic font-black uppercase text-xs tracking-widest font-black">Yeni Bildirim Bulunmuyor</div>
          ) : (
            bildirimler.map((b) => (
              <div key={b.id} onClick={() => { router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false); }} className={`p-4 rounded-2xl border transition-all cursor-pointer bg-[#1a1c23] hover:border-orange-500/50 ${b.mesaj.includes('DURDURULDU') ? 'border-red-900/50' : 'border-green-900/50'}`}>
                <div className="flex justify-between items-start mb-2 text-white">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white ${b.mesaj.includes('DURDURULDU') ? 'bg-red-600' : 'bg-green-600'}`}>{b.mesaj.includes('DURDURULDU') ? 'DURDU' : 'BİTTİ'}</span>
                  <span className="text-[8px] font-bold text-gray-600 italic">{new Date(b.created_at).toLocaleTimeString('tr-TR')}</span>
                </div>
                <p className="text-[11px] font-black italic uppercase leading-tight mb-2 text-gray-200">{b.mesaj}</p>
                <div className="flex justify-between items-center text-[9px] font-black text-orange-500">
                  <span>KAYIT: #{b.ihbar_id}</span>
                  <span className="text-gray-500 italic font-black">👤 {b.islem_yapan_ad}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isBildirimAcik && <div onClick={() => setIsBildirimAcik(false)} className="fixed inset-0 bg-black/70 backdrop-blur-md z-[90]"></div>}

      <div className="hidden md:flex w-64 bg-[#0a0b0e]/95 backdrop-blur-2xl text-white shadow-2xl flex-col fixed h-full z-50 border-r border-gray-800/30">
        <div className="w-full mb-8 overflow-hidden bg-black/40 border-b border-gray-800/50 shadow-2xl shadow-orange-500/10 font-black">
          <img src="/logo.png" alt="Logo" className="w-full h-auto object-cover opacity-90 transition-transform hover:scale-105 duration-700 font-black" />
        </div>
        <div className="px-4 flex flex-col flex-1 font-black">
          <nav className="space-y-2.5 flex-1 font-black text-[11px] overflow-y-auto custom-scrollbar uppercase italic tracking-tighter font-black">
            <button onClick={() => router.push('/dashboard/saha-haritasi')} className="w-full text-left p-4 bg-orange-600 hover:bg-orange-700 rounded-2xl flex items-center gap-3 transition-all shadow-xl mb-6 active:scale-95 shadow-orange-900/20 text-white font-black">
              <span className="text-xl">🛰️</span><span className="font-black uppercase italic">Saha Haritası</span>
            </button>
            <div onClick={() => router.push('/dashboard')} className="p-3 bg-gray-800/50 rounded-xl cursor-pointer flex items-center gap-2 border-l-4 border-orange-500 transition-all hover:bg-gray-800 text-white font-black">🏠 Ana Sayfa</div>
            <div onClick={() => setIsBildirimAcik(true)} className="p-3 hover:bg-gray-800/50 rounded-xl cursor-pointer flex justify-between items-center transition-all text-white font-black">
              <span>🔔 Bildirimler</span>
              {bildirimSayisi > 0 && <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce shadow-lg shadow-orange-900/50 font-black">{bildirimSayisi}</span>}
            </div>
            {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all opacity-80 hover:opacity-100 text-white font-black">📢 İhbar Kayıt</div>}
            {canManageUsers && <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="p-3 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all opacity-80 hover:opacity-100 text-white font-black">👤 Personel Yönetimi</div>}
            {canManageMaterials && <div onClick={() => router.push('/dashboard/malzeme-yonetimi')} className="p-3 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all opacity-80 hover:opacity-100 text-orange-400 border border-orange-500/10 font-black">📦 Malzeme Yönetimi</div>}
            {canManageGroups && <div onClick={() => router.push('/dashboard/calisma-gruplari')} className="p-3 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all opacity-80 hover:opacity-100 text-white font-black">👥 Çalışma Grupları</div>}
            {canSeeTV && <div onClick={() => router.push('/dashboard/izleme-ekrani')} className="p-3 bg-red-600/10 text-red-500 border border-red-900/30 rounded-xl cursor-pointer animate-pulse text-center mt-4 text-[10px] font-black font-black">📺 İzleme Ekranı</div>}
            {canSeeReports && <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all opacity-80 hover:opacity-100 text-white font-black">📊 Raporlama</div>}
          </nav>
          <div className="mt-auto mb-4 bg-black/40 p-4 rounded-2xl border border-gray-800/50 shadow-inner font-black">
            <div className="flex flex-col mb-3 font-black">
              <span className="text-[11px] font-black uppercase italic text-orange-500 leading-tight font-black">{userName}</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-black">{userRole}</span>
            </div>
            <button onClick={handleLogout} className="w-full bg-red-600/80 hover:bg-red-600 p-2 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 text-white font-black">ÇIKIŞ Yap</button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold flex flex-col gap-6 relative z-10 font-black">
        <div className="md:hidden flex justify-between items-center bg-[#111318] p-4 rounded-2xl text-white shadow-xl border border-gray-800 font-black">
          <img src="/logo.png" className="w-10 h-auto font-black" />
          <button onClick={() => setIsBildirimAcik(true)} className="relative p-2 font-black"><span className="text-xl font-black">🔔</span>
            {bildirimSayisi > 0 && <span className="absolute top-0 right-0 bg-orange-600 text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-black">{bildirimSayisi}</span>}
          </button>
        </div>

        {!isSaha && (
          <div className="w-full bg-[#111318]/60 backdrop-blur-md rounded-[2.5rem] border border-gray-700/30 overflow-hidden shadow-2xl hidden md:block font-black">
            <div className="p-4 bg-gray-900/80 text-white flex justify-between items-center font-black italic border-b border-gray-800 font-black">
              <h3 className="text-[10px] uppercase tracking-widest text-orange-500 font-black font-black">🛰️ CANLI SAHA DURUMU // TERSANE</h3>
              <button onClick={() => router.push('/dashboard/saha-haritasi')} className="text-[9px] bg-orange-600 px-4 py-1.5 rounded-full font-black text-white hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/20 font-black">TAM EKRAN HARİTA →</button>
            </div>
            <div className="h-[250px] bg-black/20 relative font-black">
              <iframe id="saha-haritasi-frame" width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.2)' }} src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d4364.785224510651!2d29.510035505498912!3d40.732240003592516!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1str!2str!4v1769106998126!5m2!1str!2str" allowFullScreen></iframe>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-black">
          <div className="flex flex-col bg-yellow-500/5 backdrop-blur-md p-5 rounded-[2.5rem] border border-yellow-500/10 h-[500px] overflow-hidden shadow-inner font-black">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-yellow-500 flex items-center gap-2 tracking-widest font-black">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse font-black"></span> Havuz ({stats.bekleyen})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar font-black">{ihbarlar.filter(i => i.durum === 'Beklemede').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
          <div className="flex flex-col bg-blue-500/5 backdrop-blur-md p-5 rounded-[2.5rem] border border-blue-500/10 h-[500px] overflow-hidden shadow-inner font-black">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-blue-400 flex items-center gap-2 tracking-widest font-black">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse font-black"></span> İşlemde ({stats.islemde})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar font-black">{ihbarlar.filter(i => i.durum !== 'Beklemede' && i.durum !== 'Tamamlandi').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
          <div className="flex flex-col bg-green-500/5 backdrop-blur-md p-5 rounded-[2.5rem] border border-green-500/10 h-[500px] overflow-hidden shadow-inner font-black">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-green-400 flex items-center gap-2 tracking-widest font-black">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse font-black"></span> Biten ({stats.tamamlanan})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar font-black">{ihbarlar.filter(i => i.durum === 'Tamamlandi').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 10px; }
      `}</style>
    </div>
  )
}