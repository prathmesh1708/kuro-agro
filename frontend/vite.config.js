import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'force-close-build',
      closeBundle() {
        // Forcefully exit the process once the build is successfully completed
        setTimeout(() => {
          process.exit(0);
        }, 200);
      }
    }
  ],
  resolve: {
    alias: {
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Only the always-needed core goes in a shared chunk. Heavy libraries (charts,
        // firebase, lottie, gsap, swiper) are split automatically and load with the pages
        // that use them, instead of being forced into the first page load.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) {
            return "react-vendor";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["recharts"]
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
