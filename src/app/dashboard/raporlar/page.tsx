'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx' // 📦 Excel kütüphanesi mühürlendi
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts'

export default function Raporlar() {
  const router = useRouter()
  const [rawData, setRawData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedNesneler, setSelectedNesneler] = useState<string[]>([])
  const [showFilter, setShowFilter] = useState(false)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const { data: ihbarlar } = await supabase.from('ihbarlar').select('*').order('created_at', { ascending: false });
    if (ihbarlar) {
      setRawData(ihbarlar);
      const uniqueNesneler = Array.from(new Set(ihbarlar.map(i => i.secilen_nesne_adi).filter(Boolean))) as string[];
      setSelectedNesneler(uniqueNesneler.filter(n => n.toUpperCase() !== 'DİĞER' && n.toUpperCase() !== 'DIGER'));
    }
    setLoading(false);
  }

  const tumNesneListesi = useMemo(() => {
    return Array.from(new Set(rawData.map(i => i.secilen_nesne_adi).filter(Boolean))).sort() as string[];
  }, [rawData]);

  const filteredData = useMemo(() => {
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
  }, [rawData, startDate, endDate, selectedNesneler]);

  const stats = useMemo(() => {
    const finished = filteredData.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi');
    const total = finished.length;
    const totalMin = finished.reduce((acc, curr) => acc + (curr.calisma_suresi_dakika || 0), 0);
    const avgTime = total > 0 ? Math.round(totalMin / total) : 0;
    
    const counts: any = {};
    finished.forEach(i => { counts[i.secilen_nesne_adi] = (counts[i.secilen_nesne_adi] || 0) + 1 });
    const bottleneck = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '-';
    const efficiency = total > 0 ? Math.round((finished.filter(i => i.fiili_sure_gun_metni === '1 Günden Kısa').length / total) * 100) : 0;

    return { total, avgTime, bottleneck, efficiency };
  }, [filteredData]);

  const aiPredictions = useMemo(() => {
    const counts = filteredData.reduce((acc: any, curr) => {
      const key = curr.secilen_nesne_adi || 'BİLİNMİYOR';
      if (!acc[key]) acc[key] = { count: 0, lastDate: curr.created_at };
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.keys(counts).map(name => {
      const freq = counts[name].count;
      const riskSkoru = Math.min(freq * 12, 98);
      const tahminiGun = Math.max(30 - (freq * 2), 3);
      return { name, riskSkoru, tahminiGun };
    }).sort((a, b) => b.riskSkoru - a.riskSkoru).slice(0, 4);
  }, [filteredData]);

  const workshopData = useMemo(() => [
    { name: 'ELEKTRİK (201)', value: filteredData.filter(d => String(d.is_istasyonu).includes('201')).length, color: '#3b82f6' },
    { name: 'MEKANİK (202)', value: filteredData.filter(d => String(d.is_istasyonu).includes('202')).length, color: '#ea580c' },
    { name: 'BİNA (204)', value: filteredData.filter(d => String(d.is_istasyonu).includes('204')).length, color: '#10b981' },
  ], [filteredData]);

  const equipmentStats = filteredData.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi').reduce((acc: any, curr) => {
    const key = curr.secilen_nesne_adi;
    if (!acc[key]) acc[key] = { name: key, count: 0, totalTime: 0 };
    acc[key].count += 1;
    acc[key].totalTime += (curr.calisma_suresi_dakika || 0);
    return acc;
  }, {});

  const scatterData = Object.values(equipmentStats).map((e: any) => ({
    name: e.name,
    x: e.count,
    y: Math.round(e.totalTime / e.count),
    z: e.count
  })).sort((a:any, b:any) => b.y - a.y);

  // 📊 GELİŞMİŞ EXCEL İNDİRME FONKSİYONU
  const excelIndir = () => {
    if (filteredData.length === 0) return alert("İndirilecek veri bulunamadı.");

    const wb = XLSX.utils.book_new();

    // 1. Sayfa: YÖNETİCİ ÖZETİ (Dashboard KPI)
    const kpiSummary = [
      ["SAHA 360 - YÖNETİCİ ÖZET RAPORU"],
      ["Rapor Tarihi:", new Date().toLocaleString()],
      [],
      ["METRİK", "DEĞER", "BİRİM"],
      ["Toplam İhbar Sayısı", stats.total, "ADET"],
      ["Ortalama Tamir Süresi", stats.avgTime, "DAKİKA"],
      ["Operasyonel Verimlilik", `%${stats.efficiency}`, "YÜZDE"],
      ["En Büyük Darboğaz", stats.bottleneck, "VARLIK"]
    ];
    const wsKPI = XLSX.utils.aoa_to_sheet(kpiSummary);
    XLSX.utils.book_append_sheet(wb, wsKPI, "1-YONETICI_OZETI");

    // 2. Sayfa: GRAFİK VERİ KAYNAĞI (Atölye Yükleri)
    const grafVerisi = workshopData.map(w => ({
      "ATÖLYE ADI": w.name,
      "İŞ ADEDİ": w.value,
      "YÜZDE PAY": `%${((w.value / (stats.total || 1)) * 100).toFixed(1)}`
    }));
    const wsGraf = XLSX.utils.json_to_sheet(grafVerisi);
    XLSX.utils.book_append_sheet(wb, wsGraf, "2-GRAFIK_KAYNAK");

    // 3. Sayfa: AI TAHMİNLERİ
    const aiRows = aiPredictions.map(p => ({
      "VARLIK ADI": p.name,
      "RİSK SKORU (%)": p.riskSkoru,
      "TAHMİNİ ARIZA GÜNÜ": p.tahminiGun,
      "DURUM": p.riskSkoru > 70 ? "KRİTİK" : "NORMAL"
    }));
    const wsAI = XLSX.utils.json_to_sheet(aiRows);
    XLSX.utils.book_append_sheet(wb, wsAI, "3-AI_TAHMINLERI");

    // 4. Sayfa: KRİTİK VARLIKLAR (Scatter Analiz)
    const criticalRows = scatterData.slice(0, 10).map((e:any, idx:number) => ({
      "SIRA": idx + 1,
      "VARLIK": e.name,
      "ARIZA SAYISI": e.x,
      "ORTALAMA SURE (DK)": e.y
    }));
    const wsTop = XLSX.utils.json_to_sheet(criticalRows);
    XLSX.utils.book_append_sheet(wb, wsTop, "4-KRITIK_VARLIKLAR");

    // 5. Sayfa: HAM VERİ LİSTESİ
    const rawRows = filteredData.map(i => ({
      "İŞ EMRİ NO": i.ifs_is_emri_no,
      "KONU": i.konu,
      "VARLIK": i.secilen_nesne_adi,
      "İSTASYON": i.is_istasyonu,
      "BAŞLANGIÇ": i.kabul_tarihi,
      "BİTİŞ": i.kapama_tarihi,
      "SÜRE (DK)": i.calisma_suresi_dakika,
      "DURUM": i.durum
    }));
    const wsRaw = XLSX.utils.json_to_sheet(rawRows);
    XLSX.utils.book_append_sheet(wb, wsRaw, "5-TUM_KAYITLAR");

    XLSX.writeFile(wb, `Saha360_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#111318] border border-orange-500/50 p-4 rounded-xl shadow-2xl font-black italic uppercase min-w-[200px]">
          <p className="text-orange-500 text-[10px] mb-2 border-b border-gray-800 pb-1">{item.name || item.payload?.name}</p>
          <div className="space-y-1">
            <p className="text-white text-[10px]">ARIZA: <span className="text-blue-400">{item.x || item.value}</span></p>
            {item.y && <p className="text-white text-[10px]">ORT. SÜRE: <span className="text-red-400">{item.y} DK</span></p>}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center text-orange-500 font-black italic uppercase">Y Ü K L E N İ Y O R...</div>

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-6 md:p-12 font-black uppercase italic">
      <div className="max-w-[1600px] mx-auto space-y-10">
        
        {/* HEADER & FİLTRELER */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 border-b-2 border-orange-500 pb-8">
          <h1 className="text-4xl tracking-tighter italic">SAHA <span className="text-orange-500 text-outline font-black">ANALİTİK</span></h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <button onClick={() => setShowFilter(!showFilter)} className="bg-[#111318] border border-gray-800 px-6 py-4 rounded-2xl text-[10px] hover:border-orange-500 font-black italic uppercase">
                ⚙️ NESNE FİLTRESİ ({selectedNesneler.length})
              </button>
              {showFilter && (
                <div className="absolute top-full left-0 mt-2 w-80 max-h-96 bg-[#111318] border border-gray-800 rounded-3xl p-6 z-[100] shadow-2xl overflow-y-auto">
                  <div className="flex justify-between mb-4 border-b border-gray-800 pb-2">
                    <button onClick={() => setSelectedNesneler(tumNesneListesi)} className="text-[8px] text-blue-500 font-black">TÜMÜ</button>
                    <button onClick={() => setSelectedNesneler([])} className="text-[8px] text-red-500 font-black">SİL</button>
                  </div>
                  {tumNesneListesi.map(nesne => (
                    <label key={nesne} className="flex items-center gap-3 mb-3 cursor-pointer group">
                      <input type="checkbox" checked={selectedNesneler.includes(nesne)} onChange={(e) => e.target.checked ? setSelectedNesneler([...selectedNesneler, nesne]) : setSelectedNesneler(selectedNesneler.filter(n => n !== nesne))} className="accent-orange-500" />
                      <span className="text-[9px] group-hover:text-orange-500 font-black italic">{nesne}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-[#111318] p-4 rounded-3xl border border-gray-800">
              <input type="date" className="bg-transparent text-[10px] text-white outline-none font-black italic" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" className="bg-transparent text-[10px] text-white outline-none font-black italic" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button onClick={excelIndir} className="bg-green-600 px-6 py-2 rounded-2xl text-[10px] ml-2 font-black italic uppercase tracking-tighter shadow-lg">📊 EXCEL (XLSX)</button>
              <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-6 py-2 rounded-2xl text-[10px] font-black italic uppercase">GERİ</button>
            </div>
          </div>
        </div>

        {/* KPI KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-orange-600">
            <p className="text-[10px] text-gray-500 mb-2 font-black italic">SEÇİLİ İŞLER</p>
            <h2 className="text-5xl text-orange-500 tracking-tighter font-black italic">{stats.total}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-blue-500">
            <p className="text-[10px] text-gray-500 mb-2 font-black italic">MTTR (ORT. SÜRE)</p>
            <h2 className="text-5xl text-blue-500 tracking-tighter font-black italic">{stats.avgTime} DK</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-green-500">
            <p className="text-[10px] text-gray-500 mb-2 font-black italic">VERİMLİLİK</p>
            <h2 className="text-5xl text-green-500 tracking-tighter font-black italic">%{stats.efficiency}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-red-500">
            <p className="text-[10px] text-gray-500 mb-2 font-black italic">DARBOĞAZ</p>
            <h2 className="text-sm text-red-500 truncate mt-2 leading-none h-10 font-black italic">{stats.bottleneck}</h2>
          </div>
        </div>

        {/* 🤖 AI TAHMİN KARTLARI */}
        <div className="bg-[#111318] p-10 rounded-[4rem] border border-orange-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <span className="text-8xl">🤖</span>
          </div>
          <h3 className="text-xs mb-8 border-l-4 border-orange-500 pl-4 tracking-widest font-black italic text-orange-500">🤖 AI TAHMİNİ BAKIM ÖNGÖRÜSÜ (BETA)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiPredictions.map((pred, idx) => (
              <div key={idx} className="bg-black/40 p-6 rounded-[2.5rem] border border-gray-800 flex flex-col justify-between">
                <div>
                  <p className="text-[9px] text-gray-500 font-black italic mb-2 uppercase truncate">{pred.name}</p>
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-black italic text-white">%{pred.riskSkoru}</span>
                    <span className={`text-[8px] font-black italic ${pred.riskSkoru > 70 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>KRİTİK RİSK</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800">
                   <p className="text-[8px] text-gray-600 font-black italic uppercase">TAHMİNİ ARIZA: <span className="text-orange-500">{pred.tahminiGun} GÜN İÇİNDE</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRAFİKLER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-[#111318] p-10 rounded-[3rem] border border-gray-800">
            <h3 className="text-xs mb-10 border-l-4 border-orange-500 pl-4 tracking-widest font-black italic">ATÖLYE YÜKÜ (İŞ SAYISI)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workshopData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#555" fontSize={8} width={100} tick={{fontFamily: 'black italic', fill: '#888'}} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={25}>
                  {workshopData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 bg-[#111318] p-10 rounded-[3rem] border border-gray-800 h-[500px]">
            <h3 className="text-xs mb-10 border-l-4 border-blue-500 pl-4 tracking-widest font-black italic">DARBOĞAZ (ARIZA VS SÜRE)</h3>
            <ResponsiveContainer width="100%" height="80%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="ARIZA" stroke="#666" fontSize={9} scale="sqrt" domain={[1, 'auto']} />
                <YAxis type="number" dataKey="y" name="SÜRE" stroke="#666" fontSize={9} domain={['auto', 'auto']} />
                <ZAxis type="number" dataKey="z" range={[150, 1500]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Varlıklar" data={scatterData}>
                  {scatterData.map((entry:any, index:number) => (
                    <Cell key={index} fill={entry.y > stats.avgTime * 1.5 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🏆 KRİTİK 10 EKİPMAN */}
        <div className="bg-[#111318] p-10 rounded-[4rem] border border-gray-800 shadow-2xl">
          <h3 className="text-xs mb-8 border-l-4 border-red-600 pl-4 tracking-widest font-black italic">EN KRİTİK 10 VARLIK</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {scatterData.slice(0, 10).map((e:any, idx:number) => (
              <div key={idx} className="bg-black/50 p-8 rounded-[3rem] border border-gray-900 relative group hover:border-orange-500/50 transition-all cursor-default">
                <div className="absolute top-0 right-0 bg-red-600 text-black px-4 py-1 text-[10px] rounded-bl-[1.5rem] font-black italic">#{idx + 1}</div>
                <p className="text-[10px] text-gray-500 mb-6 h-8 overflow-hidden font-black leading-tight uppercase italic">{e.name}</p>
                <div className="flex justify-between items-end border-t border-gray-800 pt-4">
                  <div><span className="text-[8px] text-gray-700 font-black italic uppercase">ARIZA</span><p className="text-3xl font-black text-white italic">{e.x}</p></div>
                  <div className="text-right"><span className="text-[8px] text-gray-400 font-black italic uppercase">ORT. SÜRE</span><p className="text-xl text-orange-500 font-black italic">{e.y} DK</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}