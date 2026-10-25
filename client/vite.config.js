import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  if (process.env.VERCEL) {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    try {
      const api = new URL(env.VITE_API_URL), socket = new URL(env.VITE_SOCKET_URL);
      const hosting = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
      const csp = hosting.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
      const sources = csp.match(/connect-src ([^;]+)/)[1].split(' ');
      if (api.protocol !== 'https:' || api.pathname !== '/api' || api.username || api.password || api.search || api.hash ||
          socket.href !== socket.origin + '/' || socket.origin !== api.origin || socket.username || socket.password ||
          !sources.includes(api.origin) || !sources.includes(api.origin.replace('https:', 'wss:')) || api.hostname.endsWith('.invalid')) throw new Error();
    } catch {
      throw new Error('Set HTTPS VITE_API_URL (ending /api) and VITE_SOCKET_URL to the same backend, then run configure:hosting for its exact origin.');
    }
  }
  return { plugins: [react(), tailwindcss()] };
});
