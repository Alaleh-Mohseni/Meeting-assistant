import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { createHtmlPlugin } from "vite-plugin-html";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension';
  return {
    root: "src",
    envDir: "../",
    publicDir: isExtension ? false : "../public",
    plugins: [
      preact(),
      tailwindcss(),
      createHtmlPlugin({
        minify: true,
        template: isExtension ? 'index-extension.html' : 'index.html'
      }),
      isExtension && viteStaticCopy({
        targets: [
          {
            src: '../public/manifest.json',
            dest: '.',
          },
          {
            src: '../public/background.js',
            dest: '.',
          },
          {
            src: '../public/content.js',
            dest: '.',
          },
          {
            src: '../public/icons/*',
            dest: 'icons',
          },
        ],
      }),
    ],
    resolve: {
      alias: {
        react: "preact/compat",
        "react-dom/test-utils": "preact/test-utils",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
        "@": path.resolve("./"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "lucide-react"],
    },
    build: {
      target: "esnext",
      copyPublicDir: false,
      outDir: isExtension ? "../dist/extension" : "../dist",
      minify: "esbuild",
      emptyOutDir: true,
      rollupOptions: {
        input: isExtension
          ? {
            popup: path.resolve(__dirname, "src/index-extension.html"),
          }
          : path.resolve("src/index.html"),
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          manualChunks: isExtension ? undefined : {
            vendor: ["react", "react-dom"],
            ui: ["lucide-react"],
          },
        },
      },
    },
    server: !isExtension ? {
      watch: {
        usePolling: true,
        ignored: ["**/node_modules/**", "**/dist/**"]
      },
      proxy: {
        "/api": {
          target: "http://localhost:5173",
          changeOrigin: true,
          secure: false,
        },
      },
    } : undefined,
  };
});