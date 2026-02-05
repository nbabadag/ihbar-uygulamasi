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

    // --- 🕒 TÜRKİYE SAATİ HESABI ---
    const simdi = new Date();
    const turkiyeZamani = new Date(simdi.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const toplamDakika = turkiyeZamani.getHours() * 60 + turkiyeZamani.getMinutes();
    const isMesai = toplamDakika >= 481 && toplamDakika <= 1004;

    // 🛡️ MÜHÜRLÜ VERİ YAPISI
    const ihbarVerisi = {
      ihbar_veren_ad_soyad: form.ad_soyad,
      // Birim ve Konu birleşimi (Örn: NB105 // VİNÇ ARIZASI)
      konu: form.birim ? `${form.birim.toUpperCase()} // ${form.konu.toUpperCase()}` : form.konu.toUpperCase(),
      aciklama: `${form.ad_soyad} (Tel: ${form.tel}) [GPS: ${gpsKonum}]: ${form.aciklama}`,
      durum: 'Beklemede',
      oncelik_durumu: isMesai ? 'NORMAL' : 'VARDİYA_MODU', 
      guncel_konum: gpsKonum
    }

    const { error } = await supabasePublic.from('ihbarlar').insert([ihbarVerisi])

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Supabase Hatası:", error);
      alert(`Sistem Hatası: ${error.message}`);
      setLoading(false)
    } else {
      alert("İhbar Başarıyla Alındı. ✅");
      setForm({ ad_soyad: '', tel: '', konu: '', aciklama: '', birim: form.birim })
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md w-full bg-[#111318]/95 backdrop-blur-2xl p-8 rounded-[3rem] border border-gray-800 shadow-2xl relative z-10 font-black italic uppercase">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Logo" className="w-16 mx-auto mb-3" />
          <h1 className="text-2xl font-black text-orange-500 tracking-tighter">Saha İhbar Sistemi</h1>
          <p className="text-[9px] text-gray-500 tracking-[0.3em] mt-2 italic font-black">Hızlı Arıza Bildirim Terminali</p>
        </div>

        <form onSubmit={kaydet} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 font-black italic">
             <div className="space-y-1">
               <label className="text-[9px] text-gray-600 ml-4 italic font-black">Birim (Gemi/Saha)</label>
               <input required className="w-full bg-black/40 border border-gray-700 p-4 rounded-2xl text-xs text-orange-500 outline-none focus:border-orange-500 font-black italic uppercase" value={form.birim} onChange={e => setForm({...form, birim: e.target.value})} placeholder="Örn: NB105" />
             </div>
             <div className="space-y-1">
               <label className="text-[9px] text-gray-600 ml-4 italic font-black">Arıza Başlığı</label>
               <input required className="w-full bg-black/40 border border-gray-800 p-4 rounded-2xl text-xs text-white outline-none focus:border-gray-600 font-black italic uppercase" value={form.konu} onChange={e => setForm({...form, konu: e.target.value})} placeholder="Örn: VİNÇ ARIZASI" />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
               <label className="text-[9px] text-gray-600 ml-4 italic font-black">Ad Soyad</label>
               <input required className="w-full bg-black/40 border border-gray-800 p-4 rounded-2xl text-xs outline-none focus:border-gray-600 text-white font-black italic uppercase" value={form.ad_soyad} onChange={e => setForm({...form, ad_soyad: e.target.value})} placeholder="AD SOYAD" />
             </div>
             <div className="space-y-1">
               <label className="text-[9px] text-gray-600 ml-4 italic font-black">İletişim Tel</label>
               <input required type="tel" className="w-full bg-black/40 border border-gray-800 p-4 rounded-2xl text-xs outline-none focus:border-gray-600 text-white font-black italic uppercase" value={form.tel} onChange={e => setForm({...form, tel: e.target.value})} placeholder="TELEFON" />
             </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-[9px] text-gray-600 ml-4 italic font-black">Arıza Açıklaması</label>
            <textarea required className="w-full bg-black/40 border border-gray-800 p-4 rounded-2xl text-xs h-32 outline-none focus:border-gray-600 text-white font-black italic uppercase" value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} placeholder="ARIZAYI DETAYLANDIRIN..." />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 py-6 rounded-3xl font-black uppercase tracking-tighter shadow-xl transition-all active:scale-95 disabled:opacity-50 text-lg text-white">
            {loading ? 'GPS KONUMU ALINIYOR...' : 'İHBARI GÖNDER 🚀'}
          </button>
        </form>
    </div>
  )
}

export default function PublicIhbar() {
  return (
    <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center p-4 text-white relative font-black italic uppercase">
      <div className="fixed inset-0 opacity-5 pointer-events-none flex items-center justify-center">
        <img src="/logo.png" alt="Background Logo" className="w-96" />
      </div>
      <Suspense fallback={<div className="text-orange-500 animate-pulse font-black italic uppercase">Bağlanıyor...</div>}>
        <İhbarFormu />
      </Suspense>
    </div>
  )
}