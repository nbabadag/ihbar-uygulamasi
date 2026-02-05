'use client'
import { useEffect, useState } from 'react'
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

  const fetchKombinasyonlar = async () => {
    setLoading(true)
    const { data: ekiplerData } = await supabase.from('calisma_gruplari').select('grup_adi').order('grup_adi');
    if (ekiplerData && ekiplerData.length > 0) {
      setCalismaGruplari(ekiplerData);
      if (!manualTeam) setManualTeam(ekiplerData[0].grup_adi);
    }

    const { data: kombData } = await supabase.from('ai_kombinasyonlar').select('*').eq('onay_durumu', true).order('created_at', { ascending: false });
    setOnayliKombinasyonlar(kombData || []);

    const { data: kutuphaneData } = await supabase.from('ai_kutuphane').select('*').eq('onay_durumu', false).order('created_at', { ascending: false });
    setHamKelimeler((kutuphaneData || []).map(k => ({
      id: `ham-${k.id}`,
      kelime_grubu: [k.kelime],
      onerilen_ekip: k.onerilen_ekip || 'GENEL SAHA',
      is_ham: true
    })));
    setLoading(false)
  }

  useEffect(() => { fetchKombinasyonlar() }, [])

  // ÖRNEK EXCEL FORMATI OLUŞTURMA VE İNDİRME
  const sablonuIndir = () => {
    const data = [
      { kelime: "elektrik, pano, sigorta", onerilen_ekip: "ELEKTRİK ATÖLYESİ" },
      { kelime: "boru, kaynak, sızıntı", onerilen_ekip: "BORU ATÖLYESİ" },
      { kelime: "klima, soğutma, fan", onerilen_ekip: "HAVALANDIRMA" }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AI_Sablon");
    XLSX.writeFile(wb, "Saha360_AI_Yukleme_Sablonu.xlsx");
  }

  // EXCEL YÜKLEME FONKSİYONU
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawData: any[] = XLSX.utils.sheet_to_json(ws)

        if (rawData.length === 0) throw new Error("Excel dosyası boş görünüyor.");

        const formattedData = rawData.map(row => ({
          kelime_grubu: String(row.kelime || "").split(',').map(k => k.trim().toLowerCase()).filter(k => k !== ""),
          onerilen_ekip: row.onerilen_ekip,
          onay_durumu: true
        })).filter(item => item.kelime_grubu.length > 0 && item.onerilen_ekip);

        const chunkSize = 500
        for (let i = 0; i < formattedData.length; i += chunkSize) {
          const chunk = formattedData.slice(i, i + chunkSize)
          const { error } = await supabase.from('ai_kombinasyonlar').insert(chunk)
          if (error) throw error
        }

        alert(`BAŞARILI: ${formattedData.length} ADET VERİ YÜKLENDİ! ✅`)
        fetchKombinasyonlar()
      } catch (err: any) {
        alert("Yükleme Hatası: " + err.message)
      } finally {
        setUploading(false)
        e.target.value = ""
      }
    }
    reader.readAsBinaryString(file)
  }

  const grupEkle = async () => {
    if (!manualKeywords || !manualTeam) return alert("Kelimeleri ve Grubu seçiniz!");
    const kelimeDizisi = manualKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    if (kelimeDizisi.length < 1) return alert("En az 1 kelime giriniz!");

    const { error } = await supabase.from('ai_kombinasyonlar').insert([{
      kelime_grubu: kelimeDizisi,
      onerilen_ekip: manualTeam,
      onay_durumu: true
    }]);

    if (error) alert("Hata: " + error.message);
    else { 
      await supabase.from('ai_kutuphane').delete().in('kelime', kelimeDizisi.map(k => k.toUpperCase()));
      setManualKeywords(''); 
      fetchKombinasyonlar(); 
    }
  }

  const sil = async (id: string, isHam: boolean) => {
    if (isHam) {
       const kelimeId = id.split('ham-')[1];
       await supabase.from('ai_kutuphane').delete().eq('id', kelimeId);
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
            <h1 className="text-xl text-orange-500 tracking-tighter">AI KOMBİNASYON MERKEZİ</h1>
            <p className="text-[9px] text-gray-500 mt-0.5">SEFİNE SHIPYARD // AKILLI ÖĞRENME SİSTEMİ</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-orange-600 px-5 py-2.5 rounded-xl text-[9px] transition-all">ANA SAYFA</button>
        </div>

        {/* Üst İşlem Paneli */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
          <div className="lg:col-span-7 bg-[#1a1c23] border border-gray-800 p-6 rounded-[2rem] shadow-2xl">
            <h3 className="text-orange-500 text-[9px] mb-3 tracking-widest uppercase">✍️ YENİ kombinasyon oluştur</h3>
            <textarea 
              value={manualKeywords} 
              onChange={(e) => setManualKeywords(e.target.value)}
              placeholder="KELİMELERİ VİRGÜL İLE AYIRIN..." 
              className="w-full h-20 bg-black border border-gray-700 p-3 rounded-xl text-[10px] outline-none focus:border-orange-500 text-white mb-3 italic"
            />
            <div className="flex gap-2">
              <select 
                value={manualTeam} 
                onChange={(e) => setManualTeam(e.target.value)} 
                className="flex-1 bg-black/50 border border-gray-600 p-2.5 rounded-xl text-[10px] text-orange-400 outline-none focus:border-orange-500"
              >
                {calismaGruplari.map((ekip, index) => (
                  <option key={index} value={ekip.grup_adi} className="bg-[#1a1c23]">{ekip.grup_adi}</option>
                ))}
              </select>
              <button onClick={grupEkle} className="bg-orange-600 px-8 rounded-xl text-[10px] hover:bg-orange-500 transition-colors">KAYDET</button>
            </div>
          </div>

          {/* TOPLU VERİ YÜKLEME ALANI */}
          <div className={`lg:col-span-5 bg-[#1a1c23] border border-blue-500/20 p-6 rounded-[2rem] shadow-2xl flex flex-col justify-center items-center text-center ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
             <div className="w-full flex justify-between items-center mb-4">
                <h3 className="text-blue-400 text-[9px] tracking-widest uppercase">📊 TOPLU VERİ YÜKLEME</h3>
                <button 
                  onClick={sablonuIndir}
                  className="text-[8px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg transition-all"
                >
                  📥 ŞABLONU İNDİR
                </button>
             </div>
             
             <div className="mb-3 bg-blue-600/5 p-3 rounded-xl border border-blue-500/10 w-full">
                <p className="text-[8px] text-blue-300/80 leading-relaxed font-black uppercase">
                    FORMAT: <span className="text-white">"kelime"</span> VE <span className="text-white">"onerilen_ekip"</span> SÜTUNLARI.
                </p>
             </div>

             <label className="w-full cursor-pointer bg-blue-600/5 border-2 border-dashed border-blue-500/20 p-5 rounded-2xl hover:bg-blue-600/10 transition-all group relative overflow-hidden">
               <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">
                 {uploading ? '⏳' : '📁'}
               </span>
               <span className="text-[9px] text-blue-400 uppercase font-black">
                 {uploading ? 'VERİLER İŞLENİYOR...' : 'DOSYA SÜRÜKLE VEYA SEÇ'}
               </span>
               <input 
                 type="file" 
                 accept=".xlsx, .xls" 
                 className="hidden" 
                 onChange={handleFileUpload}
                 disabled={uploading}
               />
               {uploading && <div className="absolute inset-0 bg-blue-600/10 animate-pulse"></div>}
             </label>
          </div>
        </div>

        {/* ANA YAN YANA YAPI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SOL: ÖNERİLER */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3 border-l-4 border-orange-600 pl-3">
              <h2 className="text-orange-500 text-xs tracking-tighter">🔥 SAHADAN GELEN ÖNERİLER</h2>
              <span className="bg-orange-600/20 text-orange-500 text-[8px] px-2 py-0.5 rounded-full">{hamKelimeler.length} ADET</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
              {hamKelimeler.map((item) => (
                <div key={item.id} className="bg-[#111318] p-3 rounded-xl border border-orange-500/20 hover:border-orange-500/50 transition-all flex flex-col justify-between min-h-[85px]">
                  <div className="flex flex-wrap gap-1">
                    {item.kelime_grubu.map((k: string, i: number) => (
                      <span key={i} 
                            onClick={() => setManualKeywords(prev => prev ? `${prev}, ${k}` : k)}
                            className="bg-orange-600 text-white px-2 py-1.5 rounded-md text-[11px] font-black cursor-pointer animate-pulse border border-orange-400 w-full text-center">
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-800/50 pt-2 mt-2">
                    <span className="text-[9px] text-gray-400 font-black truncate max-w-[75px] uppercase tracking-tighter">
                      {item.onerilen_ekip}
                    </span>
                    <button onClick={() => sil(item.id, true)} className="text-[9px] text-red-500 hover:text-red-400 transition-colors font-black tracking-widest">
                      SİL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SAĞ: ONAYLANANLAR */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3">
              <h2 className="text-blue-500 text-xs tracking-tighter">✅ ONAYLANMIŞ GRUPLAR</h2>
              <span className="bg-blue-600/20 text-blue-500 text-[8px] px-2 py-0.5 rounded-full">{onayliKombinasyonlar.length} ADET</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {onayliKombinasyonlar.map((item) => (
                <div key={item.id} className="bg-[#111318] p-3 rounded-xl border border-gray-800 hover:border-blue-500/40 transition-all flex flex-col justify-between min-h-[95px]">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.kelime_grubu.map((k: string, i: number) => (
                      <span key={i} className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] border border-blue-500/20 font-black">
                        #{k}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-800/50 pt-2">
                    <span className="text-[9px] text-blue-400/80 font-black truncate max-w-[90px] uppercase tracking-tighter">
                      {item.onerilen_ekip}
                    </span>
                    <button onClick={() => sil(item.id, false)} className="text-[9px] text-red-500 font-black tracking-widest hover:text-red-400 transition-colors">
                      SİL
                    </button>
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