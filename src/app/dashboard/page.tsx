'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  
  const lastCountRef = useRef<number>(0)

  // ROL KONTROLÜ (Büyük harf ve boşlukları temizleyerek en güvenli hale getirdik)
  const normalizedRole = userRole?.trim().toUpperCase() || '';
  const canCreateJob = ['ADMIN', 'ÇAĞRI MERKEZİ', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR'].includes(normalizedRole);
  const seePool = ['ADMIN', 'FORMEN', 'MÜHENDİS-YÖNETİCİ', 'MÜDÜR', 'ÇAĞRI MERKEZİ'].includes(normalizedRole);

  const fetchData = useCallback(async (role: string, id: string) => {
    if (!role || !id) return;
    let query = supabase.from('ihbarlar').select(`*, profiles (full_name), calisma_gruplari (grup_adi)`)
    if (role.trim().toUpperCase() === 'SAHA PERSONELI') {
      query = query.eq('atanan_personel', id)
    } 
    const { data: ihbarData } = await query.order('created_at', { ascending: false })
    if (ihbarData) {
      setIhbarlar(ihbarData)
      setStats({
        bekleyen: ihbarData.filter(i => i.durum === 'Beklemede').length,
        islemde: ihbarData.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor' || i.durum === 'Durduruldu').length,
        tamamlanan: ihbarData.filter(i => i.durum === 'Tamamlandi').length
      })
    }
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        setUserName(profile?.full_name || 'Kullanıcı')
        setUserRole(profile?.role || 'Saha Personeli')
        fetchData(profile?.role || 'Saha Personeli', user.id)
      } else {
        router.push('/')
      }
    }
    checkUser()
  }, [router, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const JobCard = ({ ihbar }: { ihbar: any }) => {
    const diff = (now.getTime() - new Date(ihbar.created_at).getTime()) / 60000
    return (
      <div onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="p-4 rounded-2xl shadow-sm border mb-3 bg-white border-gray-100 text-black cursor-pointer active:scale-95 transition-all">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] font-black italic text-blue-500">#{ihbar.ifs_is_emri_no || 'IFS YOK'}</span>
          <span className="text-[9px] font-bold text-gray-400">{new Date(ihbar.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="font-black text-[12px] uppercase leading-tight text-gray-800">{ihbar.musteri_adi}</div>
        <div className="text-[10px] font-bold uppercase mb-3 truncate italic text-gray-500">{ihbar.konu}</div>
        <div className="flex justify-between items-center text-[9px] font-bold opacity-60">
           <span>👤 {ihbar.profiles?.full_name?.split(' ')[0] || 'HAVUZ'}</span>
           <span>⏱️ {Math.floor(diff)} dk</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row text-black font-sans">
      
      {/* 📱 MOBİL HEADER */}
      <div className="md:hidden bg-blue-950 text-white p-4 sticky top-0 z-50 shadow-xl border-b border-blue-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-black italic text-blue-400 uppercase">Saha 360</h2>
          <div className="flex gap-2">
            <button onClick={() => router.push('/dashboard/saha-haritasi')} className="bg-blue-600 p-2 rounded-xl text-[10px] font-black uppercase">🛰️ Harita</button>
            <button onClick={handleLogout} className="bg-red-600 p-2 rounded-xl text-[10px] font-black uppercase">Çıkış</button>
          </div>
        </div>
      </div>

      {/* 💻 PC SOL MENÜ (SIDEBAR) */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full z-50">
        <h2 className="text-xl font-black mb-8 italic uppercase text-blue-100 tracking-tighter">Saha 360</h2>
        
        <nav className="space-y-3 flex-1 font-bold text-sm">
          
          {/* HARİTA BUTONU: ŞARTSIZ, EN ÜSTTE VE TURUNCU */}
          <div 
            onClick={() => router.push('/dashboard/saha-haritasi')} 
            className="p-4 bg-orange-600 hover:bg-orange-700 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border border-orange-400 shadow-lg animate-pulse mb-4"
          >
            <span className="text-xl">🛰️</span>
            <span className="font-black uppercase italic text-xs">Saha Haritası</span>
          </div>

          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-xl cursor-pointer flex items-center gap-2 border-l-4 border-blue-400">🏠 Ana Sayfa</div>
          
          {canCreateJob && <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer uppercase text-[11px]">📢 İhbar Kayıt</div>}
          <div onClick={() => router.push('/dashboard/personel-yonetimi')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer uppercase text-[11px]">👤 Personel Yönetimi</div>
          <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-blue-800 rounded-xl cursor-pointer uppercase text-[11px]">📊 Raporlama</div>
        </nav>

        <div className="mt-auto border-t border-blue-800 pt-4 space-y-4">
          <div className="bg-blue-950/50 p-3 rounded-2xl border border-blue-800/50">
            <span className="text-[11px] font-black text-white truncate uppercase italic block">{userName}</span>
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{userRole}</span>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-xl font-black text-xs uppercase italic">Çıkış Yap</button>
        </div>
      </div>

      {/* ANA İÇERİK ALANI */}
      <div className="flex-1 p-4 md:p-8 ml-0 md:ml-64 font-bold flex flex-col gap-6">
        
        {/* HARİTA WIDGET (ANA EKRAN PENCERESİ) */}
        {normalizedRole !== 'SAHA PERSONELI' && (
          <div className="w-full bg-white rounded-[2.5rem] border-2 border-gray-200 overflow-hidden shadow-sm hidden md:block">
            <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase italic tracking-widest text-white">🛰️ CANLI SAHA DURUMU</h3>
              <button onClick={() => router.push('/dashboard/saha-haritasi')} className="text-[9px] bg-blue-600 px-3 py-1 rounded-full font-black text-white">TAM EKRAN HARİTA →</button>
            </div>
            <div className="h-[280px] bg-gray-100">
               <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'grayscale(0.2)' }} src="https://www.google.com/maps?q=$" allowFullScreen></iframe>
            </div>
          </div>
        )}

        {/* LİSTELER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col bg-yellow-50 p-4 rounded-[2rem] border-2 border-yellow-200 h-[500px] overflow-hidden">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-yellow-700">🟡 Havuz ({stats.bekleyen})</h3>
            <div className="overflow-y-auto">{ihbarlar.filter(i => i.durum === 'Beklemede').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
          <div className="flex flex-col bg-blue-50 p-4 rounded-[2rem] border-2 border-blue-200 h-[500px] overflow-hidden">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-blue-700">🔵 İşlemde ({stats.islemde})</h3>
            <div className="overflow-y-auto">{ihbarlar.filter(i => i.durum !== 'Beklemede' && i.durum !== 'Tamamlandi').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
          <div className="flex flex-col bg-green-50 p-4 rounded-[2rem] border-2 border-green-200 h-[500px] overflow-hidden">
            <h3 className="text-[11px] font-black uppercase italic mb-4 text-green-700">🟢 Biten ({stats.tamamlanan})</h3>
            <div className="overflow-y-auto">{ihbarlar.filter(i => i.durum === 'Tamamlandi').map(i => <JobCard key={i.id} ihbar={i} />)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
