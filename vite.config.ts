import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      hmr: {
        overlay: false,
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
    },
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'three', 
        '@react-three/fiber', 
        '@react-three/drei',
        '@react-three/postprocessing'
      ],
    },
  };
});
