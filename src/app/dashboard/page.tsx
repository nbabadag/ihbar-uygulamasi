'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { 
  Bell, LogOut, Map, LayoutDashboard, 
  Settings, User, Menu, AlertTriangle, CheckCircle2, Clock
} from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  
  // --- STATE YÖNETİMİ ---
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isBildirimAcik, setIsBildirimAcik] = useState(false)
  const [bildirimSayisi, setBildirimSayisi] = useState(0)
  const [bildirimler, setBildirimler] = useState<any[]>([])
  const [now, setNow] = useState(new Date())
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])

  // --- 📱 MOBİL BİLDİRİM & v10 KANAL MÜHRÜ ---
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
  }, []);

  // --- 📊 VERİ ÇEKME & AYLIK FİLTRE (PERFORMANS) ---
  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    
    // Sadece bu ayın 1'inden sonrasını çek (1000 kayıt yükünü bitirir)
    const ayinBaslangici = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    try {
      const { data: ihbarData } = await supabase
        .from('ihbarlar')
        .select(`*, profiles:atanan_personel(full_name), calisma_gruplari:atanan_grup_id(grup_adi)`)
        .or(`durum.not.ilike.%tamamlandi%,created_at.gte.${ayinBaslangici}`) 
        .order('created_at', { ascending: false });

      if (ihbarData) {
        setIhbarlar(ihbarData);
        setStats({
          bekleyen: ihbarData.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && !i.atanan_personel).length,
          tamamlanan: ihbarData.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).length,
          islemde: ihbarData.filter(i => {
            const d = (i.durum || '').toLowerCase();
            return !d.includes('tamamlandi') && (i.atanan_personel || d.includes('calisiliyor'));
          }).length
        });
      }

      const { data: bData, count } = await supabase.from('bildirimler').select('*', { count: 'exact' }).eq('is_read', false).limit(10);
      setBildirimSayisi(count || 0);
      setBildirimler(bData || []);
    } finally {
      setTimeout(() => setIsLoading(false), 1200); // Animasyonun tadını çıkarmak için biraz gecikme
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        setUserName(profile?.full_name || 'Kullanıcı');
        setUserRole(profile?.role || 'Saha Personeli');
        fetchData(profile?.role || 'Saha Personeli', user.id);
        initPushNotifications(user.id);
      } else { router.push('/'); }
    }
    checkUser();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [router, fetchData, initPushNotifications]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  // --- 🚀 YÜKLEME EKRANI ---
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0b0e] flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <img src="/logo.png" className="w-24 h-auto animate-pulse grayscale invert opacity-50" />
          <div className="absolute -inset-4 border-2 border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-orange-500 font-black italic tracking-[0.6em] text-[10px] animate-pulse">Y Ü K L E N İ Y O R</h2>
      </div>
    );
  }

  // --- 📱 YARDIMCI BİLEŞENLER ---
  const JobCard = ({ ihbar }: { ihbar: any }) => (
    <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="p-4 rounded-[1.5rem] border border-white/5 bg-[#1a1c23]/60 backdrop-blur-xl mb-4 transition-all active:scale-95 cursor-pointer border-l-4 border-l-orange-500">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-600/10 text-orange-500 uppercase tracking-widest">#{ihbar.ifs_is_emri_no || 'YENİ'}</span>
        <span className="text-[8px] text-gray-500 font-bold">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <div className="text-[12px] font-black uppercase text-gray-100 mb-1 truncate">{ihbar.ihbar_veren_ad_soyad}</div>
      <div className="text-[9px] font-bold text-gray-500 uppercase italic truncate">{ihbar.konu}</div>
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 font-black italic">
        <span className="text-[8px] text-gray-400 uppercase truncate max-w-[100px]">{ihbar.profiles?.full_name || 'HAVUZ'}</span>
        <span className="text-[9px] text-orange-500">{Math.floor((now.getTime() - new Date(ihbar.created_at).getTime()) / 60000)} DK</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex text-white font-sans overflow-hidden bg-[#0a0b0e]">
      
      {/* MOBİL BURGER */}
      <div className="md:hidden fixed top-4 left-4 z-[60]">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-orange-600 p-3 rounded-2xl shadow-xl border border-orange-400">
          <Menu size={24} />
        </button>
      </div>

      {/* SOL MENÜ (RESPONSIVE) */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-72 bg-[#111318]/95 backdrop-blur-3xl border-r border-white/5 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 border-b border-white/5 flex justify-center"><img src="/logo.png" className="h-10 w-auto grayscale invert opacity-80" /></div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="p-3 rounded-xl bg-orange-600 flex items-center gap-3 font-black text-[10px] italic uppercase tracking-wider shadow-lg shadow-orange-600/20"><LayoutDashboard size={18}/> Panel</div>
          <div className="p-3 rounded-xl hover:bg-white/5 flex items-center gap-3 font-black text-[10px] italic uppercase text-gray-400 transition-colors"><Map size={18}/> Saha Haritası</div>
          <div onClick={() => {setIsBildirimAcik(true); setIsSidebarOpen(false)}} className="p-3 rounded-xl hover:bg-white/5 flex items-center justify-between font-black text-[10px] italic uppercase text-gray-400 cursor-pointer">
            <div className="flex items-center gap-3"><Bell size={18}/> Bildirimler</div>
            {bildirimSayisi > 0 && <span className="bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{bildirimSayisi}</span>}
          </div>
        </nav>
        <div className="p-4 bg-black/40 border-t border-white/5">
          <div className="mb-4 px-2">
            <p className="text-[10px] font-black text-orange-500 uppercase italic truncate">{userName}</p>
            <p className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.2em]">{userRole}</p>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white p-3 rounded-xl font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 border border-red-600/20"><LogOut size={16}/> Çıkış Yap</button>
        </div>
      </aside>

      {/* ANA İÇERİK */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* HEADER */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-black/20 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            <span className="text-[10px] font-black uppercase italic tracking-widest text-gray-400">Saha 360 // Kontrol Paneli</span>
          </div>
          <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[10px] font-black italic">
            Canlı Takip: <span className="text-green-500">{onlineUsers.length + 1} Aktif</span>
          </div>
        </header>

        {/* SÜTUNLAR (MOBİLDE SWIPE) */}
        <main className="flex-1 overflow-x-auto md:overflow-x-visible p-4 md:p-8 flex md:grid md:grid-cols-3 gap-6 snap-x snap-mandatory">
          
          {/* BEKLEYENLER */}
          <section className="min-w-[85vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/40 border border-yellow-500/5 rounded-[2.5rem] p-5 h-[650px] md:h-full">
            <h3 className="text-[10px] font-black text-yellow-500 uppercase italic tracking-widest mb-6 flex items-center gap-2"><Clock size={14}/> Havuz ({stats.bekleyen})</h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && !i.atanan_personel).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </section>

          {/* İŞLEMDE */}
          <section className="min-w-[85vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/40 border border-blue-500/5 rounded-[2.5rem] p-5 h-[650px] md:h-full">
            <h3 className="text-[10px] font-black text-blue-400 uppercase italic tracking-widest mb-6 flex items-center gap-2"><AlertTriangle size={14}/> İşlemde ({stats.islemde})</h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {ihbarlar.filter(i => {
                const d = (i.durum || '').toLowerCase();
                return !d.includes('tamamlandi') && (i.atanan_personel || d.includes('calisiliyor'));
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </section>

          {/* BİTENLER */}
          <section className="min-w-[85vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/40 border border-green-500/5 rounded-[2.5rem] p-5 h-[650px] md:h-full">
            <h3 className="text-[10px] font-black text-green-500 uppercase italic tracking-widest mb-6 flex items-center gap-2"><CheckCircle2 size={14}/> Tamamlanan ({stats.tamamlanan})</h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </section>

        </main>
      </div>

      {/* BİLDİRİM DRAWER (SAGDAN KAYAN) */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-[#111318] z-[100] transform transition-transform duration-500 p-6 border-l border-white/5 shadow-2xl ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-sm font-black italic uppercase text-orange-500">Bildirimler</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-full uppercase italic">Kapat</button>
        </div>
        <div className="space-y-4">
          {bildirimler.map((b) => (
            <div key={b.id} className="p-4 rounded-2xl bg-black/40 border border-white/5">
              <p className="text-[11px] font-bold text-gray-300 mb-2">{b.mesaj}</p>
              <p className="text-[8px] font-black text-orange-500 uppercase italic">Kayıt: #{b.ihbar_id}</p>
            </div>
          ))}
        </div>
      </div>

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"></div>}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
