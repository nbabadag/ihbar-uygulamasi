'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function AIYonetimPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [hamKelimeler, setHamKelimeler] = useState<any[]>([])
  const [onayliKombinasyonlar, setOnayliKombinasyonlar] = useState<any[]>([])
  const [calismaGruplari, setCalismaGruplari] = useState<any[]>([]) 
  
  const [manualKeywords, setManualKeywords] = useState('')
  const [manualTeam, setManualTeam] = useState('') 

  // --- 🧠 SAHADAN ÖĞRENME MOTORU ---
  const sahadanOgren = useCallback(async (ihbarlar: any[]) => {
    // Mevcut kütüphanedeki kelimeleri al
    const { data: mevcutKelimeler } = await supabase.from('ai_kutuphane').select('kelime');
    const mevcutSet = new Set(mevcutKelimeler?.map(k => k.kelime.toLowerCase()) || []);

    const yeniKelimeler: string[] = [];
    
    ihbarlar.forEach(ihbar => {
      // Metni temizle ve kelimelere böl
      const metin = `${ihbar.konu} ${ihbar.aciklama || ''}`
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g," ")
        .split(/\s+/);

      metin.forEach(kelime => {
        // 3 harften büyük, sayı olmayan ve listede olmayan kelimeleri ayıkla
        if (kelime.length > 3 && isNaN(Number(kelime)) && !mevcutSet.has(kelime)) {
          yeniKelimeler.push(kelime.toUpperCase());
          mevcutSet.add(kelime);
        }
      });
    });

    if (yeniKelimeler.length > 0) {
      // Tekil hale getir ve kütüphaneye mühürle
      const uniqueYeniler = [...new Set(yeniKelimeler)];
      const insertData = uniqueYeniler.map(k => ({
        kelime: k,
        onay_durumu: false
      }));
      await supabase.from('ai_kutuphane').upsert(insertData, { onConflict: 'kelime' });
    }
  }, []);

  const fetchKombinasyonlar = async () => {
    setLoading(true)
    
    // 1. Grupları Çek
    const { data: ekiplerData } = await supabase.from('calisma_gruplari').select('grup_adi').order('grup_adi');
    if (ekiplerData) {
      setCalismaGruplari(ekiplerData);
      if (!manualTeam && ekiplerData.length > 0) setManualTeam(ekiplerData[0].grup_adi);
    }

    // 2. Sahadan Öğren: Son 100 ihbarı tara
    const { data: sonIhbarlar } = await supabase.from('ihbarlar').select('konu, aciklama').order('created_at', { ascending: false }).limit(100);
    if (sonIhbarlar) await sahadanOgren(sonIhbarlar);

    // 3. Onaylı Kombinasyonları Çek
    const { data: kombData } = await supabase.from('ai_kombinasyonlar').select('*').order('created_at', { ascending: false });
    setOnayliKombinasyonlar(kombData || []);

    // 4. Ham Kelimeleri Çek (Havuz)
    const { data: kutuphaneData } = await supabase.from('ai_kutuphane').select('*').eq('onay_durumu', false).order('created_at', { ascending: false });
    setHamKelimeler((kutuphaneData || []).map(k => ({
      id: `ham-${k.id}`,
      kelime_grubu: [k.kelime],
      onerilen_ekip: 'ÖNERİ BEKLİYOR',
      is_ham: true
    })));
    
    setLoading(false)
  }

  useEffect(() => { fetchKombinasyonlar() }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);
        const formattedData = rawData.map(row => ({
          kelime_grubu: String(row.kelime || "").split(',').map(k => k.trim().toLowerCase()).filter(k => k !== ""),
          onerilen_ekip: row.onerilen_ekip,
          onay_durumu: true
        })).filter(item => item.kelime_grubu.length > 0 && item.onerilen_ekip);
        await supabase.from('ai_kombinasyonlar').insert(formattedData);
        alert("Excel Başarıyla Mühürlendi! ✅");
        fetchKombinasyonlar();
      } catch (err: any) { alert("Hata: " + err.message); } finally { setUploading(false); }
    };
    reader.readAsBinaryString(file);
  }

  const grupEkle = async () => {
    if (!manualKeywords || !manualTeam) return alert("Kelimeleri girin ve Ekip seçin!");
    const kelimeDizisi = manualKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    
    const { error } = await supabase.from('ai_kombinasyonlar').insert([{
      kelime_grubu: kelimeDizisi,
      onerilen_ekip: manualTeam,
      onay_durumu: true
    }]);

    if (!error) { 
      await supabase.from('ai_kutuphane').update({ onay_durumu: true }).in('kelime', kelimeDizisi.map(k => k.toUpperCase()));
      setManualKeywords(''); 
      fetchKombinasyonlar(); 
    }
  }

  const sil = async (id: string, isHam: boolean) => {
    if (isHam) {
       await supabase.from('ai_kutuphane').delete().eq('id', id.split('ham-')[1]);
    } else {
       await supabase.from('ai_kombinasyonlar').delete().eq('id', id);
    }
    fetchKombinasyonlar();
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white p-4 md:p-6 font-black uppercase italic">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('/logo.png')", backgroundSize: '60%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}></div>

      <div className="relative z-10 max-w-[1850px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-[#111318]/80 backdrop-blur-md p-5 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-xl text-orange-500 tracking-tighter italic">AI KOMBİNASYON MERKEZİ</h1>
            <p className="text-[9px] text-gray-500 mt-0.5 italic">Saha 360 // AKILLI ÖĞRENME SİSTEMİ</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-orange-600 px-5 py-2.5 rounded-xl text-[9px] transition-all font-black">ANA SAYFA</button>
        </div>

        {/* İşlem Paneli */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
          <div className="lg:col-span-7 bg-[#1a1c23] border border-gray-800 p-6 rounded-[2rem] shadow-2xl">
            <h3 className="text-orange-500 text-[9px] mb-3 tracking-widest font-black uppercase">✍️ YENİ KOMBİNASYON OLUŞTUR</h3>
            <textarea 
              value={manualKeywords} 
              onChange={(e) => setManualKeywords(e.target.value)}
              placeholder="KELİMELERİ VİRGÜL İLE AYIRIN (Örn: klima, fan, soğutma)..." 
              className="w-full h-20 bg-black border border-gray-700 p-3 rounded-xl text-[10px] outline-none focus:border-orange-500 text-white mb-3 italic font-black"
            />
            <div className="flex gap-2">
              <select value={manualTeam} onChange={(e) => setManualTeam(e.target.value)} className="flex-1 bg-black/50 border border-gray-600 p-2.5 rounded-xl text-[10px] text-orange-400 outline-none">
                {calismaGruplari.map((ekip, i) => <option key={i} value={ekip.grup_adi}>{ekip.grup_adi}</option>)}
              </select>
              <button onClick={grupEkle} className="bg-orange-600 px-8 rounded-xl text-[10px] hover:bg-orange-500 font-black">MÜHÜRLE</button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#1a1c23] border border-blue-500/20 p-6 rounded-[2rem] shadow-2xl flex flex-col justify-center items-center text-center">
            <h3 className="text-blue-400 text-[9px] tracking-widest mb-4 font-black">📊 TOPLU VERİ YÜKLEME (EXCEL)</h3>
            <label className="w-full cursor-pointer bg-blue-600/5 border-2 border-dashed border-blue-500/20 p-5 rounded-2xl hover:bg-blue-600/10 transition-all">
              <span className="text-2xl block mb-1">📁</span>
              <span className="text-[9px] text-blue-400 font-black">{uploading ? 'YÜKLENİYOR...' : 'DOSYAYI BURAYA BIRAK'}</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Liste Alanı */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SOL: SAHADAN GELENLER */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3 border-l-4 border-orange-600 pl-3">
              <h2 className="text-orange-500 text-xs font-black">🔥 SAHADAN GELEN ÖNERİLER (OTOMATİK)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {hamKelimeler.map((item) => (
                <div key={item.id} className="bg-[#111318] p-3 rounded-xl border border-orange-500/10 hover:border-orange-500/50 transition-all">
                  <div className="flex flex-wrap gap-1">
                    {item.kelime_grubu.map((k: string, i: number) => (
                      <span key={i} onClick={() => setManualKeywords(prev => prev ? `${prev}, ${k}` : k)} className="bg-orange-600 text-white px-2 py-1.5 rounded-md text-[10px] font-black cursor-pointer w-full text-center hover:scale-105 transition-transform">
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800">
                    <span className="text-[8px] text-gray-500">YENİ ÖNERİ</span>
                    <button onClick={() => sil(item.id, true)} className="text-[8px] text-red-500 font-black">SİL</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SAĞ: ONAYLANANLAR */}
          <div className="lg:col-span-5 space-y-4 font-black italic">
            <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3 font-black">
              <h2 className="text-blue-500 text-xs font-black">✅ AKTİF AI KURALLARI</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onayliKombinasyonlar.map((item) => (
                <div key={item.id} className="bg-[#111318] p-3 rounded-xl border border-gray-800 hover:border-blue-500/40">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.kelime_grubu.map((k: string, i: number) => (
                      <span key={i} className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[9px] border border-blue-500/20 font-black uppercase">
                        #{k}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-800/50 pt-2 font-black">
                    <span className="text-[9px] text-blue-400 uppercase font-black">{item.onerilen_ekip}</span>
                    <button onClick={() => sil(item.id, false)} className="text-[9px] text-red-500 font-black">KALDIR</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}