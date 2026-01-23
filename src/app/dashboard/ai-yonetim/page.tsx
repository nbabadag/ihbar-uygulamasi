'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function AIYonetimPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [kombinasyonlar, setKombinasyonlar] = useState<any[]>([])
  const [filter, setFilter] = useState<'HEPSİ' | 'ONAYSIZ' | 'ONAYLI'>('ONAYLI')
  
  const [manualKeywords, setManualKeywords] = useState('')
  const [manualTeam, setManualTeam] = useState('YENİ İNŞA ELEKTRİK')

  const fetchKombinasyonlar = async () => {
    setLoading(true)
    // Yeni tablo: ai_kombinasyonlar
    let query = supabase.from('ai_kombinasyonlar').select('*').order('created_at', { ascending: false })
    
    if (filter === 'ONAYSIZ') query = query.eq('onay_durumu', false)
    if (filter === 'ONAYLI') query = query.eq('onay_durumu', true)
    
    const { data } = await query
    setKombinasyonlar(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchKombinasyonlar() }, [filter])

  // --- 📊 EXCEL'DEN GRUP OLARAK YÜKLEME ---
  const handleExcelUpload = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const eklenecekler = data.slice(1).map((row: any) => {
        // Excel'de yan yana veya virgülle yazılmış kelimeleri diziye çevir
        const kelimeDizisi = String(row[0]).split(',').map(k => k.toLowerCase().trim()).filter(k => k.length > 0);
        return {
          kelime_grubu: kelimeDizisi,
          onerilen_ekip: row[1] || manualTeam,
          onay_durumu: true
        };
      }).filter(item => item.kelime_grubu.length > 0);

      const { error } = await supabase.from('ai_kombinasyonlar').insert(eklenecekler);
      
      if (error) alert("Hata: " + error.message);
      else {
        alert(`${eklenecekler.length} adet kombinasyon yüklendi.`);
        fetchKombinasyonlar();
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- ✍️ MANUEL GRUP EKLEME ---
  const grupEkle = async () => {
    if (!manualKeywords) return alert("Kelimeleri giriniz!");
    
    const kelimeDizisi = manualKeywords.split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    if (kelimeDizisi.length < 2) {
      return alert("Grup oluşturmak için en az 2 kelime giriniz! (Örn: NB, Aydınlatma)");
    }

    const { error } = await supabase.from('ai_kombinasyonlar').insert([{
      kelime_grubu: kelimeDizisi,
      onerilen_ekip: manualTeam,
      onay_durumu: true
    }]);

    if (error) alert("Hata: " + error.message);
    else {
      setManualKeywords('');
      fetchKombinasyonlar();
    }
  }

  const sil = async (id: string) => {
    await supabase.from('ai_kombinasyonlar').delete().eq('id', id)
    fetchKombinasyonlar()
  }

  const onayla = async (id: string) => {
    await supabase.from('ai_kombinasyonlar').update({ onay_durumu: true }).eq('id', id)
    fetchKombinasyonlar()
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white p-4 md:p-8 font-black uppercase italic">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('/logo.png')", backgroundSize: '60%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-[#111318]/80 backdrop-blur-md p-6 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl text-orange-500 tracking-tighter uppercase">AI Kombinasyon Merkezi</h1>
            <p className="text-[10px] text-gray-500 mt-1 uppercase">Grup Kelime ve Ekip Eşleştirme</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-orange-600 px-6 py-3 rounded-2xl text-[10px] text-white transition-all uppercase">Dashboard</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* MANUEL GRUP EKLEME */}
          <div className="bg-[#1a1c23] border border-gray-800 p-8 rounded-[2.5rem] shadow-2xl">
            <h3 className="text-orange-500 text-[10px] mb-4 tracking-widest uppercase">✍️ GRUP KELİME EKLE (Virgül ile)</h3>
            <textarea 
              value={manualKeywords} 
              onChange={(e) => setManualKeywords(e.target.value)}
              placeholder="Örn: NB, Aydınlatma, Pano" 
              className="w-full h-24 bg-black border border-gray-700 p-4 rounded-2xl text-[10px] outline-none focus:border-orange-500 text-white mb-4 italic"
            />
            <div className="flex gap-2">
              <select value={manualTeam} onChange={(e) => setManualTeam(e.target.value)} className="flex-1 bg-black border border-gray-700 p-3 rounded-xl text-[10px] text-orange-400 font-black">
                <option value="YENİ İNŞA ELEKTRİK">YENİ İNŞA ELEKTRİK</option>
                <option value="ELEKTRİK TAMİR EKİBİ">ELEKTRİK TAMİR EKİBİ</option>
                <option value="MEKANİK EKİBİ">MEKANİK EKİBİ</option>
                <option value="KOLLEKTÖR EKİBİ">KOLLEKTÖR EKİBİ</option>
              </select>
              <button onClick={grupEkle} className="bg-orange-600 px-6 rounded-xl font-black text-[10px] uppercase">Grup Oluştur</button>
            </div>
          </div>

          {/* EXCEL YÜKLEME */}
          <div className="bg-[#1a1c23] border border-blue-500/20 p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-center items-center text-center">
            <h3 className="text-blue-400 text-[10px] mb-4 tracking-widest uppercase">📊 EXCEL GRUP YÜKLEME</h3>
            <label className="w-full cursor-pointer bg-blue-600/10 border-2 border-dashed border-blue-500/30 p-10 rounded-3xl hover:bg-blue-600/20 transition-all">
              <span className="text-3xl block mb-2 font-black">📁</span>
              <span className="text-[10px] font-black text-blue-400 uppercase">DOSYA SEÇ VEYA SÜRÜKLE</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
            </label>
            <p className="text-[7px] mt-4 text-gray-600 uppercase font-black italic">Satır formatı: "nb, pano, lamba" | "ekip ismi"</p>
          </div>
        </div>

        {/* LİSTELEME */}
        <div className="flex gap-3 mb-6 font-black uppercase italic">
            {['ONAYSIZ', 'ONAYLI', 'HEPSİ'].map((f: any) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-xl text-[10px] border transition-all ${filter === f ? 'bg-orange-600 border-orange-500 text-white' : 'bg-transparent border-gray-800 text-gray-500'}`}>{f}</button>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-black uppercase italic">
            {kombinasyonlar.map((item) => (
                <div key={item.id} className="bg-[#111318] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 hover:border-orange-500/30 transition-all">
                    <div className="flex flex-wrap gap-1">
                        {item.kelime_grubu.map((k: string, i: number) => (
                            <span key={i} className="bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded text-[8px] border border-orange-500/20">{k}</span>
                        ))}
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-800 pt-3">
                        <span className="text-[9px] text-gray-400 italic">Target: {item.onerilen_ekip}</span>
                        <div className="flex gap-2">
                            {!item.onay_durumu && <button onClick={() => onayla(item.id)} className="text-[8px] text-green-500 font-black">ONAY</button>}
                            <button onClick={() => sil(item.id)} className="text-[8px] text-red-500 font-black">SİL</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  )
}