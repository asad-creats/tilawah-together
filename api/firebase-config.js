export default function handler(req, res) {
  const pick = (...keys) => {
    for (const key of keys) {
      const v = process.env[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  const cfg = {
    apiKey: pick('FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'),
    authDomain: pick('FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: pick('FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
    storageBucket: pick('FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: pick('FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: pick('FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
  };

  if (!cfg.apiKey) {
    return res.status(503).json({
      error: 'Firebase env vars not configured. Set FIREBASE_* or NEXT_PUBLIC_FIREBASE_* variables in Vercel.'
    });
  }
  return res.status(200).json(cfg);
}
