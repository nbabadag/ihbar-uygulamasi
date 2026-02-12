'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PersonelDashboard() {
  const [islerim, setIslerim] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUser(user)
      
      // Sadece bu personele atanan ve tamamlanmamış işleri getir
      const { data } = await supabase
        .from('ihbarlar')
        .select('*')
        .eq('atanan_personel', user.id)
        .neq('durum', 'Tamamlandi')
        .order('created_at', { ascending: false })
      
      setIslerim(data || [])
    }
    checkUser()
  }, [])

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-black">🛠️ Üzerimdeki İşler</h1>
      
      <div className="grid gap-4">
        {islerim.length === 0 ? (
          <p className="text-gray-500 italic">Şu an üzerinizde aktif bir iş bulunmuyor.</p>
        ) : (
          islerim.map(is => (
            <div 
              key={is.id} 
              onClick={() => router.push(`/dashboard/ihbar-detay/${is.id}`)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 cursor-pointer hover:border-blue-500 transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-black">{is.musteri_adi}</h3>
                  <p className="text-sm text-gray-500">{is.konu}</p>
                </div>
                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                  {is.durum}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <div className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono">
                  IFS: {is.ifs_is_emri_no}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}