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
  const { useMap: useLeafletMap } = require('react-leaflet');
  const map = useLeafletMap();
  useEffect(() => {
    if (map && center && center[0] !== 0) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function HibritKomutaMerkezi() {
  const router = useRouter()
  const [isler, setIsler] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [mod, setMod] = useState<'aktif' | 'tamamlandi' | 'canli'>('aktif')
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.9334, 32.8597])
  const [L, setL] = useState<any>(null)
  const presenceChannelRef = useRef<any>(null)

  useEffect(() => { import('leaflet').then((leaflet) => setL(leaflet)); }, []);

  // 📡 ÇALIŞAN CANLI KONUM MOTORU (1. Sayfadan Aktarıldı)
  useEffect(() => {
    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return;

      const channel = supabase.channel('online-sync', {
        config: { presence: { key: 'user' } }
      })

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat().map((p: any) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          lat: p.lat,
          lng: p.lng,
          lastSeen: new Date().toLocaleTimeString('tr-TR')
        }))
        setOnlineUsers(users.filter((u: any) => u.lat && u.lng))
      })

      channel.subscribe()
      presenceChannelRef.current = channel
    }

    initPresence()
    return () => { if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current) }
  }, []);

  // 🛰️ İHBARLARI GETİR
  const veriGetir = useCallback(async () => {
    const durumlar = mod === 'tamamlandi' ? ['Tamamlandi'] : ['Islemde', 'Calisiliyor', 'Durduruldu', 'Beklemede'];
    const { data } = await supabase.from('ihbarlar').select(`*, profiles:atanan_personel(full_name)`).in('durum', durumlar);
    setIsler(data || []);
  }, [mod]);

  useEffect(() => { veriGetir(); }, [veriGetir]);

  // 🎨 İKONLAR
  const createIcon = (type: 'ihbar' | 'personel' | 'muhur', roleOrColor: string) => {
    if (!L) return undefined;
    const color = type === 'personel' ? (roleOrColor.includes('ADMIN') ? '#f97316' : '#22c55e') : roleOrColor;
    
    return L.divIcon({
      html: `
        <div class="marker-box ${type === 'personel' ? 'radar' : ''}">
          <div class="dot" style="background-color: ${color}; box-shadow: 0 0 10px ${color};"></div>
          ${type === 'personel' ? `<div class="pulse" style="border-color: ${color};"></div>` : ''}
        </div>`,
      className: 'custom-marker',
      iconSize: [25, 25]
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0b0e] text-white font-black italic uppercase overflow-hidden">
      {/* ÜST PANEL */}
      <div className="p-4 bg-[#111318] border-b border-gray-800 flex justify-between items-center z-[1000] shadow-2xl">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 border border-white/5 rounded-xl hover:bg-orange-600 transition-all text-[10px]">← GERİ</button>
          <h1 className="text-sm tracking-tighter">SAHA 360 // <span className="text-orange-500">HİBRİT KOMUTA</span></h1>
        </div>
        
        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 scale-90 md:scale-100">
          <button onClick={() => setMod('aktif')} className={`px-4 py-1.5 rounded-xl text-[9px] transition-all ${mod === 'aktif' ? 'bg-blue-600 shadow-lg shadow-blue-900/40' : 'text-gray-500'}`}>🛰️ AKTİF</button>
          <button onClick={() => setMod('tamamlandi')} className={`px-4 py-1.5 rounded-xl text-[9px] transition-all ${mod === 'tamamlandi' ? 'bg-green-600 shadow-lg shadow-green-900/40' : 'text-gray-500'}`}>🏁 BİTEN</button>
          <button onClick={() => setMod('canli')} className={`px-4 py-1.5 rounded-xl text-[9px] transition-all ${mod === 'canli' ? 'bg-orange-600 shadow-lg shadow-orange-900/40' : 'text-gray-500'}`}>📡 CANLI ({onlineUsers.length})</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* SOL LİSTE */}
        <div className="w-full md:w-80 bg-[#111318]/98 backdrop-blur-3xl border-r border-gray-800 flex flex-col z-[500] shadow-2xl">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {mod === 'canli' ? (
              onlineUsers.map(u => (
                <div key={u.id} onClick={() => setMapCenter([u.lat, u.lng])} className="bg-[#1a1c23] p-4 rounded-[1.5rem] border border-orange-500/20 hover:border-orange-500 transition-all cursor-pointer">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold">{u.name}</span>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  </div>
                  <p className="text-[8px] text-gray-500 mt-1">{u.role} - SON: {u.lastSeen}</p>
                </div>
              ))
            ) : (
              isler.map(is => (
                <div key={is.id} className="bg-[#1a1c23] p-4 rounded-[1.5rem] border border-white/5">
                  <p className="text-[10px] text-blue-400 font-bold mb-2">{is.ihbar_veren_ad_soyad}</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => is.enlem && setMapCenter([is.enlem, is.boylam])} className="bg-blue-600/10 text-blue-400 p-2 rounded-lg text-[7px] border border-blue-600/20">BAŞLA</button>
                    <button onClick={() => is.varis_enlem && setMapCenter([is.varis_enlem, is.varis_boylam])} className="bg-yellow-600/10 text-yellow-400 p-2 rounded-lg text-[7px] border border-yellow-600/20">VARDI</button>
                    <button onClick={() => is.bitis_enlem && setMapCenter([is.bitis_enlem, is.bitis_boylam])} className="bg-green-600/10 text-green-400 p-2 rounded-lg text-[7px] border border-green-600/20">BİTTİ</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* HARİTA */}
        <div className="flex-1 relative z-10 bg-[#0d0f14]">
          {L && (
            <MapContainer center={mapCenter} zoom={13} zoomControl={false} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              
              {/* İHBARLAR VE MÜHÜRLER */}
              {isler.map(is => (
                <div key={is.id}>
                  {is.enlem && <Marker position={[is.enlem, is.boylam]} icon={createIcon('ihbar', '#3b82f6')}><Popup><div className="text-black text-[10px] font-bold">BAŞLANGIÇ: {is.ihbar_veren_ad_soyad}</div></Popup></Marker>}
                  {is.varis_enlem && <Marker position={[is.varis_enlem, is.varis_boylam]} icon={createIcon('muhur', '#eab308')}><Popup><div className="text-black text-[10px] font-bold">VARIŞ NOKTASI</div></Popup></Marker>}
                  {is.bitis_enlem && <Marker position={[is.bitis_enlem, is.bitis_boylam]} icon={createIcon('muhur', '#22c55e')}><Popup><div className="text-black text-[10px] font-bold">BİTİŞ NOKTASI</div></Popup></Marker>}
                </div>
              ))}

              {/* CANLI PERSONEL (Radar Efektiyle) */}
              {onlineUsers.map(u => (
                <Marker key={u.id} position={[u.lat, u.lng]} icon={createIcon('personel', u.role)}>
                  <Popup><div className="text-black text-[10px] font-bold">{u.name} (AKTİF)</div></Popup>
                </Marker>
              ))}
              
              <MapUpdater center={mapCenter} />
            </MapContainer>
          )}
        </div>
      </div>

      <style jsx global>{`
        .marker-box { position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; z-index: 2; }
        .radar .pulse { position: absolute; width: 100%; height: 100%; border: 2px solid; border-radius: 50%; animation: radar-pulse 2s infinite; opacity: 0; }
        @keyframes radar-pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3.5); opacity: 0; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}
