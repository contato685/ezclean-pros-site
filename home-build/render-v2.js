#!/usr/bin/env node
// Renders the home page ("HTML SITE") with a headless browser to capture the
// fully-resolved content (title, meta, real body markup — the bundler's
// asset-unpack + mustache/<sc-for> templating engine already produces this
// correctly, just only after JS runs in a browser). That captured body is
// spliced into the ORIGINAL source in place of the "Unpacking..." loading
// placeholder, while the original manifest/template/unpack <script> is left
// completely intact and still runs on DOMContentLoaded exactly as before.
//
// Why not ship pure static HTML (dropping the bundler machinery entirely)?
// Tried that first — it broke interactive behavior. Some bindings (the phone
// input mask confirmed via test) are wired by the templating engine as JS
// property assignments (element.oninput = fn), not as serializable HTML
// attributes, so a DOM snapshot alone silently loses them. Keeping the
// unpack script running guarantees the live, interactive page is built by
// the exact same mechanism as today — this only changes what a non-JS
// fetch (crawlers, curl, link-preview bots) sees before that JS runs.
//
// blob: URLs (images) only live inside the browser session that created
// them, so URL.createObjectURL is monkey-patched before navigation to
// capture each Blob's bytes; those get swapped back in as data: URIs in the
// spliced-in snapshot content.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'HTML SITE v2');
const DIST_DIR = path.join(__dirname, 'dist-v2');
const OUT = path.join(DIST_DIR, 'index.html');
const PORT = 8918;

const SERVICE_SLUGS = [
  'residential-cleaning', 'deep-cleaning-move-in-out', 'office-janitorial',
  'real-estate-property-turnover', 'vacation-rental-cleaning', 'airbnb-turnover-cleaning',
];

function serveOnce(html) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

async function renderSnapshot(sourceHtml) {
  const server = await serveOnce(sourceHtml);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(/googletagmanager|doubleclick|google-analytics|googleadservices|google\.com(\.br)?\/(ccm|pagead|rmkt)/, (r) => r.abort());

    await page.addInitScript(() => {
      window.__blobRegistry = new Map();
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = orig(blob);
        window.__blobRegistry.set(url, blob);
        return url;
      };
    });

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => !document.documentElement.outerHTML.includes('{{'), { timeout: 15000 });

    const blobData = await page.evaluate(async () => {
      function toBase64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
      }
      const out = {};
      for (const [url, blob] of window.__blobRegistry) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        out[url] = { mime: blob.type || 'application/octet-stream', base64: toBase64(buf) };
      }
      return out;
    });

    let fullHtml = await page.content();

    let substituted = 0;
    for (const [blobUrl, { mime, base64 }] of Object.entries(blobData)) {
      const dataUri = `data:${mime};base64,${base64}`;
      const count = fullHtml.split(blobUrl).length - 1;
      if (count > 0) {
        fullHtml = fullHtml.split(blobUrl).join(dataUri);
        substituted += count;
      }
    }
    const remainingBlobs = (fullHtml.match(/blob:[^"'\s)]+/g) || []);
    if (remainingBlobs.length > 0) {
      throw new Error(`Unresolved blob: URLs remain after substitution: ${remainingBlobs.join(', ')}`);
    }

    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (!bodyMatch) throw new Error('Could not locate <body> in rendered snapshot');

    return { bodyInner: bodyMatch[1], substituted };
  } finally {
    await browser.close();
    server.close();
  }
}

function splice(sourceHtml, bodyInner) {
  const bodyOpenIdx = sourceHtml.indexOf('<body>');
  const scriptIdx = sourceHtml.indexOf('document.addEventListener', bodyOpenIdx);
  const scriptTagIdx = sourceHtml.lastIndexOf('<script>', scriptIdx);
  if (bodyOpenIdx === -1 || scriptTagIdx === -1) {
    throw new Error('Could not locate the loading-shell placeholder region to replace');
  }
  const before = sourceHtml.slice(0, bodyOpenIdx + '<body>'.length);
  const after = sourceHtml.slice(scriptTagIdx);
  return `${before}\n${bodyInner}\n\n  ${after}`;
}

async function verifyFinalOutput(html) {
  // Load the merged file fresh and confirm the live, JS-driven behavior
  // (the whole reason the bundler script is kept) still reaches the same
  // end state as before — not just that static text is present.
  const server = await serveOnce(html);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(/googletagmanager|doubleclick|google-analytics|googleadservices|google\.com(\.br)?\/(ccm|pagead|rmkt)/, (r) => r.abort());
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => !document.documentElement.outerHTML.includes('{{'), { timeout: 15000 });

    const tel = page.locator('input[type=tel]');
    await tel.click();
    await tel.pressSequentially('8583705205', { delay: 10 });
    const phoneVal = await tel.inputValue();
    const phoneOk = phoneVal === '(858) 370-5205';
    console.log((phoneOk ? 'OK  ' : 'FAIL'), `phone mask still works after JS runs (got ${JSON.stringify(phoneVal)})`);

    const cardTitles = await page.locator('#services h3').allTextContents();
    const cardsOk = cardTitles.length === 6;
    console.log((cardsOk ? 'OK  ' : 'FAIL'), `6 service cards render after JS runs (got ${cardTitles.length})`);

    return phoneOk && cardsOk;
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const sourceHtml = fs.readFileSync(SOURCE, 'utf8');

  console.log('Rendering snapshot with headless Chromium...');
  const { bodyInner, substituted } = await renderSnapshot(sourceHtml);
  console.log(`blob refs substituted: ${substituted}`);

  const merged = splice(sourceHtml, bodyInner);

  const checks = [
    ['no leftover {{ mustache tokens in spliced content', !bodyInner.includes('{{')],
    ['no leftover <sc-for> tags in spliced content', !bodyInner.includes('<sc-for')],
    ['title tag present', /<title[^>]*>[^<]+<\/title>/.test(merged)],
    ['meta description present', /<meta name="description" content="[^"]+"/.test(merged)],
    ['h1 present with text', (() => {
      const m = merged.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      return !!m && m[1].replace(/<[^>]+>/g, '').trim().length > 0;
    })()],
    ['contact form present', bodyInner.includes('id="contact"') && /<form/i.test(bodyInner)],
    ['all 6 service card links present', SERVICE_SLUGS.every((slug) => bodyInner.includes(`/services/${slug}/`))],
    ['original unpack script still present (interactivity preserved)', merged.includes("document.addEventListener('DOMContentLoaded'")],
    ['original manifest script still present', merged.includes('script type="__bundler/manifest"')],
    ['original template script still present', merged.includes('script type="__bundler/template"')],
    ['ends with </html>', merged.trim().toLowerCase().endsWith('</html>')],
  ];

  let failed = false;
  for (const [label, ok] of checks) {
    console.log((ok ? 'OK  ' : 'FAIL'), label);
    if (!ok) failed = true;
  }

  if (failed) {
    console.error('\nBuild FAILED static checks — not proceeding to live verification.');
    process.exit(1);
  }

  console.log('\nVerifying the merged file end-to-end in a fresh browser (behavior parity)...');
  const behaviorOk = await verifyFinalOutput(merged);
  if (!behaviorOk) {
    console.error('\nBuild FAILED behavior verification — not writing output.');
    process.exit(1);
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(OUT, merged, 'utf8');
  console.log(`\nWrote ${OUT} (${(merged.length / 1024).toFixed(0)}KB)`);
}

main().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
