'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSearchParams } from 'next/navigation'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function İhbarFormu() {
  const searchParams = useSearchParams()
  const urlBirim = searchParams.get('birim')
  
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    ad_soyad: '',
    tel: '',
    konu: '',
    aciklama: '',
    birim: ''
  })

  useEffect(() => {
    if (urlBirim) setForm(prev => ({ ...prev, birim: urlBirim }))
  }, [urlBirim])

  const getGPS = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve("GPS Desteklenmiyor"); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve("Konum Reddedildi"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const gpsKonum = await getGPS();

    // --- 🕒 TÜRKİYE SAATİNE SABİTLEME (UTC+3) ---
    const simdi = new Date();
    // Vercel sunucusu nerede olursa olsun Türkiye saatini hesaplar
    const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const saat = turkiyeZamani.getHours();
    const dakika = turkiyeZamani.getMinutes();
    const toplamDakika = saat * 60 + dakika;

    // Mesai: 08:01 (481 dk) - 16:44 (1004 dk)
    // Bu aralık dışındakiler VARDİYA_MODU olur
    const isMesai = toplamDakika >= 481 && toplamDakika <= 1004;

    const ihbarVerisi = {
      musteri_adi: form.birim || 'SAHA GENEL',
      konu: form.konu,
      aciklama: `${form.ad_soyad} (Tel: ${form.tel}) [GPS: ${gpsKonum}]: ${form.aciklama}`,
      durum: 'Beklemede',
      // Eğer akşam/gece ise Ali'nin ekranına düşmesi için etiketi basıyoruz
      oncelik_durumu: isMesai ? 'NORMAL' : 'VARDİYA_MODU', 
      guncel_konum: gpsKonum,
      olusturma_tarihi: new Date().toISOString()
    }

    const { error } = await supabasePublic.from('ihbarlar').insert([ihbarVerisi])

    if (error) {
      alert("Hata: " + error.message)
      setLoading(false)
    } else {
      alert("İhbarınız ve GPS konumunuz başarıyla iletildi. Vardiya ekibi bilgilendirildi.")
      setForm({ ad_soyad: '', tel: '', konu: '', aciklama: '', birim: form.birim })
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md w-full bg-[#111318]/95 backdrop-blur-2xl p-8 rounded-[3rem] border border-gray-800 shadow-2xl relative z-10 font-black">
        <div className="text-center mb-6 font-black">
          <img src="/logo.png" className="w-16 mx-auto mb-3 font-black" />
          <h1 className="text-2xl font-black uppercase italic text-orange-500 tracking-tighter font-black">Hızlı İhbar & GPS</h1>
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2 italic tracking-widest font-black">Konumunuz Otomatik Alınacaktır</p>
        </div>

        <form onSubmit={kaydet} className="space-y-4 font-black">
          <div className="space-y-1 font-black">
            <label className="text-[9px] font-black text-gray-600 ml-4 uppercase italic font-black">Yakınındaki Birim / Gemi</label>
            <input required className="w-full bg-black/40 border border-gray-700 p-4 rounded-2xl font-black text-xs text-orange-500 outline-none focus:border-orange-500 transition-all font-black" value={form.birim} onChange={e => setForm({...form, birim: e.target.value})} placeholder="Örn: NB105" />
          </div>

          <div className="grid grid-cols-2 gap-3 font-black">
             <input required placeholder="Ad Soyad" className="bg-black/40 border border-gray-800 p-4 rounded-2xl font-black text-xs outline-none focus:border-gray-600 font-black" value={form.ad_soyad} onChange={e => setForm({...form, ad_soyad: e.target.value})} />
             <input required type="tel" placeholder="Telefon" className="bg-black/40 border border-gray-800 p-4 rounded-2xl font-black text-xs outline-none focus:border-gray-600 font-black" value={form.tel} onChange={e => setForm({...form, tel: e.target.value})} />
          </div>

          <input required placeholder="Arıza Başlığı" className="w-full bg-black/40 border border-gray-800 p-4 rounded-2xl font-black text-xs outline-none focus:border-gray-600 font-black" value={form.konu} onChange={e => setForm({...form, konu: e.target.value})} />
          
          <textarea required placeholder="Lütfen sorunu açıklayın..." className="w-full bg-black/40 border border-gray-800 p-4 rounded-2xl font-black text-xs h-32 outline-none focus:border-gray-600 font-black" value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} />

          <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 py-6 rounded-3xl font-black uppercase italic tracking-tighter shadow-xl shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50 text-lg text-white font-black">
            {loading ? 'KONUM ALINIYOR...' : 'İHBARI GÖNDER 🚀'}
          </button>
        </form>
    </div>
  )
}

export default function PublicIhbar() {
  return (
    <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center p-4 font-sans text-white relative font-black">
      <div className="fixed inset-0 opacity-5 pointer-events-none flex items-center justify-center font-black">
        <img src="/logo.png" className="w-96 font-black" />
      </div>
      <Suspense fallback={<div className="font-black uppercase italic text-orange-500 animate-pulse font-black">Sistem Yükleniyor...</div>}>
        <İhbarFormu />
      </Suspense>
    </div>
  )
}