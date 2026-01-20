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
  const [authYukleniyor, setAuthYukleniyor] = useState(true)

  // Canlı Filtre State'leri
  const [personelFiltre, setPersonelFiltre] = useState('')
  const [aciklamaFiltre, setAciklamaFiltre] = useState('')
  const [konuFiltre, setKonuFiltre] = useState('')

  // Yetki Kontrolü
  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return; }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        const role = profile?.role?.trim();
        const yetkiliRoller = ['Admin', 'Müdür', 'Mühendis-Yönetici', 'Formen'];
        
        if (!yetkiliRoller.includes(role)) {
          router.push('/dashboard')
          return
        }
        setAuthYukleniyor(false)
      } catch (err) { router.push('/dashboard') }
    }
    checkUserAccess()
  }, [router])

  // Gelişmiş Rapor Sorgusu
  const raporuSorgula = async () => {
    if (!baslangic || !bitis) return alert("Lütfen tarih aralığı seçin!")
    setYukleniyor(true)
    setIzlendi(false)

    const { data, error } = await supabase
      .from('ihbarlar')
      .select(`
        *,
        profiles (full_name),
        ihbar_malzemeleri (id, malzeme_kodu, malzeme_adi, kullanim_adedi)
      `)
      .eq('durum', 'Tamamlandi')
      .gte('kapatma_tarihi', baslangic)
      .lte('kapatma_tarihi', bitis)

    if (error) {
      alert("Sorgu Hatası: " + error.message)
    } else {
      setRaporVerisi(data || [])
      setIzlendi(true)
    }
    setYukleniyor(false)
  }

  // Canlı Kelime Filtreleme Mantığı
  const filtrelenmisVeri = useMemo(() => {
    return raporVerisi.filter(ihbar => {
      const pMatch = (ihbar.profiles?.full_name || "").toLowerCase().includes(personelFiltre.toLowerCase())
      const aMatch = (ihbar.aciklama || "").toLowerCase().includes(aciklamaFiltre.toLowerCase())
      const kMatch = (ihbar.konu || "").toLowerCase().includes(konuFiltre.toLowerCase())
      return pMatch && aMatch && kMatch
    })
  }, [raporVerisi, personelFiltre, aciklamaFiltre, konuFiltre])

  // Zaman Formatlayıcı
  const formatTime = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const excelIndir = () => {
    if (filtrelenmisVeri.length === 0) return
    
    const excelHazirlik = filtrelenmisVeri.flatMap(ihbar => {
      const temel = {
        "İş Emri No (IFS)": ihbar.ifs_is_emri_no || "YOK",
        "Müşteri Adı": ihbar.musteri_adi,
        "İhbar Konusu": ihbar.konu,
        "İhbar Detayı": ihbar.aciklama,
        "Sorumlu Personel": ihbar.profiles?.full_name || "-",
        "İhbar Açılış Zamanı": formatTime(ihbar.created_at),
        "Atama Zamanı": formatTime(ihbar.atama_tarihi), // Veritabanında bu sütun olmalı
        "İşe Başlama Zamanı": formatTime(ihbar.kabul_tarihi),
        "İş Bitiş Zamanı": formatTime(ihbar.kapatma_tarihi),
        "İşlem Sonu Detayı (Not)": ihbar.personel_notu || "-",
      }

      // Malzemeleri yan yana veya alt alta ekleme
      if (!ihbar.ihbar_malzemeleri || ihbar.ihbar_malzemeleri.length === 0) {
        return [{ ...temel, "Kullanılan Malzeme": "YOK", "Miktar": 0 }]
      }
      
      return ihbar.ihbar_malzemeleri.map((m: any) => ({
        ...temel,
        "Kullanılan Malzeme": m.malzeme_adi,
        "Miktar": m.kullanim_adedi
      }))
    })

    const ws = XLSX.utils.json_to_sheet(excelHazirlik)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Saha 360 Detaylı Rapor")
    XLSX.writeFile(wb, `Saha360_Detayli_Rapor_${baslangic}_${bitis}.xlsx`)
  }

  if (authYukleniyor) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-black font-black italic animate-pulse">YETKİ KONTROL EDİLİYOR...</div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-black font-sans">
      {/* SOL MENÜ */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full z-50">
        <h2 className="text-xl font-black mb-8 italic text-blue-100 tracking-tighter uppercase">SAHA 360</h2>
        <nav className="space-y-3 flex-1 font-bold text-sm">
          <div onClick={() => router.push('/dashboard')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition flex items-center gap-2">🏠 Ana Sayfa</div>
          <div className="p-3 bg-blue-700 rounded-xl flex items-center gap-2 border-l-4 border-blue-300 shadow-inner">📊 Raporlama</div>
        </nav>
      </div>

      <div className="flex-1 p-4 md:p-10 md:ml-64 font-bold">
        <header className="mb-6 border-b pb-5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 italic uppercase leading-none">Detaylı Operasyon Raporu</h1>
            <p className="text-[10px] text-gray-400 mt-2 tracking-widest uppercase italic">Zaman ve Malzeme Analiz Paneli</p>
          </div>
          <button onClick={excelIndir} disabled={!izlendi} className={`hidden md:flex bg-green-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase italic gap-2 shadow-lg transition-all active:scale-95 ${!izlendi && 'opacity-30'}`}>
            📥 Excel Olarak İndir
          </button>
        </header>

        {/* Sorgu Kriterleri */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Başlangıç Tarihi</label>
            <input type="date" className="w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none focus:border-blue-500 text-black font-bold" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Bitiş Tarihi</label>
            <input type="date" className="w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none focus:border-blue-500 text-black font-bold" value={bitis} onChange={e => setBitis(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={raporuSorgula} className="w-full bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 font-black transition-all shadow-xl active:scale-95 uppercase italic text-xs">
              {yukleniyor ? 'VERİLER İŞLENİYOR...' : 'ANALİZİ BAŞLAT'}
            </button>
          </div>
        </div>

        {izlendi && (
          <div className="space-y-6">
            {/* Canlı Kelime Filtreleri */}
            <div className="bg-blue-900 p-6 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-3 gap-4 shadow-2xl border-4 border-white">
              <input type="text" placeholder="👤 Personel İsmi..." className="p-4 bg-blue-800 text-white placeholder-blue-300 border-none rounded-2xl outline-none text-xs font-bold shadow-inner" value={personelFiltre} onChange={e => setPersonelFiltre(e.target.value)} />
              <input type="text" placeholder="📋 Konu Başlığı..." className="p-4 bg-blue-800 text-white placeholder-blue-300 border-none rounded-2xl outline-none text-xs font-bold shadow-inner" value={konuFiltre} onChange={e => setKonuFiltre(e.target.value)} />
              <input type="text" placeholder="📝 Açıklama İçeriği..." className="p-4 bg-blue-800 text-white placeholder-blue-300 border-none rounded-2xl outline-none text-xs font-bold shadow-inner" value={aciklamaFiltre} onChange={e => setAciklamaFiltre(e.target.value)} />
            </div>

            {/* Sonuç Tablosu */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden text-black">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black uppercase text-gray-400 border-b bg-gray-50/50">
                      <th className="p-6">İş Emri & Müşteri</th>
                      <th className="p-6">Sorumlu Personel</th>
                      <th className="p-6">Zaman Çizelgesi (Açılış/Atama/Başlama/Bitiş)</th>
                      <th className="p-6">İhbar/İşlem Detayı</th>
                      <th className="p-6 text-right">Malzeme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrelenmisVeri.map(ihbar => (
                      <tr key={ihbar.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-6">
                          <div className="text-blue-600 font-black text-xs italic tracking-tighter">#{ihbar.ifs_is_emri_no || 'YOK'}</div>
                          <div className="text-sm font-black text-gray-800 uppercase mt-1 leading-tight">{ihbar.musteri_adi}</div>
                        </td>
                        <td className="p-6">
                           <div className="font-black text-xs uppercase text-gray-700">{ihbar.profiles?.full_name}</div>
                        </td>
                        <td className="p-6">
                          <div className="space-y-1 text-[10px] font-bold">
                            <div className="flex justify-between gap-4"><span className="text-gray-400">AÇILIŞ:</span> <span>{formatTime(ihbar.created_at)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-400">ATAMA:</span> <span>{formatTime(ihbar.atama_tarihi || ihbar.created_at)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-blue-500">BAŞLAMA:</span> <span>{formatTime(ihbar.kabul_tarihi)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-green-600">BİTİŞ:</span> <span>{formatTime(ihbar.kapatma_tarihi)}</span></div>
                          </div>
                        </td>
                        <td className="p-6 max-w-xs">
                          <div className="bg-gray-100 p-2 rounded-lg text-[10px] mb-2 font-black italic">KONU: {ihbar.konu}</div>
                          <div className="text-[10px] text-gray-500 italic">İhbar: "{ihbar.aciklama}"</div>
                          <div className="text-[10px] text-blue-900 font-black mt-2 bg-blue-50 p-2 rounded-lg">Sonuç: "{ihbar.personel_notu || '-'}"</div>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex flex-col gap-1 items-end">
                            {ihbar.ihbar_malzemeleri?.map((m: any, idx: number) => (
                              <span key={idx} className="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded-md uppercase whitespace-nowrap">
                                {m.kullanim_adedi}x {m.malzeme_adi}
                              </span>
                            )) || <span className="text-[9px] text-gray-300 italic font-bold">YOK</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}