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
  const sayfaBasiAdet = 100 // Her sayfada 100 malzeme
  const router = useRouter()

  const fetchMalzemeler = async () => {
    setYukleniyor(true);
    const { data } = await supabase.from('malzemeler').select('*').order('malzeme_kodu', { ascending: true })
    setListe(data || [])
    setYukleniyor(false);
  }

  useEffect(() => { fetchMalzemeler() }, [])

  // Canlı Arama ve Filtreleme Mantığı
  const filtrelenmisListe = useMemo(() => {
    const terim = aramaTerimi.toLowerCase();
    return liste.filter(m => 
      m.malzeme_kodu?.toLowerCase().includes(terim) || 
      m.malzeme_adi?.toLowerCase().includes(terim)
    );
  }, [aramaTerimi, liste]);

  // Sayfalama Hesaplamaları
  const toplamSayfa = Math.ceil(filtrelenmisListe.length / sayfaBasiAdet);
  const suankiVeriler = filtrelenmisListe.slice((sayfa - 1) * sayfaBasiAdet, sayfa * sayfaBasiAdet);

  const malzemeSil = async (id: string) => {
    if (!confirm("Bu malzemeyi katalogdan silmek istediğinize emin misiniz?")) return;
    const { error } = await supabase.from('malzemeler').delete().eq('id', id);
    if (error) alert(error.message); else fetchMalzemeler();
  }

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setYukleniyor(true);
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);

      const formatliVeri = data.map((item: any) => ({
        malzeme_kodu: String(item["Malzeme Kodu"] || item["Kod"] || ""),
        malzeme_adi: String(item["Malzeme Adı"] || item["Ad"] || "")
      })).filter(i => i.malzeme_kodu && i.malzeme_adi);

      const { error } = await supabase.from('malzemeler').upsert(formatliVeri, { onConflict: 'malzeme_kodu' });
      if (error) alert("Hata: " + error.message);
      else { alert(`${formatliVeri.length} adet malzeme güncellendi.`); fetchMalzemeler(); }
      setYukleniyor(false);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="h-screen flex flex-col text-white font-sans bg-[#0a0b0e] overflow-hidden">
      
      {/* 🏛️ ÜST BAR (SABİT) */}
      <div className="p-4 md:p-6 bg-[#111318]/90 backdrop-blur-md border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter text-orange-500 leading-none">Malzeme Envanteri</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Toplam: {filtrelenmisListe.length} Kalem</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic">← GERİ</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* 🔍 ARAMA VE YÜKLEME PANELI (SABİT DURUŞLU) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1a1c23] p-4 rounded-3xl border border-gray-800 flex items-center gap-4">
              <span className="text-xl">🔍</span>
              <input 
                type="text" 
                placeholder="KOD VEYA AD İLE ARA..." 
                className="bg-transparent border-none outline-none w-full font-black italic uppercase text-sm"
                value={aramaTerimi}
                onChange={(e) => { setAramaTerimi(e.target.value); setSayfa(1); }}
              />
            </div>
            <div className="bg-[#1a1c23] p-4 rounded-3xl border border-gray-800 flex items-center justify-between gap-4">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="text-[10px] font-black italic file:bg-orange-600 file:border-none file:px-4 file:py-2 file:rounded-xl file:text-white cursor-pointer" />
                {yukleniyor && <span className="animate-pulse text-orange-500 font-black text-[10px]">İŞLENİYOR...</span>}
            </div>
          </div>

          {/* 📊 TABLO ALANI */}
          <div className="bg-[#1a1c23] rounded-[2.5rem] border border-gray-800 overflow-hidden shadow-2xl mb-20">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#1a1c23] z-10 border-b border-gray-800">
                <tr className="text-[10px] font-black uppercase text-gray-500 italic">
                  <th className="p-5">MALZEME KODU</th>
                  <th className="p-5">MALZEME TANIMI</th>
                  <th className="p-5 text-right">İŞLEM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {suankiVeriler.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 transition-all group font-black italic uppercase">
                    <td className="p-5 text-orange-500 text-sm">{m.malzeme_kodu}</td>
                    <td className="p-5 text-gray-300 text-sm">{m.malzeme_adi}</td>
                    <td className="p-5 text-right">
                      <button onClick={() => malzemeSil(m.id)} className="text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-xl text-[9px] transition-all">SİL</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 📑 SAYFALAMA (PAGINATION) ALT BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111318]/95 backdrop-blur-md p-4 border-t border-gray-800 flex justify-center items-center gap-4 z-[100]">
        <button 
          disabled={sayfa === 1}
          onClick={() => setSayfa(s => s - 1)}
          className="bg-gray-800 disabled:opacity-20 px-4 py-2 rounded-xl text-[10px] font-black italic uppercase"
        >Önceki</button>
        
        <span className="text-[10px] font-black italic uppercase text-orange-500">
          SAYFA {sayfa} / {toplamSayfa || 1}
        </span>

        <button 
          disabled={sayfa === toplamSayfa || toplamSayfa === 0}
          onClick={() => setSayfa(s => s + 1)}
          className="bg-gray-800 disabled:opacity-20 px-4 py-2 rounded-xl text-[10px] font-black italic uppercase"
        >Sonraki</button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
