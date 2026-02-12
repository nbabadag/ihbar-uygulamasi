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
  const [isSorgulandi, setIsSorgulandi] = useState(false) // 🚀 Sorgu kontrolü
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedNesneler, setSelectedNesneler] = useState<string[]>([])
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => { fetchInitialData() }, [])

  const fetchInitialData = async () => {
    const { data: ihbarlar } = await supabase.from('ihbarlar').select('secilen_nesne_adi');
    if (ihbarlar) {
      const uniqueNesneler = Array.from(new Set(ihbarlar.map(i => i.secilen_nesne_adi).filter(Boolean))) as string[];
      setRawData(ihbarlar);
      setSelectedNesneler(uniqueNesneler.filter(n => n.toUpperCase() !== 'DİĞER' && n.toUpperCase() !== 'DIGER'));
    }
    setLoading(false);
  }

  // 🚀 SORGULA BUTONU FONKSİYONU
  const handleSorgula = async () => {
    setLoading(true);
    const { data } = await supabase.from('ihbarlar').select('*').order('created_at', { ascending: false });
    if (data) {
      setRawData(data);
      setIsSorgulandi(true);
    }
    setLoading(false);
  }

  const tumNesneListesi = useMemo(() => {
    return Array.from(new Set(rawData.map(i => i.secilen_nesne_adi).filter(Boolean))).sort() as string[];
  }, [rawData]);

  const filteredData = useMemo(() => {
    if (!isSorgulandi) return [];
    return rawData.filter(i => {
      if (!selectedNesneler.includes(i.secilen_nesne_adi)) return false;
      if (startDate && endDate) {
        const itemDate = new Date(i.created_at).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      }
      return true;
    });
  }, [rawData, startDate, endDate, selectedNesneler, isSorgulandi]);

  // --- ANALİZ MANTIKLARI ---
  const stats = useMemo(() => {
    const finished = filteredData.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi');
    const total = finished.length;
    const totalMin = finished.reduce((acc, curr) => acc + (curr.calisma_suresi_dakika || 0), 0);
    const avgTime = total > 0 ? Math.round(totalMin / total) : 0;
    const counts: any = {};
    finished.forEach(i => { counts[i.secilen_nesne_adi] = (counts[i.secilen_nesne_adi] || 0) + 1 });
    const bottleneck = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '-';
    const efficiency = total > 0 ? Math.round((finished.filter(i => (curr:any) => (curr.calisma_suresi_dakika || 0) < 1440).length / total) * 100) : 0;
    return { total, avgTime, bottleneck, efficiency };
  }, [filteredData]);

  const equipmentStats = useMemo(() => {
    return filteredData.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi').reduce((acc: any, curr) => {
      const key = curr.secilen_nesne_adi;
      if (!acc[key]) acc[key] = { name: key, count: 0, totalTime: 0 };
      acc[key].count += 1;
      acc[key].totalTime += (curr.calisma_suresi_dakika || 0);
      return acc;
    }, {});
  }, [filteredData]);

  const scatterData = useMemo(() => {
    return Object.values(equipmentStats).map((e: any) => ({
      name: e.name,
      x: e.count,
      y: Math.round(e.totalTime / e.count),
      z: e.count
    })).sort((a:any, b:any) => b.y - a.y);
  }, [equipmentStats]);

  const aiPredictions = useMemo(() => {
    return Object.keys(equipmentStats).map(name => {
      const freq = equipmentStats[name].count;
      const riskSkoru = Math.min(freq * 12, 98);
      const tahminiGun = Math.max(30 - (freq * 2), 3);
      return { name, riskSkoru, tahminiGun };
    }).sort((a, b) => b.riskSkoru - a.riskSkoru).slice(0, 4);
  }, [equipmentStats]);

  // 📊 7 SAYFALI GELİŞMİŞ EXCEL FONKSİYONU
  const excelIndir = () => {
    const wb = XLSX.utils.book_new();

    // Sayfa 1: Tüm İş Emirleri
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredData), "1-TUM_KAYITLAR");

    // Sayfa 2: AI Tahmini Bakım Öngörüsü
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aiPredictions), "2-AI_TAHMINLERI");

    // Sayfa 3: Atölye Yükü
    const atolye = [
      { Atolye: 'ELEKTRİK', Adet: filteredData.filter(d => String(d.is_istasyonu).includes('201')).length },
      { Atolye: 'MEKANİK', Adet: filteredData.filter(d => String(d.is_istasyonu).includes('202')).length },
      { Atolye: 'BİNA', Adet: filteredData.filter(d => String(d.is_istasyonu).includes('204')).length }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(atolye), "3-ATOLYE_YUKU");

    // Sayfa 4: Darboğaz Analizi
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scatterData), "4-DARBOGAZ_ANALIZI");

    // Sayfa 5: Kritik Varlıklar (Top 10)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scatterData.slice(0, 10)), "5-KRITIK_VARLIKLAR");

    // Sayfa 6: Yönetici Özeti
    const ozet = [
      ["SAHA 360 ANALİTİK ÖZET"],
      ["Toplam İhbar:", stats.total],
      ["Ortalama Tamir (DK):", stats.avgTime],
      ["Sistem Verimliliği:", `%${stats.efficiency}`]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozet), "6-OZET_KPI");

    // Sayfa 7: AKILLI ANALİZ VE YORUMLAR (Word Dosyası Mantığı)
    const yorumlar = [
      ["OPERASYONEL ANALİZ VE ÖNERİLER"],
      ["Analiz Tarihi:", new Date().toLocaleDateString()],
      [],
      ["1. DARBOĞAZ ANALİZİ:"],
      [`Tespit edilen en büyük darboğaz: ${stats.bottleneck}.`],
      ["Bu ekipmanda yaşanan her arıza, ortalamanın üzerinde onarım süresi gerektirerek tersane işleyişini yavaşlatmaktadır."],
      [],
      ["2. KRİTİK EKİPMAN DURUMU:"],
      [`${scatterData[0]?.name || '-'} ekipmanı, düşük arıza sayısına rağmen yüksek onarım süresiyle süreçlerde darboğaz yaratmaktadır.`],
      [],
      ["3. STRATEJİK ÖNERİLER:"],
      ["- Darboğaz ekipmanlar için yedek parça stokları ve kök neden analizleri önceliklendirilmelidir."],
      ["- AI risk skoru %70 üzerinde olan varlıklarda koruyucu bakım planlanması tavsiye edilir."]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(yorumlar), "7-AKILLI_YORUMLAR");

    XLSX.writeFile(wb, `Saha360_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  if (loading) return <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center text-orange-500 font-black italic uppercase">VERİLER HAZIRLANIYOR...</div>

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-6 md:p-12 font-black uppercase italic">
      <div className="max-w-[1600px] mx-auto space-y-10">
        
        {/* HEADER & FİLTRELER */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 border-b-2 border-orange-500 pb-8">
          <h1 className="text-4xl tracking-tighter italic">SAHA <span className="text-orange-500 text-outline font-black">ANALİTİK</span></h1>
          
          <div className="flex flex-wrap items-center gap-4">
             {/* Nesne Seçimi */}
             <div className="relative">
              <button onClick={() => setShowFilter(!showFilter)} className="bg-[#111318] border border-gray-800 px-6 py-4 rounded-2xl text-[10px] hover:border-orange-500 font-black italic uppercase">
                ⚙️ NESNELER ({selectedNesneler.length})
              </button>
              {showFilter && (
                <div className="absolute top-full left-0 mt-2 w-80 max-h-96 bg-[#111318] border border-gray-800 rounded-3xl p-6 z-[100] shadow-2xl overflow-y-auto">
                  {tumNesneListesi.map(nesne => (
                    <label key={nesne} className="flex items-center gap-3 mb-3 cursor-pointer">
                      <input type="checkbox" checked={selectedNesneler.includes(nesne)} onChange={(e) => e.target.checked ? setSelectedNesneler([...selectedNesneler, nesne]) : setSelectedNesneler(selectedNesneler.filter(n => n !== nesne))} className="accent-orange-500" />
                      <span className="text-[9px] font-black italic">{nesne}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tarih ve Sorgula */}
            <div className="flex items-center gap-2 bg-[#111318] p-4 rounded-3xl border border-gray-800">
              <input type="date" className="bg-transparent text-[10px] outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" className="bg-transparent text-[10px] outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button onClick={handleSorgula} className="bg-orange-600 px-8 py-2 rounded-2xl text-[10px] font-black italic hover:bg-orange-500 transition-all">SORGULA</button>
            </div>
            
            {isSorgulandi && (
              <button onClick={excelIndir} className="bg-green-600 px-6 py-4 rounded-2xl text-[10px] font-black italic uppercase shadow-lg hover:scale-105 transition-all">📊 EXCEL İNDİR</button>
            )}
            <button onClick={() => router.push('/dashboard')} className="bg-gray-800 px-6 py-4 rounded-2xl text-[10px] font-black italic">GERİ</button>
          </div>
        </div>

        {isSorgulandi ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* KPI KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-orange-600">
                <p className="text-[10px] text-gray-500 mb-2">TOPLAM İŞ</p>
                <h2 className="text-5xl text-orange-500 tracking-tighter">{stats.total}</h2>
              </div>
              {/* ... Diğer KPI kartları buraya ... */}
            </div>

            {/* GRAFİKLER (EKRANI TAM DOLDURAN) */}
            <div className="w-full bg-[#111318] p-10 rounded-[3rem] border border-blue-500/10 min-h-[600px]">
              <h3 className="text-xs mb-10 border-l-4 border-blue-500 pl-4 tracking-widest font-black italic uppercase">Darboğaz Analizi (Arıza Sıklığı vs Ortalama Süre)</h3>
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid stroke="#222" vertical={false} />
                  <XAxis type="number" dataKey="x" name="ARIZA" stroke="#666" fontSize={10} label={{ value: 'ARIZA SAYISI', position: 'bottom', offset: 0, fill: '#444', fontSize: 8 }} />
                  <YAxis type="number" dataKey="y" name="SÜRE" stroke="#666" fontSize={10} label={{ value: 'ORT. SÜRE (DK)', angle: -90, position: 'insideLeft', fill: '#444', fontSize: 8 }} />
                  <ZAxis type="number" dataKey="z" range={[200, 2000]} />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell key={index} fill={entry.y > stats.avgTime * 1.5 ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            
            {/* 🤖 AI TAHMİN KARTLARI */}
            {/* Mevcut AI kart kodun buraya gelecek... */}

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
