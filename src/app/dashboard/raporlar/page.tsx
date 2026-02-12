// Guncelleme: 12 Subat - Rapor Sistemi (Dinamik Analiz & Temiz Etiket Modu)
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts'

export default function Raporlar() {
  const router = useRouter()
  const [rawData, setRawData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSorgulandi, setIsSorgulandi] = useState(false)
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedNesneler, setSelectedNesneler] = useState<string[]>([])
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => { fetchInitialData() }, [])

  const fetchInitialData = async () => {
    const { data } = await supabase.from('ihbarlar').select('secilen_nesne_adi')
    if (data) {
      const uniqueNesneler = Array.from(new Set(data.map(i => i.secilen_nesne_adi).filter(Boolean))) as string[]
      setRawData(data)
      setSelectedNesneler(uniqueNesneler.filter(n => n.toUpperCase() !== 'DİĞER' && n.toUpperCase() !== 'DIGER'))
    }
    setLoading(false)
  }

  const handleSorgula = async () => {
    setLoading(true)
    const { data } = await supabase.from('ihbarlar').select('*').order('created_at', { ascending: false })
    if (data) {
      setRawData(data)
      setIsSorgulandi(true)
    }
    setLoading(false)
  }

  const tumNesneListesi = useMemo(() => {
    return Array.from(new Set(rawData.map(i => i.secilen_nesne_adi).filter(Boolean))).sort() as string[]
  }, [rawData])

  const filteredData = useMemo(() => {
    if (!isSorgulandi) return []
    return rawData.filter(i => {
      if (!selectedNesneler.includes(i.secilen_nesne_adi)) return false
      if (startDate && endDate) {
        const itemDate = new Date(i.created_at).getTime()
        const start = new Date(startDate).getTime()
        const end = new Date(endDate).setHours(23, 59, 59, 999)
        return itemDate >= start && itemDate <= end
      }
      return true
    })
  }, [rawData, startDate, endDate, selectedNesneler, isSorgulandi])

  const stats = useMemo(() => {
    const finished = filteredData.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi')
    const total = finished.length
    const totalMin = finished.reduce((acc, curr) => acc + (curr.calisma_suresi_dakika || 0), 0)
    const avgTime = total > 0 ? Math.round(totalMin / total) : 0
    const counts: any = {}
    finished.forEach(i => { counts[i.secilen_nesne_adi] = (counts[i.secilen_nesne_adi] || 0) + 1 })
    const bottleneck = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '-'
    const efficiency = total > 0 ? Math.round((finished.filter((curr: any) => (curr.calisma_suresi_dakika || 0) < 1440).length / total) * 100) : 0
    return { total, avgTime, bottleneck, efficiency }
  }, [filteredData])

  const equipmentStats = useMemo(() => {
    return filteredData.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi').reduce((acc: any, curr) => {
      const key = curr.secilen_nesne_adi;
      if (!acc[key]) acc[key] = { name: key, count: 0, totalTime: 0 };
      acc[key].count += 1;
      acc[key].totalTime += (curr.calisma_suresi_dakika || 0);
      return acc;
    }, {});
  }, [filteredData])

  const scatterData = useMemo(() => {
    return Object.values(equipmentStats).map((e: any) => ({
      name: e.name,
      arıza: e.count,
      süre: Math.round(e.totalTime / e.count),
      etki: e.count
    })).sort((a:any, b:any) => b.süre - a.süre);
  }, [equipmentStats])

  const excelIndir = () => {
    const wb = XLSX.utils.book_new()
    const enCokAriza = stats.bottleneck;
    const kritikDarboğazlar = scatterData
      .filter((e: any) => e.süre > stats.avgTime * 1.3)
      .map((e: any) => e.name)
      .slice(0, 3)
      .join(", ");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredData), "1-TUM_KAYITLAR")
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.keys(equipmentStats).map(name => ({
      "Ekipman Adı": name, 
      "Risk Skoru (%)": Math.min(equipmentStats[name].count * 12, 98), 
      "Kalan Ömür Tahmini (Gün)": Math.max(30 - (equipmentStats[name].count * 2), 3)
    }))), "2-AI_TAHMINLERI")
    
    const atolye = [
      { Atolye: 'ELEKTRİK', Adet: filteredData.filter(d => String(d.is_istasyonu).includes('201')).length },
      { Atolye: 'MEKANİK', Adet: filteredData.filter(d => String(d.is_istasyonu).includes('202')).length },
      { Atolye: 'BİNA', Adet: filteredData.filter(d => String(d.is_istasyonu).includes('204')).length }
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(atolye), "3-ATOLYE_YUKU")
    
    const darbogazTablosu = scatterData.map((e: any) => ({
      "Ekipman Adı": e.name,
      "Arıza Sayısı": e.arıza,
      "Ort. Onarım Süresi (Dk)": e.süre,
      "İş Yükü Etkisi": e.etki
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(darbogazTablosu), "4-DARBOGAZ_ANALIZI")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scatterData.slice(0, 10)), "5-KRITIK_VARLIKLAR")
    
    const ozet = [["METRİK", "DEĞER"], ["Toplam İhbar", stats.total], ["MTTR (Ort. Onarım)", stats.avgTime + " dk"], ["Saha Verimliliği", "%" + stats.efficiency]]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozet), "6-OZET_KPI")

    const yorumlar = [
      ["SAHA 360 - OTOMATİK OPERASYONEL ANALİZ RAPORU"],
      ["--------------------------------------------------"],
      ["1. EKİPMAN SAĞLIĞI VE ARIZA YOĞUNLUĞU:"],
      [`Seçilen kriterlere göre en yüksek arıza frekansına sahip ekipman: ${enCokAriza}.`],
      [""],
      ["2. DARBOĞAZ ANALİZİ (MTTR):"],
      [`Saha genelinde ortalama onarım süresi ${stats.avgTime} dakikadır.`],
      [kritikDarboğazlar ? `${kritikDarboğazlar} ekipmanları ortalamanın üzerinde onarım süresi gerektirmektedir.` : "Kritik bir süre darboğazı saptanmamıştır."],
      [""],
      [`Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}`]
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(yorumlar), "7-AKILLI_YORUMLAR")

    XLSX.writeFile(wb, `Saha360_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading) return <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center text-orange-500 font-black italic uppercase">VERİLER HAZIRLANIYOR...</div>

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-6 md:p-12 font-black uppercase italic">
      <div className="max-w-[1600px] mx-auto space-y-10">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 border-b-2 border-orange-500 pb-8">
          <h1 className="text-4xl tracking-tighter">SAHA <span className="text-orange-500 text-outline">ANALİTİK</span></h1>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={() => setShowFilter(!showFilter)} className="bg-[#111318] border border-gray-800 px-6 py-4 rounded-2xl text-[10px]">⚙️ NESNELER ({selectedNesneler.length})</button>
            {showFilter && (
              <div className="absolute top-24 right-48 w-80 max-h-96 bg-[#111318] border border-gray-800 rounded-3xl p-6 z-[100] overflow-y-auto">
                {tumNesneListesi.map(n => (
                  <label key={n} className="flex items-center gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" checked={selectedNesneler.includes(n)} onChange={(e) => e.target.checked ? setSelectedNesneler([...selectedNesneler, n]) : setSelectedNesneler(selectedNesneler.filter(x => x !== n))} className="accent-orange-500" />
                    <span className="text-[9px]">{n}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 bg-[#111318] p-4 rounded-3xl border border-gray-800">
              <input type="date" className="bg-transparent text-[10px]" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" className="bg-transparent text-[10px]" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button onClick={handleSorgula} className="bg-orange-600 px-8 py-2 rounded-2xl text-[10px]">SORGULA</button>
            </div>
            {isSorgulandi && <button onClick={excelIndir} className="bg-green-600 px-6 py-4 rounded-2xl text-[10px]">📊 EXCEL İNDİR</button>}
            <button onClick={() => router.push('/dashboard')} className="bg-gray-800 px-6 py-4 rounded-2xl text-[10px]">GERİ</button>
          </div>
        </div>

        {isSorgulandi ? (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-orange-600">
                <p className="text-[10px] text-gray-500 mb-2">TOPLAM İŞ</p>
                <h2 className="text-5xl text-orange-500">{stats.total}</h2>
              </div>
              <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-blue-500">
                <p className="text-[10px] text-gray-500 mb-2">ORT. SÜRE (DK)</p>
                <h2 className="text-5xl text-blue-500">{stats.avgTime}</h2>
              </div>
              <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-green-500">
                <p className="text-[10px] text-gray-500 mb-2">VERİMLİLİK</p>
                <h2 className="text-5xl text-green-500">%{stats.efficiency}</h2>
              </div>
              <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-red-500">
                <p className="text-[10px] text-gray-500 mb-2">DARBOĞAZ</p>
                <h2 className="text-sm text-red-500 truncate mt-2">{stats.bottleneck}</h2>
              </div>
            </div>

            <div className="w-full bg-[#111318] p-10 rounded-[3rem] border border-blue-500/10 min-h-[600px]">
              <h3 className="text-xs mb-10 border-l-4 border-blue-500 pl-4 tracking-widest uppercase">Darboğaz Analizi (Arıza Sıklığı vs Ortalama Süre)</h3>
             <ResponsiveContainer width="100%" height={500}>
  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
    <CartesianGrid stroke="#222" vertical={false} />
    
    {/* Eksen yazıları (tick) ve etiketleri (label) için fill="#fff" ekledik */}
    <XAxis 
      type="number" 
      dataKey="arıza" 
      name="ARIZA SAYISI" 
      stroke="#888" 
      fontSize={12} 
      tick={{ fill: '#fff' }} 
      label={{ value: 'ARIZA SAYISI', position: 'insideBottomRight', offset: -10, fill: '#ffa500', fontSize: 10 }}
    />
    <YAxis 
      type="number" 
      dataKey="süre" 
      name="ORT. ONARIM (DK)" 
      stroke="#888" 
      fontSize={12} 
      tick={{ fill: '#fff' }}
      label={{ value: 'ORT. ONARIM (DK)', angle: -90, position: 'insideLeft', fill: '#ffa500', fontSize: 10 }}
    />
    
    <ZAxis type="number" dataKey="etki" name="İŞ YÜKÜ ETKİSİ" range={[200, 2000]} />
    
    <Tooltip 
      cursor={{ strokeDasharray: '3 3' }} 
      contentStyle={{ backgroundColor: '#111318', border: '2px solid #ffa500', borderRadius: '15px', color: '#fff' }}
      itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
    />
    
    <Scatter data={scatterData}>
      {scatterData.map((entry, index) => (
        <Cell 
          key={index} 
          fill={entry.süre > stats.avgTime * 1.5 ? '#ef4444' : '#3b82f6'} 
        />
      ))}
    </Scatter>
  </ScatterChart>
</ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-[4rem] opacity-30">
            <span className="text-6xl mb-4">🔍</span>
            <p className="text-xs tracking-[0.5em]">ANALİZ İÇİN KRİTERLERİ SEÇİP SORGULA BUTONUNA BASIN</p>
          </div>
        )}
      </div>
    </div>
  )
}