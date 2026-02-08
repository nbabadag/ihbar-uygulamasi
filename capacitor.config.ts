import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saha360.takip', // Bu senin paket kimliğin
  appName: 'Saha 360',
  webDir: 'public', // Capacitor'ın hata vermemesi için 'public' olarak mühürledik
  server: {
    url: 'https://ihbar-uygulamasi.vercel.app/', 
    cleartext: true
  }
};

export default config;