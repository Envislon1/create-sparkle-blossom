
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.39d5fa31b19c4825a5e8cd8069564bba',
  appName: 'build-a-better-bot',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    App: {
      launchShowDuration: 0
    }
  }
};

export default config;
