import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Démo publiée sur GitHub Pages, sous https://thesirix.github.io/Portfolio-3D/
export default defineConfig({
  base: "/Portfolio-3D/",
  plugins: [react()],
  build: {
    // three.js est dans un fichier à part, chargé après l'affichage de la page
    chunkSizeWarningLimit: 700,
  },
});
