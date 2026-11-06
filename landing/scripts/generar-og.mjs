// Genera public/og-mesh.png (1200 × 630) con el logo, la cinta y "¿Y el Gonza?". Requiere el build previo.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const logo = readFileSync(new URL('../src/assets/logo.svg', import.meta.url), 'utf8')
const fuente = readFileSync(new URL('../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2', import.meta.url)).toString('base64')
const rueda = (x, y, r = 40) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#141210"/><circle r="${r * 0.45}" fill="#F4F1EE"/><circle r="${r * 0.245}" fill="#141210"/></g>`

const html = `<!doctype html><style>
@font-face{font-family:B;src:url(data:font/woff2;base64,${fuente}) format('woff2');font-weight:200 800}
*{margin:0}body{width:1200px;height:630px;background:#F4F1EE;overflow:hidden;position:relative;font-family:B,sans-serif;color:#141210}
h1{position:absolute;left:64px;top:160px;font-size:178px;line-height:.9;letter-spacing:-.04em;font-weight:800;width:800px}
.logo{position:absolute;left:64px;top:44px;width:92px}.logo svg{width:100%;height:auto}
p{position:absolute;left:68px;bottom:44px;font-size:36px;font-weight:700;letter-spacing:-.01em}
svg.c{position:absolute;inset:0}</style>
<svg class="c" viewBox="0 0 1200 630"><path d="M640 680 C 690 520 800 560 800 430 C 800 320 960 390 1010 280 C 1060 170 1040 60 1240 -20" fill="none" stroke="#FE3A0F" stroke-width="64" stroke-linecap="round"/>
<g fill="none" stroke="#141210" stroke-width="4"><path d="M792 470 L802 372 L900 346 L990 312 L1030 214 L1056 120"/></g>
${rueda(792, 470, 34)}${rueda(802, 372, 34)}${rueda(900, 346, 34)}${rueda(990, 312, 34)}${rueda(1030, 214, 34)}${rueda(1056, 120, 34)}</svg>
<div class="logo">${logo}</div><h1>¿Y el Gonza?</h1><p>Salen juntos. Llegan juntos.</p>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 } })
await p.setContent(html)
await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: fileURLToPath(new URL('../public/og-mesh.png', import.meta.url)) })
await b.close()
