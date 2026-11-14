import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.daralirtiqaa.app',
  appName: 'منظومة دار الإرتقاء الفكري التعليمية',
  webDir: 'www',
  // QA-only Android artifact for PR #111. Do not use the production origin here.
  // The branch alias keeps the installed test client pointed at the QA Preview.
  server: {
    url: 'https://alirtiqaa-educational-platform-git-secu-98cfdd-alooly44553-7281.vercel.app',
    cleartext: false,
    allowNavigation: ['alirtiqaa-educational-platform-git-secu-98cfdd-alooly44553-7281.vercel.app'],
  },
};

export default config;
