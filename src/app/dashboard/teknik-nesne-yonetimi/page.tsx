'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function TeknikNesneYonetimi() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [nesneAdi, setNesneAdi] = useState('')
  const [ifsKodu, setIfsKodu] = useState('')
  const [nesneler, setNesneler] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const normalizedRole = userRole.trim().toUpperCase();
  const yetkiliMi = !['SAHA PERSONELI', 'CAGRI MERKEZI', 'ÇAĞRI MERKEZİ', 'ÇAĞRI MERKEZI'].includes(normalizedRole);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(profile?.role || '')
      }
    }
    checkUser()
    fetchNesneler()
  }, [])

  const fetchNesneler = async () => {
    setLoading(true)
    const { data } = await supabase.from('teknik_nesneler').select('*').order('created_at', { ascending: false })
    setNesneler(data || [])
    setLoading(false)
  }

  // --- ✍️ MANUEL EKLEME ---
  const nesneEkle = async () => {
    if (!nesneAdi || !ifsKodu) return alert("Lütfen Nesne Adı ve IFS Kodunu giriniz!")
    const { error } = await supabase.from('teknik_nesneler').insert([{ 
      nesne_adi: nesneAdi.toUpperCase(), 
      ifs_kodu: ifsKodu.toUpperCase() 
    }])
    if (error) alert("Hata: " + error.message)
    else { setNesneAdi(''); setIfsKodu(''); fetchNesneler() }
  }

  // --- 📊 EXCEL TOPLU YÜKLEME ---
  const handleExcelUpload = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // İlk satırı (başlıkları) atlayıp verileri formatlıyoruz
      const eklenecekler = data.slice(1).map((row: any) => ({
        nesne_adi: String(row[0]).toUpperCase().trim(),
        ifs_kodu: String(row[1]).toUpperCase().trim()
      })).filter(item => item.nesne_adi !== 'UNDEFINED' && item.ifs_kodu !== 'UNDEFINED');

      const { error } = await supabase.from('teknik_nesneler').upsert(eklenecekler, { onConflict: 'ifs_kodu' });
      
      if (error) alert("Excel Yükleme Hatası: " + error.message);
      else {
        alert(`${eklenecekler.length} adet teknik nesne başarıyla envantere işlendi.`);
        fetchNesneler();
      }
    };
    reader.readAsBinaryString(file);
  };

  if (!yetkiliMi) return <div className="p-10 text-red-500 font-black italic uppercase">ERİŞİM YETKİNİZ YOK!</div>

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white p-4 md:p-8 font-black uppercase italic relative overflow-hidden">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none" style={{backgroundImage: "url('/logo.png')", backgroundSize: '60%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}></div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-10 bg-[#111318]/80 backdrop-blur-md p-6 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl text-orange-500 tracking-tighter font-black">Teknik Nesne Yönetimi</h1>
            <p className="text-[10px] text-gray-500 mt-1 uppercase">Varlık ve Envanter Tanımlama Merkezi</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-orange-600 px-6 py-3 rounded-2xl text-[10px] transition-all font-black">DASHBOARD</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* MANUEL KAYIT FORMU */}
          <div className="bg-[#111318] p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl">
            <h3 className="text-orange-500 text-[10px] mb-6 tracking-widest uppercase">✍️ Manuel Nesne Tanımla</h3>
            <div className="space-y-4">
              <input 
                placeholder="NESNE ADI (Örn: 32 Nolu Vinç)" 
                className="w-full p-4 bg-black border border-gray-700 rounded-2xl text-[10px] outline-none focus:border-orange-500 text-white"
                value={nesneAdi} onChange={e => setNesneAdi(e.target.value)}
              />
              <input 
                placeholder="IFS KODU (Örn: ASSET-1024)" 
                className="w-full p-4 bg-black border border-gray-700 rounded-2xl text-[10px] outline-none focus:border-blue-500 text-white"
                value={ifsKodu} onChange={e => setIfsKodu(e.target.value)}
              />
              <button onClick={nesneEkle} className="w-full bg-orange-600 hover:bg-orange-700 p-4 rounded-2xl font-black text-xs transition-all shadow-xl shadow-orange-900/20">KAYDET</button>
            </div>
          </div>

          {/* EXCEL TOPLU AKTARIM */}
          <div className="bg-[#111318] border border-blue-500/20 p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-center items-center text-center">
            <h3 className="text-blue-400 text-[10px] mb-6 tracking-widest uppercase">📊 Toplu Excel (.xlsx) Aktarımı</h3>
            <label className="w-full cursor-pointer bg-blue-600/5 border-2 border-dashed border-blue-500/20 p-10 rounded-3xl hover:bg-blue-600/10 transition-all border-blue-500/40">
              <span className="text-4xl block mb-2 font-black">📁</span>
              <span className="text-[10px] font-black text-blue-400">DOSYAYI SÜRÜKLE VEYA SEÇ</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
            </label>
            <p className="text-[8px] mt-4 text-gray-600 font-black italic">A Sütunu: Nesne Adı | B Sütunu: IFS Kodu</p>
          </div>
        </div>

        {/* ENVANTER LİSTESİ */}
        <div className="bg-[#111318] rounded-[2.5rem] border border-gray-800 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-gray-800 bg-gray-900/30 flex justify-between items-center">
            <h3 className="text-[10px] text-gray-400 font-black uppercase">Aktif Teknik Envanter ({nesneler.length})</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-black sticky top-0 z-10 text-orange-500 font-black italic">
                <tr>
                  <th className="p-5 uppercase tracking-widest">Nesne Adı (Saha)</th>
                  <th className="p-5 uppercase tracking-widest">IFS Sistem Kodu</th>
                  <th className="p-5 uppercase tracking-widest text-right">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 font-black">
                {loading ? (
                  <tr><td colSpan={3} className="p-20 text-center animate-pulse text-gray-500 uppercase font-black italic">Veriler Yükleniyor...</td></tr>
                ) : nesneler.length === 0 ? (
                  <tr><td colSpan={3} className="p-20 text-center text-gray-600 uppercase font-black italic">Kayıtlı Nesne Bulunmuyor</td></tr>
                ) : (
                  nesneler.map(n => (
                    <tr key={n.id} className="hover:bg-orange-600/5 transition-colors group">
                      <td className="p-5 text-white group-hover:text-orange-400 transition-colors uppercase font-black">{n.nesne_adi}</td>
                      <td className="p-5 text-blue-400 font-mono tracking-wider font-black uppercase">{n.ifs_kodu}</td>
                      <td className="p-5 text-gray-600 text-[9px] text-right font-black uppercase">{new Date(n.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}