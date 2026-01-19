'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase' // @/ kullanımı en güvenlisidir
import { useRouter } from 'next/navigation'

export default function YeniIhbar() {
  const [musteri, setMusteri] = useState('')
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.from('ihbarlar').insert([
      { musteri_adi: musteri, konu: konu, aciklama: aciklama }
    ])
    
    if (error) {
      alert('Hata: ' + error.message)
      setLoading(false)
    } else {
      alert('İhbar başarıyla kaydedildi!')
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-10">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:underline"
        >
          ← Geri Dön
        </button>
        
        <h1 className="text-3xl font-bold mb-6 text-gray-800">📢 Yeni İhbar Kaydı</h1>
        
        <form onSubmit={kaydet} className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Müşteri Adı / Unvanı</label>
            <input 
              required
              placeholder="Örn: Ahmet Yılmaz veya ABC İnşaat" 
              className="w-full border border-gray-300 p-3 rounded-lg text-black focus:ring-2 focus:ring-blue-500 outline-none" 
              onChange={e => setMusteri(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">İhbar Konusu</label>
            <input 
              required
              placeholder="Örn: Arıza, Kaçak, Talep vb." 
              className="w-full border border-gray-300 p-3 rounded-lg text-black focus:ring-2 focus:ring-blue-500 outline-none" 
              onChange={e => setKonu(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Detaylı Açıklama</label>
            <textarea 
              required
              placeholder="Lütfen ihbar detaylarını buraya yazın..." 
              className="w-full border border-gray-300 p-3 rounded-lg text-black h-40 focus:ring-2 focus:ring-blue-500 outline-none" 
              onChange={e => setAciklama(e.target.value)} 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition duration-200 disabled:bg-gray-400"
          >
            {loading ? 'Kaydediliyor...' : 'Kaydı Tamamla'}
          </button>
        </form>
      </div>
    </div>
  )
}