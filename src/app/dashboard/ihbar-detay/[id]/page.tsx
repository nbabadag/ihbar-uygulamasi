'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function IhbarDetay() {
  const { id } = useParams()
  const router = useRouter()
  
  const [ihbar, setIhbar] = useState<any>(null)
  const [personeller, setPersoneller] = useState<any[]>([])
  const [malzemeKatalog, setMalzemeKatalog] = useState<any[]>([])
  const [kullanilanlar, setKullanilanlar] = useState<any[]>([])
  
  const [kapatmaTarihi, setKapatmaTarihi] = useState(new Date().toISOString().split('T')[0])
  const [bitisSaati, setBitisSaati] = useState(new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}))
  const [personelNotu, setPersonelNotu] = useState('')
  
  const [miktar, setMiktar] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [secilenMalzeme, setSecilenMalzeme] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  
  const [editForm, setEditForm] = useState({ 
    musteri_adi: '', 
    konu: '', 
    aciklama: '',
    ifs_is_emri_no: '' 
  })

  const fetchData = async () => {
    const { data: ihbarData } = await supabase.from('ihbarlar').select('*').eq('id', id).single()
    const { data: pData } = await supabase.from('profiles').select('*').eq('role', 'Teknik Personel')
    const { data: mKatalog } = await supabase.from('malzemeler').select('*')
    const { data: hData } = await supabase.from('ihbar_malzemeleri').select('*').eq('ihbar_id', id)

    if (ihbarData) {
      setIhbar(ihbarData)
      setEditForm({ 
        musteri_adi: ihbarData.musteri_adi || '', 
        konu: ihbarData.konu || '', 
        aciklama: ihbarData.aciklama || '',
        ifs_is_emri_no: ihbarData.ifs_is_emri_no || '' 
      })
      if (ihbarData.personel_notu) setPersonelNotu(ihbarData.personel_notu)
      if (ihbarData.kapatma_tarihi) setKapatmaTarihi(ihbarData.kapatma_tarihi.split('T')[0])
      if (ihbarData.bitis_saati) setBitisSaati(ihbarData.bitis_saati.substring(0,5))
    }
    setPersoneller(pData || [])
    setMalzemeKatalog(mKatalog || [])
    setKullanilanlar(hData || [])
  }

  useEffect(() => { fetchData() }, [id])

  const filtrelenmisMalzemeler = malzemeKatalog.filter(m => 
    m.malzeme_kodu.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  // İŞİ KABUL ET / BAŞLAT
  const isiBaslat = async () => {
    setLoading(true)
    const simdi = new Date().toISOString()
    
    const { data, error } = await supabase.from('ihbarlar')
      .update({ 
        durum: 'Calisiliyor', 
        kabul_tarihi: simdi 
      })
      .eq('id', id)
      .select();
    
    if (error) {
      alert("Hata: " + error.message)
    } else {
      alert("İş emri kabul edildi. Çalışma süresi başladı.")
      fetchData()
    }
    setLoading(false)
  }

  const ihbarGuncelle = async () => {
    setLoading(true)
    const { error } = await supabase.from('ihbarlar')
      .update({ 
        musteri_adi: editForm.musteri_adi,
        konu: editForm.konu,
        aciklama: editForm.aciklama,
        ifs_is_emri_no: editForm.ifs_is_emri_no,
        kapatma_tarihi: new Date(kapatmaTarihi).toISOString() 
      })
      .eq('id', id)
    
    if (!error) { alert("Güncellendi."); setEditMode(false); fetchData(); }
    setLoading(false)
  }

  const personelAta = async (pId: string) => {
    if (!editForm.ifs_is_emri_no) return alert("Lütfen önce IFS İş Emri No giriniz.")
    setLoading(true)
    const { error } = await supabase.from('ihbarlar')
      .update({ atanan_personel: pId, durum: 'Islemde', ifs_is_emri_no: editForm.ifs_is_emri_no, atama_tarihi: new Date().toISOString() })
      .eq('id', id)
    if (!error) { alert('Personel Atandı!'); fetchData(); }
    setLoading(false)
  }

  const malzemeEkle = async () => {
    if (!secilenMalzeme || miktar <= 0) return alert('Malzeme ve miktar seçin!')
    const { error } = await supabase.from('ihbar_malzemeleri').insert([{
      ihbar_id: id, malzeme_kodu: secilenMalzeme.malzeme_kodu, malzeme_adi: secilenMalzeme.malzeme_adi, kullanim_adedi: miktar
    }])
    if (!error) { alert('Eklendi!'); setMiktar(0); setSecilenMalzeme(null); setSearchTerm(''); fetchData(); }
  }

  const isiTamamla = async () => {
    if (!personelNotu) return alert("Lütfen yapılan işlemi kısaca açıklayınız.");
    setLoading(true);
    const { error } = await supabase.from('ihbarlar').update({ 
      durum: 'Tamamlandi', 
      kapatma_tarihi: new Date(kapatmaTarihi).toISOString(),
      bitis_saati: bitisSaati,
      personel_notu: personelNotu 
    }).eq('id', id);

    if (!error) { 
        alert("İş başarıyla kapatıldı. Ana sayfaya yönlendiriliyorsunuz."); 
        router.push('/dashboard'); 
    }
    setLoading(false);
  }

  if (!ihbar) return <div className="p-10 text-center text-black">Yükleniyor...</div>

  return (
    <div className="p-10 bg-gray-50 min-h-screen text-black">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 font-bold hover:underline">← Geri Dön</button>
          <button onClick={() => setEditMode(!editMode)} className="bg-gray-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm">
            {editMode ? '❌ Kapat' : '✏️ Bilgileri Düzenle'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              {editMode ? (
                <div className="space-y-4 text-black">
                  <input className="w-full p-3 border rounded-xl" value={editForm.musteri_adi} onChange={e=>setEditForm({...editForm, musteri_adi:e.target.value})} placeholder="Müşteri Adı"/>
                  <input className="w-full p-3 border rounded-xl" value={editForm.konu} onChange={e=>setEditForm({...editForm, konu:e.target.value})} placeholder="İhbar Konusu"/>
                  <textarea className="w-full p-3 border rounded-xl" rows={3} value={editForm.aciklama} onChange={e=>setEditForm({...editForm, aciklama:e.target.value})} placeholder="İhbar Açıklaması"/>
                  <button onClick={ihbarGuncelle} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Kaydet</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-800 mb-1">{ihbar.musteri_adi}</h1>
                      <p className="text-lg text-blue-600 font-semibold">{ihbar.konu}</p>
                    </div>
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${
                      ihbar.durum === 'Tamamlandi' ? 'bg-green-100 text-green-700' : 
                      ihbar.durum === 'Calisiliyor' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      'bg-orange-100 text-orange-700'
                    }`}>{ihbar.durum}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-black">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Müşteri İhbarı</p>
                      <p className="text-sm text-gray-700 italic">"{ihbar.aciklama || 'Detay girilmemiş'}"</p>
                    </div>
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Teknik Personel Notu</p>
                      <p className="text-sm text-blue-800 font-bold">{ihbar.personel_notu || 'Henüz not girilmedi.'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-[10px] font-bold text-gray-400">
                    {ihbar.atama_tarihi && <div>🕒 ATAMA: {new Date(ihbar.atama_tarihi).toLocaleString('tr-TR')}</div>}
                    {ihbar.kabul_tarihi && <div className="text-blue-600">🚀 KABUL/BAŞLAMA: {new Date(ihbar.kabul_tarihi).toLocaleString('tr-TR')}</div>}
                  </div>
                </>
              )}

              {ihbar.durum === 'Beklemede' && !editMode && (
                <div className="mt-6 p-6 bg-blue-50/50 border-2 border-blue-100 rounded-2xl space-y-4">
                  <h3 className="font-bold text-blue-800 text-sm uppercase tracking-widest text-center">İş Emri & Personel Atama</h3>
                  <input placeholder="IFS İş Emri No..." className="w-full p-3 border-2 border-white rounded-xl outline-none focus:border-blue-500 font-mono text-black" value={editForm.ifs_is_emri_no} onChange={e=>setEditForm({...editForm, ifs_is_emri_no:e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    {personeller.map(p => <button key={p.id} onClick={()=>personelAta(p.id)} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold text-xs shadow-md">{p.full_name} Ata</button>)}
                  </div>
                </div>
              )}
            </div>

            {/* HARCANAN MALZEME TABLOSU */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-black">
              <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2"><span>📦</span> Harcanan Malzemeler</h3>
              <table className="w-full text-left text-sm">
                <thead className="border-b text-gray-400 uppercase text-[10px] font-black">
                  <tr><th className="pb-2">Kod</th><th className="pb-2">Malzeme Adı</th><th className="pb-2 text-right">Miktar</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-black">
                  {kullanilanlar.map(k => (
                    <tr key={k.id} className="hover:bg-gray-50">
                      <td className="py-3 font-mono text-blue-600 font-bold">{k.malzeme_kodu}</td>
                      <td className="py-3 font-medium">{k.malzeme_adi}</td>
                      <td className="py-3 text-right font-black text-orange-600">{k.kullanim_adedi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-blue-600 sticky top-6 text-black">
              <h3 className="font-bold text-xl mb-6 text-blue-800">⚡ İşlemler</h3>
              
              {/* DURUM BAZLI BUTONLAR (Kabul Et veya Kapat) */}
              <div className="mb-6">
                {ihbar.durum === 'Islemde' ? (
                  <button 
                    onClick={isiBaslat}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-lg animate-pulse transition-all active:scale-95"
                  >
                    🚀 İŞİ KABUL ET VE BAŞLAT
                  </button>
                ) : ihbar.durum === 'Calisiliyor' ? (
                  <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl text-center">
                    <p className="text-blue-800 font-bold text-sm">👷 Şu an çalışılıyor...</p>
                    <p className="text-[10px] text-blue-400 uppercase mt-1">Malzemeleri girip işi kapatabilirsiniz</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <input type="text" placeholder="Malzeme Ara..." className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-black" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                {searchTerm && (
                  <div className="bg-white border rounded shadow-2xl max-h-40 overflow-auto z-20 text-black">
                    {filtrelenmisMalzemeler.map(m => (
                      <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-2 hover:bg-blue-50 cursor-pointer text-xs border-b">
                        <b className="text-blue-600">{m.malzeme_kodu}</b> - {m.malzeme_adi}
                      </div>
                    ))}
                  </div>
                )}
                {secilenMalzeme && <div className="text-xs p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 font-bold">✅ {secilenMalzeme.malzeme_adi}</div>}
                <input type="number" placeholder="Adet" className="w-full p-3 border rounded-xl font-bold bg-gray-50 text-black" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                <button onClick={malzemeEkle} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg mb-6">LİSTEYE EKLE</button>
                
                <div className="pt-6 border-t-2 border-dashed border-gray-100 space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Yapılan İşlem Notu</label>
                    <textarea 
                      className="w-full p-3 border rounded-xl bg-gray-50 text-sm focus:ring-2 focus:ring-green-500 outline-none text-black" 
                      placeholder="Arıza nasıl giderildi? (Zorunlu)"
                      rows={3}
                      value={personelNotu}
                      onChange={e=>setPersonelNotu(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-black">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase block">Kapatma Tarihi</label>
                      <input type="date" className="w-full p-2 border rounded-xl font-bold bg-gray-50 text-xs" value={kapatmaTarihi} onChange={e=>setKapatmaTarihi(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase block">Bitiş Saati</label>
                      <input type="time" className="w-full p-2 border rounded-xl font-bold bg-gray-50 text-xs" value={bitisSaati} onChange={e=>setBitisSaati(e.target.value)} />
                    </div>
                  </div>
                  
                  <button 
                    onClick={isiTamamla} 
                    disabled={loading || ihbar.durum === 'Beklemede' || ihbar.durum === 'Islemde'} 
                    className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 ${
                      (ihbar.durum === 'Beklemede' || ihbar.durum === 'Islemde') ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {ihbar.durum === 'Tamamlandi' ? '✅ BİLGİLERİ GÜNCELLE' : 
                     ihbar.durum === 'Islemde' ? 'ÖNCE İŞİ BAŞLATIN' : '🏁 İŞİ TAMAMLA VE KAPAT'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}