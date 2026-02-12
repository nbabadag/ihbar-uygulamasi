'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import * as LucideIcons from 'lucide-react'

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [bitenFiltreTarih, setBitenFiltreTarih] = useState('')
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])

  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => console.log("Ses için etkileşim bekleniyor."));
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
    const { data: userGroupData } = await supabase.from('grup_uyeleri').select('grup_id, calisma_gruplari(grup_adi)').eq('profil_id', id);
    const grupIds = userGroupData?.map(g => g.grup_id) || [];
    setUserGroups(userGroupData?.map((g: any) => g.calisma_gruplari?.grup_adi).filter(Boolean) || []); 

    const { data: komboData } = await supabase.from('ai_kombinasyonlar').select('*');
    if (komboData) setAiKombinasyonlar(komboData);

    const { data: ihbarData } = await supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name), calisma_gruplari:atanan_grup_id(grup_adi)`).order('created_at', { ascending: false });

    if (ihbarData) {
      const simdi = new Date();
      const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const toplamDakika = turkiyeZamani.getHours() * 60 + turkiyeZamani.getMinutes();
      const isMesaiSaatleri = toplamDakika >= 481 && toplamDakika <= 1004;

      let filtered = ihbarData;
      if (role.trim().toUpperCase() === 'SAHA PERSONELI') {
        filtered = ihbarData.filter(i => {
          const d = (i.durum || '').toLowerCase();
          const isAtanmis = (i.atanan_personel === id) || (grupIds.includes(i.atanan_grup_id));
          const isVardiyaHavuzaDustu = (!isMesaiSaatleri && i.oncelik_durumu === 'VARDİYA_MODU' && d.includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null);
          return d.includes('tamamlandi') ? i.atanan_personel === id : (isAtanmis || isVardiyaHavuzaDustu);
        });
      }
      setIhbarlar(filtered);
      setStats({
        bekleyen: filtered.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null).length,
        tamamlanan: filtered.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).length,
        islemde: filtered.filter(i => {
          const d = (i.durum || '').toLowerCase();
          return !d.includes('tamamlandi') && (i.atanan_personel !== null || i.atanan_grup_id !== null || d.includes('calisiliyor') || d.includes('durduruldu'));
        }).length
      });
    }
    const { data: bData, count } = await supabase.from('bildirimler').select('*', { count: 'exact' }).eq('is_read', false).filter('hedef_roller', 'ov', `{${role.trim().toUpperCase()}}`).order('created_at', { ascending: false }).limit(20);
    setBildirimSayisi(count || 0); setBildirimler(bData || []);
  }, []);

  useEffect(() => {
    let channel: any; let presenceChannel: any;
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
        const cRole = profile?.role || 'Saha Personeli'; const cName = profile?.full_name || 'Kullanıcı';
        setUserName(cName); setUserRole(cRole); fetchData(cRole, user.id);
        presenceChannel = supabase.channel('online-sync', { config: { presence: { key: 'user' } } });
        presenceChannel.on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const users = Object.values(state).flat().map((p: any) => ({ id: p.id, name: p.name, role: p.role }));
          setOnlineUsers(Array.from(new Map(users.map((u:any) => [u.id, u])).values()));
        }).subscribe(async (s: string) => { if (s === 'SUBSCRIBED') await presenceChannel.track({ id: user.id, name: cName, role: cRole }); });
        channel = supabase.channel(`dashboard-realtime-${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, (p: any) => { if (p.eventType === 'INSERT') playNotificationSound(); fetchData(cRole, user.id); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bildirimler' }, () => fetchData(cRole, user.id)).subscribe();
      } else { router.push('/') }
    }
    checkUser();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { clearInterval(timer); if (channel) supabase.removeChannel(channel); if (presenceChannel) supabase.removeChannel(presenceChannel); }
  }, [router, fetchData, playNotificationSound]);

  const handleLogout = async () => { if (window.confirm("Oturumu kapatmak istediğinize emin misiniz?")) { await supabase.auth.signOut(); router.push('/'); } }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const olusturmaTarihi = new Date(ihbar.created_at).getTime();
    const kabulTarihi = ihbar.kabul_tarihi ? new Date(ihbar.kabul_tarihi).getTime() : null;
    const kapatmaTarihi = ihbar.kapatma_tarihi ? new Date(ihbar.kapatma_tarihi).getTime() : null;
    let calisilanDakika = kapatmaTarihi && kabulTarihi ? Math.floor((kapatmaTarihi - kabulTarihi) / 60000) : (kabulTarihi ? Math.floor((now.getTime() - kabulTarihi) / 60000) : Math.floor((now.getTime() - olusturmaTarihi) / 60000));
    const d = (ihbar.durum || '').toLowerCase();
    let durumRengi = "text-blue-400"; let durumIcon = "📡"; let solCizgi = "border-l-blue-500"; 
    if (ihbar.kapatma_tarihi || d.includes('tamamlandi')) { durumRengi = "text-green-500"; durumIcon = "✔️"; solCizgi = "border-l-green-600"; }
    else if (ihbar.varis_tarihi) { durumRengi = "text-yellow-500"; durumIcon = "🔨"; solCizgi = "border-l-yellow-500 animate-pulse"; }
    else if (ihbar.kabul_tarihi) { durumRengi = "text-orange-500"; durumIcon = "🚀"; solCizgi = "border-l-orange-500"; }
    const oneri = aiOneriGetir(`${ihbar.konu} ${ihbar.aciklama || ''}`);
    const isDurduruldu = d.includes('durduruldu');

    return (
      <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className={`group relative p-4 rounded-[1.5rem] border-l-4 border bg-[#1a1c23]/60 backdrop-blur-xl mb-4 transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-2xl ${solCizgi} ${isDurduruldu ? 'border-red-500/50 bg-red-900/5' : 'border-gray-800/40'}`}>
        <div className="flex justify-between items-center mb-3 text-[9px]">
          <span className={`font-black px-2 py-0.5 rounded-full uppercase ${ihbar.oncelik_durumu === 'VARDİYA_MODU' && d.includes('beklemede') ? 'bg-orange-600 text-white animate-bounce' : 'bg-gray-800 text-orange-500'}`}>#{ihbar.ifs_is_emri_no || 'IFS YOK'}</span>
          <span className="text-gray-500 font-black italic">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {ihbar.secilen_nesne_adi && <div className="px-2 py-1 rounded-lg bg-orange-600/10 border border-orange-500/30 text-[8px] font-black text-orange-500 uppercase italic">⚙️ {ihbar.secilen_nesne_adi}</div>}
          {oneri && <div className="px-2 py-1 rounded-lg bg-blue-600/10 border border-blue-500/20 text-[8px] font-black text-blue-400 uppercase italic">🤖 AI: {oneri}</div>}
        </div>
        <div className="mb-3">
          <div className="text-[12px] font-black uppercase text-gray-100 italic tracking-tighter leading-none mb-1">{ihbar.ihbar_veren_ad_soyad}</div>
          <div className="text-[10px] font-bold text-gray-500 uppercase italic truncate opacity-80">{ihbar.konu}</div>
        </div>
        <div className={`flex items-center gap-2 py-2 px-3 rounded-xl bg-black/30 border border-white/5 mb-3 ${durumRengi}`}>
          <span className="text-xs">{durumIcon}</span>
          <span className="text-[9px] font-black uppercase italic tracking-wider">{ihbar.kapatma_tarihi || d.includes('tamamlandi') ? "✅ İŞ TAMAMLANDI" : ihbar.varis_tarihi ? "🔧 ARIZA NOKTASINDA" : ihbar.kabul_tarihi ? "🚛 EKİP YOLDA" : "📡 ATAMA BEKLİYOR"}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-800/40 font-black italic">
          <div className="flex flex-col">
             <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${ihbar.atanan_personel ? 'bg-orange-500' : 'bg-blue-500 animate-pulse'}`}></div>
                <span className="text-[9px] uppercase text-gray-400 truncate max-w-[120px]">{ihbar.profiles?.full_name || ihbar.calisma_gruplari?.grup_adi || 'HAVUZ'}</span>
             </div>
             {ihbar.calisma_gruplari?.grup_adi && <span className="text-[7px] text-blue-500 ml-3.5 uppercase">Atölye: {ihbar.calisma_gruplari.grup_adi}</span>}
          </div>
          <span className={`text-[10px] ${ihbar.kabul_tarihi ? 'text-orange-500' : 'text-gray-500'}`}>{calisilanDakika} DK</span>
        </div>
      </div>
    );
  }

  const NavButton = ({ label, icon: Icon, path, onClick, active = false }: any) => (
    <div onClick={onClick || (() => { router.push(path); setIsMenuOpen(false); })} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border shadow-lg ${active ? 'bg-orange-600 border-orange-400 text-white' : 'bg-[#1a1c23] border-gray-800 text-gray-400 hover:text-white hover:border-orange-500/50'}`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon size={18} className={active ? 'text-white' : 'text-orange-500'} />}
        <span className="text-[10px] font-black uppercase italic tracking-tighter">{label}</span>
      </div>
      <span className="text-[10px] opacity-20 group-hover:opacity-100 transition-opacity">→</span>
    </div>
  )

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* 📱 MOBİL ÜST BAR (KURUMSAL YAZILI) */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#111318] border-b border-gray-800 z-[60]">
        <h1 className="text-xl font-black italic tracking-tighter uppercase">SAHA <span className="text-orange-500">360</span></h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsBildirimAcik(true)} className="relative text-gray-400">
             <LucideIcons.Bell size={24} />
             {bildirimSayisi > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-[8px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{bildirimSayisi}</span>}
          </button>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-orange-500">
            {isMenuOpen ? <LucideIcons.X size={28} /> : <LucideIcons.Menu size={28} />}
          </button>
        </div>
      </div>

      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
        <img src="/logo.png" className="w-2/3 h-auto grayscale invert" />
      </div>

      {/* 🏰 SOL MENÜ */}
      <div className={`fixed md:relative inset-y-0 left-0 z-[55] w-72 bg-[#111318]/95 backdrop-blur-2xl border-r border-gray-800/50 flex flex-col h-full shadow-2xl transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-gray-800/30 bg-black/20 hidden md:block text-center">
           <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">SAHA <span className="text-orange-500 text-outline">360</span></h1>
           <p className="text-[8px] text-gray-500 mt-2 tracking-[0.3em] uppercase">Operasyonel Denetim</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {canSeeMap && <NavButton label="Saha Haritası" icon={LucideIcons.Map} path="/dashboard/saha-haritasi" />}
          <NavButton label="Bildirimler" icon={LucideIcons.Bell} onClick={() => { setIsBildirimAcik(true); setIsMenuOpen(false); }} />
          <div className="h-px bg-gray-800 my-4 opacity-50"></div>
          {canCreateJob && <NavButton label="İhbar Kayıt" icon={LucideIcons.Megaphone} path="/dashboard/yeni-ihbar" />}
          {canManageUsers && <NavButton label="Personel Yönetimi" icon={LucideIcons.Users} path="/dashboard/personel-yonetimi" />}
          {canManageMaterials && <NavButton label="Malzeme Yönetimi" icon={LucideIcons.Package} path="/dashboard/malzeme-yonetimi" />}
          {canManageGroups && <NavButton label="Çalışma Grupları" icon={LucideIcons.Users2} path="/dashboard/calisma-gruplari" />}
          {canSeeTV && <NavButton label="İzleme Ekranı" icon={LucideIcons.Tv} path="/dashboard/izleme-ekrani" />}
          {canSeeReports && <NavButton label="Raporlama" icon={LucideIcons.BarChart3} path="/dashboard/raporlar" />}
          {canManageUsers && (
            <>
              <NavButton label="Nesne Yönetimi" icon={LucideIcons.Settings2} path="/dashboard/teknik-nesne-yonetimi" />
              <NavButton label="AI Öğrenme" icon={LucideIcons.Bot} path="/dashboard/ai-yonetim" />
            </>
          )}
        </nav>
        
        {/* AKTİF PERSONEL */}
        <div className="px-4 py-2 border-t border-gray-800/50 bg-black/20">
            <h4 className="text-[8px] font-black text-green-500 uppercase italic mb-2 tracking-[0.2em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> AKTİF ({onlineUsers.length})
            </h4>
            <div className="max-h-24 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                {onlineUsers.map((u, idx) => (
                    <div key={idx} className="flex flex-col bg-white/5 p-1.5 rounded-lg border border-white/5">
                        <span className="text-[9px] font-black uppercase italic text-gray-300 truncate">{u.name}</span>
                        <span className="text-[7px] font-bold text-gray-600 uppercase italic truncate">{u.role}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-4 bg-black/40 border-t border-gray-800/50">
          <div className="flex flex-col mb-3 px-2">
            <span className="text-[11px] font-black uppercase italic text-orange-500 truncate">{userName}</span>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{userRole}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95 text-white">Oturumu Kapat</button>
        </div>
      </div>

      {/* 🚀 ANA İÇERİK */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 custom-scrollbar">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-yellow-500/10 h-[750px]">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-yellow-500 tracking-[0.2em]">● Bekleyen ({stats.bekleyen})</h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-blue-500/10 h-[750px]">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-blue-400 tracking-[0.2em]">● İşlemde ({stats.islemde})</h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => {
                const d = (i.durum || '').toLowerCase();
                return !d.includes('tamamlandi') && (i.atanan_personel !== null || i.atanan_grup_id !== null || d.includes('calisiliyor') || d.includes('durduruldu'));
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-green-500/10 h-[750px]">
            <div className="mb-4">
              <h3 className="text-[10px] font-black uppercase italic mb-2 text-green-400 tracking-[0.2em]">● Tamamlanan</h3>
              <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                <input type="date" value={bitenFiltreTarih} onChange={(e) => setBitenFiltreTarih(e.target.value)} className="bg-transparent text-[10px] text-green-500 font-black focus:outline-none cursor-pointer w-full" />
                {bitenFiltreTarih && <button onClick={() => setBitenFiltreTarih('')} className="text-red-500 text-xs font-black">×</button>}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => {
                if (!(i.durum || '').toLowerCase().includes('tamamlandi')) return false;
                const kapatma = i.kapatma_tarihi ? new Date(i.kapatma_tarihi).toISOString().split('T')[0] : '';
                return bitenFiltreTarih ? kapatma === bitenFiltreTarih : kapatma === new Date().toISOString().split('T')[0];
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>
        </div>
      </div>
      
      {/* 🔔 BİLDİRİM ÇEKMECESİ */}
      <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-[#111318] z-[100] transform transition-transform duration-500 p-6 flex flex-col border-l border-orange-500/20 ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black italic uppercase text-orange-500 tracking-tighter">Bildirimler</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="text-xs font-black text-gray-500 bg-gray-800 p-2 rounded-full">KAPAT ×</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {bildirimler.map((b) => (
            <div key={b.id} onClick={() => { router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false); }} className="p-4 rounded-2xl border border-gray-800 bg-[#1a1c23] hover:border-orange-500/50 cursor-pointer">
              <div className="flex justify-between mb-2"><span className="text-[8px] bg-green-600 px-2 rounded font-black">İŞ BİTTİ</span><span className="text-[8px] text-gray-600">{new Date(b.created_at).toLocaleTimeString('tr-TR')}</span></div>
              <p className="text-[11px] font-black italic uppercase text-gray-200">{b.mesaj}</p>
            </div>
          ))}
        </div>
      </div>

      {(isBildirimAcik || isMenuOpen) && <div onClick={() => { setIsBildirimAcik(false); setIsMenuOpen(false); }} className="fixed inset-0 bg-black/75 backdrop-blur-md z-[50]"></div>}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  )
}