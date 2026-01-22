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
<<<<<<< HEAD
  const [ihbarVeren, setIhbarVeren] = useState('')
  const [telefon, setTelefon] = useState('')
=======
  const [ihbarVeren, setIhbarVeren] = useState('') // Müşteri -> İhbar Veren Kişi
  const [telefon, setTelefon] = useState('')       // Yeni: İrtibat No
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [atamaTuru, setAtamaTuru] = useState<'personel' | 'grup'>('personel')
  const [seciliAtanan, setSeciliAtanan] = useState('')

  useEffect(() => {
    fetchAtamaListesi()
  }, [])

  const fetchAtamaListesi = async () => {
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
<<<<<<< HEAD
    
    // Telefon numarası kontrolü
    if (!telefon.startsWith('0') || telefon.length !== 11) {
      alert('Lütfen telefon numarasını 0 ile başlayacak şekilde 11 hane olarak giriniz.');
      return;
    }

    setLoading(true)
    
    // Eğer bir atama yapıldıysa durum 'Islemde' değil, 'Beklemede' başlar. 
    // Çünkü konum ancak personel "İşe Başla" dediğinde alınacak.
    const { error } = await supabase.from('ihbarlar').insert([
      { 
        musteri_adi: ihbarVeren, 
        ihbar_veren_tel: telefon, 
=======
    
    // Telefon numarası kontrolü (0 ile başlamalı ve 11 hane olmalı)
    if (!telefon.startsWith('0') || telefon.length !== 11) {
      alert('Lütfen telefon numarasını 0 ile başlayacak şekilde 11 hane olarak giriniz. (Örn: 05321234567)');
      return;
    }

    setLoading(true)
    const ilkDurum = seciliAtanan ? 'Islemde' : 'Beklemede'

    const { error } = await supabase.from('ihbarlar').insert([
      { 
        musteri_adi: ihbarVeren, // Veritabanındaki sütun adın musteri_adi ise burası aynı kalır
        ihbar_veren_tel: telefon, // Yeni eklediğimiz SQL sütunu
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
        konu: konu, 
        aciklama: aciklama,
        ifs_is_emri_no: ifsNo,
        durum: 'Beklemede', // Her zaman beklemede başlar
        atanan_personel: atamaTuru === 'personel' ? (seciliAtanan || null) : null,
        atanan_grup_id: atamaTuru === 'grup' ? (seciliAtanan || null) : null
      }
    ])
    
    if (error) {
      alert('Hata: ' + error.message)
      setLoading(false)
    } else {
<<<<<<< HEAD
      alert('İhbar başarıyla kaydedildi! Personel işi başlattığında konum alınacaktır.')
=======
      alert('İhbar başarıyla kaydedildi!')
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-10 font-sans text-black">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => router.back()} className="text-blue-900 font-black text-xs uppercase italic flex items-center gap-2">
            ← Geri Dön
          </button>
          <div className="text-[10px] bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-black uppercase italic tracking-widest">
            Saha 360 // Yatır Sistemi
          </div>
        </div>
        
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border-b-8 border-blue-900">
          <h1 className="text-3xl font-black mb-2 text-gray-800 uppercase italic tracking-tighter">📢 Yeni İhbar Kaydı</h1>
          
          <form onSubmit={kaydet} className="space-y-6">
<<<<<<< HEAD
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İhbar Veren Kişi</label>
                <input required placeholder="Ad Soyad" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold outline-none" value={ihbarVeren} onChange={e => setIhbarVeren(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İrtibat No</label>
                <input required type="tel" maxLength={11} placeholder="05xx xxx xx xx" className="w-full bg-yellow-50 border-2 border-yellow-100 p-4 rounded-2xl font-bold outline-none" value={telefon} onChange={e => setTelefon(e.target.value.replace(/\D/g, ''))} />
=======
            
            {/* 1. İHBAR VEREN VE TELEFON BİLGİSİ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İhbar Veren Kişi / Birim</label>
                <input 
                  required
                  placeholder="Ad Soyad veya Departman" 
                  className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all" 
                  value={ihbarVeren}
                  onChange={e => setIhbarVeren(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İrtibat No (0 ile başla)</label>
                <input 
                  required
                  type="tel"
                  maxLength={11}
                  placeholder="05xx xxx xx xx" 
                  className="w-full bg-yellow-50 border-2 border-yellow-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all" 
                  value={telefon}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, ''); // Sadece rakam
                    setTelefon(val);
                  }} 
                />
              </div>
            </div>

            {/* 2. IFS VE KONU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">IFS İş Emri No</label>
                <input 
                  placeholder="Örn: 2024-001" 
                  className="w-full bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all" 
                  value={ifsNo}
                  onChange={e => setIfsNo(e.target.value)} 
                />
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İhbar Konusu</label>
                <input 
                  required
                  placeholder="Arıza, Kaçak vb." 
                  className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all" 
                  value={konu}
                  onChange={e => setKonu(e.target.value)} 
                />
              </div>
            </div>

<<<<<<< HEAD
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">IFS İş Emri No</label>
                <input placeholder="Örn: 2024-001" className="w-full bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl font-bold outline-none" value={ifsNo} onChange={e => setIfsNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">İhbar Konusu</label>
                <input required placeholder="Arıza Konusu" className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold outline-none" value={konu} onChange={e => setKonu(e.target.value)} />
              </div>
            </div>

=======
            {/* ATAMA PANELİ */}
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🎯 İlk Atamayı Yap</label>
                <div className="flex bg-white rounded-lg p-1 shadow-sm">
                  <button type="button" onClick={() => setAtamaTuru('personel')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase ${atamaTuru === 'personel' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Kişi</button>
                  <button type="button" onClick={() => setAtamaTuru('grup')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase ${atamaTuru === 'grup' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>Grup</button>
                </div>
              </div>
<<<<<<< HEAD
              <select className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-sm uppercase outline-none" value={seciliAtanan} onChange={e => setSeciliAtanan(e.target.value)}>
=======
              
              <select 
                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-blue-100"
                value={seciliAtanan}
                onChange={e => setSeciliAtanan(e.target.value)}
              >
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
                <option value="">{atamaTuru === 'personel' ? '👤 Personel Seçin...' : '👥 Grup Seçin...'}</option>
                {atamaTuru === 'personel' 
                  ? personeller.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)
                  : gruplar.map(g => <option key={g.id} value={g.id}>{g.grup_adi}</option>)
                }
              </select>
            </div>

<<<<<<< HEAD
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Açıklama</label>
              <textarea required placeholder="Detayları yazın..." className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold h-32 outline-none" value={aciklama} onChange={e => setAciklama(e.target.value)} />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 disabled:bg-gray-400 uppercase italic tracking-tighter">
=======
            {/* AÇIKLAMA */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Detaylı Açıklama</label>
              <textarea 
                required
                placeholder="Arıza veya talep detaylarını yazın..." 
                className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold h-32 focus:border-blue-500 outline-none transition-all" 
                value={aciklama}
                onChange={e => setAciklama(e.target.value)} 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-900 text-white font-black py-5 rounded-3xl hover:bg-blue-800 transition-all shadow-xl active:scale-95 disabled:bg-gray-400 uppercase italic tracking-tighter"
            >
>>>>>>> 6168b2cc4d76267ea99e51227f74e783aded7c9a
              {loading ? 'KAYDEDİLİYOR...' : 'İhbarı Kaydet ve Gönder 🚀'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
