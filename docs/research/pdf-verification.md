# Automated PDF Verification Harness

Research + empirically verified prototype for proving a browser-generated resume PDF is
**machine-parseable** and **interactive**.

Everything below was executed on this machine. Observed output is pasted verbatim.
Prototype source: `.research-scratch/verify/` (scripts in `scripts/`, modules in `lib/`,
fixtures in `fixtures/`).

**Environment measured:** Windows, Node `v24.18.0`, pnpm `11.17.0`, npm `11.16.0`,
Google Chrome `154.0.8037.93` at `C:\Program Files\Google\Chrome\Application\chrome.exe`.

---

## 1. Recommended harness design

### 1.1 The single most important finding

Of the four libraries the brief asked me to compare, **three are the same parser**:

| Library | Version | Parser underneath | Independent? |
|---|---|---|---|
| `pdfjs-dist` | 6.4.299 | pdf.js (Mozilla, JS) | reference |
| `pdf-parse` | 2.4.5 | `dependencies: { "pdfjs-dist": "5.4.296" }` | **no — also pdf.js** |
| `unpdf` | 1.8.1 | bundles a rolldown build of `pdfjs-dist@~6.1.200` into `dist/pdfjs.mjs` | **no — also pdf.js** |
| `pdf-lib` | 1.17.1 | none | **cannot extract text at all** |

Verified directly from the installed manifests:

```
$ node -e "console.log(require('./node_modules/pdf-parse/package.json').dependencies)"
{ '@napi-rs/canvas': '0.1.80', 'pdfjs-dist': '5.4.296' }

$ grep -o 'pdfjs-dist[^"]*' node_modules/unpdf/dist/pdfjs.mjs | head -1   # 1.6 MB bundled copy
$ ls -la node_modules/unpdf/dist/pdfjs.mjs
-rw-r--r-- 1 felix 197609 1676063 ... pdfjs.mjs
```

So **agreement between `pdfjs-dist`, `pdf-parse` and `unpdf` is not evidence** — it is one
parser agreeing with itself, three times. A harness built only on those three would report
"3/3 engines agree ✅" while a real pdf.js decoding bug went completely undetected.

I therefore added two genuinely independent engines (different languages and codebases):

- **`mupdf`** — Artifex MuPDF, C++ compiled to WASM
- **`@hyzyla/pdfium`** — Google PDFium (the engine inside Chrome), C++ compiled to WASM

Cross-checking `pdfjs-dist` (JS) against `mupdf` (C++/WASM) is meaningful: a shared bug is
very unlikely. `@hyzyla/pdfium` is a third opinion for tie-breaking.

### 1.2 Architecture

```
scripts/verify-ats.mjs  <file.pdf>            <- single entry point, exits non-zero on failure
  |
  |-- 1. lib/extract.mjs    pdfjs-dist (legacy) + mupdf + pdfium  -> text, visual lines, agreement
  |-- 2. lib/inspect.mjs    pdfjs-dist (high level) + pdf-lib (raw object graph)
  |                          /Annots, /Outlines, /Info, XMP /Metadata,
  |                          /StructTreeRoot, /Lang, page tree  -> cross-checked
  |-- 3. lib/rawscan.mjs    raw object graph + whole-file byte sweep
  |                          image XObjects, inline images, /FontDescriptor ->
  |                          /FontFile{,2,3}, /ToUnicode, encodings
  |-- 4. lib/ats.mjs        email/phone regex, standalone headings, chronology,
  |                          keyword + ligature integrity
  |-- 5. lib/browser.mjs    headless Chrome over CDP (built-in WebSocket, zero deps)
  |                          screenshot, DOM assertions, console/page error capture
```

Design rules that came out of the experiments:

1. **Two independent extractors, and their agreement is itself a check.** A big divergence
   between pdf.js and MuPDF is a bug signal, not a detail.
2. **Never trust a high-level API alone.** Every structural claim is read twice — once via
   pdf.js's resolving API, once via pdf-lib's raw object graph. The harness prints a
   PASS only when both agree.
3. **Hard vs soft checks.** Only real blockers are `hard` (non-zero exit). Base-14 fonts and
   unusual-but-legal encodings are `soft` so the harness does not cry wolf.
4. **Never normalise away the defect you are testing for.** `NFKC` would silently turn
   `U+FB01` into `fi`; the ligature check reports "found only after NFKC" as a *failure*.
5. **A negative control for every check.** A verifier that cannot fail proves nothing, so
   each check has a fixture that must break it (`fixtures/fake-image.pdf`,
   `fixtures/ligature-mangled.pdf`, `fixtures/resume-fonts.pdf`).

---

## 2. Exact dependency list and install commands

### 2.1 Runtime dependencies (the harness)

```bash
npm i pdfjs-dist@^6.4.299 mupdf@^1.28.1 @hyzyla/pdfium@^2.1.13 pdf-lib@^1.17.1
```

or with pnpm:

```bash
pnpm add pdfjs-dist@^6.4.299 mupdf@^1.28.1 @hyzyla/pdfium@^2.1.13 pdf-lib@^1.17.1
```

Fixture generation only (dev):

```bash
npm i -D @pdf-lib/fontkit@^1.1.1
```

### 2.2 Browser-side validation needs **no extra dependency**

Node ≥ 22 ships a global WHATWG `WebSocket`, so raw CDP works with zero packages:

```
$ node -e "console.log(typeof globalThis.WebSocket)"
function
```

`puppeteer-core` and `chrome-remote-interface` were evaluated and both work (see §7), but
neither is required. `ws` is also unnecessary.

### 2.3 Exact `package.json`

```json
{
  "name": "resumebuilder-verify",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "verify": "node scripts/verify-ats.mjs",
    "fixtures": "node scripts/make-fixtures.mjs"
  },
  "dependencies": {
    "@hyzyla/pdfium": "^2.1.13",
    "mupdf": "^1.28.1",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^6.4.299"
  },
  "devDependencies": {
    "@pdf-lib/fontkit": "^1.1.1"
  }
}
```

Measured installed footprint: `pdfjs-dist` 33.3 MB, `pdf-lib` 18.6 MB, `mupdf` 13.7 MB,
`@hyzyla/pdfium` 10.7 MB. The two WASM engines are the price of real independence — if
size matters, drop `@hyzyla/pdfium` (it is only a tie-breaker) and keep `mupdf`.

### 2.4 What NOT to install

**Do not add `pdf-parse`.** It is pdf.js in disguise *and* it is actively broken by version
skew — see pitfall P3. **Do not install `unpdf`** for a verification harness for the same
independence reason (it is fine as an application-level extractor, just not as a *witness*).

---

## 3. Area 1 — Text extraction

### 3.1 The working invocation (verified)

```js
// lib/extract.mjs
export async function extractPdfjs(bytes) {
  // The LEGACY build is mandatory on Node. Importing it installs the
  // DOMMatrix/Path2D polyfills that pdf.js needs; the modern build does not.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),   // Uint8Array, not Buffer, not ArrayBuffer
    useSystemFonts: true,          // silence warnings for non-embedded standard fonts
    isEvalSupported: false,        // safer; avoids eval-based font paths
    disableFontFace: true,         // no DOM font faces in Node
  });
  const doc = await task.promise;

  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();

    // Rebuild visual lines by grouping items on their baseline Y.
    const rows = new Map();
    for (const it of tc.items) {
      if (!('str' in it) || it.str === '') continue;
      const y = Math.round(it.transform[5] * 2) / 2;      // 0.5pt buckets
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], str: it.str, w: it.width ?? 0, h: it.height ?? 0 });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])                        // top-to-bottom
      .map(([y, items]) => {
        items.sort((a, b) => a.x - b.x);                  // left-to-right
        let s = '', prevEnd = null;
        for (const it of items) {
          // insert a space only on a real horizontal gap
          if (prevEnd !== null && it.x - prevEnd > Math.max(1, it.h * 0.22)) s += ' ';
          s += it.str;
          prevEnd = it.x + it.w;
        }
        return { y, text: s.replace(/\s+/g, ' ').trim() };
      })
      .filter((l) => l.text.length > 0);
    pages.push({ page: p, lines });
  }

  await task.destroy();   // v6: destroy() is on the LOADING TASK, not the document
  return { engine: 'pdfjs-dist', pages, text: pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n') };
}
```

```js
export async function extractMupdf(bytes) {            // independent engine #1
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(new Uint8Array(bytes), 'application/pdf');
  const n = doc.countPages();
  const pages = [];
  for (let i = 0; i < n; i++) {
    const page = doc.loadPage(i);
    const st = page.toStructuredText('preserve-whitespace');
    const raw = st.asText();
    st.destroy(); page.destroy();
    pages.push({ page: i + 1, lines: raw.split(/\r?\n/).map((t) => ({ text: t.trim() })).filter((l) => l.text) });
  }
  doc.destroy();
  return { engine: 'mupdf', pages, text: pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n') };
}
```

```js
export async function extractPdfium(bytes) {           // independent engine #2
  const { PDFiumLibrary } = await import('@hyzyla/pdfium');
  const lib = await PDFiumLibrary.init();
  try {
    const doc = await lib.loadDocument(new Uint8Array(bytes));
    const pages = [];
    for (let i = 0; i < doc.getPageCount(); i++) {
      const raw = doc.getPage(i).getText();           // note: getText(), not extractText()
      pages.push({ page: i + 1, lines: raw.split(/\r?\n/).map((t) => ({ text: t.trim() })).filter((l) => l.text) });
    }
    doc.destroy();
    return { engine: 'pdfium', pages, text: pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n') };
  } finally { lib.destroy(); }
}
```

### 3.2 `pdf-lib` cannot extract text — proven

Probing every plausible API on `PDFPage` and `PDFDocument`:

```js
const probes = ['getTextContent', 'extractText', 'getText', 'getOperatorList'];
Object.fromEntries(probes.map((p) => [p, typeof page[p]]));
// -> { getTextContent: 'undefined', extractText: 'undefined', getText: 'undefined', getOperatorList: 'undefined' }
```

Observed harness output:

```
  pdf-lib   unsupported (no text API) - see notes
```

`PDFPage#getContentStream()` exists but returns **raw PDF operators** (`Tj`/`TJ` with
*encoded byte strings*). Turning those into characters requires a content-stream
interpreter plus `/Encoding` and `/ToUnicode` CMap handling — i.e. writing a PDF text
extractor. pdf-lib is correctly used in this harness for **structure**, not text.

### 3.3 Observed results — bake-off over the fixture corpus

```
================================================================================================
fixtures/resume-rich.pdf  (55269 bytes)
================================================================================================
  pdfjs-dist  OK     385ms  chars=  1343
  pdf-parse   FAIL        UnknownErrorException: The API version "5.4.296" does not match the Worker version "6.4.299".
  unpdf       OK      63ms  chars=  1320
  pdf-lib     OK     112ms  chars=    72
  mupdf       OK      36ms  chars=  1334
  pdfium      OK      34ms  chars=  1353

  -- independent cross-check (pdfjs-dist vs mupdf vs pdfium) --
     mupdf       tokens=131 (pdfjs-dist=131) missing=0 extra=0
     pdfium      tokens=131 (pdfjs-dist=131) missing=0 extra=0
```

```
================================================================================================
fixtures/fake-image.pdf  (139020 bytes)
================================================================================================
  pdfjs-dist  OK       3ms  chars=     1        <- the "fake text" PDF yields nothing
  unpdf       OK       2ms  chars=     0
  mupdf       OK       2ms  chars=     1
  pdfium      OK      13ms  chars=     1
```

Final in-harness timings on a one-page resume (median):

```
  pdfjs-dist ok     391ms  chars=  1323  lines= 26
  mupdf      ok      44ms  chars=  1323  lines= 29
  pdfium     ok      42ms  chars=  1323  lines= 26
  agreement pdfjs-dist vs mupdf: 100.00% token overlap (133/133)
```

Against a **real 14-page academic paper** (`compressed.tracemonkey-pldi-09.pdf`, 82,938 chars,
90 images, 78 fonts) agreement is still **98.47%** — realistic, not a synthetic 100%.

### 3.4 pdfjs-dist v4 vs v5 vs v6 API differences on Node 24

Installed all three side by side and probed each in its own process:

| | 4.10.38 | 5.7.284 | 6.4.299 |
|---|---|---|---|
| `legacy/build/pdf.mjs` present | ✅ | ✅ | ✅ |
| `PDFDocumentProxy#destroy()` | ✅ | ✅ | **❌ removed** |
| `loadingTask.destroy()` | ✅ | ✅ | ✅ (now the only way) |
| `doc.cleanup()` | ✅ | ✅ | ✅ |
| `getAnnotationsByType()` | ❌ | ✅ | ✅ |
| `getMarkInfo()` | ✅ returns `{Marked:true,...}` | ✅ | returns `{}` |
| `getMetadata().hasStructTree` | ❌ | ✅ | ✅ |
| `getOutline()` / `getMetadata()` / `getPageLabels()` | ✅ | ✅ | ✅ |
| Text extraction works | ✅ | ✅ | ✅ |

**Portable cleanup idiom** (works on all three):

```js
const task = pdfjs.getDocument({ data }).promise ? pdfjs.getDocument({ data }) : null;
const doc = await task.promise;
// ...
if (typeof task.destroy === 'function') await task.destroy();
else if (typeof doc.cleanup === 'function') await doc.cleanup();
```

### 3.5 `--experimental-*` flags and polyfills — the actual answer

**No flag is needed and no manual polyfill is needed — but you must import the legacy build.**

Measured in fresh processes:

```
$ node -e "console.log(JSON.stringify({DOMMatrix:typeof globalThis.DOMMatrix, Path2D:typeof globalThis.Path2D, ImageData:typeof globalThis.ImageData}))"
{"DOMMatrix":"undefined","Path2D":"undefined","ImageData":"undefined"}

$ node -e "import('pdfjs-dist/legacy/build/pdf.mjs').then(()=>console.log(JSON.stringify({DOMMatrix:typeof globalThis.DOMMatrix, Path2D:typeof globalThis.Path2D})))"
{"DOMMatrix":"function","Path2D":"function"}          <- the legacy build polyfilled them

$ node -e "import('pdfjs-dist/build/pdf.mjs').then(()=>console.log(JSON.stringify({DOMMatrix:typeof globalThis.DOMMatrix})))"
{"DOMMatrix":"undefined"}                             <- modern build does not
```

And the modern build then fails outright:

```
$ node -e "import('pdfjs-dist/build/pdf.mjs').then(async m=>{const d=await m.getDocument({data:new Uint8Array(require('fs').readFileSync('out/resume-chrome.pdf'))}).promise;const p=await d.getPage(1);const t=await p.getTextContent();console.log('modern OK items='+t.items.length)}).catch(e=>console.log('modern FAIL: '+e.message))"
modern FAIL: hashOriginal.toHex is not a function
```

Root cause: pdf.js calls `Uint8Array.prototype.toHex()`, which Node 24.18 does not implement,
and **there is no flag that enables it**:

```
$ node -e "console.log(typeof Uint8Array.prototype.toHex)"
undefined
$ node --harmony-uint8array-tohex -e "1"
node: bad option: --harmony-uint8array-tohex
```

**Rule: always `import 'pdfjs-dist/legacy/build/pdf.mjs'` on Node.** Merely importing it
installs the polyfills as a side effect. Do not hand-roll `DOMMatrix`/`Path2D` shims, and do
not trust a "modern build works" result measured in a process that already imported legacy —
that is exactly the false positive my own first probe produced (see pitfall P1).

---

## 4. Area 2 — Annotation, structure and metadata inspection

Two independent read paths, cross-checked.

### 4.1 High-level path — pdf.js

```js
const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  ? pdfjs.getDocument({ data: new Uint8Array(bytes) }) : null;
const doc = await task.promise;

// --- links: page.getAnnotations() resolves /Dest and /A for you ---
for (let p = 1; p <= doc.numPages; p++) {
  const annots = await (await doc.getPage(p)).getAnnotations();
  const links = annots.filter((a) => a.subtype === 'Link').map((a) => ({
    url: a.url ?? null,                    // resolved external URI
    unsafeUrl: a.unsafeUrl ?? null,        // pre-sanitisation /A /URI
    dest: a.dest ?? null,                  // resolved internal destination array
    rect: a.rect,
    kind: a.url ? 'external-uri' : (a.dest ? 'internal-dest' : 'unknown'),
  }));
}

// --- outline: nested tree of { title, dest, url, items[] } ---
const outline = await doc.getOutline();

// --- metadata: /Info, parsed XMP Document, and the tagged flag ---
const md = await doc.getMetadata();
// md.info           -> { Title, Author, Creator, Producer, CreationDate, ... }
// md.metadata       -> XMP as a Document (md.metadata.getAll() for raw XML)
// md.hasStructTree  -> boolean, true when /StructTreeRoot exists   [v5+]
```

### 4.2 Raw-object path — pdf-lib (sees what a lenient API hides)

**Critical API hazard:** `PDFDict.lookup(key, type)` **throws** `UnexpectedObjectTypeError`
when the key is absent — it does **not** return `undefined`. A valid PDF with no `/Outlines`
will crash a naive inspector. Always wrap:

```js
const safeLookup = (dict, key, type) => { if (!dict) return undefined; try { return dict.lookup(PDFName.of(key), type); } catch { return undefined; } };
const safeGet    = (dict, key)       => { if (!dict) return undefined; try { return dict.get(PDFName.of(key)); } catch { return undefined; } };
```

```js
const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
const catalog = doc.catalog;

const lang       = safeGet(catalog, 'Lang');                                  // /Lang
const markInfo   = safeLookup(catalog, 'MarkInfo', PDFDict);                  // /MarkInfo << /Marked true >>
const structRef  = safeGet(catalog, 'StructTreeRoot');                        // presence == "tagged"
const metadataRef= safeGet(catalog, 'Metadata');                              // XMP stream
const outlinesRef= safeGet(catalog, 'Outlines');
```

**Outline walking** — `/Outlines` is a linked list (`First` → `Next` → `Next`) at each level.
The recursion must *emit* each item and recurse into that item's own `/First`. Treating a
child item as a container silently drops every nested bookmark (a bug I hit; see pitfall P2):

```js
const derefDict = (r) => { try { return catalog.context.lookup(r, PDFDict); } catch { return undefined; } };
const seen = new Set();
const walkChain = (firstRef, depth) => {
  const items = [];
  if (depth > 8) return items;                       // depth cap: cyclic files must not hang us
  let cur = firstRef, guard = 0;
  while (cur && guard++ < 500) {
    const key = cur.toString();
    if (seen.has(key)) { items.push({ title: '<<cycle>>' }); break; }
    seen.add(key);
    const cd = derefDict(cur);
    if (!cd) break;
    const dest = safeGet(cd, 'Dest') ?? safeGet(safeLookup(cd, 'A', PDFDict), 'D');
    items.push({
      title: decodeText(safeGet(cd, 'Title')),
      dest: dest ? dest.toString().slice(0, 120) : null,
      children: walkChain(safeGet(cd, 'First'), depth + 1),
    });
    cur = safeGet(cd, 'Next');
  }
  return items;
};
const outlines = walkChain(safeGet(derefDict(outlinesRef), 'First'), 0);
```

Decoding `/Title` (and any PDF text string) needs the hex/BOM cases:

```js
const decodeText = (o) => {
  if (!o) return undefined;
  if (o instanceof PDFHexString) { try { return o.decodeText(); } catch { return o.asHexString(); } }
  if (o instanceof PDFString)    { try { return o.decodeText(); } catch { return o.asString(); } }
  return String(o);
};
```

**Tagged detection and `/Lang`** come out of the two paths as:

```js
const tagged = !!structRef || (await doc.getMetadata()).hasStructTree === true;
const language = decodeText(safeGet(catalog, 'Lang')) ?? md.info?.Language ?? null;
```

### 4.3 Observed output

Against `fixtures/resume-rich.pdf` (authored with pdf-lib: 4 link annots — 3 `/URI` + 1
`/Dest` — a nested 2-level outline, XMP, `/Lang`, `/StructTreeRoot`):

```
2. ANNOTATIONS, OUTLINE, METADATA, STRUCTURE
--------------------------------------------
  pages=1 objects=25 pdfVersion=1.7
  catalog keys: Lang, MarkInfo, Metadata, Outlines, Pages, StructTreeRoot, Type, ViewerPreferences
  link annotations: 4 total (3 external /URI, 1 internal /Dest)
    [p1] URI  mailto:alexandra.whitfield@example.com
    [p1] URI  https://www.linkedin.com/in/alexandra-whitfield
    [p1] URI  https://github.com/awhitfield
    [p1] DEST [{"num":6,"gen":0},{"name":"XYZ"},0,792,0]
  outline: 2 entries (/Count 2)
    - Alexandra Whitfield - Resume -> [ 6 0 R /XYZ 0 792 0 ]
      - Work Experience -> [ 6 0 R /XYZ 0 792 0 ]
  /Info: {"Producer":"ResumeBuilder (pdf-lib)","ModDate":"D:20260115000000Z","Creator":"ResumeBuilder","CreationDate":"D:20260115000000Z","Title":"Alexandra Whitfield - Resume","Author":"Alexandra Whitfield","Subject":"Resume","Keywords":"staffing workflow verification"}
  XMP /Metadata: 643 bytes, dc:title="Alexandra Whitfield - Resume", dc:creator="Alexandra Whitfield"
  tagged: true (pdf-lib /StructTreeRoot=true, pdfjs hasStructTree=true)
  /Lang: "en-US" (pdfjs Language="en-US")
  /MarkInfo: {"Marked":"true"}  pdfjs.getMarkInfo()={}
  page geometry: p1 612x792pt rot=0 annots=4
  PASS pageCount agrees (pdf-lib vs pdfjs) - 1 vs 1
  PASS link annot count agrees (raw /Annots vs pdfjs resolved) - 4 vs 4
```

Against the **Chrome-generated** resume (headless `--print-to-pdf`), which is what the real
app will produce:

```
  pages=1 objects=90 pdfVersion=1.4
  catalog keys: Lang, MarkInfo, Pages, StructTreeRoot, Type, ViewerPreferences
  link annotations: 3 total (3 external /URI, 0 internal /Dest)
    [p1] URI  mailto:alexandra.whitfield@example.com
    [p1] URI  https://www.linkedin.com/in/alexandra-whitfield
    [p1] URI  https://github.com/awhitfield
  outline: 0 entries
  /Info: {"Title":"Alexandra Whitfield — Resume","Creator":"Mozilla/5.0 ... HeadlessChrome/154.0.0.0 ...",
          "Producer":"Skia/PDF m154","CreationDate":"D:20261006103614+00'00'"}
  XMP /Metadata: absent
  tagged: true (pdf-lib /StructTreeRoot=true, pdfjs hasStructTree=true)
  /Lang: "en"
  PASS link annot count agrees (raw /Annots vs pdfjs resolved) - 3 vs 3
```

**Two actionable facts for the app:** Chrome's `--print-to-pdf` already preserves `<a href>`
as `/URI` link annotations and emits a tagged PDF with `/Lang` — but it writes **no XMP
`/Metadata`** and **no outline**. If the product promises a clickable PDF outline or XMP,
that has to be post-processed in with pdf-lib.

---

## 5. Area 3 — Raw byte-level checks ("fake text" and unembedded fonts)

### 5.1 Images: prove the page is text, not a picture

Walk `/Resources → /XObject` for `/Subtype /Image`, **following `/Resources` up the page
tree** (it is inheritable) and **recursing into Form XObjects** (a full-page raster is often
nested inside one). Also scan content streams for **inline images** (`BI … ID … EI`), which
never appear as `/XObject` entries and are a classic way to smuggle a raster.

```js
const resourceDictFor = (pageNode) => {          // /Resources is inheritable
  let node = pageNode, guard = 0;
  while (node && guard++ < 64) {
    const res = safeLookup(node, 'Resources', PDFDict);
    if (res) return res;
    node = safeLookup(node, 'Parent', PDFDict);
  }
  return undefined;
};

const visitXObject = (xobjDict, pageIndex, depth) => {
  if (!xobjDict || depth > 4) return;
  for (const [keyRef, valRef] of xobjDict.entries()) {
    const stream = deref(valRef, PDFStream);
    if (!stream) continue;
    const subtype = name(safeGet(stream.dict, 'Subtype'));
    if (subtype === 'Image') {
      images.push({
        page: pageIndex, name: name(keyRef),
        widthPx: num(safeGet(stream.dict, 'Width')),
        heightPx: num(safeGet(stream.dict, 'Height')),
        filters: filtersOf(stream.dict),                    // DCTDecode == JPEG photo
        colorSpace: name(safeGet(stream.dict, 'ColorSpace')),
        bitsPerComponent: num(safeGet(stream.dict, 'BitsPerComponent')),
      });
    } else if (subtype === 'Form') {
      visitXObject(safeLookup(safeLookup(stream.dict, 'Resources', PDFDict), 'XObject', PDFDict), pageIndex, depth + 1);
      scanInlineImages(decodedContents(stream), pageIndex, counter);
    }
  }
};
```

The verdict avoids needing the CTM (which is genuinely hard to recover correctly):

```js
// A page-covering raster has a decoded pixel area >= the page's area in points.
// A 300 dpi Letter scan is ~17x the point area; a logo or icon is nowhere near.
largestImageCoversPage: imgs.some((x) => x.widthPx * x.heightPx >= areaPt2),
imageToPageAreaRatio:   totalImagePx / totalPagePt,
```

…and is combined with the text-layer result, because **either signal alone has a false
positive mode**:

```js
const imageDominated = v.hasPageScaleRaster && v.imageToPageAreaRatio > 1;
const littleText     = text.replace(/\s+/g, '').length < 200;
check('there is no page-scale raster with a broken text layer', !(imageDominated && littleText));
```

### 5.2 Fonts: prove glyphs are embedded and decodable

Follow `/FontDescriptor → /FontFile | /FontFile2 | /FontFile3`, and for Type0 fonts get the
descriptor from `/DescendantFonts[0]`:

```js
let descRef = safeGet(fdict, 'FontDescriptor');
const descFonts = safeLookup(fdict, 'DescendantFonts', PDFArray);
if (!descRef && descFonts?.size() > 0) {                       // Type0: descriptor is on the descendant
  descRef = safeGet(deref(descFonts.get(0), PDFDict), 'FontDescriptor');
}
const desc = deref(descRef, PDFDict);
const present = ['FontFile', 'FontFile2', 'FontFile3'].filter((k) => !!safeGet(desc, k));
const embedded = present.length > 0;
const hasToUnicode = !!safeGet(fdict, 'ToUnicode');
```

### 5.3 The `/ToUnicode` nuance that decides false positives

A naive "no `/ToUnicode` ⇒ risky" rule **is wrong**, and my first version false-alarmed on a
real 14-page paper. There are four legitimate ways text becomes extractable:

| `textMapping` verdict | Meaning | Real risk? |
|---|---|---|
| `tounicode-cmap` | `/ToUnicode` present | no |
| `standard-encoding` | WinAnsi/MacRoman/Standard encoding, no `/Differences` | no |
| `differences-agl` | `/Differences` full of **real Adobe Glyph List names** (`/a`, `/fi`, `/eacute`) | no |
| `identity-h-no-tounicode` | Type0 `/Identity-H`, no CMap — codes are **glyph indices** | **YES** |
| `synthetic-glyph-names` | `/Differences` full of `/g17`, `/cid42` | **YES** |
| `type3-unreliable` | Type3 glyph procedures | **YES** |

```js
const SYNTHETIC = /^(g|cid|glyph|index|uni_?idx|gl)\d+$/i;
const diffNames = [];                                   // sample the /Differences array
if (differences) { const arr = differences.asArray();
  for (let i = 1; i < arr.length && diffNames.length < 40; i += 2) { const nm = name(arr[i]); if (nm) diffNames.push(nm); } }
const differencesAreAgl = hasDifferences && diffNames.length > 0 && diffNames.every((x) => !SYNTHETIC.test(x));
const identityEncoded   = /^Identity(-H|-V)?$/.test(encName ?? '');
```

Effect of the refinement, measured before → after:

| Fixture | before | after |
|---|---|---|
| `pdfjs-trac.pdf` (78 dvips Type1 fonts, `/Differences`, no `/ToUnicode`, **extracts perfectly**) | ❌ 78 "risks" | ✅ `differences-agl`, 0 risks |
| `pdf-lib-with-links.pdf` (`/Identity-H` Type0, no CMap — genuinely unmapped) | ❌ | ✅ still correctly flagged |

### 5.4 Observed output

Fake-text negative control:

```
### fixtures/fake-image.pdf
{
  "hasPageScaleRaster": true,
  "maxImageCoveragePct": 1736.1,
  "totalImagePixels": 8415000,
  "imageToPageAreaRatio": 17.361,
  "imageCount": 1,
  "fontCount": 0,
  ...
}
  images: [{"n":"Image-7098480789","w":2550,"h":3300,"f":["FlateDecode"],"mp":8.415}]
  fonts : []
```

Real resume PDFs:

```
### fixtures/resume-rich.pdf            (pdf-lib, custom embedded TTF)
  fonts: [{"n":"ArialMT-...","sub":"Type0","emb":true,"key":"FontFile2","tou":true,"std14":false}, ... x33]
  encodings: ["Type0|Identity-H|diff=false|tounicode-cmap"]

### fixtures/resume-chrome.pdf          (Chrome --print-to-pdf)
  fonts: 3 resources, base fonts: ["AAAAAA+Arial-BoldMT","BAAAAA+ArialMT","CAAAAA+Arial-ItalicMT"]
    embedded=true embeddedOrStandard14=true allToUnicode=true mappingSafe=true type3=false
  byte sweep: image subrs=0 fontfiles=3 tounicode=3 structtree=2 objstm=false xrefstream=false

### fixtures/resume-fonts.pdf           (pdf-lib StandardFonts = base-14, NOT embedded)
  allFontsEmbedded=false (33 base-14)  allFontsEmbeddedOrStandard14=true  textMappingSafe=true
```

That last case is why the harness separates **strict** embedding
(`allFontsEmbedded`, every font has a `/FontFile*`) from **practical** safety
(`allFontsEmbeddedOrStandard14`). Base-14 fonts are guaranteed by the PDF spec, so they are
a *soft* warning, not a hard failure — but for a resume you want embedding for pixel fidelity.

---

## 6. Area 4 — ATS-realistic round-trip assertions

### 6.1 Line reconstruction is a prerequisite

"Is the heading a standalone line?" is unanswerable if you join every text item with a space.
The extractor therefore rebuilds lines from baseline Y (§3.1). Measured difference: the naive
join yields **1 line** for a one-page resume; the Y-grouped reconstruction yields **26**.

### 6.2 Contacts

```js
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

// Plausibility: a 10/11-digit run IS a phone. Do not second-guess it.
let plausible = digits.length === 10 || digits.length === 11 || digits.length === 7;
if (digits.length <= 4 && /^(19|20)\d{2}$/.test(digits)) plausible = false;   // a bare year
```

### 6.3 Section headings as standalone lines

```js
const normLines = lines.map((l) => l.text.trim().toLowerCase()
  .replace(/[:.\u2013\u2014-]+$/, '').replace(/\s+/g, ' '));

// pass 1: exact whole-line match  -> "standalone"
// pass 2: substring match         -> "embedded-in-line"  (a real ATS defect)
const i = normLines.findIndex((l) => l === alias);          // standalone
const j = normLines.findIndex((l) => l.includes(alias));    // fallback: NOT standalone
```

A heading fused into a neighbouring line (`EXPERIENCESenior Operations Analyst`) passes
"present" but fails "standalone" — which is the difference between a screener segmenting the
resume and not.

### 6.4 Chronology and job tuples

```js
// newest-first: compare yyyymm of the first date in each range-bearing line
const keys = ranges.map((e) => (e.dates[0].m ? e.dates[0].y * 12 + e.dates[0].m : e.dates[0].y * 12));
violations = keys.filter((k, i) => i > 0 && k > keys[i - 1]);
```

The tuple check is **expectation-driven**, not "every date range must have an employer":

```js
// For each title/company the caller declared, is a date range within +/- 2 lines?
const checkAdjacent = (value) => {
  const needle = value.toLowerCase();
  const hits = [];
  for (const [i, l] of lines.entries()) {
    if (!l.text.toLowerCase().includes(needle)) continue;
    const near = dateLines.find((d) => Math.abs(d.lineIndex - i) <= 2);
    hits.push({ lineIndex: i, lineText: l.text, dateWithinRange: near ? near.text : null });
  }
  return { value, occurrences: hits.length, anchored: hits.some((h) => h.dateWithinRange), hits };
};
```

This matters: an **Education** date range legitimately has no employer, so the earlier
"every range must be complete" rule produced a false failure on a perfectly good resume.

### 6.5 Ligature / keyword integrity — the interesting result

```js
const LIGATURE_CODEPOINTS = /[\uFB00-\uFB06]/g;     // ff fi fl ffi ffl st presentation forms
const LIGATURE_KEYWORDS = ['Verification','Conflict','Efficiency','Workflow','Staffing','Fulfillment','Certification'];

const nfkc = text.normalize('NFKC');
const verdict = text.includes(word)        ? 'intact'
              : nfkc.includes(word)        ? 'MANGLED-ligature'   // only findable after NFKC
              : text.toLowerCase().includes(word.toLowerCase()) ? 'case-mismatch'
              : 'MISSING';
```

I built three ligature fixtures to prove the check can fail, and the experiment produced a
**better answer than expected**:

| Fixture | `/ToUnicode` maps ligature to | pdf.js | MuPDF | PDFium |
|---|---|---|---|---|
| `ligature.pdf` | `<0066 0069>` ("fi") | `Verification` | `Verification` | `Verification` |
| `ligature-mangled.pdf` | `<FB01>` (the ligature codepoint) | `Verification` | `Verification` | `Verification` |
| `ligature-broken.pdf` | *(no `/ToUnicode` at all)* | `Verification` | `Verification` | `Verification` |

All three look identical, and `U+FB01` is *visually indistinguishable* from `fi` — which is
exactly why a codepoint dump was necessary:

```
  has U+FB01 anywhere? pdfjs=false mupdf=false pdfium=false
```

So: **is `/ToUnicode` even being consulted?** A sentinel experiment settled it — remap the
ligature code to `Z`/`Y`:

```
$ node -e "...extract fixtures/ligature-probe.pdf..."
pdfjs : "VeriZcation ConYict EfZciency WorkYow StafZng"
mupdf : "VeriZcation\nConYict\nEfZciency\nWorkYow\nStafZng\n\n"
pdfium: "VeriZcation\r\nConYict\r\nEfZciency\r\nWorkYow\r\nStafZng"
```

**Conclusion:** `/ToUnicode` *is* honoured (the sentinels appear), and all three engines then
apply **ligature decomposition** as an extra pass. Therefore `Verification`, `Conflict`,
`Efficiency`, `Workflow`, `Staffing` survive extraction **unmangled on these engines even
when the PDF maps the ligature to `U+FB01`**.

Residual risk, so the check still earns its place: extractors that skip decomposition — raw
content-stream regex scrapers and some server-side pipelines — will emit `U+FB01` and break
`includes('Verification')`. The assertion is cheap, and it is proven to fire on synthetic
input containing `U+FB01`–`U+FB06`.

### 6.6 Observed output

```
4. ATS ROUND-TRIP ASSERTIONS
----------------------------
  emails: ["alexandra.whitfield@example.com"]
  phones: ["(206) 555-0148"]
  sections: Summary=standalone, Experience=standalone, Education=standalone, Skills=standalone
  ligature keywords: 6/7 intact
  date ranges newest-first: true (3 ranges)
  job tuples: 3, reconstructable=true
  PASS email is findable - alexandra.whitfield@example.com
  PASS phone is findable - (206) 555-0148
  PASS all section headings present - Summary, Experience, Education, Skills
  PASS section headings are standalone lines - ok
  PASS no ligature-presentation codepoints - clean
  PASS ligature keywords intact - intact 6/7
  PASS no invisible/format characters - clean
  PASS date ranges read newest-first - 3 ranges; 0 out of order
  PASS declared titles/companies are anchored to a date range - 4/4 anchored
  PASS no non-ASCII spaces - 0 found
  PASS expected email present: alexandra.whitfield@example.com
  PASS expected phone present: (206) 555-0148 - 2065550148
```

Keyword detail (the 7th is a correct `case-mismatch`, not a defect — the fixture says
"Certifications"):

```
   Verification     intact (exact=true)
   Conflict         intact (exact=true)
   Efficiency       intact (exact=true)
   Workflow         intact (exact=true)
   Staffing         intact (exact=true)
   Fulfillment      intact (exact=true)
   Certification    case-mismatch (exact=false, ci=true)
```

Chronology reconstruction:

```
   {"lineIndex":8,  "text":"Senior Operations Analyst Mar 2021 – Present", "starts":"Mar 2021", "current":true}
   {"lineIndex":13, "text":"Logistics Analyst Jun 2018 – Feb 2021",        "starts":"Jun 2018", "current":false}
   {"lineIndex":18, "text":"B.S. Industrial & Systems Engineering 2014 – 2018", "starts":"2014", "current":false}
```

---

## 7. Area 5 — Browser-side validation with the installed Chrome

### 7.1 Four approaches, all measured against a live Vite dev server

Test page: a real Vite 8.3.2 dev server on `http://localhost:5199/` with a **deliberate**
`console.error` and a **deliberate** deferred `throw`, so the capture path had something to catch.

```
===== SCORECARD =====
┌─────────┬──────────────────────────────┬────────────┬───────┬───────────────┬──────┬────────────┬────────────┐
│ (index) │ approach                     │ screenshot │ bytes │ consoleErrors │ ms   │ jsExecuted │ pageErrors │
├─────────┼──────────────────────────────┼────────────┼───────┼───────────────┼──────┼────────────┼────────────┤
│ 0       │ 'A: --screenshot'            │ true       │ 11497 │ false         │ 711  │            │            │
│ 1       │ 'A: --dump-dom'              │ false      │       │ false         │      │ true       │            │
│ 2       │ 'B: puppeteer-core'          │ true       │ 37129 │ true          │ 4908 │            │ true       │
│ 3       │ 'C: raw CDP/ws'              │ true       │ 17783 │ true          │ 1019 │            │ true       │
│ 4       │ 'D: chrome-remote-interface' │ true       │ 8192  │ true          │ 3817 │            │ true       │
└─────────┴──────────────────────────────┴────────────┴───────┴───────────────┴──────┴────────────┴────────────┘
```

Screenshot dimensions were verified from the PNG headers, and two of them were visually
confirmed to contain the rendered page (not a blank frame):

```
A-cli-screenshot.png     1280x900  11497 bytes
B-puppeteer.png          2560x1800 37129 bytes
C-cdp.png                2067x1264 17783 bytes
D-cri.png                764x485   8192 bytes
```

**Verdict:**

| Approach | Screenshot | Console errors | Page errors | Deps | Verdict |
|---|---|---|---|---|---|
| **A. `--headless --screenshot`** | ✅ | ❌ **impossible** | ❌ | none | good for a one-off thumbnail only |
| **A. `--headless --dump-dom`** | ❌ | ❌ | ❌ | none | useful: proved JS executes (`jsExecuted=true`) |
| **B. `puppeteer-core`** | ✅ (best: deviceScaleFactor 2, `fullPage`) | ✅ (also caught a 404) | ✅ | 5.7 MB | most ergonomic; use if you already have it |
| **C. raw CDP over Node's built-in `WebSocket`** | ✅ | ✅ | ✅ | **0 MB** | **chosen — fastest (1019 ms) and no deps** |
| **D. `chrome-remote-interface`** | ✅ (smallest) | ✅ | ✅ | 1.9 MB | works; no advantage over C |

`--dump-dom` proved the Vite module script ran (`#preview` contained the rendered text), but
**no CLI flag can surface `console.error` or uncaught exceptions** — Chrome writes those to
the DevTools protocol only. Since console-error capture is a requirement, the CLI flags are
insufficient on their own.

### 7.2 Chosen: raw CDP over the built-in WebSocket

```js
// lib/browser.mjs
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function launchChrome({ chromePath = CHROME, headless = true, width = 1280, height = 900 } = {}) {
  // NEVER reuse a profile dir: a profile left locked by a killed Chrome makes the
  // next launch exit silently with no DevTools endpoint.
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-cdp-'));
  const proc = spawn(await findChrome(chromePath), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--hide-scrollbars',
    `--window-size=${width},${height}`,
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-port=0',        // let Chrome pick a free port (avoids races)
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  // Chrome prints the real endpoint to stderr: "DevTools listening on ws://127.0.0.1:PORT/..."
  // Reading the port from there beats probing a fixed port.
  let stderr = '', wsUrl = null;
  proc.stderr.on('data', (d) => { stderr += d.toString(); });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !wsUrl) {
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
    if (m) { wsUrl = m[1]; break; }
    if (proc.exitCode !== null) throw new Error(`Chrome exited early (${proc.exitCode}): ${stderr.slice(-500)}`);
    await sleep(100);
  }
  if (!wsUrl) { proc.kill(); throw new Error(`No DevTools endpoint within 30s: ${stderr.slice(-500)}`); }
  return { proc, wsUrl, userDataDir, cleanup: async () => { proc.kill(); await sleep(150); await fs.rm(userDataDir, { recursive: true, force: true }); } };
}
```

The minimal CDP client — **no `ws` package**:

```js
class Cdp {
  static async connect(wsUrl) {
    const ws = new globalThis.WebSocket(wsUrl);            // Node >= 22 built-in
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`WebSocket failed: ${wsUrl}`)), { once: true });
    });
    const c = new Cdp(ws);
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (msg.id && c.pending.has(msg.id)) { c.pending.get(msg.id)(msg); c.pending.delete(msg.id); }
      else if (msg.method) c.events.push(msg);
    });
    return c;
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}
```

Driving a page — the four domains that matter, plus the three capture channels:

```js
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => cdp.send(m, p, sessionId);

await s('Page.enable'); await s('Runtime.enable'); await s('Log.enable'); await s('Network.enable');
await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
await s('Page.navigate', { url });
// wait for Page.loadEventFired, then let deferred script settle
await sleep(waitMs);

const consoleErrors = cdp.events
  .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
  .map((e) => e.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
const pageErrors = cdp.events
  .filter((e) => e.method === 'Runtime.exceptionThrown')
  .map((e) => ({ text: e.params.exceptionDetails.text,
                 description: (e.params.exceptionDetails.exception?.description ?? '').split('\n')[0] }));
const logErrors = cdp.events
  .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
  .map((e) => e.params.entry.text);

const dom = await s('Runtime.evaluate', { expression: `(() => ({
  title: document.title, lang: document.documentElement.lang || null, readyState: document.readyState,
  bodyTextLength: document.body.innerText.length,
  linkCount: document.querySelectorAll('a[href]').length,
  hrefs: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
  headingOutline: [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName + ':' + h.innerText.trim()),
  imagesWithoutAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
}))()`, returnByValue: true, awaitPromise: true }).then((r) => r.result.value);

const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
await fs.writeFile(outPath, Buffer.from(data, 'base64'));
```

### 7.3 Observed output

```
5. BROWSER-SIDE VALIDATION (headless Chrome over CDP)
-----------------------------------------------------
  chrome: C:\Program Files\Google\Chrome\Application\chrome.exe
  devtools: ws://127.0.0.1:57922/devtools/browser/23660304-04c4-4668-8ad5-36710dcf8e07
  loaded=true readyState=complete title="ATS Resume Preview" lang="en"
  dom: 73 chars, 0 links, headings ["H1:Alexandra Whitfield"]
  screenshot: ...\out\verify-shot.png (37129 bytes)
  console errors: ["VITE_HARNESS_PROBE: deliberate console error for capture test"]
  uncaught exceptions: [{"text":"Uncaught","description":"Error: VITE_HARNESS_PROBE: deliberate uncaught error"}]
  PASS page loaded - readyState=complete
  PASS screenshot captured - 37129 bytes
  FAIL no console errors - VITE_HARNESS_PROBE: deliberate console error for capture test
  FAIL no uncaught exceptions - Error: VITE_HARNESS_PROBE: deliberate uncaught error
  PASS page has visible text - 73 chars
  PASS images have alt text - 0 without alt
```

Both `FAIL`s are the *correct* result — the probe page deliberately misbehaves. That is the
negative control for the browser pass.

### 7.4 Windows-specific gotchas (all encountered)

1. **`chrome.exe --version` prints `Opening in existing browser session.`** when Chrome is
   already running, instead of a version. Get the version from the file instead:
   `(Get-Item $chrome).VersionInfo.FileVersion` → `154.0.8037.93`.
2. **`& $chrome ... --print-to-pdf=...` returns before the file is flushed.** The first run
   appeared to produce nothing; the file appeared after the check. Use
   `Start-Process -Wait -PassThru`, or `spawn` + wait for `exit` (what `lib/browser.mjs` does).
3. **Always pass a unique `--user-data-dir`.** Without one, Chrome hands the URL to the
   user's running instance and no DevTools endpoint ever appears.
4. **Never reuse a profile directory.** A profile left behind by a killed Chrome made a
   later launch exit before the endpoint came up — the symptom was `Invalid URL` because
   `webSocketDebuggerUrl` was never obtained. `fs.mkdtemp` per run fixed it.
5. **PowerShell mangles inline JavaScript** passed via `node -e "..."` (it re-parses `[...t]`,
   `=>`, `$(...)`). Write the script to a `.mjs` file instead — this bit me twice.
6. **pdf.js writes a warning to stderr**, which PowerShell surfaces as `NativeCommandError`
   with exit code 1 even though `$LASTEXITCODE` was 0. Redirect stderr to a file, or capture
   in Node.
7. **Headless Chrome font fallback is not the desktop font stack.** The em-dash `U+2014` in
   my Vite page rendered as a missing-glyph box in the screenshot while the DOM text was
   correct. Screenshots are therefore not a reliable way to verify punctuation — assert on
   the DOM/PDF text, not on pixels.

---

## 8. Pitfalls encountered and how they were solved

| # | Pitfall | Symptom | Fix |
|---|---|---|---|
| **P1** | **False confidence from import order.** My first pdfjs probe reported the *modern* build works on Node. It only worked because the legacy build had already been imported in the same process and installed the polyfills. | "modern build OK" | Test each build in a **fresh process**; always import `legacy/build/pdf.mjs` |
| **P2** | **`pdf-lib` `PDFDict.lookup(key, type)` throws on absent keys** instead of returning `undefined`. | `UnexpectedObjectTypeError: Expected instance of PDFDict, but got instance of undefined` | `safeLookup`/`safeGet` wrappers (§4.2) |
| **P3** | **`pdf-parse@2.4.5` is broken by version skew.** Its worker resolves the bare specifier `pdfjs-dist/legacy/build/pdf.worker.mjs`, which picked up top-level `pdfjs-dist@6.4.299` while its API side was 5.4.296. | `UnknownErrorException: The API version "5.4.296" does not match the Worker version "6.4.299"` | Verified fix: pin top-level `pdfjs-dist@5.4.296` alongside it — extraction then succeeds (1343 chars). **Recommended: drop `pdf-parse`** |
| **P4** | **Naive line joining destroys layout.** `items.map(i => i.str).join(' ')` produced 1 line for a whole resume. | `lines=1`; "standalone heading" unanswerable | Group items by baseline Y, sort by X, insert spaces only on real gaps (§3.1) |
| **P5** | **Outline recursion dropped nested bookmarks.** `walk(ref)` treated a child item as a container and iterated its `/First` chain, so the child itself was never emitted. | Outline showed 1 entry instead of 2 | `walkChain(firstRef)` **emits** each item then recurses into that item's `/First` (§4.2) |
| **P6** | **Phone regex false negative.** My plausibility rule rejected anything starting `19xx`/`20xx` to filter out years — which rejected the very common area code **206** (`2065550148` starts with "2065"). | `phone is findable` FAILED while the phone *was* found | A 10/11-digit run **is** a phone; only apply the year test to short digit runs (§6.2) |
| **P7** | **Job-tuple check false positive.** Requiring *every* date range to have an employer fails on the Education section, which legitimately has none. | `3 tuples; 1 incomplete` on a good resume | Expectation-driven: for each declared title/company, is a date range within ±2 lines? (§6.4) |
| **P8** | **`/ToUnicode`-or-bust is too strict.** A real 14-page paper has 78 dvips Type1 fonts with `/Differences` and no `/ToUnicode` — and extracts perfectly via AGL glyph names. | 78 false "unmapped" risks on a valid PDF | Classify encodings; only `Identity-H`-without-CMap, synthetic glyph names, and Type3 are real risks (§5.3) |
| **P9** | **My first ligature negative control didn't break.** A base-14 font with `/Differences [1 /fi]` and *no* `/ToUnicode` still extracted as `fi`, because the Adobe Glyph List resolves `/fi`. | "broken" fixture passed | Use `/ToUnicode` mapping to `U+FB01` for the realistic bug, and prove the detector separately on synthetic input (§6.5) |
| **P10** | **`chrome.exe` CLI invocation doesn't block on Windows**, so the output file wasn't there yet. | Empty `out/` right after the command "succeeded" | `Start-Process -Wait`, or `spawn` + await `exit` |
| **P11** | **Reused Chrome profile dirs** caused silent launch failures with no DevTools endpoint. | `DOMException [SyntaxError]: Invalid URL` (a null `webSocketDebuggerUrl`) | `fs.mkdtemp` unique profile per run + cleanup in `finally` (§7.2) |
| **P12** | **`--quiet` suppressed the summary**, so a failing run printed nothing. | `RESULT: FAIL` invisible | Summary always prints; verifier must never fail silently |
| **P13** | **PowerShell re-parses inline JS** in `node -e` and breaks on `[...x]`, `=>`, `$(...)`. | `Missing type name after '['` | Put scripts in `.mjs` files |
| **P14** | **`pdfjs v6` removed `PDFDocumentProxy#destroy()`.** | `doc.destroy is not a function` | Use `loadingTask.destroy()` with a `doc.cleanup()` fallback (§3.4) |
| **P15** | **`@hyzyla/pdfium` method names differ from the obvious guess.** | `page.extractText is not a function` | It is `page.getText()` |
| **P16** | **`pdf-parse` v2 is not a function export.** | `pdfParse is not a function` | `new PDFParse({ data }).getText()`, then `.destroy()` |

---

## 9. What each check proves — and what it cannot prove

| Check | Proves | **Cannot** prove |
|---|---|---|
| Text extraction succeeds (2 independent engines) | A text layer exists and two unrelated parsers both decode it to the same characters | That *every* ATS vendor's parser (Tika, pdfminer, custom Java) will cope. It is strong evidence, not a guarantee. |
| Two-engine token agreement ≥ 98% | The decoding is not an artefact of one library's quirks | That either engine is *correct* — a shared misconception about an unusual construct can still agree. The engines are independent codebases, so this is unlikely but not impossible. |
| `/Annots` `/Link` with `/A /URI` | The link exists as a real, clickable annotation with a resolvable target | That the rectangle is on top of the right words, or that the URL is *reachable* (no network check). `unsafeUrl` is reported but not fetched. |
| `/Dest` internal link resolves | The target page/coordinates exist in the page tree | That the destination lands somewhere useful to a reader |
| `/Outlines` present and walkable | A navigation outline exists and is structurally sound (no cycles, correct `First`/`Next`/`Parent`) | That a viewer renders it nicely, or that the titles are meaningful |
| `/Info` + XMP `/Metadata` | Both metadata carriers are present and parseable; XMP `dc:title`/`dc:creator` can be read | That an ATS reads metadata at all — most parse the text layer instead |
| `/StructTreeRoot` present ⇒ tagged | The file declares logical structure and `/MarkInfo /Marked true` | That the tagging is *correct*. This is a presence check; MCID/`/K` tree integrity vs. content is not validated here. |
| `/Lang` set | The document declares a natural language | That the declared language matches the content |
| No page-scale raster + tiny text layer | The page is not a picture-with-OCR-text, i.e. the text is real vector text | That a *small* decorative image is absent (a photo is legal and expected), or that glyphs aren't drawn as vector outlines. A fully vectorized-text PDF would pass this and fail nothing — but then it has no text layer, which the extraction check catches. |
| Inline image (`BI…ID…EI`) enumeration | No raster is hidden in a content stream where `/XObject` enumeration would miss it | Exact placement/size — the CTM is not reconstructed, so only presence and declared `/W`/`/H` are reported |
| Every font has `/FontFile{,2,3}` | Glyph programs are embedded, so rendering does not depend on the reader's installed fonts | That the embedded subset is *complete* — a font subset missing a needed glyph still has a `FontFile`. Coverage would require parsing the subset's `cmap`. |
| `/ToUnicode` / encoding classification | A character→Unicode route exists (CMap, named encoding, or AGL-resolvable glyph names) | That the CMap is *correct*. A wrong `/ToUnicode` produces confidently wrong text; only the two-engine agreement check catches that. |
| Email / phone regex | The contact details appear in the extracted text in the expected shape | That an ATS's *own* regex matches (they vary), or that the details are in a header position the parser looks at. Phone regex is intentionally North-America-shaped — international formats need extending. |
| Headings present as standalone lines | A line-oriented parser can segment the resume into sections | That the visual hierarchy is meaningful (a heading styled like body text still passes) |
| Date ranges newest-first | Tenure is reconstructable in the expected order | That the dates are *true*, or that a parser resolves ambiguous `03/04/2021` the same way you do |
| Titles/companies anchored to a date range | A screener can build `(title, company, dates)` tuples | That it builds them *correctly* — the ±2-line window is a heuristic |
| Ligature / invisible-character lint | No `U+FB00–FB06`, soft hyphens, zero-width or replacement characters reach the text layer | That a *future* extractor won't mangle something else. Note the measured finding: pdf.js, MuPDF and PDFium all decompose ligatures, so this currently passes even for a PDF whose `/ToUnicode` maps to `U+FB01`. |
| Screenshot is non-empty | Chrome rendered *something* measurable | **That the rendering is correct.** Headless Chrome's font fallback differs from the desktop (measured: `U+2014` rendered as a missing-glyph box while the DOM was correct). Assert on DOM/PDF text; use the screenshot for a human eyeball. |
| No console errors / uncaught exceptions | The page's JS ran without error under Chrome 154 | That it behaves the same in Firefox/Safari, or that a *swallowed* `try/catch` isn't hiding failures |

### 9.1 Honest limits of the whole harness

- **It cannot verify visual fidelity.** No pixel-diff against a reference layout, no check
  that text isn't overlapping or clipped off-page. It proves *parseability*, not *prettiness*.
- **It cannot predict a specific ATS.** "ATS-friendly" is a family of heuristics. This harness
  encodes the defensible subset (real text, embedded fonts, correct mapping, standalone
  headings, sane order) and is explicit about the heuristics it invents.
- **Two of the four checks in Area 3 are presence checks**, not integrity checks — tagged-PDF
  correctness and font-subset completeness are genuinely out of scope for a fast CI gate.
- **The `imageToPageAreaRatio` heuristic assumes 1 px ≈ 1 pt as a floor.** A deliberately
  tiny-but-upscaled raster could evade it; combining with the text-layer check closes the
  practical hole.

---

## 10. Running it

```bash
# PDF-only gate (exit non-zero on any hard failure)
node scripts/verify-ats.mjs resume.pdf \
  --titles "Senior Operations Analyst,Logistics Analyst" \
  --companies "Northwind Logistics Group,Cascade Freight Partners" \
  --expect-email "alexandra.whitfield@example.com" \
  --expect-phone "(206) 555-0148" \
  --require-links 2 --require-embedded-fonts --require-tagged --require-lang \
  --json out/report.json

# Add the browser pass against the Vite dev server
node scripts/verify-ats.mjs resume.pdf --url http://localhost:5173/ --screenshot out/page.png
```

Exit codes: **0** = all hard checks pass; **1** = at least one hard check failed; **2** = bad usage.

`NO_COLOR=1` is honoured for clean CI logs, and the summary always prints — including under
`--quiet` — because a verifier that can fail silently is worse than no verifier.

### 10.1 Verified end-to-end result

Good PDF (Chrome-generated resume, 28 checks):

```
SUMMARY  28/28 passed, 0 failed, 0 warning(s)
RESULT: PASS
$ echo $LASTEXITCODE
0
```

Negative control (`fixtures/fake-image.pdf` — the real resume rasterised into a PDF):

```
SUMMARY  12/22 passed, 10 failed, 0 warning(s)
  FAIL independent engines agree >= 98% - 0.00%
  FAIL PDF contains a real text layer - 0 non-whitespace chars
  FAIL /Info has a Title - missing
  FAIL text is not a picture (no page-scale raster) - page-scale raster 2550x3300px, 17.361x page area
  FAIL there is no page-scale raster with a broken text layer - page is a raster AND text layer is empty
  FAIL email is findable - no email matched
  FAIL phone is findable - no phone matched
  FAIL all section headings present - missing: Summary, Experience, Education, Skills
  FAIL section headings are standalone lines - not standalone:
  FAIL ligature keywords intact - intact 0/7; missing: Verification, Conflict, Efficiency, Workflow, Staffing, Fulfillment, Certification
RESULT: FAIL
$ echo $LASTEXITCODE
1
```

The harness therefore **can** fail, and fails for the right reasons.

### 10.2 Fixture corpus (all authored by `scripts/make-fixtures.mjs`)

| Fixture | Purpose | Expected verdict |
|---|---|---|
| `resume-chrome.pdf` | Chrome `--print-to-pdf` of the HTML resume | PASS |
| `resume-rich.pdf` | pdf-lib: embedded TTF subset, 3 `/URI` + 1 `/Dest` links, nested outline, XMP, `/Lang`, `/StructTreeRoot` | PASS |
| `resume-fonts.pdf` | pdf-lib `StandardFonts` (base-14, not embedded, no `/ToUnicode`) | PASS with soft embedding warning under `--require-embedded-fonts` → FAIL |
| `fake-image.pdf` | Resume rasterised to PNG, wrapped in a PDF — **negative control** | FAIL |
| `ligature.pdf` | Ligature glyphs, `/ToUnicode` → `"fi"` | PASS |
| `ligature-mangled.pdf` | Ligature glyphs, `/ToUnicode` → `U+FB01` — the realistic bug | PASS (engines decompose) — detector proven separately |
| `ligature-broken.pdf` | Ligature glyphs, no `/ToUnicode` (AGL fallback) | PASS |
| `ligature-probe.pdf` | Sentinel: ligature code → `Z`/`Y`, proving `/ToUnicode` is consulted | PASS, `VeriZcation` observed |
| `w3c-dummy.pdf`, `pdfjs-trac.pdf`, `pdf-lib-with-links.pdf` | Downloaded real-world PDFs, for generality | resume-specific checks legitimately FAIL (not resumes); extraction/structure/font checks all pass |

### 10.3 Prototype file inventory

All paths relative to `.research-scratch/verify/`:

| File | Role |
|---|---|
| `scripts/verify-ats.mjs` | **the harness entry point** (§8 CLI above) |
| `lib/extract.mjs` | Area 1 — pdfjs-dist + mupdf + pdfium extractors, token agreement |
| `lib/inspect.mjs` | Area 2 — annotations, outline, `/Info`, XMP, `/StructTreeRoot`, `/Lang`, page tree |
| `lib/rawscan.mjs` | Area 3 — image XObjects, inline images, font embedding, `/ToUnicode`, byte sweep |
| `lib/ats.mjs` | Area 4 — contacts, standalone headings, chronology, ligature/keyword lint |
| `lib/browser.mjs` | Area 5 — zero-dependency CDP client, Chrome launch, screenshot + console capture |
| `scripts/make-fixtures.mjs` | builds the whole fixture corpus (incl. negative controls) |
| `scripts/extractors.mjs` | the library bake-off that produced the §3.3 table |
| `scripts/browser-eval.mjs` | the four-way browser comparison that produced the §7.1 scorecard |
| `scripts/probe-one-version.mjs` | pdfjs-dist v4/v5/v6 API diff (§3.4) |
| `scripts/probe-glyph.mjs` | DOM-vs-render codepoint check (§7.4 item 7) |
| `scripts/make-fixtures2.mjs` | variant generator used for the `ligature-probe.pdf` sentinel experiment |
| `fixtures/` | 12 files: 5 authored PDFs + 3 negative controls + 3 downloaded real-world PDFs + source HTML |

---

## 11. Sources

Primary sources for the API claims above:

- pdf.js API / `getDocument`, `getTextContent`, `getAnnotations`, `getOutline`, `getMetadata` —
  <https://mozilla.github.io/pdf.js/api/> and the `pdfjs-dist` package docs
  <https://www.npmjs.com/package/pdfjs-dist>
- pdf.js `getDocument({ data })`, worker setup, and the Node "use the legacy build" warning —
  observed directly from `pdfjs-dist@6.4.299` (`legacy/build/pdf.mjs`); the warning text
  `"Please use the \`legacy\` build in Node.js environments."` is emitted by the library
- pdf.js legacy build polyfilling `DOMMatrix`/`Path2D` — measured on Node v24.18.0 (§3.5)
- MuPDF JavaScript `page.toStructuredText().asText()` —
  <https://mupdf.readthedocs.io/en/latest/cookbook/javascript/basics.html>
  (this page is version 1.28.5, matching the installed `mupdf@1.28.1`)
- `@hyzyla/pdfium` (`PDFiumLibrary.init()`, `lib.loadDocument()`, `page.getText()`,
  `page.getOriginalSize()`) — <https://github.com/hyzyla/pdfium>
- pdf-lib `PDFDocument`, `PDFDict.get/lookup`, `PDFCatalog`, `embedFont`, `setLanguage` —
  <https://pdf-lib.js.org/> and <https://github.com/Hopding/pdf-lib>
- `pdf-parse` v2 API (`new PDFParse({data}).getText()`, declared
  `dependencies: { "pdfjs-dist": "5.4.296" }`) — <https://github.com/mehmet-kozan/pdf-parse>
- `unpdf` bundling pdf.js (`build:pdfjs` script, `pdfjs-dist` devDependency) —
  <https://github.com/unjs/unpdf>
- Chrome DevTools Protocol domains used: `Target`, `Page`, `Runtime`, `Log`, `Network`,
  `Emulation` — <https://chromedevtools.github.io/devtools-protocol/tot/Page/> and
  <https://chromedevtools.github.io/devtools-protocol/tot/Runtime/>
- `--headless=new`, `--screenshot`, `--dump-dom`, `--print-to-pdf`, `--remote-debugging-port` —
  Chrome headless documentation: <https://developer.chrome.com/docs/chromium/headless>
- PDF structure used by the checks — `/Annots` `/Subtype /Link` with `/A` `/URI` or `/Dest`;
  `/Outlines` `First`/`Next`/`Parent`; `/FontDescriptor` → `/FontFile`, `/FontFile2`,
  `/FontFile3`; `/ToUnicode` CMaps; `/StructTreeRoot` and `/MarkInfo /Marked` for tagged PDF;
  `/Lang` — ISO 32000-1:2008 (PDF 1.7), also available as
  <https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf>
  (tagged PDF: §14.7; `/ToUnicode`: §9.10.3; annotations: §12.5; document outline: §12.3.3)
- Adobe Glyph List (why `/Differences [1 /fi]` resolves without `/ToUnicode`) —
  <https://github.com/adobe-type-tools/agl-aglfn>
- `NO_COLOR` convention — <https://no-color.org/>
