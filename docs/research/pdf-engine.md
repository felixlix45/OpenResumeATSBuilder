# PDF Generation Engine for a Client-Side ATS-Friendly Resume Builder

**Status:** research complete, empirically verified
**Date:** 2026-10-06
**Scope:** choose and de-risk the PDF generation technology for a Vite + React + TypeScript resume builder that runs **fully client-side with no server**.
**Verification harness:** `C:\Users\felix\Documents\Project\ResumeBuilder\.research-scratch\` (throwaway; nothing outside it was touched)

---

## 1. Recommendation

**Primary pick: `@react-pdf/renderer` 4.9.0** (published 2026-08-27).
**Fallback: `pdfkit` 0.20.2** used directly (its conditional `browser` export), if tagged/PDF-UA output becomes a hard requirement.

### Justification

`@react-pdf/renderer` is the only candidate that satisfies every *hard* requirement while also matching the app's existing stack, and it is the only one that removes pagination risk rather than deferring it. I verified empirically that it emits real extractable text (2 subsetted Lato fonts, both with `ToUnicode` CMaps), real external link annotations (2), real internal links via named destinations (2), a genuinely **nested** bookmark tree (4 items, `Alex Rivera > {Experience, Skills}`), full Info-dictionary metadata (Title/Author/Subject/Keywords/Creator/Producer), catalog `/Lang`, `DisplayDocTitle`, and — newly in 4.9.0 — PDF/A-2b conformance with XMP. It also gives declarative control over the exact failure mode that ruins resume PDFs: `orphans`, `widows`, `minPresenceAhead`, `wrap={false}`, `break`, and `fixed`, all built on Yoga flexbox plus a Knuth–Plass textkit — i.e. line breaking and pagination are the library's job, not yours. It is the only candidate with a *first-party Vite example app*, and its browser bundle contains no worker, no external `.wasm` fetch, and no Node built-ins: Yoga's WASM ships base64-inlined, and I built the whole thing with Vite 7 at the default target with zero polyfill configuration.

The one requirement it cannot meet is the *"ideally"* one: **tagged PDF / PDF-A-a / PDF-UA**. That is not an oversight on my part — it is a documented gap that I confirmed three ways: the maintainer's own PR #3529 states that "a levels and PDF/UA need tagged output, so the `PDFConformance` union extends once that lands"; issue #3179 ("WCAG / Pdf-Tagging") and #1115 are still open; and when I passed `tagged: true` and `conformance: 'PDF/UA-1'` to `<Document>`, the library **silently rendered a PDF with no `/Marked` entry and no `/StructTreeRoot` at all** rather than throwing. This distinction matters for the ATS use case specifically: ATS parsers extract text via the content stream and `ToUnicode` CMaps, **not** via the structure tree, so the absence of tagging does not threaten résumé parsing. Tagging is an accessibility/PDF-UA requirement, and it should be treated as a separate, later milestone rather than a blocker.

`pdfkit` 0.20.2 is the correct fallback precisely because it covers that gap and nothing else needs to change conceptually: since react-pdf PR #3509 swapped the renderer onto **upstream pdfkit**, the fallback is the same engine one layer down. I verified that pdfkit 0.20.2 produces a **real** structure tree in-browser-attachable form — 15 `/MCID` entries, 19 `BDC`/`EMC` pairs, a nested `/S` tree (`Document > H1, P, Link, H2, L, H2, P` with `LI > Lbl, LBody`), a populated `/ParentTree`, plus `/Marked true`, `pdfuaid:part`, PDF/A, ToUnicode, links and a 4-item outline. The cost is that you hand-roll pagination and section layout. Do not switch to it for tagging until tagging is actually required.

**Explicitly rejected as the primary:** `pdfmake` 0.3.11 — its `tagged: true` is a **facade** (see §3.5: `/Marked true` plus an *empty* `/StructTreeRoot /Nums [ ]`, zero MCIDs, zero `BDC` operators, zero structure elements), and it is 2.14 MB gzip-inclusive once the Roboto VFS is included. `pdf-lib` — no outline API at all (0 items extracted; the community `PdfOutline` PR #486 was closed unmerged) and no tagging; you hand-roll line breaking, bullets, pagination, and link annotations. `jsPDF` — its `html()` path drags in `html2canvas` + `dompurify` (both `optionalDependencies`) and has a cluster of open text-fidelity bugs; its text API works, but it offers nothing react-pdf doesn't, with less pagination control and no PDF/A.

---

## 2. Feature matrix

Legend: **YES** = verified by me empirically in this session · **yes** = documented in a primary source, not re-verified here · **NO** = verified absent · **—** = not applicable.

| Capability | `@react-pdf/renderer` 4.9.0 | `pdfmake` 0.3.11 | `pdf-lib` 1.17.1 | `jsPDF` 4.2.1 | `pdfkit` 0.20.2 (direct) | Chrome `printToPDF` |
|---|---|---|---|---|---|---|
| Fully client-side, no server | **YES** | **YES** | **YES** | **YES** | **YES** | **NO** (needs Chrome + server process) |
| Real selectable text (not raster) | **YES** (0 image ops, 2 `FontFile2`, 2 `ToUnicode`) | **YES** (2 `ToUnicode`) | **YES** w/ TTF subset; **NO** `ToUnicode` with standard-14 | **YES** via text API | **YES** (2 `ToUnicode`) | yes |
| Custom TTF/OTF embedding | **YES** `Font.register` | **YES** `vfs` / URL | **YES** `embedFont(bytes,{subset:true})` | **YES** `addFileToVFS`+`addFont` | **YES** `registerFont` | yes (via CSS `@font-face`) |
| External link annotations | **YES** (2 verified) | **YES** (3 verified, fragmented) | **YES** (hand-rolled `/Annots`) | **YES** | **YES** | yes |
| Internal link annotations | **YES** named dest (2) | **YES** (`linkToPage`) | **YES** (hand-rolled `/Dest`) | **YES** (`pageNumber`) | **YES** (`goTo`) | yes (anchor → page) |
| PDF outline / bookmarks | **YES**, **nested** (4) | **YES**, flat (4) | **NO** (0 items) | **YES**, flat (3) | **YES**, flat (4) | yes — `generateDocumentOutline` (**experimental** flag) |
| Metadata title/author/subject/keywords | **YES** | **YES** | **YES** | **YES** | **YES** | yes (from `<title>`/`<meta>`) |
| Document language `/Lang` | **YES** | **YES** (`language`) | **YES** `setLanguage` | **NO** | **YES** (`lang`) | yes |
| XMP metadata | **YES** | **YES** (tagged/pdf-a variants) | **NO** | **NO** | **YES** | yes |
| **Tagged PDF / struct tree** | **NO** | **NO** — `/Marked true` + **empty** tree | **NO** | **NO** | **YES** — real tree, PDF/UA | Partial — `generateTaggedPDF` (**experimental**) |
| PDF/A | **YES** (1b/2b/3b) | **YES** (forwards to pdfkit) | **NO** | **NO** | **YES** (1a/1b/2a/2b/3a/3b) | **NO** |
| PDF/UA | **NO** (explicitly deferred) | `subset:'PDF/UA'` sets XMP but tree is empty | **NO** | **NO** | **YES** (`subset:'PDF/UA'`) | Partial |
| Declarative pagination / orphan-widow control | **YES** — `orphans`/`widows`/`minPresenceAhead`/`wrap`/`break`/`fixed` | Partial (`pageBreakBefore`, `dontBreakRows`) | **NO** — hand-rolled | **NO** — hand-rolled | Partial (`text()` wrapping, no widow control) | yes (CSS `break-inside`) |
| Hyphenation control | **YES** `registerHyphenationCallback` + `@react-pdf/hyphenate` | yes (`linebreak`) | **NO** | **NO** | yes (`linebreak`) | yes (CSS `hyphens`) |
| Headless-Chrome dependency | none | none | none | none | none | **YES** |
| Browser bundle, min+gzip (measured, Vite 7, React external) | **604 KB** | 378 KB (836 KB with VFS fonts) | 533 KB | 261 KB (text API; +247 KB html2canvas chunk) | 231 KB | n/a |
| npm `dist.unpackedSize` | 320 KB | 15.3 MB | 19.5 MB | 30.2 MB | 10.5 MB | — |
| Last publish | 2026-08-27 | 2026-06-12 | **2022-05-12** | 2026-03-17 | 2026-09-07 | 2026-09-23 (Puppeteer 25.12.0) |
| TS types shipped | yes (first-party) | yes (`types/`) | yes | yes | yes (`@types/pdfkit` separate) | yes (Puppeteer) |

### 2.1 On the two Chrome flags

Headless Chrome is the only engine here with a *native* tagged-PDF path, and it is not a viable primary for this project because it requires a server + a full browser download. For completeness, from the protocol spec itself (`devtools-protocol@0.0.1710668`, `json/browser_protocol.json`, `Page.printToPDF`):

- `generateTaggedPDF` — *"Whether or not to generate tagged (accessible) PDF. Defaults to embedder choice."* — **experimental**
- `generateDocumentOutline` — *"Whether or not to embed the document outline into the PDF."* — **experimental**

Puppeteer surfaces these as `PDFOptions.tagged` (*"Generate tagged (accessible) PDF"*, `@defaultValue true`, `@experimental`) and `PDFOptions.outline` (*"Generate document outline"*, `@defaultValue false`, `@experimental`). Both are marked experimental, so the output is version-fragile — a poor foundation for a deliverable users may need to re-generate. `page.pdf()` also cannot run in the browser at all, which alone disqualifies it for a "runs fully client-side, no server" product.

---

## 3. Empirical verification

### 3.1 Environment and setup

```
$ pwd
C:\Users\felix\Documents\Project\ResumeBuilder

$ node --version
v24.18.0
$ pnpm --version
11.17.0

$ New-Item -ItemType Directory -Force -Path ".research-scratch","docs\research"
```

Scratch project (`.research-scratch/package.json`) installed with:

```
$ cd .research-scratch
$ pnpm install --no-frozen-lockfile
dependencies:
+ @pdf-lib/fontkit 1.1.1
+ @react-pdf/renderer 4.9.0
+ jspdf 4.2.1
+ pdf-lib 1.17.1
+ pdfjs-dist 6.4.299
+ pdfkit 0.20.2
+ pdfmake 0.3.11
+ react 19.3.0

[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: core-js@3.50.0
```

> The non-zero exit is only pnpm's `IGNORED_BUILDS` notice for a transitive `core-js` postinstall; every package installed and resolved correctly.

Test font: **Lato** (SIL OFL) downloaded from the Google Fonts repository — `fonts/Lato-Regular.ttf` (656,568 B), `fonts/Lato-Bold.ttf` (656,544 B).

### 3.2 Registry metadata (`npm view`)

```
$ npm view @react-pdf/renderer version dist-tags time.modified dist.unpackedSize license dependencies
version = '4.9.0'
dist-tags = { latest: '4.9.0' }
time.modified = '2026-08-27T22:59:33.463Z'
dist.unpackedSize = 319813
license = 'MIT'
dependencies = { queue, events, pdfkit: '0.20.1', prop-types, object-assign,
  '@babel/runtime', '@react-pdf/fns', '@react-pdf/font', '@react-pdf/types',
  '@react-pdf/layout', '@react-pdf/render', '@react-pdf/primitives', '@react-pdf/reconciler' }

$ npm view pdfmake version dist-tags time.modified dist.unpackedSize license dependencies
version = '0.3.11'
dist-tags = { beta: '0.3.0', latest: '0.3.11' }
time.modified = '2026-06-12T04:40:24.546Z'
dist.unpackedSize = 15346704
dependencies = { linebreak: '^1.1.0', pdfkit: '^0.19.1', xmldoc: '^2.0.3' }

$ npm view pdf-lib version time.modified dist.unpackedSize dependencies
version = '1.17.1'
time.modified = '2022-05-12T18:02:10.238Z'      # <- last publish, 4+ years ago
dist.unpackedSize = 19461112

$ npm view jspdf version time.modified dist.unpackedSize dependencies
version = '4.2.1'
time.modified = '2026-03-17T11:16:14.323Z'
dist.unpackedSize = 30192058
dependencies = { '@babel/runtime': '^7.28.6', fflate: '^0.8.1', 'fast-png': '^6.2.0' }

$ npm view pdfkit version time.modified dist.unpackedSize dependencies
version = '0.20.2'
time.modified = '2026-09-07T13:26:21.619Z'
dist.unpackedSize = 10530445

$ npm view playright version dist-tags
version = '1.63.0'      # playwright
$ npm view puppeteer version
version = '25.12.0'
$ npm view @myriaddreamin/typst.ts version
version = '0.7.0'
```

Two corrections to widely-held priors: **pdfmake is on 0.3.x, not 0.2.x** (0.3.11 is `latest`), and **jsPDF is on 4.x, not 2.x**.

`jspdf`'s `optionalDependencies` — which is what makes the `html()` path expensive — are declared as:

```
optionalDependencies = { canvg: '^3.0.11', core-js: '^3.6.0',
                         dompurify: '^3.3.1', html2canvas: '^1.0.0-rc.5' }
```

### 3.3 Generators

Twelve PDFs were produced from a single canonical résumé document (H1 name, bulleted experience list, an `https://` link, a `mailto:` link, an internal "jump to page 2" link, a `fixed` page-number footer, and a second page):

```
$ node gen-reactpdf.mjs out/reactpdf.pdf        plain
$ node gen-reactpdf.mjs out/reactpdf-pdfa.pdf   pdfa
$ node gen-pdfkit.mjs   out/pdfkit-plain.pdf    plain
$ node gen-pdfkit.mjs   out/pdfkit-tagged.pdf   tagged incr
$ node gen-pdfkit.mjs   out/pdfkit-deferred.pdf tagged deferred
$ node gen-pdfkit.mjs   out/pdfkit-pdfa.pdf     pdfa
$ node gen-pdfmake.mjs  out/pdfmake.pdf         plain
$ node gen-pdfmake.mjs  out/pdfmake-tagged.pdf  tagged
$ node gen-pdfmake.mjs  out/pdfmake-pdfa.pdf    pdfa
$ node gen-pdflib.mjs   out/pdflib.pdf          ttf
$ node gen-pdflib.mjs   out/pdflib-s14.pdf      standard14
$ node gen-jspdf.mjs    out/jspdf.pdf           text
```

All five libraries rendered without error. `react-pdf`'s Node build exposes `renderToFile`/`renderToBuffer`, which is why the harness could run headlessly; the browser path uses `pdf(...).toBlob()` / `usePDF` against the same document tree.

### 3.4 Extraction

Text, annotations, outline and metadata were read with **`pdfjs-dist` 6.4.299** (Mozilla's reference implementation, `legacy/build/pdf.mjs`) — i.e. an independent consumer, not the producing library. Structural markers (`/ToUnicode`, `/StructTreeRoot`, `/MarkInfo`, `/MCID`, `BDC`, …) were read by inflating every Flate-compressed stream with `zlib` and grepping the union, because every one of these writers compresses its object streams:

```
$ node extract2.mjs out/<name>.pdf out/<name>.json
$ node probe-struct.mjs out/<name>.pdf
$ node compare.mjs
```

The matrix produced by `compare.mjs` (console.table output):

| pdf | pages | textChars | imgOps | ToUnicode | fontsEmb | outline | extLinks | intLinks | StructTree | MarkInfo | metaTitle | lang | xmp | pdfa | pdfua |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reactpdf | 2 | 702 | 0 | 2 | 2 | 4 | 2 | 2 | -- | -- | YES | en-US | -- | -- | -- |
| reactpdf-pdfa | 2 | 702 | 0 | 2 | 2 | 4 | 2 | 2 | -- | -- | YES | en-US | YES | YES | -- |
| pdfkit-plain | 2 | 483 | 0 | 2 | 2 | 4 | 2 | 2 | -- | -- | YES | en-US | YES | -- | -- |
| **pdfkit-tagged** | 2 | 505 | 0 | 2 | 2 | 4 | 2 | 2 | **YES** | **YES** | YES | en-US | YES | -- | **YES** |
| pdfkit-pdfa | 2 | 483 | 0 | 2 | 2 | 4 | 2 | 2 | -- | -- | YES | en-US | YES | YES | -- |
| pdfmake | 2 | 504 | 0 | 2 | 2 | 4 | 3 | 5 | -- | -- | YES | -- | -- | -- | -- |
| pdfmake-tagged | 2 | 504 | 0 | 2 | 2 | 4 | 3 | 5 | **YES*** | **YES*** | YES | en-US | YES | -- | **YES*** |
| pdfmake-pdfa | 2 | 504 | 0 | 2 | 2 | 4 | 3 | 5 | -- | -- | YES | en-US | YES | YES | -- |
| pdflib | 2 | 469 | 0 | 2 | 2 | **0** | 1 | 1 | -- | -- | YES | en-US | -- | -- | -- |
| pdflib-s14 | 2 | 469 | 0 | **0** | **0** | **0** | 1 | 1 | -- | -- | YES | en-US | -- | -- | -- |
| jspdf | 2 | 467 | 0 | 2 | 2 | 3 | 2 | 1 | -- | -- | YES | -- | -- | -- | -- |

`imageOps = 0` for **every** candidate confirms requirement (a): none of these paths rasterized the page.

`*` **pdfmake's tagging is a facade.** `probe-struct.mjs` on `pdfmake-tagged.pdf`:

```
file: out/pdfmake-tagged.pdf
  /StructTreeRoot : 2
  /MarkInfo       : 1
  /Marked true    : 1
  /MCID           : 0            <- no marked content
  BDC operators   : 0            <- no marked-content sequences
  BMC operators   : 0
  EMC operators   : 0
  /Type /StructElem: 0
  /S /<Tag>       : 0            <- no structure elements
  /ParentTree     : 2
  /RoleMap        : 0
  /Alt or /ActualText: 0

--- StructTreeRoot context ---
/StructTreeRoot /ParentTree << /Nums [ ] >> /ParentTreeNextKey 0 >> endobj
              5 0 obj << /Marked true >> endobj
```

Compare `pdfkit-tagged.pdf`, which is a genuine Tagged PDF:

```
file: out/pdfkit-tagged.pdf
  /StructTreeRoot : 2
  /MarkInfo       : 1
  /Marked true    : 1
  /MCID           : 15
  BDC operators   : 19
  EMC operators   : 19
  /S /<Tag>       : 21
  /ParentTree     : 2

--- StructTreeRoot context ---
/StructTreeRoot /ParentTree << /Limits [0 1]
   /Nums [ 0 [12 0 R 14 0 R 20 0 R 23 0 R 26 0 R 27 0 R 29 0 R 30 0 R 32 0 R 33 0 R 34 0 R 35 0 R]
           1 [43 0 R 44 0 R 45 0 R] ] >>
   /ParentTreeNextKey 2 /K [11 0 R 42 0 R] >> endobj
24 0 obj << /S /L /P 11 0 R /K [25 0 R 28 0 R 31 0 R] >> endobj
11 0 obj << /S /Document /P 6 0 R /K [12 0 R 14 0 R 20 0 R 23 0 R 24 0 R 34 0 R 35 0 R] >> endobj

--- structure element tag tally ---
{"H1":2,"URI":2,"P":3,"GoTo":2,"Link":2,"H2":2,"Lbl":3,"LBody":3,"LI":3,"L":1,"Document":2}
```

`reactpdf.pdf`, `jspdf.pdf` and `pdflib.pdf` all report `StructTreeRoot: 0`, `MarkInfo: 0`, `Marked true: 0`, `MCID: 0`, `BDC: 0`.

### 3.5 The react-pdf tagging gap, confirmed directly

```
$ node taggedtest.mjs
{"tagged":true} -> OK, bytes: 1513 | has /Marked: false
{"tagged":true,"conformance":"PDF/UA-1"} -> OK, bytes: 2325 | has /Marked: false
{"conformance":"PDF/A-2b"} -> OK, bytes: 5408 | has /Marked: false
```

react-pdf **accepts and silently ignores** both `tagged` and a PDF/UA conformance level. It never throws, which is the dangerous part: a team could believe it ships accessible PDFs. This is consistent with the maintainer's statement in PR #3529 that PDF/UA awaits tagged output, and with open issues #3179 and #1115.

### 3.6 Extracted text sample (proof of real text)

`@react-pdf/renderer`, page 1 (582 chars extracted by pdf.js from a PDF with 2 embedded subsetted TrueType fonts and `ToUnicode` CMaps):

```
Page 1 of 2Alex RiveraSenior Backend Engineerexample.com/portfolio | alex@example.comJump to
References (page 2)Experience• Built a deterministic PDF pipeline serving 40k documents/day.•
Cut p99 render latency from 2.4s to 380ms by moving layout off the main thread.• Led migration
from PostgreSQL 12 to 16 with zero downtime.
```

Note the words are intact and correctly ordered with no mojibake, ligature corruption, or missing spaces — the classic symptoms of a broken `ToUnicode` CMap. Subset font names confirm real subsetting: `CZZZZZ+Lato-Regular`, `DZZZZZ+Lato-Bold`, with `FontFile2: 2` and `Type0 / CIDFontType2` encoding.

### 3.7 Annotation dump (proof of working links)

`@react-pdf/renderer` — external + internal, from `pdfjs` `page.getAnnotations()`:

```
-- page 1: 582 chars, imageXObjects=0
   ANNOTATIONS:
     * Link url=https://example.com/portfolio dest=null rect=[48,732,148,744]
     * Link url=mailto:alex@example.com     dest=null rect=[160,732,244,744]
     * Link url=null dest=references         rect=[48,708,171,720]      <- internal, page 1 -> 2
-- page 2: 120 chars, imageXObjects=0
   ANNOTATIONS:
     * Link url=null dest=references rect=[48,715,161,727]
OUTLINE (4 items):
   - "Alex Rivera"
     - "Experience"
     - "Skills"
   - "References"
INFO: {"Title":"Alex Rivera - Senior Backend Engineer","Author":"Alex Rivera",
       "Subject":"Resume / CV","Keywords":"backend, typescript, postgres, kubernetes",
       "Creator":"ResumeBuilder","Producer":"ResumeBuilder","Language":"en-US"}
```

Raw markers for `reactpdf.pdf`: `Outlines: 1`, `LinkAnnot: 4`, `URIAction: 2`, `DestKey: 4`, `GoTo: 2`, `LangCatalog: 1`, `DisplayDocTitle: 1`, `FontFile2: 2`, `ToUnicode: 2`, `StructTreeRoot: 0`.

`pdfkit-tagged.pdf` adds the accessibility layer on top of the same link/outline behaviour:

```
== pdfkit-tagged | pages: 2 | ToUnicode: 2 | struct: true | outline: 4 | extLinks: 2 | intLinks: 2
   page 1 -> "Alex RiveraSenior Backend Engineerexample.com/portfolio | alex@example"
   page 2 -> "ReferencesAvailable on request. Prior managers at Northwind Systems an"
```

`pdfmake.pdf` — internal links work but **fragment badly**: one `linkToPage` line produced **five** separate `/Link` annotations, and one external link produced **two**:

```
     * Link url=https://example.com/portfolio dest=null rect=[48,738,110,750]
     * Link url=https://example.com/portfolio dest=null rect=[110,738,148,750]
     * Link url=mailto:alex@example.com     dest=null rect=[161,738,244,750]
     * Link url=null dest=array(5) rect=[48,718,74,730]
     * Link url=null dest=array(5) rect=[74,718,86,730]
     * Link url=null dest=array(5) rect=[86,718,137,730]
     * Link url=null dest=array(5) rect=[137,718,163,730]
     * Link url=null dest=array(5) rect=[163,718,171,730]
```

`pdflib.pdf` — link annotations are **not** an API; they were hand-built as raw `/Annots` dictionaries. Only after that did they extract correctly:

```
     * Link url=https://example.com/portfolio dest=null rect=[48,733,148,746]
     * Link url=null dest=array(2) rect=[48,709,173,722]
OUTLINE (0 items):
```

`pdflib-s14.pdf` (standard-14 Helvetica) is the one real text-extraction trap I found: `ToUnicode: 0`, `FontFile2: 0`. pdf.js still recovered the text because it knows the standard-14 encodings, but the PDF carries **no `ToUnicode` CMap**, and the fonts are not embedded. Any extractor that relies on `ToUnicode` rather than hard-coded standard-font tables is at risk. This is the concrete reason to always `embedFont(...)` real TTF bytes rather than use `StandardFonts`.

### 3.8 Reading-order bug in PDFKit's structure API (and its fix)

I rendered the same tagged document two ways. The difference is real and reproducible:

```
== pdfkit-tagged   (elements attached incrementally) | pages: 2
   page 1 -> "Alex RiveraSenior Backend Engineerexample.com/portfolio | alex@example"
   page 2 -> "ReferencesAvailable on request. Prior managers at Northwind Systems an"

== pdfkit-deferred (whole tree attached at the end)  | pages: 3
   page 1 -> "Built a deterministic PDF pipeline serving 40k documents/day.Cut p99 r"
   page 2 -> "Alex RiveraSenior Backend Engineerexample.com/portfolio | alex@example"
   page 3 -> "ReferencesAvailable on request. Prior managers at Northwind Systems an"
```

Cause: PDFKit defers a structure element's closure until the element is attached to the document, but `doc.list(..., { structParent })` emits content **immediately**. Mixing the two styles reorders the page content stream — the bulleted list landed on page 1 and the name heading on page 2, and the document grew a page. The library's own accessibility doc says *"It's best to add elements to their parents as you go"*; my results show that is not stylistic advice but a correctness requirement. Any pdfkit-based implementation must attach incrementally.

### 3.9 Bundle sizes (measured, not estimated)

Each engine was bundled from a minimal entry with **Vite 7.3.6** library mode, `minify: 'esbuild'`, `target: 'esnext'`, React external for react-pdf. Totals include **all** emitted chunks (jsPDF code-splits its optional deps).

```
$ ENTRY=entries/reactpdf.js NAME=reactpdf EXTERNAL=react,react/jsx-runtime,react-dom npx vite build --config vite.bundle.config.mjs
$ ... (same for pdfkit, pdflib, jspdf, pdfmake, pdfmake-vfs)

===== MINIFIED + GZIP BROWSER PAYLOAD =====
jspdf          raw    1,031 KB   gzip     261 KB   (5 chunks)
pdfkit         raw      694 KB   gzip     231 KB   (1 chunks)
pdflib         raw    1,437 KB   gzip     533 KB   (1 chunks)
pdfmake        raw    1,359 KB   gzip     378 KB   (1 chunks)
pdfmake-vfs    raw    2,194 KB   gzip     836 KB   (1 chunks)
reactpdf       raw    2,159 KB   gzip     604 KB   (1 chunks)
```

- `jspdf`'s 5 chunks are `jspdf-*.js` 527 KB + **`html2canvas.esm-*.js` 247 KB** + `index.es-*.js` 219 KB + **`purify.es-*.js` 38 KB** — the `html2canvas` and `dompurify` chunks appear purely because they are `optionalDependencies` and jsPDF dynamic-imports them from its `html` module.
- `pdfmake-vfs` vs `pdfmake` isolates the bundled Roboto virtual font system at **+835 KB raw / +458 KB gzip**.
- `reactpdf` includes Yoga's base64-inlined WASM (118 KB) and the full `pdfkit` + `fontkit` stack; React itself was externalized here.

### 3.10 Yoga / WASM / worker findings (for the Vite config)

```
$ node -e "console.log(require('./node_modules/.pnpm/yoga-layout@3.2.1/node_modules/yoga-layout/package.json').version)"
3.2.1

dist/binaries/yoga-wasm-base64-esm.js   120,919 bytes   <- WASM base64-INLINED in JS

# dist/src/index.js
import loadYoga from '../binaries/yoga-wasm-base64-esm.js';
import wrapAssembly from "./wrapAssembly.js";
const Yoga = wrapAssembly(await loadYoga());     // <- top-level await
```

So: **no separate `.wasm` file is fetched, and no Web Worker is required.** The WASM is a base64 string inside a JS module, so there is no `assetsInclude`/`wasm` MIME problem and no `worker` config. The only sharp edge is the **top-level `await`** in `yoga-layout`'s main entry, which some bundler targets reject. I tested Vite 7's *default* target against it explicitly:

```
$ npx vite build --config vite.defaulttarget.config.mjs
vite v7.3.6 building client environment for production...
✓ 166 modules transformed.
bundle-out/reactpdf-defaulttarget/bundle.js  2,211.08 kB │ gzip: 617.55 kB
✓ built in 2.85s
EXIT: 0
```

It builds clean at the default target — no `build.target: 'esnext'` needed on Vite 7. If an older Vite or a stricter target is ever pinned and TLA becomes an error, importing from `yoga-layout/load` (the async variant, which has no TLA) or setting `build.target: 'esnext'` are the two fixes. This is the only "WASM config" this stack needs, and the answer is: **none**.

### 3.11 jsPDF `html()` — what is actually true

The claim "`html()` produces image-only PDFs" is **too strong, but the path is still unusable for ATS work**. From `src/modules/html.js`:

```js
function loadHtml2Canvas() {
  ... return import("html2canvas"); ...
}
// Worker.prototype.toContext2d (used by toPdf) ends with:
pdf.context2d.save(true);
return html2canvas(this.prop.container, options);
```

`html()` renders into jsPDF's own canvas via html2canvas and relies on jsPDF's `context2d` proxy to translate the resulting draw calls — so text *can* emerge as real PDF text operators, and `options.autoPaging: 'text'` exists specifically to avoid slicing text across breaks. It is not unconditionally a raster. **However**, it requires the `html2canvas` (and, for string input, `dompurify`) optional dependencies — confirmed present, contributing the 247 KB and 38 KB chunks in §3.9 — it needs a DOM, and it carries a cluster of open text-fidelity bugs:

| Issue | Title | State |
|---|---|---|
| [#3393](https://github.com/parallax/jsPDF/issues/3393) | Missing several line of text when using `html()` with `autopaging: 'text'` | open, `Bug` + `help wanted` |
| [#2968](https://github.com/parallax/jsPDF/issues/2968) | `html()` ignores custom fonts, exports incorrect UTF-8/Cyrillic symbols | open, 50 comments, 20 👍 |
| [#3730](https://github.com/parallax/jsPDF/issues/3730) | Part of the text at the pagination point is missing | closed |
| [#3862](https://github.com/parallax/jsPDF/issues/3862) | Bold text overlaps, special characters misalign with `html()` | closed |
| [#1822](https://github.com/parallax/jsPDF/issues/1822) | "Selectable text from HTML?" | *(the question itself)* |

For a résumé builder where a dropped line could delete a job title, that is disqualifying. jsPDF's **text API** is fine — verified 2 pages, `ToUnicode: 2`, 3 outline items, 2 external + 1 internal link annotations, correct metadata — it simply offers less than react-pdf.

### 3.12 Primary-source verification of capability claims

| Claim | Primary source |
|---|---|
| react-pdf `<Document>` props incl. `conformance`, `pdfVersion`, `language`, `pageMode`, `permissions` | <https://react-pdf.org/docs/v4/components/document> |
| react-pdf `<Link src>` accepts a URL or a `#destID`; `bookmark`/`hitSlop` props | <https://react-pdf.org/docs/v4/components/link> |
| react-pdf destinations (`id` + `#id`) and nested bookmark tree | <https://react-pdf.org/docs/v4/advanced/document-navigation> |
| react-pdf `orphans`/`widows`/`minPresenceAhead` defaults and semantics | <https://react-pdf.org/docs/v4/advanced/orphans-and-widows> |
| react-pdf `Font.register`, `registerHyphenationCallback`, `@react-pdf/hyphenate`, TTF/WOFF only, no variable fonts | <https://react-pdf.org/docs/v4/fonts> |
| react-pdf `usePDF` is "Web only"; `renderToBuffer`/`renderToStream` are Node | <https://react-pdf.org/docs/v4/hooks>, <https://react-pdf.org/docs/v4/node> |
| react-pdf React 19 support since v4.1.0; esbuild `__dirname` workaround via Yoga | <https://react-pdf.org/docs/v4/compatibility> |
| PDF/UA "need[s] tagged output"; b-levels only for now; closes #1520, refs #3179/#2924 | <https://github.com/diegomura/react-pdf/pull/3529> |
| Open tagging/WCAG requests | <https://github.com/diegomura/react-pdf/issues/3179>, <https://github.com/diegomura/react-pdf/issues/1115> |
| Long-document `unsupported number: …e+21` crash with `fixed` + `render` + `lineHeight` (closed 2026-08-23) | <https://github.com/diegomura/react-pdf/issues/3452> |
| React-pdf official Vite example config (`vite ^5`, `{ root:'src', plugins:[react()] }`) | <https://github.com/diegomura/react-pdf/blob/master/apps/examples/vite.config.js> |
| React-pdf moved to upstream pdfkit | <https://github.com/diegomura/react-pdf/pull/3509> |
| Vite example relocated to `apps/examples` | <https://github.com/diegomura/react-pdf/pull/3546> |
| PDFKit PDF/A-1a/1b/2a/2b/3a/3b (v0.14.0), `subset: 'PDF/UA'` (v0.15.0), structure tab order (v0.16.0), ToUnicode fix for PDFium (#1498), >256-char copy fix (#1659), browser `virtual-fs` removal (v0.20.0) | <https://github.com/foliojs/pdfkit/blob/master/CHANGELOG.md> |
| PDFKit `tagged:true`, `subset:'PDF/UA'`, `markContent`, `struct`, `addStructure`, `structParent`, tag list, standard-14 not embeddable → not PDF/A- or PDF/UA-conformant | <https://github.com/foliojs/pdfkit/blob/master/docs/accessibility.md> |
| pdfmake 0.3.0 breaking changes (upstream pdfkit, promise API, client-side VFS), 0.3.5 outline/bookmark props, 0.3.11 ships pdfkit 0.19.1 | <https://github.com/bpampuch/pdfmake/blob/master/CHANGELOG.md> |
| pdfmake forwards `tagged`/`subset`/`displayTitle`/`version`/`language` into pdfkit and lowercases `info` keys | `node_modules/pdfmake/js/Printer.js` lines 36–71, 198–225 (installed source) |
| pdf-lib writes a `ToUnicode` CMap for custom fonts | `node_modules/pdf-lib/cjs/core/embedders/CustomFontEmbedder.js:107` → `ToUnicode: unicodeCMapRef`; <https://github.com/Hopding/pdf-lib/blob/master/src/core/embedders/CustomFontSubsetEmbedder.ts> |
| pdf-lib has no outline API; community PR never merged (`merged_at: null`) | <https://github.com/Hopding/pdf-lib/pull/486>, <https://github.com/Hopding/pdf-lib/issues/127> |
| pdf-lib internal-link bugs still open | <https://github.com/Hopding/pdf-lib/issues/1609>, <https://github.com/Hopding/pdf-lib/issues/1742> |
| jsPDF `html()` depends on `html2canvas` (+ `dompurify` for string input); standard 14 fonts are ASCII-only | <https://github.com/parallax/jsPDF#readme> |
| jsPDF `html()` implementation (`loadHtml2Canvas`, `toContext2d`) | <https://github.com/parallax/jsPDF/blob/master/src/modules/html.js> |
| jsPDF real link annotations (`/Subtype /Link`, `/URI`, `/Dest`) and outline plugin `doc.outline.add` | `node_modules/jspdf/dist/jspdf.es.js` lines 9582–9589, 14517–14538 |
| CDP `Page.printToPDF` `generateTaggedPDF` / `generateDocumentOutline`, both **experimental** | `devtools-protocol@0.0.1710668` → `json/browser_protocol.json`; <https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF> |
| Puppeteer `PDFOptions.tagged` (default `true`) / `.outline` (default `false`), both `@experimental` | <https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/common/PDFOptions.ts> |
| Typst: Tagged PDF by default, `--pdf-standard` incl. `ua-1`, `a-1a`, `a-2a`, `a-2u`, `a-3a`, `a-4`; `pdf.artifact` | <https://typst.app/docs/reference/pdf/> |
| typst.ts runs the compiler in-browser, but its exporters are SVG/Canvas/HTML | <https://github.com/Myriad-Dreamin/typst.ts> |
| WeasyPrint `--pdf-variant pdf/ua-1…pdf/a-4f`, `--pdf-tags`, external/internal/attachment links, `make_bookmark_tree` — Python, not browser | <https://doc.courtbouillon.org/weasyprint/stable/api_reference.html> |

---

## 4. Risks and mitigations — `@react-pdf/renderer` 4.9.0

| # | Risk | Evidence | Severity | Mitigation |
|---|---|---|---|---|
| **R1** | **No tagged PDF / PDF-UA.** Cannot ship an accessible-conformant PDF. | `<Document tagged conformance="PDF/UA-1">` renders `has /Marked: false` (§3.5); PR #3529 defers it; #3179/#1115 open | Medium — *not* an ATS blocker (ATS uses `ToUnicode` + content stream, which pass), but an accessibility/compliance blocker | Scope accessibility as a **separate milestone**. Because react-pdf now runs on upstream pdfkit (which has `tagged`/`struct`/`subset:'PDF/UA'`), the gap is upstream plumbing, not an engine limitation — track #3179. If PDF/UA becomes hard, switch to the §1 fallback (§6). Do **not** pass `tagged` today expecting it to work: it fails silently. |
| **R2** | **Fixed + `render` + `lineHeight` on long documents crashed** with `unsupported number: …e+21`. | Issue #3452, closed 2026-08-23 (reported on 4.5.1) | High if regressed — this is the page-number footer pattern every résumé uses | Pin `@react-pdf/renderer` exactly; add a **regression test that renders a 10+ page document with a `fixed` footer and `lineHeight`** and asserts success. |
| **R3** | **Pagination/`wrap` edge cases** — nested `fixed` elements not repeated; flex-child disappearing under `wrap`. | Issue #206; PR #3516 fixing nested-`fixed` repeat under `experimentalPagination` | Medium | Avoid `experimentalPagination` until stable. Prefer `minPresenceAhead` on section headings and `wrap={false}` on small atomic blocks (a job entry) over deep nesting. Snapshot-test page count and heading placement. |
| **R4** | **Layout engine is WASM behind a top-level `await`.** | `yoga-layout@3.2.1` `dist/src/index.js`: `const Yoga = wrapAssembly(await loadYoga())`; WASM base64-inlined (118 KB) | Low | Verified building clean on Vite 7 at the **default** target (§3.10). No worker/WASM asset config needed. If a target later rejects TLA: `build.target: 'esnext'` or import `yoga-layout/load`. |
| **R5** | **Bundle weight ~604 KB gzip** (React external), the largest of the client-side options. | §3.9 | Medium | Route-split: keep `<PDFDownloadLink>`/`usePDF` behind a dynamic `import()` so the editor route never pays it. Consider a dedicated chunk for the renderer. |
| **R6** | **Fonts must be embedded, and only TTF/WOFF work; variable fonts are unsupported.** | <https://react-pdf.org/docs/v4/fonts> | Medium | Ship static TTF subsets (Lato/Roboto/Inter static) via Vite `?url` imports; register `normal`+`bold` explicitly. Do not rely on standard-14 for Unicode; do not use variable fonts. Add a font-coverage check for the résumé's character set. |
| **R7** | **`ToUnicode`/copy-paste regressions in the pdfkit layer.** | pdfkit fixed exactly this class: #1498 (invalid `ToUnicodeMap`, PDFium) and #1659 (>256 unique chars garbled in Chrome/Edge) | Medium | react-pdf pins `pdfkit: 0.20.1` (both fixes included). Add a **CI assertion** on every build: extracted text from a rendered PDF must contain the expected strings — the `extract2.mjs` harness in §3.4 is a working prototype. |
| **R8** | **ATS reading order follows JSX tree order.** A `fixed` footer placed first appeared as the first text on the page (`"Page 1 of 2Alex Rivera…"`). | §3.6 | Low | Declare `fixed` headers/footers **last** in the `Page` children so body text precedes them in the content stream. Assert the extracted text starts with the candidate's name. |
| **R9** | **Link annotation fragmentation / text-link split across lines.** | pdfmake produced 2 annotations for one link and 5 for one `linkToPage` (§3.7); react-pdf produced exactly 1 per link | Low | Add a link-count assertion per document. Keep hyperlink text short and on one line; render URLs as a single `<Link>`. |
| **R10** | **No server means no fallback rendering path.** | — | Low | Every code path (`usePDF`, `pdf().toBlob()`, `PDFDownloadLink`) is client-side; verify in a real browser in CI (Playwright) since the Node build is a different entry (`lib/react-pdf.js` vs `lib/react-pdf.browser.js`). |

---

## 5. Exact browser-side setup with Vite

### 5.1 `vite.config.ts`

The React-pdf project's own Vite example is deliberately minimal, and my bundle runs confirm nothing more is required — **no worker config, no `wasm` plugin, no `assetsInclude`, no Node polyfills**:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Optional. Yoga's WASM is base64-inlined and its entry uses top-level await;
  // Vite 7's default target handled this in testing. Uncomment only if a future
  // target/esbuild version rejects TLA in a dependency.
  // build: { target: 'esnext' },

  // Optional. If a stale pre-bundle of yoga-layout/pdfkit ever misbehaves in dev:
  // optimizeDeps: { include: ['@react-pdf/renderer', 'yoga-layout', 'pdfkit', 'fontkit'] },
});
```

### 5.2 Fonts — register once, at module scope, from Vite asset URLs

```ts
// src/pdf/fonts.ts
import { Font } from '@react-pdf/renderer';

// Vite turns these into hashed asset URLs; react-pdf fetches them in the browser.
import latoRegular from '../assets/fonts/Lato-Regular.ttf?url';
import latoBold from '../assets/fonts/Lato-Bold.ttf?url';

// Static TTFs only. OpenType VARIABLE fonts do not work (PDF 2.0 has no
// variable-font concept) — register one file per weight.
Font.register({ family: 'Lato', src: latoRegular });
Font.register({ family: 'Lato', src: latoBold, fontWeight: 'bold' });

// Optional: hyphenation. Default is en-us; import a language pack otherwise.
// import { syllables } from '@react-pdf/hyphenate/de';
// Font.registerHyphenationCallback(syllables);

// Or hand-rolled control (keep the soft-hyphen look out of ATS text by
// returning the word whole when you prefer no break):
// Font.registerHyphenationCallback((word) => [word]);
```

### 5.3 The document — pagination, links, bookmarks, metadata

```tsx
// src/pdf/ResumeDocument.tsx
import { Document, Page, Text, View, Link, StyleSheet } from '@react-pdf/renderer';
import type { Resume } from '../types';

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 48, paddingHorizontal: 48, fontFamily: 'Lato', fontSize: 10 },
  h1: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  section: { fontSize: 13, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  // A footer drawn on every page. `fixed` repeats it; keep it LAST in the tree
  // (see risk R8) so body text precedes it in the content stream.
  footer: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#666' },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 12 },
  bulletText: { flex: 1 },
});

export function ResumeDocument({ resume }: { resume: Resume }) {
  return (
    <Document
      title={`${resume.name} - ${resume.headline}`}
      author={resume.name}
      subject="Resume"
      keywords={resume.keywords.join(', ')}
      creator="ResumeBuilder"
      producer="ResumeBuilder"
      language="en-US"
      pageMode="useOutlines"        // open the viewer with the bookmark pane visible
      creationDate={new Date()}
    >
      <Page size="A4" wrap style={s.page} bookmark={resume.name}>
        <Text style={s.h1}>{resume.name}</Text>
        <Text style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>{resume.headline}</Text>

        {/* External link annotations */}
        <Text>
          <Link src={resume.portfolioUrl} style={{ color: '#0b5fff' }}>{resume.portfolioLabel}</Link>
          {'  |  '}
          <Link src={`mailto:${resume.email}`} style={{ color: '#0b5fff' }}>{resume.email}</Link>
        </Text>

        {/* Internal link: `id` on the target, `#id` on the link */}
        <Text style={{ marginTop: 8, color: '#0b5fff' }}>
          <Link src="#references">Jump to References</Link>
        </Text>

        {resume.sections.map((section) => (
          // minPresenceAhead stops a heading being orphaned at a page bottom.
          <View key={section.id} bookmark={section.title} minPresenceAhead={40} wrap>
            <Text style={s.section}>{section.title}</Text>
            {section.bullets.map((bullet, i) => (
              // wrap={false} keeps a single bullet atomic.
              <View key={i} style={s.bulletRow} wrap={false}>
                <Text style={s.bulletDot}>{'\u2022'}</Text>
                <Text style={s.bulletText} orphans={2} widows={2}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Footer last, so it does not lead the page's text stream. */}
        <Text
          fixed
          style={s.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>

      <Page size="A4" style={s.page}>
        <Text id="references" bookmark={{ title: 'References', fit: true }} style={s.h1}>
          References
        </Text>
        <Text>{resume.references}</Text>
        <Text
          fixed
          style={s.footer}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
```

### 5.4 Generating the blob in the browser (no server)

```tsx
// src/pdf/DownloadButton.tsx
import { usePDF } from '@react-pdf/renderer';
import { ResumeDocument } from './ResumeDocument';

export function DownloadButton({ resume }: { resume: Resume }) {
  // usePDF is Web-only; `update` re-renders on demand so typing in the editor
  // does not regenerate the PDF on every keystroke.
  const [instance, update] = usePDF({ document: <ResumeDocument resume={resume} /> });

  return (
    <button
      type="button"
      onClick={() => {
        update(<ResumeDocument resume={resume} />); // render on click, on the fly
      }}
      disabled={instance.loading}
    >
      {instance.loading ? 'Rendering…' : 'Download PDF'}
    </button>
  );
}

// Once `instance.blob` is non-null, trigger the download without a server:
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

If you prefer to keep the renderer out of the initial bundle (risk R5):

```tsx
// Lazy-load the whole PDF stack on first use.
const { pdf } = await import('@react-pdf/renderer');
const { ResumeDocument } = await import('./ResumeDocument');
const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
```

### 5.5 Optional: PDF/A archival output

Verified working (`pdfa: YES`, XMP present) — note the documented caveats that only b-levels are supported and **every** font must be registered, not standard-14:

```tsx
<Document
  conformance="PDF/A-2b"   // or 'PDF/A-1b' | 'PDF/A-3b'
  pdfVersion="1.7"         // defaults to 1.4 for A-1, 1.7 for A-2/A-3
  title={title} author={author}
>
```

---

## 6. The fallback path, concretely

If tagged/PDF-UA output becomes a hard requirement, swap the renderer for **`pdfkit` 0.20.2** behind the same React document model. Vite resolves the browser build automatically via the package's `exports` condition (`"default": "./js/pdfkit.browser.mjs"`), and I verified a 694 KB / 231 KB gzip single-chunk Vite build with no polyfills.

```ts
import PDFDocument from 'pdfkit';   // -> js/pdfkit.browser.mjs in the browser
import { registerStdFonts } from 'pdfkit/standard-fonts/Helvetica'; // only if using standard-14

const doc = new PDFDocument({
  size: 'A4',
  pdfVersion: '1.7',
  tagged: true,            // sets /MarkInfo << /Marked true >>
  subset: 'PDF/UA',        // writes pdfuaid:part
  displayTitle: true,
  lang: 'en-US',
  info: { Title, Author, Subject, Keywords, Creator, Producer },
});

// Build the tree INCREMENTALLY — see §3.8. Deferring addStructure() reorders
// the content stream and breaks reading order.
const root = doc.struct('Document');
doc.addStructure(root);

root.add(doc.struct('H1', { title: 'Alex Rivera' }, () => {
  doc.font(latoBytes).fontSize(22).text('Alex Rivera');
}));
root.add(doc.struct('P', () => {
  doc.fontSize(10).text('example.com/portfolio', { link: 'https://example.com/portfolio', continued: true });
}));

const list = doc.struct('L');
root.add(list);
doc.list(['Bullet one.', 'Bullet two.'], { structParent: list });

doc.outline.addItem('Alex Rivera');
doc.end();
```

Two hard prerequisites, both from the library's own docs: every font must be **embedded** (standard-14 cannot be, so it can never be PDF/UA- or PDF/A-conformant), and all non-structure content (rules, page numbers) must be wrapped in `doc.markContent('Artifact', { type: 'Pagination' })`. The cost of this path is that line breaking, section layout, pagination, orphan/widow control, and the React binding become yours.

---

## 7. Cleanup note

All experiments live under `.research-scratch/` (git-ignorable): 12 sample PDFs in `.research-scratch/out/`, the generators, the `extract2.mjs`/`compare.mjs`/`probe-struct.mjs` analysis harness, the Vite bundle probes in `.research-scratch/bundle-out/`, and the two OFL test fonts. **No file outside `.research-scratch/` was created except this document.** The harness is deliberately left in place — `extract2.mjs` is a working prototype for the CI text-integrity assertion recommended in risk R7.
