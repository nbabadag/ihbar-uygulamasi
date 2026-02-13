package com.ihbar.app;

import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
// Eklentileri manuel kaydetmek gerekirse buraya ekleyeceğiz

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Capacitor 3+ sürümlerinde eklentiler otomatik yüklenir.
    }

    @Override
    public void onStart() {
        super.onStart();
        
        WebView webView = this.bridge.getWebView();
        
        // 🔊 Ses Kilidi: Personel dokunmasa da ses çalar
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        
        // 📍 Konum Kilidi: GPS motoru aktif
        webView.getSettings().setGeolocationEnabled(true);
        
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Konum izni penceresini tetikler
                callback.invoke(origin, true, false);
            }
        });
    }
}