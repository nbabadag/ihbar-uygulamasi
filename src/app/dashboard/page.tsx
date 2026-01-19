'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useEffect, useState, useCallback } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ bekleyen: 0, islemde: 0, tamamlanan: 0 })
  const [ihbarlar, setIhbarlar] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchData = useCallback(async (role: string, id: string) => {
    // İlişki hatasını önlemek için ünlem (!) ile Foreign Key zorlaması yapıyoruz
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
      console.error("Veri çekme hatası:", error.message)
      // Hata durumunda kayıtların kaybolmaması için düz veri çekiyoruz
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

    // Vercel Build Hatası Çözümü: Notification kontrolünü güvenli hale getirdik
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const playAlert = () => {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.play().catch(() => console.log("Ses için etkileşim gerekiyor."))
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
              // Tarayıcı bildirim izni kontrolü
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                new Notification("🔔 YENİ İŞ EMRİ!", {
                  body: `${payload.new.musteri_adi} işi size atandı.`,
                })
              }
            }
            fetchData(userRole, userId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, userRole, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex text-black">
      <div className="w-64 bg-blue-900 text-white p-6 shadow-xl flex flex-col fixed h-full">
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
          <div className="mb-4 p-2 bg-blue-800/50 rounded text-[10px] italic text-blue-200 uppercase font-bold border border-blue-700/50">
            Aktif Rol: {userRole}
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-lg hover:bg-red-700 transition font-bold shadow-lg text-sm">Çıkış Yap</button>
        </div>
      </div>

      <div className="flex-1 p-10 ml-64 font-bold">
        <header className="flex justify-between items-center mb-10 border-b border-gray-200 pb-5">
          <h1 className="text-3xl font-bold text-gray-800">{userRole === 'Admin' ? 'Yönetim Paneli' : 'Görev Listem'}</h1>
          <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            userRole === 'Admin' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-purple-100 text-purple-600 border-purple-200'
          }`}>{userRole}</div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-blue-500 text-blue-600">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">Bekleyen İhbarlar</h3>
            <p className="text-5xl font-black">{stats.bekleyen}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-orange-500 text-orange-500">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-tighter">{userRole === 'Admin' ? 'İşlemde Olanlar' : 'Üzerimdeki İşler'}</h3>
            <p className="text-5xl font-black">{stats.islemde}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-green-500 text-green-500">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">Tamamlananlar</h3>
            <p className="text-5xl font-black">{stats.tamamlanan}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h2 className="text-xl font-bold text-gray-800">{userRole === 'Admin' ? 'Güncel İş Emirleri' : 'Bana Atanan Görevler'}</h2>
            <div className="animate-pulse flex items-center gap-2 text-[10px] font-bold text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span> CANLI TAKİP AKTİF
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Müşteri / Konu</th>
                  <th className="px-6 py-4 text-center">Sorumlu Personel</th>
                  <th className="px-6 py-4 text-center">Durum / IFS</th>
                  <th className="px-6 py-4 text-center">Atama Zamanı</th>
                  <th className="px-6 py-4 text-right">Kapatma Zamanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {ihbarlar.map((ihbar) => (
                  <tr key={ihbar.id} onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="hover:bg-blue-50 transition cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800 group-hover:text-blue-700 transition">{ihbar.musteri_adi}</div>
                      <div className="text-xs text-gray-500 font-medium">{ihbar.konu}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {ihbar.profiles?.full_name ? (
                        <span className="text-[11px] font-black text-gray-700 bg-gray-100 px-3 py-1 rounded-lg border border-gray-200">
                          👤 {ihbar.profiles.full_name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[10px] italic font-bold uppercase">Atama Bekliyor</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm ${
                        ihbar.durum === 'Beklemede' ? 'bg-blue-100 text-blue-700' : 
                        ihbar.durum === 'Islemde' ? 'bg-orange-100 text-orange-700' : 
                        ihbar.durum === 'Calisiliyor' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                        'bg-green-100 text-green-700'
                      }`}>{ihbar.durum}</span>
                      {ihbar.ifs_is_emri_no && <div className="text-[10px] font-mono font-bold text-blue-600 mt-1">IFS: {ihbar.ifs_is_emri_no}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {ihbar.atama_tarihi ? (
                        <div className="text-xs">
                          <div className="font-bold">{new Date(ihbar.atama_tarihi).toLocaleDateString('tr-TR')}</div>
                          <div className="text-gray-400 font-mono text-[10px] font-black">{new Date(ihbar.atama_tarihi).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      ) : <span className="text-gray-300 text-[10px] italic font-bold">Atanmadı</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {ihbar.durum === 'Tamamlandi' && ihbar.kapatma_tarihi ? (
                        <div className="text-xs">
                          <div className="font-bold text-green-600 font-black">{new Date(ihbar.kapatma_tarihi).toLocaleDateString('tr-TR')}</div>
                          <div className="text-gray-400 font-mono text-[10px] font-black">{ihbar.bitis_saati || '---'}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-[10px] italic font-medium text-orange-400 font-bold uppercase">
                          {ihbar.durum === 'Calisiliyor' ? '👷 Çalışma Başladı' : 'Devam Ediyor'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {ihbarlar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-gray-400 italic font-bold tracking-tight">Kayıt Bulunmuyor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}