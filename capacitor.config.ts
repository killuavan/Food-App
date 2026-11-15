import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.killuavan.foodapp',
  appName: 'Pantry & Plate',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
