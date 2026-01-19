'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function TVIzlemePage() {
  const router = useRouter()
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  
  // Otomatik kaydırma için referanslar
  const scrollRef1 = useRef<HTMLDivElement>(null)
  const scrollRef2 = useRef<HTMLDivElement>(null)

  // 🛡️ YETKİ KONTROLÜ VE GİRİŞ ENGELİ
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = (profile?.role || '').toLowerCase()

      // Ali Usta (Saha/Teknik/Personel) ise Dashboard'a geri gönder
      const isRestricted = role.includes('saha') || role.includes('teknik') || role.includes('personel') || role.includes('usta')
      const isFormen = role.includes('formen')

      if (isRestricted && !isFormen) {
        alert("Bu ekrana erişim yetkiniz bulunmamaktadır.")
        router.push('/dashboard')
      } else {
        setMounted(true)
      }
    }
    checkAccess()
  }, [router])

  // Hydration ve Zamanlayıcı
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 🔄 OTOMATİK KAYDIRMA MANTIĞI (TV İÇİN)
  useEffect(() => {
    const scrollInterval = setInterval(() => {
      [scrollRef1, scrollRef2].forEach(ref => {
        if (ref.current) {
          const { scrollTop, scrollHeight, clientHeight } = ref.current
          if (scrollTop + clientHeight >= scrollHeight - 1) {
            ref.current.scrollTo({ top: 0, behavior: 'smooth' })
          } else {
            ref.current.scrollBy({ top: 1, behavior: 'auto' })
          }
        }
      })
    }, 50) // Kaydırma hızı
    return () => clearInterval(scrollInterval)
  }, [mounted])

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('ihbarlar').select(`
      *,
      profiles (full_name),
      calisma_gruplari (grup_adi)
    `).order('created_at', { ascending: false })
    
    if (data) setIhbarlar(data)
  }, [])

  useEffect(() => {
    if (!mounted) return
    fetchData()
    const channel = supabase.channel('tv-modu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData, mounted])

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

  if (!mounted) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black italic uppercase animate-pulse">Yetki Kontrol Ediliyor...</div>

  const TVCard = ({ job }: { job: any }) => {
    const diff = (now.getTime() - new Date(job.created_at).getTime()) / 60000
    const isDelayed = job.durum === 'Beklemede' && diff >= 30
    return (
      <div className={`p-4 rounded-[1.2rem] border-4 mb-2 shadow-lg transition-all ${
        isDelayed ? 'bg-red-600 border-red-400 animate-pulse text-white' : 'bg-white border-transparent text-black'
      }`}>
        <div className="flex justify-between items-center mb-1">
          <h4 className="text-lg font-black uppercase italic tracking-tighter truncate leading-none flex-1">{job.musteri_adi}</h4>
          <span className="text-[10px] font-black opacity-60 ml-2">
            {new Date(job.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className={`text-[11px] font-bold uppercase truncate ${isDelayed ? 'text-red-100' : 'text-gray-500'}`}>{job.konu}</p>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded ${isDelayed ? 'bg-white text-red-600' : 'bg-gray-100 text-gray-400'}`}>
            {Math.floor(diff)} DK
          </span>
        </div>
      </div>
    )
  }

  const CompactCard = ({ job }: { job: any }) => (
    <div className="p-2.5 bg-white/90 rounded-xl border-l-4 border-green-500 mb-1.5 shadow-sm flex justify-between items-center">
      <div className="overflow-hidden flex-1">
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
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-3 bg-blue-700 p-4 rounded-[1.5rem] shadow-2xl border-b-4 border-blue-900">
        <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">SAHA 360 / CANLI İZLEME PANELİ</h1>
        <div className="text-right flex items-center gap-6">
          <div className="text-xs font-bold opacity-70 uppercase tabular-nums">
            {now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} | {now.toLocaleTimeString('tr-TR')}
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-white/10 p-2 px-4 rounded-xl text-[10px] font-black hover:bg-white/20 transition-all">PANELİ KAPAT</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">
        
        {/* 1. SÜTUN: AÇIK İHBARLAR */}
        <div className="flex flex-col bg-yellow-400/5 rounded-[2rem] border-2 border-yellow-400/20 overflow-hidden">
          <div className="p-3 bg-yellow-400 text-yellow-900 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase italic tracking-tighter">🟡 AÇIK İHBARLAR</h2>
            <span className="text-lg font-black">{ihbarlar.filter(i => i.durum === 'Beklemede').length}</span>
          </div>
          <div ref={scrollRef1} className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {ihbarlar.filter(i => i.durum === 'Beklemede').map(job => <TVCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* 2. SÜTUN: İŞLEMDE OLANLAR */}
        <div className="flex flex-col bg-blue-500/5 rounded-[2rem] border-2 border-blue-500/20 overflow-hidden">
          <div className="p-3 bg-blue-600 text-white flex justify-between items-center">
            <h2 className="text-xs font-black uppercase italic tracking-tighter">🔵 İŞLEMDE OLANLAR</h2>
            <span className="text-lg font-black">{ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').length}</span>
          </div>
          <div ref={scrollRef2} className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {ihbarlar.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').map(job => <TVCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* 3. SÜTUN: SON TAMAMLANANLAR */}
        <div className="flex flex-col bg-green-500/5 rounded-[2rem] border-2 border-green-500/20 overflow-hidden">
          <div className="p-3 bg-green-600 text-white flex justify-between items-center">
            <h2 className="text-xs font-black uppercase italic tracking-tighter">🟢 SON TAMAMLANAN</h2>
            <span className="text-lg font-black">{ihbarlar.filter(i => i.durum === 'Tamamlandi').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {ihbarlar.filter(i => i.durum === 'Tamamlandi').slice(0, 15).map(job => <CompactCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* 4. SÜTUN: İSTATİSTİKLER */}
        <div className="flex flex-col gap-3">
          <div className="flex-1 flex flex-col bg-slate-800 rounded-[2rem] border-2 border-slate-700 p-4 shadow-xl">
            <h2 className="text-[10px] font-black text-blue-400 uppercase italic tracking-widest text-center mb-3">📊 BUGÜN</h2>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <StatSquare label="TOPLAM" value={todayStats.toplam} colorClass="text-white" />
              <StatSquare label="BEKLEYEN" value={todayStats.bekleyen} colorClass="text-yellow-400" />
              <StatSquare label="ATANAN" value={todayStats.atanan} colorClass="text-blue-400" />
              <StatSquare label="KAPATILAN" value={todayStats.kapatilan} colorClass="text-green-400" />
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-900 rounded-[2rem] border-2 border-slate-800 p-4 shadow-xl">
            <h2 className="text-[10px] font-black text-orange-400 uppercase italic tracking-widest text-center mb-3">📅 HAFTALIK</h2>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <StatSquare label="TOPLAM" value={weekStats.toplam} colorClass="text-white" />
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