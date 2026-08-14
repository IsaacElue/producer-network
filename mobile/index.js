// Custom entry: load runtime polyfills (WebCrypto for PKCE) before the app
// boots, then hand off to expo-router. Keep the polyfill import first.
import './src/lib/polyfills';
import 'expo-router/entry';
