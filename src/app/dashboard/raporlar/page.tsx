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
  const [authYukleniyor, setAuthYukleniyor] = useState(true) // Yetki kontrolü için

  // Canlı Filtre State'leri
  const [personelFiltre, setPersonelFiltre] = useState('')
  const [aciklamaFiltre, setAciklamaFiltre] = useState('')
  const [konuFiltre, setKonuFiltre] = useState('')

  // Gelişmiş Admin/Müdür Kontrolü
  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error || !profile) {
          console.error("Profil bulunamadı");
          router.push('/dashboard')
          return
        }

        // Yetkili roller listesi
        const yetkiliRoller = ['Admin', 'Müdür', 'Yönetici', 'Mühendis']
        if (!yetkiliRoller.includes(profile.role)) {
          console.warn("Yetkisiz erişim denemesi:", profile.role);
          router.push('/dashboard')
          return
        }

        setAuthYukleniyor(false) // Yetki tamsa sayfayı göster
      } catch (err) {
        router.push('/dashboard')
      }
    }
    checkUserAccess()
  }, [router])

  // Veritabanından Sorgulama
  const raporuSorgula = async () => {
    if (!baslangic || !bitis) return alert("Lütfen tarih aralığı seçin!")
    setYukleniyor(true)
    setIzlendi(false)

    // Sorgu: atanan_personel ilişkisini profiles tablosuyla eşliyoruz
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

  const filtrelenmisVeri = useMemo(() => {
    return raporVerisi.filter(ihbar => {
      const pMatch = (ihbar.profiles?.full_name || "").toLowerCase().includes(personelFiltre.toLowerCase())
      const aMatch = (ihbar.aciklama || "").toLowerCase().includes(aciklamaFiltre.toLowerCase())
      const kMatch = (ihbar.konu || "").toLowerCase().includes(konuFiltre.toLowerCase())
      return pMatch && aMatch && kMatch
    })
  }, [raporVerisi, personelFiltre, aciklamaFiltre, konuFiltre])

  const stats = useMemo(() => {
    if (!filtrelenmisVeri.length) return null;
    const toplamMalzeme = filtrelenmisVeri.reduce((acc, curr) => 
      acc + (curr.ihbar_malzemeleri?.reduce((mAcc: number, mCurr: any) => mAcc + (mCurr.kullanim_adedi || 0), 0) || 0), 0)
    
    const pDagitim = filtrelenmisVeri.reduce((acc: any, curr) => {
      const name = curr.profiles?.full_name || "Bilinmiyor";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    return { toplamMalzeme, pDagitim };
  }, [filtrelenmisVeri]);

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
      if (!ihbar.ihbar_malzemeleri || ihbar.ihbar_malzemeleri.length === 0) 
        return [{ ...temel, "Malzeme": "Yok", "Adet": 0 }]
      
      return ihbar.ihbar_malzemeleri.map((m: any) => ({
        ...temel, "Malzeme": m.malzeme_adi, "Adet": m.kullanim_adedi
      }))
    })
    const ws = XLSX.utils.json_to_sheet(excelHazirlik)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Filtreli Rapor")
    XLSX.writeFile(wb, `IFS_Saha_Raporu_${new Date().toLocaleDateString()}.xlsx`)
  }

  // Yetki kontrolü sürerken yükleniyor ekranı göster
  if (authYukleniyor) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-blue-900 font-black italic animate-pulse">YETKİ KONTROL EDİLİYOR...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-black">
      {/* Sol Menü */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full z-50">
        <h2 className="text-xl font-black mb-8 italic text-blue-100 tracking-tighter uppercase">SAHA 360</h2>
        <nav className="space-y-3 flex-1 font-bold text-sm">
          <div onClick={() => router.push('/dashboard')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer transition flex items-center gap-2">🏠 Ana Sayfa</div>
          <div className="p-3 bg-blue-700 rounded-xl flex items-center gap-2 border-l-4 border-blue-300">📊 Raporlama</div>
        </nav>
      </div>

      <div className="flex-1 p-4 md:p-10 md:ml-64 font-bold">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 italic uppercase">Analitik Rapor Merkezi</h1>
          <div className="text-[10px] bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-black uppercase">Üst Yönetim Paneli</div>
        </header>

        {/* Sorgu Paneli */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Başlangıç</label>
            <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" value={baslangic} onChange={e => setBaslangic(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Bitiş</label>
            <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" value={bitis} onChange={e => setBitis(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={raporuSorgula} className="w-full bg-blue-600 text-white p-3.5 rounded-xl hover:bg-blue-700 font-black transition-all shadow-lg active:scale-95">
              {yukleniyor ? 'SORGULANIYOR...' : 'VERİLERİ GETİR'}
            </button>
          </div>
        </div>

        {izlendi && (
          <div className="animate-in fade-in duration-500">
            {/* KPI Özet Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-lg shadow-blue-100">
                <span className="text-[10px] font-black uppercase opacity-70 italic">Tamamlanan İş</span>
                <div className="text-4xl font-black italic">{filtrelenmisVeri.length}</div>
              </div>
              <div className="bg-emerald-500 text-white p-6 rounded-[2rem] shadow-lg shadow-emerald-100">
                <span className="text-[10px] font-black uppercase opacity-70 italic">Kullanılan Malzeme</span>
                <div className="text-4xl font-black italic">{stats?.toplamMalzeme || 0} <span className="text-sm">Adet</span></div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-100 flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase text-blue-500 italic">Personel Katılımı</span>
                <div className="text-lg font-black text-gray-700 mt-1">{Object.keys(stats?.pDagitim || {}).length} Aktif Usta</div>
              </div>
            </div>

            {/* Canlı Filtreleme */}
            <div className="bg-blue-900 p-6 rounded-[2rem] grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shadow-xl">
              <input type="text" placeholder="👤 Personel..." className="p-3 bg-blue-800 text-white placeholder-blue-300 border-none rounded-xl outline-none text-xs font-bold" value={personelFiltre} onChange={e => setPersonelFiltre(e.target.value)} />
              <input type="text" placeholder="📋 Konu..." className="p-3 bg-blue-800 text-white placeholder-blue-300 border-none rounded-xl outline-none text-xs font-bold" value={konuFiltre} onChange={e => setKonuFiltre(e.target.value)} />
              <input type="text" placeholder="📝 Açıklama..." className="p-3 bg-blue-800 text-white placeholder-blue-300 border-none rounded-xl outline-none text-xs font-bold" value={aciklamaFiltre} onChange={e => setAciklamaFiltre(e.target.value)} />
              <button onClick={() => {setPersonelFiltre(''); setKonuFiltre(''); setAciklamaFiltre('')}} className="bg-blue-700 text-blue-100 p-3 rounded-xl text-[10px] font-black hover:bg-blue-600 uppercase italic">Filtreleri Temizle</button>
            </div>

            {/* Tablo Konteynırı */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden mb-10">
              <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="text-xs font-black uppercase italic text-gray-400 tracking-widest">📋 Rapor Detay Listesi</h3>
                <button onClick={excelIndir} className="bg-green-600 text-white px-6 py-2.5 rounded-full hover:bg-green-700 text-[10px] font-black shadow-lg flex items-center gap-2 uppercase italic transition-transform active:scale-95">
                  📥 Excel'e Aktar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-gray-400 border-b bg-gray-50/50">
                      <th className="p-5">İş Emri</th>
                      <th className="p-5">Personel</th>
                      <th className="p-5">İş Özeti</th>
                      <th className="p-5">Malzemeler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrelenmisVeri.map(ihbar => (
                      <tr key={ihbar.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-5">
                          <div className="text-blue-600 font-black text-sm italic tracking-tighter">#{ihbar.ifs_is_emri_no}</div>
                          <div className="text-[9px] text-gray-400 font-bold">{new Date(ihbar.kapatma_tarihi).toLocaleDateString('tr-TR')}</div>
                        </td>
                        <td className="p-5 whitespace-nowrap">
                          <div className="font-black text-xs uppercase text-gray-700 flex items-center gap-2">
                             <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-sm">{ihbar.profiles?.full_name?.charAt(0)}</div>
                             {ihbar.profiles?.full_name}
                          </div>
                        </td>
                        <td className="p-5 max-w-xs">
                          <div className="bg-gray-100 text-gray-800 text-[9px] px-2 py-0.5 rounded w-fit font-black mb-1 uppercase italic tracking-tighter">{ihbar.konu}</div>
                          <div className="text-[11px] text-gray-500 italic leading-tight line-clamp-2">"{ihbar.aciklama}"</div>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-wrap gap-1">
                            {ihbar.ihbar_malzemeleri && ihbar.ihbar_malzemeleri.length > 0 ? (
                              ihbar.ihbar_malzemeleri.map((m: any, idx: number) => (
                                <span key={`${m.id}-${idx}`} className="text-[8px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded-md uppercase border border-orange-200">
                                  {m.kullanim_adedi}x {m.malzeme_adi}
                                </span>
                              ))
                            ) : (
                              <span className="text-[8px] text-gray-300 italic font-bold">Malzeme Kullanılmadı</span>
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
        )}
      </div>
    </div>
  )
}