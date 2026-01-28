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
  const [now, setNow] = useState(new Date())
  
  const [bildirimSayisi, setBildirimSayisi] = useState(0)
  const [bildirimler, setBildirimler] = useState<any[]>([])
  const [isBildirimAcik, setIsBildirimAcik] = useState(false)
  const [notifSettings, setNotifSettings] = useState<any[]>([])

  // Yetki Kontrolleri
  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const isAdmin = normalizedRole.includes('ADMIN');
  const isMudur = normalizedRole.includes('MÜDÜR') || normalizedRole.includes('MUDUR');
  const isMuhendis = normalizedRole.includes('MÜH') || normalizedRole.includes('MUH');
  const isCagri = normalizedRole.includes('ÇAĞRI') || normalizedRole.includes('CAGRI');
  const isFormen = normalizedRole.includes('FORMEN');

  const canManageUsers = isAdmin || isMudur || isMuhendis;
  const canCreateJob = canManageUsers || isFormen || isCagri;
  const canSeeReports = canManageUsers || isFormen;
  const canSeeTV = canCreateJob;
  const canManageGroups = canManageUsers || isFormen;
  const canManageMaterials = canManageUsers || isFormen;

  // BİLDİRİM AYARLARINI GETİR
  const fetchNotifSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('notification_settings').select('*').order('event_type');
      if (error) throw error;
      setNotifSettings(data || []);
    } catch (err) {
      console.error("Bildirim ayarları çekilemedi:", err);
    }
  }, []);

  // BİLDİRİM AYARINI GÜNCELLE
  const updateNotifSetting = async (id: string, roles: string[]) => {
    try {
      setNotifSettings(prev => prev.map(s => s.id === id ? { ...s, target_roles: roles } : s));
      const { error } = await supabase
        .from('notification_settings')
        .update({ target_roles: roles, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error("Güncelleme hatası:", err);
      fetchNotifSettings();
    }
  };

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
    
    const { data: komboData } = await supabase.from('ai_kombinasyonlar').select('*');
    if (komboData) setAiKombinasyonlar(komboData);

    const { data: ihbarData } = await supabase.from('ihbarlar')
      .select(`*, profiles:atanan_personel(full_name)`)
      .order('created_at', { ascending: false });
    
    if (ihbarData) {
      const simdi = new Date();
      const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const toplamDakika = turkiyeZamani.getHours() * 60 + turkiyeZamani.getMinutes();
      const isMesaiSaatleri = toplamDakika >= 481 && toplamDakika <= 1004;

      let filtered = (role.trim().toUpperCase() === 'SAHA PERSONELI') 
        ? ihbarData.filter(i => (i.atanan_personel === id) || (!isMesaiSaatleri && i.oncelik_durumu === 'VARDİYA_MODU' && i.durum === 'Beklemede'))
        : ihbarData;

      setIhbarlar(filtered)
      setStats({
        bekleyen: filtered.filter(i => (i.durum || '').toLowerCase().includes('beklemede')).length,
        tamamlanan: filtered.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).length,
        islemde: filtered.filter(i => !(i.durum || '').toLowerCase().includes('beklemede') && !(i.durum || '').toLowerCase().includes('tamamlandi')).length
      })
    }

    // BİLDİRİM FİLTRESİ: Kullanıcının rolü bildirimdeki 'heget_roller' dizisinde var mı?
    const { data: bData, count } = await supabase
      .from('bildirimler')
      .select('*', { count: 'exact' })
      .eq('is_read', false)
      .contains('heget_roller', [role.trim()]) // Kritiktir: Admin panelindeki seçime göre filtreler
      .order('created_at', { ascending: false })
      .limit(20)

    setBildirimler(bData || [])
    setBildirimSayisi(count || 0)
  }, []);

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
        if (currentRole.toUpperCase().includes('ADMIN')) fetchNotifSettings();

        // REALTIME: Postgres değişikliklerini dinle
        channel = supabase.channel('db-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => { fetchData(currentRole, user.id); })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirimler' }, () => { fetchData(currentRole, user.id); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_kombinasyonlar' }, () => { fetchData(currentRole, user.id); }) 
          .subscribe()
      } else {
        window.location.href = '/';
      }
    }

    checkUser()

    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000)

    return () => { 
      clearInterval(timer); 
      if (channel) supabase.removeChannel(channel); 
    }
  }, [fetchData, fetchNotifSettings]); // Bağımlılıklar sabitlendi

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    window.location.href = '/'; 
  }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    const isVardiya = ihbar.oncelik_durumu === 'VARDİYA_MODU' && ihbar.durum === 'Beklemede';
    const oneri = aiOneriGetir(`${ihbar.konu} ${ihbar.aciklama || ''}`);
    return (
      <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className={`p-4 rounded-2xl shadow-xl border mb-3 backdrop-blur-md transition-all active:scale-95 relative z-10 ${isVardiya ? 'bg-orange-600/20 border-orange-500 animate-pulse' : 'bg-[#1a1c23]/80 border-gray-700/50 hover:border-orange-500/50'}`}>
        <div className="flex justify-between items-start mb-1 font-black">
          <span className={`text-[10px] italic font-black tracking-widest uppercase ${isVardiya ? 'text-white' : 'text-orange-400'}`}>{isVardiya ? '🚨 VARDİYA İHBARI' : `#${ihbar.ifs_is_emri_no || 'IFS YOK'}`}</span>
          <span className="text-[9px] text-gray-500 font-bold font-black">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        {oneri && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 w-fit">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
            <span className="text-[7px] font-black italic uppercase text-blue-400 tracking-tighter">🤖 AI ÖNERİSİ: {oneri}</span>
          </div>
        )}
        <div className="font-black text-[12px] uppercase leading-tight tracking-tighter text-gray-100 mb-1">{ihbar.musteri_adi}</div>
        <div className="text-[10px] font-bold uppercase mb-3 truncate italic text-gray-400 font-black">{ihbar.konu}</div>
        <div className="flex justify-between items-center text-[9px] font-black opacity-60 text-gray-300 font-black">
           <span className={`uppercase ${ihbar.profiles?.full_name ? 'text-orange-500' : 'text-blue-400 animate-pulse'}`}>👤 {isVardiya ? 'VARDİYA HAVUZU' : (ihbar.profiles?.full_name || 'HAVUZ (ATANMADI)')}</span>
           <span className="flex items-center gap-1 font-black">⏱️ {Math.floor(diff)} DK</span>
        </div>
      </div>
    )
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
          <NavButton label="Saha Haritası" icon="🛰️" path="/dashboard/saha-haritasi" />
          <NavButton label="Ana Sayfa" icon="🏠" path="/dashboard" active />
          <NavButton label="Bildirimler" icon="🔔" onClick={() => setIsBildirimAcik(true)} />
          
          <div className="h-px bg-gray-800 my-4 opacity-50"></div>
          
          {canCreateJob && <NavButton label="İhbar Kayıt" icon="📢" path="/dashboard/yeni-ihbar" />}
          {canManageUsers && <NavButton label="Personel Yönetimi" icon="👤" path="/dashboard/personel-yonetimi" />}
          {canManageMaterials && <NavButton label="Malzeme Yönetimi" icon="📦" path="/dashboard/malzeme-yonetimi" />}
          {canManageGroups && <NavButton label="Çalışma Grupları" icon="👥" path="/dashboard/calisma-gruplari" />}
          {canSeeTV && <NavButton label="İzleme Ekranı" icon="📺" path="/dashboard/izleme-ekrani" />}
          {canSeeReports && <NavButton label="Raporlama" icon="📊" path="/dashboard/raporlar" />}
          
          {canManageUsers && (
            <>
              <NavButton label="Teknik Nesne" icon="⚙️" path="/dashboard/teknik-nesne-yonetimi" />
              <NavButton label="AI Öğrenme" icon="🤖" path="/dashboard/ai-yonetim" />
            </>
          )}
        </nav>

        <div className="p-4 bg-black/40 border-t border-gray-800/50">
          <div className="flex flex-col mb-3 px-2">
            <span className="text-[11px] font-black uppercase italic text-orange-500 truncate">{userName}</span>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{userRole}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 p-3 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95 text-white">Oturumu Kapat</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ml-0 md:ml-72 p-4 md:p-8 relative z-10 custom-scrollbar">
        
        {/* BİLDİRİM YÖNETİM PANELİ (ADMİN) */}
        {isAdmin && notifSettings.length > 0 && (
          <div className="bg-[#111318]/90 backdrop-blur-xl p-6 rounded-[2rem] border border-orange-500/20 mb-8 shadow-2xl relative group">
            <h3 className="text-orange-500 text-[10px] font-black italic uppercase mb-4 tracking-[0.3em] flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span> 🛠️ BİLDİRİM YÖNETİM MERKEZİ (ADMİN)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {notifSettings.map(setting => (
                 <div key={setting.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-black/40 rounded-2xl border border-gray-800/50 gap-3">
                    <span className="text-[9px] font-black text-gray-400 uppercase italic tracking-tighter">
                      {setting.event_type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {['ADMIN', 'MÜDÜR', 'MÜHENDİS', 'FORMEN', 'ÇAĞRI'].map(role => {
                        const isSelected = (setting.target_roles || []).includes(role);
                        return (
                          <button 
                            key={role}
                            onClick={(e) => {
                              e.preventDefault();
                              const currentRoles = setting.target_roles || [];
                              const newRoles = isSelected
                                ? currentRoles.filter((r: string) => r !== role)
                                : [...currentRoles, role];
                              updateNotifSetting(setting.id, newRoles);
                            }}
                            className={`text-[7.5px] px-2 py-1 rounded-lg font-black transition-all ${isSelected ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl mb-8">
          <div className="flex items-center gap-4">
             <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
             <div className="font-black uppercase italic text-xs tracking-tighter">Sefine Shipyard // Denetim Merkezi</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-yellow-500/10 h-[750px] shadow-inner">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-yellow-500 flex items-center gap-2 tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Havuz ({stats.bekleyen})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">{ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede')).map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>

          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-blue-500/10 h-[750px] shadow-inner">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-blue-400 flex items-center gap-2 tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> İşlemde ({stats.islemde})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">{ihbarlar.filter(i => !(i.durum || '').toLowerCase().includes('beklemede') && !(i.durum || '').toLowerCase().includes('tamamlandi')).map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>

          <div className="flex flex-col bg-[#111318]/40 backdrop-blur-md p-5 rounded-[2.5rem] border border-green-500/10 h-[750px] shadow-inner">
            <h3 className="text-[10px] font-black uppercase italic mb-6 text-green-400 flex items-center gap-2 tracking-[0.2em]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Biten ({stats.tamamlanan})
            </h3>
            <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">{ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
        </div>
      </div>

      <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-[#111318] shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[100] transform transition-transform duration-500 ease-out p-6 flex flex-col border-l border-orange-500/20 ${isBildirimAcik ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black italic uppercase text-orange-500 tracking-tighter">Bildirimler</h3>
          <button onClick={() => setIsBildirimAcik(false)} className="bg-gray-800 hover:bg-orange-600 p-2 rounded-full text-[10px] font-black uppercase italic transition-colors">Kapat ×</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
          {bildirimler.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 italic uppercase text-xs tracking-widest text-center">Yeni Bildirim Bulunmuyor</div>
          ) : (
            bildirimler.map((b) => (
              <div key={b.id} onClick={() => { router.push(`/dashboard/ihbar-detay/${b.ihbar_id}`); setIsBildirimAcik(false); }} className={`p-4 rounded-2xl border transition-all cursor-pointer bg-[#1a1c23] hover:border-orange-500/50 ${b.mesaj?.includes('DURDURULDU') ? 'border-red-900/50' : 'border-green-900/50'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white ${b.mesaj?.includes('DURDURULDU') ? 'bg-red-600' : 'bg-green-600'}`}>{b.mesaj?.includes('DURDURULDU') ? 'DURDU' : 'BİTTİ'}</span>
                  <span className="text-[8px] font-bold text-gray-600 italic">{new Date(b.created_at).toLocaleTimeString('tr-TR')}</span>
                </div>
                <p className="text-[11px] font-black italic uppercase leading-tight mb-2 text-gray-200">{b.mesaj}</p>
                <div className="flex justify-between items-center text-[9px] font-black text-orange-500">
                  <span>KAYIT: #{b.ihbar_id}</span>
                  <span className="text-gray-500 italic">👤 {b.islem_yapan_ad}</span>
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