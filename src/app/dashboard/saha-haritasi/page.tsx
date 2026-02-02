'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SahaHaritasi() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'aktif' | 'tamamlandi'>('aktif')
  const [loading, setLoading] = useState(true)

  const varsayilanKonum = "40.6922,29.5074";

  // --- 🛰️ VERİ GETİRME (GÜNCELLENMİŞ SÜTUNLAR) ---
  const veriGetir = async (signal?: AbortSignal) => {
    const durumlar = filtre === 'aktif' ? ['Islemde', 'Calisiliyor', 'Durduruldu'] : ['Tamamlandi']
    
    // SQL'e eklediğimiz enlem, boylam, bitis_enlem, bitis_boylam sütunlarını dahil ettik
    const { data, error } = await supabase
      .from('ihbarlar')
      .select(`
        id, musteri_adi, konu, durum, 
        enlem, boylam, 
        bitis_enlem, bitis_boylam, 
        konum_gecmisi, atanan_personel, 
        profiles:atanan_personel (full_name)
      `)
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

    const interval = setInterval(() => {
      veriGetir(controller.signal);
    }, 60000); 

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [filtre])

  // --- 🗺️ HARİTA GÜNCELLEME (FORMAT DÜZELTİLDİ) ---
  const haritayiGuncelle = (is: any) => {
    const frame = document.getElementById('saha-iframe') as HTMLIFrameElement;
    if (!frame) return;

    if (filtre === 'aktif') {
      // Aktif işlerde enlem ve boylamı birleştirip gönderiyoruz
      if (is.enlem && is.boylam) {
        const konumUrl = `${is.enlem},${is.boylam}`;
        frame.src = `https://maps.google.com/maps?q=${konumUrl}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
      } else {
        alert("BU İŞ İÇİN HENÜZ CANLI KONUM VERİSİ ALINMAMIŞ.");
      }
    } else {
      // Biten işlerde bitis koordinatlarını göster
      const bitisEnlem = is.bitis_enlem || is.enlem;
      const bitisBoylam = is.bitis_boylam || is.boylam;

      if (bitisEnlem && bitisBoylam) {
        const konumUrl = `${bitisEnlem},${bitisBoylam}`;
        frame.src = `https://maps.google.com/maps?q=${konumUrl}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
      }
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-sans uppercase italic font-black">
      {/* ÜST PANEL */}
      <div className="p-4 bg-slate-900/50 backdrop-blur-md border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-4 py-2 rounded-xl text-[10px]">← GERİ</button>
          <div>
            <h1 className="text-sm tracking-tighter">SAHA 360 // OPERASYON MERKEZİ</h1>
            <p className="text-[8px] text-blue-400">CANLI / KAYITLI İzleme Sistemi</p>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setFiltre('aktif')} className={`px-6 py-2 rounded-xl text-[10px] transition-all ${filtre === 'aktif' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>🛰️ İŞLEMDE / DURDURULAN</button>
          <button onClick={() => setFiltre('tamamlandi')} className={`px-6 py-2 rounded-xl text-[10px] transition-all ${filtre === 'tamamlandi' ? 'bg-green-600 text-white' : 'text-gray-500'}`}>🏁 TAMAMLANAN</button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* SOL LİSTE */}
        <div className="w-full md:w-80 bg-slate-900/80 border-r border-white/5 overflow-y-auto p-4 custom-scrollbar z-10">
          <p className="text-[9px] text-gray-500 mb-4 underline decoration-blue-500">Görev Listesi</p>
          {loading ? (
             <div className="animate-pulse space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-3xl"></div>)}
             </div>
          ) : (
            <div className="space-y-3">
              {isler.map((is) => (
                <div key={is.id} className="bg-slate-800/50 border border-white/10 p-4 rounded-[2rem] hover:border-blue-500 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[8px] px-2 py-0.5 rounded ${is.durum === 'Calisiliyor' ? 'bg-blue-600 animate-pulse' : 'bg-slate-700'}`}>{is.durum}</span>
                    <span className="text-[8px] text-gray-500">#{is.id}</span>
                  </div>
                  <h3 className="text-xs truncate mb-1">{is.musteri_adi}</h3>
                  <p className="text-[10px] text-gray-400 mb-3 truncate">{is.konu}</p>
                  <p className="text-[9px] text-blue-400 mb-4">👤 {is.profiles?.full_name || 'Bilinmiyor'}</p>
                  
                  {(is.enlem && is.boylam) ? (
                    <button 
                      onClick={() => haritayiGuncelle(is)} 
                      className={`w-full py-3 rounded-2xl text-[10px] text-white shadow-lg transition-all ${filtre === 'aktif' ? 'bg-blue-600' : 'bg-green-600'}`}
                    >
                      {filtre === 'aktif' ? '📍 KONUMU GÖR' : '🗺️ KONUMU GÖR'}
                    </button>
                  ) : (
                    <div className="text-[8px] text-red-500/70 italic text-center py-2 border border-red-500/10 rounded-xl">Konum Verisi Yok</div>
                  )}
                </div>
              ))}
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
    </div>
  )
}