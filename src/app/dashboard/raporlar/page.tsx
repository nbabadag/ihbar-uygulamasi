'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie, Sector
} from 'recharts'

export default function Raporlar() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    avgTime: 0,
    bottleneck: '',
    efficiency: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { data: ihbarlar } = await supabase
      .from('ihbarlar')
      .select('*')
      .order('created_at', { ascending: false });

    if (ihbarlar) {
      setData(ihbarlar);
      const finished = ihbarlar.filter(i => i.durum === 'Tamamlandi');
      const total = finished.length;
      const totalMin = finished.reduce((acc, curr) => acc + (curr.calisma_suresi_dakika || 0), 0);
      
      const counts: any = {};
      finished.forEach(i => { if(i.secilen_nesne_adi) counts[i.secilen_nesne_adi] = (counts[i.secilen_nesne_adi] || 0) + 1 });
      const sorted = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1]);

      setStats({ 
        total, 
        avgTime: total > 0 ? Math.round(totalMin / total) : 0, 
        bottleneck: sorted[0] ? String(sorted[0][0]) : '-',
        efficiency: Math.round((finished.filter(i => i.fiili_sure_gun_metni === '1 Günden Kısa').length / total) * 100)
      });
    }
    setLoading(false);
  }

  // 📈 EXCEL MANTIĞI: İŞ İSTASYONU KARNESİ
  const workshopData = [
    { name: '201 ELEKTRİK', value: data.filter(d => d.is_istasyonu === '201').length, time: 62, color: '#3b82f6' },
    { name: '202 MEKANİK', value: data.filter(d => d.is_istasyonu === '202').length, time: 45, color: '#ea580c' },
    { name: '204 BİNA', value: data.filter(d => d.is_istasyonu === '204').length, time: 120, color: '#10b981' },
  ];

  // 🎯 DARBOĞAZ ANALİZİ (SCATTER - ARİZA SAYISI VS ORT SÜRE)
  const equipmentStats = data.filter(i => i.durum === 'Tamamlandi').reduce((acc: any, curr) => {
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

  if (loading) return (
    <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center font-black italic uppercase">
      <div className="text-orange-500 animate-pulse tracking-[0.5em]">IFS ZEKASI YÜKLENİYOR...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#06070a] text-white p-6 md:p-12 font-black uppercase italic selection:bg-orange-500">
      <div className="max-w-[1600px] mx-auto space-y-12">
        
        {/* ÜST BAR: KONTROL PANELİ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-orange-500 pb-8">
          <div>
            <h1 className="text-6xl tracking-tighter leading-none italic">OPERASYON <span className="text-orange-500 text-outline">MERKEZİ</span></h1>
            <p className="text-[10px] text-gray-500 tracking-[0.4em] mt-3">SAHA 360 // VERİMLİLİK VE DARBOĞAZ ANALİZİ</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => window.print()} className="border border-gray-800 px-6 py-3 rounded-full text-[10px] hover:bg-white hover:text-black transition-all">PDF RAPOR AL</button>
            <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-8 py-3 rounded-full text-[10px] shadow-lg shadow-orange-900/20 hover:scale-105 transition-all">DASHBOARD</button>
          </div>
        </div>

        {/* ANA KPI METRİKLERİ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'TOPLAM İŞ EMİRLERİ', val: stats.total, color: 'text-white', icon: '📝' },
            { label: 'MTTR (ORT. TAMİR)', val: `${stats.avgTime} DK`, color: 'text-blue-500', icon: '⏱️' },
            { label: 'HIZLI ÇÖZÜM ORANI', val: `%${stats.efficiency}`, color: 'text-green-500', icon: '⚡' },
            { label: 'DARBOĞAZ VARLIK', val: stats.bottleneck.split(' ')[0], color: 'text-red-500', icon: '⚠️' }
          ].map((kpi, i) => (
            <div key={i} className="bg-[#111318] p-8 rounded-[2rem] border-l-4 border-orange-600 relative overflow-hidden group hover:bg-[#161920] transition-all">
              <span className="absolute -right-4 -bottom-4 text-7xl opacity-5 group-hover:opacity-10 transition-all">{kpi.icon}</span>
              <p className="text-[10px] text-gray-500 mb-4 tracking-widest font-black">{kpi.label}</p>
              <h2 className={`text-5xl ${kpi.color} tracking-tighter`}>{kpi.val}</h2>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. ATÖLYE YÜKÜ VE PERFORMANS */}
          <div className="lg:col-span-1 bg-[#111318] p-10 rounded-[3rem] border border-gray-800">
            <h3 className="text-xs mb-10 border-l-4 border-orange-500 pl-4 tracking-widest">ATÖLYE KARNELERİ (IFS)</h3>
            <div className="space-y-8">
              {workshopData.map((ws, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] text-gray-400">{ws.name}</span>
                    <span className="text-[10px] text-orange-500">{ws.value} İŞ</span>
                  </div>
                  <div className="w-full bg-black rounded-full h-4 overflow-hidden border border-gray-900">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(ws.value/stats.total)*100}%`, backgroundColor: ws.color }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 p-6 bg-black/40 rounded-3xl border border-gray-800">
              <p className="text-[9px] text-gray-500 mb-2">SİSTEM NOTU:</p>
              <p className="text-[10px] leading-relaxed italic text-gray-400">EN YÜKSEK İŞ YÜKÜ MEKANİK EKİBİNDE. BİNA BAKIM ORTALAMA TAMİR SÜRESİ HEDEFİN ÜZERİNDE.</p>
            </div>
          </div>

          {/* 2. KRİTİK DARBOĞAZ ANALİZİ (EXCEL SAYFA 2 MANTIĞI) */}
          <div className="lg:col-span-2 bg-[#111318] p-10 rounded-[3rem] border border-gray-800 relative">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xs border-l-4 border-blue-500 pl-4 tracking-widest">DARBOĞAZ ANALİZİ (ADET VS SÜRE)</h3>
              <span className="text-[9px] text-red-500 animate-pulse font-black">KRİTİK BÖLGE: SAĞ ÜST KADRAN</span>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis type="number" dataKey="x" name="ARIZA" stroke="#555" fontSize={10} label={{ value: 'ARIZA SAYISI', position: 'insideBottom', offset: -10, fontSize: 8, fill: '#555' }} />
                  <YAxis type="number" dataKey="y" name="SÜRE" stroke="#555" fontSize={10} label={{ value: 'ORT. SÜRE (DK)', angle: -90, position: 'insideLeft', fontSize: 8, fill: '#555' }} />
                  <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '20px', fontSize: '10px'}}
                  />
                  <Scatter name="Varlıklar" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.y > stats.avgTime ? '#ef4444' : '#3b82f6'} 
                        className="cursor-pointer hover:opacity-50 transition-all"
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* 3. EN ÇOK MEŞGUL EDENLER LİSTESİ */}
        <div className="bg-[#111318] p-10 rounded-[3rem] border border-gray-800">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xs tracking-widest border-l-4 border-green-500 pl-4">VARLIK BAZLI OPERASYONEL KAYIP (TOP 10)</h3>
            <span className="text-[10px] text-gray-600 font-black tracking-widest">SÜREYE GÖRE SIRALANMIŞ</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {scatterData.slice(0, 10).map((e: any, idx: number) => (
              <div key={idx} className="bg-black/50 p-8 rounded-[2.5rem] border border-gray-900 hover:border-orange-500/50 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-orange-600 text-black px-4 py-1 text-[8px] rounded-bl-xl font-black">{idx + 1}</div>
                <p className="text-[10px] text-gray-500 mb-6 group-hover:text-white transition-all line-clamp-2 h-8">{e.name}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[8px] text-gray-600">ARIZA</p>
                    <p className="text-2xl text-white">{e.x}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-gray-600">ORT. SÜRE</p>
                    <p className="text-xl text-orange-500">{e.y} <span className="text-[10px]">DK</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      {/* ALT BİLGİ */}
      <div className="mt-12 text-center pb-12">
        <p className="text-[8px] text-gray-700 tracking-[1em]">SAHA 360 // MÜHÜRLENMİŞ VERİ ANALİTİĞİ // {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
