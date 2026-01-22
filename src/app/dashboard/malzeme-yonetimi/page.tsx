'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx' // Excel kütüphanesi

export default function MalzemeYonetimi() {
  const [liste, setListe] = useState<any[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const router = useRouter()

  const fetchMalzemeler = async () => {
    const { data } = await supabase.from('malzemeler').select('*').order('malzeme_kodu', { ascending: true })
    setListe(data || [])
  }

  useEffect(() => { fetchMalzemeler() }, [])

  // EXCEL OKUMA FONKSİYONU (Orijinal Mantık Korundu)
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async (evt) => {
      setYukleniyor(true);
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const formatliVeri = data.map((item: any) => ({
        malzeme_kodu: String(item["Malzeme Kodu"] || item["Kod"] || ""),
        malzeme_adi: String(item["Malzeme Adı"] || item["Ad"] || "")
      })).filter(i => i.malzeme_kodu && i.malzeme_adi);

      const { error } = await supabase.from('malzemeler').upsert(formatliVeri, { onConflict: 'malzeme_kodu' });

      if (error) {
        alert("Hata: " + error.message);
      } else {
        alert(`${formatliVeri.length} adet malzeme başarıyla güncellendi/eklendi.`);
        fetchMalzemeler();
      }
      setYukleniyor(false);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden bg-[#0a0b0e]">
      
      {/* 🖼️ TAM SAYFA KURUMSAL ARKA PLAN */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "url('/logo.png')",
          backgroundSize: '80%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.5) contrast(1.2) grayscale(0.5)'
        }}
      ></div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10 space-y-6">
        
        {/* 🏛️ ÜST BAR */}
        <div className="flex justify-between items-center bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">Malzeme Kataloğu</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1 italic">IFS Veri Entegrasyon Paneli</p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95 shadow-orange-900/30 font-black"
          >
            <span className="text-sm">←</span> GERİ DÖN
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          
          {/* EXCEL YÜKLEME ALANI (GÖRSEL GÜNCELLEME) */}
          <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-gray-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-green-600/20 rounded-2xl flex items-center justify-center text-2xl shadow-lg border border-green-600/30 text-green-500">📊</div>
               <div>
                  <h3 className="text-sm font-black uppercase italic text-white leading-none mb-1 tracking-widest">Excel Veri Aktarımı</h3>
                  <p className="text-[9px] font-bold text-gray-500 uppercase italic">Katalog sütunları: "Kod" ve "Ad" olmalıdır.</p>
               </div>
            </div>
            
            <div className="flex items-center gap-4 bg-black/40 p-3 rounded-2xl border border-gray-700 w-full md:w-auto">
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload}
                className="text-[10px] font-black uppercase italic file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-orange-600 file:text-white hover:file:bg-orange-700 transition-all cursor-pointer"
              />
              {yukleniyor && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
                  <span className="text-orange-500 font-black text-[10px] uppercase italic">İşleniyor...</span>
                </div>
              )}
            </div>
          </div>

          {/* LİSTE TABLOSU */}
          <div className="bg-[#1a1c23]/80 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-black">
                <thead>
                  <tr className="bg-black/40 text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] italic border-b border-gray-800">
                    <th className="p-6">IFS MALZEME KODU</th>
                    <th className="p-6">MALZEME TANIMI (AÇIKLAMA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {liste.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-20 text-center text-gray-600 font-black uppercase italic tracking-widest opacity-20 text-xl">
                        Katalog Boş
                      </td>
                    </tr>
                  ) : (
                    liste.map((m) => (
                      <tr key={m.id} className="hover:bg-white/5 transition-all">
                        <td className="p-6">
                          <span className="font-mono font-black text-sm text-orange-500 tracking-tighter bg-orange-500/10 px-4 py-2 rounded-xl border border-orange-500/20">
                            {m.malzeme_kodu}
                          </span>
                        </td>
                        <td className="p-6">
                          <div className="text-sm font-black text-gray-200 uppercase italic tracking-tight leading-tight">
                            {m.malzeme_adi}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}