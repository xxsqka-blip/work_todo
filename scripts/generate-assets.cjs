/**
 * 生成主屏幕图标和 iPhone 启动画面（输出到 public/，生成好的图片直接提交进仓库）。
 * 平时构建不需要跑它；只有改了图标设计才需要重新生成：
 *   node scripts/generate-assets.cjs
 * 需要本机装有 Playwright（云端开发环境里已经有了）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const BRAND_TOP = '#2b6d96';
const BRAND_BOTTOM = '#1b4a68';
const DONE = '#2b8a3e';
const BACKGROUND = '#f3f4ef';

/** 图标内容（512×512 坐标）。scale < 1 用于 maskable 图标的安全区 */
function iconSvg({ size, radius = 0, scale = 1 }) {
  const t = (1 - scale) * 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${BRAND_TOP}"/><stop offset="1" stop-color="${BRAND_BOTTOM}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${t} ${t}) scale(${scale})">
    <path d="M104 252 L256 124 L408 252" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M150 236 L256 148 L362 236 V378 a32 32 0 0 1 -32 32 H182 a32 32 0 0 1 -32 -32 Z" fill="#fff"/>
    <path d="M198 300 l42 42 l78 -86" fill="none" stroke="${DONE}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

/** iPhone 竖屏尺寸：CSS 宽 × 高 @ 像素比 */
const SPLASH = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // iPhone Air
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6s/7/8 Plus
  [375, 667, 2], // SE 2/3, 8
];

function splashHtml(w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${w}px;height:${h}px;background:${BACKGROUND};}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    font-family:"PingFang SC","WenQuanYi Zen Hei",sans-serif;color:#1d1f1c;}
  .icon{width:96px;height:96px;border-radius:22px;overflow:hidden;box-shadow:0 6px 18px rgba(27,74,104,.25)}
  .icon svg{display:block}
  .name{font-size:22px;font-weight:700;letter-spacing:2px}
  </style></head><body><div class="icon">${iconSvg({ size: 96 })}</div><div class="name">家务打卡</div></body></html>`;
}

async function main() {
  fs.mkdirSync(path.join(PUBLIC, 'icons'), { recursive: true });
  fs.mkdirSync(path.join(PUBLIC, 'splash'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), iconSvg({ size: 512, radius: 112 }));

  const browser = await chromium.launch();
  const shoot = async (html, w, h, dpr, out) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.setContent(html);
    await page.screenshot({ path: out, type: 'png' });
    await page.close();
  };
  const wrap = (svg) => `<!doctype html><html><body style="margin:0">${svg}</body></html>`;

  await shoot(wrap(iconSvg({ size: 180 })), 180, 180, 1, path.join(PUBLIC, 'icons/apple-touch-icon.png'));
  await shoot(wrap(iconSvg({ size: 192 })), 192, 192, 1, path.join(PUBLIC, 'icons/icon-192.png'));
  await shoot(wrap(iconSvg({ size: 512 })), 512, 512, 1, path.join(PUBLIC, 'icons/icon-512.png'));
  await shoot(wrap(iconSvg({ size: 512, scale: 0.78 })), 512, 512, 1, path.join(PUBLIC, 'icons/maskable-512.png'));

  const links = [];
  for (const [w, h, dpr] of SPLASH) {
    const file = `splash/iphone-${w * dpr}x${h * dpr}.png`;
    await shoot(splashHtml(w, h), w, h, dpr, path.join(PUBLIC, file));
    links.push(
      `    <link rel="apple-touch-startup-image" href="/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
    );
  }
  await browser.close();
  console.log('把下面这些 <link> 放进 index.html 的 <head>：\n' + links.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
