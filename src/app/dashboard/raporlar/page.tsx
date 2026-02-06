'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts'

export default function Raporlar() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, avgTime: 0, bottleneck: '', efficiency: 0 })
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const { data: ihbarlar } = await supabase.from('ihbarlar').select('*').order('created_at', { ascending: false });
    if (ihbarlar) {
      setData(ihbarlar);
      
      // 🛡️ "DİĞER" NESNESİNİ İSTATİSTİK DIŞI BIRAKAN FİLTRE
      const finished = ihbarlar.filter(i => 
        (i.durum === 'Tamamlandi' || i.statu === 'Bitirildi') && 
        i.secilen_nesne_adi !== 'Diğer' &&
        i.secilen_nesne_adi !== null
      );

      const total = finished.length;
      const totalMin = finished.reduce((acc, curr) => acc + (curr.calisma_suresi_dakika || 0), 0);
      
      const counts: any = {};
      finished.forEach(i => { if(i.secilen_nesne_adi) counts[i.secilen_nesne_adi] = (counts[i.secilen_nesne_adi] || 0) + 1 });
      const sorted = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1]);
      
      setStats({ 
        total, 
        avgTime: total > 0 ? Math.round(totalMin / total) : 0, 
        bottleneck: sorted[0] ? String(sorted[0][0]) : '-',
        efficiency: total > 0 ? Math.round((finished.filter(i => i.fiili_sure_gun_metni === '1 Günden Kısa').length / total) * 100) : 0
      });
    }
    setLoading(false);
  }

  const excelIndir = () => {
    let filtrelenmis = data;
    if (startDate && endDate) {
      filtrelenmis = data.filter(i => {
        const d = new Date(i.created_at).getTime();
        return d >= new Date(startDate).getTime() && d <= new Date(endDate).setHours(23,59,59);
      });
    }
    if (filtrelenmis.length === 0) return alert("Veri bulunamadı.");
    
    const headers = ["IS_EMRI_NO", "KONU", "NESNE", "ISTASYON", "BASLANGIC", "BITIS", "SURE_DK", "DURUM"];
    const rows = filtrelenmis.map(i => [i.ifs_is_emri_no, i.konu, i.secilen_nesne_adi, i.is_istasyonu, i.kabul_tarihi, i.kapama_tarihi, i.calisma_suresi_dakika, i.durum]);
    let csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Saha360_Rapor_${startDate || 'Hepsi'}.csv`;
    link.click();
  }

  // Atölye verilerinde de sadece gerçek ekipmanları sayıyoruz
  const workshopData = [
    { name: 'ELEKTRİK (201)', value: data.filter(d => d.is_istasyonu?.includes('201') && d.secilen_nesne_adi !== 'Diğer').length, color: '#3b82f6' },
    { name: 'MEKANİK (202)', value: data.filter(d => d.is_istasyonu?.includes('202') && d.secilen_nesne_adi !== 'Diğer').length, color: '#ea580c' },
    { name: 'BİNA (204)', value: data.filter(d => d.is_istasyonu?.includes('204') && d.secilen_nesne_adi !== 'Diğer').length, color: '#10b981' },
  ];

  const equipmentStats = data.filter(i => (i.durum === 'Tamamlandi' || i.statu === 'Bitirildi') && i.secilen_nesne_adi !== 'Diğer').reduce((acc: any, curr) => {
    const key = curr.secilen_nesne_adi || 'Bilinmiyor';
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
  })).sort((a,b) => b.y - a.y);

  const top10Equipment = scatterData.slice(0, 10);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#111318] border border-orange-500/50 p-4 rounded-xl shadow-2xl font-black italic uppercase min-w-[220px]">
          <p className="text-orange-500 text-[10px] mb-2 border-b border-gray-800 pb-1">{item.name}</p>
          <div className="space-y-1">
            <p className="text-white text-[10px]">ARIZA SAYISI: <span className="text-blue-400">{item.x || item.value}</span></p>
            {item.y && <p className="text-white text-[10px]">ORTALAMA SÜRE: <span className="text-red-400">{item.y} DK</span></p>}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center text-orange-500 font-black italic uppercase animate-pulse tracking-widest">VERİLER MÜHÜRLENİYOR...</div>

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-6 md:p-12 font-black uppercase italic selection:bg-orange-500">
      <div className="max-w-[1600px] mx-auto space-y-10">
        
        {/* ÜST PANEL */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 border-b-2 border-orange-500 pb-8">
          <h1 className="text-4xl tracking-tighter italic">SAHA <span className="text-orange-500 text-outline font-black">ANALİTİK</span></h1>
          
          <div className="flex flex-wrap items-center gap-4 bg-[#111318] p-4 rounded-3xl border border-gray-800 shadow-xl">
            <input type="date" className="bg-black/50 p-2 rounded-xl text-[10px] text-white border border-gray-800 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <input type="date" className="bg-black/50 p-2 rounded-xl text-[10px] text-white border border-gray-800 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
            <button onClick={excelIndir} className="bg-green-600 px-6 py-4 rounded-2xl text-[10px] hover:bg-green-700 transition-all">📊 EXCEL İNDİR</button>
            <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-6 py-4 rounded-2xl text-[10px]">GERİ DÖN</button>
          </div>
        </div>

        {/* KPI KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-orange-600">
            <p className="text-[10px] text-gray-500 mb-2 font-black tracking-widest">TOPLAM İŞ (EKİPMAN)</p>
            <h2 className="text-6xl text-orange-500 tracking-tighter">{stats.total}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-blue-500">
            <p className="text-[10px] text-gray-500 mb-2 font-black tracking-widest">MTTR (ORT. TAMİR)</p>
            <h2 className="text-6xl text-blue-500 tracking-tighter">{stats.avgTime} <span className="text-sm">DK</span></h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-green-500">
            <p className="text-[10px] text-gray-500 mb-2 font-black tracking-widest">VERİMLİLİK</p>
            <h2 className="text-6xl text-green-500 tracking-tighter">%{stats.efficiency}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-red-500">
            <p className="text-[10px] text-gray-500 mb-2 font-black tracking-widest uppercase">EN KRİTİK VARLIK</p>
            <h2 className="text-sm text-red-500 truncate mt-2 h-10 leading-none">{stats.bottleneck}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-[#111318] p-10 rounded-[3rem] border border-gray-800 shadow-2xl">
            <h3 className="text-xs mb-10 border-l-4 border-orange-500 pl-4">İŞ İSTASYONU YÜKÜ</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workshopData} layout="vertical">
                <XAxis type="number" domain={[0, 'auto']} hide />
                <YAxis dataKey="name" type="category" stroke="#555" fontSize={8} width={100} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={25}>
                  {workshopData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 bg-[#111318] p-10 rounded-[3rem] border border-gray-800 h-[500px] shadow-2xl">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xs border-l-4 border-blue-500 pl-4 tracking-[0.2em]">DARBOĞAZ ANALİZİ (ÖLÇEKLİ)</h3>
              <span className="text-[8px] text-blue-500 font-black tracking-widest">"DİĞER" NESNESİ HARİÇ TUTULDU</span>
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="ARIZA" stroke="#666" fontSize={9} scale="sqrt" domain={[1, 'auto']} />
                <YAxis type="number" dataKey="y" name="SÜRE" stroke="#666" fontSize={9} domain={['auto', 'auto']} />
                <ZAxis type="number" dataKey="z" range={[150, 1500]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Ekipmanlar" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={index} fill={entry.y > stats.avgTime * 1.5 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🏆 KRİTİK 10 EKİPMAN (DİĞER HARİÇ) */}
        <div className="bg-[#111318] p-10 rounded-[4rem] border border-gray-800 shadow-2xl">
          <h3 className="text-xs mb-8 border-l-4 border-red-600 pl-4 tracking-[0.2em]">OPERASYONU YAVAŞLATAN 10 VARLIK</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {top10Equipment.map((e, idx) => (
              <div key={idx} className="bg-black/50 p-8 rounded-[3rem] border border-gray-900 relative group hover:border-orange-500/50 transition-all">
                <div className="absolute top-0 right-0 bg-red-600 text-black px-4 py-1 text-[10px] rounded-bl-[1.5rem] font-black italic">#{idx + 1}</div>
                <p className="text-[10px] text-gray-500 mb-6 h-8 overflow-hidden font-black leading-tight uppercase">{e.name}</p>
                <div className="flex justify-between items-end border-t border-gray-800 pt-4">
                  <div>
                    <span className="text-[8px] text-gray-700 font-black">ARIZA</span>
                    <p className="text-3xl font-black text-white">{e.x}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-gray-400">ORT. SÜRE</span>
                    <p className="text-xl text-orange-500 font-black">{e.y} <span className="text-[10px]">DK</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
