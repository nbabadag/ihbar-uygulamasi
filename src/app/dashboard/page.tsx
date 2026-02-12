'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [aiKombinasyonlar, setAiKombinasyonlar] = useState<any[]>([]) 
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userGroups, setUserGroups] = useState<string[]>([])
  const [now, setNow] = useState(new Date())
  
  const [bildirimSayisi, setBildirimSayisi] = useState(0)
  const [bildirimler, setBildirimler] = useState<any[]>([])
  const [isBildirimAcik, setIsBildirimAcik] = useState(false)
  
  // --- 🟢 ONLINE PERSONEL STATE ---
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])

  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {
      console.log("Ses çalmak için kullanıcı etkileşimi bekleniyor.");
    });
  }, []);

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole.includes('ADMIN');
  const isMudur = normalizedRole.includes('MÜDÜR') || normalizedRole.includes('MUDUR');
  const isMuhendis = normalizedRole.includes('MÜH') || normalizedRole.includes('MUH');
  const isCagri = normalizedRole.includes('ÇAĞRI') || normalizedRole.includes('CAGRI');
  const isFormen = normalizedRole.includes('FORMEN');
  const isSahaPersoneli = normalizedRole === 'SAHA PERSONELI';

  const canManageUsers = isAdmin || isMudur || isMuhendis;
  const canCreateJob = canManageUsers || isFormen || isCagri;
  const canSeeReports = canManageUsers || isFormen;
  const canSeeTV = canCreateJob;
  const canManageGroups = canManageUsers || isFormen;
  const canManageMaterials = canManageUsers || isFormen;
  const canSeeMap = !isSahaPersoneli;

  const aiOneriGetir = (konu: string) => {
    if (!konu || aiKombinasyonlar.length === 0) return null;
    const metin = konu.toLowerCase();
    for (const kombo of aiKombinasyonlar) {
      if (!kombo.onay_durumu) continue;
      const eslesenler = kombo.kelime_grubu.filter((k: string) => metin.includes(k.toLowerCase()));
      if (eslesenler.length >= 2) return kombo.onerilen_ekip;
    }
    return null;
  };

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    
    const { data: userGroupData } = await supabase
      .from('grup_uyeleri')
      .select('grup_id, calisma_gruplari(grup_adi)')
      .eq('profil_id', id);
    
    const grupIds = userGroupData?.map(g => g.grup_id) || [];
    const groupNames = userGroupData?.map((g: any) => g.calisma_gruplari?.grup_adi).filter(Boolean) || [];
    setUserGroups(groupNames); 

    const { data: komboData } = await supabase.from('ai_kombinasyonlar').select('*');
    if (komboData) setAiKombinasyonlar(komboData);

    const { data: ihbarData } = await supabase
      .from('ihbarlar')
      .select(`*, profiles:atanan_personel(full_name), calisma_gruplari:atanan_grup_id(grup_adi)`)
      .order('created_at', { ascending: false })

    if (ihbarData) {
      const simdi = new Date();
      const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const toplamDakika = turkiyeZamani.getHours() * 60 + turkiyeZamani.getMinutes();
      const isMesaiSaatleri = toplamDakika >= 481 && toplamDakika <= 1004;

      let filtered = ihbarData;
      const roleUpper = role.trim().toUpperCase();

      if (roleUpper === 'SAHA PERSONELI') {
        filtered = ihbarData.filter(i => {
          const d = (i.durum || '').toLowerCase();
          const isAtanmis = (i.atanan_personel === id) || (grupIds.includes(i.atanan_grup_id));
          const isVardiyaHavuzaDustu = (!isMesaiSaatleri && i.oncelik_durumu === 'VARDİYA_MODU' && d.includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null);
          
          if (d.includes('tamamlandi')) {
            return i.atanan_personel === id;
          }

          return isAtanmis || isVardiyaHavuzaDustu;
        });
      }

      setIhbarlar(filtered)

      setStats({
        bekleyen: filtered.filter(i => 
          (i.durum || '').toLowerCase().includes('beklemede') && 
          i.atanan_personel === null && 
          i.atanan_grup_id === null
        ).length,
        tamamlanan: filtered.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).length,
        islemde: filtered.filter(i => {
          const d = (i.durum || '').toLowerCase();
          return !d.includes('tamamlandi') && (i.atanan_personel !== null || i.atanan_grup_id !== null || d.includes('calisiliyor') || d.includes('durduruldu'));
        }).length
      })
    }

    const cleanRole = role.trim();
    const roleUpperForB = cleanRole.toUpperCase();
    
    const { data: bData, count } = await supabase
      .from('bildirimler')
      .select('*', { count: 'exact' })
      .eq('is_read', false)
      .filter('hedef_roller', 'ov', `{${roleUpperForB}}`) 
      .order('created_at', { ascending: false })
      .limit(20)

    setBildirimSayisi(count || 0);
    setBildirimler(bData || [])
  }, []);

  useEffect(() => {
    let channel: any;
    let presenceChannel: any;

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        const currentRole = profile?.role || 'Saha Personeli';
        const currentName = profile?.full_name || 'Kullanıcı';
        setUserName(currentName)
        setUserRole(currentRole)
        fetchData(currentRole, user.id)
        
        presenceChannel = supabase.channel('online-sync', {
            config: { presence: { key: 'user' } }
        })

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const users = Object.values(state).flat().map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    role: p.role
                }));
                const uniqueUsers = Array.from(new Map(users.map((u:any) => [u.id, u])).values());
                setOnlineUsers(uniqueUsers);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        id: user.id,
                        name: currentName,
                        role: currentRole
                    });
                }
            });

        channel = supabase.channel(`dashboard-realtime-${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, (payload: any) => { 
            if (payload.eventType === 'INSERT') playNotificationSound();
            fetchData(currentRole, user.id); 
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bildirimler' }, () => { 
             fetchData(currentRole, user.id); 
          })
          .subscribe()
      } else { router.push('/') }
    }
    checkUser()
    const timer = setInterval(() => { 
      setNow(new Date()); 
    }, 60000)

    return () => { 
      clearInterval(timer); 
      if (channel) supabase.removeChannel(channel); 
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    }
  }, [router, fetchData, playNotificationSound])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); }

const JobCard = ({ ihbar }: { ihbar: any }) => {
    // --- ⏱️ SÜRE HESAPLAMA MANTIĞI (FİİLİ ÇALIŞMA ODAKLI) ---
    const olusturmaTarihi = new Date(ihbar.created_at).getTime();
    const kabulTarihi = ihbar.kabul_tarihi ? new Date(ihbar.kabul_tarihi).getTime() : null;
    const kapatmaTarihi = ihbar.kapatma_tarihi ? new Date(ihbar.kapatma_tarihi).getTime() : null;

    let calisilanDakika = 0;
    if (kapatmaTarihi && kabulTarihi) {
      calisilanDakika = Math.floor((kapatmaTarihi - kabulTarihi) / 60000);
    } else if (kabulTarihi) {
      calisilanDakika = Math.floor((now.getTime() - kabulTarihi) / 60000);
    } else {
      calisilanDakika = Math.floor((now.getTime() - olusturmaTarihi) / 60000);
    }

    const d = (ihbar.durum || '').toLowerCase();
    
    // --- 🚨 RENK VE DURUM MANTIĞI ---
    let durumRengi = "text-blue-400";
    let durumIcon = "📡";
    let solCizgi = "border-l-blue-500"; 
    let glowClass = "group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]";

    if (ihbar.kapatma_tarihi || d.includes('tamamlandi')) {
      durumRengi = "text-green-500";
      durumIcon = "✔️";
      solCizgi = "border-l-green-600";
      glowClass = "group-hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]";
    } else if (ihbar.varis_tarihi) {
      durumRengi = "text-yellow-500";
      durumIcon = "🔨";
      solCizgi = "border-l-yellow-500 animate-pulse";
      glowClass = "group-hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]";
    } else if (ihbar.kabul_tarihi) {
      durumRengi = "text-orange-500";
      durumIcon = "🚀";
      solCizgi = "border-l-orange-500";
      glowClass = "group-hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]";
    }

    const isVardiya = ihbar.oncelik_durumu === 'VARDİYA_MODU' && d.includes('beklemede');
    const isDurduruldu = d.includes('durduruldu');
    const oneri = aiOneriGetir(`${ihbar.konu} ${ihbar.aciklama || ''}`);
    const atananIsmi = ihbar.profiles?.full_name || ihbar.calisma_gruplari?.grup_adi || 'HAVUZ';

    return (
      <div 
        onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} 
        className={`group relative p-4 rounded-[1.5rem] border-l-4 border bg-[#1a1c23]/60 backdrop-blur-xl mb-4 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-2xl 
          ${solCizgi} ${glowClass} ${isDurduruldu ? 'border-red-500/50 bg-red-900/5 opacity-80' : 'border-gray-800/40'}`}
      >
        
        {/* 1. SATIR: ÜST BİLGİ & SAAT */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest 
              ${isVardiya ? 'bg-orange-600 text-white animate-bounce' : 'bg-gray-800 text-orange-500'}`}>
              {isDurduruldu ? '⚠️ DURDURULDU' : isVardiya ? '🚨 VARDİYA' : `#${ihbar.ifs_is_emri_no || 'IFS YOK'}`}
            </span>
          </div>
          <span className="text-[9px] text-gray-500 font-black italic">
            {new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>

        {/* 2. SATIR: ⚙️ TEKNİK NESNE & 🤖 AI MÜHÜRLERİ (GERİ GELDİ) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {ihbar.secilen_nesne_adi && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-600/10 border border-orange-500/30">
              <span className="text-[8px] font-black uppercase text-orange-500 italic">⚙️ {ihbar.secilen_nesne_adi}</span>
            </div>
          )}
          {oneri && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-600/10 border border-blue-500/20">
              <span className="text-[8px] font-black uppercase text-blue-400 italic">🤖 AI: {oneri}</span>
            </div>
          )}
        </div>

        {/* 3. SATIR: İHBAR VEREN VE KONU */}
        <div className="mb-3">
          <div className="text-[12px] font-black uppercase text-gray-100 leading-none mb-1 tracking-tighter italic">
            {ihbar.ihbar_veren_ad_soyad}
          </div>
          <div className="text-[10px] font-bold text-gray-500 uppercase italic truncate opacity-80">
            {ihbar.konu}
          </div>
        </div>

        {/* 4. SATIR: SAHA DURUM ŞERİDİ */}
        <div className={`flex items-center gap-2 py-2 px-3 rounded-xl bg-black/30 border border-white/5 mb-3 ${durumRengi}`}>
          <span className="text-xs">{durumIcon}</span>
          <span className="text-[9px] font-black uppercase italic tracking-wider">
            {ihbar.kapatma_tarihi || d.includes('tamamlandi') ? "✅ İŞ TAMAMLANDI" : ihbar.varis_tarihi ? "🔧 ARIZA NOKTASINDA" : ihbar.kabul_tarihi ? "🚛 EKİP YOLDA" : "📡 ATAMA BEKLİYOR"}
          </span>
        </div>

        {/* 5. SATIR: ALT BİLGİ (PERSONEL & FİİLİ ÇALIŞMA SÜRESİ) */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-800/40 font-black italic">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${ihbar.atanan_personel ? 'bg-orange-500' : 'bg-blue-500 animate-pulse'}`}></div>
            <span className="text-[9px] uppercase text-gray-400 truncate max-w-[120px]">{atananIsmi}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[7px] text-gray-600 uppercase mb-0.5 tracking-tighter">
              {ihbar.kabul_tarihi ? 'FİİLİ ÇALIŞMA' : 'BEKLEME SÜRESİ'}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[8px] opacity-40">⏱️</span>
              <span className={`text-[10px] ${ihbar.kabul_tarihi ? 'text-orange-500' : 'text-gray-500'}`}>
                {calisilanDakika} DK
              </span>
            </div>
          </div>
        </div>
      </div>
    );
}

  const NavButton = ({ label, icon, path, onClick, active = false }: any) => (
    <div 
      onClick={onClick || (() => router.push(path))}
      className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border shadow-lg active:scale-95 ${active ? 'bg-orange-600 border-orange-400 text-white' : 'bg-[#1a1c23] border-gray-800 text-gray-400 hover:border-orange-500/50 hover:text-white'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-lg ${active ? 'text-white' : 'text-orange-500 group-hover:scale-110 transition-transform'}`}>{icon}</span>
        <span className="text-[11px] font-black uppercase italic tracking-tighter">{label}</span>
      </div>
      <span className="text-[10px] opacity-30 group-hover:opacity-100 transition-opacity">→</span>
    </div>
  )

  return (
    <div className="h-screen w-screen flex text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
        <img src="/logo.png" className="w-2/3 h-auto grayscale invert" />
      </div>

      <div className="hidden md:flex w-72 bg-[#111318]/95 backdrop-blur-2xl border-r border-gray-800/50 flex-col fixed h-full z-50 shadow-2xl">
        <div className="p-6 border-b border-gray-800/30 bg-black/20">
          <img src="/logo.png" alt="Logo" className="w-full h-auto drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]" />
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {canSeeMap && <NavButton label="Saha Haritası" icon="🛰️" path="/dashboard/saha-haritasi" active />}
          <NavButton label="Bildirimler" icon="🔔" onClick={() => setIsBildirimAcik(true)} />
          <div className="h-px bg-gray-800 my-4 opacity-50"></div>
          {canCreateJob && <NavButton label="İhbar Kayıt" icon="📢" path="/dashboard/yeni-ihbar" />}
          {canManageUsers && <NavButton label="Personel Yönetimi" icon="👤" path="/dashboard/personel-yonetimi" />}
          {canManageMaterials && <NavButton label="Malzeme Yönetimi" icon="📦" path="/dashboard/malzeme-yonetimi" />}
          {canManageGroups && <NavButton label="Çalışma Gruplari" icon="👥" path="/dashboard/calisma-gruplari" />}
          {canSeeTV && <NavButton label="İzleme Ekranı" icon="📺" path="/dashboard/izleme-ekrani" />}
          {canSeeReports && <NavButton label="Raporlama" icon="📊" path="/dashboard/raporlar" />}
          {canManageUsers && (
            <>
              <NavButton label="Teknik Nesne Yönetimi" icon="⚙️" path="/dashboard/teknik-nesne-yonetimi" />
              <NavButton label="AI Öğrenme Merkezi" icon="🤖" path="/dashboard/ai-yonetim" />
            </>
          )}
        </nav>

        <div className="px-4 py-2 border-t border-gray-800/50 bg-black/20">
            <h4 className="text-[8px] font-black text-green-500 uppercase italic mb-2 tracking-[0.2em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                AKTİF PERSONEL ({onlineUsers.length})
            </h4>
            <div className="max-h-24 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                {onlineUsers.map((user, idx) => (
                    <div key={idx} className="flex flex-col bg-white/5 p-1.5 rounded-lg border border-white/5">
                        <span className="text-[9px] font-black uppercase italic text-gray-300 truncate">{user.name}</span>
                        <span className="text-[7px] font-bold text-gray-600 uppercase italic truncate">{user.role}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-4 bg-black/40 border-t border-gray-800/50">
          <div className="flex flex-col mb-3 px-2">
            <span className="text-[11px] font-black uppercase italic text-orange-500 truncate">{userName}</span>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">{userRole}</span>
            {userGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {userGroups.map((grup, idx) => (
                  <span key={idx} className="bg-blue-600/10 border border-blue-500/30 text-blue-400 text-[7px] px-2 py-0.5 rounded-full font-black uppercase italic mt-1 w-fit">
                    Atölye: {grup}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95 text-white">Oturumu Kapat</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ml-0 md:ml-72 p-4 md:p-8 relative z-10 custom-scrollbar">
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl mb-8">
          <div className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <div className="font-black uppercase italic text-xs tracking-tighter">Saha 360 // Denetim Merkezi</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-yellow-500/10 h-[750px] shadow-inner">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-yellow-500 flex items-center gap-2 tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Havuzda Bekleyen İhbarlar ({stats.bekleyen})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-blue-500/10 h-[750px] shadow-inner">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-blue-400 flex items-center gap-2 tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> İşlemde / Durdurulan İhbarlar ({stats.islemde})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => {
                const d = (i.durum || '').toLowerCase();
                return !d.includes('tamamlandi') && (i.atanan_personel !== null || i.atanan_grup_id !== null || d.includes('calisiliyor') || d.includes('durduruldu'));
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-green-500/10 h-[750px] shadow-inner">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-green-400 flex items-center gap-2 tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Tamanlanan İhbarlar ({stats.tamamlanan})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>
        </div>
      </div>
      
      {/* BİLDİRİM ÇEKMECESİ */}
      <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-[#111318] shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[100] transform transition-transform duration-500 ease-out p-6 flex flex-col border-l border-orange-500/20 ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black italic uppercase text-orange-500 tracking-tighter">Bildirimler ({bildirimSayisi})</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="bg-gray-800 hover:bg-orange-600 p-2 rounded-full text-[10px] font-black uppercase italic transition-colors">Kapat ×</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
          {bildirimler.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 italic uppercase text-xs tracking-widest text-center">Yeni Bildirim Bulunmuyor</div>
          ) : (
            bildirimler.map((b) => (
              <div key={b.id} onClick={() => { router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false); }} className={`p-4 rounded-2xl border transition-all cursor-pointer bg-[#1a1c23] hover:border-orange-500/50 ${b.mesaj?.includes('DURDU') ? 'border-red-900/50' : 'border-green-900/50'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white ${b.mesaj?.includes('DURDU') ? 'bg-red-600' : 'bg-green-600'}`}>{b.mesaj?.includes('DURDU') ? 'DURDU' : 'BİTTİ'}</span>
                  <span className="text-[8px] font-bold text-gray-600 italic">{new Date(b.created_at).toLocaleTimeString('tr-TR')}</span>
                </div>
                <p className="text-[11px] font-black italic uppercase leading-tight mb-2 text-gray-200">{b.mesaj}</p>
                <div className="flex justify-between items-center text-[9px] font-black text-orange-500">
                  <span>KAYIT: #{b.ihbar_id}</span>
                  <span className="text-gray-500 italic">👤 {b.islem_yapan_ad || 'Sistem'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isBildirimAcik && <div onClick={() => setIsBildirimAcik(false)} className="fixed inset-0 bg-black/70 backdrop-blur-md z-[90]"></div>}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  )
}