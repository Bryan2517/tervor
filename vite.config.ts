import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Get base path from environment variable or use default
// For GitHub Pages with custom domain (root): set BASE_PATH=/
// For GitHub Pages with repo subdirectory: set BASE_PATH=/repository-name/
// For local development: leave unset or use /
const BASE_PATH = process.env.BASE_PATH || '/';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: BASE_PATH,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
