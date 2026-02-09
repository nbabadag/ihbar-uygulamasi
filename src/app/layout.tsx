"use client"; // Bu satır Capacitor (Mobil) özellikleri için şarttır

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications"; // Eğer hata verirse: npm install @capacitor/push-notifications
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata'yı bu dosyadan sildik, çünkü 'use client' ile aynı yerde olması hata verebilir.
// Metadata için 'src/app/metadata.ts' diye bir dosya oluşturabilirsin ama şimdilik ses önemli.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  useEffect(() => {
    // Sadece tarayıcı/mobil ortamda çalışmasını sağlıyoruz
    const setupNotifications = async () => {
      try {
        // Önce izin isteyelim (İzin yoksa ses de çıkmaz)
        const permission = await PushNotifications.requestPermissions();
        
        if (permission.receive === 'granted') {
          // Bildirim kanalını oluşturuyoruz
          await PushNotifications.createChannel({
            id: 'saha360_channel', // Edge Function ile aynı olmalı
            name: 'Saha360 Acil Bildirimler',
            description: 'İhbar sesli bildirim kanalı',
            sound: 'ihbar_sesi', // res/raw klasöründeki dosya adı (uzantısız)
            importance: 5, // En yüksek seviye (Heads-up)
            visibility: 1,
            vibration: true,
          });
          console.log("🔔 Bildirim kanalı ve ses başarıyla ayarlandı.");
        }
      } catch (error) {
        console.error("❌ Ses kanalı oluşturma hatası:", error);
      }
    };

    setupNotifications();
  }, []);

  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}