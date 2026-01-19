'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useCallback } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchData = useCallback(async (role: string, id: string) => {
    let query = supabase.from('ihbarlar').select(`
      *,
      profiles!atanan_personel (
        full_name
      )
    `)
    
    if (role !== 'Admin') {
      query = query.eq('atanan_personel', id)
    }
    
    const { data: ihbarData, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      const { data: fallbackData } = await supabase.from('ihbarlar').select('*').order('created_at', { ascending: false })
      if (fallbackData) setIhbarlar(fallbackData)
      return
    }

    if (ihbarData) {
      setIhbarlar(ihbarData)
      setStats({
        bekleyen: ihbarData.filter(i => i.durum === 'Beklemede').length,
        islemde: ihbarData.filter(i => i.durum === 'Islemde' || i.durum === 'Calisiliyor').length,
        tamamlanan: ihbarData.filter(i => i.durum === 'Tamamlandi').length
      })
    }
  }, [])

  useEffect(() => {
    const checkUserAndInitialFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        const role = profile?.role || 'Personel'
        setUserRole(role)
        fetchData(role, user.id)
      } else {
        router.push('/')
      }
    }
    checkUserAndInitialFetch()
  }, [router, fetchData])

  useEffect(() => {
    if (!userId || !userRole) return

    // Vercel Build Hatası Çözümü
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission()
      }
    }

    const playAlert = () => {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.play().catch(() => console.log("Ses çalmak için etkileşim gerekiyor."))
    }

    const channel = supabase
      .channel('canli-is-takibi')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ihbarlar' },
        (payload: any) => {
          const isTargeted = payload.new && payload.new.atanan_personel === userId;
          if (isTargeted || userRole === 'Admin') {
            if (payload.old && payload.old.durum === 'Beklemede' && payload.new.durum === 'Islemde') {
              playAlert()
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                new Notification("🔔 YENİ İŞ EMRİ!", { body: `${payload.new.musteri_adi} işi size atandı.` })
              }
            }
            fetchData(userRole, userId)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, userRole, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex text-black">
      {/* Sol Menü - MOBİLDE GİZLENDİ (hidden), MASAÜSTÜNDE GÖRÜNÜR (md:flex) */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full">
        <h2 className="text-xl font-bold mb-8 italic underline decoration-blue-400 tracking-wider uppercase">İhbar Paneli</h2>
        <nav className="space-y-4 flex-1">
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-lg cursor-pointer shadow-md flex items-center gap-2 hover:bg-blue-700 transition font-bold text-sm text-white">🏠 Ana Sayfa</div>
          {userRole === 'Admin' && (
            <>
              <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition text-white flex items-center gap-2 text-sm font-black">📢 İhbar Kayıt</div>
              <div onClick={() => router.push('/dashboard/malzeme-yonetimi')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition text-white flex items-center gap-2 text-sm font-black">⚙️ IFS Malzeme Kataloğu</div>
              <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition flex items-center gap-2 bg-green-800/50 text-sm font-black text-white">📊 Raporlama</div>
            </>
          )}
        </nav>
        <div className="mt-auto">
          <div className="mb-4 p-2 bg-blue-800/50 rounded text-[10px] italic text-blue-200 uppercase font-bold border border-blue-700/50">Aktif Rol: {userRole}</div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-lg hover:bg-red-700 transition font-bold shadow-lg text-sm">Çıkış Yap</button>
        </div>
      </div>

      {/* Ana İçerik Alanı - MOBİLDE BOŞLUKSUZ (ml-0), MASAÜSTÜNDE (md:ml-64) */}
      <div className="flex-1 p-4 md:p-10 ml-0 md:ml-64 font-bold">
        <header className="flex justify-between items-center mb-6 md:mb-10 border-b border-gray-200 pb-5">
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">{userRole === 'Admin' ? 'Yönetim Paneli' : 'Görev Listem'}</h1>
          <div className="md:hidden bg-blue-900 text-white p-2 rounded text-xs" onClick={handleLogout}>Çıkış</div>
          <div className={`hidden md:block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            userRole === 'Admin' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-purple-100 text-purple-600 border-purple-200'
          }`}>{userRole}</div>
        </header>

        {/* İstatistik Kartları - Mobilde Tek Sütun */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
          <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border-l-8 border-blue-500 text-blue-600">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">Bekleyen</h3>
            <p className="text-3xl md:text-5xl font-black">{stats.bekleyen}</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border-l-8 border-orange-500 text-orange-500">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-tighter">İşlemde</h3>
            <p className="text-3xl md:text-5xl font-black">{stats.islemde}</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border-l-8 border-green-500 text-green-500">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">Tamamlanan</h3>
            <p className="text-3xl md:text-5xl font-black">{stats.tamamlanan}</p>
          </div>
        </div>

        {/* İş Emirleri Tablosu - Yana Kaydırılabilir (overflow-x-auto) */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <div className="p-4 md:p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h2 className="text-lg md:text-xl font-bold text-gray-800">İş Emirleri</h2>
            <div className="animate-pulse flex items-center gap-2 text-[10px] font-bold text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span> CANLI
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-4 py-4">Müşteri</th>
                  <th className="px-4 py-4 text-center">Sorumlu</th>
                  <th className="px-4 py-4 text-center">Durum</th>
                  <th className="px-4 py-4 text-right">Kapatma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {ihbarlar.map((ihbar) => (
                  <tr key={ihbar.id} onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="hover:bg-blue-50 transition cursor-pointer group">
                    <td className="px-4 py-4">
                      <div className="font-bold text-gray-800 text-sm">{ihbar.musteri_adi}</div>
                      <div className="text-[10px] text-gray-500 font-medium">{ihbar.konu}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[10px] font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg border">
                        👤 {ihbar.profiles?.full_name?.split(' ')[0] || "---"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase shadow-sm ${
                        ihbar.durum === 'Beklemede' ? 'bg-blue-100 text-blue-700' : 
                        ihbar.durum === 'Islemde' ? 'bg-orange-100 text-orange-700' : 
                        ihbar.durum === 'Calisiliyor' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                        'bg-green-100 text-green-700'
                      }`}>{ihbar.durum}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-[10px]">
                      {ihbar.durum === 'Tamamlandi' ? (
                        <span className="text-green-600 font-black">{new Date(ihbar.kapatma_tarihi).toLocaleDateString('tr-TR')}</span>
                      ) : (
                        <span className="text-orange-400 font-bold uppercase">{ihbar.durum === 'Calisiliyor' ? '👷 Başladı' : 'Devam'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}