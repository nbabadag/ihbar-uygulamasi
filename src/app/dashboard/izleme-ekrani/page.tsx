'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function TVIzlemePage() {
  const router = useRouter()
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  
  const scrollRef1 = useRef<HTMLDivElement>(null)
  const scrollRef2 = useRef<HTMLDivElement>(null)
  const scrollRef3 = useRef<HTMLDivElement>(null)

  // 🔋 7/24 KESİNTİSİZ ÇALIŞMA
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    const autoRefresh = setTimeout(() => window.location.reload(), 1000 * 60 * 60 * 12)
    return () => { clearInterval(timer); clearTimeout(autoRefresh); };
  }, []);

  const fetchData = useCallback(async () => {
    const { data } = await supabase.from('ihbarlar').select(`
      *, 
      profiles:atanan_personel (full_name), 
      calisma_gruplari:atanan_grup_id (grup_adi)
    `).order('created_at', { ascending: false });
    if (data) setIhbarlar(data)
  }, [])

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return; }
      setMounted(true)
    }
    checkAccess(); fetchData();
    const channel = supabase.channel('tv-modu').on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => fetchData()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData, router])

  // 🔄 OTOMATİK YUKARI KAYDIRMA
  useEffect(() => {
    if (!mounted) return;
    const scrollInterval = setInterval(() => {
      [scrollRef1, scrollRef2, scrollRef3].forEach(ref => {
        if (ref.current) {
          const { scrollTop, scrollHeight, clientHeight } = ref.current
          if (scrollTop + clientHeight >= scrollHeight - 1) {
            ref.current.scrollTo({ top: 0, behavior: 'smooth' })
          } else { ref.current.scrollBy({ top: 1, behavior: 'auto' }) }
        }
      })
    }, 45)
    return () => clearInterval(scrollInterval)
  }, [mounted])

  // 📊 İSTATİSTİK MANTIKLARI
  const getStats = (items: any[]) => ({
    bekleyen: items.filter(i => (i.durum || '').toLowerCase().includes('beklemede')).length,
    islemde: items.filter(i => {
      const d = (i.durum || '').toLowerCase();
      return d.includes('islemde') || d.includes('calisiliyor') || d.includes('durduruldu');
    }).length,
    tamamlanan: items.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi')).length
  })

  const todayStr = now.toISOString().split('T')[0]
  const startOfWeek = new Date(); startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthName = now.toLocaleDateString('tr-TR', { month: 'long' }).toUpperCase();

  const dailyStats = getStats(ihbarlar.filter(i => i.created_at.startsWith(todayStr)))
  const weeklyStats = getStats(ihbarlar.filter(i => new Date(i.created_at) >= startOfWeek))
  const monthlyStats = getStats(ihbarlar.filter(i => new Date(i.created_at) >= startOfMonth))

  const TVCard = ({ job }: { job: any }) => {
    const diff = (now.getTime() - new Date(job.created_at).getTime()) / 60000
    const durum = (job.durum || '').toLowerCase();
    const isNew = diff <= 5 && durum.includes('beklemede')
    const isDelayed = durum.includes('beklemede') && diff >= 30
    const isDurduruldu = durum.includes('durduruldu');
    
    let sahaDurumYazisi = "ATAMA BEKLENİYOR";
    let durumRengi = "text-blue-600";
    if (job.varis_tarihi) { sahaDurumYazisi = "🔧 ARIZA BAŞINDA"; durumRengi = "text-yellow-600"; }
    else if (job.kabul_tarihi) { sahaDurumYazisi = "🚛 EKİP YOLDA"; durumRengi = "text-orange-600"; }

    return (
      <div className={`p-4 rounded-[1.5rem] border-l-[12px] mb-3 shadow-2xl transition-all ${
        isNew ? 'bg-red-600 border-white animate-pulse text-white' : 
        isDurduruldu ? 'bg-slate-800 border-red-600 text-gray-400' :
        isDelayed ? 'bg-red-900 border-red-500 text-white' : 'bg-white border-blue-600 text-black'
      }`}>
        <div className="flex justify-between items-start mb-1">
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xl font-black uppercase italic tracking-tighter truncate leading-tight">{isNew && "🚨 "}{job.ihbar_veren_ad_soyad}</h4>
            {job.secilen_nesne_adi && <div className={`text-[11px] font-black italic uppercase ${isNew || isDelayed ? 'text-white' : 'text-orange-600'}`}>⚙️ {job.secilen_nesne_adi}</div>}
          </div>
          <span className="text-[12px] font-black opacity-60 ml-2">{new Date(job.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
        
        {/* 👥 YARDIMCI PERSONELLER (SAHA) */}
        {job.yardimcilar && job.yardimcilar.length > 0 && (
          <div className={`text-[9px] font-black mb-1 italic uppercase ${isNew || isDelayed ? 'text-white/80' : 'text-gray-500'}`}>
            👥 EKİP: {job.yardimcilar.join(', ')}
          </div>
        )}

        <p className={`text-[12px] font-bold uppercase truncate mb-2 ${isNew || isDelayed ? 'text-red-100' : 'text-gray-500'}`}>{job.konu}</p>
        <div className={`text-[10px] font-black italic uppercase mb-2 px-2 py-1 rounded-lg ${isNew ? 'bg-white text-red-600' : 'bg-gray-100'} ${isDelayed ? 'bg-red-700 text-white' : durumRengi}`}>
           {isDurduruldu ? '🛑 İŞ DURDURULDU' : sahaDurumYazisi}
        </div>
        <div className={`text-[11px] font-black uppercase italic border-t pt-2 flex justify-between items-center ${isNew || isDelayed ? 'border-red-400/50' : 'border-gray-200 text-blue-800'}`}>
           <span>👤 {job.profiles?.full_name || job.calisma_gruplari?.grup_adi || 'HAVUZ'}</span>
           <span className="opacity-50">#{job.ifs_is_emri_no || job.id}</span>
        </div>
      </div>
    )
  }

  const StatBox = ({ label, stats, color }: { label: string, stats: any, color: string }) => (
    <div className="bg-[#1a1c23] rounded-[2rem] p-4 border-2 border-slate-800 shadow-2xl flex flex-col gap-2">
      <h2 className={`${color} text-[10px] tracking-[0.2em] text-center mb-1 font-black`}>{label}</h2>
      <div className="grid grid-cols-3 gap-1 text-center tabular-nums">
        <div className="bg-black/30 p-2 rounded-xl border border-white/5"><p className="text-[7px] opacity-40">BEK</p><p className="text-xl text-yellow-500">{stats.bekleyen}</p></div>
        <div className="bg-black/30 p-2 rounded-xl border border-white/5"><p className="text-[7px] opacity-40">İŞL</p><p className="text-xl text-blue-500">{stats.islemde}</p></div>
        <div className="bg-black/30 p-2 rounded-xl border border-white/5"><p className="text-[7px] opacity-40">BİT</p><p className="text-xl text-green-500">{stats.tamamlanan}</p></div>
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <div className="h-screen w-screen bg-black p-4 flex flex-col font-sans overflow-hidden text-white italic font-black uppercase">
      
      {/* 🟠 HEADER (TURUNCU) */}
      <div className="flex justify-between items-center mb-4 bg-[#1a1c23] p-5 rounded-[2rem] border-b-4 border-orange-600 shadow-2xl">
        <div className="flex flex-col"><h1 className="text-3xl text-orange-500">SAHA 360 // OPERASYON İZLEME</h1><p className="text-[10px] opacity-50 tracking-[0.3em]">KOMUTA MERKEZİ</p></div>
        <div className="flex items-center gap-10">
          <div className="text-right tabular-nums"><div className="text-2xl text-orange-500 font-black italic uppercase">{now.toLocaleTimeString('tr-TR')}</div><div className="text-[10px] text-orange-400 opacity-80 font-black italic uppercase">{now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 p-4 px-8 rounded-2xl text-[12px] border-b-4 border-orange-900 shadow-xl font-black italic uppercase">ANA SAYFA</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        
        {/* SÜTUN 1: BEKLEYENLER */}
        <div className="flex flex-col bg-[#1a1c23] rounded-[2.5rem] border-2 border-yellow-500/20 overflow-hidden shadow-inner font-black italic uppercase">
          <div className="p-4 bg-yellow-500 text-yellow-950 flex justify-between items-center shadow-lg font-black italic uppercase"><h2 className="text-sm">🟡 HAVUZDAKİLER</h2><span className="text-2xl">{dailyStats.bekleyen}</span></div>
          <div ref={scrollRef1} className="flex-1 overflow-y-auto p-3 scrollbar-hide">
            {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('beklemede') && !i.atanan_personel).map(job => <TVCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* SÜTUN 2: AKTİF SAHA */}
        <div className="flex flex-col bg-[#1a1c23] rounded-[2.5rem] border-2 border-blue-500/20 overflow-hidden shadow-inner font-black italic uppercase">
          <div className="p-4 bg-blue-600 text-white flex justify-between items-center shadow-lg font-black italic uppercase"><h2 className="text-sm">🔵 SAHA EKİPLERİ</h2><span className="text-2xl">{dailyStats.islemde}</span></div>
          <div ref={scrollRef2} className="flex-1 overflow-y-auto p-3 scrollbar-hide font-black italic uppercase">
            {ihbarlar.filter(i => !i.durum?.toLowerCase().includes('tamamlandi') && (i.atanan_personel || i.atanan_grup_id)).map(job => <TVCard key={job.id} job={job} />)}
          </div>
        </div>

        {/* SÜTUN 3: TAMAMLANANLAR (BUGÜN) */}
        <div className="flex flex-col bg-[#1a1c23] rounded-[2.5rem] border-2 border-green-500/20 overflow-hidden shadow-inner font-black italic uppercase">
          <div className="p-4 bg-green-600 text-white flex justify-between items-center shadow-lg font-black italic uppercase font-black italic uppercase"><h2 className="text-sm">🟢 BUGÜN BİTENLER</h2><span className="text-2xl font-black italic uppercase font-black italic uppercase">{dailyStats.tamamlanan}</span></div>
          <div ref={scrollRef3} className="flex-1 overflow-y-auto p-3 scrollbar-hide">
            {ihbarlar.filter(i => (i.durum || '').toLowerCase().includes('tamamlandi') && i.created_at.startsWith(todayStr)).map(job => (
              <div key={job.id} className="bg-white text-black p-3 rounded-2xl border-l-8 border-green-500 mb-2 shadow-md flex flex-col">
                <div className="flex justify-between items-center font-black italic uppercase"><h4 className="text-[12px] font-black italic uppercase truncate leading-none">{job.ihbar_veren_ad_soyad}</h4><div className="text-[10px] font-black text-green-600 italic uppercase">OK</div></div>
                <p className="text-[9px] opacity-60 italic uppercase mt-1">⚙️ {job.secilen_nesne_adi}</p>
                {/* 👥 YARDIMCI PERSONELLER (TAMAMLANAN) */}
                {job.yardimcilar && job.yardimcilar.length > 0 && (
                  <p className="text-[8px] font-black text-gray-500 mt-1 border-t border-gray-100 pt-1 uppercase">👥 EKİP: {job.yardimcilar.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 📊 SAĞ TARAF: İSTATİSTİKLER VE LOGO */}
        <div className="flex flex-col gap-3 overflow-hidden min-h-0 font-black italic uppercase font-black italic uppercase">
          <StatBox label="📊 GÜNÜN ÖZETİ" stats={dailyStats} color="text-orange-500" />
          <StatBox label="📅 HAFTANIN ÖZETİ" stats={weeklyStats} color="text-orange-400" />
          <StatBox label={`🌙 ${currentMonthName} ÖZETİ`} stats={monthlyStats} color="text-orange-300" />

          {/* 🖼️ LOGO ALANI (ANA SAYFA RENGİ) */}
          <div className="bg-[#1a1c23] rounded-[2.5rem] border-2 border-orange-500 flex-1 flex items-center justify-center p-6 shadow-2xl overflow-hidden">
             <img src="/logo.png" alt="Logo" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      </div>

      <style jsx>{` .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } `}</style>
    </div>
  )
}