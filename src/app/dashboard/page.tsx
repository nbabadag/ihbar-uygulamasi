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
      } catch (e) { console.error("v10 Kanal hatası:", e); }
    }
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === 'granted') await PushNotifications.register();
  }, []);

  // --- 📊 VERİ ÇEKME & KESİN AYLIK FİLTRE (1000 KAYIT ÇÖZÜMÜ) ---
  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
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
      setTimeout(() => setIsLoading(false), 1500); // Profesyonel yükleme hissi için
    }
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        setUserName(profile?.full_name || 'Kullanıcı');
        setUserRole(profile?.role || 'Personel');
        fetchData(profile?.role || 'Personel', user.id);
        initPushNotifications(user.id);
      } else { router.push('/'); }
    }
    checkUser();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [router, fetchData, initPushNotifications]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  // --- 🚀 YÜKLEME EKRANI (LOGO ANİMASYONU) ---
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0b0e] flex flex-col items-center justify-center">
        <div className="relative mb-8 flex items-center justify-center">
          <img src="/logo.png" className="w-28 h-auto animate-pulse grayscale invert opacity-40" />
          <div className="absolute -inset-6 border-[3px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-orange-500 font-black italic tracking-[0.8em] text-[11px] animate-pulse">Y Ü K L E N İ Y O R</h2>
          <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
             <div className="h-full bg-orange-600 animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
        <style jsx>{` @keyframes loading { 0% { width: 0%; } 50% { width: 100%; } 100% { width: 0%; } } `}</style>
      </div>
    );
  }

  // --- 📱 YARDIMCI BİLEŞENLER ---
  const JobCard = ({ ihbar }: { ihbar: any }) => (
    <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="p-4 rounded-[1.8rem] border border-white/5 bg-[#1a1c23]/40 backdrop-blur-xl mb-4 transition-all active:scale-95 cursor-pointer border-l-4 border-l-orange-600 hover:bg-[#1a1c23]/80">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-600 text-white uppercase italic tracking-tighter shadow-lg shadow-orange-600/20">#{ihbar.ifs_is_emri_no || 'YENİ'}</span>
        <span className="text-[8px] text-gray-500 font-black italic">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <div className="text-[13px] font-black uppercase text-gray-100 mb-1 truncate">{ihbar.ihbar_veren_ad_soyad}</div>
      <div className="text-[10px] font-bold text-gray-500 uppercase italic truncate opacity-70">{ihbar.konu}</div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 bg-orange-500 rounded-full"></div>
          <span className="text-[8px] font-black text-gray-400 uppercase italic truncate max-w-[90px]">{ihbar.profiles?.full_name || 'HAVUZ'}</span>
        </div>
        <span className="text-[9px] font-black text-orange-500 italic">{Math.floor((now.getTime() - new Date(ihbar.created_at).getTime()) / 60000)} DK</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex text-white font-sans overflow-hidden bg-[#0a0b0e]">
      
      {/* MOBİL BURGER BUTONU */}
      <div className="md:hidden fixed top-5 left-5 z-[60]">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-orange-600 p-3.5 rounded-2xl shadow-2xl border border-orange-400 active:scale-90 transition-all">
          <Menu size={22} />
        </button>
      </div>

      {/* SOL MENÜ (RESPONSIVE) */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-72 bg-[#111318]/98 backdrop-blur-3xl border-r border-white/5 flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-10 flex justify-center border-b border-white/5"><img src="/logo.png" className="h-12 w-auto grayscale invert opacity-70" /></div>
        <nav className="flex-1 p-5 space-y-3 overflow-y-auto custom-scrollbar">
          <div className="p-4 rounded-2xl bg-orange-600 flex items-center gap-4 font-black text-[11px] italic uppercase tracking-wider shadow-xl shadow-orange-600/30 transition-transform active:scale-95 cursor-pointer"><LayoutDashboard size={20}/> PANEL</div>
          <div className="p-4 rounded-2xl hover:bg-white/5 flex items-center gap-4 font-black text-[11px] italic uppercase text-gray-500 transition-colors cursor-pointer"><Map size={20}/> SAHA HARİTASI</div>
          <div onClick={() => {setIsBildirimAcik(true); setIsSidebarOpen(false)}} className="p-4 rounded-2xl hover:bg-white/5 flex items-center justify-between font-black text-[11px] italic uppercase text-gray-500 cursor-pointer">
            <div className="flex items-center gap-4"><Bell size={20}/> BİLDİRİMLER</div>
            {bildirimSayisi > 0 && <span className="bg-red-600 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">{bildirimSayisi}</span>}
          </div>
        </nav>
        <div className="p-6 bg-black/40 border-t border-white/5">
          <div className="mb-6 px-2">
            <p className="text-[12px] font-black text-orange-500 uppercase italic truncate">{userName}</p>
            <p className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em] mt-1">{userRole}</p>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white p-4 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-3 border border-red-600/20 active:scale-95"><LogOut size={18}/> GÜVENLİ ÇIKIŞ</button>
        </div>
      </aside>

      {/* ANA İÇERİK ALANI */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* ÜST BİLGİ BARI (MASAÜSTÜ) */}
        <header className="hidden md:flex h-20 items-center justify-between px-10 bg-black/30 border-b border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]"></div>
            <span className="text-[11px] font-black uppercase italic tracking-[0.3em] text-gray-500">SAHA 360 // DENETİM MERKEZİ</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-white/5 px-5 py-2.5 rounded-2xl border border-white/5 text-[11px] font-black italic text-orange-500">
               OP: <span className="text-white ml-2">AKTİF</span>
             </div>
          </div>
        </header>

        {/* İHBAR SÜTUNLARI (MOBİLDE KAYDIRILABİLİR) */}
        <main className="flex-1 overflow-x-auto md:overflow-x-visible p-5 md:p-10 flex md:grid md:grid-cols-3 gap-8 snap-x snap-mandatory custom-scrollbar">
          
          {/* HAVUZ SÜTUNU */}
          <section className="min-w-[88vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/50 border border-yellow-500/10 rounded-[3rem] p-7 h-[70vh] md:h-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/20"></div>
            <h3 className="text-[11px] font-black text-yellow-500 uppercase italic tracking-[0.2em] mb-8 flex items-center gap-3"><Clock size={16}/> HAVUZDA BEKLEYENLER ({stats.bekleyen})</h3>
            <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && !i.atanan_personel).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </section>

          {/* İŞLEMDE SÜTUNU */}
          <section className="min-w-[88vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/50 border border-blue-500/10 rounded-[3rem] p-7 h-[70vh] md:h-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20"></div>
            <h3 className="text-[11px] font-black text-blue-400 uppercase italic tracking-[0.2em] mb-8 flex items-center gap-3"><AlertTriangle size={16}/> İŞLEMDE OLANLAR ({stats.islemde})</h3>
            <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
              {ihbarlar.filter(i => {
                const d = (i.durum || '').toLowerCase();
                return !d.includes('tamamlandi') && (i.atanan_personel || d.includes('calisiliyor'));
              }).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </section>

          {/* TAMAMLANANLAR SÜTUNU */}
          <section className="min-w-[88vw] md:min-w-0 snap-center flex flex-col bg-[#111318]/50 border border-green-500/10 rounded-[3rem] p-7 h-[70vh] md:h-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-green-500/20"></div>
            <h3 className="text-[11px] font-black text-green-500 uppercase italic tracking-[0.2em] mb-8 flex items-center gap-3"><CheckCircle2 size={16}/> BU AY BİTENLER ({stats.tamamlanan})</h3>
            <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
              {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).map(i => <JobCard key={i.id} ihbar={i} />)}
            </div>
          </section>

        </main>
      </div>

      {/* BİLDİRİM PANELİ (SAĞDAN KAYAN) */}
      <div className={`fixed inset-y-0 right-0 w-85 md:w-96 bg-[#111318]/98 backdrop-blur-3xl z-[100] transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) p-8 border-l border-white/5 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-12">
          <h3 className="text-sm font-black italic uppercase text-orange-500 tracking-widest">BİLDİRİMLER</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="text-[10px] font-black bg-white/5 px-4 py-2 rounded-2xl uppercase italic border border-white/5 hover:bg-orange-600 transition-colors">KAPAT ×</button>
        </div>
        <div className="space-y-5 overflow-y-auto max-h-[80vh] pr-2 custom-scrollbar">
          {bildirimler.map((b) => (
            <div key={b.id} onClick={() => {supabase.from('bildirimler').update({ is_read: true }).eq('id', b.id); router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false)}} className="p-5 rounded-[2rem] bg-black/40 border border-white/5 hover:border-orange-500/30 transition-all cursor-pointer">
              <p className="text-[12px] font-bold text-gray-200 leading-tight mb-3">{b.mesaj}</p>
              <div className="flex justify-between items-center">
                 <span className="text-[9px] font-black text-orange-500 uppercase tracking-tighter">ID: #{b.ihbar_id}</span>
                 <span className="text-[8px] text-gray-600 font-bold italic">{new Date(b.created_at).toLocaleTimeString('tr-TR')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MOBİL ARKA PLAN KARARTMA */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="md:hidden fixed inset-0 bg-black/85 backdrop-blur-md z-40 transition-opacity"></div>}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f97316; }
      `}</style>
    </div>
  )
}
