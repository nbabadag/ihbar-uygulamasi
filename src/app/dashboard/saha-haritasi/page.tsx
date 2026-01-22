'use client'
<<<<<<< HEAD
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SahaHaritasi() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'aktif' | 'tamamlandi'>('aktif')
  const [loading, setLoading] = useState(true)

  const varsayilanKonum = "40.6922,29.5074";

  // Veri çekme fonksiyonu (Interval için dışarı aldık)
  const veriGetir = async (signal?: AbortSignal) => {
    const durumlar = filtre === 'aktif' ? ['Islemde', 'Calisiliyor', 'Durduruldu'] : ['Tamamlandi']
    const { data, error } = await supabase
      .from('ihbarlar')
      .select(`id, musteri_adi, konu, durum, baslangic_konum, guncel_konum, bitis_konum, konum_gecmisi, atanan_personel, profiles:atanan_personel (full_name)`)
      .in('durum', durumlar)
      .order('id', { ascending: false })

    if (!error && (!signal || !signal.aborted)) {
      setIsler(data || [])
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    
    veriGetir(controller.signal).then(() => setLoading(false));

    // 🕒 CANLI TAKİP: Ofis ekranını her 60 saniyede bir tazele
    const interval = setInterval(() => {
      veriGetir(controller.signal);
    }, 60000); 

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [filtre])

  const haritayiGuncelle = (is: any) => {
    const frame = document.getElementById('saha-iframe') as HTMLIFrameElement;
    if (!frame) return;

    if (filtre === 'aktif') {
      // AKTİF İŞ: Sadece personelin o anki yerini (guncel_konum) göster
      const konum = is.guncel_konum || is.baslangic_konum;
      if (konum) {
        const cleanKonum = konum.replace(/\s/g, '');
        frame.src = `https://maps.google.com/maps?q=${cleanKonum}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
      }
    } else {
      // ✅ BİTEN İŞ: Tüm rotayı (konum_gecmisi) bir yol çizgisi gibi göster
      const duraklar = is.konum_gecmisi || [];
      
      if (duraklar.length > 1) {
        const origin = duraklar[0].konum;
        const destination = duraklar[duraklar.length - 1].konum;
        // Ara noktaları (waypoints) birleştiriyoruz
        const waypoints = duraklar.slice(1, -1).map((d: any) => d.konum).join('|');
        
        // Google Maps Direction (Yol Tarifi) moduyla rotayı çizdiriyoruz
        frame.src = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3021.365313936647!2d29.479500!3d40.712500!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14cad5ed6f34e56d%3A0x6d9f8e5e5e5e5e5e!2sSefine%20Shipyard!5e0!3m2!1str!2str!4v1700000000000!5m2!1str!2str2{origin}&destination=${destination}&waypoints=${waypoints}&travelmode=walking&output=embed`;
      } else {
        // Rota yoksa sadece bitiş konumunu göster
        const bitis = is.bitis_konum || is.guncel_konum;
        if (bitis) {
          frame.src = `https://maps.google.com/maps?q=${bitis}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
        }
      }
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-sans">
      
      {/* ÜST PANEL */}
      <div className="p-4 bg-slate-900/50 backdrop-blur-md border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl font-black text-white">← GERİ</button>
          <div>
            <h1 className="text-sm font-black italic uppercase tracking-tighter text-white">SAHA 360 // OPERASYON</h1>
            <p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest italic">Canlı Rota İzleme Sistemi</p>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setFiltre('aktif')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filtre === 'aktif' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>🛰️ AKTİF TAKİP</button>
          <button onClick={() => setFiltre('tamamlandi')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filtre === 'tamamlandi' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}>🏁 ROTA ANALİZİ</button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* SOL LİSTE */}
        <div className="w-full md:w-80 bg-slate-900/80 border-r border-white/5 overflow-y-auto p-4 custom-scrollbar z-10">
          <p className="text-[9px] font-black text-gray-500 uppercase mb-4 tracking-widest italic text-white underline decoration-blue-500">Görev Listesi</p>
          {loading ? (
             <div className="animate-pulse space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-3xl"></div>)}
             </div>
          ) : (
            <div className="space-y-3">
              {isler.length === 0 ? (
                <p className="text-[10px] text-gray-500 italic text-center py-10">Kayıt bulunamadı.</p>
              ) : (
                isler.map((is) => (
                  <div key={is.id} className="bg-slate-800/50 border border-white/10 p-4 rounded-[2rem] hover:border-blue-500 transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${is.durum === 'Calisiliyor' ? 'bg-blue-600 animate-pulse text-white' : 'bg-slate-700 text-white'}`}>{is.durum}</span>
                      <span className="text-[8px] font-bold text-gray-500">#{is.id}</span>
                    </div>
                    <h3 className="font-black text-xs uppercase italic truncate mb-1 text-white">{is.musteri_adi}</h3>
                    <p className="text-[10px] font-bold text-gray-400 mb-3 truncate uppercase">{is.konu}</p>
                    <p className="text-[9px] font-black text-blue-400 mb-4 italic">👤 {is.profiles?.full_name || 'Bilinmiyor'}</p>
                    
                    {(is.guncel_konum || is.baslangic_konum || is.konum_gecmisi?.length > 0) ? (
                      <button 
                        onClick={() => haritayiGuncelle(is)} 
                        className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg transition-all ${filtre === 'aktif' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}
                      >
                        {filtre === 'aktif' ? '📍 KONUMU GÖSTER' : '🗺️ ROTAYI ÇİZ'}
                      </button>
                    ) : (
                      <div className="text-[8px] text-red-500/70 italic text-center py-2 border border-red-500/10 rounded-xl uppercase">Konum Verisi Yok</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* SAĞ HARİTA */}
        <div className="flex-1 bg-slate-950 relative">
          <iframe
            id="saha-iframe"
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) contrast(1.2)' }}
            src={`https://maps.google.com/maps?q=${varsayilanKonum}&t=k&z=17&ie=UTF8&iwloc=&output=embed`}
            allowFullScreen
          ></iframe>
          
          <div className="absolute top-6 left-6 bg-slate-900/90 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white/10 shadow-2xl hidden md:block">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-lg">📡</div>
                <div>
                   <p className="text-[10px] font-black uppercase text-blue-400">Canlı Sistem</p>
                   <p className="text-xl font-black italic tracking-tighter uppercase text-white">{isler.length} BİRİM İZLENİYOR</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  )
}
=======

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
          >
            <span className="text-xl">🛰️</span>
            <span className="font-black uppercase italic">Saha Haritası</span>
          </button>

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
          </div>
        </div>
      </div>
    </div>
  )
}
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
