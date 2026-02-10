"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react"; // useState eklendi
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core"; // Capacitor kontrolü eklendi
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

 useEffect(() => {
  const setup = async () => {
    // SADECE MOBİLDE ÇALIŞSIN
    if (Capacitor.getPlatform() !== 'web') {
      const result = await PushNotifications.requestPermissions();
      
      // TEST İÇİN: Ekrana uyarı çıkartalım
      alert("Bildirim İzni: " + result.receive);

      await PushNotifications.createChannel({
        id: 'saha360_v3', // İsmi v3 yapıyoruz (Tertemiz sayfa)
        name: 'Saha360 OZEL SES',
        importance: 5,
        sound: 'ihbar_sesi', // Uzantısız!
        visibility: 1,
        vibration: true,
      });
      
      alert("Kanal v3 Oluşturuldu! Ayarları kontrol et.");
    }
  };
  setup();
}, []);

  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Next.js Hydration hatalarını önlemek için isClient kontrolü */}
        {isClient ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
      </body>
    </html>
  );
}