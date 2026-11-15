import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js est dans un fichier à part, chargé après l'affichage de la page
    chunkSizeWarningLimit: 700,
  },
});
