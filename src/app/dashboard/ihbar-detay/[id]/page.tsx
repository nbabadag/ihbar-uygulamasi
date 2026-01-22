'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [loading, setLoading] = useState(false)

  // Yetki Kontrolleri
  const normalizedRole = userRole?.trim();
  // Havuza geri alma yetkisi: Saha Personeli HARİÇ herkes
  const canReleaseToPool = normalizedRole !== 'Saha Personeli' && normalizedRole !== '';
  const canEditAssignment = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin', 'Çağrı Merkezi'].includes(normalizedRole);

  const getGPSLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve("GPS Yok"); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve("Konum Alınamadı"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || '')
    }

    const [ihbarRes, pRes, mRes, kmRes] = await Promise.all([
      supabase.from('ihbarlar').select(`*, profiles (full_name)`).eq('id', id).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('malzemeler').select('*').order('malzeme_adi'),
      supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id)
    ])

    if (ihbarRes.data) {
      setIhbar(ihbarRes.data)
      setIfsNo(ihbarRes.data.ifs_is_emri_no || '')
      setSeciliAtanan(ihbarRes.data.atanan_personel || '')
      setPersonelNotu(ihbarRes.data.personel_notu || '')
    }
    setPersoneller(pRes.data || [])
    setMalzemeKatalog(mRes.data || [])
    setKullanilanlar(kmRes.data || [])
  }, [id])

  useEffect(() => { 
    fetchData() 
    return () => { if(intervalRef.current) clearInterval(intervalRef.current) } 
  }, [fetchData])

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData();
  }

  const isiBaslat = async () => {
    setLoading(true)
    const konum = await getGPSLocation();
    const simdi = new Date().toISOString();
    
    await supabase.from('ihbarlar').update({ 
      durum: 'Calisiliyor', kabul_tarihi: simdi, atanan_personel: userId, guncel_konum: konum,
      konum_gecmisi: [{ konum: konum, saat: simdi }] 
    }).eq('id', id)

    await supabase.from('is_zamanlari').insert([{ ihbar_id: id, personel_id: userId, baslangic_tarihi: simdi, durum: 'Devam Ediyor' }])

    intervalRef.current = setInterval(async () => {
        const yeniKonum = await getGPSLocation();
        const { data: curr } = await supabase.from('ihbarlar').select('konum_gecmisi').eq('id', id).single();
        const guncelGecmis = [...(curr?.konum_gecmisi || []), { konum: yeniKonum, saat: new Date().toISOString() }];
        await supabase.from('ihbarlar').update({ guncel_konum: yeniKonum, konum_gecmisi: guncelGecmis }).eq('id', id);
    }, 120000);

    fetchData(); setLoading(false)
  }

  const isiKapatVeyaDurdur = async (yeniDurum: 'Tamamlandi' | 'Durduruldu') => {
    if (!personelNotu) return alert("İşlem notu gerekli.");
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLoading(true);
    const simdi = new Date().toISOString();
    const konum = await getGPSLocation();

    const updates: any = { durum: yeniDurum, personel_notu: personelNotu };
    if (yeniDurum === 'Tamamlandi') { updates.kapatma_tarihi = simdi; updates.bitis_konum = konum; }

    await supabase.from('ihbarlar').update(updates).eq('id', id);
    await supabase.from('is_zamanlari').update({ bitis_tarihi: simdi, durum: yeniDurum, personel_notu: personelNotu }).eq('ihbar_id', id).is('bitis_tarihi', null);

    if (yeniDurum === 'Tamamlandi') router.push('/dashboard');
    else { fetchData(); setLoading(false); }
  }

  const handleHavuzaAl = async () => {
    if(!confirm("İş havuza geri gönderilsin mi?")) return;
    await supabase.from('ihbarlar').update({ durum: 'Beklemede', atanan_personel: null, kabul_tarihi: null }).eq('id', id);
    router.push('/dashboard');
  }

  if (!ihbar) return <div className="p-10 text-center font-black">YÜKLENİYOR...</div>

  return (
    <div className="p-3 md:p-10 bg-gray-50 min-h-screen text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-100">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-xs uppercase italic">← GERİ</button>
          <div className="text-[10px] font-bold text-gray-400 uppercase italic"> {ihbar.ifs_is_emri_no || 'IFS KAYDI YOK'} </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-xl border-b-8 border-blue-900">
              <div className="mb-8">
                <p className="text-[9px] font-black text-blue-400 uppercase italic">BİRİM / GEMİ</p>
                <h1 className="text-3xl md:text-5xl font-black text-gray-800 uppercase italic leading-none">{ihbar.musteri_adi}</h1>
                <p className="text-xl text-blue-700 font-bold uppercase mt-2 italic">{ihbar.konu}</p>
              </div>

              {/* 📞 TELEFON ARA BUTONU */}
              {ihbar.ihbar_veren_tel && (
                <div className="mb-8 p-6 bg-green-50 border-2 border-green-100 rounded-[2.5rem] flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">📞</span>
                    <div><p className="text-[10px] font-black text-green-600 uppercase">İrtibat Numarası</p><p className="text-xl font-black">{ihbar.ihbar_veren_tel}</p></div>
                  </div>
                  <a href={`tel:${ihbar.ihbar_veren_tel}`} className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">ARA</a>
                </div>
              )}

              <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200 mb-8 italic">
                {ihbar.aciklama || 'Açıklama belirtilmemiş.'}
              </div>

              {/* MALZEME TABLOSU */}
              <div className="mt-10">
                <h3 className="font-black text-xs text-gray-400 uppercase mb-4 italic">📦 KULLANILAN MALZEME LİSTESİ</h3>
                <div className="overflow-hidden rounded-3xl border border-gray-100">
                  <table className="w-full text-left">
                    <thead className="bg-gray-800 text-white text-[10px] font-black uppercase italic">
                      <tr><th className="p-4">KOD</th><th className="p-4">MALZEME ADI</th><th className="p-4 text-right">MİKTAR</th></tr>
                    </thead>
                    <tbody className="divide-y text-sm font-bold uppercase italic">
                      {kullanilanlar.map(k => (
                        <tr key={k.id}><td className="p-4 text-blue-600">{k.malzeme_kodu}</td><td className="p-4">{k.malzeme_adi}</td><td className="p-4 text-right text-orange-600">{k.kullanim_adedi}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* SAHA PERSONELİ İŞLEMLERİ */}
            {ihbar.durum === 'Calisiliyor' ? (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-blue-600">
                <h3 className="font-black text-lg mb-4 text-blue-900 italic uppercase">İŞLEM PANELİ</h3>
                <div className="space-y-4 mb-6">
                  <input type="text" placeholder="🔍 MALZEME ARA..." className="w-full p-4 border rounded-2xl font-bold text-xs bg-gray-50" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  {searchTerm && (
                    <div className="bg-white border rounded-xl max-h-40 overflow-auto shadow-2xl">
                      {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).map(m => (
                        <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-3 hover:bg-blue-50 cursor-pointer text-[10px] font-black border-b uppercase flex justify-between">
                          <span>{m.malzeme_adi}</span><span className="text-blue-400">[{m.malzeme_kodu}]</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {secilenMalzeme && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border">
                      <span className="text-[9px] font-black uppercase flex-1 truncate text-black">✅ {secilenMalzeme.malzeme_adi}</span>
                      <input type="number" className="w-16 p-2 bg-white border rounded-lg font-black text-center" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                      <button onClick={malzemeEkle} className="bg-emerald-600 text-white p-2 rounded-lg font-black text-[9px]">EKLE</button>
                    </div>
                  )}
                </div>
                <textarea className="w-full p-4 border rounded-2xl bg-gray-50 text-xs font-bold mb-4" placeholder="Yapılan işlemi detaylandırın..." rows={4} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                <div className="flex flex-col gap-3">
                    <button onClick={() => isiKapatVeyaDurdur('Tamamlandi')} className="w-full bg-green-600 text-white py-6 rounded-3xl font-black shadow-xl uppercase italic text-xl">🏁 İŞİ BİTİR</button>
                    <button onClick={() => isiKapatVeyaDurdur('Durduruldu')} className="w-full bg-orange-500 text-white py-4 rounded-3xl font-black shadow-lg uppercase italic text-xs">⚠️ İŞİ DURDUR</button>
                </div>
              </div>
            ) : ihbar.durum !== 'Tamamlandi' && (
              <button onClick={isiBaslat} className="w-full bg-blue-600 text-white py-10 rounded-[3rem] font-black shadow-2xl uppercase italic text-2xl animate-pulse">🚀 İŞE BAŞLA</button>
            )}

            {/* YETKİLİ PANELİ (ATAMA) */}
            {canEditAssignment && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-t-8 border-slate-800">
                <h3 className="font-black text-[10px] uppercase text-slate-500 mb-4 italic tracking-widest">YÖNETİCİ KONTROLLERİ</h3>
                <div className="space-y-3">
                  <input placeholder="IFS İŞ EMRİ NO" className="w-full p-4 bg-blue-50 border rounded-2xl font-black text-xs" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                  <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-xs uppercase">
                    <option value="">PERSONEL SEÇİN...</option>
                    {personeller.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  <button onClick={async () => { await supabase.from('ihbarlar').update({ atanan_personel: seciliAtanan, ifs_is_emri_no: ifsNo }).eq('id', id); fetchData(); alert("İş Emri ve Personel Güncellendi."); }} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase">BİLGİLERİ GÜNCELLE</button>
                </div>
              </div>
            )}
            
            {/* 🔄 HAVUZA GERİ GÖNDER - YETKİ KONTROLÜ */}
            {canReleaseToPool && (
              <button onClick={handleHavuzaAl} className="w-full text-gray-400 font-black uppercase italic text-[9px] pt-4 hover:text-red-500 transition-all">❌ BU İŞİ HAVUZA GERİ GÖNDER</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}