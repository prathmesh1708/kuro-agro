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
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
          if (id.includes("src/modules/Admin")) {
            return "admin-portal";
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
