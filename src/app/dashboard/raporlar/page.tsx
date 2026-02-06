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

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    const { data: ihbarlar } = await supabase.from('ihbarlar').select('*').order('created_at', { ascending: false });
    if (ihbarlar) {
      setData(ihbarlar);
      const finished = ihbarlar.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi');
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

  const workshopData = [
    { name: 'ELEKTRİK (201)', value: data.filter(d => d.is_istasyonu?.includes('201')).length, color: '#3b82f6' },
    { name: 'MEKANİK (202)', value: data.filter(d => d.is_istasyonu?.includes('202')).length, color: '#ea580c' },
    { name: 'BİNA (204)', value: data.filter(d => d.is_istasyonu?.includes('204')).length, color: '#10b981' },
  ];

  const equipmentStats = data.filter(i => i.durum === 'Tamamlandi' || i.statu === 'Bitirildi').reduce((acc: any, curr) => {
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
  })).sort((a,b) => b.y - a.y).slice(0, 25);

  // 🛡️ ÖZEL TOOLTIP BİLEŞENİ (Boş ekranı çözen mühür)
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-black border border-gray-700 p-4 rounded-2xl shadow-2xl font-black italic uppercase">
          <p className="text-orange-500 text-[10px] mb-2 border-b border-gray-800 pb-1">{item.name}</p>
          <p className="text-white text-xs">ARIZA: <span className="text-blue-400">{item.x || item.value}</span></p>
          {item.y && <p className="text-white text-xs">ORT. SÜRE: <span className="text-red-400">{item.y} DK</span></p>}
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center text-orange-500 font-black italic uppercase">ANALİZ EDİLİYOR...</div>

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-6 md:p-12 font-black uppercase italic">
      <div className="max-w-[1600px] mx-auto space-y-12">
        <div className="flex justify-between items-center border-b-2 border-orange-500 pb-8">
          <h1 className="text-4xl">SAHA <span className="text-orange-500 text-outline">ANALİTİK</span></h1>
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-8 py-3 rounded-full text-[10px]">DASHBOARD</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-orange-600">
            <p className="text-[10px] text-gray-500 mb-2">TOPLAM İŞ</p>
            <h2 className="text-5xl text-orange-500 tracking-tighter">{stats.total}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-blue-500">
            <p className="text-[10px] text-gray-500 mb-2">MTTR (ORT. TAMİR)</p>
            <h2 className="text-5xl text-blue-500 tracking-tighter">{stats.avgTime} DK</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-green-500">
            <p className="text-[10px] text-gray-500 mb-2">VERİMLİLİK</p>
            <h2 className="text-5xl text-green-500 tracking-tighter">%{stats.efficiency}</h2>
          </div>
          <div className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-red-500">
            <p className="text-[10px] text-gray-500 mb-2">DARBOĞAZ</p>
            <h2 className="text-sm text-red-500 leading-none truncate">{stats.bottleneck}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-[#111318] p-10 rounded-[3rem] border border-gray-800">
            <h3 className="text-xs mb-10 border-l-4 border-orange-500 pl-4">ATÖLYE YÜKÜ</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workshopData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#555" fontSize={8} width={100} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                  {workshopData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 bg-[#111318] p-10 rounded-[3rem] border border-gray-800 h-[450px]">
            <h3 className="text-xs mb-10 border-l-4 border-blue-500 pl-4">DARBOĞAZ ANALİZİ (ADET VS SÜRE)</h3>
            <ResponsiveContainer width="100%" height="80%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid stroke="#222" vertical={false} />
                <XAxis type="number" dataKey="x" name="ARIZA" stroke="#555" fontSize={10} />
                <YAxis type="number" dataKey="y" name="SÜRE" stroke="#555" fontSize={10} />
                <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Varlıklar" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={index} fill={entry.y > stats.avgTime ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
