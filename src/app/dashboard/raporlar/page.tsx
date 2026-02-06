'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'

export default function Raporlar() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, avgTime: 0, bottleneck: '', activeJobs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { data: ihbarlar, error } = await supabase
      .from('ihbarlar')
      .select('*')
      .order('created_at', { ascending: false });

    if (ihbarlar) {
      setData(ihbarlar);
      const finished = ihbarlar.filter(i => i.durum === 'Tamamlandi');
      const total = finished.length;
      const totalMin = finished.reduce((acc, curr) => acc + (curr.calisma_suresi_dakika || 0), 0);
      const avg = total > 0 ? totalMin / total : 0;
      
      // Darboğaz Ekipman Tespiti (Excel Mantığı)
      const counts: any = {};
      finished.forEach(i => { 
        if(i.secilen_nesne_adi) counts[i.secilen_nesne_adi] = (counts[i.secilen_nesne_adi] || 0) + 1 
      });
      const sorted = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1]);

      setStats({ 
        total, 
        avgTime: Math.round(avg), 
        bottleneck: sorted[0] ? String(sorted[0][0]) : '-',
        activeJobs: ihbarlar.filter(i => i.durum === 'Calisiliyor').length
      });
    }
    setLoading(false);
  }

  // 1. İş İstasyonu Verimliliği (201, 202, 204)
  const workshopData = [
    { name: 'ELEKTRİK (201)', count: data.filter(d => d.is_istasyonu === '201').length, color: '#3b82f6' },
    { name: 'MEKANİK (202)', count: data.filter(d => d.is_istasyonu === '202').length, color: '#ea580c' },
    { name: 'BİNA (204)', count: data.filter(d => d.is_istasyonu === '204').length, color: '#10b981' },
  ];

  // 2. Darboğaz Analizi (Scatter Plot)
  const equipmentStats = data.filter(i => i.durum === 'Tamamlandi').reduce((acc: any, curr) => {
    const key = curr.secilen_nesne_adi || 'Bilinmiyor';
    if (!acc[key]) acc[key] = { name: key, count: 0, totalTime: 0 };
    acc[key].count += 1;
    acc[key].totalTime += (curr.calisma_suresi_dakika || 0);
    return acc;
  }, {});

  const scatterData = Object.values(equipmentStats).map((e: any) => ({
    name: e.name,
    x: e.count, // Arıza Sayısı
    y: Math.round(e.totalTime / e.count), // Ort. Süre
    z: e.count
  })).sort((a,b) => b.x - a.x).slice(0, 20);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center">
      <div className="text-orange-500 animate-pulse font-black italic uppercase tracking-[0.5em]">VERİ HAVUZU ANALİZ EDİLİYOR...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white p-4 md:p-10 font-black uppercase italic">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl tracking-tighter text-white">SAHA <span className="text-orange-500">360</span> ANALİTİK</h1>
            <p className="text-[10px] text-gray-500 tracking-[0.3em] mt-2">IFS TABANLI OPERASYONEL VERİMLİLİK RAPORU</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-white text-black px-6 py-2 rounded-full text-[10px] hover:invert transition-all">DASHBOARD'A DÖN</button>
        </div>

        {/* ÜST KPI KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#111318] p-8 rounded-[2.5rem] border border-gray-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📊</div>
            <p className="text-gray-500 text-[10px] mb-2">BITEN İŞ EMRI</p>
            <h2 className="text-5xl text-orange-500">{stats.total}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2.5rem] border border-gray-800 border-t-blue-500 border-t-4">
            <p className="text-gray-500 text-[10px] mb-2">MTTR (ORT. TAMIR)</p>
            <h2 className="text-5xl text-blue-500">{stats.avgTime} <span className="text-sm">DK</span></h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2.5rem] border border-gray-800 border-t-red-500 border-t-4">
            <p className="text-gray-500 text-[10px] mb-2">DARBOĞAZ VARLIK</p>
            <h2 className="text-sm text-red-500 leading-tight h-12 overflow-hidden">{stats.bottleneck}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2.5rem] border border-gray-800">
            <p className="text-gray-500 text-[10px] mb-2">SAHADA AKTIF</p>
            <h2 className="text-5xl text-green-500">{stats.activeJobs} <span className="text-sm">EKIP</span></h2>
          </div>
        </div>

        {/* GRAFİKLER */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* ATÖLYE DAĞILIMI */}
          <div className="bg-[#111318] p-10 rounded-[3rem] border border-gray-800 shadow-2xl">
            <h3 className="text-[10px] mb-10 tracking-[0.3em] text-gray-500 uppercase">ATÖLYE İŞ YÜKÜ DAĞILIMI</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workshopData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#555" fontSize={10} width={100} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#000', border: 'none', fontSize: '10px'}} />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={30}>
                    {workshopData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DARBOĞAZ ANALİZİ (SCATTER) */}
          <div className="bg-[#111318] p-10 rounded-[3rem] border border-gray-800 shadow-2xl">
            <h3 className="text-[10px] mb-10 tracking-[0.3em] text-gray-500 uppercase">DARBOĞAZ TESPİTİ (ARIZA VS SÜRE)</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid stroke="#222" vertical={false} />
                  <XAxis type="number" dataKey="x" name="ARIZA SAYISI" stroke="#555" fontSize={10} label={{ value: 'ARIZA SAYISI', position: 'insideBottom', offset: -10, fontSize: 8, fill: '#555' }} />
                  <YAxis type="number" dataKey="y" name="ORT. SÜRE" stroke="#555" fontSize={10} label={{ value: 'ORT. SÜRE (DK)', angle: -90, position: 'insideLeft', fontSize: 8, fill: '#555' }} />
                  <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor: '#000', border: 'none', fontSize: '10px'}} />
                  <Scatter name="EKİPMANLAR" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.y > stats.avgTime * 1.3 ? '#ef4444' : '#3b82f6'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* KRİTİK LİSTE */}
        <div className="bg-[#111318] p-10 rounded-[3rem] border border-gray-800">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-[10px] tracking-[0.3em] text-gray-500">EN ÇOK ZAMAN KAYBETTİREN 10 VARLIK</h3>
            <span className="text-[8px] bg-red-900/30 text-red-500 px-3 py-1 rounded-full">KRİTİK MÜDAHALE GEREKLI</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {scatterData.slice(0, 10).map((e: any, idx: number) => (
              <div key={idx} className="bg-black/40 p-6 rounded-[2rem] border border-gray-900 hover:border-orange-500 transition-all group">
                <p className="text-[9px] text-gray-600 mb-4 group-hover:text-orange-500 transition-all truncate">{e.name}</p>
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-black">{e.x}</span>
                  <div className="text-right">
                    <p className="text-[8px] text-gray-500">ORT. SÜRE</p>
                    <p className="text-sm text-blue-400">{e.y} DK</p>
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
