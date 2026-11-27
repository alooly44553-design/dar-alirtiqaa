import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.daralirtiqaa.app.qa',
  appName: 'منظومة دار الإرتقاء الفكري التعليمية - QA',
  webDir: 'www',
  // QA-only app identity and immutable QA deployment origin.
  // Install alongside production; never replace the production application.
  server: {
    url: 'https://alirtiqaa-educational-platform-h2vt125vh-alooly44553-7281.vercel.app',
    cleartext: false,
    allowNavigation: ['alirtiqaa-educational-platform-h2vt125vh-alooly44553-7281.vercel.app'],
  },
};

export default config;
