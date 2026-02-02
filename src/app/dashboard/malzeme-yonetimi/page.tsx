'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx' // Excel kütüphanesi

export default function MalzemeYonetimi() {
  const [liste, setListe] = useState<any[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [aramaTerimi, setAramaTerimi] = useState('')
  const [sayfa, setSayfa] = useState(1)
  const sayfaBasiAdet = 1000 // Her sayfada 1000 kalem
  const router = useRouter()

  // 🔄 SINIRSIZ VERİ ÇEKME (60.000+ Kalem İçin Döngüsel Çekim)
  const fetchMalzemeler = async () => {
    setYukleniyor(true);
    let tumVeriler: any[] = [];
    let bitti = false;
    let baslangic = 0;

    // Supabase 1000 limitini aşmak için veriyi parçalı çekiyoruz
    while (!bitti) {
      const { data, error } = await supabase
        .from('malzemeler')
        .select('*')
        .range(baslangic, baslangic + 999)
        .order('malzeme_kodu', { ascending: true });

      if (error || !data || data.length === 0) {
        bitti = true;
      } else {
        tumVeriler = [...tumVeriler, ...data];
        if (data.length < 1000) bitti = true;
        baslangic += 1000;
      }
    }
    setListe(tumVeriler);
    setYukleniyor(false);
  }

  useEffect(() => { fetchMalzemeler() }, [])

  // 🔍 CANLI ARAMA MANTIĞI (60.000 Kayıt İçinde)
  const filtrelenmisListe = useMemo(() => {
    const terim = aramaTerimi.toLowerCase().trim();
    if (!terim) return liste;
    return liste.filter(m => 
      m.malzeme_kodu?.toLowerCase().includes(terim) || 
      m.malzeme_adi?.toLowerCase().includes(terim)
    );
  }, [aramaTerimi, liste]);

  // Sayfalama Hesaplamaları
  const toplamSayfa = Math.ceil(filtrelenmisListe.length / sayfaBasiAdet);
  const suankiVeriler = filtrelenmisListe.slice((sayfa - 1) * sayfaBasiAdet, sayfa * sayfaBasiAdet);

  // EXCEL OKUMA FONKSİYONU (Orijinal Mantık - Tamamen Korundu)
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
      if (error) alert("Hata: " + error.message);
      else { alert(`${formatliVeri.length} adet malzeme başarıyla güncellendi/eklendi.`); fetchMalzemeler(); }
      setYukleniyor(false);
    };
    reader.readAsBinaryString(file);
  };

  const malzemeSil = async (id: string) => {
    if (!confirm("Bu malzemeyi silmek istediğinize emin misiniz?")) return;
    const { error } = await supabase.from('malzemeler').delete().eq('id', id);
    if (error) alert(error.message); else fetchMalzemeler();
  }

  return (
    <div className="h-screen flex flex-col text-white font-sans relative bg-[#0a0b0e] overflow-hidden">
      
      {/* 🖼️ TAM SAYFA KURUMSAL ARKA PLAN (SABİT) */}
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('/logo.png')", backgroundSize: '60%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: 'grayscale(1)' }}></div>

      {/* 🏛️ SABİT ÜST BAR VE ARAMA (SCROLLDAN ETKİLENMEZ) */}
      <div className="relative z-50 bg-[#111318]/95 backdrop-blur-xl border-b border-gray-800 p-4 md:p-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Saha 360 // Malzeme Kataloğu</h1>
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-1">
              TOPLAM: {liste.length} | FİLTRELENEN: {filtrelenmisListe.length}
            </p>
          </div>

          {/* CANLI ARAMA */}
          <div className="flex-1 max-w-md w-full bg-black/50 border border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-inner">
            <span className="text-gray-500 text-xl">🔍</span>
            <input 
              type="text" 
              placeholder="MALZEME KODU VEYA ADI İLE CANLI ARA..." 
              className="bg-transparent border-none outline-none w-full font-black italic uppercase text-sm text-white"
              value={aramaTerimi}
              onChange={(e) => { setAramaTerimi(e.target.value); setSayfa(1); }}
            />
          </div>

          <div className="flex gap-2">
             <button onClick={() => router.push('/dashboard')} className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg active:scale-95">← GERİ</button>
          </div>
        </div>
      </div>

      {/* 📊 ANA İÇERİK (SCROLL EDİLEBİLİR ALAN) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* EXCEL YÜKLEME ALANI (Orijinal Mantık Korundu) */}
          <div className="bg-[#1a1c23]/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-gray-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-green-600/20 rounded-2xl flex items-center justify-center text-2xl border border-green-600/30 text-green-500">📊</div>
               <div>
                  <h3 className="text-sm font-black uppercase italic text-white leading-none mb-1">Excel Veri Aktarımı</h3>
                  <p className="text-[9px] font-bold text-gray-500 uppercase italic">Katalog sütunları: "Kod" ve "Ad" olmalıdır.</p>
               </div>
            </div>
            <div className="flex items-center gap-4 bg-black/40 p-3 rounded-2xl border border-gray-700">
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="text-[10px] font-black uppercase italic file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:bg-green-600 file:text-white cursor-pointer" />
              {yukleniyor && <span className="animate-pulse text-orange-500 font-black text-[10px] uppercase">İşleniyor...</span>}
            </div>
          </div>

          {/* TABLO */}
          <div className="bg-[#1a1c23]/80 backdrop-blur-lg rounded-[2.5rem] border border-gray-800 overflow-hidden shadow-2xl mb-24">
            <table className="w-full text-left font-black">
              <thead className="sticky top-0 bg-[#1a1c23] z-20 border-b border-gray-800 shadow-xl">
                <tr className="bg-black/40 text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] italic">
                  <th className="p-6">IFS KODU</th>
                  <th className="p-6">MALZEME TANIMI</th>
                  <th className="p-6 text-right">AKSİYON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {suankiVeriler.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 transition-all group">
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
                    <td className="p-6 text-right">
                       <button onClick={() => malzemeSil(m.id)} className="text-red-500 text-[10px] hover:underline uppercase italic font-black">SİL</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 📑 SAYFALAMA (SABİT ALT BAR) */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111318]/95 backdrop-blur-xl p-4 border-t border-gray-800 flex justify-center items-center gap-8 z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <button 
          disabled={sayfa === 1}
          onClick={() => { setSayfa(s => s - 1); document.querySelector('.overflow-y-auto')?.scrollTo(0,0); }}
          className="bg-gray-800 disabled:opacity-20 px-8 py-3 rounded-2xl text-[10px] font-black italic uppercase shadow-xl"
        >Önceki</button>
        
        <div className="flex flex-col items-center">
           <span className="text-[10px] font-black italic uppercase text-gray-500">SAYFA</span>
           <span className="text-xl font-black italic text-orange-500">{sayfa} / {toplamSayfa || 1}</span>
        </div>

        <button 
          disabled={sayfa === toplamSayfa || toplamSayfa === 0}
          onClick={() => { setSayfa(s => s + 1); document.querySelector('.overflow-y-auto')?.scrollTo(0,0); }}
          className="bg-gray-800 disabled:opacity-20 px-8 py-3 rounded-2xl text-[10px] font-black italic uppercase shadow-xl"
        >Sonraki</button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
