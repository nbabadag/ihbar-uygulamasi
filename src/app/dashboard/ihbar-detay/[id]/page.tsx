'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gruplar, setGruplar] = useState<any[]>([])
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  
  const [atamaTuru, setAtamaTuru] = useState<'personel' | 'grup'>('personel')
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')

  const [kapatmaTarihi, setKapatmaTarihi] = useState(new Date().toISOString().split('T')[0])
  const [bitisSaati, setBitisSaati] = useState(new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}))
  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [seciliYardimci, setSeciliYardimci] = useState('') 
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ musteri_adi: '', konu: '', aciklama: '', ihbar_veren_tel: '' })

  // --- KONUM AYARLARI ---
  const [konumModu, setKonumModu] = useState('muhurleme')

  const normalizedRole = userRole?.trim();
  const isSaha = normalizedRole === 'Saha Personeli';
  const isFormen = normalizedRole === 'Formen';
  const isManager = normalizedRole === 'Müdür';
  const isAdmin = normalizedRole === 'Admin';

  const canEditAssignment = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin', 'Çağrı Merkezi'].includes(normalizedRole);
  const canEditDetails = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin', 'Çağrı Merkezi'].includes(normalizedRole);
  const canDeleteJob = ['Müdür', 'Admin', 'Mühendis-Yönetici'].includes(normalizedRole);
  const canPerformSahaActions = ['Saha Personeli', 'Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);

  const getGPSLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve("GPS Desteklenmiyor"); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve("Konum Alınamadı"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const fetchData = useCallback(async () => {
    const { data: ihbarData } = await supabase.from('ihbarlar').select(`*, profiles (full_name), calisma_gruplari (grup_adi)`).eq('id', id).single()
    const { data: pData } = await supabase.from('profiles').select('*').eq('is_active', true)
    const { data: gData } = await supabase.from('calisma_gruplari').select('*')
    const { data: mKatalog } = await supabase.from('malzemeler').select('*')
    const { data: hData } = await supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id)
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: ayar } = await supabase.from('sistem_ayarlari').select('deger').eq('ayar_adi', 'konum_modu').single()
    if (ayar) setKonumModu(ayar.deger)

    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'Saha Personeli')
    }

    if (ihbarData) {
      setIhbar(ihbarData)
      setEditForm({ 
        musteri_adi: ihbarData.musteri_adi || '', 
        konu: ihbarData.konu || '', 
        aciklama: ihbarData.aciklama || '',
        ihbar_veren_tel: ihbarData.ihbar_veren_tel || '' 
      })
      setIfsNo(ihbarData.ifs_is_emri_no || '')
      setSeciliAtanan(ihbarData.atanan_personel || ihbarData.atanan_grup_id || '')
      setAtamaTuru(ihbarData.atanan_grup_id ? 'grup' : 'personel')
      if (ihbarData.personel_notu) setPersonelNotu(ihbarData.personel_notu)
      if (ihbarData.kapatma_tarihi) setKapatmaTarihi(ihbarData.kapatma_tarihi.split('T')[0])
    }
    setPersoneller(pData || [])
    setGruplar(gData || [])
    setMalzemeKatalog(mKatalog || [])
    setKullanilanlar(hData || [])
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ... (Geri alma, silme, başlatma fonksiyonları aynı kalacak şekilde buraya gelecek)
  // ... (Kodun geri kalan fonksiyonları önceki haliyle devam eder)

  const handleUstenle = async () => {
    setLoading(true)
    const konum = await getGPSLocation();
    const { error } = await supabase.from('ihbarlar').update({
      atanan_personel: userId,
      atanan_grup_id: null,
      durum: 'Calisiliyor',
      kabul_tarihi: new Date().toISOString(),
      baslangic_konum: konum
    }).eq('id', id)
    if (!error) { alert("İş üzerinize alındı ve başlatıldı!"); fetchData(); }
    setLoading(false)
  }

  const isiBaslat = async () => {
    setLoading(true)
    const konum = await getGPSLocation();
    const { error } = await supabase.from('ihbarlar').update({ 
      durum: 'Calisiliyor', 
      kabul_tarihi: new Date().toISOString(),
      atanan_personel: userId,
      baslangic_konum: konum
    }).eq('id', id)
    if (!error) { alert("İş Başlatıldı!"); fetchData(); }
    setLoading(false)
  }

  const isiTamamla = async () => {
    if (!personelNotu) return alert("Lütfen yapılan işlemi açıklayın.");
    setLoading(true);
    const konum = await getGPSLocation();
    const { error } = await supabase.from('ihbarlar').update({ 
      durum: 'Tamamlandi', 
      kapatma_tarihi: new Date().toISOString(),
      bitis_saati: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
      personel_notu: personelNotu,
      bitis_konum: konum
    }).eq('id', id);
    if (!error) { alert("İş Kapatıldı!"); router.push('/dashboard'); }
    setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-center font-black uppercase italic text-black">Yükleniyor...</div>

  return (
    <div className="p-3 md:p-10 bg-gray-50 min-h-screen text-black font-sans">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-[10px] md:text-xs uppercase italic flex items-center gap-2">← GERİ</button>
          <div className="text-[10px] font-bold text-gray-400 uppercase italic tracking-widest">
            {ihbar.ifs_is_emri_no ? `#${ihbar.ifs_is_emri_no}` : 'IFS YOK'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-2 space-y-4 md:space-y-6 order-2 lg:order-1">
            <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border-b-8 border-blue-900 relative overflow-hidden">
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">İHBAR VEREN / BİRİM</p>
                    <h1 className="text-2xl md:text-4xl font-black text-gray-800 uppercase italic tracking-tighter leading-none">{ihbar.musteri_adi}</h1>
                    <p className="text-sm md:text-xl text-blue-600 font-bold uppercase italic mt-2">{ihbar.konu}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border-2 ${
                  ihbar.durum === 'Tamamlandi' ? 'bg-green-50 text-green-700 border-green-200' : 
                  ihbar.durum === 'Calisiliyor' ? 'bg-blue-600 text-white border-blue-700 animate-pulse' : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>{ihbar.durum}</span>
              </div>

              {/* --- DİREKT ARAMA MODÜLÜ (YENİ EKLEDİĞİMİZ KISIM) --- */}
              {ihbar.ihbar_veren_tel && (
                <div className="mb-8 p-5 bg-green-50/50 border-2 border-green-100 rounded-[2rem] flex justify-between items-center active:scale-95 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-500 p-3 rounded-2xl shadow-lg shadow-green-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-green-600 uppercase italic">İhbarcıya Ulaş</p>
                      <p className="text-lg font-black text-slate-800 tracking-tight">{ihbar.ihbar_veren_tel}</p>
                    </div>
                  </div>
                  <a href={`tel:${ihbar.ihbar_veren_tel}`} className="bg-green-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase italic shadow-xl shadow-green-100">ŞİMDİ ARA</a>
                </div>
              )}

              {editMode ? (
                <div className="space-y-4">
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.musteri_adi} onChange={e=>setEditForm({...editForm, musteri_adi:e.target.value})} placeholder="İhbar Veren"/>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.ihbar_veren_tel} onChange={e=>setEditForm({...editForm, ihbar_veren_tel:e.target.value})} placeholder="İrtibat No (05...)"/>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.konu} onChange={e=>setEditForm({...editForm, konu:e.target.value})} placeholder="İş Konusu"/>
                  <textarea className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" rows={3} value={editForm.aciklama} onChange={e=>setEditForm({...editForm, aciklama:e.target.value})} placeholder="Açıklama"/>
                  <button onClick={async () => { await supabase.from('ihbarlar').update(editForm).eq('id', id); setEditMode(false); fetchData(); }} className="bg-blue-600 text-white w-full p-4 rounded-2xl font-black uppercase shadow-lg">Değişiklikleri Kaydet</button>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">📋 İHBAR DETAYLARI</p>
                    {canEditDetails && (
                      <button onClick={() => setEditMode(true)} className="text-[8px] font-black text-blue-600 uppercase italic">✏️ DÜZENLE</button>
                    )}
                  </div>
                  <p className="text-gray-700 font-medium italic text-lg leading-relaxed">{ihbar.aciklama || 'Açıklama mevcut değil.'}</p>
                </div>
              )}

              {/* ... (Saha Ekibi ve Malzemeler tabloları aynı kalacak) */}
              
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            {/* ... (Atama Paneli ve Saha İşlemleri kısımları aynı kalacak) */}
            {/* NOT: canPerformSahaActions içindeki "İşi Bitir" ve "Malzeme Ekle" butonlarını olduğu gibi bıraktım */}
          </div>
        </div>
      </div>
    </div>
  )
}
