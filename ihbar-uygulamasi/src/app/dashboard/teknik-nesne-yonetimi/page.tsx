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
  
  // Düzenleme State'leri
  const [editId, setEditId] = useState<string | null>(null)
  const [editNesneAdi, setEditNesneAdi] = useState('')
  const [editIfsKod, setEditIfsKod] = useState('')

  const normalizedRole = userRole.trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'MÜDÜR' || normalizedRole === 'MUDUR';
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

  const nesneEkle = async () => {
    if (!nesneAdi || !ifsKodu) return alert("Lütfen Nesne Adı ve IFS Kodunu giriniz!")
    const { error } = await supabase.from('teknik_nesneler').insert([{ 
      nesne_adi: nesneAdi.toUpperCase(), 
      ifs_kod: ifsKodu.toUpperCase() 
    }])
    if (error) alert("Hata: " + error.message)
    else { setNesneAdi(''); setIfsKodu(''); fetchNesneler() }
  }

  // --- 📝 DÜZENLEME FONKSİYONU ---
  const nesneGuncelle = async (id: string) => {
    if (!editNesneAdi || !editIfsKod) return alert("Alanlar boş bırakılamaz!")
    const { error } = await supabase
      .from('teknik_nesneler')
      .update({ nesne_adi: editNesneAdi.toUpperCase(), ifs_kod: editIfsKod.toUpperCase() })
      .eq('id', id)

    if (error) alert("Güncelleme Hatası: " + error.message)
    else { setEditId(null); fetchNesneler() }
  }

  // --- 🗑️ SİLME FONKSİYONU ---
  const nesneSil = async (id: string, ad: string) => {
    if (!isAdmin) return alert("Silme yetkisi sadece Admin/Müdür rollerine aittir.")
    if (!window.confirm(`${ad} envanterden tamamen silinecek? Emin misiniz?`)) return
    
    const { error } = await supabase.from('teknik_nesneler').delete().eq('id', id)
    if (error) alert("Silme Hatası: Bu nesneye bağlı ihbarlar olabilir.")
    else fetchNesneler()
  }

  const handleExcelUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const eklenecekler = data.slice(1).map((row: any) => ({
        nesne_adi: String(row[0] || '').toUpperCase().trim(),
        ifs_kod: String(row[1] || '').toUpperCase().trim()
      })).filter(item => item.nesne_adi !== '' && item.ifs_kod !== '');

      const { error } = await supabase.from('teknik_nesneler').upsert(eklenecekler, { onConflict: 'ifs_kod' });
      if (error) alert("Excel Yükleme Hatası: " + error.message);
      else { alert(`${eklenecekler.length} adet nesne işlendi.`); fetchNesneler(); }
    };
    reader.readAsBinaryString(file);
  };

  if (!yetkiliMi && userRole !== '') return <div className="p-10 text-red-500 font-black italic bg-[#0a0b0e] h-screen uppercase">YETKİNİZ YOK</div>

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white p-4 md:p-8 font-black uppercase italic relative overflow-hidden">
      <div className="fixed inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
        <img src="/logo.png" className="w-1/2 grayscale invert" />
      </div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8 bg-[#111318]/90 backdrop-blur-md p-6 rounded-3xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl text-orange-500 tracking-tighter">SAHA 360 // Teknik Nesne Yönetimi</h1>
            <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">Envanter Düzenleme ve Kontrol MERKEZİ</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-gray-800 hover:bg-orange-600 px-6 py-3 rounded-2xl text-[10px] transition-all">← GERİ</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-[#111318] p-6 rounded-[2rem] border border-gray-800 shadow-xl">
            <h3 className="text-orange-500 text-[9px] mb-4 tracking-widest">✍️ MANUEL KAYIT</h3>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="NESNE ADI" className="p-4 bg-black border border-gray-800 rounded-xl text-[11px] outline-none focus:border-orange-500" value={nesneAdi} onChange={e => setNesneAdi(e.target.value)} />
              <input placeholder="IFS KODU" className="p-4 bg-black border border-gray-800 rounded-xl text-[11px] outline-none focus:border-blue-500" value={ifsKodu} onChange={e => setIfsKodu(e.target.value)} />
              <button onClick={nesneEkle} className="col-span-2 bg-orange-600 hover:bg-orange-700 p-4 rounded-xl text-[11px] transition-all active:scale-95 shadow-lg shadow-orange-900/20">SİSTEME İŞLE</button>
            </div>
          </div>

          <div className="bg-[#111318] p-6 rounded-[2rem] border border-blue-500/20 shadow-xl flex flex-col justify-center items-center text-center">
            <label className="w-full cursor-pointer bg-blue-600/5 border-2 border-dashed border-blue-500/20 p-6 rounded-2xl hover:bg-blue-600/10 transition-all border-blue-500/40">
              <span className="text-2xl block mb-1">📁</span>
              <span className="text-[9px] text-blue-400">EXCEL TOPLU AKTARIM</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
            </label>
          </div>
        </div>

        <div className="bg-[#111318] rounded-[2rem] border border-gray-800 overflow-hidden shadow-2xl">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-black sticky top-0 z-10 text-orange-500 italic">
                <tr>
                  <th className="p-5">NESNE TANIMI</th>
                  <th className="p-5">IFS KODU</th>
                  <th className="p-5 text-right tracking-widest">Düzenle / Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {nesneler.map(n => (
                  <tr key={n.id} className="hover:bg-white/5 transition-all group">
                    <td className="p-5">
                      {editId === n.id ? (
                        <input className="bg-black border border-orange-500 p-2 rounded w-full text-white outline-none" value={editNesneAdi} onChange={e => setEditNesneAdi(e.target.value)} />
                      ) : (
                        <span className="text-white font-black">{n.nesne_adi}</span>
                      )}
                    </td>
                    <td className="p-5">
                      {editId === n.id ? (
                        <input className="bg-black border border-blue-500 p-2 rounded w-full text-blue-400 outline-none" value={editIfsKod} onChange={e => setEditIfsKod(e.target.value)} />
                      ) : (
                        <span className="text-blue-400 font-mono tracking-tighter">{n.ifs_kod}</span>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2">
                        {editId === n.id ? (
                          <>
                            <button onClick={() => nesneGuncelle(n.id)} className="bg-green-600 px-3 py-1.5 rounded-lg text-[9px] hover:bg-green-700">KAYDET</button>
                            <button onClick={() => setEditId(null)} className="bg-gray-700 px-3 py-1.5 rounded-lg text-[9px]">İPTAL</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(n.id); setEditNesneAdi(n.nesne_adi); setEditIfsKod(n.ifs_kod); }} className="p-2 hover:bg-blue-600/20 rounded-lg text-blue-400 transition-all">✏️</button>
                            {isAdmin && (
                              <button onClick={() => nesneSil(n.id, n.nesne_adi)} className="p-2 hover:bg-red-600/20 rounded-lg text-red-500 transition-all">🗑️</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}