'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function MalzemeYonetimi() {
  const [liste, setListe] = useState<any[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [aramaTerimi, setAramaTerimi] = useState('')
  const [sayfa, setSayfa] = useState(1)
  const sayfaBasiAdet = 500 // Her sayfada 500 malzeme göstererek erişimi hızlandırdık
  const router = useRouter()

  const fetchMalzemeler = async () => {
    setYukleniyor(true);
    // 60.000 veriyi çekerken hata almamak için select(*) kullanıyoruz
    const { data, error } = await supabase
      .from('malzemeler')
      .select('*')
      .order('malzeme_kodu', { ascending: true });
    
    if (error) {
      console.error("Veri çekme hatası:", error);
    } else {
      setListe(data || []);
    }
    setYukleniyor(false);
  }

  useEffect(() => { fetchMalzemeler() }, [])

  // 🔍 GELİŞMİŞ CANLI ARAMA (TÜM LİSTEDE ARAR)
  const filtrelenmisListe = useMemo(() => {
    const terim = aramaTerimi.trim().toLowerCase();
    if (!terim) return liste;
    
    return liste.filter(m => 
      (m.malzeme_kodu?.toLowerCase().includes(terim)) || 
      (m.malzeme_adi?.toLowerCase().includes(terim))
    );
  }, [aramaTerimi, liste]);

  // Sayfalama Hesaplamaları (Kısıtlamayı Kaldırdık)
  const toplamSayfa = Math.ceil(filtrelenmisListe.length / sayfaBasiAdet);
  const suankiVeriler = filtrelenmisListe.slice((sayfa - 1) * sayfaBasiAdet, sayfa * sayfaBasiAdet);

  const malzemeSil = async (id: string) => {
    if (!confirm("BU MALZEMEYİ SİLMEK İSTEDİĞİNİZE EMİN MİSİNİZ?")) return;
    const { error } = await supabase.from('malzemeler').delete().eq('id', id);
    if (error) alert(error.message); else fetchMalzemeler();
  }

  return (
    <div className="h-screen flex flex-col text-white font-sans bg-[#0a0b0e] overflow-hidden">
      
      {/* 🏛️ SABİT ÜST PANEL */}
      <div className="p-4 md:p-6 bg-[#111318] border-b border-gray-800 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-orange-500">Malzeme Kataloğu</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">
              TOPLAM KAYIT: {liste.length} | FİLTRELENEN: {filtrelenmisListe.length}
            </p>
          </div>
          
          {/* CANLI ARAMA ÇUBUĞU */}
          <div className="w-full md:w-96 bg-black/40 border border-gray-700 rounded-2xl px-4 py-2 flex items-center gap-3">
            <span className="text-gray-500">🔍</span>
            <input 
              type="text" 
              placeholder="KOD VEYA AD İLE ARA..." 
              className="bg-transparent border-none outline-none w-full font-black italic uppercase text-sm"
              value={aramaTerimi}
              onChange={(e) => { setAramaTerimi(e.target.value); setSayfa(1); }}
            />
          </div>

          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase italic shadow-lg">← GERİ</button>
        </div>
      </div>

      {/* 📊 TABLO ALANI (KAYDIRILABİLİR) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-7xl mx-auto p-4">
          <div className="bg-[#1a1c23] rounded-[2rem] border border-gray-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#1a1c23] z-10 border-b border-gray-800">
                <tr className="text-[10px] font-black uppercase text-gray-500 italic">
                  <th className="p-5">MALZEME KODU</th>
                  <th className="p-5">TANIM (AÇIKLAMA)</th>
                  <th className="p-5 text-right">İŞLEM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {suankiVeriler.length > 0 ? (
                  suankiVeriler.map((m) => (
                    <tr key={m.id} className="hover:bg-white/5 transition-all font-black italic uppercase">
                      <td className="p-5 text-orange-500 text-sm tracking-tighter">{m.malzeme_kodu}</td>
                      <td className="p-5 text-gray-300 text-sm leading-tight">{m.malzeme_adi}</td>
                      <td className="p-5 text-right">
                        <button onClick={() => malzemeSil(m.id)} className="text-red-500 bg-red-500/10 px-4 py-2 rounded-xl text-[9px] hover:bg-red-500 hover:text-white transition-all">SİL</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-20 text-center text-gray-700 italic font-black">ARANAN MALZEME BULUNAMADI</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 📑 SAYFALAMA KONTROLLERİ (ALTTA SABİT) */}
      <div className="p-4 bg-[#111318] border-t border-gray-800 flex justify-center items-center gap-6 z-50">
        <button 
          disabled={sayfa === 1}
          onClick={() => setSayfa(s => s - 1)}
          className="bg-gray-800 disabled:opacity-20 px-6 py-2 rounded-xl text-[10px] font-black italic uppercase shadow-md"
        >Önceki</button>
        
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black italic uppercase text-gray-500">SAYFA</span>
           <span className="text-lg font-black italic text-orange-500">{sayfa}</span>
           <span className="text-[10px] font-black italic uppercase text-gray-500">/ {toplamSayfa}</span>
        </div>

        <button 
          disabled={sayfa === toplamSayfa || toplamSayfa === 0}
          onClick={() => setSayfa(s => s + 1)}
          className="bg-gray-800 disabled:opacity-20 px-6 py-2 rounded-xl text-[10px] font-black italic uppercase shadow-md"
        >Sonraki</button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
