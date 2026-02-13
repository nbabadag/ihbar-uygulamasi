'use client'

/**
 * SAHA 360 - OPERASYONEL KONUM MERKEZİ
 * CANLI TAKİP EKRANI - NUSRET KAPTAN ÖZEL SÜRÜM
 * MAP.SETVIEW HATASI GİDERİLDİ - TAM SÜRÜM
 */

import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'

// CSS importu en tepede kalmalı
import 'leaflet/dist/leaflet.css'

// Harita bileşenlerini dinamik yüklüyoruz (SSR kapalı)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

import { 
  ChevronLeft, 
  Users, 
  Radio, 
  Activity,
  Target,
  Navigation as NavIcon
} from 'lucide-react'

// --- 🔄 HARİTA MERKEZİNİ GÜNCELLEME BİLEŞENİ (DÜZELTİLDİ) ---
function MapUpdater({ center }: { center: [number, number] }) {
  // react-leaflet'ten useMap'i burada dinamik olmadan çekiyoruz
  const { useMap: useLeafletMap } = require('react-leaflet');
  const map = useLeafletMap();
  
  useEffect(() => {
    if (map && center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function CanliTakipPage() {
  const router = useRouter()
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.9334, 32.8597])
  const [L, setL] = useState<any>(null)
  const presenceChannelRef = useRef<any>(null)

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet);
    });
  }, []);

  useEffect(() => {
    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return; }

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
        setOnlineUsers(users.filter(u => u.lat && u.lng))
      })

      channel.subscribe()
      presenceChannelRef.current = channel
    }

    initPresence()
    return () => { if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current) }
  }, [router]);

  const createStaffIcon = (role: string) => {
    if (!L) return null;
    const color = role.includes('ADMIN') ? '#f97316' : '#22c55e';
    return L.divIcon({
      html: `
        <div class="radar-marker">
          <div class="dot" style="background-color: ${color}; box-shadow: 0 0 10px ${color};"></div>
          <div class="pulse" style="border-color: ${color};"></div>
        </div>`,
      className: 'custom-staff-marker',
      iconSize: [20, 20]
    });
  };

  const focusUser = (user: any) => {
    setSelectedUser(user)
    setMapCenter([user.lat, user.lng])
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0b0e] text-white font-black italic uppercase overflow-hidden">
      
      {/* 🛠️ ÜST OPERASYON PANELİ */}
      <div className="p-5 bg-[#111318] border-b border-gray-800 flex items-center justify-between z-[1000] shadow-2xl shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-gray-900 border border-white/5 rounded-2xl hover:bg-orange-600 transition-all">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl tracking-tighter leading-none mb-1">CANLI <span className="text-orange-500">OPERASYON TAKİBİ</span></h1>
            <span className="text-[9px] text-green-500 flex items-center gap-1 tracking-[0.2em]">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> {onlineUsers.length} PERSONEL SAHADA
            </span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6">
           <Radio size={18} className="text-orange-500 animate-pulse" />
           <span className="text-[10px] text-blue-400">RADAR SİSTEMİ AKTİF</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* 🏰 SOL PERSONEL LİSTESİ */}
        <div className="w-full md:w-80 bg-[#111318]/98 backdrop-blur-3xl border-r border-gray-800 flex flex-col z-[500] shadow-2xl">
          <div className="p-6 border-b border-gray-800/50 bg-black/20 shrink-0">
            <h2 className="text-[10px] text-gray-500 tracking-[0.3em] flex items-center gap-2">
              <Target size={14} className="text-orange-500" /> TAKİP LİSTESİ
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {onlineUsers.map((u) => (
              <div 
                key={u.id}
                onClick={() => focusUser(u)}
                className={`group p-5 rounded-[2rem] border transition-all duration-300 cursor-pointer ${selectedUser?.id === u.id ? 'bg-orange-600 border-orange-400' : 'bg-[#1a1c23] border-white/5 hover:border-orange-500/50'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black text-white">{u.name}</span>
                    <span className="text-[8px] text-gray-400">{u.role}</span>
                  </div>
                  <Activity size={14} className="text-white animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🗺️ HARİTA ALANI */}
        <div className="flex-1 relative z-10 bg-[#0d0f14]">
          {L && (
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              zoomControl={false}
              className="h-full w-full"
              style={{ background: '#0d0f14' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; SAHA 360'
              />
              {onlineUsers.map((u) => (
                <Marker key={u.id} position={[u.lat, u.lng]} icon={createStaffIcon(u.role)}>
                  <Popup>
                    <div className="p-1 font-black italic uppercase text-[10px] text-black">
                      <p className="text-orange-600">{u.name}</p>
                      <p>{u.role}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              <MapUpdater center={mapCenter} />
            </MapContainer>
          )}
        </div>
      </div>

      <style jsx global>{`
        .radar-marker { position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; z-index: 2; }
        .pulse { position: absolute; width: 100%; height: 100%; border: 2px solid; border-radius: 50%; animation: radar-pulse 2s infinite; opacity: 0; }
        @keyframes radar-pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3.5); opacity: 0; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  )
}