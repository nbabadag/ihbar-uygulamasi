'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SahaHaritasi() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [filtre, setFiltre] = useState<'aktif' | 'tamamlandi'>('aktif')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true)
      // Aktif işler için: Islemde ve Calisiliyor durumları
      // Biten işler için: Tamamlandi durumu
      const durumlar = filtre === 'aktif' ? ['Islemde', 'Calisiliyor', 'Durduruldu'] : ['Tamamlandi']
      
      const { data, error } = await supabase
        .from('ihbarlar')
        .select(`
          id, 
          musteri_adi, 
          konu, 
          durum, 
          baslangic_konum, 
          bitis_konum, 
          guncel_konum,
          atanan_personel,
          profiles:atanan_personel (full_name)
        `)
        .in('durum', durumlar)
        .order('id', { ascending: false })

      if (!error) setIsler(data || [])
      setLoading(false)
    }
    veriCek()
  }, [filtre])

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-sans">
      
      {/* ÜST PANEL / NAVIGATION */}
      <div className="p-4 bg-slate-900/50 backdrop-blur-md border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all"
          >
            ←
          </button>
          <div>
            <h1 className="text-sm font-black italic uppercase tracking-tighter">SAHA 360 // CANLI HARİTA</h1>
            <p className="text-[8px] text-blue-400 font-bold uppercase tracking-widest">Tersane Operasyon İzleme</p>
          </div>
        </div>

        {/* FİLTRE BUTONLARI */}
        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setFiltre('aktif')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filtre === 'aktif' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            🛰️ AKTİF İŞLER
          </button>
          <button 
            onClick={() => setFiltre('tamamlandi')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filtre === 'tamamlandi' ? 'bg-green-600 text-white shadow-lg shadow-green-900/50' : 'text-gray-500 hover:text-gray-300'}`}
          >
            ✅ BİTEN İŞLER
          </button>
        </div>
      </div>

      {/* HARİTA ALANI */}
      <div className="flex-1 relative bg-slate-950">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-50">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase italic animate-pulse text-blue-400">Veriler Haritaya İşleniyor...</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            {/* Google Maps veya alternatif harita iframe/bileşeni buraya gelecek */}
            {/* Şimdilik koordinat listesini ve simülasyonu gösteriyoruz */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-full">
              {isler.length > 0 ? isler.map((is) => (
                <div key={is.id} className="bg-slate-900 border border-white/10 p-5 rounded-[2rem] hover:border-blue-5
