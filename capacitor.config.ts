import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.daralirtiqaa.app',
  appName: 'منظومة مدارس / مراكز دار الإرتقاء الفكري التعليمية',
  webDir: 'www',
  // This Android wrapper is intentionally online-connected so the hosted API routes,
  // authentication flows, and live student/teacher portals share the production origin.
  server: {
    url: 'https://alirtiqaa-educational-platform.vercel.app',
    cleartext: false,
    allowNavigation: ['alirtiqaa-educational-platform.vercel.app'],
  },
};

export default config;
