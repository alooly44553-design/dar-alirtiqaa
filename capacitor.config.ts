import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.daralirtiqaa.app.qa',
  appName: 'منظومة دار الإرتقاء الفكري التعليمية - QA',
  webDir: 'www',
  // QA-only app identity and origin: install alongside production without replacing it.
  // The branch alias keeps the installed test client pointed at the QA Preview.
  server: {
    url: 'https://alirtiqaa-educational-platform-git-secu-98cfdd-alooly44553-7281.vercel.app',
    cleartext: false,
    allowNavigation: ['alirtiqaa-educational-platform-git-secu-98cfdd-alooly44553-7281.vercel.app'],
  },
};

export default config;
