'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

function MapUpdater({ center }: { center: [number, number] }) {
  const { useMap } = require('react-leaflet');
  const map = useMap();
  useEffect(() => {
    if (map && center && center[0] !== 0) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function HibritSahaPaneli() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [mod, setMod] = useState<'aktif' | 'tamamlandi' | 'canli'>('aktif')
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.93, 32.85]) // Varsayılan Ankara veya senin bölgen
  const [L, setL] = useState<any>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => { import('leaflet').then(m => setL(m)); }, []);

  // 📡 CANLI KONUM MOTORU (SAYFA AÇILDIĞI ANDA ÇALIŞIR)
  useEffect(() => {
    const initPresence = async () => {
      const channel = supabase.channel('online-sync', {
        config: { presence: { key: 'user' } }
      })

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat().map((p: any) => ({
          id: p.id,
          name: p.name || 'İsimsiz Personel',
          role: p.role || 'Saha Ekibi',
          lat: p.lat,
          lng: p.lng,
          lastSeen: new Date().toLocaleTimeString('tr-TR')
        }))
        console.log("📡 Sahadan Gelen Sinyaller:", users);
        setOnlineUsers(users.filter(u => u.lat && u.lng))
      })

      channel.subscribe()
      channelRef.current = channel
    }

    initPresence()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, []);

  // 🛰️ İŞLERİ GETİR (Aktif/Tamamlanmış)
  const veriGetir = useCallback(async () => {
    const durumlar = mod === 'tamamlandi' ? ['Tamamlandi'] : ['Islemde', 'Calisiliyor', 'Durduruldu', 'Beklemede'];
    const { data } = await supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name)`).in('durum', durumlar);
    setIsler(data || []);
  }, [mod]);

  useEffect(() => { veriGetir(); }, [veriGetir]);

  const createIcon = (type: 'ihbar' | 'personel' | 'muhur', color: string) => {
    if (!L) return undefined;
    return L.divIcon({
      html: `<div class="marker-container ${type === 'personel' ? 'radar' : ''}">
               <div class="main-dot" style="background:${color}"></div>
               ${type === 'personel' ? `<div class="pulse" style="border-color:${color}"></div>` : ''}
             </div>`,
      className: 'custom-marker',
      iconSize: [30, 30]
    });
  };

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white font-black italic uppercase overflow-hidden">
      <div className="p-4 bg-slate-900 border-b border-white/10 flex justify-between items-center z-[1000]">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="bg-orange-600 px-4 py-2 rounded-xl text-[10px]">← GERİ</button>
          <h1 className="text-sm">SAHA 360 // <span className="text-orange-500">KOMUTA MERKEZİ</span></h1>
        </div>
        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setMod('aktif')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'aktif' ? 'bg-blue-600 shadow-lg' : 'text-gray-500'}`}>🛰️ AKTİF</button>
          <button onClick={() => setMod('tamamlandi')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'tamamlandi' ? 'bg-green-600 shadow-lg' : 'text-gray-500'}`}>🏁 BİTEN</button>
          <button onClick={() => setMod('canli')} className={`px-4 py-2 rounded-xl text-[9px] ${mod === 'canli' ? 'bg-orange-600 shadow-lg' : 'text-gray-500'}`}>📡 CANLI ({onlineUsers.length})</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-80 bg-slate-900/95 border-r border-white/10 overflow-y-auto p-4 custom-scrollbar z-[500]">
           <div className="space-y-3">
              {mod === 'canli' ? (
                onlineUsers.length > 0 ? onlineUsers.map(u => (
                  <div key={u.id} onClick={() => setMapCenter([u.lat, u.lng])} className="bg-orange-900/20 border border-orange-500/40 p-4 rounded-3xl cursor-pointer">
                    <p className="text-xs font-bold text-orange-500">{u.name}</p>
                    <p className="text-[8px] text-gray-400">SON GÖRÜLME: {u.lastSeen}</p>
                  </div>
                )) : <p className="text-[10px] text-center text-gray-500 italic">SAHADA PERSONEL SİNYALİ YOK...</p>
              ) : (
                isler.map(is => (
                  <div key={is.id} className="bg-slate-800/40 border border-white/5 p-4 rounded-[2rem]">
                    <p className="text-xs text-blue-400 mb-1">{is.ihbar_veren_ad_soyad}</p>
                    <div className="grid grid-cols-3 gap-1">
                       <button onClick={() => is.enlem && setMapCenter([is.enlem, is.boylam])} className="bg-blue-600/20 p-2 rounded-lg text-[7px]">BAŞLA</button>
                       <button onClick={() => is.varis_enlem && setMapCenter([is.varis_enlem, is.varis_boylam])} className="bg-yellow-600/20 p-2 rounded-lg text-[7px]">VARDI</button>
                       <button onClick={() => is.bitis_enlem && setMapCenter([is.bitis_enlem, is.bitis_boylam])} className="bg-green-600/20 p-2 rounded-lg text-[7px]">BİTTİ</button>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        <div className="flex-1 relative z-10 bg-slate-950">
          {L && (
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              
              {/* İŞLER VE MÜHÜRLER (Her modda görünsün diye dışarıda) */}
              {isler.map(is => (
                <div key={is.id}>
                  {is.enlem && <Marker position={[is.enlem, is.boylam]} icon={createIcon('ihbar', '#3b82f6')}><Popup><p className="text-black font-bold">BAŞLANGIÇ: {is.ihbar_veren_ad_soyad}</p></Popup></Marker>}
                  {is.varis_enlem && <Marker position={[is.varis_enlem, is.varis_boylam]} icon={createIcon('muhur', '#eab308')}><Popup><p className="text-black font-bold">VARIŞ NOKTASI</p></Popup></Marker>}
                  {is.bitis_enlem && <Marker position={[is.bitis_enlem, is.bitis_boylam]} icon={createIcon('muhur', '#22c55e')}><Popup><p className="text-black font-bold">BİTİŞ NOKTASI</p></Popup></Marker>}
                </div>
              ))}

              {/* PERSONEL PİNLERİ (Radar Sadece 'Canli' Modda veya Her Zaman) */}
              {onlineUsers.map(u => (
                <Marker key={u.id} position={[u.lat, u.lng]} icon={createIcon('personel', '#f97316')}>
                  <Popup><p className="text-black font-bold">{u.name} (SAHADA)</p></Popup>
                </Marker>
              ))}
              
              <MapUpdater center={mapCenter} />
            </MapContainer>
          )}
        </div>
      </div>

      <style jsx global>{`
        .marker-container { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; }
        .main-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; }
        .radar .pulse { position: absolute; width: 30px; height: 30px; border: 2px solid; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
      `}</style>
    </div>
  )
}
