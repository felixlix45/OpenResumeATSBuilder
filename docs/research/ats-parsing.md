# What Actually Makes a Resume PDF Parse Correctly in an ATS

**Evidence review, compiled 2026-10-06.**
Method: primary sources only — ATS vendor documentation, parser library source code and API docs, PDF-library issue trackers with reproductions, and published research. Secondary listicles were used only as pointers to primary sources and are not cited as evidence.

**Honesty header.** A large fraction of the "ATS-friendly resume" canon is unverifiable, and a meaningful fraction of vendor documentation is behind JavaScript-rendered portals or login walls. Where I could not read the primary source, this document says **GATED** (page exists, body not readable) or **COULD NOT VERIFY — no source found**. Neither means "false"; it means "nobody has published evidence." Do not let a builder UI assert those things as facts.

---

## Executive summary

1. **"ATS rejection" is mostly not a parse failure.** The mechanism that actually removes candidates is (a) knockout/screening questions and required fields evaluated before a human looks, and (b) recruiter *search* over parsed fields that simply never surfaces the candidate. Parse failure is a real but narrower problem: it corrupts *where data lands*, not usually *whether the resume is seen at all*. Greenhouse's own doc says a failed parse still attaches the file and leaves the recruiter to type the details in manually ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)).

2. **The single most actionable, vendor-documented, testable constraint found in this review is a size cliff.** Greenhouse accepts uploads up to **100 MB** but *cannot parse resumes larger than 2.5 MB* ([upload formats](https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads), [parse failure](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)). A builder that embeds images or fonts can silently produce a file that uploads fine and parses as nothing.

3. **Reading order is a drawing-order problem, not a layout problem.** PDF text is emitted in the order the generator wrote drawing operators. Every mainstream extractor either follows that order or re-sorts by position — and position-sorting *interleaves two-column layouts*. Apache Tika's own API doc says sorting "can produce the wrong result (for example if there are 2 columns, the text will be interleaved)" ([Tika `PDFParserConfig`](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html)). PDFBox and Tika both default to **not** sorting ([PDFBox `PDFTextStripper`](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/PDFTextStripper.html)).

4. **Section detection is line-based and vocabulary-based, and the vocabulary is tiny.** The most concrete evidence available is parser *source code*: `pyresparser` matches a line only if one of its lowercased words appears in a hard-coded list — `experience`, `education`, `interests`, `professional experience`, `publications`, `skills`, `certifications`, `objective`, `career objective`, `summary`, `leadership`, plus `accomplishments`/`projects` for graduates ([constants.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/constants.py), [utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py)). **"Work Experience" matches. "Employment History" does not.** That is the sharpest single layout finding in this review, and it is a property of a class of parsers rather than of one product.

5. **Dates are the most format-fragile field.** The same parser extracts ranges with `(?P<fmonth>\w+.\d+)\s*(\D|to)\s*(?P<smonth>\w+.\d+|present)` and then *requires* `datetime.strptime(date, '%b %Y')` — i.e. `"Jan 2020"`. A numerically formatted range (`01/2020 – 03/2023`) can match the regex and then silently contribute **zero months** of experience because the parse fails.

6. **Ligatures are a real but over-attributed failure mode.** The classic Apache PDFBox report is exactly the folklore symptom — *"first becomes ?rst, classifier becomes classi?er, find becomes ?nd"* ([PDFBOX-860](https://issues.apache.org/jira/browse/PDFBOX-860)) — but that was fixed in 2010. Modern extractors keep the ligature codepoint rather than dropping it: PyMuPDF preserves ligatures in text output by default but disables that for *search* ([PyMuPDF Appendix 1](https://pymupdf.readthedocs.io/en/latest/app1.html)). So the real modern risk is `U+FB01 (ﬁ)` sitting where a literal `fi` is expected — a **normalization** problem, not a missing-text problem.

7. **ToUnicode is the root cause behind most "garbled text" reports**, and the industry fallback is genuinely ambiguous — one library's fix is another library's regression. See [PDFBOX-5790](https://issues.apache.org/jira/browse/PDFBOX-5790) (use the ToUnicode map, else identity) which immediately caused the regression [PDFBOX-6022](https://issues.apache.org/jira/browse/PDFBOX-6022) "Wrong glyphs since PDFBOX-5790".

8. **Third-party parsing engines are the real target.** Bullhorn documents that its 2026 parser "incorporates **Textkernel** technology", adds image-to-text for scans, and improves "column-based layouts" ([Bullhorn parsing updates](https://kb.bullhorn.com/ats/Content/BHATS/Topics/parsingUpdates.htm)). Sovren is now part of Textkernel ([sovren.com](https://sovren.com/)). Much classic "Sovren-documented" ATS folklore therefore describes one engine family, not the whole market.

9. **Almost everything about margins, font size and font family has no parsing evidence at all.** Digital text extraction reads glyph IDs and coordinates from the content stream; it is resolution- and size-independent. Those rules matter for OCR (where Bullhorn's Greenhouse-listed "uploaded as an image" case applies) and for humans — not for a digitally generated PDF. Marked **FOLKLORE** in the table below.

---

## Findings — Question 1: how major ATS actually ingest resumes

### Summary table

| Platform | Documented accepted formats | Vendor documents parsing? | Notes |
|---|---|---|---|
| Workday | **GATED** | Yes — "Concept: Resume Parsing" | Body behind doc portal |
| Oracle Taleo | Partial | Yes — plain-text paste parsing | Attachment type list in Recruiting guide |
| iCIMS | **GATED** (community login) | Not verified from vendor | Only secondary guides found |
| SAP SuccessFactors | **GATED** (JS-rendered help) | Yes — two named help pages | — |
| Greenhouse | `.doc .docx .pdf .rtf .txt`, ≤100 MB | **Yes, in detail** | Parse cap 2.5 MB |
| Lever | Not verified | Not verified | Only product-fix notes found |
| Ashby | Not verified | Not verified | API endpoint exists |
| SmartRecruiters | Not verified | Not verified | Developer docs exist |
| Bullhorn | `PDF, .doc, .docx, .rtf, .txt, HTML` | **Yes, in detail** | Uses Textkernel |
| Jobvite | Not verified | Not verified | Field-mapping attachment found |
| BambooHR | Not verified | Not verified | Help article exists, JS-rendered |

### Workday

Workday documents resume parsing as a first-class concept: **"Concept: Resume Parsing"** in the HCM Administrator Guide, under Recruiting → Candidates → Set Up Prospects and Candidates ([doc.workday.com](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html)). Workday also documents **"Concept: Candidate Skills Match"** ([doc.workday.com](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/candidate-skills-match/bmj1604095304483.html)). The page bodies render client-side and returned only navigation chrome on fetch — **GATED**. I could not verify a public list of accepted resume file types for the Workday application flow. Treat any specific Workday format claim you see elsewhere as unverified unless it cites a Workday Community or administrator-guide page that renders.

### Oracle Taleo

Oracle documents a parsing path directly: **"Plain Text Resume Parsing for Mobile Devices"** — "The system parses the pasted text and the information is used to pre-populate the job application or candidate file," and the pasted text is stored as a `.txt` attachment. It is gated behind a setting, **"Resume pasting enabled"**, configured at *Configuration > [Career Section] Administration > Application Flows > Resume Upload block* ([Oracle Docs](https://docs.oracle.com/en/cloud/saas/taleo-enterprise/23c/otcug/c-plaintextresumeparsingmobile.html)). Attachment handling is documented in the Recruiting fundamentals guide ([Oracle Docs](https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrcg/recruiting-fundamentals.html)) — page not read in this session.

### iCIMS

No public, indexable iCIMS parsing documentation was reachable: the vendor knowledge base is `community.icims.com`, which requires authentication. Third-party "iCIMS parser" guides exist in quantity but none cite an iCIMS document, so they are unusable as evidence. **COULD NOT VERIFY** the format list or parser behaviour from a primary source. One adjacent primary-ish source is Indeed's partner documentation for the iCIMS integration, which maps iCIMS application fields ([docs.indeed.com](https://docs.indeed.com/install-guides/icims/reference/data-mapping)).

### SAP SuccessFactors

SAP publishes two relevant help pages: **"Working with Resume Parsing"** and **"Configuring Resume Parsing"**, both in *Setting Up and Maintaining SAP SuccessFactors Recruiting* ([help.sap.com](https://help.sap.com/docs/successfactors-recruiting/setting-up-and-maintaining-sap-successfactors-recruiting/working-with-resume-parsing), [help.sap.com](https://help.sap.com/docs/successfactors-recruiting/setting-up-and-maintaining-sap-successfactors-recruiting/configuring-resume-parsing)). Both render client-side and returned an empty shell on fetch — **GATED**. SAP also publishes the admin PDF ([SF_RCM_Admin.pdf](https://help.sap.com/doc/ffb88b2705684ab0be068897766d72de/latest/en-US/SF_RCM_Admin.pdf)), which is the right place to read the body. Parsing is real and configurable; specific format support is unverified here.

### Greenhouse — the most documented of the set

Accepted candidate uploads are **`.doc`, `.docx`, `.pdf`, `.rtf`, `.txt`**, "up to **100 MB**" ([Greenhouse Support](https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads)). Parsing is documented as auto-fill: "Greenhouse Recruiting scans an imported resume and auto-fills appropriate fields with information it detects" ([Greenhouse Support](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)).

The same article is the single best vendor-authored list of what breaks parsing — quoted verbatim:

- "A resume with **spaces between the letters**. While it may appear cohesive to the naked eye, the parser won't recognize the separate letters as a single word"
- "Resumes that include **graphics, photos, or word art**"
- "Resumes that are uploaded as an **image**, rather than a document"
- "Complex resumes with **tables, headers, and footers**"
- "Resumes with the **name and contact information in the header, footer, or text box**"
- "Resumes that have a **columned layout**"
- "Resumes **without clear sections** and differing formats throughout each section"
- "**Company names that don't include identifying words such as Inc., Co., LTD, or LLC.**"
- "Resumes with **incomplete job titles**. For example, *Sr. Account Exec* instead of *Senior Account Executive*"

Two further limits matter: parsing fails above **2.5 MB**, and "fake resumes" (test data such as `Company 1`, `Client 1`, `employee 1`) are *deliberately* skipped by the parser. Full parsing is available in 28 named languages ([Greenhouse Support](https://support.greenhouse.io/hc/en-us/articles/205019689-Resume-parsing-with-non-English-languages)).

### Lever, Ashby, SmartRecruiters, Jobvite, BambooHR

For these five I found the canonical primary surfaces but could not read substantive parsing guidance:

- **Lever** — `help.lever.co` exists and is indexed, but searches surfaced only *Lever Product Fixes* release notes ([help.lever.co](https://help.lever.co/s/article/Lever-Product-Fixes---July-2026)), not a parsing article. **Not verified.**
- **Ashby** — the knowledge base has `candidate-files-and-file-categories` ([docs.ashbyhq.com](https://docs.ashbyhq.com/candidate-files-and-file-categories), JS-rendered) and the public API exposes `candidate.uploadResume` ([developers.ashbyhq.com](https://developers.ashbyhq.com/reference/candidateuploadresume)). The existence of a dedicated resume-upload endpoint proves ingest-side handling; parse behaviour is **not verified**.
- **SmartRecruiters** — public developer docs exist ([Post an Application](https://developers.smartrecruiters.com/docs/post-an-application), [Create Candidate](https://developers.smartrecruiters.com/reference/createcandidate-1)). Parse behaviour **not verified**.
- **Jobvite** — a field-mapping reference attachment exists on the help site ([help.jobvite.com](https://help.jobvite.com/hc/en-us/article_attachments/22439739743901)). Parse behaviour **not verified**.
- **BambooHR** — the help article "What file formats does BambooHR support?" exists ([help.bamboohr.com](https://help.bamboohr.com/s/article/588048)) but is JS-rendered. **Not verified.**

### Bullhorn — the most concrete ingest documentation found

Bullhorn's parser supports **PDF, Microsoft Word (`.doc`, `.docx`), Rich Text Format (`.rtf`), plain text (`.txt`), and HTML**, with three ingest paths: drag-and-drop, a dedicated email inbox, and a documented REST endpoint `POST /resume/parseToCandidate` ([Bullhorn Hub](https://kb.bullhorn.com/ats/Content/BHATS/Topics/resumeParsingBHATS.htm), [REST API reference](https://bullhorn.github.io/rest-api-docs/#post-resume-parsetocandidate)).

The documented extracted field set is the concrete answer to "what does the parser actually produce": Name, Current Company, Job Title, Email 1, Primary/Work/Cell Phone, Address, Category (the parser "tries to match the job title to an existing category"), Skills, Professional Overview/Resume, Education, Work History. Degree fields (`educationDegree`, `degreeList`) are explicitly listed as **remaining empty** — i.e. even a good parse does not populate everything ([Bullhorn Hub](https://kb.bullhorn.com/ats/Content/BHATS/Topics/automaticResumeParser.htm)). Bullhorn also exposes a **Confidence Percentage** "calculated using an internal algorithm based on the amount and quality of data successfully extracted" — the strongest available proof that vendors treat parsing as probabilistic, not binary.

The 2026 upgrade page is the highest-signal vendor statement in this whole review ([Bullhorn Hub](https://kb.bullhorn.com/ats/Content/BHATS/Topics/parsingUpdates.htm)): the new parser "incorporates Textkernel technology"; adds "**Image-to-text capabilities**" for scanned documents; improves "**Support for column-based layouts**" ("Resume designs with multiple columns are parsed more accurately"); reports "**Up to 40% more skills** are now identified"; and notes it "handles a wider variety of PDFs generated by third-party tools, resolving many previous compatibility issues." Every one of those bullets is a vendor concession that the *previous* parser handled these cases badly.

---

## Findings — Question 2: extraction stacks and their failure modes

### 2.1 Text is a drawing operation, and its order is the generator's choice

PDF text lives in a page content stream as text-showing operators; the extractor walks that stream in order. PyMuPDF states the consequence plainly: `extractText()` "extracts a page's plain **text in original order as specified by the creator of the document**… The output may not equal an accustomed 'natural' reading order," and offers `sort=True` to reorder "top-left to bottom-right" ([PyMuPDF Appendix 1](https://pymupdf.readthedocs.io/en/latest/app1.html)).

Non-text operators are structurally different objects, not text. In `pdfminer.six`, path-painting (`m`/`l`/`c`/`re`) is routed by `PDFLayoutAnalyzer.paint_path` into `LTLine`, `LTRect` and `LTCurve` objects, and `TextConverter.paint_path` is a **no-op** — vector outlines produce no extractable text at all ([converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py)).

### 2.2 The stacks, per library

| Library | Ordering control | Space/word reconstruction | Unicode fallback |
|---|---|---|---|
| **Apache PDFBox** | `setSortByPosition` — **default false** | `spacingTolerance`, `averageCharTolerance` ("determined from trial and error"), `setEnableAutoSpace` | ToUnicode → predefined CMap → identity (PDFBOX-5790) |
| **Apache Tika** | wraps PDFBox; `PDFParserConfig.setSortByPosition` — **default false** | `setEnableAutoSpace` (default true), `setIgnoreContentStreamSpaceGlyphs` | delegates to PDFBox; OCR is opt-in |
| **pdfminer.six** | `LAParams.boxes_flow` (default `0.5`); `None` disables layout analysis | `char_margin=2.0`, `word_margin=0.1`, `line_margin=0.5`, `line_overlap=0.5` | `PDFUnicodeNotDefined` → literal `(cid:N)` string |
| **PyMuPDF (MuPDF)** | original order by default; `sort=True` to reorder | `TEXT_INHIBIT_SPACES` flag exists because space handling is unreliable | "use CID instead of U+FFFD" flag **on by default** |
| **pdf.js** | DOM/text-layer order | — | falls back to the font's `name` table to infer encoding |

Sources: [PDFBox `PDFTextStripper` javadoc](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/PDFTextStripper.html), [Tika `PDFParserConfig` javadoc](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html), [pdfminer.six `layout.py`](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/layout.py), [pdfminer.six `converter.py`](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py), [PyMuPDF Appendix 1](https://pymupdf.readthedocs.io/en/latest/app1.html), [pdf.js commit 9d3fe14](https://github.com/mozilla/pdf.js/commit/9d3fe143c29eeed06e442bac7706b900fa8f7470).

Notable divergences that matter in practice:

- **Sorting is a coin flip.** Tika's own doc: sorting "may be necessary for some PDFs (if the text tokens are not rendered 'in order'), while for other PDFs it can produce the wrong result (for example if there are 2 columns, the text will be interleaved). Default is false."
- **PDFBox and Tika disagree on duplicate suppression.** PDFBox's `PDFTextStripper` "will attempt to remove text that overlaps each other. Word paints the same character several times in order to make it look bold" — default on. Tika's `setSuppressDuplicateOverlappingText` defaults **off**, with an explicit warning that enabling it "can slow down extraction substantially (PDFBOX-956) and sometimes remove characters that were not in fact duplicated (PDFBOX-1155)."
- **Layout analysis is tuned, not specified.** `pdfminer.six`'s `LAParams` docstring defines `boxes_flow` as controlling "how much a horizontal and vertical position of a text matter when determining the order of text boxes… from -1.0 (only horizontal position matters) to +1.0 (only vertical position matters)," default `0.5`. Line and word grouping are geometric thresholds (`char_margin` relative to character width, `word_margin` relative to width). A space is inserted by `LTTextLineHorizontal.add` only when the gap exceeds `word_margin * max(char.width, char.height)`.
- **Tagged PDF is not the default path.** Tika's `setExtractMarkedContent`: "If the PDF contains marked content, try to extract text and its marked structure. If the PDF does not contain marked content, backoff to the regular PDF2XHTML… As of 1.24, this is an 'alpha' version." Tagging your output PDF buys little.

### 2.3 Glyph-to-Unicode (ToUnicode CMap)

**The failure, documented by a library maintainer.** PDFBOX-5790: a user reported that content `<004200430044> Tj` rendered as "BCD" everywhere (Acrobat, Chrome, qpdfview, `pdftotext`) but extracted as **"abc"** from PDFBox. Maintainer Andreas Lehmkühler: *"It turns out that the given ToUnicode CMap is incomplete and doesn't provide any valid mapping. The current implementation uses a possible predefined CMap in such cases. The given pdf uses Adobe-Japan1 which produces a wrong mapping. Some tests reveals that it is a good idea to strictly follow the spec in such cases: use the provided ToUnicode CMap. If it doesn't produce any valid mapping, use identity mapping."* The reporter explicitly frames it against **"9.10.2 Mapping character codes to Unicode values (ISO 32000-2:2020)"** ([PDFBOX-5790](https://issues.apache.org/jira/browse/PDFBOX-5790)). The fix immediately produced a regression — [PDFBOX-6022 "Wrong glyphs since PDFBOX-5790"](https://issues.apache.org/jira/browse/PDFBOX-6022) — which is the honest state of the art: when a font's ToUnicode map is wrong or absent, there is no correct answer, only trade-offs.

**The `(cid:N)` symptom, at source level.** `pdfminer.six` `PDFLayoutAnalyzer.render_char` calls `font.to_unichr(cid)`; on `PDFUnicodeNotDefined` it calls `handle_undefined_char`, whose entire body is:

```python
def handle_undefined_char(self, font: PDFFont, cid: int) -> str:
    log.debug("undefined: %r, %r", font, cid)
    return f"(cid:{cid})"
```

So a PDF whose embedded subset font lacks a usable ToUnicode map can extract as literal text containing `(cid:123)` tokens — text that looks like text, survives every "is the text extractable?" check, and destroys keyword matching. ([converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py))

**Other libraries' fallbacks.** PyMuPDF's default flags table shows "use CID instead of U+FFFD" enabled for all text output variants; pdf.js has a dedicated commit to "Fallback to using the `name` table to infer the encoding for TrueType" fonts. Both confirm that the no-ToUnicode case is handled by *guessing*.

**Identity-H vs WinAnsi — what is actually verified.** Identity-H is a composite (Type 0) encoding whose codes are CIDs, not character codes; Unicode therefore depends on the ToUnicode map. WinAnsi is a simple-font encoding with predefined code→character semantics and a well-known fallback. The practical consequence — Identity-H subset fonts are the ones that produce garbage when ToUnicode is missing — is consistent with PDFBOX-5790's `Adobe-Japan1` case and with `(cid:N)`, but I did **not** read the PDF specification directly in this session (**COULD NOT VERIFY** spec section numbering beyond the ISO 32000-2 §9.10.2 reference quoted by the PDFBox maintainer). Treat the encoding taxonomy as well-established background rather than a cited finding here. The relevant open issue for multi-character mappings is tracked by the PDF Association at [pdf-issues #462](https://github.com/pdf-association/pdf-issues/issues/462).

### 2.4 Ligatures

Three distinct situations get conflated in resume advice:

1. **The glyph is dropped.** The classic report is [PDFBOX-860](https://issues.apache.org/jira/browse/PDFBOX-860): *"Combination of the characters 'fi' is converted to a '?' — example: first becomes ?rst, classifier becomes classi?er, find becomes ?nd."* Filed 2010 against PDFBox 1.2.1, resolved and closed. This is where the folklore comes from; it describes a bug fixed over fifteen years ago.
2. **The glyph survives as a single Unicode ligature codepoint (`ﬁ` U+FB01, `ﬂ` U+FB02).** This is the modern, real risk. PyMuPDF's flag table shows "preserve ligatures" enabled for `text`, `html`, `dict`, `rawdict`, `words` and `blocks` output, but **disabled** for `search` — i.e. the library deliberately normalizes ligatures on the search path and deliberately does not on the extraction path ([PyMuPDF Appendix 1](https://pymupdf.readthedocs.io/en/latest/app1.html)). A downstream consumer that does a naive substring match for `"fi"` against extracted text will miss it unless it normalizes (NFKC/NFKD) or folds U+FB01→fi.
3. **The glyph is fine because ToUnicode maps it to two characters.** This is the nuance that matters most: if the ligature glyph's ToUnicode entry maps to the string `"fi"`, extraction is *perfect*. Ligature breakage is therefore a property of the font/ToUnicode pair, not of ligatures as such. The PDF Association's open issue on "pertinent entries" in ToUnicode CMaps is the place this gets litigated ([pdf-issues #462](https://github.com/pdf-association/pdf-issues/issues/462)).

**Practical rule for a generator:** emit ligatures only if your font subsetter writes a ToUnicode entry mapping each ligature glyph to its component letters, or disable ligatures entirely (CSS `font-variant-ligatures: none`) — the latter is free and removes the entire class of risk.

### 2.5 Non-extractable text

- **Outlines/curves.** Confirmed at source level: path operators become `LTCurve`/`LTRect`/`LTLine`, and the plain-text converter ignores paths entirely ([converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py)). Text converted to outlines is invisible to every text extractor.
- **Images.** Images are separate XObject streams; extractors surface them as images, not text. Tika warns that enabling extraction is hazardous and lossy: *"some PDF documents of modest size (~4MB) can contain thousands of embedded images totaling > 2.5 GB… this extracts the raw images without clipping, rotation, masks, color inversion, etc. The images that this extracts may look nothing like what a human would expect"* ([Tika `PDFParserConfig`](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html)). OCR is explicitly opt-in (`ocrStrategy`, `ocrRenderingStrategy` — "do you want to include the rendering of the electronic text, ALL, or do you only want to run OCR on the images and vector graphics (NO_TEXT)?").
- **OCR is not universal in ATS.** Greenhouse lists image uploads as a parse-failure cause. Bullhorn only gained image-to-text in the 2026 Textkernel-based parser. Both are vendor statements that scanned/image resumes were historically a dead end.
- **Annotation and form text land in the wrong place.** Tika extracts annotation text by default, and `setExtractAcroFormContent` "extract[s] content from AcroForms **at the end of the document**." If a resume builder renders a "text box" as a form field or annotation, its content is appended after the entire body — out of section order. This is the mechanism behind Greenhouse's "name and contact information in the header, footer, or text box" failure.

### 2.6 Whitespace, line breaks, and why they decide section detection

Extractors do not preserve whitespace; they *reconstruct* it from geometry:

- pdfminer.six inserts a space when the horizontal gap exceeds `word_margin × max(char width, char height)`, with `word_margin = 0.1` by default; line grouping uses `char_margin = 2.0` and paragraph grouping `line_margin = 0.5` ([layout.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/layout.py)).
- PDFBox's `spacingTolerance` and `averageCharTolerance` are "determined from trial and error"; `setIgnoreContentStreamSpaceGlyphs` exists because some generators place spaces as positioned glyphs that then overlap the geometric heuristic (PDFBOX-3774).
- Tika: "If true (the default), the parser should estimate where spaces should be inserted between words. **For many PDFs this is necessary as they do not include explicit whitespace characters.**"

**Why this breaks headings specifically.** `pyresparser`'s section extractor splits raw text on `'\n'`, tests each line's lowercased word set against the heading vocabulary, and assigns every subsequent non-empty line to the most recent matched heading. It is a strictly line-ordered state machine. If line breaks are wrong (columns interleaved, a heading merged with the following line, a heading split across two lines), then not only is the heading missed — **every field after it is attributed to the wrong section**. This is the mechanistic reason column layout and "text box" content matter so much more than their visual footprint suggests.

### 2.7 Generated-PDF specifics

The evidence here is the *concession*, not a benchmark. Bullhorn's own upgrade notes state the new parser "handles a wider variety of PDFs **generated by third-party tools**, resolving many previous compatibility issues, and generally preserves formatting more accurately" ([Bullhorn Hub](https://kb.bullhorn.com/ats/Content/BHATS/Topics/parsingUpdates.htm)). That is a vendor confirming that generator-specific PDF output was a first-order failure source. No vendor publishes a per-generator pass/fail table; I found none, and any such table on the open web is unsourced. **COULD NOT VERIFY** comparative generator quality for WeasyPrint / wkhtmltopdf / Chrome-Skia / ReportLab / jsPDF / LaTeX. The defensible engineering answer is not "pick generator X" but "test your own output against the checklist at the end of this document."

---

## Findings — Question 3: concrete, testable layout rules

### 3.1 Single column vs two column — **strong evidence**

- Vendor-documented failure: Greenhouse lists "Resumes that have a **columned layout**" among resume-formatting causes of parse failure ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)).
- Library-documented mechanism: Tika — sorting by position "can produce the wrong result (for example if there are 2 columns, the text will be interleaved)" ([Tika](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html)); the historical reproduction is [TIKA-611](https://issues.apache.org/jira/browse/TIKA-611), where a colleague reported "parsing articles (pdfs with columns/beads)… The text is not in the write order as it intermixes text from different beads."
- Vendor conceding it was a problem: Bullhorn's 2026 parser improves "Support for column-based layouts: Resume designs with multiple columns are parsed more accurately" ([Bullhorn](https://kb.bullhorn.com/ats/Content/BHATS/Topics/parsingUpdates.htm)).

**Verdict:** two columns are not *guaranteed* to fail, but the failure mode is well-documented, vendor-acknowledged, and directly damages section assignment. A conservative builder should default to one column.

### 3.2 Tables — **strong evidence, weaker mechanism detail**

Greenhouse: "Complex resumes with **tables**, headers, and footers" ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)). None of PDFBox, Tika or pdfminer.six performs table reconstruction in their default text paths — table extraction requires a separate layer (pdfplumber, Camelot). ATS parsers are documented as extracting *fields* (Bullhorn's list), not cells, so table structure is simply lost. **Verdict: avoid tables for content that must be mapped to fields.** A single-column list is the safe substitute.

### 3.3 Headers, footers, text boxes — **strong evidence**

Greenhouse names all three explicitly: "Resumes with the name and contact information in the **header, footer, or text box**" ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)). Mechanism: `PDFTextStripper` has no header/footer suppression. It has `setStartPage`/`setEndPage`, `setStartBookmark`/`setEndBookmark`, and `setSuppressDuplicateOverlappingText` — and the last of these is documented as able to "remove characters that were not in fact duplicated" (PDFBOX-1155). Repeated headers therefore appear at *every* page boundary in the extracted text. For text boxes, see §2.5: AcroForm content is appended "at the end of the document," and annotation text is merged in-line but positionally.

**Verdict:** contact details belong in the body flow of page 1. This is one of the few layout rules with direct vendor evidence.

### 3.4 Images, icons, graphics, skill bars — **strong evidence for images; inference for bars**

Greenhouse lists "graphics, photos, or word art" ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)). Images are provably not text (§2.5). Skill bars are a rectangle (an `LTRect` in pdfminer's model) plus whatever label text is drawn beside it — at best the parser sees the label and an orphaned number with no relationship to it. **Verdict:** icons are harmless *if* the adjacent label is real text; a skill bar communicates nothing to a parser.

### 3.5 Margins, font size, font family — **no parsing evidence; treat as folklore**

I found **no** ATS vendor, parser vendor or library documentation asserting a minimum margin, minimum font size, or permitted font family as a *parsing* requirement. The mechanism argues against it: text extraction reads glyph IDs and coordinates, so it is size- and resolution-independent. The only genuine couplings are: (a) pdfminer's `word_margin` scales with character width and height, so pathologically small text could shift space insertion; (b) font *encoding* matters enormously even though font *family* does not. **These rules are real for humans and for OCR; they are not parser constraints for digitally generated PDFs.**

### 3.6 Section heading naming — **the strongest single finding**

Concrete, source-level evidence of what strings are recognized. `pyresparser` matches a heading line when the intersection of its lowercased whitespace-split words with a hard-coded set is non-empty ([constants.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/constants.py), [utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py)):

```
RESUME_SECTIONS_PROFESSIONAL = [
    'experience', 'education', 'interests', 'professional experience',
    'publications', 'skills', 'certifications', 'objective',
    'career objective', 'summary', 'leadership'
]
RESUME_SECTIONS_GRAD = RESUME_SECTIONS_PROFESSIONAL + ['accomplishments', 'projects']
```

Because matching is **token-level set intersection**, not phrase matching:

| Heading | Matches? | Why |
|---|---|---|
| `Work Experience` | ✅ | token `experience` |
| `Professional Experience` | ✅ | exact phrase present |
| `Experience` | ✅ | exact |
| `Employment History` | ❌ | no token in the vocabulary |
| `Relevant Experience` | ✅ | token `experience` |
| `Work History` | ❌ | no token in the vocabulary |
| `Career Summary` | ✅ | token `summary` |
| `About Me` | ❌ | no token |
| `Technical Skills` | ✅ | token `skills` |
| `Core Competencies` | ❌ | no token |
| `Certifications & Licenses` | ✅ | token `certifications` |

This is one parser, and commercial parsers are certainly broader — but Greenhouse's independent statement that "resumes **without clear sections** and differing formats throughout each section" fail to parse ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)) is consistent with section vocabularies being a real constraint. **Verdict: use the conventional strings; "Employment History" and "Work History" are the two most common conventional-looking headings with no vocabulary support in the only parser I could inspect.**

On formatting cues: I found **no** evidence that parser-side heading detection uses font size, weight or all-caps in the PDF path. `pyresparser` uses none. (Style-based heading detection does exist on the DOCX path as a general technique, but no ATS vendor documents using it.)

### 3.7 Dates — **strong, source-level evidence**

The same parser's date handling is fully inspectable ([utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py)):

```python
experience = re.search(
    r'(?P<fmonth>\w+.\d+)\s*(\D|to)\s*(?P<smonth>\w+.\d+|present)', line, re.I)
...
date1 = datetime.strptime(str(date1), '%b %Y')
date2 = datetime.strptime(str(date2), '%b %Y')
```

Consequences, each of which is a testable layout rule:

- **`"Jan 2020"` / `"January 2020"` works.** Month names longer than three characters are truncated to their first three before parsing (`date1[0][:3] + ' ' + date1[1]`).
- **`"2020-01"` does not match at all.** `\w+.\d+` requires at least one word character followed by any character followed by digits; there is no month name to normalize. The range is never seen.
- **`"01/2020"` matches the regex but yields zero.** `strptime("01/2020", "%b %Y")` raises `ValueError`, which is caught and `return 0`. This is the dangerous case: the resume *looks* fine and the computed experience silently becomes 0 months.
- **The range separator is permissive here.** `(\D|to)` accepts any single non-digit or the literal `to`, so hyphens, en dashes and em dashes all work *for this parser*. I found **no** evidence that en dash (U+2013) breaks this class of parser — the en-dash folklore is **unverified**.
- **`"Present"` is a recognized end token.**

Related date vocabulary in the same module: `MONTHS_SHORT`/`MONTHS_LONG` regexes and `YEAR = r'(((20|19)(\d{2})))'` — i.e. **two-digit years and pre-2000 years are outside the vocabulary**. `"Jan 99"` or `"Jan 1999"`→ works via the `19` branch; `"Jan 99"` does not.

**Ambiguity of `03/04/2020` (March 4 vs April 3):** **COULD NOT VERIFY** — no parser or vendor documentation found addressing locale-ambiguous numeric dates. The safe rule is to avoid ambiguity entirely by spelling the month.

### 3.8 Job title vs company vs location disambiguation — **strong evidence for the heuristics, from the vendor**

Greenhouse documents both halves of the disambiguation directly ([Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse)):

- **Company detection uses legal-entity suffixes.** Failure cause listed: "Company names that don't include identifying words such as **Inc., Co., LTD, or LLC**." The parser is using those tokens as an employer-name signal.
- **Job title detection uses a canonical-title expectation.** Failure cause listed: "Resumes with **incomplete job titles**. For example, *Sr. Account Exec* instead of *Senior Account Executive*." The parser expects expandable, canonical titles.

Bullhorn adds that the parser "tries to match the job title to an existing category" and that `categoryID` "defaults to a value representing 'Other(s)' if no category can be derived from the candidate's occupation" ([Bullhorn](https://kb.bullhorn.com/ats/Content/BHATS/Topics/automaticResumeParser.htm)) — i.e. titles are mapped onto a taxonomy.

**Not verified:** whether any ATS uses O\*NET as its title gazetteer. **COULD NOT VERIFY.**

### 3.9 Bullet characters — **weak evidence, low risk**

- The only source-level artifact found is in `pyresparser`: a commented-out block that keys experience entries on `u'\u2022'` (U+2022 BULLET) — evidence that U+2022 is the assumed default, though the code is commented out in current master ([utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py)).
- PDFBox has first-class list handling: `getListItemPatterns()` "returns a list of regular expression Patterns representing different common list item formats," configurable via `setListItemPatterns` ([PDFTextStripper javadoc](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/PDFTextStripper.html)). I did not read the default pattern list, so I cannot state which characters are covered.
- **Does a bullet break keyword matching?** I found **no** evidence that `"•Python"` fails where `"Python"` succeeds. The plausible, unproven risk is a bullet drawn from a **symbol font without a ToUnicode map**, which would yield `(cid:N)` or U+FFFD rather than `•`. That is a mechanism, not a documented outcome → **WEAK**.

**Verdict:** use a real Unicode bullet (U+2022) in a normal text font, or an ASCII hyphen. Avoid symbol/icon fonts and avoid literal asterisks as decorative glyphs (they read as footnote markers to humans).

### 3.10 What breaks multi-page parsing — **moderate evidence**

- **Repeated headers/footers are concatenated at every page boundary.** No extractor in the reviewed set removes them; Greenhouse lists headers/footers as a failure cause.
- **Page numbers inject digits into the text stream** ("Page 2 of 3"). No extraction-layer suppression exists.
- **Overlapping duplicated text can be silently deleted.** Tika's `setSuppressDuplicateOverlappingText` warning about "remove characters that were not in fact duplicated (PDFBOX-1155)" is the documented hazard for text drawn twice for faux-bold.
- **Orphaned headings.** A section heading landing at the foot of page 1 with content on page 2 breaks the line-ordered state machine described in §2.6. Bullhorn's automatic parser targets email attachments and multi-page documents without any documented page limit.
- **Repetition "for ATS":** no evidence found that duplicating a section across pages helps; it plausibly triggers dedup heuristics. **COULD NOT VERIFY.**

**Is there any parsing reason to prefer one page?** **No.** The only documented hard constraints are file size (Greenhouse: 2.5 MB parse cap, 100 MB upload cap). One page is a human-recruiter convention, not a parsing requirement.

### 3.11 Where contact information must live — **strong evidence**

Greenhouse: "Resumes with the name and contact information in the **header, footer, or text box**" is a documented parse-failure cause; and Bullhorn lists Name, Email and three phone fields among the extracted fields. **Verdict: name, email, phone, location must be in the main text flow of page 1, not in a page header, footer, or floating frame.**

---

## Findings — Question 4: content-level rules, and what is actually evidence

### 4.1 What actually filters candidates (the real mechanism)

Three mechanisms, in order of practical impact:

1. **Knockout / screening questions and required fields.** Evaluated at application time, before parsing is even consulted. This is the filter candidates experience as "auto-rejection."
2. **Recruiter search over parsed fields.** Bullhorn documents exactly which fields exist to be searched: Name, Current Company, Job Title, Email, Phones, Address, Category, Skills, Professional Overview/Resume, Education, Work History. A skill that the parser did not place in `Skills` may still exist in the free-text résumé blob but will not be a *structured* match.
3. **Parse failure that mis-lands data.** Greenhouse is explicit that a failed parse does not discard the candidate: the file is attached and "you'll need to manually input the candidate's details into the fields." Parse failure costs the candidate *visibility in filtered searches*, not the application itself.

The best available primary source on how large employers configure this filtering is the HBS / Accenture report **"Hidden Workers: Untapped Talent"** (Fuller, Raman, Sage-Gavin, Hines, 2021) — [PDF](https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf). **Caveat: I verified the canonical URL but the full-text PDF could not be fetched in this session (content-type rejected). I therefore do not quote it.** Its headline argument — that large employers' automated screening is configured with criteria that systematically exclude qualified candidates — is the most rigorous published support for "the filter is real"; the specifics should be read directly before being relied on.

### 4.2 The folklore audit

**(a) "75% of resumes are rejected by ATS before a human sees them."** No primary source exists. The claim circulates as a citation of a citation. The most substantive published treatment I located frames it as a statistic that recent surveys do not support — [Lenz, "ATS auto-rejecting resumes before human review is uncommon"](https://lenz.io/c/ats-applicant-tracking-system-75-percent-rejection-rate-bc6fd7d4). **Status: FOLKLORE.** Note the honest asymmetry: I could not *disprove* it either — there is simply no study.

**(b) "ATS auto-reject candidates."** Not supported by any vendor documentation reviewed. Every vendor doc read here describes parsing as *auto-fill into fields* and, on failure, *manual entry*. **Status: FOLKLORE** in its strong form; the real mechanism is (1) above.

**(c) "Recruiters spend 6–7 seconds on a resume."** Traces to TheLadders' eye-tracking study, published as a PDF titled *TheLadders EyeTracking Study* ([theladders.com PDF](https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf)), summarized by the vendor as "You have 7.4 seconds to make an impression" ([TheLadders](https://www.theladders.com/career-advice/you-only-get-6-seconds-of-fame-make-it-count/)). **Caveat: the PDF returned HTTP 403 from my region, so I could not verify the sample size or methodology directly.** A single-vendor, small-N eye-tracking study is not a general law, and it says nothing about parsers. **Status: WEAK EVIDENCE, and irrelevant to parsing.**

**(d) "Quantified achievements get X% more interviews."** **No source found. Status: FOLKLORE (unverifiable).** Note the distinction: it is uncontroversial *editorial* advice that specific numbers are more persuasive to a human reader. There is no measured interview-rate effect, and there is no parsing mechanism by which a number helps.

**(e) "Keyword density / repeat keywords N times."** **No source found. Status: FOLKLORE.** Modern search is not bag-of-words scoring with a density threshold; no vendor documentation reviewed describes density weighting.

**(f) "Acronym expansion helps the parser."** **COULD NOT VERIFY.** No ATS or parser documentation was found stating that parsers normalize `B.S.` ↔ `Bachelor of Science` or `PMP` ↔ `Project Management Professional`. Bullhorn's parser does map job titles to a "category" taxonomy and extracts up to 40% more skills with the Textkernel engine, which implies *some* normalization, but no documented acronym equivalence table was found. Acronyms almost certainly matter more on the **recruiter-search** side (a recruiter searching `"PMP"` will not match a resume that only says "Project Management Professional"). Textkernel markets a "Skills Intelligence" product but I could not read specification-level documentation for it ([textkernel.com](https://www.textkernel.com/resume-parsing-ocr-addon/)).

**(g) "Use .docx, not .pdf" (or the reverse).** **COULD NOT VERIFY as a parsing claim.** Greenhouse and Bullhorn both accept `.doc`, `.docx`, `.pdf`, `.rtf`, `.txt` for parsing — there is no vendor statement preferring one. The most defensible position is that the *content* of the format matters far more than the container: a DOCX has an explicit text layer and paragraph styles, a generated PDF's text layer depends entirely on the generator's ToUnicode output. Send the format that your builder controls best, and test it.

**(h) "Stick to standard fonts."** **Status: FOLKLORE for parsing; TRUE for humans.** Font *family* has no documented parsing effect. Font *encoding* (subset + ToUnicode) is decisive.

**(i) "No special characters."** **WEAK but mechanistically plausible.** Extractors do strip characters: `pdfminer.six`'s XML converter defines `CONTROL = re.compile("[\x00-\x08\x0b-\x0c\x0e-\x1f]")` and removes them when `stripcontrol` is set; `pyresparser` defines `NOT_ALPHA_NUMERIC = r'[^a-zA-Z\d]'` ([converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py), [constants.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/constants.py)). Decorative glyphs from symbol fonts risk the no-ToUnicode path described in §2.3.

**(j) "Name the file professionally."** **No evidence found. Status: FOLKLORE (harmless).**

**(k) Section ordering (Experience before Education).** **No parsing evidence found.** Parsers with a heading state machine (§3.6) are order-agnostic as long as headings are recognized; `pyresparser` has separate vocabularies for graduate (adds `projects`, `accomplishments`) and professional resumes, which is about *content*, not order. Humans care; parsers do not. **Status: TRUE-FOR-HUMANS.**

**(l) Length / one page.** **No parsing evidence.** Only file-size limits are documented. **Status: TRUE-FOR-HUMANS.**

**(m) Photos.** **Strong for parsing (an image is not text); NOT VERIFIED for bias.** Greenhouse lists "graphics, photos" as a parse-failure cause. Claims that photos cause bias-based rejection are plausible and widely believed, and anonymized/structured-hiring practice exists — but I found no primary source in this session quantifying it, and I will not assert it. **Status: FOLKLORE for the bias claim; STRONG for "a photo is unparseable data."**

### 4.3 "True for parsers" vs "true for humans" — the clean split

| Rule | For parsers | For humans |
|---|---|---|
| One column | **Real, documented** | Also real (readability) |
| No tables / text boxes / header-footer contact | **Real, documented** | Neutral |
| Conventional section headings | **Real, documented (vocabulary)** | Also real |
| Month-name dates (`Jan 2020`) | **Real, documented** | Also real (unambiguous) |
| Text, not images/outlines | **Real, documented** | Neutral |
| Real Unicode bullets in a text font | **Weak/theoretical** | Real (readability) |
| Quantified achievements | **No mechanism** | Plausible, unmeasured |
| Action verbs | **No mechanism** | Convention |
| One page | **No mechanism** | Real convention |
| Standard fonts | **No mechanism (family)**; encoding is what matters | Real |
| Photos | **Real (unparseable)** | Bias claim unverified |
| Keyword density | **No mechanism** | No mechanism |

---

## Claim confidence table

### Strong evidence — primary source, explicit, mechanism understood

| # | Claim | Source |
|---|---|---|
| S1 | Greenhouse accepts `.doc .docx .pdf .rtf .txt` up to 100 MB, but **cannot parse above 2.5 MB** | [upload](https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads) / [parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) |
| S2 | Greenhouse documents these as parse-failure causes: letter-spaced text; graphics/photos/word art; image uploads; tables/headers/footers; contact info in header/footer/text box; columned layout; no clear sections; company names without Inc./Co./LTD/LLC; incomplete job titles | [Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) |
| S3 | Position-sorting interleaves two-column layouts; Tika and PDFBox default to **not** sorting | [Tika](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html) / [PDFBox](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/PDFTextStripper.html) |
| S4 | Multi-column text intermixing was a real, reproduced failure | [TIKA-611](https://issues.apache.org/jira/browse/TIKA-611) |
| S5 | Missing/incorrect ToUnicode CMap produces wrong or garbage text; the fallback is inherently ambiguous and one fix caused a regression | [PDFBOX-5790](https://issues.apache.org/jira/browse/PDFBOX-5790) / [PDFBOX-6022](https://issues.apache.org/jira/browse/PDFBOX-6022) |
| S6 | pdfminer.six emits the literal string `(cid:N)` for unmappable glyphs | [converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py) |
| S7 | Vector outlines produce no extractable text (paths are not text objects) | [converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py) |
| S8 | Images are separate streams; OCR is an explicit opt-in with documented lossiness | [Tika](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html) |
| S9 | AcroForm content is extracted "at the end of the document," out of section order | [Tika](https://tika.apache.org/3.1.0/api/org/apache/tika/parser/pdf/PDFParserConfig.html) |
| S10 | PDFBox preserves ligatures by default but disables that for search — ligature handling is a normalization issue | [PyMuPDF Appendix 1](https://pymupdf.readthedocs.io/en/latest/app1.html) |
| S11 | Section headings are matched as a token-level intersection against a small hard-coded vocabulary; "Work Experience" matches, "Employment History" does not | [pyresparser constants.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/constants.py) / [utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py) |
| S12 | Date ranges are parsed as `"%b %Y"`; numeric formats silently contribute 0 months | [pyresparser utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py) |
| S13 | Employer detection keys on legal suffixes (Inc./Co./LTD/LLC); title detection expects canonical, expandable titles | [Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) |
| S14 | Bullhorn's parser extracts a fixed field set and reports a probabilistic Confidence Percentage; several fields (incl. degree fields) stay empty | [Bullhorn](https://kb.bullhorn.com/ats/Content/BHATS/Topics/automaticResumeParser.htm) |
| S15 | Bullhorn embeds Textkernel; the 2026 upgrade added OCR for scans and improved columns; generator-specific PDFs were a prior compatibility problem | [Bullhorn](https://kb.bullhorn.com/ats/Content/BHATS/Topics/parsingUpdates.htm) |
| S16 | Failed parses do not delete candidates — data is typed in manually | [Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) |
| S17 | Whitespace, line breaks and reading order are geometric heuristics with defaults, not spec-defined behaviour | [pdfminer layout.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/layout.py) / [PyMuPDF](https://pymupdf.readthedocs.io/en/latest/app1.html) |

### Weak evidence — real mechanism, but inferred, narrow, or single-source

| # | Claim | Source & caveat |
|---|---|---|
| W1 | Bullet character U+2022 is the assumed default bullet | [pyresparser utils.py](https://raw.githubusercontent.com/OmkarPathak/pyresparser/master/pyresparser/utils.py) — code is **commented out** in master |
| W2 | PDFBox models "common list item formats" as regexes | [PDFBox javadoc](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/PDFTextStripper.html) — default pattern list not read |
| W3 | Repeated page headers/footers concatenate into extracted text | Inference from the absence of any suppression API + [Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse); no direct reproduction cited |
| W4 | Symbol-font bullets may extract as `(cid:N)`/U+FFFD | Mechanism inferred from S6/S5; no bullet-specific report found |
| W5 | Special characters may be stripped | [pdfminer converter.py](https://raw.githubusercontent.com/pdfminer/pdfminer.six/master/pdfminer/converter.py) control-char regex applies only when enabled |
| W6 | DOCX may parse more reliably than PDF because it has an explicit text layer | No vendor statement found; reasonable mechanism only |
| W7 | 6–7 second recruiter attention span | [TheLadders study PDF](https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf) — **403 from my region; methodology unverified** |
| W8 | Large employers configure screening to exclude qualified candidates | [HBS "Hidden Workers: Untapped Talent"](https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf) — **URL verified, PDF body not read this session** |
| W9 | Some parsers normalize skills/titles into a taxonomy | [Bullhorn](https://kb.bullhorn.com/ats/Content/BHATS/Topics/automaticResumeParser.htm) documents title→category mapping; no acronym-level mapping found |

### Folklore — repeated widely, no verifiable primary source

| # | Claim | Note |
|---|---|---|
| F1 | "75% of resumes are rejected by ATS before a human sees them" | No originating study located; rebuttal framing at [Lenz](https://lenz.io/c/ats-applicant-tracking-system-75-percent-rejection-rate-bc6fd7d4) |
| F2 | "ATS auto-reject candidates" | Contradicted by vendor docs describing auto-fill + manual fallback |
| F3 | "Quantified achievements increase interviews by X%" | No study found |
| F4 | "Keyword density / repeat keywords N times" | No mechanism in any vendor doc reviewed |
| F5 | "Minimum 10–11 pt font / minimum 0.5–1 inch margins" for parsing | No parsing source found; real for humans/OCR only |
| F6 | "Use a standard font family" for parsing | Font family is not a parsing input; encoding is |
| F7 | "En dash breaks date parsing" | The one inspectable date regex accepts any non-digit separator |
| F8 | "One page, or the ATS truncates" | No page limit documented anywhere; only a file-size limit |
| F9 | "File name matters" | No source found |
| F10 | "Photos get you rejected" (bias mechanism) | Unverified here; the *parsing* claim (a photo is unparseable) is strong |
| F11 | "Acronyms must be expanded for the parser" | No parser-level acronym normalization documented |
| F12 | "Asterisk bullets confuse parsers" | No source found |

---

## Programmatically-testable ATS rule checklist

Each item is stated so a build step or test can decide pass/fail from the generated PDF plus its extracted text. **P** = priority (1 highest). All items are derived from the evidence above; the source column names the finding it enforces.

| # | P | Rule (assertion) | Test method | Enforces |
|---|---|---|---|---|
| 1 | 1 | **Text is extractable.** Extracted text length ≥ 60% of the source document's character count, and contains the candidate's name, email and phone. | Extract with ≥2 independent engines (e.g. PDFBox and pdfminer.six); compare against the builder's own text model. | S7, S8 |
| 2 | 1 | **No unmappable glyphs.** Extracted text contains no `(cid:`, no `U+FFFD` / `\uFFFD`, and no runs of `?` where letters are expected. | Regex scan of extracted text. | S5, S6 |
| 3 | 1 | **Every font has a usable ToUnicode map.** For each font in the PDF, a `/ToUnicode` stream exists and maps every glyph actually used on the page. | Walk the PDF object graph (e.g. `pikepdf`/`qpdf --json`); cross-check glyphs used in content streams against the CMap. | S5 |
| 4 | 1 | **File size is under the strictest known parse cap.** PDF ≤ 2.5 MB. | `len(bytes)`. | S1 |
| 5 | 1 | **Reading order equals visual order.** For every pair of text lines, if line A is visually above and left of line B with no horizontal overlap, A must precede B in extracted text. | Compare extracted token sequence to positions from a positional extractor (`get_text("words")`); assert monotonic top-to-bottom, left-to-right within each visual column band. | S3, S4, S17 |
| 6 | 1 | **Single column.** No vertical band contains text that is horizontally disjoint from a concurrent band. | Detect gutter: project text boxes onto the x-axis; assert no empty vertical gap ≥ 15% of page width spanning ≥ 30% of page height with text on both sides. | S2, S3, S4, S15 |
| 7 | 1 | **No content inside PDF annotations or form fields.** All visible text comes from page content streams, not Widget/AcroForm or annotation appearance streams. | Assert zero `/Widget` annotations with text, and `/AcroForm` absent or empty. | S9 |
| 8 | 1 | **Contact block is in the page-1 body flow,** not in a repeating region and not in a floating frame. | Extract per-page text; assert name+email appear on page 1 within the top 25% of the *page body*, and appear in the same order as the first body text block — not as a repeated string on every page. | S2, §3.11 |
| 9 | 1 | **Required section headings are recognized.** Each of Experience, Education, Skills (and any section the builder renders) uses a heading string from a recognized vocabulary. | Assert each rendered heading's lowercased token set intersects a maintained allow-list (`experience`, `education`, `skills`, `certifications`, `summary`, `projects`, `publications`, `objective`, …). Fail on `Employment History`, `Work History`, `Core Competencies`, `About Me`. | S11 |
| 10 | 1 | **Headings are standalone lines.** Each heading occupies its own extracted line, is not joined to the preceding or following line, and is not split across a page boundary. | Split extracted text on newlines; assert exact-match containment of each heading string as a full line. | S11, §2.6 |
| 11 | 1 | **Dates use spelled months.** Every date range matches `^(Jan|Feb|…|Dec)[a-z]* \d{4}\s*[–-]\s*((Jan|…)[a-z]* \d{4}|Present)$` (case-insensitive). | Regex over the builder's own structured data *and* over extracted text. | S12 |
| 12 | 1 | **No numeric-only dates.** Reject `MM/YYYY`, `YYYY-MM`, and two-digit years anywhere in experience/education dates. | Regex scan. | S12 |
| 13 | 1 | **Dates survive round-trip.** For each role, the parser-visible range yields a non-zero month count under a `"%b %Y"` parser. | Re-implement the pyresparser date parse over extracted text; assert total months > 0 and within ±1 month of the structured value. | S12 |
| 14 | 2 | **No ligature-broken keyword matches.** For every keyword K in the resume's keyword set, K is findable in the extraction after NFKC normalization, and also findable *without* normalization. | Search extracted text for each keyword both raw and NFKC-folded; flag any keyword that only matches after folding (means a ligature codepoint is present). Preferred fix: render with ligatures disabled. | S10 |
| 15 | 2 | **No images, outlines, or icon fonts carry required content.** Every string that must be findable appears as text drawn with a real font. | Assert zero `/Image` XObjects overlaying the text region; assert no Type3 fonts; assert every rendered string is present in extracted text. | S7, S8 |
| 16 | 2 | **Bullets are real Unicode text in a text font.** Bullet characters are drawn from the body font (not a symbol/icon font) and are one of `•` (U+2022), `-`, or `–`. | Inspect the font resource used for bullet glyphs; assert it is the same or a standard text font, and assert the extracted bullet character is in the allow-list. | W1, W2, W4 |
| 17 | 2 | **No tables.** No visible ruled grid or cell structure is used for content that maps to a field. | Assert no more than N horizontal/vertical rules (LTRect/LTLine) in the body region; alternatively, forbid the table layout primitive in the renderer for resume content. | S2 |
| 18 | 2 | **Consistent section formatting.** All headings share one style; all body text shares one style. | Compare font name, size and weight across each heading instance and each body paragraph; assert at most one distinct value per role. | S2 |
| 19 | 2 | **Job titles are canonical and complete.** No abbreviated titles (`Sr.`, `Exec`, `Eng` without expansion) appear in title position. | Match title strings against an abbreviation blacklist / canonical-title expander. | S13 |
| 20 | 2 | **Employer names carry a legal suffix or a known-employer gazetteer hit.** | Assert each `company` field matches `.*(Inc\.?|LLC|Ltd\.?|Co\.?|Corp\.?|GmbH|PLC|LLP|Pty)$` or is in the gazetteer, else warn. | S13 |
| 21 | 2 | **No repeated header/footer content.** No text string appears on more than one page unless it is intentional and in the body. | Extract per page; diff the page-level line sets; flag lines duplicated across all pages. | §3.10, W3 |
| 22 | 3 | **No faux-bold duplication.** No visible string is drawn twice at the same coordinates. | Detect overlapping identical text runs in the positional extraction. | S17 (PDFBOX-1155, PDFBOX-956) |
| 23 | 3 | **Extraction is stable across engines.** Text extracted by PDFBox, pdfminer.six and PyMuPDF yields the same normalised token set (allowing for order). | Run all three; assert set equality of normalised tokens. | S3, S5, S17 |
| 24 | 3 | **Keyword coverage.** Every keyword from the target job description that the candidate legitimately has appears in the *extracted* text, in a section that maps to a structured field. | Extract → locate each keyword → assert it falls under a recognized heading. | S11, §4.1 |
| 25 | 3 | **Section attribution is correct.** Each extracted section's content belongs to that heading. | Run a line-ordered heading state machine over the extracted text; assert no experience bullet lands under Education and vice versa. | S11, §2.6 |
| 26 | 3 | **Multi-page integrity.** No section heading is the last line on a page; no sentence is split across a page boundary mid-word. | Check each page's last extracted line against the heading vocabulary and against trailing-hyphen patterns. | §3.10 |
| 27 | 3 | **No vector-outline text.** Glyph outlines are not converted to paths. | Assert `qpdf --qdf` content stream contains `Tj`/`TJ` operators for all visible text and that no text-bearing region consists solely of path operators. | S7 |
| 28 | 3 | **PDF is not encrypted and not password-protected.** | `qpdf --is-encrypted` returns false; `PDFPage.get_pages(check_extractable=True)` succeeds. | S1, S8 |

**Bonus — build-time guardrails that are not PDF assertions:** enforce the 2.5 MB budget *before* rendering (fail the build, do not warn); disable ligatures globally in the resume stylesheet; and render a "parser preview" in the UI that shows the *extracted line sequence*, not the visual page. The preview is the only thing that makes items 5, 6, 9, 10, 21 and 25 legible to a non-technical user, and it is the single highest-leverage UI feature this research supports.

---

## Appendix: what could not be verified in this session

Recorded so that later work does not re-litigate it, and so no claim here is over-stated.

| Gap | Why | Where to look |
|---|---|---|
| Workday accepted file types; parse internals | doc.workday.com renders client-side; only nav returned | Workday Community / HCM Admin Guide PDF |
| SAP SuccessFactors parse details | help.sap.com renders client-side; empty shell returned | `SF_RCM_Admin.pdf` ([link](https://help.sap.com/doc/ffb88b2705684ab0be068897766d72de/latest/en-US/SF_RCM_Admin.pdf)) |
| iCIMS parse behaviour and formats | `community.icims.com` requires authentication | iCIMS customer community |
| Lever, Ashby, SmartRecruiters, Jobvite, BambooHR parsing guidance | Only JS-rendered shells or unrelated release notes reachable | Vendor help centres with a session |
| BambooHR file-format list | help.bamboohr.com renders client-side | [help.bamboohr.com/s/article/588048](https://help.bamboohr.com/s/article/588048) |
| PDF spec section text (§9.10.x, §14.8.x) | Adobe's `PDF32000_2008.pdf` could not be fetched (content-type rejected) | [PDF Association pdf-issues](https://github.com/pdf-association/pdf-issues/issues/462), ISO 32000-2 |
| HBS "Hidden Workers" findings in detail | PDF body not fetchable in this session | [HBS PDF](https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf) |
| TheLadders eye-tracking methodology | HTTP 403 (geo-restricted) | TheLadders (US/Canada) |
| ATS resume parse-accuracy benchmark | No vendor or academic benchmark with published methodology found | Textkernel/HR-tech research, academic CV-parsing literature ([CareerCorpus dataset](https://www.sciencedirect.com/science/article/pii/S2352340926001204)) |
| Third-party parsing engines used by Workday / Taleo / iCIMS / SuccessFactors / Greenhouse | No vendor disclosure found naming an engine (Bullhorn is the exception, naming Textkernel) | Vendor security/trust pages, procurement docs |
| Whether en dash, asterisk bullets, or two-digit years break other parsers | Only one parser's source was inspectable | Broader parser-source survey |
