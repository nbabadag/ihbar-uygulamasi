'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function TVIzlemePage() {
  const router = useRouter()
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  // Hydration hatasını önlemek için mounted kontrolü
  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('ihbarlar').select(`
      *,
      profiles (full_name),
      calisma_gruplari (grup_adi)
    `).order('created_at', { ascending: false })
    
    if (data) setIhbarlar(data)
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('tv-modu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  // --- İSTATİSTİK HESAPLAMALARI ---
  const getStats = (items: any[]) => ({
    toplam: items.length,
    bekleyen: items.filter(i => i.durum === 'Beklemede').length,
    atanan: items.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').length,
    kapatilan: items.filter(i => i.durum === 'Tamamlandi').length
  })

  const todayStr = new Date().toISOString().split('T')[0]
  const todayJobs = ihbarlar.filter(i => i.created_at.startsWith(todayStr))
  const todayStats = getStats(todayJobs)

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const weekJobs = ihbarlar.filter(i => new Date(i.created_at) >= oneWeekAgo)
  const weekStats = getStats(weekJobs)

  // Sayfa yüklenmeden (hydration bitmeden) hiçbir şey render etme
  if (!mounted) return null

  // --- BİLEŞENLER ---
  const TVCard = ({ job }: { job: any }) => {
    const diff = (now.getTime() - new Date(job.created_at).getTime()) / 60000
    const isDelayed = job.durum === 'Beklemede' && diff >= 30
    return (
      <div className={`p-4 rounded-[1.2rem] border-4 mb-2 shadow-lg ${
        isDelayed ? 'bg-red-600 border-red-400 animate-pulse text-white' : 'bg-white border-transparent text-black'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <h4 className="text-lg font-black uppercase italic tracking-tighter truncate leading-none">{job.musteri_adi}</h4>
          <span className="text-xs font-black opacity-60">
            {new Date(job.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
          </span>
        </div>
        <p className={`text-[11px] font-bold uppercase truncate ${isDelayed ? 'text-red-100' : 'text-gray-500'}`}>{job.konu}</p>
      </div>
    )
  }

  const CompactCard = ({ job }: { job: any }) => (
    <div className="p-2.5 bg-white/90 rounded-xl border-l-4 border-green-500 mb-1.5 shadow-sm flex justify-between items-center">
      <div className="overflow-hidden">
        <h4 className="text-[11px] font-black uppercase italic text-gray-800 truncate leading-none">{job.musteri_adi}</h4>
        <p className="text-[9px] font-bold text-gray-500 uppercase truncate mt-0.5">{job.konu}</p>
      </div>
      <div className="text-[10px] font-black text-green-600 ml-2">OK</div>
    </div>
  )

  const StatSquare = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="bg-slate-900/50 border border-slate-700 p-3 rounded-2xl flex flex-col justify-center items-center text-center">
      <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1">{label}</span>
      <span className={`text-2xl font-black italic tracking-tighter ${colorClass}`}>{value}</span>
    </div>
  )

  return (
    <div className="h-screen w-screen bg-slate-950 p-3 flex flex-col font-sans overflow-hidden text-white relative">
      
      {/* 🟢 GERİ DÖN BUTONU */}
      <button 
        onClick={() => router.push('/dashboard')}
        className="absolute top-6 left-6 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-white/20 font-black text-[10px] uppercase tracking-widest transition-all opacity-20 hover:opacity-100 flex items-center gap-2 group"
      >
        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> GERİ DÖN
      </button>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-3 bg-blue-700 p-4 rounded-[1.5rem] shadow-2xl border-b-4 border-blue-900">
        <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none ml-28 lg:ml-0 transition-all">SAHA 360 / CANLI İZLEME</h1>
        <div className="text-right flex items-center gap-6">
          <div className="text-xs font-bold opacity-70 uppercase">
            {now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className="text-2xl font-black tabular-nums leading-none">
            {now.toLocaleTimeString('tr-TR')}
          </div>
        </div>
      </div>

      {/* 4 SÜTUNLU YAPI */}
      <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">
        
        {/* 1. SÜTUN: SARI */}
        <div className="flex flex-col bg-yellow-400/5 rounded-[2rem] border-2 border-yellow-400/20 overflow-hidden text-black">
          <div className="p-3 bg-yellow-400 text-yellow-900 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase italic tracking-tighter">🟡 AÇIK İHBARLAR</h2>
            <span className="text-lg font-black">{ihbarlar.filter(i => i.durum === 'Beklemede').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {ihbarlar.filter(i => i.durum === 'Beklemede').map(job => <TVCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* 2. SÜTUN: MAVİ */}
        <div className="flex flex-col bg-blue-500/5 rounded-[2rem] border-2 border-blue-500/20 overflow-hidden text-black">
          <div className="p-3 bg-blue-600 text-white flex justify-between items-center">
            <h2 className="text-xs font-black uppercase italic tracking-tighter">🔵 İŞLEMDE OLANLAR</h2>
            <span className="text-lg font-black">{ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').map(job => <TVCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* 3. SÜTUN: YEŞİL */}
        <div className="flex flex-col bg-green-500/5 rounded-[2rem] border-2 border-green-500/20 overflow-hidden text-black">
          <div className="p-3 bg-green-600 text-white flex justify-between items-center">
            <h2 className="text-xs font-black uppercase italic tracking-tighter">🟢 SON TAMAMLANAN</h2>
            <span className="text-lg font-black">10</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {ihbarlar.filter(i => i.durum === 'Tamamlandi').slice(0, 10).map(job => <CompactCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* 4. SÜTUN: PERFORMANS KARNESİ */}
        <div className="flex flex-col gap-3">
          
          {/* BUGÜN */}
          <div className="flex-1 flex flex-col bg-slate-800 rounded-[2rem] border-2 border-slate-700 p-4 shadow-xl">
            <h2 className="text-[10px] font-black text-blue-400 uppercase italic tracking-widest text-center mb-3">📊 BUGÜNÜN ÖZETİ</h2>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <StatSquare label="GELEN İŞ" value={todayStats.toplam} colorClass="text-white" />
              <StatSquare label="BEKLEYEN" value={todayStats.bekleyen} colorClass="text-yellow-400" />
              <StatSquare label="ATANAN" value={todayStats.atanan} colorClass="text-blue-400" />
              <StatSquare label="KAPATILAN" value={todayStats.kapatilan} colorClass="text-green-400" />
            </div>
          </div>

          {/* BU HAFTA */}
          <div className="flex-1 flex flex-col bg-slate-900 rounded-[2rem] border-2 border-slate-800 p-4 shadow-xl text-white">
            <h2 className="text-[10px] font-black text-orange-400 uppercase italic tracking-widest text-center mb-3">📅 BU HAFTANIN ÖZETİ</h2>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <StatSquare label="GELEN İŞ" value={weekStats.toplam} colorClass="text-white" />
              <StatSquare label="BEKLEYEN" value={weekStats.bekleyen} colorClass="text-yellow-400" />
              <StatSquare label="ATANAN" value={weekStats.atanan} colorClass="text-blue-400" />
              <StatSquare label="KAPATILAN" value={weekStats.kapatilan} colorClass="text-green-400" />
            </div>
          </div>

        </div>

      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}