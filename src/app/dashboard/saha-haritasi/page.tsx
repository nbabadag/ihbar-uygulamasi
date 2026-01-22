'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SahaHaritasi() {
  const [isler, setIsler] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'aktif' | 'tamamlandi'>('aktif')

  useEffect(() => {
    const veriCek = async () => {
      const query = filtre === 'aktif' 
        ? supabase.from('saha_harita_verisi').select('*').in('durum', ['Calisiliyor', 'Islemde'])
        : supabase.from('saha_harita_verisi').select('*').eq('durum', 'Tamamlandi');
      
      const { data } = await query;
      setIsler(data || []);
    }
    veriCek();
  }, [filtre])

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white">
      {/* ÜST KONTROL PANELİ */}
      <div className="p-4 bg-slate-900 flex justify-between items-center border-b border-white/10">
        <h2 className="font-black italic uppercase text-xs tracking-widest">Sefine Saha 360 // Canlı Takip</h2>
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl">
          <button onClick={() => setFiltre('aktif')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${filtre === 'aktif' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>AKTİF</button>
          <button onClick={() => setFiltre('tamamlandi')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${filtre === 'tamamlandi' ? 'bg-green-600 text-white' : 'text-gray-500'}`}>BİTEN</button>
        </div>
      </div>

      {/* GOOGLE MAPS IFRAME */}
      <div className="flex-1 relative">
         {/* Buraya dinamik Google Maps API veya Embed Gelecek */}
         <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0 }}
            src={`http://googleusercontent.com/maps.google.com/2{filtre === 'aktif' ? 'Tersane_Merkez' : 'Biten_İş_Noktaları'}`}
            allowFullScreen
         ></iframe>
      </div>
    </div>
  )
}
