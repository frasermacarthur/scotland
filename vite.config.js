import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any path:
  // GitHub Pages project sites (/repo-name/), Netlify, or a local folder.
  base: "./",
});
