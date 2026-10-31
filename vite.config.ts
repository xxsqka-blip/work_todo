import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const BRAND = '#22577a';
const BACKGROUND = '#f3f4ef';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      // 自己写 service worker（src/sw.ts），第 3 步要在里面加推送通知
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      // 图标已经在 globPatterns 里了，避免重复登记
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // 启动画面图片只在"添加到主屏幕"时用到，不需要离线缓存
        globIgnores: ['splash/**'],
      },
      manifest: {
        id: '/',
        name: '家务打卡',
        short_name: '家务打卡',
        description: '两个人一起做家务：一眼看出做没做，做完打个卡。',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: BRAND,
        background_color: BACKGROUND,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
