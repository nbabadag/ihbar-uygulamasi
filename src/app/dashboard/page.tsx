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

  // Yetki Grupları
  const canCreateJob = ['Çağrı Merkezi', 'Formen', 'Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole || '')
  const canManageUsers = ['Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole || '')
  const canSeeReports = ['Formen', 'Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole || '')
  const canManageMaterials = userRole !== 'Saha Personeli'

  const fetchData = useCallback(async (role: string, id: string) => {
    let query = supabase.from('ihbarlar').select(`
      *,
      profiles!atanan_personel (
        full_name
      )
    `)
    
    // Saha Personeli sadece kendisine atananları, diğerleri her şeyi görür
    if (role === 'Saha Personeli') {
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
        const role = profile?.role || 'Saha Personeli'
        setUserRole(role)
        fetchData(role, user.id)
      } else {
        router.push('/')
      }
    }
    checkUserAndInitialFetch()
  }, [router, fetchData])

  // Real-time ve Bildirimler (Mevcut yapı korundu)
  useEffect(() => {
    if (!userId || !userRole) return
    const channel = supabase
      .channel('canli-is-takibi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ihbarlar' }, () => {
        fetchData(userRole, userId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, userRole, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-black">
      
      {/* SOL MENÜ - Dinamik Yetkilendirme */}
      <div className="hidden md:flex w-64 bg-blue-900 text-white p-6 shadow-xl flex-col fixed h-full">
        <h2 className="text-xl font-bold mb-8 italic underline decoration-blue-400 tracking-wider uppercase font-black text-blue-100">İhbar Paneli</h2>
        <nav className="space-y-4 flex-1">
          <div onClick={() => router.push('/dashboard')} className="p-3 bg-blue-800 rounded-lg cursor-pointer flex items-center gap-2 hover:bg-blue-700 transition font-bold text-sm">🏠 Ana Sayfa</div>
          
          {canCreateJob && (
            <div onClick={() => router.push('/dashboard/yeni-ihbar')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition flex items-center gap-2 text-sm font-bold">📢 İhbar Kayıt</div>
          )}
          
          {canManageUsers && (
            <div onClick={() => router.push('/dashboard/kullanici-ekle')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition flex items-center gap-2 text-sm font-bold">👤 Kullanıcı Ekle</div>
          )}

          {canManageMaterials && (
            <div onClick={() => router.push('/dashboard/malzeme-yonetimi')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition flex items-center gap-2 text-sm font-bold">⚙️ Malzeme Kataloğu</div>
          )}

          {canSeeReports && (
            <div onClick={() => router.push('/dashboard/raporlar')} className="p-3 hover:bg-blue-800 rounded-lg cursor-pointer transition flex items-center gap-2 bg-green-800/50 text-sm font-bold">📊 Raporlama</div>
          )}
        </nav>
        <div className="mt-auto border-t border-blue-800 pt-4">
          <p className="text-[10px] text-blue-300 mb-2 uppercase font-black">Yetki: {userRole}</p>
          <button onClick={handleLogout} className="w-full bg-red-600 p-3 rounded-lg hover:bg-red-700 transition font-bold shadow-lg text-sm">Çıkış Yap</button>
        </div>
      </div>

      {/* ANA İÇERİK ALANI */}
      <div className="flex-1 p-4 md:p-10 ml-0 md:ml-64 font-bold">
        
        {/* MOBİL ÜST BAR */}
        <div className="md:hidden flex justify-between items-center mb-6 bg-blue-900 p-4 rounded-2xl text-white shadow-xl border-b-4 border-blue-700">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-blue-300 tracking-widest">{userRole}</span>
            <span className="text-sm font-black italic tracking-tighter uppercase">Saha Yönetimi</span>
          </div>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95">Çıkış</button>
        </div>

        {/* MOBİL HIZLI ERİŞİM (Dinamik) */}
        <div className="md:hidden grid grid-cols-3 gap-2 mb-6">
          {canCreateJob && (
            <button onClick={() => router.push('/dashboard/yeni-ihbar')} className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95 border-b-4 border-blue-800">
              <span className="text-xl">📢</span>
              <span className="text-[9px] font-black uppercase leading-none">İhbar</span>
            </button>
          )}
          {canManageUsers && (
            <button onClick={() => router.push('/dashboard/kullanici-ekle')} className="bg-purple-600 text-white p-3 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95 border-b-4 border-purple-800">
              <span className="text-xl">👤</span>
              <span className="text-[9px] font-black uppercase leading-none text-center">Personel<br/>Ekle</span>
            </button>
          )}
          {canSeeReports && (
            <button onClick={() => router.push('/dashboard/raporlar')} className="bg-green-600 text-white p-3 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95 border-b-4 border-green-800">
              <span className="text-xl">📊</span>
              <span className="text-[9px] font-black uppercase leading-none">Rapor</span>
            </button>
          )}
        </div>

        {/* İSTATİSTİKLER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10 text-center sm:text-left">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-blue-500 text-blue-600">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">Bekleyen</h3>
            <p className="text-4xl md:text-5xl font-black">{stats.bekleyen}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-orange-500 text-orange-500">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">İşlemde</h3>
            <p className="text-4xl md:text-5xl font-black">{stats.islemde}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-green-500 text-green-500">
            <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1">Biten</h3>
            <p className="text-4xl md:text-5xl font-black">{stats.tamamlanan}</p>
          </div>
        </div>

        {/* İŞ EMİRLERİ TABLOSU */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h2 className="text-lg md:text-xl font-bold text-gray-800">İş Emirleri</h2>
            <div className="animate-pulse flex items-center gap-2 text-[10px] font-black text-green-500 uppercase">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span> Canlı
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Müşteri</th>
                  <th className="px-6 py-4 text-center">Sorumlu</th>
                  <th className="px-6 py-4 text-center">Durum</th>
                  <th className="px-6 py-4 text-right">Zaman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {ihbarlar.map((ihbar) => (
                  <tr key={ihbar.id} onClick={() => router.push(`/dashboard/ihbar-detay/${ihbar.id}`)} className="active:bg-blue-50 md:hover:bg-blue-50 transition cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800 text-sm">{ihbar.musteri_adi}</div>
                      <div className="text-[10px] text-gray-500 font-medium">{ihbar.konu}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {ihbar.profiles?.full_name?.split(' ')[0] || 'Atanmadı'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        ihbar.durum === 'Beklemede' ? 'bg-blue-100 text-blue-700' : 
                        ihbar.durum === 'Calisiliyor' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                        'bg-green-100 text-green-700'
                      }`}>{ihbar.durum}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-[10px] font-bold text-gray-400">
                        {ihbar.durum === 'Tamamlandi' ? 
                          <span className="text-green-600">{new Date(ihbar.kapatma_tarihi).toLocaleDateString('tr-TR')}</span> : 
                          <span className="text-orange-400">DEVAM...</span>
                        }
                      </div>
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