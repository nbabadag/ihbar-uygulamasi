'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function RaporlarPage() {
  const router = useRouter()
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [raporVerisi, setRaporVerisi] = useState<any[]>([])
  const [izlendi, setIzlendi] = useState(false)

  // Canlı Filtre State'leri
  const [personelFiltre, setPersonelFiltre] = useState('')
  const [aciklamaFiltre, setAciklamaFiltre] = useState('')
  const [konuFiltre, setKonuFiltre] = useState('')

  // Admin Kontrolü
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'Admin') router.push('/dashboard')
    }
    checkAdmin()
  }, [router])

  // Veritabanından Sorgulama
  const raporuSorgula = async () => {
    if (!baslangic || !bitis) return alert("Lütfen tarih aralığı seçin!")
    setYukleniyor(true)
    setIzlendi(false)

    const { data, error } = await supabase
      .from('ihbarlar')
      .select(`
        *,
        profiles!atanan_personel (full_name),
        ihbar_malzemeleri (id, malzeme_kodu, malzeme_adi, kullanim_adedi)
      `)
      .eq('durum', 'Tamamlandi')
      .gte('kapatma_tarihi', baslangic)
      .lte('kapatma_tarihi', bitis)

    if (error) {
      alert("Hata: " + error.message)
    } else {
      setRaporVerisi(data || [])
      setIzlendi(true)
    }
    setYukleniyor(false)
  }

  // Akıllı Üçlü Filtreleme
  const filtrelenmisVeri = useMemo(() => {
    return raporVerisi.filter(ihbar => {
      const pMatch = (ihbar.profiles?.full_name || "").toLowerCase().includes(personelFiltre.toLowerCase())
      const aMatch = (ihbar.aciklama || "").toLowerCase().includes(aciklamaFiltre.toLowerCase())
      const kMatch = (ihbar.konu || "").toLowerCase().includes(konuFiltre.toLowerCase())
      return pMatch && aMatch && kMatch
    })
  }, [raporVerisi, personelFiltre, aciklamaFiltre, konuFiltre])

  // Filtrelenmiş Veriyi Excel Yapma
  const excelIndir = () => {
    if (filtrelenmisVeri.length === 0) return
    const excelHazirlik = filtrelenmisVeri.flatMap(ihbar => {
      const temel = {
        "IFS İş Emri No": ihbar.ifs_is_emri_no,
        "Personel": ihbar.profiles?.full_name || "-",
        "Müşteri": ihbar.musteri_adi,
        "Konu": ihbar.konu,
        "İhbar Açıklaması": ihbar.aciklama,
        "Kapatma Tarihi": new Date(ihbar.kapatma_tarihi).toLocaleDateString('tr-TR'),
        "Bitiş Saati": ihbar.bitis_saati
      }
      if (ihbar.ihbar_malzemeleri.length === 0) return [{ ...temel, "Malzeme": "Yok", "Adet": 0 }]
      return ihbar.ihbar_malzemeleri.map((m: any) => ({
        ...temel,
        "Malzeme": m.malzeme_adi,
        "Adet": m.kullanim_adedi
      }))
    })
    const ws = XLSX.utils.json_to_sheet(excelHazirlik)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Filtreli Rapor")
    XLSX.writeFile(wb, `IFS_Saha_Raporu_${new Date().toLocaleDateString()}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex text-black">
      {/* Sol Menü */}
      <div className="w-64 bg-blue-900 text-white p-6 shadow-xl flex flex-col fixed h-full">
        <h2 className="text-xl font-bold mb-8 italic underline decoration-blue-400 tracking-wider uppercase">İhbar Paneli</h2>
        <nav className="space-y-4 flex-1 font-bold">
          <div onClick={() => router.push('/dashboard')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition flex items-center gap-2">🏠 Ana Sayfa</div>
          <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 bg-blue-800 rounded-lg cursor-pointer shadow-md flex items-center gap-2 font-black">📊 Raporlama</div>
        </nav>
        <button onClick={() => router.push('/dashboard')} className="w-full bg-blue-700 p-3 rounded-lg hover:bg-blue-800 transition font-bold text-sm">← Geri Dön</button>
      </div>

      <div className="flex-1 p-10 ml-64 font-bold">
        <header className="mb-10 border-b pb-5">
          <h1 className="text-3xl font-bold text-gray-800">📊 Rapor Önizleme ve Filtreleme</h1>
        </header>

        {/* Sorgu Paneli */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-end gap-4 mb-6">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Başlangıç</label>
            <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bitiş</label>
            <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" value={bitis} onChange={e => setBitis(e.target.value)} />
          </div>
          <button onClick={raporuSorgula} className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 font-black transition-all active:scale-95">{yukleniyor ? '...' : 'SORGULA'}</button>
        </div>

        {/* Canlı Filtreleme Paneli (Sadece Sorgu Sonrası Görünür) */}
        {izlendi && (
          <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-in slide-in-from-top duration-300">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-500 uppercase">👤 Personel</label>
              <input type="text" placeholder="İsim ara..." className="w-full p-3 bg-blue-50/50 border rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-200" value={personelFiltre} onChange={e => setPersonelFiltre(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-500 uppercase">📋 Konu</label>
              <input type="text" placeholder="Konu ara..." className="w-full p-3 bg-blue-50/50 border rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-200" value={konuFiltre} onChange={e => setKonuFiltre(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-500 uppercase">📝 Açıklama</label>
              <input type="text" placeholder="İçerik ara..." className="w-full p-3 bg-blue-50/50 border rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-200" value={aciklamaFiltre} onChange={e => setAciklamaFiltre(e.target.value)} />
            </div>
          </div>
        )}

        {/* Önizleme Tablosu */}
        {izlendi && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 bg-gray-50 flex justify-between items-center border-b">
              <span className="text-sm font-black text-gray-500 uppercase">Bulunan Sonuç: <span className="text-blue-600">{filtrelenmisVeri.length}</span></span>
              <button onClick={excelIndir} className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 text-xs font-black shadow-lg flex items-center gap-2">📥 EXCEL İNDİR</button>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white shadow-sm text-[10px] uppercase text-gray-400 font-black">
                  <tr>
                    <th className="p-4">İş Emri</th>
                    <th className="p-4">Personel</th>
                    <th className="p-4">Konu</th>
                    <th className="p-4">İhbar Açıklaması</th>
                    <th className="p-4">Malzemeler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrelenmisVeri.map(ihbar => (
                    <tr key={ihbar.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-mono text-blue-600 font-bold">{ihbar.ifs_is_emri_no}</td>
                      <td className="p-4 whitespace-nowrap">👤 {ihbar.profiles?.full_name}</td>
                      <td className="p-4 font-black text-[10px] uppercase tracking-tighter"><span className="bg-gray-100 px-2 py-1 rounded-md">{ihbar.konu}</span></td>
                      <td className="p-4 text-xs italic text-gray-600 leading-relaxed">"{ihbar.aciklama}"</td>
                      <td className="p-4">
                      {ihbar.ihbar_malzemeleri.map((m: any, index: number) => (
  // Key değerini m.id ve index birleşimi yaparak benzersiz kılıyoruz
  <div key={`${m.id}-${index}`} className="text-[9px] bg-orange-50 ...">
    {m.kullanim_adedi}x {m.malzeme_adi}
  </div>
))}
                      </td>
                    </tr>
                  ))}
                  {filtrelenmisVeri.length === 0 && (
                    <tr><td colSpan={5} className="p-10 text-center text-gray-400 italic font-medium">Aradığınız kriterlere uygun kayıt bulunamadı.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}