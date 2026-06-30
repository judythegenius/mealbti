import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'mealbti',
  brand: {
    displayName: '오늘 뭐 먹지?',
    primaryColor: '#3182F6',
    icon: 'https://static.toss.im/appsintoss/47343/5014d435-5a45-4cfc-a259-066c17d50bf5.png',
  },
web: {
    host: '192.168.0.27',
    port: 8081,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
    permissions: [
      {
        name: 'geolocation',
        access: 'getCurrentLocation',
      },
    ],
  },
  permissions: [],
  outdir: 'dist',
  webViewProps: {
    type: 'partner',
  },
});