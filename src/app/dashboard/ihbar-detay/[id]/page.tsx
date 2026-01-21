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

  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [seciliYardimci, setSeciliYardimci] = useState('') 
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ musteri_adi: '', konu: '', aciklama: '', ihbar_veren_tel: '' })

  const normalizedRole = userRole?.trim();
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
    }
    setPersoneller(pData || [])
    setGruplar(gData || [])
    setMalzemeKatalog(mKatalog || [])
    setKullanilanlar(hData || [])
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAssignmentUpdate = async () => {
    setLoading(true)
    const { error } = await supabase.from('ihbarlar').update({
      atanan_personel: atamaTuru === 'personel' ? seciliAtanan : null,
      atanan_grup_id: atamaTuru === 'grup' ? seciliAtanan : null,
      ifs_is_emri_no: ifsNo,
      durum: ihbar.durum === 'Beklemede' ? 'Islemde' : ihbar.durum
    }).eq('id', id)
    if (!error) { alert("Güncellendi!"); fetchData(); }
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

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    const { error } = await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    if (!error) { setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData(); }
  }

  if (!ihbar) return <div className="p-10 text-center font-black uppercase italic">Yükleniyor...</div>

  return (
    <div className="p-3 md:p-10 bg-gray-50 min-h-screen text-black font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-xs uppercase italic">← GERİ</button>
          <div className="text-[10px] font-bold text-gray-400 uppercase italic">
            {ihbar.ifs_is_emri_no ? `#${ihbar.ifs_is_emri_no}` : 'IFS NO YOK'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border-b-8 border-blue-900">
              
              {/* BAŞLIK VE DURUM */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">İHBAR VEREN / BİRİM</p>
                  <h1 className="text-2xl md:text-4xl font-black text-gray-800 uppercase italic tracking-tighter">{ihbar.musteri_adi}</h1>
                  <p className="text-lg text-blue-600 font-bold uppercase mt-1 italic">{ihbar.konu}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border-2 ${
                  ihbar.durum === 'Tamamlandi' ? 'bg-green-50 text-green-700 border-green-200' : 
                  ihbar.durum === 'Calisiliyor' ? 'bg-blue-600 text-white border-blue-700 animate-pulse' : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>{ihbar.durum}</span>
              </div>

              {/* --- ARAMA BUTONU --- */}
              {ihbar.ihbar_veren_tel && (
                <div className="mb-8 p-5 bg-green-50 border-2 border-green-100 rounded-[2rem] flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-500 p-3 rounded-2xl text-white">📞</div>
                    <div>
                      <p className="text-[9px] font-black text-green-600 uppercase italic">İhbarcıya Ulaş</p>
                      <p className="text-lg font-black text-slate-800">{ihbar.ihbar_veren_tel}</p>
                    </div>
                  </div>
                  <a href={`tel:${ihbar.ihbar_veren_tel}`} className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase">ŞİMDİ ARA</a>
                </div>
              )}

              {/* AÇIKLAMA VE DÜZENLEME */}
              {editMode ? (
                <div className="space-y-4">
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl" value={editForm.musteri_adi} onChange={e=>setEditForm({...editForm, musteri_adi:e.target.value})} placeholder="İhbar Veren"/>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl" value={editForm.ihbar_veren_tel} onChange={e=>setEditForm({...editForm, ihbar_veren_tel:e.target.value})} placeholder="İrtibat No"/>
                  <textarea className="w-full p-4 bg-gray-50 border rounded-2xl" rows={3} value={editForm.aciklama} onChange={e=>setEditForm({...editForm, aciklama:e.target.value})} />
                  <button onClick={async () => { await supabase.from('ihbarlar').update(editForm).eq('id', id); setEditMode(false); fetchData(); }} className="bg-blue-600 text-white w-full p-4 rounded-2xl font-black uppercase">KAYDET</button>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase italic">📋 İHBAR DETAYLARI</p>
                    {canEditDetails && <button onClick={() => setEditMode(true)} className="text-[8px] font-black text-blue-600 uppercase italic">✏️ DÜZENLE</button>}
                  </div>
                  <p className="text-gray-700 italic text-lg">{ihbar.aciklama || 'Açıklama yok.'}</p>
                </div>
              )}

              {/* MALZEME TABLOSU */}
              <div className="mt-6 border-t pt-6 overflow-x-auto">
                <h3 className="font-black text-xs text-gray-400 uppercase mb-4">📦 KULLANILAN MALZEMELER</h3>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
                    <tr><th className="p-3">KOD</th><th className="p-3">MALZEME</th><th className="p-3 text-right">ADET</th></tr>
                  </thead>
                  <tbody className="divide-y text-sm font-bold uppercase italic">
                    {kullanilanlar.length > 0 ? kullanilanlar.map(k => (
                      <tr key={k.id}>
                        <td className="p-3 text-blue-600">{k.malzeme_kodu}</td>
                        <td className="p-3">{k.malzeme_adi}</td>
                        <td className="p-3 text-right text-orange-600">{k.kullanim_adedi}</td>
                      </tr>
                    )) : <tr><td colSpan={3} className="p-6 text-center text-gray-300 italic">Malzeme yok.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SAĞ PANEL: ATAMA VE SAHA İŞLEMLERİ */}
          <div className="space-y-6">
            {canEditAssignment && (
              <div className="bg-white p-6 rounded-[2rem] shadow-xl border-t-8 border-orange-500">
                <h3 className="font-black text-xs uppercase text-orange-600 mb-4 italic">SORUMLU ATAMA</h3>
                <input placeholder="IFS NO" className="w-full p-3 bg-blue-50 border rounded-xl font-black text-xs mb-3" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-xs mb-3">
                  <option value="">SEÇİNİZ...</option>
                  {atamaTuru === 'personel' ? personeller.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>) : gruplar.map(g => <option key={g.id} value={g.id}>{g.grup_adi}</option>)}
                </select>
                <button onClick={handleAssignmentUpdate} className="w-full bg-gray-800 text-white p-3 rounded-xl font-black text-[10px] uppercase">GÜNCELLE</button>
              </div>
            )}

            {canPerformSahaActions && ihbar.durum === 'Calisiliyor' ? (
               <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-blue-600">
                  <h3 className="font-black text-xl mb-4 text-blue-900 italic uppercase">İŞLEMLER</h3>
                  <textarea className="w-full p-3 border rounded-xl bg-gray-50 text-xs font-bold mb-4" placeholder="Yapılan işlemi yazın..." rows={3} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                  <button onClick={isiTamamla} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-xl uppercase italic text-xs mb-3">🏁 İŞİ BİTİR</button>
               </div>
            ) : ihbar.durum !== 'Tamamlandi' && (
              <button onClick={isiBaslat} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black shadow-xl uppercase italic animate-pulse">🛠️ İŞİ BAŞLAT</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
