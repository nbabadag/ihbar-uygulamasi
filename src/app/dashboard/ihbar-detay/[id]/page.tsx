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
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ musteri_adi: '', konu: '', aciklama: '' })

  const canEditAssignment = ['Formen', 'Mühendis', 'Yönetici', 'Müdür', 'Admin'].includes(userRole)
  const isFormen = userRole === 'Formen';

  const fetchData = useCallback(async () => {
    const { data: ihbarData } = await supabase.from('ihbarlar').select(`
      *,
      profiles (full_name),
      calisma_gruplari (grup_adi)
    `).eq('id', id).single()

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

  // SORUMLU GÜNCELLEME (Admin/Mühendis Genel Atama)
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

  // FORMEN ÖZEL: İŞİ KENDİ ÜZERİNE AL
  const handleUstenle = async () => {
    setLoading(true)
    const { error } = await supabase.from('ihbarlar').update({
      atanan_personel: userId,
      atanan_grup_id: null,
      durum: 'Calisiliyor',
      kabul_tarihi: new Date().toISOString()
    }).eq('id', id)

    if (!error) { alert("İş üzerinize alındı ve başlatıldı!"); fetchData(); }
    setLoading(false)
  }

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
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <button onClick={() => router.push('/dashboard')} className="text-blue-900 font-black text-xs uppercase italic flex items-center gap-2">← Dashboard'a Dön</button>
          <div className="flex gap-2 text-[10px] font-bold text-gray-400">
            {ihbar.ifs_is_emri_no ? `IFS: #${ihbar.ifs_is_emri_no}` : 'IFS NO GİRİLMEMİŞ'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL TARAF: İŞ BİLGİLERİ */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-8 border-blue-900 relative overflow-hidden">
              {/* Durum Badge */}
              <div className="absolute top-0 right-0 p-6">
                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 ${
                  ihbar.durum === 'Tamamlandi' ? 'bg-green-50 text-green-700 border-green-200' : 
                  ihbar.durum === 'Calisiliyor' ? 'bg-blue-600 text-white border-blue-700 animate-pulse' : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>{ihbar.durum}</span>
              </div>

              {editMode ? (
                <div className="space-y-4 pt-4">
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.musteri_adi} onChange={e=>setEditForm({...editForm, musteri_adi:e.target.value})} placeholder="Müşteri Adı"/>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" value={editForm.konu} onChange={e=>setEditForm({...editForm, konu:e.target.value})} placeholder="İş Konusu"/>
                  <textarea className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" rows={3} value={editForm.aciklama} onChange={e=>setEditForm({...editForm, aciklama:e.target.value})} placeholder="Açıklama"/>
                  <button onClick={async () => {
                    await supabase.from('ihbarlar').update(editForm).eq('id', id);
                    setEditMode(false); fetchData();
                  }} className="bg-blue-600 text-white w-full p-4 rounded-2xl font-black uppercase shadow-lg shadow-blue-100">Değişiklikleri Kaydet</button>
                </div>
              ) : (
                <>
                  <div className="mb-6 pt-4">
                    <h1 className="text-4xl font-black text-gray-800 uppercase italic tracking-tighter leading-none">{ihbar.musteri_adi}</h1>
                    <p className="text-xl text-blue-600 font-bold uppercase italic mt-2">{ihbar.konu}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200 mb-6">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">📋 İhbarın Detaylı Açıklaması</p>
                    <p className="text-gray-700 font-medium italic text-lg leading-relaxed">"{ihbar.aciklama || 'Detay girilmemiş'}"</p>
                  </div>
                </>
              )}

              {/* MALZEME TABLOSU */}
              <div className="mt-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-xs mb-4 text-gray-400 uppercase tracking-widest">📦 Kullanılan Malzeme Listesi</h3>
                  <button onClick={() => setEditMode(!editMode)} className="text-[10px] font-black uppercase text-blue-600 hover:underline">
                    {editMode ? '❌ İptal' : '✏️ İş Bilgisini Düzenle'}
                  </button>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                    <tr><th className="p-3">Kod</th><th className="p-3">Malzeme</th><th className="p-3 text-right">Miktar</th></tr>
                  </thead>
                  <tbody className="divide-y text-sm font-bold">
                    {kullanilanlar.length > 0 ? kullanilanlar.map(k => (
                      <tr key={k.id} className="hover:bg-blue-50/50 transition-all group">
                        <td className="p-3 text-blue-600 group-hover:font-black">{k.malzeme_kodu}</td>
                        <td className="p-3 uppercase">{k.malzeme_adi}</td>
                        <td className="p-3 text-right text-orange-600 font-black">{k.kullanim_adedi}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="p-10 text-center text-gray-300 italic text-xs">Henüz malzeme eklenmedi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SAĞ TARAF: YÖNETİM & ATAMA PANELİ */}
          <div className="space-y-6">
            
            {/* 1. FORMEN & ADMIN ATAMA PANELİ */}
            {canEditAssignment && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-t-8 border-orange-500">
                <h3 className="font-black text-sm uppercase text-orange-600 mb-6 italic tracking-tighter">Sorumlu Yönetimi</h3>
                
                {/* FORMEN HIZLI EYLEM */}
                {isFormen && (ihbar.durum === 'Beklemede' || ihbar.durum === 'Islemde') && (
                  <button 
                    onClick={handleUstenle} 
                    className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-100 mb-6 active:scale-95 transition-all border-b-4 border-blue-800"
                  >
                    🚀 İşi Kendi Üzerine Al
                  </button>
                )}

                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase text-center italic">Veya Başkasına Atama Yap</p>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    <button onClick={() => setAtamaTuru('personel')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${atamaTuru === 'personel' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Kişi Ata</button>
                    <button onClick={() => setAtamaTuru('grup')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${atamaTuru === 'grup' ? 'bg-white shadow text-orange-600' : 'text-gray-400'}`}>Grup Ata</button>
                  </div>
                  <input placeholder="IFS İş Emri No" className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-xs placeholder-blue-300 outline-none focus:ring-2 focus:ring-blue-200" value={ifsNo} onChange={e=>setIfsNo(e.target.value)} />
                  <select value={seciliAtanan} onChange={e=>setSeciliAtanan(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-gray-200">
                    <option value="">👤 Personel/Grup Seçin...</option>
                    {atamaTuru === 'personel' 
                      ? personeller.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)
                      : gruplar.map(g => <option key={g.id} value={g.id}>{g.grup_adi}</option>)
                    }
                  </select>
                  <button 
                    onClick={handleAssignmentUpdate} 
                    disabled={loading || !seciliAtanan} 
                    className="w-full bg-gray-800 text-white p-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    ATAMAYI ONAYLA
                  </button>
                </div>
              </div>
            )}

            {/* 2. İŞLEM PANELİ (Kabul Et & Kapat) */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-blue-600 sticky top-6">
              <h3 className="font-black text-xl mb-6 text-blue-900 italic uppercase tracking-tighter">Saha İşlemleri</h3>
              
              {ihbar.durum === 'Islemde' || ihbar.durum === 'Beklemede' ? (
                <button 
                  onClick={isiBaslat} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-3xl font-black shadow-xl animate-pulse transition-all active:scale-95 uppercase italic text-sm"
                >
                  🛠️ İŞİ ŞİMDİ BAŞLAT
                </button>
              ) : ihbar.durum === 'Calisiliyor' ? (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                    <p className="text-blue-700 font-black text-[10px] uppercase italic">⚡ ÇALIŞMA DEVAM EDİYOR...</p>
                  </div>
                  
                  {/* MALZEME ARAMA */}
                  <div className="relative">
                    <input type="text" placeholder="🔍 Malzeme Ara..." className="w-full p-4 border rounded-2xl font-bold text-xs bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    {searchTerm && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border rounded-2xl shadow-2xl max-h-48 overflow-auto z-50">
                        {malzemeKatalog.filter(m => m.malzeme_adi.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 15).map(m => (
                          <div key={m.id} onClick={()=>{setSecilenMalzeme(m); setSearchTerm('')}} className="p-4 hover:bg-blue-50 cursor-pointer text-[10px] font-black border-b border-gray-50 uppercase italic flex justify-between">
                            <span>{m.malzeme_adi}</span>
                            <span className="text-blue-400 font-mono">[{m.malzeme_kodu}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {secilenMalzeme && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-100 animate-in slide-in-from-left">
                      <span className="text-[10px] font-black uppercase flex-1 truncate">✅ {secilenMalzeme.malzeme_adi}</span>
                      <input type="number" placeholder="Adet" className="w-16 p-2 bg-white border rounded-xl font-black text-xs outline-none" value={miktar} onChange={e=>setMiktar(Number(e.target.value))} />
                      <button onClick={malzemeEkle} className="bg-emerald-600 text-white p-2 px-3 rounded-xl font-black text-[9px] uppercase">EKLE</button>
                    </div>
                  )}

                  <hr className="opacity-50" />

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase italic">Yapılan İşlem Özeti (Zorunlu)</p>
                    <textarea className="w-full p-4 border rounded-2xl bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-green-100" placeholder="Örn: Arıza giderildi, parça değişti..." rows={3} value={personelNotu} onChange={e=>setPersonelNotu(e.target.value)} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase pl-1">Tarih</p>
                      <input type="date" className="w-full p-3 border rounded-xl font-bold text-[10px]" value={kapatmaTarihi} onChange={e=>setKapatmaTarihi(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase pl-1">Bitiş Saati</p>
                      <input type="time" className="w-full p-3 border rounded-xl font-bold text-[10px]" value={bitisSaati} onChange={e=>setBitisSaati(e.target.value)} />
                    </div>
                  </div>

                  <button 
                    onClick={isiTamamla} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-3xl font-black shadow-xl transition-all active:scale-95 uppercase italic text-sm border-b-4 border-green-800"
                  >
                    🏁 İŞİ TAMAMLA VE KAPAT
                  </button>
                </div>
              ) : (
                <div className="text-center p-12 bg-gray-50 rounded-[2.5rem] border-4 border-dashed border-gray-100">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="font-black uppercase text-gray-300 italic text-sm tracking-widest leading-none">İŞ BAŞARIYLA TAMAMLANDI</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}