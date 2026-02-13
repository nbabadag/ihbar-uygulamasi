'use client'

/**
 * SAHA 360 - OPERASYONEL KONTROL MERKEZİ
 * NUSRET KAPTAN ÖZEL SÜRÜM - BİLDİRİM KAYIT MOTORLU
 */

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  useEffect, 
  useState, 
  useCallback, 
  useRef 
} from 'react'

// --- 🔔 BİLDİRİM KÜTÜPHANESİ ---
import { PushNotifications } from '@capacitor/push-notifications'

// --- 🛠️ ICON ÇAKIŞMA ÖNLEME (ALIASING) ---
import Bell from 'lucide-react/dist/esm/icons/bell'
import Menu from 'lucide-react/dist/esm/icons/menu'
import X from 'lucide-react/dist/esm/icons/x'
import LucideMap from 'lucide-react/dist/esm/icons/map' 
import Megaphone from 'lucide-react/dist/esm/icons/megaphone'
import Users from 'lucide-react/dist/esm/icons/users'
import Package from 'lucide-react/dist/esm/icons/package'
import Users2 from 'lucide-react/dist/esm/icons/users-2'
import Tv from 'lucide-react/dist/esm/icons/tv'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import Bot from 'lucide-react/dist/esm/icons/bot'
import User from 'lucide-react/dist/esm/icons/user'
import Settings from 'lucide-react/dist/esm/icons/settings'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import NavigationIcon from 'lucide-react/dist/esm/icons/navigation'

export default function DashboardPage() {
  const router = useRouter()
  
  // --- 📊 İSTATİSTİK VE VERİ STATE'LERİ ---
  const [stats, setStats] = useState({ 
    bekleyen: 0, 
    islemde: 0, 
    tamamlanan: 0 
  })
  
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- 🔊 SESLİ BİLDİRİM MOTORU ---
  const playNotificationSound = useCallback((customMsg?: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => console.warn("Ses dosyası tetiklenemedi."));
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const msg = new SpeechSynthesisUtterance(customMsg || "Saha verileri güncellendi");
        msg.lang = 'tr-TR';
        msg.pitch = 1;
        msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
      }
    } catch (err) {
      console.error("Ses hatası:", err);
    }
  }, []);

  // --- 🛡️ YETKİ KONTROL PANELİ ---
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

  // --- 🤖 AI ÖNERİ SİSTEMİ ---
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

  // --- 🔄 ANA VERİ ÇEKME FONKSİYONU ---
  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    
    const { data: userGroupData } = await supabase
      .from('grup_uyeleri')
      .select('grup_id, calisma_gruplari(grup_adi)')
      .eq('profil_id', id);
    
    const grupIds = userGroupData?.map(g => g.grup_id) || [];
    setUserGroups(userGroupData?.map((g: any) => g.calisma_gruplari?.grup_adi).filter(Boolean) || []); 

    const { data: komboData } = await supabase.from('ai_kombinasyonlar').select('*');
    if (komboData) setAiKombinasyonlar(komboData);

    const { data: ihbarData } = await supabase
      .from('ihbarlar')
      .select(`*, profiles:atanan_personel(full_name), calisma_gruplari:atanan_grup_id(grup_adi)`)
      .order('created_at', { ascending: false });

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
          const isAsil = i.atanan_personel === id; 
          const isYardimci = i.yardimci_personel_id === id; 
          const isGrup = grupIds.includes(i.atanan_grup_id);
          const isVardiya = (!isMesaiSaatleri && i.oncelik_durumu === 'VARDİYA_MODU' && d.includes('beklemede'));
          if (d.includes('tamamlandi')) return isAsil || isYardimci;
          return isAsil || isYardimci || isGrup || isVardiya;
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

    const { data: bData, count } = await supabase
      .from('bildirimler')
      .select('*', { count: 'exact' })
      .eq('is_read', false)
      .filter('hedef_roller', 'ov', `{${role.trim().toUpperCase()}}`)
      .order('created_at', { ascending: false })
      .limit(20);

    setBildirimSayisi(count || 0); 
    setBildirimler(bData || []);
  }, []);

// --- 🚪 OTURUM KAPATMA FONKSİYONU ---
const handleLogout = async () => { 
  if (window.confirm("Oturumu kapatmak istediğinize emin misiniz?")) { 
    await supabase.auth.signOut(); 
    router.push('/'); 
  } 
};

// --- 🔔 PUSH BİLDİRİM KAYIT MOTORU ---
const setupPushNotifications = async (currentUserId: string) => {
  try {
    if (typeof window === 'undefined') return;

    // 1. İzin İste
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') return;

    // 2. Kayıt Ol (Token Al)
    await PushNotifications.register();

    // 3. Token'ı Supabase'e Yaz
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push Token Alındı:', token.value);
      await supabase.from('profiles').update({ push_token: token.value }).eq('id', currentUserId);
    });

    // 4. Uygulama Açıkken Bildirim Geldiğinde Ses Çal
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      playNotificationSound(notification.body || "Yeni bir ihbar kaydı var.");
    });

  } catch (error) {
    console.error('Push hatası:', error);
  }
};

// --- 🛰️ REALTIME VE KONUM TAKİBİ ETKİSİ ---
useEffect(() => {
  audioRef.current = new Audio('/notification.mp3');
  
  const unlock = () => { 
    audioRef.current?.play().then(() => audioRef.current?.pause()).catch(()=>{}); 
    window.removeEventListener('click', unlock); 
  };
  window.addEventListener('click', unlock);

  let ihbarChannel: any; 
  let presenceChannel: any;

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
      const cRole = profile?.role || 'Saha Personeli';
      const cName = profile?.full_name || 'Kullanıcı';
      setUserName(cName); 
      setUserRole(cRole); 
      fetchData(cRole, user.id);
      setupPushNotifications(user.id); // Telsiz kaydını ateşle
      
      // 1. KANAL: CANLI KONUM VE PRESENCE
      presenceChannel = supabase.channel('online-sync', { config: { presence: { key: 'user' } } });
      
      presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).flat().map((p: any) => ({ 
          id: p.id, name: p.name, role: p.role, lat: p.lat, lng: p.lng 
        }));
        setOnlineUsers(Array.from(new Map(users.map((u:any) => [u.id, u])).values()));
      });

      presenceChannel.subscribe(async (status: string) => { 
        if (status === 'SUBSCRIBED' && "geolocation" in navigator) {
            navigator.geolocation.watchPosition((pos) => {
                presenceChannel.track({ 
                    id: user.id, name: cName, role: cRole, 
                    lat: pos.coords.latitude, lng: pos.coords.longitude 
                });
            }, null, { enableHighAccuracy: true });
        }
      });
      
      // 2. KANAL: ÖZEL İHBAR RADARI
      ihbarChannel = supabase.channel(`ihbar-radari-${user.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ihbarlar' 
        }, (p: any) => { 
          playNotificationSound(`Saha ekipleri dikkat! ${p.new.konu} konulu yeni bir ihbar kaydı oluşturuldu.`); 
          fetchData(cRole, user.id); 
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'ihbarlar' 
        }, (p: any) => {
          const eskiDurum = (p.old?.durum || '').toLowerCase();
          const yeniDurum = (p.new?.durum || '').toLowerCase();
          if (!eskiDurum.includes('tamamlandi') && yeniDurum.includes('tamamlandi')) {
            playNotificationSound("Tamamlanan bir iş kaydı arşive alındı.");
          }
          fetchData(cRole, user.id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bildirimler' }, () => fetchData(cRole, user.id))
        .subscribe();
    } else { 
      router.push('/') 
    }
  }
  
  checkUser();
  
  const timer = setInterval(() => setNow(new Date()), 60000);
  
  return () => { 
    clearInterval(timer); 
    if (ihbarChannel) supabase.removeChannel(ihbarChannel); 
    if (presenceChannel) supabase.removeChannel(presenceChannel); 
  };
}, [router, fetchData, playNotificationSound]);

  // --- 🃏 İŞ KARTI BİLEŞENİ ---
  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const olusturmaTarihi = new Date(ihbar.created_at).getTime();
    const kabulTarihi = ihbar.kabul_tarihi ? new Date(ihbar.kabul_tarihi).getTime() : null;
    const kapatmaTarihi = ihbar.kapatma_tarihi ? new Date(ihbar.kapatma_tarihi).getTime() : null;
    let calisilanDakika = kabulTarihi ? Math.floor(( (kapatmaTarihi || now.getTime()) - kabulTarihi) / 60000) : Math.floor((now.getTime() - olusturmaTarihi) / 60000);
    const d = (ihbar.durum || '').toLowerCase();
    
    let durumRengi = "text-blue-400"; 
    let durumIcon = "📡"; 
    let durumMetni = "ATAMA BEKLİYOR"; 
    let solCizgi = "border-l-blue-500"; 

    if (d.includes('durduruldu')) { 
      durumRengi = "text-red-500"; 
      durumIcon = "⚠️"; 
      durumMetni = "İŞ DURDURULDU"; 
      solCizgi = "border-l-red-600"; 
    } else if (ihbar.kapatma_tarihi || d.includes('tamamlandi')) { 
      durumRengi = "text-green-500"; 
      durumIcon = "✅"; 
      durumMetni = "İŞ TAMAMLANDI"; 
      solCizgi = "border-l-green-600"; 
    } else if (ihbar.varis_tarihi) { 
      durumRengi = "text-yellow-500"; 
      durumIcon = "🔧"; 
      durumMetni = "EKİP ARIZA YERİNDE"; 
      solCizgi = "border-l-yellow-500 animate-pulse"; 
    } else if (ihbar.kabul_tarihi) { 
      durumRengi = "text-orange-500"; 
      durumIcon = "🚛"; 
      durumMetni = "EKİP YOLDA / BAŞLADI"; 
      solCizgi = "border-l-orange-500"; 
    }

    const oneri = aiOneriGetir(`${ihbar.konu} ${ihbar.aciklama || ''}`);
    const atananIsmi = ihbar.profiles?.full_name || ihbar.calisma_gruplari?.grup_adi || 'HAVUZ';

    return (
      <div 
        onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} 
        className={`group relative p-5 rounded-[2rem] border-l-[6px] border bg-[#1a1c23]/80 backdrop-blur-3xl mb-5 transition-all duration-300 hover:scale-[1.03] cursor-pointer shadow-2xl ${solCizgi} border-gray-800/50`}
      >
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex flex-col flex-1">
            <h4 className="text-[13px] font-black uppercase text-white italic tracking-tighter leading-tight mb-1">
              {ihbar.konu}
            </h4>
            <span className="text-[10px] font-bold text-gray-500 uppercase italic">
              Bildiren: {ihbar.ihbar_veren_ad_soyad}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-gray-900 text-orange-500 border border-orange-500/20 shadow-lg">
              #{ihbar.ifs_is_emri_no || 'IFS YOK'}
            </span>
            <span className="text-[9px] text-gray-600 font-black italic">
              {new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 mb-4 bg-black/40 p-3 rounded-2xl border border-white/5 shadow-inner font-black italic uppercase">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={14} className="text-orange-500" />
              <span className="text-[11px] text-gray-200">
                {atananIsmi}
              </span>
            </div>
            {ihbar.atanan_grup_id && (
              <span className="text-[8px] text-blue-500 tracking-widest">
                {ihbar.calisma_gruplari?.grup_adi}
              </span>
            )}
          </div>
          {ihbar.yardimci_personel_ad && (
            <div className="flex items-center gap-2 pl-6 py-1 border-l border-gray-800">
              <Users size={12} className="text-gray-500" />
              <span className="text-[9px] text-gray-400">
                Destek: {ihbar.yardimci_personel_ad}
              </span>
            </div>
          )}
        </div>
        
        {ihbar.secilen_nesne_adi && (
          <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-orange-500/5 rounded-xl border border-orange-500/10 shadow-sm font-black italic uppercase">
            <div className="p-1.5 bg-orange-500/10 rounded-lg">
              <Settings size={14} className="text-orange-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-300">
                TEKNİK NESNE
              </span>
              <span className="text-[11px] text-orange-400">
                {ihbar.secilen_nesne_adi}
              </span>
            </div>
          </div>
        )}
        
        <div className={`flex items-center justify-between py-3 px-4 rounded-[1.2rem] bg-black/40 border border-white/5 mb-4 shadow-lg ${durumRengi} font-black italic uppercase`}>
          <div className="flex items-center gap-3">
            <span className="text-lg">{durumIcon}</span>
            <span className="text-[10px] tracking-widest">{durumMetni}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px]">{calisilanDakika} Dakika</span>
            <span className="text-[7px] opacity-50 tracking-tighter">Fiili İşlem Süresi</span>
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-800/40 space-y-3 font-black italic uppercase">
          {oneri && (
            <div className="flex items-center gap-3 p-2 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <Bot size={16} className="text-blue-400 animate-pulse" />
              <span className="text-[9px] text-blue-300 tracking-tighter">
                AI ASİSTAN ÖNERİSİ: {oneri}
              </span>
            </div>
          )}
          {!ihbar.kapatma_tarihi && (
            <div className="relative w-full h-1.5 bg-gray-900 rounded-full overflow-hidden shadow-inner">
               <div 
                 className={`h-full transition-all duration-1000 rounded-full ${calisilanDakika > 60 ? 'bg-red-600' : calisilanDakika > 30 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                 style={{ width: `${Math.min((calisilanDakika / 120) * 100, 100)}%` }}
               ></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row text-white font-sans relative overflow-hidden bg-[#0a0b0e] font-black italic uppercase">
      
      {/* 📱 MOBİL HEADER */}
      <div className="md:hidden flex items-center justify-between p-5 bg-[#111318] border-b border-gray-800 z-[60] shadow-2xl">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
          SAHA <span className="text-orange-500">360</span>
        </h1>
        <div className="flex items-center gap-5">
          <button 
            onClick={() => setIsBildirimAcik(true)} 
            className="relative text-gray-400 p-1"
          >
             <Bell size={26} />
             {bildirimSayisi > 0 && (
               <span className="absolute -top-1 -right-1 bg-orange-600 text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse border-2 border-[#111318]">
                 {bildirimSayisi}
               </span>
             )}
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="text-orange-500 p-1"
          >
            {isMenuOpen ? <X size={30} /> : <Menu size={30} />}
          </button>
        </div>
      </div>

      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <img src="/logo.png" className="w-3/4 h-auto grayscale invert" />
      </div>

      {/* 🏰 SOL MENÜ */}
      <div className={`fixed md:relative inset-y-0 left-0 z-[55] w-64 bg-[#111318]/98 backdrop-blur-3xl border-r border-gray-800 flex flex-col h-full shadow-[50px_0_100px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 border-b border-gray-800/50 bg-black/20 hidden md:block text-center shrink-0">
           <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">
             SAHA <span className="text-orange-500 text-outline">360</span>
           </h1>
           <p className="text-[8px] text-gray-500 mt-3 tracking-[0.3em] uppercase opacity-50 italic">
             Operasyonel Kontrol
           </p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {canSeeMap && (
            <div 
              onClick={() => router.push('/dashboard/saha-haritasi')} 
              className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-3">
                <LucideMap size={18} className="text-orange-500" />
                <span className="text-[10px] tracking-widest uppercase">Saha Haritası</span>
              </div>
              <ChevronRight size={14} />
            </div>
          )}
          
          <div 
            onClick={() => router.push('/dashboard/canli-takip')} 
            className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer bg-orange-500/10 border border-orange-500/30 text-orange-500 hover:bg-orange-500 hover:text-white transition-all group"
          >
            <div className="flex items-center gap-3">
              <NavigationIcon size={18} className="animate-pulse" />
              <span className="text-[10px] tracking-widest uppercase">Canlı Konum</span>
            </div>
            <ChevronRight size={14} />
          </div>

          <div 
            onClick={() => setIsBildirimAcik(true)} 
            className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-orange-500" />
              <span className="text-[10px] tracking-widest uppercase">Bildirim Paneli</span>
            </div>
            <ChevronRight size={14} />
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent my-4 opacity-50"></div>

          {canCreateJob && (
            <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <Megaphone size={18} className="text-orange-500" />
              <span className="text-[10px] uppercase">Yeni İhbar Kaydı</span>
            </div>
          )}

          {canManageUsers && (
            <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <Users size={18} className="text-orange-500" />
              <span className="text-[10px] uppercase">Personel Veritabanı</span>
            </div>
          )}

          {canManageMaterials && (
            <div onClick={() => router.push('/dashboard/malzeme-yonetimi')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <Package size={18} className="text-orange-500" />
              <span className="text-[10px] uppercase">Malzeme Stok</span>
            </div>
          )}

          {canManageGroups && (
            <div onClick={() => router.push('/dashboard/calisma-gruplari')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <Users2 size={18} className="text-orange-500" />
              <span className="text-[10px] uppercase">Çalışma Grupları</span>
            </div>
          )}

          {canSeeTV && (
            <div onClick={() => router.push('/dashboard/izleme-ekrani')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <Tv size={18} className="text-orange-500" />
              <span className="text-[10px] uppercase">Canlı İzleme</span>
            </div>
          )}

          {canSeeReports && (
            <div onClick={() => router.push('/dashboard/raporlar')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
              <BarChart3 size={18} className="text-orange-500" />
              <span className="text-[10px] uppercase">Analiz & Rapor</span>
            </div>
          )}

          {canManageUsers && (
            <div className="pt-4 space-y-2 border-t border-gray-800/30">
              <div onClick={() => router.push('/dashboard/teknik-nesne-yonetimi')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
                <Settings2 size={18} className="text-orange-500" />
                <span className="text-[10px] uppercase">Teknik Nesne</span>
              </div>
              <div onClick={() => router.push('/dashboard/ai-yonetim')} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer bg-[#1a1c23] border border-gray-800 text-gray-400 hover:text-white transition-colors">
                <Bot size={18} className="text-orange-500" />
                <span className="text-[10px] uppercase">AI Öğrenme</span>
              </div>
            </div>
          )}
        </nav>
        
        {/* 👤 AKTİF PERSONEL VE KONUM DURUMU */}
        <div className="px-5 py-4 border-t border-gray-800/50 bg-black/30 shrink-0 font-black italic uppercase">
            <h4 className="text-[9px] text-green-500 mb-3 tracking-[0.3em] flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span> SAHADA AKTİF ({onlineUsers.length})
            </h4>
            <div className="max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-2">
                {onlineUsers.map((u: any, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/[0.03] p-2 rounded-xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-200 truncate leading-none font-black italic uppercase">{u.name}</span>
                            <span className="text-[8px] text-gray-600 tracking-tighter mt-1">{u.role}</span>
                        </div>
                        {u.lat && <div className="text-orange-500 animate-bounce"><NavigationIcon size={10} /></div>}
                    </div>
                ))}
            </div>
        </div>

        <div className="p-6 bg-black/50 border-t border-gray-800/50 shrink-0 font-black italic uppercase">
          <div className="flex flex-col mb-4 px-2">
            <span className="text-[12px] text-orange-500 truncate leading-none">
              {userName}
            </span>
            <span className="text-[9px] text-gray-500 tracking-[0.1em] mt-1">
              {userRole}
            </span>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-full bg-gradient-to-r from-red-600 to-red-800 p-4 rounded-2xl text-[9px] shadow-2xl transition-all active:scale-95 text-white border border-red-500/20 font-black"
          >
            Oturumu Güvenli Kapat
          </button>
        </div>
      </div>

      {/* 🚀 ANA İÇERİK ALANI */}
      <div className="flex-1 overflow-y-auto p-5 md:p-10 relative z-10 custom-scrollbar">
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* BEKLEYEN KOLONU */}
          <div className="flex flex-col bg-[#111318]/50 backdrop-blur-2xl p-6 rounded-[3rem] border border-yellow-500/10 h-[800px] shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-8 px-2 shrink-0">
              <h3 className="text-[11px] text-yellow-500 tracking-[0.3em] flex items-center gap-2 leading-none font-black italic uppercase">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> BEKLEYEN ({stats.bekleyen})
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && i.atanan_personel === null && i.atanan_grup_id === null).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          {/* İŞLEMDE KOLONU */}
          <div className="flex flex-col bg-[#111318]/50 backdrop-blur-2xl p-6 rounded-[3rem] border border-blue-500/10 h-[800px] shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-8 px-2 shrink-0">
              <h3 className="text-[11px] text-blue-400 tracking-[0.3em] flex items-center gap-2 leading-none font-black italic uppercase">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> İŞLEMDE ({stats.islemde})
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
              {ihbarlar.filter(i => {
                const d = (i.durum || '').toLowerCase();
                return !d.includes('tamamlandi') && (i.atanan_personel !== null || i.atanan_grup_id !== null || d.includes('calisiliyor') || d.includes('durduruldu'));
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </div>

          {/* TAMAMLANAN KOLONU */}
          <div className="flex flex-col bg-[#111318]/50 backdrop-blur-2xl p-6 rounded-[3rem] border border-green-500/10 h-[800px] shadow-2xl overflow-hidden font-black italic uppercase">
            <div className="mb-8 px-2 shrink-0">
              <h3 className="text-[11px] text-green-400 tracking-[0.3em] flex items-center gap-2 leading-none mb-4">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> TAMAMLANAN ({stats.tamamlanan})
              </h3>
              <div className="flex items-center gap-2 bg-black/40 p-3 rounded-2xl border border-white/5 mx-2">
                <Calendar size={14} className="text-green-600" />
                <input 
                  type="date" 
                  value={bitenFiltreTarih} 
                  onChange={(e) => setBitenFiltreTarih(e.target.value)} 
                  className="bg-transparent text-[10px] text-green-500 focus:outline-none cursor-pointer w-full" 
                />
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

      {/* 🔔 BİLDİRİM PANELİ */}
      <div className={`fixed inset-y-0 right-0 w-80 md:w-[450px] bg-[#111318] z-[100] transform transition-transform duration-700 ease-in-out p-8 flex flex-col border-l border-orange-500/20 shadow-[-50px_0_100px_rgba(0,0,0,0.8)] ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-10 shrink-0">
          <div className="flex flex-col font-black italic uppercase">
            <h3 className="text-2xl text-orange-500 tracking-tighter leading-none">BİLDİRİMLER</h3>
          </div>
          <button 
            onClick={() => setIsBildirimAcik(false)} 
            className="bg-gray-800/50 hover:bg-orange-600/20 p-3 rounded-2xl text-[10px] transition-all border border-white/5 hover:border-orange-500/50 font-black italic uppercase"
          >
            Kapat ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-2 font-black italic uppercase">
          {bildirimler.map((b) => (
            <div key={b.id} onClick={() => { router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false); }} className="p-5 rounded-3xl border border-gray-800 bg-[#1a1c23]/50 hover:bg-[#1a1c23] hover:border-orange-500/50 cursor-pointer transition-all shadow-xl group">
              <div className="flex justify-between mb-3 items-center">
                <span className={`text-[9px] px-3 py-1 rounded-full text-white tracking-tighter ${b.mesaj?.includes('BİTTİ') ? 'bg-green-600 shadow-green-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                  {b.mesaj?.includes('BİTTİ') ? '● TAMAMLANDI' : '● GÜNCELLEME'}
                </span>
                <span className="text-[9px] text-gray-600 font-black italic">{new Date(b.created_at).toLocaleTimeString('tr-TR')}</span>
              </div>
              <p className="text-[12px] text-gray-200 leading-snug mb-3 group-hover:text-white transition-colors">{b.mesaj}</p>
              <div className="flex justify-between items-center pt-3 border-t border-gray-800/50 font-black italic uppercase">
                <span className="text-[9px] text-orange-500">KAYIT ID: #{b.ihbar_id}</span>
                <span className="text-[9px] text-gray-600">👤 {b.islem_yapan_ad || 'Sistem'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(isBildirimAcik || isMenuOpen) && <div onClick={() => { setIsBildirimAcik(false); setIsMenuOpen(false); }} className="fixed inset-0 bg-black/85 backdrop-blur-xl z-[50]"></div>}
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 20px; border: 2px solid transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
        .text-outline { -webkit-text-stroke: 1px rgba(249, 115, 22, 0.3); color: transparent; }
      `}</style>
    </div>
  )
}

