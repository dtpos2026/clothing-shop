import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitaltarget.fabricpos',
  appName: 'DT Fabric POS',
  webDir: 'dist',
  android: {
    // offline-first app: everything is bundled, no remote URL
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#164e3a' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
