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

  // EXCEL OKUMA FONKSİYONU
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      setYukleniyor(true);
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // IFS formatına uygun veriyi hazırla
      // Excel sütun isimlerinizin "Kod" ve "Ad" (veya benzeri) olduğunu varsayıyoruz
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
    <div className="p-10 text-black bg-gray-50 min-h-screen">
      <button onClick={() => router.push('/dashboard')} className="mb-4 text-blue-600 font-bold">← Panele Dön</button>
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">📦 IFS Malzeme Kataloğu</h1>
        
        {/* EXCEL YÜKLEME ALANI */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-blue-200">
          <label className="text-sm font-bold text-gray-600">Excel ile Toplu Yükle:</label>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {yukleniyor && <span className="text-orange-500 animate-pulse font-bold text-sm">İşleniyor...</span>}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-400 text-xs uppercase font-black tracking-widest border-b">
            <tr>
              <th className="p-6">IFS Malzeme Kodu</th>
              <th className="p-6">Malzeme Tanımı (Adı)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {liste.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/30 transition">
                <td className="p-6 font-mono font-bold text-blue-600">{m.malzeme_kodu}</td>
                <td className="p-6 text-gray-700 font-medium">{m.malzeme_adi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}