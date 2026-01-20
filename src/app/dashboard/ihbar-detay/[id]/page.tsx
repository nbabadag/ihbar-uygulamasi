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
  const [editForm, setEditForm] = useState({ musteri_adi: '', konu: '', aciklama: '' })

  // --- KONUM AYARLARI ---
  const [konumModu, setKonumModu] = useState('muhurleme')

  // --- YETKİ KONTROLLERİ ---
  const normalizedRole = userRole?.trim();
  const isSaha = normalizedRole === 'Saha Personeli';
  const isFormen = normalizedRole === 'Formen';
  const isManager = normalizedRole === 'Müdür';
  const isAdmin = normalizedRole === 'Admin';
  const isCagri = normalizedRole === 'Çağrı Merkezi';

  const canEditAssignment = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin', 'Çağrı Merkezi'].includes(normalizedRole);
  const canEditDetails = ['Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin', 'Çağrı Merkezi'].includes(normalizedRole);
  const canDeleteJob = ['Müdür', 'Admin', 'Mühendis-Yönetici'].includes(normalizedRole);
  const canPerformSahaActions = ['Saha Personeli', 'Formen', 'Mühendis-Yönetici', 'Müdür', 'Admin'].includes(normalizedRole);

  // --- GPS YARDIMCI FONKSİYONU ---
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
    
    // Konum Modunu Çek
    const { data: ayar } = await supabase.from('sistem_ayarlari').select('deger').eq('ayar_adi', 'konum_modu').single()
    if (ayar) setKonumModu(ayar.deger)

    if (user) {
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'Saha Personeli')
    }

    if (ihbarData) {
      setIhbar(ihbarData)
      setEditForm({ musteri_adi: ihbarData.musteri_adi || '', konu: ihbarData.konu || '', aciklama: ihbarData.aciklama || '' })
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

  // --- CANLI TAKİP MOTORU ---
  useEffect(() => {
    let interval: any;
    if (konumModu === 'canli_takip' && ihbar?.durum === 'Calisiliyor') {
      interval = setInterval(async () => {
        const currentPos = await getGPSLocation();
        await supabase.from('ihbarlar').update({ guncel_konum: currentPos }).eq('id', id);
      }, 300000); // 5 Dakikada Bir
    }
    return () => clearInterval(interval);
  }, [konumModu, ihbar?.durum, id]);

  const yardimciEkle = async () => {
    if (!seciliYardimci) return;
    const mevcutYardimcilar = Array.isArray(ihbar.yardimcilar) ? ihbar.yardimcilar : [];
    if (mevcutYardimcilar.includes(seciliYardimci)) { alert("Bu personel zaten ekipte!"); return; }
    const yeniYardimcilar = [...mevcutYardimcilar, seciliYardimci];
    const { error } = await supabase.from('ihbarlar').update({ yardimcilar: yeniYardimcilar }).eq('id', id);
    if (!error) { setSeciliYardimci(''); fetchData(); }
  };

  const yardimciSil = async (isim: string) => {
    const yeniYardimcilar = ihbar.yardimcilar.filter((y: string) => y !== isim);
    const { error } = await supabase.from('ihbarlar').update({ yardimcilar: yeniYardimcilar }).eq('id', id);
    if (!error) fetchData();
  };

  const handleAssignmentUpdate = async () => {
    setLoading(true)
    const { error } = await supabase.from('ihbarlar').update({
      atanan_personel: atamaTuru === 'personel' ? seciliAtanan : null,
      atanan_grup_id: atamaTuru === 'grup' ? seciliAtanan : null,
      ifs_is_emri_no: ifsNo,
      durum: ihbar.durum === 'Beklemede' ? 'Islemde' : ihbar.durum
    }).eq('id', id)
    if (!error) { alert("Görevlendirme Güncellendi!"); fetchData(); }
    setLoading(false)
  }

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
    if (!error) { alert("İş Başlatıldı! (GPS Kaydedildi)"); fetchData(); }
    setLoading(false)
  }

  const isiGeriAl = async () => {
    if (!window.confirm("Bu işi personelden geri alıp havuza göndermek istediğinize emin misiniz?")) return;
    setLoading(true);
    const { error } = await supabase.from('ihbarlar').update({ atanan_personel: null, atanan_grup_id: null, durum: 'Beklemede' }).eq('id', id);
    if (!error) { alert("İş geri alındı."); fetchData(); }
    setLoading(false);
  };

  const isiSil = async () => {
    if (!window.confirm("DİKKAT! Bu iş emri kalıcı olarak silinecektir.")) return;
    setLoading(true);
    const { error } = await supabase.from('ihbarlar').delete().eq('id', id);
    if (!error) { alert("İş emri silindi."); router.push('/dashboard'); }
    setLoading(false);
  };

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    const { error } = await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    if (!error) { setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData(); }
  }

  const isiDuraklat = async () => {
    if (!personelNotu) return alert("Lütfen neden durdurulduğunu yazın.");
    setLoading(true);
    const { error } = await supabase.from('ihbarlar').update({ durum: 'Durduruldu', personel_notu: personelNotu }).eq('id', id);
    if (!error) { alert("İş Durduruldu."); fetchData(); }
    setLoading(false);
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
    if (!error) { alert("İş Kapatıldı! (GPS Kaydedildi)"); router.push('/dashboard'); }
    setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-center font-black uppercase italic text-black">Yükleniyor...</div>

  return (
    <div className="p-3 md:p-10 bg-gray-50 min-h-screen text-black font-sans">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-[10px] md:text-xs uppercase italic flex items-center gap-2">← GERİ</button>
          <div className="flex items-center gap-4">
             {canDeleteJob && (
                <button onClick={isiSil} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black border border-red-100 hover:bg-red-600 hover:text-white transition-all">🗑️ İŞİ SİL</button>
             )}
             <div className="text-[10px] font-bold text-gray-400 uppercase italic tracking-widest">
               {ihbar.ifs_is_emri_no ? `#${ihbar.ifs_is_emri_no}` : 'IFS YOK'}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-2 space-y-4 md:space-y-6 order-2 lg:order-1">
            <div className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border-b-8 border-blue-900 relative overflow-hidden text-black">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h1 className="text-2xl md:text-4xl font-black text-gray-800 uppercase italic tracking-tighter leading-none break-words">{ihbar.musteri_adi}</h1>
                    <p className="text-sm md:text-xl text-blue-600 font-bold uppercase italic mt-2">{ihbar.konu}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-lg text-[8px] md:text-[10px] font-black uppercase border-2 flex-shrink-0 ${
                    ihbar.durum === 'Tamamlandi' ? 'bg-green-50 text-green-700 border-green-200' : 
                    ihbar.durum === 'Calisiliyor' ? 'bg-blue-600 text-white border-blue-700 animate-pulse' : 
                    ihbar.durum === 'Durduruldu' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>{ihbar.durum}</span>
                  {konumModu === 'canli_takip' && ihbar.durum === 'Calisiliyor' && (
                    <span className="text-[7px] font-black text-orange-600 animate-bounce bg-orange-50 px-1 rounded">📡 CANLI TAKİP AKTİF</span>
                  )}
                </div>
              </div>

              {editMode ? (
                <div className="space-y-4">
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-black" value={editForm.musteri_adi} onChange={e=>setEditForm({...editForm, musteri_adi:e.target.value})} placeholder="Müşteri Adı"/>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-black" value={editForm.konu} onChange={e=>setEditForm({...editForm, konu:e.target.value})} placeholder="İş Konusu"/>
                  <textarea className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-black" rows={3} value={editForm.aciklama} onChange={e=>setEditForm({...editForm, aciklama:e.target.value})} placeholder="Açıklama"/>
                  <button onClick={async () => { await supabase.from('ihbarlar').update(editForm).eq('id', id); setEditMode(false); fetchData(); }} className="bg-blue-600 text-white w-full p-4 rounded-2xl font-black uppercase shadow-lg">Kaydet</button>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 border-dashed border-gray-200 mb-6 text-black">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">📋 AÇIKLAMA</p>
                    {canEditDetails && (
                      <button onClick={() => setEditMode(true)} className="text-[8px] font-black text-blue-600 uppercase italic">✏️ İHBARI GÜNCELLE</button>
                    )}
                  </div>
                  <p className="text-gray-700 font-medium italic text-base md:text-lg leading-relaxed">{ihbar.aciklama || 'Detay girilmemiş'}</p>
                </div>
              )}

              {ihbar.yardimcilar && ihbar.yardimcilar.length > 0 && (
                <div className="mb-6">
                  <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase mb-2 italic text-black">👥 SAHA EKİBİ</p>
                  <div className="flex flex-wrap gap-2 text-black">
                    {ihbar.yardimcilar.map((y: string, idx: number) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black border border-blue-100 flex items-center gap-2">
                        👤 {y}
                        {!isSaha && (ihbar.durum === 'Calisiliyor' || ihbar.durum === 'Durduruldu') && (
                          <button onClick={() => yardimciSil(y)} className="text-red-500 font-black hover:scale-125 transition-transform ml-1">×</button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 border-t pt-6 overflow-x-auto text-black">
                <h3 className="font-black text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-4">📦 MALZEMELER</h3>
                <table className="w-full text-left min-w-[300px]">
                  <thead className="bg-gray-50 text-[8px] md:text-[10px] font-black uppercase text-gray-400 border-b">
                    <tr><th className="p-3">KOD</th><th className="p-3">MALZEME</th><th className="p-3 text-right">ADET</th></tr>
                  </thead>
                  <tbody className="divide-y text-[11px] md:text-sm font-bold italic uppercase">
                    {kullanilanlar.length > 0 ? kullanilanlar.map(k => (
                      <tr key={k.id} className="hover:bg-blue-50 transition-all text-black">
                        <td className="p-3 text-blue-600">{k.malzeme_kodu}</td>
                        <td className="p-3">{k.malzeme_adi}</td>
                        <td className="p-3 text-right text-orange-600 font-black">{k.kullanim_adedi}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="p-6 text-center text-gray-300 italic text-[10px]">Henüz malzeme eklenmedi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
            {canEditAssignment && (
              <div className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border-t-8 border-orange-500">
                <h3 className="font-black text-xs uppercase text-orange-600 mb-4 italic">SORUMLU ATAMA</h3>
                {(ihbar.atanan_personel || ihbar.atanan_grup_id) && !isSaha && (
                  <button onClick={isiGeriAl} className="w-full mb-4 bg-red-50 text-red-600 p-3 rounded-xl font-black text-[9px] uppercase border border-red-100">🚫 İŞİ GERİ AL (HAVUZA AT)</button>
                )}
                {isFormen && (ihbar.durum === 'Beklemede' || ihbar.durum === 'Islemde') && (
                  <button onClick={handleUstenle} className="w-full bg-blue-600 text-white p-4 rounded-xl font-black text-[10px] uppercase shadow-lg mb-4">🚀 ÜZERİME AL</button>
                )}
                <div className="space-y-2">
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                    <button onClick={() => setAtamaTuru('personel')} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase ${atamaTuru === 'personel' ? 'bg-white text-blue-600' : 'text-gray-400'}`}>KİŞİ</button>
                    <button onClick={() => setAtamaTuru('grup')} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase ${atamaTuru === 'grup' ? 'bg-white text-orange-600' : 'text-gray-400'}`}>GRUP</button>
                  </div>
                  <input placeholder="IFS NO" className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl font-black text-[10px] uppercase text-black" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                  <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-[10px] uppercase text-black">
                    <option value="">SEÇİNİZ...</option>
                    {atamaTuru === 'personel' ? personeller.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>) : gruplar.map(g => <option key={g.id} value={g.id}>{g.grup_adi}</option>)}
                  </select>
                  <button onClick={handleAssignmentUpdate} disabled={loading || !seciliAtanan} className="w-full bg-gray-800 text-white p-3 rounded-xl font-black text-[9px] uppercase">GÜNCELLE</button>
                </div>
              </div>
            )}

            {canPerformSahaActions ? (
              <div className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border-2 border-blue-600 text-black">
                <h3 className="font-black text-base md:text-xl mb-4 text-blue-900 italic uppercase">SAHA İŞLEMLERİ</h3>
                {ihbar.durum === 'Islemde' || ihbar.durum === 'Beklemede' ? (
                  <button onClick={isiBaslat} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl animate-pulse uppercase italic text-xs">🛠️ İŞİ ŞİMDİ BAŞLAT</button>
                ) : ihbar.durum === 'Durduruldu' ? (
                  <button onClick={isiBaslat} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl animate-bounce uppercase italic text-xs">🔧 DEVAM ET</button>
                ) : ihbar.durum === 'Calisiliyor' ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 rounded-2xl border-2 border-dashed border-blue-200">
                      <p className="text-[8px] font-black text-blue-600 uppercase mb-2 italic">🤝 EKİP ARKADAŞI</p>
                      <div className="flex gap-1">
                        <select value={seciliYardimci} onChange={e=>setSeciliYardimci(e.target.value)} className="flex-1 p-2 bg-white border rounded-xl font-black text-[9px] uppercase text-black">
                          <option value="">SEÇ...</option>
                          {personeller.filter(p => p.id !== userId).map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
                        </select>
                        <button onClick={yardimciEkle} className="bg-blue-600 text-white px-3 py-2 rounded-xl font-black text-[9px]">EKLE</button>
                      </div>
                    </div>
                    <div className="relative">
                      <input type="text" placeholder="🔍 MALZEME ARA..." className="w-full p-3 border rounded-xl font-bold text-[10px] bg-gray-50 text-black" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                      {searchTerm && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border rounded-xl shadow-2xl max-h-40 overflow-auto z-50 text-black">
                          {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10).map(m => (
                            <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-3 hover:bg-blue-50 cursor-pointer text-[9px] font-black border-b border-gray-50 uppercase flex justify-between text-black">
                              <span>{m.malzeme_adi}</span>
                              <span className="text-blue-400">[{m.malzeme_kodu}]</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {secilenMalzeme && (
                      <div className="flex items-center gap-1 p-2 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-100">
                        <span className="text-[8px] font-black uppercase flex-1 truncate">✅ {secilenMalzeme.malzeme_adi}</span>
                        <input type="number" className="w-12 p-2 bg-white border rounded-lg font-black text-[10px] text-black" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                        <button onClick={malzemeEkle} className="bg-emerald-600 text-white p-2 rounded-lg font-black text-[8px]">EKLE</button>
                      </div>
                    )}
                    <textarea className="w-full p-3 border rounded-xl bg-gray-50 text-[11px] font-bold text-black" placeholder="Yapılan işlemi yazın..." rows={3} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                    <div className="flex flex-col gap-3 pt-2">
                      <button onClick={isiTamamla} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-xl uppercase italic text-[11px] border-b-4 border-green-800">🏁 İŞİ BİTİR</button>
                      <button onClick={isiDuraklat} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black shadow-lg uppercase italic text-[10px] border-b-4 border-orange-700">⚠️ DURDUR</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 bg-gray-50 rounded-[2rem] border-4 border-dashed border-gray-100">
                    <p className="text-2xl mb-2">✅ İŞ TAMAMLANDI</p>
                    {ihbar.bitis_konum && (
                      <a href={`https://www.google.com/maps?q=${ihbar.bitis_konum}`} target="_blank" rel="noreferrer" className="text-[9px] font-black text-blue-600 underline">📍 HARİTADA GÖR</a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 bg-gray-50 rounded-[2rem] border-4 border-dashed border-gray-100 text-center text-black">📢 Kayıt Masası Yetkisi: İzleme Modu</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}