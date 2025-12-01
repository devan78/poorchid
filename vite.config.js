import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/poorchid/',
  plugins: [
    basicSsl()
  ],
  server: {
    port: 8080,
    host: true
  }
});
