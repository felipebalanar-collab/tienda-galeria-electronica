import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['gaelec web.png'],
      manifest: {
        name: 'Galería Electrónica',
        short_name: 'Gaelec',
        description: 'Punto de Venta e Inventario',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'gaelec web.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'gaelec web.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }), ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
