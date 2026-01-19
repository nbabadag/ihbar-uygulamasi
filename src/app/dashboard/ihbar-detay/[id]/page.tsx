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
  
  // Atama Paneli State
  const [atamaTuru, setAtamaTuru] = useState<'personel' | 'grup'>('personel')
  const [seciliAtanan, setSeciliAtanan] = useState('')
  const [userRole, setUserRole] = useState('')

  // Form State
  const [kapatmaTarihi, setKapatmaTarihi] = useState(new Date().toISOString().split('T')[0])
  const [bitisSaati, setBitisSaati] = useState(new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}))
  const [personelNotu, setPersonelNotu] = useState('')
  const [ifsNo, setIfsNo] = useState('')
  
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  
  const [editForm, setEditForm] = useState({ musteri_adi: '', konu: '', aciklama: '' })

  const canEditAssignment = ['Formen', 'Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole)

  const fetchData = useCallback(async () => {
    // 1. İhbar Verisi (İlişkili tablolarla beraber)
    const { data: ihbarData } = await supabase.from('ihbarlar').select(`
      *,
      profiles (full_name),
      calisma_gruplari (grup_adi)
    `).eq('id', id).single()

    // 2. Diğer Veriler
    const { data: pData } = await supabase.from('profiles').select('*').eq('is_active', true)
    const { data: gData } = await supabase.from('calisma_gruplari').select('*')
    const { data: mKatalog } = await supabase.from('malzemeler').select('*')
    const { data: hData } = await supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
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

  // SORUMLU GÜNCELLEME (Atanan Kişi veya Grup Değiştirme)
  const handleAssignmentUpdate = async () => {
    setLoading(true)
    const { error } = await supabase.from('ihbarlar').update({
      atanan_personel: atamaTuru === 'personel' ? seciliAtanan : null,
      atanan_grup_id: atamaTuru === 'grup' ? seciliAtanan : null,
      ifs_is_emri_no: ifsNo,
      durum: ihbar.durum === 'Beklemede' ? 'Islemde' : ihbar.durum // Eğer atanmamışsa 'İşlemde' yap
    }).eq('id', id)
    
    if (!error) { alert("Sorumlu Güncellendi!"); fetchData(); }
    setLoading(false)
  }

  // İŞİ KABUL ET / BAŞLAT (Saha Personeli Butonu)
  const isiBaslat = async () => {
    setLoading(true)
    const { error } = await supabase.from('ihbarlar').update({ 
      durum: 'Calisiliyor', 
      kabul_tarihi: new Date().toISOString() 
    }).eq('id', id)
    
    if (!error) { alert("İş Başlatıldı!"); fetchData(); }
    setLoading(false)
  }

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    const { error } = await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    if (!error) { setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData(); }
  }

  const isiTamamla = async () => {
    if (!personelNotu) return alert("Lütfen yapılan işlemi açıklayın.");
    setLoading(true);
    const { error } = await supabase.from('ihbarlar').update({ 
      durum: 'Tamamlandi', 
      kapatma_tarihi: new Date(kapatmaTarihi).toISOString(),
      bitis_saati: bitisSaati,
      personel_notu: personelNotu 
    }).eq('id', id);

    if (!error) { alert("İş Kapatıldı!"); router.push('/dashboard'); }
    setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-center font-black uppercase italic">Yükleniyor...</div>

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-screen text-black font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-xs uppercase italic flex items-center gap-2">← Geri Dön</button>
          <div className="flex gap-2">
            <button onClick={() => setEditMode(!editMode)} className="bg-gray-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase">
              {editMode ? '❌ Vazgeç' : '✏️ İş Detayını Düzenle'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL TARAF: İŞ BİLGİLERİ */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-8 border-blue-900">
              {editMode ? (
                <div className="space-y-4">
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.musteri_adi} onChange={e=>setEditForm({...editForm, musteri_adi:e.target.value})} placeholder="Müşteri Adı"/>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.konu} onChange={e=>setEditForm({...editForm, konu:e.target.value})} placeholder="İş Konusu"/>
                  <textarea className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" rows={3} value={editForm.aciklama} onChange={e=>setEditForm({...editForm, aciklama:e.target.value})} placeholder="Açıklama"/>
                  <button onClick={async () => {
                    await supabase.from('ihbarlar').update(editForm).eq('id', id);
                    setEditMode(false); fetchData();
                  }} className="bg-blue-600 text-white w-full p-4 rounded-2xl font-black uppercase">Değişiklikleri Kaydet</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h1 className="text-3xl font-black text-gray-800 uppercase italic tracking-tighter">{ihbar.musteri_adi}</h1>
                      <p className="text-xl text-blue-600 font-bold uppercase italic">{ihbar.konu}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 ${
                      ihbar.durum === 'Tamamlandi' ? 'bg-green-50 text-green-700 border-green-200' : 
                      ihbar.durum === 'Calisiliyor' ? 'bg-blue-600 text-white border-blue-700 animate-pulse' : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}>{ihbar.durum}</span>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200 mb-6">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2">İş Açıklaması</p>
                    <p className="text-gray-700 font-medium italic">"{ihbar.aciklama || 'Detay girilmemiş'}"</p>
                  </div>
                </>
              )}

              {/* HARCANAN MALZEME TABLOSU */}
              <div className="mt-10">
                <h3 className="font-black text-sm mb-4 text-gray-400 uppercase tracking-widest">📦 Kullanılan Malzemeler</h3>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                    <tr><th className="p-3">Kod</th><th className="p-3">Malzeme</th><th className="p-3 text-right">Adet</th></tr>
                  </thead>
                  <tbody className="divide-y text-sm font-bold">
                    {kullanilanlar.map(k => (
                      <tr key={k.id} className="hover:bg-gray-50 transition-all">
                        <td className="p-3 text-blue-600">{k.malzeme_kodu}</td>
                        <td className="p-3 uppercase">{k.malzeme_adi}</td>
                        <td className="p-3 text-right text-orange-600">{k.kullanim_adedi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SAĞ TARAF: YÖNETİM & ATAMA PANELİ */}
          <div className="space-y-6">
            
            {/* 1. ATAMA PANELİ (Yönetici Görür) */}
            {canEditAssignment && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-orange-100">
                <h3 className="font-black text-xs uppercase text-orange-600 mb-4 italic">Sorumlu Ata / Değiştir</h3>
                <div className="space-y-3">
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    <button onClick={() => setAtamaTuru('personel')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase ${atamaTuru === 'personel' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Kişi</button>
                    <button onClick={() => setAtamaTuru('grup')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase ${atamaTuru === 'grup' ? 'bg-white shadow text-orange-600' : 'text-gray-400'}`}>Grup</button>
                  </div>
                  <input placeholder="IFS İş Emri No" className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl font-bold text-xs" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                  <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl font-bold text-xs uppercase">
                    <option value="">Seçim Yapın...</option>
                    {atamaTuru === 'personel' 
                      ? personeller.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)
                      : gruplar.map(g => <option key={g.id} value={g.id}>{g.grup_adi}</option>)
                    }
                  </select>
                  <button onClick={handleAssignmentUpdate} disabled={loading} className="w-full bg-blue-900 text-white p-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">GÖREVLENDİRME GÜNCELLE</button>
                </div>
              </div>
            )}

            {/* 2. İŞLEM PANELİ (Kabul Et & Kapat) */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-blue-600 sticky top-6">
              <h3 className="font-black text-xl mb-6 text-blue-900 italic uppercase">İşlemler</h3>
              
              {ihbar.durum === 'Islemde' ? (
                <button onClick={isiBaslat} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl animate-pulse transition-all active:scale-95 uppercase italic text-sm">🚀 İŞİ KABUL ET VE BAŞLAT</button>
              ) : ihbar.durum === 'Calisiliyor' ? (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-center"><p className="text-green-700 font-black text-[10px] uppercase">⚡ ŞU AN SAHADAKİ PERSONEL ÇALIŞIYOR</p></div>
                  
                  {/* MALZEME ARAMA */}
                  <input type="text" placeholder="Malzeme Ara..." className="w-full p-3 border rounded-xl font-bold text-xs bg-gray-50" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  {searchTerm && (
                    <div className="bg-white border rounded-xl shadow-2xl max-h-40 overflow-auto z-20">
                      {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10).map(m => (
                        <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-3 hover:bg-blue-50 cursor-pointer text-[10px] font-bold border-b uppercase italic">{m.malzeme_adi}</div>
                      ))}
                    </div>
                  )}
                  {secilenMalzeme && <div className="text-[10px] p-2 bg-blue-50 text-blue-900 font-black uppercase">✅ {secilenMalzeme.malzeme_adi}</div>}
                  <div className="flex gap-2">
                    <input type="number" placeholder="Adet" className="w-20 p-3 border rounded-xl font-bold text-xs" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                    <button onClick={malzemeEkle} className="flex-1 bg-gray-800 text-white rounded-xl font-black text-[10px] uppercase">EKLE</button>
                  </div>

                  <hr />

                  <textarea className="w-full p-3 border rounded-xl bg-gray-50 text-xs font-bold" placeholder="Yapılan işlem detayları (ZORUNLU)" rows={3} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="p-2 border rounded-xl font-bold text-[10px]" value={kapatmaTarihi} onChange={e=>setKapatmaTarihi(e.target.value)} />
                    <input type="time" className="p-2 border rounded-xl font-bold text-[10px]" value={bitisSaati} onChange={e=>setBitisSaati(e.target.value)} />
                  </div>

                  <button onClick={isiTamamla} className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black shadow-xl transition-all uppercase italic text-sm">🏁 İŞİ TAMAMLA VE KAPAT</button>
                </div>
              ) : (
                <div className="text-center p-10 font-black uppercase text-gray-300 italic border-2 border-dashed rounded-3xl">İŞ TAMAMLANDI</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}