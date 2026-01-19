'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function YeniIhbar() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Veri State'leri
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])

  // Form State'leri
  const [musteri, setMusteri] = useState('')
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [atamaTuru, setAtamaTuru] = useState<'personel' | 'grup'>('personel')
  const [seciliAtanan, setSeciliAtanan] = useState('')

  useEffect(() => {
    fetchAtamaListesi()
  }, [])

  const fetchAtamaListesi = async () => {
    // Sorumlu atanabilecek roller: Formen, Mühendis ve Saha Personeli
    const { data: pData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['Formen', 'Mühendis', 'Saha Personeli'])
      .eq('is_active', true)
      .order('full_name')

    const { data: gData } = await supabase
      .from('calisma_gruplari')
      .select('id, grup_adi')
      .order('grup_adi')

    setPersoneller(pData || [])
    setGruplar(gData || [])
  }

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Eğer bir atama yapıldıysa durum 'Islemde', yapılmadıysa 'Beklemede' başlar
    const ilkDurum = seciliAtanan ? 'Islemde' : 'Beklemede'

    const { error } = await supabase.from('ihbarlar').insert([
      { 
        musteri_adi: musteri, 
        konu: konu, 
        aciklama: aciklama,
        ifs_is_emri_no: ifsNo,
        durum: ilkDurum,
        atanan_personel: atamaTuru === 'personel' ? (seciliAtanan || null) : null,
        atanan_grup_id: atamaTuru === 'grup' ? (seciliAtanan || null) : null
      }
    ])
    
    if (error) {
      alert('Hata: ' + error.message)
      setLoading(false)
    } else {
      alert('İhbar başarıyla kaydedildi ve ilgili birime atandı!')
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-10 font-sans text-black">
      <div className="max-w-3xl mx-auto">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center mb-8">
          <button 
            onClick={() => router.back()}
            className="text-blue-900 font-black text-xs uppercase italic flex items-center gap-2"
          >
            ← Geri Dön
          </button>
          <div className="text-[10px] bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-black uppercase italic tracking-widest">
            Saha 360 Kayıt Sistemi
          </div>
        </div>
        
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border-b-8 border-blue-900">
          <h1 className="text-3xl font-black mb-2 text-gray-800 uppercase italic tracking-tighter">📢 Yeni İhbar Kaydı</h1>
          <p className="text-gray-400 font-bold text-xs mb-8 uppercase">Sahadan gelen talebi sisteme işleyin</p>
          
          <form onSubmit={kaydet} className="space-y-6">
            
            {/* 1. MÜŞTERİ VE IFS BİLGİSİ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Müşteri / Unvan</label>
                <input 
                  required
                  placeholder="Örn: Sefine Tersanesi" 
                  className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all" 
                  value={musteri}
                  onChange={e => setMusteri(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">IFS İş Emri No</label>
                <input 
                  placeholder="Örn: 2024-001" 
                  className="w-full bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all placeholder-blue-300" 
                  value={ifsNo}
                  onChange={e => setIfsNo(e.target.value)} 
                />
              </div>
            </div>

            {/* 2. KONU */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İhbar Konusu</label>
              <input 
                required
                placeholder="Arıza, Kaçak, Periyodik Bakım vb." 
                className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all" 
                value={konu}
                onChange={e => setKonu(e.target.value)} 
              />
            </div>

            {/* 3. ATAMA PANELİ (YENİ) */}
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🎯 İlk Atamayı Yap (Formen veya Grup)</label>
                <div className="flex bg-white rounded-lg p-1 shadow-sm">
                  <button type="button" onClick={() => setAtamaTuru('personel')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${atamaTuru === 'personel' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Kişi</button>
                  <button type="button" onClick={() => setAtamaTuru('grup')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${atamaTuru === 'grup' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Grup</button>
                </div>
              </div>
              
              <select 
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-blue-100"
                value={seciliAtanan}
                onChange={e => setSeciliAtanan(e.target.value)}
              >
                <option value="">{atamaTuru === 'personel' ? '👤 Personel (Formen/Usta) Seçin...' : '👥 Çalışma Grubu Seçin...'}</option>
                {atamaTuru === 'personel' 
                  ? personeller.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)
                  : gruplar.map(g => <option key={g.id} value={g.id}>{g.grup_adi}</option>)
                }
              </select>
            </div>

            {/* 4. DETAYLI AÇIKLAMA */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İhbar Detayları</label>
              <textarea 
                required
                placeholder="Lütfen arıza veya talep detaylarını buraya açıkça yazın..." 
                className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold h-32 focus:border-blue-500 outline-none transition-all" 
                value={aciklama}
                onChange={e => setAciklama(e.target.value)} 
              />
            </div>

            {/* KAYDET BUTONU */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-900 text-white font-black py-5 rounded-3xl hover:bg-blue-800 transition-all shadow-xl shadow-blue-100 active:scale-95 disabled:bg-gray-400 uppercase italic tracking-tighter"
            >
              {loading ? 'Sistem Kaydediyor...' : 'İhbarı Kaydet ve Birime Gönder 🚀'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}