'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Mobil menü kontrolü
  
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])

  // --- 📱 MOBİL BİLDİRİM SİSTEMİ (v10 MÜHÜR) ---
  const initPushNotifications = useCallback(async (currentUserId: string) => {
    if (Capacitor.getPlatform() === 'web') return;

    if (Capacitor.getPlatform() === 'android') {
        try {
          await PushNotifications.createChannel({
            id: 'saha360_v10',
            name: 'Saha360 ACIL SES',
            description: 'Acil ihbar sesi ve ekran uyanması',
            sound: 'ihbar_sesi', 
            importance: 5,
            visibility: 1,
            vibration: true,
          });
        } catch (e) { console.error("Kanal hatası:", e); }
    }

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      await supabase.from('profiles').update({ fcm_token: token.value }).eq('id', currentUserId);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Mobil Bildirim Geldi:', notification);
    });
  }, []);

  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {});
  }, []);

  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole.includes('ADMIN');
  const isSahaPersoneli = normalizedRole === 'SAHA PERSONELI';
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
    
    // PERFORMANS: Tamamlananlar için sadece bu ayın başını al
    const ayinBaslangici = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const { data: userGroupData } = await supabase.from('grup_uyeleri').select('grup_id, calisma_gruplari(grup_adi)').eq('profil_id', id);
    const grupIds = userGroupData?.map(g => g.grup_id) || [];
    setUserGroups(userGroupData?.map((g: any) => g.calisma_gruplari?.grup_adi).filter(Boolean) || []);

    const { data: komboData } = await supabase.from('ai_kombinasyonlar').select('*');
    if (komboData) setAiKombinasyonlar(komboData);

    const { data: ihbarData } = await supabase
      .from('ihbarlar')
      .select(`*, profiles:atanan_personel(full_name), calisma_gruplari:atanan_grup_id(grup_adi)`)
      .or(`durum.not.ilike.%tamamlandi%,created_at.gte.${ayinBaslangici}`) // KRİTİK FİLTRE
      .order('created_at', { ascending: false });

    if (ihbarData) {
      let filtered = ihbarData;
      if (role.trim().toUpperCase() === 'SAHA PERSONELI') {
        filtered = ihbarData.filter(i => (i.atanan_personel === id) || (grupIds.includes(i.atanan_grup_id)));
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

    const { data: bData, count } = await supabase.from('bildirimler').select('*', { count: 'exact' }).eq('is_read', false).contains('hedef_roller', [role.trim().toUpperCase()]).order('created_at', { ascending: false }).limit(20);
    setBildirimSayisi(count || 0);
    setBildirimler(bData || []);
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
        setUserName(currentName); setUserRole(currentRole);
        fetchData(currentRole, user.id);
        initPushNotifications(user.id);

        presenceChannel = supabase.channel('online-sync', { config: { presence: { key: 'user' } } })
        presenceChannel.on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const users = Object.values(state).flat().map((p: any) => ({ id: p.id, name: p.name, role: p.role }));
            setOnlineUsers(Array.from(new Map(users.map((u:any) => [u.id, u])).values()));
        }).subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') await presenceChannel.track({ id: user.id, name: currentName, role: currentRole });
        });

        channel = supabase.channel(`dashboard-realtime-${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, (payload: any) => { 
            if (payload.eventType === 'INSERT') playNotificationSound();
            fetchData(currentRole, user.id); 
          })
          .subscribe()
      } else { router.push('/') }
    }
    checkUser();
    const timer = setInterval(() => { setNow(new Date()); }, 60000)
    return () => { clearInterval(timer); if (channel) supabase.removeChannel(channel); if (presenceChannel) supabase.removeChannel(presenceChannel); }
  }, [router, fetchData, playNotificationSound, initPushNotifications])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); }

  // --- YARDIMCI BİLEŞENLER ---
  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const d = (ihbar.durum || '').toLowerCase();
    let solCizgi = d.includes('tamamlandi') ? "border-l-green-600" : ihbar.varis_tarihi ? "border-l-yellow-500 animate-pulse" : ihbar.kabul_tarihi ? "border-l-orange-500" : "border-l-blue-500";
    
    return (
      <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className={`p-4 rounded-[1.5rem] border-l-4 border bg-[#1a1c23]/60 backdrop-blur-xl mb-4 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${solCizgi}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-800 text-orange-500 uppercase tracking-widest">#{ihbar.ifs_is_emri_no || 'IFS YOK'}</span>
          <span className="text-[9px] text-gray-500 font-black italic">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="text-[12px] font-black uppercase text-gray-100 mb-1">{ihbar.ihbar_veren_ad_soyad}</div>
        <div className="text-[10px] font-bold text-gray-500 uppercase italic truncate">{ihbar.konu}</div>
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-800/40">
           <span className="text-[9px] uppercase text-gray-400 font-black italic">{ihbar.profiles?.full_name || ihbar.calisma_gruplari?.grup_adi || 'HAVUZ'}</span>
           <span className="text-[10px] text-orange-500 font-black italic">{Math.floor((now.getTime() - new Date(ihbar.created_at).getTime()) / 60000)} DK</span>
        </div>
      </div>
    );
  }

  const NavButton = ({ label, icon, path, onClick, active = false, count = 0 }: any) => (
    <div onClick={onClick || (() => { router.push(path); setIsSidebarOpen(false); })} className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border ${active ? 'bg-orange-600 border-orange-400 text-white' : 'bg-[#1a1c23] border-gray-800 text-gray-400'}`}>
      <div className="flex items-center gap-3">
        <span className="text-lg relative">{icon}{label === "Bildirimler" && count > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{count}</span>}</span>
        <span className="text-[11px] font-black uppercase italic tracking-tighter">{label}</span>
      </div>
    </div>
  )

  return (
    <div className="h-screen w-screen flex text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* MOBİL BURGER BUTONU */}
      <div className="md:hidden fixed top-4 left-4 z-[60]">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-orange-600 p-2.5 rounded-xl shadow-lg border border-orange-400 active:scale-90 transition-all text-xl">
          {isSidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* SOL MENÜ (RESPONSIVE) */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 w-72 bg-[#111318]/95 backdrop-blur-2xl border-r border-gray-800/50 flex flex-col h-full transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-gray-800/30 bg-black/20 flex justify-center">
          <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {canSeeMap && <NavButton label="Saha Haritası" icon="🛰️" path="/dashboard/saha-haritasi" />}
          <NavButton label="Bildirimler" icon="🔔" onClick={() => { setIsBildirimAcik(true); setIsSidebarOpen(false); }} count={bildirimSayisi} />
          <div className="h-px bg-gray-800 my-4 opacity-50"></div>
          <NavButton label="İhbar Kayıt" icon="📢" path="/dashboard/yeni-ihbar" />
          <NavButton label="Personel Yönetimi" icon="👤" path="/dashboard/personel-yonetimi" />
          <NavButton label="Çalışma Gruplari" icon="👥" path="/dashboard/calisma-gruplari" />
          <NavButton label="İzleme Ekranı" icon="📺" path="/dashboard/izleme-ekrani" />
          <NavButton label="Raporlama" icon="📊" path="/dashboard/raporlar" />
        </nav>
        <div className="p-4 bg-black/40 border-t border-gray-800/50">
          <div className="flex flex-col mb-3 px-2">
            <span className="text-[11px] font-black uppercase text-orange-500 truncate">{userName}</span>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{userRole}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-xl font-black text-[9px] uppercase">Oturumu Kapat</button>
        </div>
      </div>

      {/* MOBİL ARKA PLAN KARARTMA */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"></div>}

      {/* ANA İÇERİK */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 custom-scrollbar flex flex-col">
        <div className="hidden md:flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl mb-8">
            <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <div className="font-black uppercase italic text-xs tracking-tighter">Saha 360 // Denetim Merkezi</div>
            </div>
        </div>

        {/* İHBAR SÜTUNLARI (MOBİLDE SAĞA KAYDIRILABİLİR) */}
        <div className="flex overflow-x-auto md:grid md:grid-cols-1 xl:grid-cols-3 gap-6 pb-8 snap-x snap-mandatory flex-1 custom-scrollbar">
          
          {/* BEKLEYENLER */}
          <div className="min-w-[85vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-yellow-500/10 h-[650px] md:h-[750px]">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-yellow-500 flex items-center gap-2 tracking-[0.2em] sticky top-0 bg-[#111318]/10 py-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Havuz ({stats.bekleyen})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          {/* İŞLEMDE */}
          <div className="min-w-[85vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-blue-500/10 h-[650px] md:h-[750px]">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-blue-400 flex items-center gap-2 tracking-[0.2em] sticky top-0 bg-[#111318]/10 py-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> İşlemde ({stats.islemde})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {ihbarlar.filter(i => {
                const d = (i.durum || '').toLowerCase();
                return !d.includes('tamamlandi') && (i.atanan_personel !== null || i.atanan_grup_id !== null || d.includes('calisiliyor') || d.includes('durduruldu'));
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          {/* TAMAMLANANLAR (BU AY) */}
          <div className="min-w-[85vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-green-500/10 h-[650px] md:h-[750px]">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-green-400 flex items-center gap-2 tracking-[0.2em] sticky top-0 bg-[#111318]/10 py-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Bu Ay Biten ({stats.tamamlanan})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

        </div>
      </div>

      {/* BİLDİRİM DRAWER (MEVCUT) */}
      <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-[#111318] shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[100] transform transition-transform duration-500 p-6 flex flex-col border-l border-orange-500/20 ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black italic uppercase text-orange-500 tracking-tighter">Bildirimler ({bildirimSayisi})</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="bg-gray-800 p-2 rounded-full text-[10px] font-black uppercase">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {bildirimler.map((b) => (
            <div key={b.id} onClick={() => { supabase.from('bildirimler').update({ is_read: true }).eq('id', b.id); router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false); }} className="p-4 rounded-2xl border border-gray-800 bg-[#1a1c23] cursor-pointer">
              <p className="text-[11px] font-black italic uppercase text-gray-200">{b.mesaj}</p>
              <div className="text-[9px] mt-2 text-orange-500 font-black">#{b.ihbar_id} - {new Date(b.created_at).toLocaleTimeString('tr-TR')}</div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  )
}
