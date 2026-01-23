'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function AIYonetimPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [kombinasyonlar, setKombinasyonlar] = useState<any[]>([])
  const [calismaGruplari, setCalismaGruplari] = useState<any[]>([]) 
  const [filter, setFilter] = useState<'HEPSİ' | 'ONAYSIZ' | 'ONAYLI'>('ONAYLI')
  
  const [manualKeywords, setManualKeywords] = useState('')
  const [manualTeam, setManualTeam] = useState('') 

  const fetchKombinasyonlar = async () => {
    setLoading(true)
    
    // 🚨 HATALI SATIR DÜZELTİLDİ: 'ekipler' yerine 'calisma_gruplari' yazıldı
    const { data: ekiplerData, error: ekipError } = await supabase
      .from('calisma_gruplari') 
      .select('grup_adi')
      .order('grup_adi');

    if (!ekipError && ekiplerData && ekiplerData.length > 0) {
      setCalismaGruplari(ekiplerData);
      if (!manualTeam) setManualTeam(ekiplerData[0].grup_adi);
    } else {
      console.error("Gruplar çekilemedi:", ekipError?.message);
    }

    let query = supabase.from('ai_kombinasyonlar').select('*').order('created_at', { ascending: false })
    if (filter === 'ONAYSIZ') query = query.eq('onay_durumu', false)
    if (filter === 'ONAYLI') query = query.eq('onay_durumu', true)
    const { data: kombData } = await query

    let hamKelimeler: any[] = []
    if (filter === 'ONAYSIZ' || filter === 'HEPSİ') {
      const { data: kutuphaneData } = await supabase.from('ai_kutuphane').select('*').eq('onay_durumu', false)
      hamKelimeler = (kutuphaneData || []).map(k => ({
        id: `ham-${k.id}`,
        kelime_grubu: [k.kelime],
        onerilen_ekip: k.onerilen_ekip,
        onay_durumu: false,
        is_ham: true
      }))
    }

    setKombinasyonlar([...hamKelimeler, ...(kombData || [])])
    setLoading(false)
  }

  useEffect(() => { fetchKombinasyonlar() }, [filter])

  const grupEkle = async () => {
    if (!manualKeywords || !manualTeam) return alert("Kelimeleri ve Grubu seçiniz!");
    const kelimeDizisi = manualKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    if (kelimeDizisi.length < 2) return alert("Grup oluşturmak için en az 2 kelime giriniz!");

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

  const sil = async (id: string) => {
    if (String(id).startsWith('ham-')) {
       const kelimeId = id.split('ham-')[1];
       await supabase.from('ai_kutuphane').delete().eq('id', kelimeId);
    } else {
       await supabase.from('ai_kombinasyonlar').delete().eq('id', id);
    }
    fetchKombinasyonlar();
  }

  const onayla = async (id: string) => {
    if (String(id).startsWith('ham-')) {
        alert("Ham kelimeyi önce bir gruba dahil etmelisiniz.");
    } else {
        await supabase.from('ai_kombinasyonlar').update({ onay_durumu: true }).eq('id', id);
    }
    fetchKombinasyonlar();
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white p-4 md:p-8 font-black uppercase italic">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('/logo.png')", backgroundSize: '60%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-[#111318]/80 backdrop-blur-md p-6 rounded-3xl border border-gray-800 shadow-2xl font-black">
          <div>
            <h1 className="text-2xl text-orange-500 tracking-tighter uppercase font-black font-black font-black">AI Kombinasyon Merkezi</h1>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-black font-black font-black">Sefine Shipyard // Ekip Eşleştirme</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-orange-600 px-6 py-3 rounded-2xl text-[10px] text-white transition-all uppercase font-black font-black">Dashboard</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10 font-black">
          <div className="bg-[#1a1c23] border border-gray-800 p-8 rounded-[2.5rem] shadow-2xl font-black">
            <h3 className="text-orange-500 text-[10px] mb-4 tracking-widest uppercase font-black font-black">✍️ GRUP KELİME EKLE (Virgül ile)</h3>
            <textarea 
              value={manualKeywords} 
              onChange={(e) => setManualKeywords(e.target.value)}
              placeholder="Örn: NB, Aydınlatma, Pano" 
              className="w-full h-24 bg-black border border-gray-700 p-4 rounded-2xl text-[10px] outline-none focus:border-orange-500 text-white mb-4 italic font-black font-black"
            />
            <div className="flex gap-2 font-black font-black">
              <select 
                value={manualTeam} 
                onChange={(e) => setManualTeam(e.target.value)} 
                className="flex-1 bg-black/50 border-2 border-gray-600 p-3 rounded-xl text-[10px] text-orange-400 font-black uppercase outline-none focus:border-orange-500 font-black"
              >
                {calismaGruplari.length > 0 ? (
                  calismaGruplari.map((ekip, index) => (
                    <option key={index} value={ekip.grup_adi} className="bg-[#1a1c23]">{ekip.grup_adi}</option>
                  ))
                ) : (
                  <option>Grup Bulunamadı</option>
                )}
              </select>
              <button onClick={grupEkle} className="bg-orange-600 px-6 rounded-xl font-black text-[10px] uppercase font-black">Grup Oluştur</button>
            </div>
          </div>

          <div className="bg-[#1a1c23] border border-blue-500/20 p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-center items-center text-center font-black">
             <h3 className="text-blue-400 text-[10px] mb-4 tracking-widest uppercase font-black font-black font-black font-black">📊 EXCEL GRUP YÜKLEME</h3>
             <label className="w-full cursor-pointer bg-blue-600/10 border-2 border-dashed border-blue-500/30 p-10 rounded-3xl hover:bg-blue-600/20 transition-all font-black font-black">
               <span className="text-3xl block mb-2 font-black font-black">📁</span>
               <span className="text-[10px] font-black text-blue-400 uppercase font-black font-black font-black font-black font-black font-black font-black">DOSYA SEÇ VEYA SÜRÜKLE</span>
               <input type="file" accept=".xlsx, .xls" className="hidden font-black font-black" />
             </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-black uppercase italic font-black">
            {kombinasyonlar.map((item) => (
                <div key={item.id} className={`bg-[#111318] p-5 rounded-2xl border flex flex-col gap-3 hover:border-orange-500/30 transition-all font-black font-black ${item.is_ham ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-gray-800 font-black'}`}>
                    <div className="flex flex-wrap gap-1 font-black">
                        {item.kelime_grubu.map((k: string, i: number) => (
                            <span key={i} 
                                  onClick={() => item.is_ham && setManualKeywords(prev => prev ? `${prev}, ${k}` : k)}
                                  className={`px-2 py-0.5 rounded text-[8px] border font-black ${item.is_ham ? 'bg-orange-600 text-white border-orange-400 cursor-pointer animate-pulse font-black' : 'bg-orange-500/10 text-orange-500 border-orange-500/20 font-black'}`}>
                                {item.is_ham ? `AI ÖNERİSİ: ${k}` : `#${k}`}
                            </span>
                        ))}
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-800 pt-3 font-black font-black font-black">
                        <span className="text-[9px] text-gray-400 italic font-black font-black">HEDEF GRUP: {item.onerilen_ekip}</span>
                        <div className="flex gap-2 font-black font-black">
                            <button onClick={() => sil(item.id)} className="text-[8px] text-red-500 font-black font-black">SİL</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  )
}