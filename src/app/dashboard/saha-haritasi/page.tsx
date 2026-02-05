'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SahaHaritasi() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'aktif' | 'tamamlandi'>('aktif')
  const [loading, setLoading] = useState(true)

  const varsayilanKonum = "40.730046,29.505262";

  // --- 🛰️ VERİ GETİRME (YENİ ŞEMA VE 3 NOKTALI GPS) ---
  const veriGetir = useCallback(async (signal?: AbortSignal) => {
    // Aktif işler: Beklemede olmayan ama bitmemiş olanlar
    const durumlar = filtre === 'aktif' 
      ? ['Islemde', 'Calisiliyor', 'Durduruldu'] 
      : ['Tamamlandi']
    
    const { data, error } = await supabase
      .from('ihbarlar')
      .select(`
        id, ihbar_veren_ad_soyad, konu, durum, 
        enlem, boylam, 
        varis_enlem, varis_boylam,
        bitis_enlem, bitis_boylam, 
        atanan_personel, 
        profiles:atanan_personel (full_name)
      `)
      .in('durum', durumlar)
      .order('id', { ascending: false })

    if (!error && (!signal || !signal.aborted)) {
      setIsler(data || [])
    }
  }, [filtre])

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    veriGetir(controller.signal).then(() => setLoading(false));

    const interval = setInterval(() => {
      veriGetir(controller.signal);
    }, 30000); // 30 saniyede bir güncelle (Canlılık için)

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [veriGetir])

  // --- 🗺️ 3 AŞAMALI KONUM GÖRÜNTÜLEME ---
  const haritayiMuhurle = (is: any, asama: 'baslangic' | 'varis' | 'bitis') => {
    const frame = document.getElementById('saha-iframe') as HTMLIFrameElement;
    if (!frame) return;

    let lat, lng;

    switch(asama) {
      case 'baslangic':
        lat = is.enlem; lng = is.boylam;
        break;
      case 'varis':
        lat = is.varis_enlem; lng = is.varis_boylam;
        break;
      case 'bitis':
        lat = is.bitis_enlem; lng = is.bitis_boylam;
        break;
    }

    if (lat && lng) {
      const konumUrl = `${lat},${lng}`;
      // Google Maps Embed URL düzeltildi
      frame.src = `https://maps.google.com/maps?q=${konumUrl}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
    } else {
      alert(`BU İŞİN ${asama.toUpperCase()} MÜHÜRÜ HENÜZ ALINMAMIŞ.`);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-sans uppercase italic font-black">
      {/* ÜST PANEL */}
      <div className="p-4 bg-slate-900/50 backdrop-blur-md border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 relative z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-4 py-2 rounded-xl text-[10px] active:scale-95 shadow-lg shadow-orange-900/20">← GERİ</button>
          <div>
            <h1 className="text-sm tracking-tighter">SAHA 360 // DENETİM MASASI</h1>
            <p className="text-[8px] text-blue-400">GPS MÜHÜR TAKİP SİSTEMİ</p>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setFiltre('aktif')} className={`px-6 py-2 rounded-xl text-[10px] transition-all ${filtre === 'aktif' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>🛰️ AKTİF OPERASYONLAR</button>
          <button onClick={() => setFiltre('tamamlandi')} className={`px-6 py-2 rounded-xl text-[10px] transition-all ${filtre === 'tamamlandi' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}>🏁 TAMAMLANAN GÖREVLER</button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* SOL LİSTE */}
        <div className="w-full md:w-96 bg-slate-900/90 border-r border-white/5 overflow-y-auto p-4 custom-scrollbar z-10 shadow-2xl">
          <p className="text-[9px] text-gray-500 mb-4 tracking-widest">GÖREV VE MÜHÜR LİSTESİ</p>
          {loading ? (
             <div className="animate-pulse space-y-4">
               {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/5 rounded-3xl"></div>)}
             </div>
          ) : (
            <div className="space-y-4">
              {isler.map((is) => (
                <div key={is.id} className="bg-slate-800/40 border border-white/5 p-5 rounded-[2rem] hover:border-orange-500/50 transition-all shadow-xl">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[8px] px-3 py-1 rounded-full font-black ${is.durum === 'Calisiliyor' ? 'bg-blue-600 animate-pulse' : is.durum === 'Durduruldu' ? 'bg-red-600' : 'bg-green-600'}`}>
                      {is.durum}
                    </span>
                    <span className="text-[9px] text-gray-500">ID: #{is.id}</span>
                  </div>
                  <h3 className="text-[13px] truncate mb-1 text-orange-500">{is.ihbar_veren_ad_soyad}</h3>
                  <p className="text-[10px] text-gray-400 mb-3 line-clamp-1 italic">"{is.konu}"</p>
                  <p className="text-[9px] text-blue-400 mb-4 border-b border-white/5 pb-2">👤 {is.profiles?.full_name || 'ATANMADI'}</p>
                  
                  {/* 📍 3 NOKTALI GPS SEÇİCİ */}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => haritayiMuhurle(is, 'baslangic')} className="bg-slate-700/50 hover:bg-blue-600 p-2 rounded-xl text-[7px] transition-all">1. BAŞLA</button>
                    <button onClick={() => haritayiMuhurle(is, 'varis')} className="bg-slate-700/50 hover:bg-yellow-600 p-2 rounded-xl text-[7px] transition-all">2. VARDI</button>
                    <button onClick={() => haritayiMuhurle(is, 'bitis')} className="bg-slate-700/50 hover:bg-green-600 p-2 rounded-xl text-[7px] transition-all">3. BİTTİ</button>
                  </div>
                </div>
              ))}
              {isler.length === 0 && <div className="text-center p-10 text-[10px] text-gray-600 italic">BU FİLTREDE KAYIT BULUNAMADI.</div>}
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
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  )
}