/**
 * Purpose: Configures Vite development/build behavior and runtime service URLs for ChatterBox.
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Creates the Vite configuration for the requested environment.
 *
 * @param {{ mode: string }} options - Vite command options.
 * @returns {import('vite').UserConfig} Vite application configuration.
 */
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = environment.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const socketUrl = environment.VITE_SOCKET_URL || 'http://localhost:5000';

  return {
    plugins: [react()],
    define: {
      __CHATTERBOX_API_URL__: JSON.stringify(apiBaseUrl),
      __CHATTERBOX_SOCKET_URL__: JSON.stringify(socketUrl)
    },
    server: {
      host: '0.0.0.0',
      port: 3000
    },
    preview: {
      host: '0.0.0.0',
      port: 3000
    }
  };
});
