#!/usr/bin/env node
/**
 * End-to-end browser verification.
 *
 * Drives the locally installed Chrome over the DevTools Protocol using Node 24's
 * built-in WebSocket — no Playwright, no Puppeteer, no browser download.
 *
 * What it proves, in order:
 *   1. the app loads with no console errors and no uncaught exceptions
 *   2. the PDF pipeline actually renders (pages appear in the preview)
 *   3. the parser view and analysis tab render
 *   4. clicking Download produces a real file on disk
 *   5. screenshots are captured for a human to look at
 *
 * Usage: node scripts/verify-browser.mjs --url http://127.0.0.1:4173/ [--out .verify-out]
 */

import { mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function parseArgs(argv) {
  const args = { url: 'http://127.0.0.1:4173/', out: '.verify-out', port: 9333 };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--url') args.url = argv[++index];
    else if (key === '--out') args.out = argv[++index];
    else if (key === '--port') args.port = Number(argv[++index]);
  }
  return args;
}

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome or Edge was not found in any known location.');
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Kills the browser process *and its children*, and only those.
 *
 * Chrome spawns a renderer per tab; killing just the parent leaves orphaned
 * processes behind, and killing every `chrome.exe` on the machine would close the
 * user's own browser.
 */
function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

/** Prints everything the page logged, so a failure is diagnosable. */
function reportConsole(collected, consoleErrors, consoleWarnings) {
  console.log('');
  console.log(`console errors:   ${consoleErrors.length}`);
  for (const entry of consoleErrors.slice(0, 12)) console.log(`  ! ${entry.type}: ${entry.text.slice(0, 600)}`);
  console.log(`console warnings: ${consoleWarnings.length}`);
  for (const entry of consoleWarnings.slice(0, 8)) console.log(`  ~ ${entry.text.slice(0, 300)}`);
  if (collected.length === 0) console.log('  (page logged nothing at all)');
  return consoleErrors.length;
}

async function waitForEndpoint(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('Chrome DevTools endpoint never became available.');
}

async function pageTargetUrl(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error('No page target appeared.');
}

/** Minimal CDP client over the built-in WebSocket, with timeouts and close handling. */
class Cdp {
  constructor(url, { commandTimeout = 30_000 } = {}) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.commandTimeout = commandTimeout;
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener('open', () => resolveReady());
      this.socket.addEventListener('error', (event) => rejectReady(event.error ?? new Error('socket error')));
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: resolveCall, reject, timer } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? '')})`));
        else resolveCall(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
    // Without this, a crashed browser leaves every pending call hanging forever.
    const failAll = (reason) => {
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error(reason));
      }
      this.pending.clear();
    };
    this.socket.addEventListener('close', () => failAll('DevTools connection closed.'));
    this.socket.addEventListener('error', () => failAll('DevTools connection errored.'));
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolveCall, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, this.commandTimeout);
      this.pending.set(id, { resolve: resolveCall, reject, timer });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    try {
      this.socket.close();
    } catch {
      /* already closed */
    }
  }
}

async function evaluate(cdp, expression, sessionId) {
  const result = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true, userGesture: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(`Evaluation failed: ${result.exceptionDetails.exception?.description ?? 'unknown'}`);
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, { timeout = 30_000, label = expression, sessionId } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(cdp, expression, sessionId);
      if (last) return last;
    } catch (error) {
      last = error.message;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(last)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));  const outDir = resolve(args.out);
  const shotDir = join(outDir, 'screenshots');
  const downloadDir = join(outDir, 'downloads');
  mkdirSync(shotDir, { recursive: true });
  rmSync(downloadDir, { recursive: true, force: true });
  mkdirSync(downloadDir, { recursive: true });

  const chromePath = findChrome();
  // A fresh profile per run: Chrome locks the directory, and a leftover lock from
  // a previous run would otherwise abort this one.
  const userDataDir = join(outDir, `chrome-profile-${Date.now()}`);

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${args.port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1600,1100',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const consoleErrors = [];
  const consoleWarnings = [];
  const collected = [];
  const failedRequests = [];
  let cdp;
  let browserCdp;
  let failures = 0;

  try {
    const browserWs = await waitForEndpoint(args.port);
    const pageWs = await pageTargetUrl(args.port);

    browserCdp = new Cdp(browserWs);
    await browserCdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
    });

    cdp = new Cdp(pageWs);
    cdp.on((message) => {
      const method = message.method;
      if (method === 'Runtime.consoleAPICalled') {
        const type = message.params.type;
        const text = message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
        collected.push({ type, text });
      }
      if (method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        collected.push({
          type: 'exception',
          text: details.exception?.description ?? details.text ?? 'unknown exception',
        });
      }
      if (method === 'Network.responseReceived') {
        const { response } = message.params;
        if (response.status >= 400) failedRequests.push(`${response.status} ${response.url}`);
      }
      if (method === 'Network.loadingFailed') {
        failedRequests.push(`failed (${message.params.errorText})`);
      }
      if (method === 'Log.entryAdded') {
        const entry = message.params.entry;
        collected.push({ type: entry.level, text: `${entry.source}: ${entry.text}` });
      }
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    // Screenshots are for human review, so pin the colour scheme rather than
    // inheriting whatever the machine happens to prefer.
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });

    console.log(`→ navigating to ${args.url}`);
    await cdp.send('Page.navigate', { url: args.url });
    await waitFor(cdp, 'document.readyState === "complete"', { label: 'document ready' });
    await waitFor(cdp, 'Boolean(document.querySelector(".app"))', { label: 'app shell' });

    // 1. The PDF pipeline must actually produce pages.
    console.log('→ waiting for the PDF preview to render');
    const status = await waitFor(
      cdp,
      `(() => { const el = document.querySelector('.preview-toolbar__status'); if (!el) return false; const t = el.textContent || ''; return /\\d+ pages?/.test(t) ? t : false; })()`,
      { label: 'rendered page count', timeout: 60_000 },
    );
    console.log(`  preview status: ${status}`);

    const pageInfo = await waitFor(
      cdp,
      `(() => {
        const canvases = [...document.querySelectorAll('.pdf-page canvas')];
        const painted = canvases.filter((c) => c.width > 0 && c.height > 0).length;
        const links = document.querySelectorAll('.pdf-link').length;
        if (painted < 1 || links < 5) return false;
        return { pages: canvases.length, canvasesPainted: painted, links };
      })()`,
      { label: 'painted canvases and link overlays', timeout: 45_000 },
    );
    console.log(`  canvas pages: ${JSON.stringify(pageInfo)}`);
    if (pageInfo.pages < 1 || pageInfo.canvasesPainted < 1) {
      throw new Error('The preview did not paint any PDF page.');
    }

    const shot = async (name, { rendererDirect = false } = {}) => {
      // Scrolling panes are composited layers, and headless Chrome can serve a
      // stale frame for them. Nudging every scroller forces the layers to repaint
      // before the capture, so the screenshot matches the DOM.
      await evaluate(
        cdp,
        `(() => {
          for (const element of document.querySelectorAll('.pane__scroll, .preview-scroll')) {
            const before = element.scrollTop;
            element.scrollTop = before + 1;
            element.scrollTop = before;
          }
          return true;
        })()`,
      );
      await sleep(240);

      let data;
      try {
        ({ data } = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
          ...(rendererDirect ? { fromSurface: false } : {}),
        }));
      } catch (error) {
        console.log(`  (capture failed for ${name}: ${error.message}; retrying from the renderer)`);
        ({ data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }));
      }
      writeFileSync(join(shotDir, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`  screenshot: ${join(shotDir, `${name}.png`)}`);
    };

    await shot('01-editor-preview');

    const layout = await evaluate(
      cdp,
      `(() => {
        const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          appBody: rect('.app-body'),
          editor: rect('.pane--editor'),
          preview: rect('.pane--preview'),
          toolbar: rect('.preview-toolbar'),
          scroll: rect('.pane--preview .pane__scroll'),
          firstPage: rect('.pdf-page'),
          previewDisplay: getComputedStyle(document.querySelector('.pane--preview')).display,
          gridColumns: getComputedStyle(document.querySelector('.app-body')).gridTemplateColumns,
        };
      })()`,
    );
    console.log(`  layout: ${JSON.stringify(layout)}`);

    // 2. Parser view.
    console.log('→ switching to the parser view');
    await evaluate(
      cdp,
      `(() => { const el = [...document.querySelectorAll('.segmented button')].find((b) => b.textContent.trim() === 'Parser view'); el?.click(); return Boolean(el); })()`,
    );
    await waitFor(cdp, 'document.querySelectorAll(".parser-page").length >= 1', { label: 'parser view lines' });
    const parserStats = await evaluate(
      cdp,
      `(() => ({
        pages: document.querySelectorAll('.parser-page').length,
        lines: document.querySelectorAll('.parser-line').length,
        headings: document.querySelectorAll('.parser-line--heading').length,
      }))()`,
    );
    console.log(`  parser view: ${JSON.stringify(parserStats)}`);
    if (parserStats.headings < 4) throw new Error('Parser view did not highlight any section headings.');
    await shot('02-parser-view');

    // 3. Analysis tab.
    console.log('→ opening the analysis tab');
    await evaluate(
      cdp,
      `(() => { const el = [...document.querySelectorAll('.tab')].find((b) => b.textContent.includes('Analysis')); el?.click(); return Boolean(el); })()`,
    );
    await waitFor(cdp, 'document.querySelectorAll(".check").length >= 10', { label: 'analysis checks' });
    const analysisStats = await evaluate(
      cdp,
      `(() => ({
        checks: document.querySelectorAll('.check').length,
        failing: document.querySelectorAll('.check[data-status="fail"]').length,
        warnings: document.querySelectorAll('.check[data-status="warn"]').length,
        verdict: document.querySelector('.verdict__sub')?.textContent?.trim() ?? null,
      }))()`,
    );
    console.log(`  analysis: ${JSON.stringify(analysisStats)}`);
    if (typeof analysisStats.verdict !== 'string' || !/\d+ of \d+ checks pass/.test(analysisStats.verdict)) {
      throw new Error('The verdict does not lead with a cardinal count.');
    }
    await shot('03-analysis');

    // 4. Keyword matching against a pasted posting.
    console.log('→ pasting a job description');
    const posting = `Senior Backend Engineer

Requirements:
- 5+ years with Go or TypeScript
- Deep PostgreSQL knowledge
- Kubernetes and Terraform in production
- Kafka and event-driven architecture
- Experience with Rust is a plus
`;
    await evaluate(
      cdp,
      `(() => {
        const area = [...document.querySelectorAll('textarea')].find((t) => t.placeholder.includes('Paste the posting'));
        if (!area) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(area, ${JSON.stringify(posting)});
        area.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`,
    );
    await waitFor(cdp, 'document.querySelectorAll(".chip--hit").length >= 3', { label: 'keyword chips' });
    const keywordStats = await evaluate(
      cdp,
      `(() => ({
        matched: document.querySelectorAll('.chip--hit').length,
        missing: document.querySelectorAll('.chip--miss').length,
        meter: document.querySelector('.meter__fill')?.style.width ?? null,
      }))()`,
    );
    console.log(`  keywords: ${JSON.stringify(keywordStats)}`);
    await shot('04-keywords');

    // 5. The design tab.
    await evaluate(
      cdp,
      `(() => { const el = [...document.querySelectorAll('.tab')].find((b) => b.textContent.includes('Design')); el?.click(); return Boolean(el); })()`,
    );
    await waitFor(cdp, 'document.querySelectorAll(".color-swatch").length >= 8', { label: 'design controls' });
    await shot('05-design');

    // 6. Download the PDF and prove a file lands on disk.
    console.log('→ clicking Download');
    await evaluate(
      cdp,
      `(() => { const el = [...document.querySelectorAll('.tab')].find((b) => b.textContent.includes('Content')); el?.click(); return true; })()`,
    );
    await evaluate(cdp, `document.querySelector('[data-action="download"]')?.click() ?? null`);

    // Poll the filesystem from Node — the browser cannot see the download folder.
    const deadline = Date.now() + 30_000;
    let downloaded = null;
    while (Date.now() < deadline) {
      const files = readdirSync(downloadDir).filter((name) => name.toLowerCase().endsWith('.pdf'));
      if (files.length > 0) {
        downloaded = join(downloadDir, files[0]);
        break;
      }
      await sleep(300);
    }
    if (!downloaded) throw new Error('Clicking Download produced no PDF in the download directory.');
    console.log(`  downloaded: ${downloaded}`);

    // 7. Responsive and dark-mode rendering, so both are verified rather than assumed.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 420,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(500);
    const mobile = await evaluate(
      cdp,
      `(() => {
        const body = document.querySelector('.app-body');
        const pane = document.querySelector('.pane--editor');
        const preview = document.querySelector('.pane--preview');
        return {
          pane: Math.round(pane?.getBoundingClientRect().width ?? 0),
          previewHidden: preview ? getComputedStyle(preview).display === 'none' : null,
          switchVisible: getComputedStyle(document.querySelector('.mobile-switch')).display,
          columns: getComputedStyle(body).gridTemplateColumns,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      })()`,
    );
    console.log(`  mobile layout: ${JSON.stringify(mobile)}`);
    if (mobile.horizontalOverflow) throw new Error('The mobile layout scrolls horizontally.');
    if (mobile.previewHidden !== true) throw new Error('The mobile pane switch does not hide the preview.');
    await shot('06-mobile');

    await cdp.send('Emulation.clearDeviceMetricsOverride');
    // Click the real theme control rather than faking the media query, so the
    // toggle itself is exercised.
    const clicked = await evaluate(
      cdp,
      `(() => {
        const button = document.querySelector('[aria-label="Switch to dark theme"]');
        if (!button) return false;
        button.click();
        return true;
      })()`,
    );
    if (!clicked) throw new Error('The theme toggle button was not found.');
    // React applies the theme in an effect, so wait for it rather than reading
    // the attribute in the same tick as the click.
    await waitFor(cdp, 'document.documentElement.dataset.theme === "dark"', {
      label: 'dark theme applied',
      timeout: 5000,
    });
    await sleep(300);
    const darkContrast = await evaluate(
      cdp,
      `(() => {
        const read = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null; };
        return {
          body: getComputedStyle(document.body).backgroundColor,
          color: getComputedStyle(document.body).color,
          editorPane: read('.pane--editor'),
          card: read('.card'),
          parserPage: read('.parser-page'),
        };
      })()`,
    );
    console.log(`  dark palette: ${JSON.stringify(darkContrast)}`);
    // Every surface must actually repaint: a theme that only reaches the header
    // is worse than no theme at all.
    for (const [surface, value] of Object.entries(darkContrast)) {
      if (surface === 'color') continue;
      const channels = String(value).match(/\d+/g)?.map(Number) ?? [255, 255, 255];
      const brightness = (channels[0] + channels[1] + channels[2]) / 3;
      if (brightness > 90) {
        throw new Error(`Surface "${surface}" stayed light (${value}) after switching to the dark theme.`);
      }
    }
    await sleep(600);
    // Navigate afresh rather than reloading: the theme is persisted, so this
    // proves it survives a real page load, and a new document gets fresh
    // compositor layers (headless can otherwise serve a stale frame).
    await cdp.send('Page.navigate', { url: args.url });
    await waitFor(cdp, 'document.readyState === "complete" && Boolean(document.querySelector(".app"))', {
      label: 'app after reload',
    });
    await waitFor(cdp, 'document.documentElement.dataset.theme === "dark"', {
      label: 'dark theme restored from storage',
      timeout: 5000,
    });
    const afterReload = await evaluate(
      cdp,
      `(() => {
        const read = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null; };
        return { editorPane: read('.pane--editor'), card: read('.card') };
      })()`,
    );
    console.log(`  dark palette after reload: ${JSON.stringify(afterReload)}`);
    await sleep(500);
    // Note: headless Chrome can serve a stale composited frame for the scrolling
    // panes, so this screenshot is supplementary. The assertions above are the
    // real check: every surface's computed background must be dark, and the
    // theme must survive a full page load.
    await shot('07-dark');

    for (const entry of collected) {
      if (entry.type === 'error' || entry.type === 'exception') consoleErrors.push(entry);
      else if (entry.type === 'warning' || entry.type === 'warn') consoleWarnings.push(entry);
    }
  } catch (error) {
    for (const entry of collected) {
      if (entry.type === 'error' || entry.type === 'exception') consoleErrors.push(entry);
    }
    reportConsole(collected, consoleErrors, consoleWarnings);
    try {
      const diagnostics = await evaluate(
        cdp,
        `(() => ({
          status: document.querySelector('.preview-toolbar__status')?.textContent ?? null,
          errorBox: document.querySelector('.error-box')?.textContent?.slice(0, 800) ?? null,
          placeholder: document.querySelector('.preview-placeholder')?.textContent ?? null,
          canvases: document.querySelectorAll('.pdf-page canvas').length,
          canvasPainted: [...document.querySelectorAll('.pdf-page canvas')].map((c) => c.toDataURL().length),
          linkContainers: document.querySelectorAll('.pdf-links').length,
          parserPages: document.querySelectorAll('.parser-page').length,
          pageHtml: document.querySelector('.pdf-page')?.outerHTML.slice(0, 500) ?? null,
          tabs: [...document.querySelectorAll('.tab')].map((t) => t.textContent.trim()),
        }))()`,
      );
      console.error('\n--- page diagnostics ---');
      console.error(JSON.stringify(diagnostics, null, 2));
    } catch (diagnosticError) {
      console.error('could not collect diagnostics:', diagnosticError.message);
    }
    throw error;
  } finally {
    cdp?.close();
    browserCdp?.close();
    killTree(chrome);
  }

  reportConsole(collected, consoleErrors, consoleWarnings);
  if (failedRequests.length > 0) {
    console.log(`failed requests:  ${failedRequests.length}`);
    for (const entry of [...new Set(failedRequests)].slice(0, 10)) console.log(`  x ${entry}`);
  }
  if (consoleErrors.length > 0) {
    failures += 1;
    console.error('\nFAILED: the page logged errors.');
  }

  console.log(failures === 0 ? '\nBrowser verification passed.' : '\nBrowser verification FAILED.');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nBrowser verification FAILED.');
  console.error(error);
  process.exit(1);
});
