'use client'
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