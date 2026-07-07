import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base: './' → relative asset paths, so the same build works at the GitHub Pages
// subpath (/ET-Hackathon/), from any static host, and from file:// (airplane mode).
export default defineConfig({ base: './', plugins: [react()] });
