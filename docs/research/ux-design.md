# UX & UI Design Research — ATS-First Resume Builder with True-to-PDF Live Preview

**Status:** research deliverable · **Date:** 2026-10-06 · **Scope:** product/UX/design specification, no code.
**Differentiator being designed for:** (a) verifiable ATS-friendliness, (b) a live preview that is genuinely the PDF you download.

---

## 0. Evidence quality legend

Every recommendation below carries a source URL. Because not all sources have equal weight, they are tagged:

| Tag | Meaning |
| --- | --- |
| **[P]** | Primary — normative spec, first-party product documentation, or first-party design-system documentation, read directly. |
| **[S]** | Secondary — third-party review, review-aggregator, or news report. Used only where no first-party source exists. |
| **[X]** | Could not be retrieved (paywall, WAF, JS-rendered, or 403/406). Cited for existence/location only; **no claim in this document rests on an [X] source alone.** |

Two retrieval notes for the reader's trust calibration:

- `nngroup.com/articles/errors-forms-design-guidelines/` returned **HTTP 403** to automated fetch. The URL is real and the article is well known; the specific claims I attach to it are ones that GOV.UK's primary pattern documentation independently supports, so the recommendation does not depend on the NN/g page alone. Tagged **[X]**.
- Reddit threads were not directly retrievable in this session. Complaint evidence therefore comes from first-party help centres, vendor support pages, review aggregators, and complaint portals — see §2's source column. This is a real limitation: Reddit would add colour, not new failure categories, but treat the complaint list as **evidence-backed, not exhaustive**.

---

## 1. Design direction summary

**Direction name: “Ink & Paper.”**

The product is a *document workspace*, not a form wizard and not a design tool. The thesis:

1. **The page is the hero; the chrome recedes.** A near-neutral canvas, one confident blue for action, and a preview that is always present at desktop widths. The UI never competes with the resume. This follows the neutrality that enterprise design systems converge on — Carbon's guidance that "space can be used to denote groups of associated information… without having to use lines or other graphical elements as a divider," and that a page should carry enough white space that "the user's eye [can] rest" ([Carbon spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) **[P]**).
2. **Structure over freeform.** Every resume is data: `sections → entries → bullets`. Free-form canvas tools are exactly what break parsers; a university career centre warns that Canva-style designs put content into text boxes and columns that resume parsers mis-read ([CSU East Bay career centre](https://careercenter.csueastbay.edu/blog/2024/06/17/should-you-use-canva-for-your-resume-heres-what-you-need-to-know/) **[S]**). Canva itself publishes ATS guidance for the same reason ([Canva ATS guide](https://www.canva.com/fr_fr/decouvrir/comment-faire-un-cv-ats/) **[P]**).
3. **Honesty is the brand.** No paywall ambush at download, no opaque score, no claim of pixel-identity we cannot prove. The strongest evidence that honesty is a viable differentiator is FlowCV, which says plainly: "No paywalls, no watermarks, no surprises when downloading your resume… Your first resume is free forever, with full access to all design features," and is rated 4.9 on Trustpilot ([FlowCV About](https://flowcv.com/about) **[P]**, [FlowCV on Trustpilot](https://uk.trustpilot.com/review/flowcv.com) **[P]**).
4. **Explainability over scores.** The competitor that has thought hardest about this ships a *checklist*, not a horoscope: Reactive Resume's Check mode shows "19 of 22 checks pass," groups checks into five named categories, pins each finding to the line it is about, and states in its own documentation: "The score measures how reliably software can read your resume. It doesn't predict whether you'll be shortlisted." ([Reactive Resume — Checking your resume](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).
5. **Both paths, always.** Every drag operation has a button equivalent; every mouse affordance has a keyboard equivalent. This is not charity — it is a conformance requirement (WCAG 2.2 SC 2.5.7) and it happens to be the feature power users ask for.

**Form factor commitment.** Three modes in one editor shell — **Write · Design · Check** — with a persistent page preview. This is a proven-in-market shape: Reactive Resume v6 ships exactly this structure with "Write, Design, and Check modes and a live PDF preview" ([Reactive Resume README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**). We adopt the mode split (it maps cleanly onto progressive disclosure) but not the implementation.

---

## 2. Competitive teardown

### 2.1 Teardown table

| Product | Input model | Preview model | Download / paywall flow | Recurring complaints |
| --- | --- | --- | --- | --- |
| **Resume.io** | **Guided ordered flow inside one builder screen.** Its own help centre publishes a numbered 10-step path: choose template → personal details → summary → links → employment → education → skills → special sections → edit → download. Content is edited "in the boxes on the top left-hand side of the screen"; sections are reordered "by dragging the three dots on the left of the section name"; entries deleted via a bin icon on hover. ([help.resume.io — How do I create a resume?](https://help.resume.io/en/articles/3785152) **[P]**) | Editor with live template preview on the same screen; template/colour/line-spacing changed from a separate template selector page. ([same](https://help.resume.io/en/articles/3785152) **[P]**) | **Free plan downloads TXT only** — you "copy/paste into your own word processor where you can adjust the formatting yourself." PDF/Word require premium. 7-day trial "will auto-renew but can be canceled at any time"; 6-month and 1-year are one-time, non-renewing. Cancellation can be done from `resume.io/contact` without logging in, but requires **email confirmation**; premium persists "30 days from your last monthly payment or 7 days from your last trial payment." ([help.resume.io — Premium](https://help.resume.io/en/articles/3785856) **[P]**, [help.resume.io — Cancel/downgrade](https://help.resume.io/en/articles/3784896) **[P]**, [pricing](https://resume.io/pricing) **[X]**) | TXT-only free export is a hard wall placed *after* the work is done; auto-renewing trial; cancellation is a multi-step, email-confirmed flow that reviewers write step-by-step guides for ([Trustpilot](https://www.trustpilot.com/review/resume.io) **[S]**). The drag-handle reorder has **no documented non-drag alternative** ([help.resume.io](https://help.resume.io/en/articles/3785152) **[P]**). |
| **Zety** | Step/section-driven builder; the template and style are changed from within the builder ([Zety — change template in builder](https://zety.com/blog/change-template-in-zety-builder) **[X]** — fetch failed, URL cited for existence). | Template preview inside the builder. **[X]** | Trial-anchored subscription; Zety's own contact page is the escalation path ([zety.com/contact](https://zety.com/contact) **[P]**). | Billing is the dominant theme. Complaint-portal filings include "Zety Subscription Scam Concern—Charged Without Approval" and "Zety Subscription Renewal Without Notification—Refund Requested" ([Sikayetvar #1](https://www.sikayetvar.com/en/zety-us/zety-subscription-scam-concerncharged-without-approval) **[S]**, [Sikayetvar #2](https://www.sikayetvar.com/en/zety-us/zety-subscription-renewal-without-notificationrefund-requested) **[S]**). Third-party guides exist purely to walk people through cancelling ([Jobsolv](https://jobsolv.com/blog/how-to-cancel-zety-subscription) **[X]**). |
| **Novoresume** | Template-driven visual editor giving "real control over spacing, colour, and structure" — design-forward rather than content-first. | Visual editor with live template rendering. | **Free plan: watermarked PDF, capped at one page, basic templates only.** Premium ~$19.99/mo, ~$39.99/3mo, ~$99.99/yr, billed **per period, not as an auto-renewing trial**. **No native DOCX export at all — PDF only.** ([Novoresume pricing](https://novoresume.co.uk/gb/page/pricing) **[P]**, [Careerkit review](https://www.careerkit.me/blog/novoresume-review) **[S]**) | Watermark on free download; one-page cap forces upgrade; PDF-only export blocks employers who ask for Word; design-led templates "sometimes use columns or graphic elements" that put parser readability at risk ([Careerkit](https://www.careerkit.me/blog/novoresume-review) **[S]**). Mitigating: its pay-per-period model is described as honest and *not* a trial trap — evidence that billing honesty is achievable. |
| **Canva Resumes** | **Free-form drag-and-drop canvas designer**, not a structured resume editor — the product page advertises "Editor fácil de usar com recurso de arrastar e soltar" ([Canva resume maker](https://www.canva.com/pt_br/criar/curriculo/) **[P]**). | Live canvas; WYSIWYG by construction. | Free tier is generous; the product is a general design tool, so the "paywall" is template/asset gating rather than download gating. | ATS legibility. Because content lives in text boxes, columns and graphical elements, parsers may read it out of order or miss it entirely; Canva publishes its own ATS guidance in response ([Canva ATS guide](https://www.canva.com/fr_fr/decouvrir/comment-faire-un-cv-ats/) **[P]**), and university career services warn students off it for exactly this reason ([CSU East Bay](https://careercenter.csueastbay.edu/blog/2024/06/17/should-you-use-canva-for-your-resume-heres-what-you-need-to-know/) **[S]**). |
| **FlowCV** | Structured resume editor (not a canvas), "structured guidance so you know what to write" and "templates that follow recruiter best practices." ([FlowCV About](https://flowcv.com/about) **[P]**) | Editor + template preview; templates have their own gallery ([FlowCV templates](https://flowcv.com/resume-templates) **[P]**). | **The honesty benchmark.** "No paywalls, no watermarks, no surprises when downloading your resume"; **first resume free forever with full access to all design features**; payment only for **multiple versions** and advanced AI. ([FlowCV About](https://flowcv.com/about) **[P]**) | Very few — 4.9/5 Trustpilot ([Trustpilot](https://uk.trustpilot.com/review/flowcv.com) **[P]**). The live constraint is the free tier's **single resume**, which blocks per-application tailoring ([ResuFit review](https://resufit.com/blog/flowcv-review-free-resume-builder-worth-trying/) **[S]**). |
| **Reactive Resume** (open source, v6) | **Mode-based sectioned editor: Write / Design / Check**, with "inline content editing and click-to-select on the page," rich text, "custom sections, drag-and-drop ordering, and structured dates," plus a "searchable command bar." ([Reactive Resume README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) Stack: React 19 + Vite, **TipTap** rich text, Tailwind, Base UI. ([same](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) | **Live PDF preview**, "powered by Forme, rendered in a background worker," with **PDF.js for the viewer** ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**). A **"What a parser reads"** toggle replaces the page with the extracted text layer in reading order. ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**) | **MIT, no paid tier, no ads, no tracking.** Export PDF, DOCX, Markdown, JSON; public share links; self-host via Docker/Vercel/Cloudflare. Optional AI uses a provider *you* connect. ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) | Open-source issues surface layout fidelity problems, e.g. "[Bug] Certifications texts don't fit inside the page" ([issue #2275](https://github.com/AmruthPillai/Reactive-Resume/issues/2275) **[P]**), and export bugs such as icons rendering as missing images in the PDF ([issue #2126](https://github.com/reactive-resume/reactive-resume/issues/2126) **[P]**). These are precisely the preview-vs-export class of bug the differentiator must eliminate. |
| **Enhancv** | Structured sectioned resume builder with a content-quality orientation (its marketing leans on AI review and "resume checker"). | Editor with live template preview. | 7-day free plan then paid, "Starting from £12.99"; separate free ATS/CV checker tool ([Enhancv pricing](https://enhancv.com/pricing/) **[P]**, [Enhancv CV checker](https://enhancv.com/cv-checker/) **[P]**). | Review-site complaints exist at low volume ([reviews.io complaint](https://www.reviews.io/company-review/store/enhancv-com/30400209) **[S]**); the recurring structural theme is that the checker output is a separate, marketing-led funnel rather than something embedded in the document you are editing. |
| **Teal** | **Sectioned builder with an "Analyzer" tab** in the top toolbar, badged with the count of unsolved issues. ([Teal — Using the Resume Analyzer](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]**) | Builder + preview; bullets have an "active" checkbox so you can keep more bullets written than you show. ([same](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]**) | Two scores: a **Resume Score** (from the Analyzer) and a **Match Score** (from the Job Matcher). **Free plan sees "the top basic issues"; Teal+ sees "advanced analysis issues."** ([same](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]**) | The paywall is placed *inside the diagnostic*: your score is visible but the reasons behind it are partly gated. Teal mitigates this with unusually explicit framing — named requirements ("include **two bullets** that have time-based statements"), ranges ("3-5 active bullets"), and a stated position that "These recommendations are meant to be just that – recommendations!" ([same](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]**). |
| **Google Docs resume templates** | **General-purpose document editor with a template gallery** — templates are inserted through Docs' normal template flow ([Google Docs — Use templates](https://support.google.com/docs/answer/148833) **[P]**). No resume data model, no section semantics, no parser awareness. | Native document WYSIWYG; pagination is the browser/print engine's. | Free with a Google account. | Because it is a word processor, the user can trivially create the exact structures that break parsing — multi-column layouts, tables, text boxes, header/footer content — with no warning. Third-party "ATS-friendly Google Docs template" guides exist specifically to steer people away from those features ([Business Insider Africa guide](https://africa.businessinsider.com/local/markets/how-to-make-an-ats-friendly-resume-using-a-google-docs-template/gtl7sfz) **[S]**). |

### 2.2 What the field proves about the differentiator

Three findings should shape the roadmap directly:

1. **The best-in-class free-flowing editor (Reactive Resume) had to bolt on a separate "check the exported PDF" pass** — "The checks above read your resume's content and settings. To test the actual file a recruiter receives, select **Also check the exported PDF**… Reactive Resume creates the PDF in your browser and runs the full file check on it." ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**). That is a workaround for preview/export divergence. **If our preview and export share one renderer, we do not need that second pass** — and that is the product's core moat.
2. **Nobody has solved "the preview is not the file."** A resume-builder support article documents it as expected behaviour: "The editor shows a live page, and the PDF is rendered separately. Small differences in spacing between the two are expected." ([GoodSpace support](https://goodspace.ai/support/resume-builder/pdf-looks-different) **[P]**). Users are told to wait for autosave and re-download. That is a defect being documented as a feature.
3. **Billing honesty is a real, defensible position** — FlowCV's "no paywalls, no watermarks" is its headline claim and it holds a 4.9 rating ([FlowCV About](https://flowcv.com/about) **[P]**).

---

## 3. Top 8 recurring UX failures to avoid

Ranked by frequency of evidence and by damage to trust. Each has a **counter-design** we commit to.

### F1 — The paywall ambush at download
Users invest an hour and then discover the export is gated. Resume.io's free plan yields **only a TXT file**; PDF/Word need premium ([help.resume.io](https://help.resume.io/en/articles/3785152) **[P]**). Zety's equivalent complaints reach formal dispute portals ([Sikayetvar](https://www.sikayetvar.com/en/zety-us/zety-subscription-scam-concerncharged-without-approval) **[S]**).
**Counter-design:** state export entitlements on the first screen; free tier exports a **real, unwatermarked PDF**; never gate the *first* download.

### F2 — Preview ≠ downloaded file
Documented as normal by at least one vendor ([GoodSpace](https://goodspace.ai/support/resume-builder/pdf-looks-different) **[P]**); Reactive Resume needs a second "check the exported PDF" pass to compensate ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).
**Counter-design:** one layout engine, one document model, one CSS paged-media stylesheet for both the on-screen preview and the PDF. Preview and export cannot diverge by construction.

### F3 — Watermark and page cap on the free tier
Novoresume's free PDF is watermarked and capped at one page ([Careerkit](https://www.careerkit.me/blog/novoresume-review) **[S]**, [Novoresume pricing](https://novoresume.co.uk/gb/page/pricing) **[P]**).
**Counter-design:** no watermark, ever. Page count is a *quality signal* surfaced in the overflow checker, not a billing lever.

### F4 — Unexplainable ATS numbers
A number with no lineage is the norm. Jobscan's "match rate" is explicitly a weighted keyword/skill overlap score against a job description — "Hard skills, Education level, Job title, Soft skills, Other keywords… Resume word count and measurable results are not factored into the match rate" ([Jobscan support](https://jobscansupport.frontkb.com/en/articles/11537409) **[P]**). That is a *relevance* score, but it is routinely read as an *ATS verdict*.
**Counter-design:** §6 — explainable checks with a cardinal summary, not a hero number.

### F5 — Work loss: no autosave, no undo, no recovery
The market leader in this space ships "Autosave, **local recovery of unsaved resume drafts**, and **up to 200 undo steps**" ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) because the alternative is unacceptable. Support pages exist purely to explain save timing ([GoodSpace — saving and autosave](https://goodspace.ai/support/resume-builder/saving-and-autosave) **[P]**).
**Counter-design:** §4.2 — autosave with visible state, an offline write-ahead mirror, and a deep undo stack that covers structural operations.

### F6 — Drag-only reordering
Resume.io's documented reorder mechanism is dragging three dots ([help.resume.io](https://help.resume.io/en/articles/3785152) **[P]**). This fails WCAG 2.2 SC 2.5.7 *Dragging Movements* (AA) unless an equivalent single-pointer non-drag path exists ([Understanding SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**).
**Counter-design:** §4.4 — drag *plus* always-present move buttons *plus* keyboard shortcuts.

### F7 — Silent overflow and broken page breaks
"[Bug] Certifications texts don't fit inside the page" is a real, filed issue in the most sophisticated open-source builder ([issue #2275](https://github.com/AmruthPillai/Reactive-Resume/issues/2275) **[P]**).
**Counter-design:** live overflow detection — orphaned headings, single-line widows, content past the last page, and an explicit "2 pages, page 2 is 40% full" summary with one-click density fixes.

### F8 — No usable narrow-screen or keyboard-only path
Wizards and side-by-side editors collapse badly. WCAG 2.2 requires content to work at 320 CSS px without two-dimensional scrolling (SC 1.4.10 *Reflow*, AA) ([Understanding SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) **[X]** — URL cited; the normative requirement is in [WCAG 2.2](https://www.w3.org/TR/WCAG22/#reflow) **[P]**).
**Counter-design:** §5.4 — a deliberate switch from side-by-side to *Edit/Preview* segmented control below 1280px, and a complete keyboard map (§9).

---

## 4. Editor architecture recommendation

### 4.1 Input model: sectioned editor with progressive disclosure — not a wizard

**Recommendation.** A **three-mode sectioned editor** (`Write · Design · Check`) with a persistent preview. Inside `Write`, a left rail lists sections; exactly one section is expanded into a focused editing panel at a time. Sections that are complete collapse to a summary row.

**Why not a wizard.** Staged disclosure costs the user the ability to jump to the thing they came to fix. NN/g's own comparison is explicit: progressive disclosure initially shows "only a few of the most important options" and discloses "a larger set of specialized options upon request," whereas *staged* disclosure "stepl[s] through a linear sequence," with **wizards as the classic example**; the documented risk of staged flows is that users get lost moving between levels ([NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) **[P]**). A resume is edited iteratively for weeks — a linear wizard is the wrong shape. NN/g also warns that beyond two disclosure levels usability drops ([same](https://www.nngroup.com/articles/progressive-disclosure/) **[P]**), which caps our nesting at: mode → section → entry.

**Why the mode split works.** It separates three different mental tasks (writing, styling, verifying) and it is already validated by the strongest open-source implementation, which ships "Write, Design, and Check modes" ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**).

**Applicable criteria.** [SC 1.3.1 Info and Relationships (A)](https://www.w3.org/TR/WCAG22/#info-and-relationships) — the section/entry/bullet hierarchy must be conveyed in markup, not only visually. [SC 2.4.3 Focus Order (A)](https://www.w3.org/TR/WCAG22/#focus-order). [SC 3.3.2 Labels or Instructions (A)](https://www.w3.org/TR/WCAG22/#labels-or-instructions).

### 4.2 Autosave vs explicit save

**Recommendation: autosave, with a visible state machine and an offline write-ahead mirror. No Save button.**

| Concern | Decision | Source |
| --- | --- | --- |
| Trigger | Debounce **1200 ms** after last keystroke; also save immediately on field blur, section collapse, mode switch, route change, and `visibilitychange → hidden`. | Mirrors the shipped behaviour of a market leader: "Autosave, local recovery of unsaved resume drafts" ([RR README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) |
| Status UI | A quiet, text-only status chip in the editor bar: `Saving…` → `Saved 14:32` → `Saved · offline copy` → **`Couldn't save — retrying`** with a Retry button. Never a modal. | Users are confused *today* by invisible save timing — an entire support article exists to explain it ([GoodSpace](https://goodspace.ai/support/resume-builder/pdf-looks-different) **[P]**) |
| Failure | Queue and retry with backoff; mirror every keystroke to IndexedDB/localStorage; on reload, offer **Restore unsaved draft**. | Same class of feature as "local recovery of unsaved resume drafts" ([RR README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) |
| Unload guard | `beforeunload` prompt **only** while a save is pending or failed — never as a blanket "are you sure." | Blanket guards are the "trapped user" anti-pattern ([NN/g — User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/) **[P]**) |
| History | Named + automatic versions, previewable and restorable; trash with a **30-day** window and Undo. | Shipped pattern ([RR README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) |
| Explicit save | Retained only as a **keyboard-invocable, idempotent** `Ctrl/Cmd+S` that forces an immediate flush and shows the same chip. | Gives the anxious user agency without creating a lost-work failure mode |

**Criteria.** [SC 3.3.7 Redundant Entry (A)](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) **[P]** — "Information previously entered by or provided to the user that is required to be entered again in the same process is either auto-populated, or available for the user to select." Concretely: never make the user retype their name, email, or a date range in a second place; reuse is a conformance requirement, not a nicety. Also [SC 3.3.4 Error Prevention (Legal, Financial, Data) (AA)](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data) — deleting a resume or clearing a section is reversible or confirmed.

### 4.3 Field model: structured fields over `contenteditable`

**Recommendation.**

- **Default to structured fields.** Name, email, phone, location, links, job title, employer, dates, education, skills → `<input>` / `<textarea>` with real `<label>`s. Bullets → auto-growing `<textarea>`.
- **Do not build the resume body on raw `contenteditable`.** MDN documents the attribute as exposing a rich editing surface with a large behavioural surface area and browser divergence ([MDN — contenteditable](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contenteditable) **[P]**). More importantly, free-form rich text destroys the structure the ATS checker depends on — you cannot reliably answer "does every role have a description?" about an HTML blob.
- **If inline editing on the page is desired** (a genuinely nice affordance, shipped by Reactive Resume: "inline content editing and click-to-select on the page" — [README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**), implement it as **click-to-focus a structured field**, where the field is a real form control overlaid on the page, not a `contenteditable` region. Same feel, intact semantics.
- **Rich text is permitted only inside a bullet**, and only for bold/italic/link. Use a battle-tested editor (TipTap/ProseMirror class — as Reactive Resume does ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**)) that renders a real `role="textbox"` with `aria-multiline="true"` and a proper accessible name; never hand-roll `contenteditable`.
- **Never use `contenteditable` for a plain multi-line value.** The ARIA role and the name/role/value contract are far easier to guarantee with `<textarea>`.

**Criteria.** [SC 1.3.1 Info and Relationships (A)](https://www.w3.org/TR/WCAG22/#info-and-relationships); [SC 3.3.2 Labels or Instructions (A)](https://www.w3.org/TR/WCAG22/#labels-or-instructions) — every field has a persistent visible label, not a placeholder; [SC 4.1.2 Name, Role, Value (A)](https://www.w3.org/TR/WCAG22/#name-role-value); [SC 1.3.5 Identify Input Purpose (AA)](https://www.w3.org/TR/WCAG22/#identify-input-purpose) — set `autocomplete="name|email|tel|organization|organization-title"` so browsers and AT can fill these.

### 4.4 Reorderable sections, entries and bullets — satisfying SC 2.5.7

This is the highest-risk requirement in the product, so state it normatively first.

> **SC 2.5.7 Dragging Movements (Level AA, new in WCAG 2.2):** "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging, unless dragging is essential or the functionality is determined by the user agent and not modified by the author." — [Understanding SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**

Three further points from that page are decisive for our design:

1. **Keyboard equivalence is not enough.** "Achieving keyboard equivalence for a dragging operation does not automatically meet this success criterion, unless that equivalent keyboard operation also provides controls that can be clicked or tapped with a pointer… the two requirements are evaluated independently." ([same](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**)
2. **The failure mode is named.** F108: "Failure of Success Criterion 2.5.7 Dragging Movements due to not providing a single pointer method that does not require a dragging movement" ([F108](https://www.w3.org/WAI/WCAG22/Techniques/failures/F108) **[P]**).
3. **The sufficient technique hands us the design.** G219's first example: "A list of items can be re-ordered by picking up an item and dragging it upwards or downwards… **After a single pointer activation, the list items display up and down arrows which allow a step-wise re-ordering of the list via single pointer inputs** (taps or clicks at the up or down arrow)." ([G219](https://www.w3.org/WAI/WCAG22/Techniques/general/G219) **[P]**)

**Recommendation — the three-path reorder contract.** Every reorderable object (a section, an entry, a bullet, a skill chip) gets all three, simultaneously:

| Path | Interaction | Notes |
| --- | --- | --- |
| **Drag** | Pointer drag on a visible handle. | Optional accelerator. Handle ≠ the only affordance. Announce movement with `aria-live="polite"`: "Experience: Senior Engineer moved to position 2 of 4." |
| **Buttons** | On hover **and on focus**, the row reveals `Move up` / `Move down` buttons, each a **minimum 24 × 24 CSS px** target. On narrow screens they are always visible. | This is the G219 example, and it is what satisfies **2.5.7**. |
| **Keyboard** | `Ctrl/Cmd + Shift + ↑/↓` moves the focused item one position and keeps focus on it. `Alt + ↑/↓` is reserved inside bullets for moving the bullet. | Satisfies [SC 2.1.1 Keyboard (A)](https://www.w3.org/TR/WCAG22/#keyboard). |

Always-available buttons also serve users who never discovered drag, and they are the honest answer for touch devices.

**Criteria.** [SC 2.5.7 Dragging Movements (AA)](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**; [SC 2.1.1 Keyboard (A)](https://www.w3.org/TR/WCAG22/#keyboard); [SC 2.5.8 Target Size (Minimum) (AA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) **[P]**; [SC 4.1.3 Status Messages (AA)](https://www.w3.org/TR/WCAG22/#status-messages) — reorder results announced politely, not by stealing focus.

**SC 2.5.8 in exact numbers.** "The size of the target for pointer inputs is at least **24 by 24 CSS pixels**," with a **spacing** exception: undersized targets pass if a 24 CSS-pixel-diameter circle centred on each target's bounding box "do not intersect another target or the circle for another undersized target." Exceptions: Equivalent, Inline, User Agent Control, Essential. Sufficient technique: **C42** — using `min-height`/`min-width` on the target container to ensure spacing. Note also that meeting 24×24 does not exempt you from spacing if the *adjacent* target is large. ([Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) **[P]**, [C42](https://www.w3.org/WAI/WCAG22/Techniques/css/C42) **[P]**)

**Design consequence:** our icon buttons ship at **28 × 28 px visual, 32 × 32 px hit area** (§7.4), comfortably above the minimum, and dense bullet-row controls are spaced so that no two 24 px circles intersect.

### 4.5 Undo / redo expectations

**Recommendation.**

- **Depth ≥ 100 steps**, unified across content and structure. (Precedent: "up to 200 undo steps" — [RR README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**.)
- **Structural operations are undoable**: add/delete/reorder a section, entry, or bullet; template change; density change. If deleting a bullet is undoable but deleting a whole entry is not, users learn not to trust the feature.
- **Do not intercept the browser's native undo inside a text field.** Undo operates at the field level while a field has focus-within-text-history; the app-level stack takes over for structural changes on blur. Getting this wrong is the single most common way editors feel broken.
- **Destructive actions get Undo, not a confirmation dialog** — except irreversible bulk actions. NN/g's heuristic is direct: users "will need a clearly marked 'emergency exit' to leave the unwanted state without having to go through an extended dialogue. **Support undo and redo**," and importantly the ability to recover "encourages exploration, which facilitates learning and discovery of features" ([NN/g — User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/) **[P]**).
- **Discoverability**: an Undo affordance must be *visible*, not only a shortcut — NN/g treats "Ensure Undo Is Discoverable" as its own section ([same](https://www.nngroup.com/articles/user-control-and-freedom/) **[P]**). We use a transient toast: *"Experience entry deleted — **Undo**"* for 8 seconds, plus a persistent Undo/Redo pair in the editor bar.

**Criteria.** [SC 3.3.4 Error Prevention (Legal, Financial, Data) (AA)](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data); [SC 2.1.1 Keyboard (A)](https://www.w3.org/TR/WCAG22/#keyboard) — `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`; [SC 4.1.3 Status Messages (AA)](https://www.w3.org/TR/WCAG22/#status-messages) — toasts announced.

### 4.6 Validation timing

**Recommendation — a three-tier model.**

| Tier | When it fires | What it can say | Example |
| --- | --- | --- | --- |
| **Advisory (live)** | On keystroke | Neutral, non-blocking, informational only. **Never red.** | "218 / 220 characters" · "Tip: 3–5 bullets works best for a recent role" |
| **Field error** | **On blur**, and only if the field was touched and is invalid | Format-level, deterministic facts | "Enter a date in MM/YYYY format" · "This email address is missing an @ symbol" |
| **Document error** | On **Generate preview / Download** and in Check mode | Completeness and ATS-readability findings | "2 roles have no description" |

**Why blur, not keystroke.** Validating an email address while someone is typing the second character produces an error message that is *wrong* for most of the interaction. NN/g's form-error guidance (10 design guidelines for reporting errors in forms) is the standard reference for placing errors adjacent to the field and writing them constructively ([NN/g — 10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/) **[X]**); the same conclusions are available as normative pattern documentation from GOV.UK, below.

**Error presentation — adopt the GOV.UK pattern wholesale.**

- **Inline message above the field**, in red, with a visually-hidden `Error:` prefix, and the field wired to it via `aria-describedby`. GOV.UK's markup is the reference: `<p id="full-name-input-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> Enter your full name</p>` plus `aria-describedby="full-name-input-error"` on the input ([GOV.UK — Error summary](https://design-system.service.gov.uk/components/error-summary/) **[P]**).
- **An error summary at the top of the section panel**, with the heading **"There is a problem"**, a list of links, `role="alert"`, and **focus moved to it**. GOV.UK's rules: "Always show an error summary when there is a validation error, even if there's only one"; "move keyboard focus to the error summary"; "link to each of the answers that have validation errors"; and "make sure the error messages in the error summary are worded the same as those which appear next to the inputs with errors" ([same](https://design-system.service.gov.uk/components/error-summary/) **[P]**).
- **Prefix the document title** with `Error: ` so screen readers announce it immediately — GOV.UK's validation pattern requires this ([GOV.UK — Validation pattern](https://design-system.service.gov.uk/patterns/validation/) **[P]**).
- **Multi-field answers link to the first field in error**; if you cannot tell which field is wrong, link to the first ([Error summary](https://design-system.service.gov.uk/components/error-summary/) **[P]**).
- **Never use a tooltip for an error.** Tooltips are transient and typically unavailable to touch and keyboard users alike. [SC 1.4.13 Content on Hover or Focus (AA)](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) **[P]** additionally requires any hover/focus content to be dismissible, hoverable, and persistent — three properties error text should not need.

**Criteria.** [SC 3.3.1 Error Identification (A)](https://www.w3.org/TR/WCAG22/#error-identification); [SC 3.3.3 Error Suggestion (AA)](https://www.w3.org/TR/WCAG22/#error-suggestion) — say how to fix it, not just that it is wrong; [SC 3.3.2 Labels or Instructions (A)](https://www.w3.org/TR/WCAG22/#labels-or-instructions); [SC 4.1.3 Status Messages (AA)](https://www.w3.org/TR/WCAG22/#status-messages) — `role="alert"` on the summary.

### 4.7 "Add another bullet" — eliminating the friction

Bullets are the highest-frequency object in a resume; every millisecond of friction is multiplied by ~20. Five mechanisms, all present at once:

1. **Enter at the end of the last bullet creates a new bullet.** Typing `Enter` inside a bullet splits it (standard text behaviour); `Enter` on an empty final bullet exits the list and focuses the next control. This is the keystone habit.
2. **A persistent, low-emphasis `+ Add bullet` row** rendered immediately below the last bullet — not hidden behind an overflow menu. It carries a 32 px hit area and is reachable by `Tab`.
3. **A new entry ships with three empty bullets already present.** Starting from zero is the single biggest source of "I don't know what to write" friction, and three is inside Teal's own recommended 3–5 range ([Teal](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]**).
4. **Paste a multi-line block and it becomes N bullets.** Pasting `"• did X\n• did Y\n• did Z"` should produce three clean bullets with the markers stripped. This is the fastest path from an old resume to a new one.
5. **Backspace on an empty bullet deletes it and focuses the previous bullet's end**; `Alt + ↑/↓` moves the bullet; `Ctrl/Cmd + Enter` inserts a soft line break inside a bullet without creating a new one.

**Why this shape.** NN/g's progressive-disclosure guidance is that the *initial* display must contain "everything that users frequently need up front," and that the mechanics of progressing to the next level must be simple and obvious ([NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) **[P]**). Adding a bullet is a *first-level* need — it must never be one level deep.

**Criteria.** [SC 2.1.1 Keyboard (A)](https://www.w3.org/TR/WCAG22/#keyboard) — every add/remove/move is keyboard-operable; [SC 2.5.7 (AA)](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**; [SC 2.5.8 (AA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) **[P]**; [SC 3.3.7 Redundant Entry (A)](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) **[P]** — when a second entry shares an employer or date range with a first, offer the previous value rather than demanding it again; [SC 1.3.1 (A)](https://www.w3.org/TR/WCAG22/#info-and-relationships) — the bullet list is a real `<ul>`/`<li>` structure.

---

## 5. Live preview pattern recommendation

### 5.1 Panel model — side-by-side with a conformant splitter

**Layout.** From **1280 px** upward: editor pane (min **480 px**) + draggable splitter (8 px hit area) + preview pane (min **520 px**). The ratio persists per user.

**The splitter must be built to the ARIA APG Window Splitter pattern**, not improvised. The pattern's requirements, verbatim:

- Consistent with ARIA 1.1, "a window splitter is a moveable separator between two sections, or panes, of a window that enables users to change the relative size of the panes."
- Keyboard: **Left/Right Arrow** moves a vertical splitter left/right; **Up/Down Arrow** moves a horizontal splitter; **Enter** "if the primary pane is not collapsed, collapses the pane. If the pane is collapsed, restores the splitter to its previous position"; **Home** (optional) → primary pane's smallest allowed size; **End** (optional) → largest allowed size; **F6** (optional) cycles panes.
- Roles/properties: the focusable splitter has `role="separator"`, plus `aria-valuenow`, `aria-valuemin` (typically 0), `aria-valuemax` (typically 100), an accessible name via `aria-labelledby` (visible pane label) or `aria-label`, and `aria-controls` referencing the primary pane.

([ARIA APG — Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) **[P]**)

Also provide: **double-click to reset to 50/50**, and a keyboard-reachable "Reset split" item in the View menu.

**Criteria.** [SC 2.1.1 Keyboard (A)](https://www.w3.org/TR/WCAG22/#keyboard); [SC 4.1.2 Name, Role, Value (A)](https://www.w3.org/TR/WCAG22/#name-role-value); [SC 2.5.7 (AA)](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]** — the arrow keys *and* the View-menu reset both count; the splitter is never drag-only.

### 5.2 Scroll synchronisation — one-way, anchored, and defeatable

**Recommendation: sync editor → preview only.** Bidirectional sync is a feedback-loop generator and a known source of nausea.

- Anchor on **section boundaries**, not pixel offsets. Each section and entry carries a stable id; an `IntersectionObserver` on the editor's section anchors drives the preview to the corresponding element. This avoids the accumulating drift that line-by-line sync produces.
- Use **CSS scroll anchoring** (`overflow-anchor`) to stop the browser from jumping when async content (a font, a page image) loads mid-scroll ([MDN — overflow-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor) **[P]**).
- **Suspend sync while the user is actively scrolling the preview**, with a ~1.5 s release timer, then re-sync. Detect intent, don't fight the user.
- Expose a **"Sync scroll" toggle** in the View menu (default on), and honour `prefers-reduced-motion` by making preview jumps instant rather than smooth.
- **Do not** attempt sub-line fidelity. Even best-in-class document tools synchronise at page/section granularity, and pretending otherwise produces the jitter users complain about.

**Criteria.** [SC 2.3.3 Animation from Interactions (AAA)](https://www.w3.org/TR/WCAG22/#animation-from-interactions) — honour `prefers-reduced-motion`; [SC 2.2.2 Pause, Stop, Hide (A)](https://www.w3.org/TR/WCAG22/#pause-stop-hide) — moving content the user did not initiate must be controllable.

### 5.3 Zoom and page navigation

- **Zoom control** in the preview toolbar: `−` / `+` buttons flanking a `%` menu with **50 · 75 · 100 · 125 · 150 · Fit width · Fit page**. Default **Fit width**, capped at 100 % so text is never upscaled into blur.
- **Shortcuts:** `Ctrl/Cmd + Shift + =` / `Ctrl/Cmd + Shift + -` for preview zoom, `Ctrl/Cmd + 0` to reset. **Deliberately do not bind plain `Ctrl/Cmd + +/-`** — that is the browser's page zoom, which users need for [SC 1.4.4 Resize Text (AA)](https://www.w3.org/TR/WCAG22/#resize-text) ("text can be resized without assistive technology up to 200 percent without loss of content or functionality"). Fighting the browser's zoom is an accessibility failure, not a feature.
- **Page navigation:** a page strip showing numbered thumbnails; a `Page 2 of 3` indicator; a section→page map (clicking "Education" jumps to the page containing it); and `Ctrl/Cmd + PgDn/PgUp` for page-to-page movement.
- **App zoom must never be the only way to read the content.** At 320 CSS px the preview must reflow to a single scrollable column with no horizontal scrolling ([SC 1.4.10 Reflow (AA)](https://www.w3.org/TR/WCAG22/#reflow)).

**Criteria.** [SC 1.4.4 Resize Text (AA)](https://www.w3.org/TR/WCAG22/#resize-text); [SC 1.4.10 Reflow (AA)](https://www.w3.org/TR/WCAG22/#reflow); [SC 1.4.12 Text Spacing (AA)](https://www.w3.org/TR/WCAG22/#text-spacing) — the preview's own controls must not clip when the user forces line height 1.5×, paragraph spacing 2×, letter spacing 0.12 em, word spacing 0.16 em.

### 5.4 Responsive behaviour on narrow screens

| Breakpoint | Layout | Rationale |
| --- | --- | --- |
| **≥ 1280 px** | Side-by-side, resizable splitter, dual scroll | Enough room for two readable columns |
| **1024 – 1279 px** | Side-by-side, splitter locked to 50/50; preview defaults to **Fit page** | Honest compromise; no cramped editing column |
| **768 – 1023 px** (tablet) | **Segmented control: `Edit` / `Preview`**, plus a small always-visible page thumbnail strip so the user keeps spatial awareness while editing | Two panes at this width make both unusable |
| **< 768 px** (phone) | **Preview-first, edit-on-demand.** Full-width preview; tapping any element selects it and opens its field in a bottom sheet. A sticky bar reads `Page 1 of 2`. | Mirrors a shipped mobile pattern: "On a phone, selecting a pin opens a bar at the top of the page… Use the arrows to step through the issues and fix each one from the card at the bottom, **without leaving the page**" ([Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**) |

Phone editing must be genuinely capable, not a "view only" cul-de-sac. Reactive Resume ships "Phone and tablet layouts, keyboard shortcuts" as a first-class feature ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**).

**Criteria.** [SC 1.4.10 Reflow (AA)](https://www.w3.org/TR/WCAG22/#reflow) — 320 CSS px, no 2-D scrolling; [SC 1.4.3 Contrast (Minimum) (AA)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) — the same 4.5:1 applies in both panes; [SC 1.4.11 Non-text Contrast (AA)](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) — 3:1 for control boundaries.

### 5.5 Communicating "this is exactly what will be downloaded"

This is the differentiator. Four commitments:

1. **One renderer.** The PDF is produced by the *same* layout engine that draws the preview — as Reactive Resume does with Forme running in a background worker for both the live preview and downloads ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**) — plus a PDF.js-class viewer for display. No second HTML-to-PDF path, ever. This is the structural fix for failure **F2**.
2. **Paged-media parity.** The preview and the export share one stylesheet using CSS paged media: `@page { size: Letter; margin: … }`, `break-inside: avoid` on entries, `orphans`/`widows` ([MDN — @page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page) **[P]**). Where colour must survive printing, `print-color-adjust: exact` is applied only to elements the user explicitly coloured ([MDN — print-color-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/print-color-adjust) **[P]**).
3. **Say it, and then let them verify it.** A persistent, quiet badge on the preview toolbar: **"Preview · Letter · rendered by the same engine as your PDF."** Alongside it, one action: **`What a parser reads`**, which replaces the page with the PDF's extracted text layer in reading order, marking the name, email, phone, location, links, headings and dates that were recognised. Reactive Resume ships exactly this and its documentation shows the payoff on a two-column resume: "the location was picked up from the wrong line" ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).
4. **Never claim what you cannot guarantee.** A pre-download dialog is not needed; a *post-generation* summary is: page count, paper size, file size, whether fonts were embedded, and an explicit `Open PDF` link so the user checks the artefact itself. Do **not** repeat the anti-pattern of explaining away divergence: "The editor shows a live page, and the PDF is rendered separately. Small differences in spacing between the two are expected" ([GoodSpace](https://goodspace.ai/support/resume-builder/pdf-looks-different) **[P]**) is a sentence we should never have to write.

---

## 6. ATS feedback UX recommendation

### 6.1 What the evidence says about score validity

Read these together; they are the justification for refusing to ship a misleading number.

- **A "match rate" is keyword overlap, not an ATS verdict.** Jobscan's own support documentation defines the match rate as based on "Hard skills → Education level (only when an advanced degree is included in the job description) → Job title → Soft skills → Other keywords," and states explicitly that "Resume word count and measurable results are not factored into the match rate" ([Jobscan support](https://jobscansupport.frontkb.com/en/articles/11537409) **[P]**).
- **ATS vendors themselves push back on the myth.** Workday publishes a misconceptions page about AI in hiring ([Workday Perspectives](https://www.workday.com/en-us/perspectives/hr/2026/04/debunking-ai-in-hiring-misconceptions.html) **[P]** — page retrieved, though the article body sits behind a heavily scripted shell). Independent reporting describes a study finding "ATS rarely auto-rejects CVs" and explicitly "debunks 75% myth" ([IT Brief UK](https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth) **[X]** — HTTP 406 to automated fetch; cited as a located report, not relied upon).
- **What an ATS genuinely does** is parse and structure a document. That is a *mechanical* question, and mechanical questions can be answered honestly.
- **The best-designed answer in the market refuses to overclaim.** Reactive Resume's own documentation states the boundary plainly: **"The score measures how reliably software can read your resume. It doesn't predict whether you'll be shortlisted."** ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**)

**Therefore: the product must never present a single number as a prediction of hiring outcomes. It presents a *parse-reliability* result, with its derivation always visible.**

### 6.2 The recommended design: "Readability checks," not "ATS score"

Adopt and improve on the strongest pattern in the market.

**1. Lead with the cardinal, not the percentage.**

> **19 of 22 checks pass** — *Reads cleanly*

The percentage is secondary. A cardinal statement ("19 of 22") is verifiable by the reader; a percentage is a verdict. This mirrors Reactive Resume's own layout: "The score is the share of checks your resume passes, for example **19 of 22 checks pass**," with three plain-language verdict bands — **Reads cleanly** (80+), **Mostly readable** (50–79), **Hard for software to read** (<50) — and a documented, honest count adjustment: "The heading check only runs when your resume's language is English, so resumes in other languages have 21 checks." ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**)

**2. Name every check and group it.** Five categories, each with its own pass count:

| Category | Checks against | Example findings |
| --- | --- | --- |
| **Contact details** | Name, email, phone, location present; email and links machine-recognisable; no photo (where inappropriate) | "Phone number is missing" |
| **Dates** | Every experience/education entry has dates, machine-readable, not reversed, not in the future | "This role's end date is before its start date" |
| **Layout** | Section placed on a page; **text reads in order** (sidebars, multi-column); body size, line height, margins within range | "Sidebar is read after the main column" |
| **Section headings** | Headings are ones parsers look for (Experience, Education, Skills); some work history present | "Use the standard heading 'Experience'" |
| **Writing** | Every role describes what you did | "Describe the role" |

*(Category taxonomy adapted from [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**.)*

**3. Pin every finding to the page.** Each issue carries a numbered pin in the page margin with a wavy underline on the offending text; selecting a card scrolls to and outlines the line, and selecting a pin jumps back to its card. Findings are ordered "most serious first." ([same](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**)

**4. Make the fix one click, and make it undoable.** The card's primary button names the action — "Hide the photo," "Use one column," "Use the standard heading" — and "A message confirms the change and offers **Undo**." Issues that require writing switch to Write mode and open the right field ([same](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).

**5. Let the user disagree — and record it.** Two distinct affordances, which is the detail most competitors miss:

- **`Ignore`** — "If an issue doesn't apply to you, select **Ignore**… Ignored issues no longer count against the score."
- **`Keep`** — "For a choice that's yours to make, such as a two-column design, the button reads **Keep** instead."

Both are reversible via **`Show them again`**. ([same](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**) This converts the tool from an authority into a collaborator, and it is the single most important anti-anxiety mechanism in the design.

**6. Keep job matching in a separate, clearly non-scoring tab.** "The **Job match** tab picks out the terms a job posting stresses and shows which ones your resume already has. **It isn't part of the score.**" Missing terms are labelled **"Not in your resume · add only if true"**, with three honest actions: add to Skills, ask the assistant, or **"Not true for me, hide it."** ([same](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**) The phrase *"add only if true"* is doing enormous ethical work and we should copy the spirit of it.

**7. Distinguish "the content" from "the file."** Because our preview and export share a renderer (§5.5), we can run the **file-level** check continuously rather than on demand — but we should still surface it as its own report: a per-category score for **Readability, Layout, Sections, Contact details, Dates**, with **Writing** explicitly marked as tips that "don't affect the score" ([format per the exported-PDF report in the same source](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).

**8. When it is clean, say so plainly.** "Nothing to fix." Not a green 100 with confetti.

### 6.3 Avoiding misleading or anxiety-inducing presentation

**Prohibited patterns** (each is a manufactured urgency or deception technique catalogued in the deceptive-patterns literature — [deceptive.design](https://www.deceptive.design/) **[P]**):

- A score that **counts up** on load, or animates a "potential score" you could have.
- Red alarm styling at 0 issues, or a permanently red badge that can never be cleared.
- Copy implying rejection: "75 % of resumes are rejected by ATS." This is the myth the industry is actively debunking ([IT Brief](https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth) **[X]**, [Workday](https://www.workday.com/en-us/perspectives/hr/2026/04/debunking-ai-in-hiring-misconceptions.html) **[P]**).
- Gating the *reasons* behind a score behind payment. Teal shows free users "the top basic issues" and reserves "advanced analysis issues" for Teal+ ([Teal](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]**). Showing a low number while hiding why is the worst of both.
- Fake precision: "Your resume scores 73.4 out of 100."

**Required patterns:**

- The permanent disclaimer, in the panel, not buried in a help page: **"This measures how reliably software can read your resume. It doesn't predict whether you'll be shortlisted."** (Wording follows [Reactive Resume](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**.)
- **Delta, not just state**: after a fix, "3 checks fixed · 19 of 22 → 22 of 22" with the Undo affordance still present.
- **Confidence language in the finding, not the score**: "Text reads in order" is a fact; "Recruiters prefer one column" is an opinion and must be labelled as advice.
- Separate **hard failures** (parser cannot read this) from **soft advisories** (best practice) visually and lexically. Only hard failures should look like warnings.
- Colour is never the only signal ([SC 1.4.1 Use of Color (A)](https://www.w3.org/TR/WCAG22/#use-of-color)); every status has an icon and a word.
- Status changes announce politely ([SC 4.1.3 Status Messages (AA)](https://www.w3.org/TR/WCAG22/#status-messages)).

---

## 7. Design tokens

All contrast ratios below were computed with the WCAG relative-luminance formula and contrast-ratio definition `(L1 + 0.05) / (L2 + 0.05)` as specified in [WCAG 2.2 — contrast ratio](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) **[P]**. Ratios are stated to two decimals.

**App background tokens used as reference surfaces:**

- `surface/base` = **`#FFFFFF`**
- `surface/canvas` = **`#F6F7F9`** (the editor's working background)
- Dark: `surface/base-dark` = **`#161A21`**, `surface/canvas-dark` = **`#0E1116`**

### 7.1 Colour — light theme

| Token | Hex | On `#FFFFFF` | On canvas `#F6F7F9` | Use | Requirement met |
| --- | --- | --- | --- | --- | --- |
| `text/primary` | **`#14161A`** | **18.11:1** | **16.90:1** | Body, headings, resume content in UI | AAA (≥7:1) |
| `text/secondary` | **`#454B57`** | **8.76:1** | **8.17:1** | Labels, helper text, metadata | AAA |
| `text/tertiary` | **`#5A6172`** | **6.20:1** | **5.78:1** | Timestamps, captions | AA + AAA-for-large |
| `text/muted` | **`#6B7280`** | **4.83:1** | **4.51:1** | Placeholder text, disabled-adjacent meta | AA (≥4.5:1) — **the floor for body text** |
| `action/primary` | **`#2354D6`** | **6.34:1** | **5.92:1** | Primary buttons, links, active states | AA + AAA-for-large |
| `action/primary-hover` | **`#1B3FA8`** | **9.04:1** | **8.43:1** | Hover/pressed | AAA |
| `action/primary-subtle` | **`#2F6BF0`** | **4.69:1** | **4.37:1** | Non-text accents only; not for body text on canvas | AA on white only |
| `status/success-text` | **`#12603C`** | **7.60:1** | **7.09:1** | "Reads cleanly", pass counts | AAA |
| `status/warning-text` | **`#8A4B08`** | **6.79:1** | **6.34:1** | Advisories | AAA |
| `status/danger-text` | **`#A32118`** | **7.53:1** | **7.03:1** | Hard errors, destructive | AAA |
| `border/subtle` | **`#E4E7EC`** | 1.24:1 | 1.16:1 | Decorative dividers only | **Not a control boundary** |
| `border/strong` | **`#CBD2DC`** | 1.52:1 | 1.42:1 | Section rules in the preview | Decorative |
| `border/control` | **`#7C8493`** | **3.76:1** | **3.51:1** | **Input/select/checkbox boundaries** | **SC 1.4.11 (≥3:1)** |
| `focus/ring` | **`#2354D6`** | **6.34:1** | **5.92:1** | Focus indicator | Change-of-contrast 6.34:1 ≫ 3:1 required |
| `fill/neutral-tint` | **`#F1F3F7`** | 1.11:1 | — | Zebra rows, quiet panels | Decorative; `#14161A` on it = **16.30:1** |

**Tinted status surfaces (badges, cards):**

| Pair | Ratio |
| --- | --- |
| `#12603C` on `#E9F7EF` (success tint) | **6.88:1** |
| `#8A4B08` on `#FDF6E7` (warning tint) | **6.31:1** |
| `#A32118` on `#FDECEA` (danger tint) | **6.59:1** |
| `#1B3FA8` on `#EAF0FE` (primary tint) | **7.92:1** |
| `#FFFFFF` on `#2354D6` (button) | **6.34:1** |
| `#FFFFFF` on `#1B3FA8` (button hover) | **9.04:1** |

**Two warnings from the computation:**

- **`#767E8C` (4.09:1 on white, 3.82:1 on canvas) FAILS AA for body text.** It is only permissible for large text (≥24 px, or ≥18.66 px bold) under [SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). It is therefore **not** a token in this system.
- **`#949BA6` (2.80:1) fails everything.** Do not use it for text or for control boundaries.
- **`#8A919E` scores 3.17:1 on white but 2.96:1 on the canvas** — it passes on white and fails on `#F6F7F9`. Because we cannot guarantee which surface a control sits on, the control border token is `#7C8493`, which passes on both.

### 7.2 Colour — dark theme

Dark mode is **not** an inversion. Surfaces are raised by lightness (a "surface container" approach consistent with Material 3's dark-theme guidance that elevation is expressed through surface tint rather than shadow alone — [Material 3 — Elevation](https://m3.material.io/styles/elevation/overview) **[P]**), and accent colours are lightened to preserve contrast on dark surfaces.

| Token | Hex | On `#161A21` | On `#0E1116` | Requirement |
| --- | --- | --- | --- | --- |
| `text/primary-dark` | **`#E9ECF1`** | **14.73:1** | **15.97:1** | AAA |
| `text/secondary-dark` | **`#C3CAD6`** | **10.58:1** | **11.47:1** | AAA |
| `text/tertiary-dark` | **`#9AA3B2`** | **6.86:1** | **7.43:1** | AAA-for-large, AA everywhere |
| `action/primary-dark` | **`#7FA8FF`** | **7.43:1** | **8.06:1** | AAA |
| `action/primary-dark-hover` | **`#9CC0FF`** | **9.47:1** | **10.26:1** | AAA |
| `status/success-dark` | **`#5FD39B`** | **9.37:1** | **10.16:1** | AAA |
| `status/warning-dark` | **`#F0B45A`** | **9.45:1** | **10.25:1** | AAA |
| `status/danger-dark` | **`#FF8A80`** | **7.64:1** | **8.28:1** | AAA |
| `border/subtle-dark` | **`#2C333F`** | 1.37:1 | 1.49:1 | Decorative |
| `border/strong-dark` | **`#3A4351`** | 1.75:1 | 1.89:1 | Decorative |
| `border/control-dark` | **`#616D80`** | **3.33:1** | **3.61:1** | **SC 1.4.11** |
| `focus/ring-dark` | **`#7FA8FF`** | **7.43:1** | **8.06:1** | Change-of-contrast ≫ 3:1 |

**Strategy.** Ship **light / dark / system**, default **system**. Respect `prefers-color-scheme` and `prefers-contrast`. Never apply a CSS filter to fake dark mode — that breaks contrast guarantees and images. Critically, **the resume page itself is paper in both themes**: the preview sheet stays `#FFFFFF` with `#14161A` ink even in dark mode, because the PDF will be printed on white paper. The chrome around it darkens. This is the honest representation and it prevents the "it looked different in dark mode" class of complaint.

### 7.3 Typography — the **app UI** (not the resume)

**Pairing recommendation.**

| Role | Family | Fallback stack | Why |
| --- | --- | --- | --- |
| **UI + display** | **Inter** | `Inter, "Segoe UI", Roboto, -apple-system, "Helvetica Neue", Arial, sans-serif` | Designed for screen UI at small sizes; unambiguous `1/l/I` and `0/O`; variable weights; open licence so the app has no webfont cost or privacy/legal exposure. |
| **Numeric / data** | **Inter with `font-variant-numeric: tabular-nums`** | same | Check counts, scores, dates and page numbers must not jitter as they change. |
| **Editor body (long-form)** | **Source Serif 4** *(optional, Write mode only)* | `"Source Serif 4", Georgia, "Times New Roman", serif` | Long-form writing benefits from a serif; scoping it to the writing surface preserves the UI's crispness. |
| **Monospace (URLs, raw parser text)** | **JetBrains Mono** | `"JetBrains Mono", ui-monospace, "SF Mono", Consolas, monospace` | Used in `What a parser reads` and in URL fields. |

**Scale (px / line-height / weight / letter-spacing).** A 1.25-ish modular scale, floored at 14 px for body copy. Compare the shapes of the systems surveyed: Carbon's spacing/typography relationship, where "the spacing scale complements the 2x Grid and typography scale by using multiples of two, four, and eight" ([Carbon — Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) **[P]**); GOV.UK's own type-scale guidance ([GOV.UK — updated type scale](https://design-system.service.gov.uk/get-started/new-type-scale/) **[P]**); and Material 3's tokenised roles ([Material 3 — Type scale tokens](https://m3.material.io/styles/typography/type-scale-tokens) **[P]**).

| Token | Size / line-height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `type/display` | 32 / 40 px | 600 | −0.02 em | Marketing/onboarding headings |
| `type/h1` | 24 / 32 px | 600 | −0.01 em | Page title |
| `type/h2` | 20 / 28 px | 600 | −0.01 em | Section heading |
| `type/h3` | 16 / 24 px | 600 | 0 | Card/panel heading |
| `type/body` | **14 / 22 px** | 400 | 0 | Default UI text |
| `type/body-strong` | 14 / 22 px | 600 | 0 | Emphasis, labels |
| `type/small` | 13 / 20 px | 400 | 0 | Helper text, metadata |
| `type/caption` | 12 / 16 px | 500 | 0.01 em | Badges, timestamps |
| `type/mono` | 13 / 20 px | 400 | 0 | Parser view, URLs |

**Rules.** Body text never below **14 px** in the app chrome. Line height in the range **1.4–1.6** for body (14/22 = 1.57). Never rely on font weight alone to convey state. Support [SC 1.4.12 Text Spacing (AA)](https://www.w3.org/TR/WCAG22/#text-spacing): line height ≥1.5×, paragraph spacing ≥2×, letter spacing ≥0.12 em, word spacing ≥0.16 em must all be settable without loss of content.

### 7.4 Spacing, radius, elevation, motion

**Spacing scale (px).** A 4 px base with an 8 px rhythm, closely modelled on Carbon's token scale — `$spacing-01` 2 px · `02` 4 · `03` 8 · `04` 12 · `05` 16 · `06` 24 · `07` 32 · `08` 40 · `09` 48 · `10` 64 ([Carbon — Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) **[P]**) — and cross-checked against Atlassian's spacing foundation ([Atlassian — Spacing](https://atlassian.design/foundations/spacing) **[P]**) and Polaris's layout tokens ([Polaris — Layout tokens](https://polaris-react.shopify.com/design/layout/layout-tokens) **[P]**).

| Token | px | Typical use |
| --- | --- | --- |
| `space/0` | 0 | — |
| `space/1` | **4** | Icon-to-label gap |
| `space/2` | **8** | Inside inputs; badge padding |
| `space/3` | **12** | Field vertical gap |
| `space/4` | **16** | Card padding; gutter |
| `space/5` | **24** | Panel padding; between groups |
| `space/6` | **32** | Between sections |
| `space/7` | **48** | Page-level separation |
| `space/8` | **64** | Empty-state breathing room |

**Border radius (px).** Modelled on the Material 3 corner-radius scale — none 0, extra-small 4, small 8, medium 12, large 16, extra-large 28 ([Material 3 — Shape / corner radius](https://m3.material.io/styles/shape/corner-radius-scale) **[P]**) — narrowed for a document tool, which should read as crisp rather than pill-shaped.

| Token | px | Use |
| --- | --- | --- |
| `radius/xs` | **2** | Badges, tags |
| `radius/sm` | **4** | Inputs, buttons, chips |
| `radius/md` | **8** | Cards, popovers, the preview sheet |
| `radius/lg` | **12** | Modals, bottom sheets |
| `radius/full` | **9999** | Avatars, switches only |

Reserve `radius/full` for genuinely circular things. A button radius of 9999 px reads as consumer-social, not professional tooling.

**Elevation.** Shadows are used **sparingly and only to express layering**, never decoration — light comes from above, one consistent direction, and dark mode replaces shadows with surface lightening (Material 3's approach: [Elevation](https://m3.material.io/styles/elevation/overview) **[P]**).

| Level | Light shadow | Dark treatment | Use |
| --- | --- | --- | --- |
| `elev/0` | none; 1 px `border/subtle` | none | Cards, the editor panel |
| `elev/1` | `0 1px 2px rgba(20,22,26,.06), 0 1px 1px rgba(20,22,26,.04)` | `#1B212B` surface | Sticky toolbars, the preview sheet |
| `elev/2` | `0 4px 8px rgba(20,22,26,.08), 0 1px 2px rgba(20,22,26,.06)` | `#202836` surface | Popovers, dropdowns, the splitter on hover |
| `elev/3` | `0 12px 24px rgba(20,22,26,.12), 0 2px 4px rgba(20,22,26,.08)` | `#252E3D` surface | Modals, command bar |

The floating preview sheet sits at `elev/1` on `surface/canvas`; **the sheet itself is the only "paper" surface in the app** and always renders `#FFFFFF` with a 1 px `border/strong` edge.

**Motion.** Durations and easing follow the "fast, purposeful, interruptible" convention found in enterprise systems ([Carbon — Motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview) **[P]**).

| Token | Value | Use |
| --- | --- | --- |
| `motion/instant` | **80 ms** `ease-out` | Hover/press feedback |
| `motion/fast` | **140 ms** `cubic-bezier(.2,0,.38,.9)` | Dropdowns, tooltips, chip removal |
| `motion/base` | **220 ms** `cubic-bezier(.2,0,.38,.9)` | Panels, drawers, section expand |
| `motion/slow` | **320 ms** `cubic-bezier(.4,0,.2,1)` | Modal entry, mode switch |
| `motion/reduced` | **0.01 ms** | Under `prefers-reduced-motion: reduce` |

### 7.5 Empty states

Empty states are the difference between "this tool is empty" and "this tool is waiting for me." Three rules, following the guidance that an empty state should explain what the space is for, why it is empty, and what to do next ([NN/g — Empty States in Application Design](https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/) **[P]**, [Carbon — Empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) **[P]**):

1. **Never show a bare void.** Every empty region carries a one-line explanation and exactly **one** primary action.
2. **Seed, don't blank.** A new Experience entry arrives with **three empty bullets** (§4.7). A new resume arrives with the section list pre-populated and the Contact section focused.
3. **Make the first action obvious and reversible.** The canonical example: an empty Experience panel reads *"No roles yet — Add your most recent role first; you can reorder later."* with a single **Add role** button. A secondary link reads **"Import from an existing PDF."**

### 7.6 Micro-interactions

| Moment | Behaviour | Constraint |
| --- | --- | --- |
| **Autosave** | Status chip text-swaps `Saving…` → `Saved 14:32`. No spinner after the first save. | No layout shift; `aria-live="polite"`. |
| **Bullet added** | New textarea gets focus; `prefers-reduced-motion` users get no slide, only focus. | Focus moves — announced. |
| **Reorder** | Item lifts (`elev/2`, 1.02 scale); siblings shift in `motion/fast`; drop settles in `motion/base`. | Plus a live-region announcement. Drag is never the only path (§4.4). |
| **Check run** | Findings fade in staggered 30 ms; the pass counter animates **numerically only** (19 → 22), never a circular gauge sweep. | No score count-up from 0. |
| **Fix applied** | Amber highlight flashes on the changed line for 600 ms, then a toast: *"Photo hidden — Undo."* | Toast auto-dismiss ≥8 s (longer than the 5 s default, because Undo must be reachable). |
| **Preview regenerates** | A 2 px progress line at the top of the preview pane. Content never blanks. | No skeleton flash over a rendered page. |
| **Mode switch** | Panels cross-fade `motion/base`; the preview never unmounts. | The page is a constant; only the chrome changes. |
| **Target size** | Every interactive control has a hit area ≥ **32 × 32 px** (visual ≥28 px), exceeding the **24 × 24 CSS px** SC 2.5.8 minimum. | [SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) **[P]** |

---

## 8. Four ATS-safe resume template typographic systems

### 8.0 Font safety: base-14 vs must-embed

This is the most frequently misunderstood part of "ATS-safe typography," so state it precisely.

**PDF standard 14 (base-14) fonts.** ISO 32000 §9.6.2.2 defines them. The exact list, quoted via the iText knowledge base:

> "The PostScript names of 14 Type 1 fonts, known as the standard 14 fonts, are as follows: **Times-Roman, Helvetica, Courier, Symbol, Times-Bold, Helvetica-Bold, Courier-Bold, ZapfDingbats, Times-Italic, Helvetica-Oblique, Courier-Oblique, Times-BoldItalic, Helvetica-BoldOblique, Courier-BoldOblique.** These fonts, or their font metrics and suitable substitution fonts, shall be available to the conforming reader."

([iText KB — Using fonts in pdfHTML, quoting ISO 32000 §9.6.2.2](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]**)

The key word is *shall*: a conforming reader must supply these fonts or their metrics, **so they do not have to be embedded.** The same source explains the consequence of *not* embedding: rendering is left to substitution — "Courier has been replaced by CourierStd, Helvetica has been replaced by ArialMT, and Times-Roman by TimesNewRomanPSMT… Different PDF viewers on different operating systems may use other fonts as the 'Actual Font.' **This can be problematic, for instance when you want to create PDF/A documents.**" ([same](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]**)

**The extraction nuance that decides the recommendation.** Base-14 fonts have **no Unicode mapping**:

> "Using Unicode, or at least providing a *toUnicode* mapping, is considered best practice in PDF. It's a requirement for PDF/A Level U, and it is a requirement in terms of accessibility because Unicode mapping allows the retrieval of semantic properties about every character referenced in the file… **The Standard Type 1 fonts don't have Unicode support, hence Winansi is used instead.**"

([same](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]**)

**Therefore the two legitimate strategies, and when each applies:**

| Strategy | When to use | Trade-off |
| --- | --- | --- |
| **A. Embed a subset + emit a `/ToUnicode` CMap** *(our default)* | All four templates below. | ~15–40 KB per document; guarantees glyphs, guarantees extraction, satisfies PDF/A and PDF/UA ([veraPDF PDF/UA rules](https://github.com/veraPDF/veraPDF-validation-profiles/wiki/PDFUA-Part-1-rules) **[P]**). |
| **B. Specify base-14 only, embed nothing** | A "maximum-compatibility, minimum-size" export option. | Smallest file, guaranteed renderable everywhere — but relies on **substitution** for exact appearance and gives **WinAnsi** encoding, which weakens extraction of accented and non-Latin characters. |

Whichever the user picks, the rule is: **never reference a font that is neither base-14 nor embedded.** A PDF that names a font the reader does not have is the mechanism behind garbled rendering, and changing fonts in a PDF "may result in severe visual changes, as the text may no longer fit into the" layout ([Enfocus preflight documentation](https://www.enfocus.com/manuals/Extra/PreflightChecks/18/pdf/PreflightChecksOverview.pdf) **[P]**).

**Font classification for our templates:**

| Font | Base-14? | Verdict |
| --- | --- | --- |
| **Times New Roman** | Metric-compatible with base-14 **Times-Roman**. The *name* "Times New Roman" is not one of the 14. | **Safe.** Emit as Times-Roman and it needs no embedding; or embed a Times New Roman subset for exact fidelity. |
| **Helvetica** | **Yes** — Helvetica, Helvetica-Bold, Helvetica-Oblique, Helvetica-BoldOblique. | **Safe, no embedding required.** |
| **Courier** | **Yes** — four variants. | Safe; use sparingly (monospace reads oddly in resumes). |
| **Arial** | **No.** Arial is metrically compatible with Helvetica but is a different font and is not in the list. | **Must be embedded**, or the PDF must *specify Helvetica* and let the reader substitute ArialMT. |
| **Georgia, Verdana, Tahoma, Trebuchet MS, Calibri, Cambria, Garamond, Segoe UI** | **No.** | **Must be embedded.** For portable/open alternatives with matching metrics, prefer **Carlito** (metric-compatible with Calibri) or **Caladea** (metric-compatible with Cambria), both open-licensed and embeddable without restriction. |
| **Inter, Roboto, Lato, Open Sans, Source Sans, Noto, IBM Plex** | **No.** | Must be embedded. Fine for the **app UI**; for the resume, embed and verify extraction. |
| **Symbol, ZapfDingbats** | Yes, but with custom encodings. | **Avoid in resumes.** iText notes they "don't play well with HTML" and have custom encoding ([iText KB](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]**). Use a real text character (•, –) instead. |

**Parser-hostile formatting to ban in every template** (this is where the ATS-friendliness promise is actually kept):

- **No multi-column layouts, no text frames, no tables used for layout.** These are the structures that make extracted text come out of order — the exact failure the parser view is designed to reveal ([Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).
- **No content in page headers/footers** — parsers frequently drop or misplace it.
- **No images, icons, logos, photos, or skill-rating bars** as carriers of meaning. (Reactive Resume surfaces "whether a photo is showing" as a check at all — [Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**.)
- **No ligatures or discretionary ligatures** (`font-variant-ligatures: none`), because an `fi` ligature can extract as a single unmapped glyph.
- **No letter-spacing beyond 0.05 em**, and **no small caps** (`font-variant-caps`) — both are known to introduce or destroy spacing in extracted text.
- **No text-as-outlines.** Ever.
- **Section headings must be plain text** matching parser vocabulary: Experience, Education, Skills, Projects, Certifications ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).

### 8.1 Template 1 — **Meridian** (classic serif, maximum compatibility)

| Property | Value |
| --- | --- |
| Intended for | Law, academia, finance, public sector, conservative industries |
| Body font | **Times New Roman** (emitted as base-14 **Times-Roman**, with optional embedded subset) |
| Name | Times-Bold **20 pt** / 24 pt line height, letter-spacing 0 |
| Section headings | Times-Bold **11.5 pt**, uppercase, letter-spacing **0.04 em**, 1 px rule beneath in `#1A1A1A` |
| Entry title | Times-Bold **11 pt** |
| Entry meta (employer · location · dates) | Times-Roman **10.5 pt**, `#333333` (**12.63:1** on paper white) |
| Body / bullets | Times-Roman **10.5 pt** / **13.5 pt** line height (**1.29**) |
| Bullet glyph | A literal `•` **followed by a real space**, 0.18 in hanging indent |
| Margins | **1.0 in** top, **1.0 in** bottom, **0.9 in** left/right |
| Paper | **Letter 8.5 × 11 in** (A4 variant: 210 × 297 mm, margins 2.5 cm / 2.2 cm) |
| Rules | Section rules **0.5 pt** `#1A1A1A`; no boxes, no fills |
| Ink | `#1A1A1A` (**17.40:1** on `#FFFFFF`) |
| Max pages | 1 (≤10 yrs) / 2 |
| Embedding | None required (base-14). If embedded for fidelity/PDF-A, mount a `/ToUnicode` CMap. |

**Why this is safe.** Times-Roman is in the standard 14 ([iText KB](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]**), so a reader must supply it; the layout is a single text column with no tables, frames, or graphics.

### 8.2 Template 2 — **Ledger** (neutral sans, ATS default)

| Property | Value |
| --- | --- |
| Intended for | Technology, operations, business, most corporate applications |
| Body font | **Helvetica** (base-14, no embedding) — or **Arial embedded** if the visual match matters |
| Name | Helvetica-Bold **22 pt** / 26 pt, letter-spacing **−0.01 em** |
| Section headings | Helvetica-Bold **11 pt**, letter-spacing **0.05 em**, uppercase, `#14161A`, 0.75 pt rule `#2354D6` optional |
| Entry title | Helvetica-Bold **11 pt**; dates right-aligned **on the same line** using a right tab stop (not a table) |
| Body / bullets | Helvetica **10.5 pt** / **14 pt** (**1.33**) |
| Bullet glyph | `•` + space, 0.2 in hanging indent, **6 pt** space after each bullet |
| Margins | **0.8 in** all sides |
| Paper | Letter / A4 |
| Ink | `#14161A` (**18.11:1** on white); accent `#2354D6` used only on the rule and link text (**6.34:1**) |
| Max pages | 1–2 |
| Embedding | Helvetica: none. Arial: **must embed** (not base-14). |

**Note on the tab stop.** Right-aligned dates on the same line as the title must be produced with a **tab stop**, never a two-column table — a table produces a cell-based content stream that parsers may read column-by-column instead of line-by-line.

### 8.3 Template 3 — **Signal** (humanist sans, emphasised hierarchy)

| Property | Value |
| --- | --- |
| Intended for | Design-adjacent, marketing, product, startups — a resume that looks considered without being decorative |
| Body font | **Arial** (embedded subset) at 10 pt, or **Helvetica** base-14 |
| Name | **Verdana Bold** *(embedded)* **24 pt** / 28 pt — or Arial Bold 24 pt if the user selects the "no-embed" variant |
| Section headings | Arial Bold **10.5 pt**, `#1B3FA8` (**9.04:1** on white), letter-spacing **0.05 em**, uppercase, with a **0.5 pt full-width rule** in `#CBD2DC` |
| Entry title | Arial Bold **10.5 pt**; dates in Arial Regular **9.5 pt** `#454B57` (**8.76:1**) on the line below the employer |
| Body / bullets | Arial **10 pt** / **13.5 pt** (**1.35**) |
| Bullet glyph | En dash `–` + space is **not** used; use `•` + space. 0.2 in hanging indent |
| Margins | **0.75 in** all sides |
| Paper | Letter / A4 |
| Accent policy | Colour is confined to **headings and rules**, never to body text, and never used to convey meaning |
| Max pages | 1–2 |
| Embedding | **Arial and Verdana are NOT base-14 and must be embedded.** Ship an explicit "no-embed (Helvetica)" variant for users whose pipeline rejects embedded fonts. |

**Warning attached to this template in-product:** Verdana is wide; at 24 pt it can push a long name to two lines. The editor must show an overflow warning rather than silently wrapping.

### 8.4 Template 4 — **Density** (high-density, long careers)

| Property | Value |
| --- | --- |
| Intended for | 15+ years of experience, academic CVs, federal/public-sector resumes where length is expected |
| Body font | **Arial** (embedded) at **9.5 pt** / **12 pt** (**1.26**) — or Times-Roman base-14 at 10 pt / 12.5 pt |
| Name | Arial Bold **18 pt** / 22 pt |
| Section headings | Arial Bold **10 pt**, uppercase, letter-spacing **0.04 em**, with a **0.5 pt** rule `#1A1A1A`, **12 pt** space before / **4 pt** after |
| Entry block | Employer + title on one line; location + dates on the next, `#333333` **9 pt** |
| Bullets | **9.5 pt** / **12 pt**, 4 pt between bullets, 0.17 in hanging indent |
| Margins | **0.6 in** top/bottom, **0.65 in** left/right |
| Paper | Letter / A4 |
| Ink | `#1A1A1A` — **17.40:1** on white |
| Max pages | 2–3, with page-2+ headers off by default |
| Embedding | Arial: **must embed**. Times: base-14, no embedding. |

**Guardrail.** 9.5 pt is the floor. Below that, the layout check should fire a hard finding — Reactive Resume's Layout category explicitly checks that "body text size, line height and page margins aren't too small" ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**). Our thresholds: **body ≥ 9.5 pt**, **line height ≥ 1.15**, **margins ≥ 0.5 in**.

### 8.5 Cross-template rules

1. **One column, always.** The two-column "sidebar" pattern is the single most common parser failure. The check literally reads "**Sidebar is read after the main column**" ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**).
2. **Contact details as plain text on their own lines**, never in a header/footer region and never in a text box.
3. **Dates in one consistent, unambiguous format** — `MM/YYYY` or `Mon YYYY` — never numeric-only `03/04/2024`.
4. **Hyphen and dash characters:** use the ASCII hyphen for date ranges if you want maximum parser safety; en dashes are generally fine but must be embedded correctly (see the encoding discussion above).
5. **Every template must pass its own parser check** before it ships. The check is the specification.

---

## 9. Keyboard map

Design principles: (a) never override a browser or OS shortcut the user needs; (b) every pointer action has a keyboard equivalent ([SC 2.1.1](https://www.w3.org/TR/WCAG22/#keyboard)); (c) every reorder has single-key stepwise movement ([SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]** + [G219](https://www.w3.org/WAI/WCAG22/Techniques/general/G219) **[P]**); (d) `?` opens the shortcut sheet, and **every** shortcut is discoverable there and from the command bar.

### 9.1 Global

| Shortcut | Action | Notes |
| --- | --- | --- |
| `Ctrl/Cmd + S` | Flush save now | Idempotent; shows the status chip. Never a file dialog. |
| `Ctrl/Cmd + Z` | Undo | Field-level while editing text; app-level for structural changes |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo | Both bindings; `Ctrl+Y` for Windows muscle memory |
| `Ctrl/Cmd + K` | Open command bar | Fuzzy search over sections, templates, checks, actions |
| `Ctrl/Cmd + P` | Generate + open PDF | Intercepted from browser print; offers "System print" as a secondary action |
| `Ctrl/Cmd + /` | Toggle shortcut sheet | Also `?` when not in a text field |
| `Ctrl/Cmd + Shift + D` | Toggle light/dark/system | Honours `prefers-color-scheme` when set to system |
| `F6` | Cycle panes (editor ↔ preview ↔ issue list) | Optional APG behaviour; also satisfies [SC 2.4.1 Bypass Blocks (A)](https://www.w3.org/TR/WCAG22/#bypass-blocks) alongside the skip link |
| `Esc` | Close topmost overlay; blur the current field | Never discards unsaved edits |

### 9.2 Modes and navigation

| Shortcut | Action |
| --- | --- |
| `1` / `2` / `3` (outside a text field) | Switch to **Write** / **Design** / **Check** |
| `Ctrl/Cmd + Alt + ↑ / ↓` | Previous / next section |
| `Alt + ↑ / ↓` | Previous / next entry within the current section |
| `Ctrl/Cmd + PgDn` / `PgUp` | Next / previous preview page |
| `Home` / `End` (in the section rail) | First / last section |

*(Numeric mode switching with the guard "when you aren't typing in a field" follows a shipped convention: "select **Check**, or press `3` when you aren't typing in a field" — [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**.)*

### 9.3 Editing content

| Shortcut | Action | Context |
| --- | --- | --- |
| `Enter` | Split the bullet at the caret; on the **last, empty** bullet → create a new bullet | Inside a bullet |
| `Shift + Enter` | Soft line break inside the current bullet | Inside a bullet |
| `Backspace` | On an **empty** bullet → delete it and place the caret at the end of the previous bullet | Inside an empty bullet |
| `Tab` / `Shift + Tab` | Move to the next / previous field | **Never** inserts a tab character in a bullet |
| `Ctrl/Cmd + B` / `I` | Bold / italic on the selection | Rich-text bullets only |
| `Ctrl/Cmd + K` | Insert/edit a link on the selection | Inside a field; the global command bar takes `Ctrl/Cmd + K` only when focus is outside a field |
| `Alt + ↑ / ↓` | Move the **current bullet** up/down one position | Inside a bullet |
| `Ctrl/Cmd + Shift + ↑ / ↓` | Move the **current section or entry** up/down one position | Focus on the entry header |
| `Ctrl/Cmd + Enter` | "Done with this entry" — collapse and move to the next entry | Anywhere in an entry |
| `Ctrl/Cmd + Shift + Enter` | Insert a new bullet **below** the current one | Inside a bullet |

### 9.4 Reordering and selection (the 2.5.7 surface)

| Shortcut | Action | Requirement satisfied |
| --- | --- | --- |
| `Ctrl/Cmd + Shift + ↑ / ↓` | Move focused item one position; **focus follows the item** | [SC 2.1.1](https://www.w3.org/TR/WCAG22/#keyboard) |
| `Home` / `End` | Move focused item to first / last position | [SC 2.1.1](https://www.w3.org/TR/WCAG22/#keyboard) |
| `Space` on the drag handle | **Grab** mode: subsequent `↑/↓` move the item, `Enter`/`Space` drops, `Esc` cancels | Keyboard equivalent of drag |
| `Delete` | Delete focused entry as a whole (with an 8 s Undo toast) | [SC 3.3.4 (AA)](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data) |
| `Move up` / `Move down` **buttons** | Stepwise repositioning with a single pointer, always visible on focus | **[SC 2.5.7 (AA)](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) — this is the conformance path** |

Every move announces through `aria-live="polite"`: *"Senior Engineer, moved to position 2 of 4."* ([SC 4.1.3 (AA)](https://www.w3.org/TR/WCAG22/#status-messages)).

### 9.5 Preview panel

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Shift + =` / `Ctrl/Cmd + Shift + -` | Preview zoom in / out |
| `Ctrl/Cmd + Shift + 0` | Reset preview zoom to **Fit width** |
| `Ctrl/Cmd + Shift + F` | Toggle **Fit width** / **Fit page** |
| `Ctrl/Cmd + Shift + S` | Toggle scroll sync |
| `Ctrl/Cmd + Shift + P` | Toggle **What a person sees** / **What a parser reads** |
| `Arrow Left` / `Arrow Right` (splitter focused) | Resize panes — APG Window Splitter |
| `Enter` (splitter focused) | Collapse / restore the primary pane |
| `Home` / `End` (splitter focused) | Primary pane to minimum / maximum |
| `Double-click` the splitter | Reset to 50 / 50 (pointer affordance only; the keyboard path is `Home`/`End` then arrows) |

### 9.6 Check mode

| Shortcut | Action |
| --- | --- |
| `J` / `K` | Next / previous issue |
| `Enter` | **Show on page** for the focused issue |
| `F` | Apply the focused issue's one-click fix |
| `I` | **Ignore** the focused issue; `Shift + I` restores all ignored issues |
| `A` / `R` | Accept / reject the focused AI rewrite (**only when an AI suggestion is focused**) |
| `↑` / `↓` | Move between AI suggestions (only when the Writing tab has suggestions) |

*(Letter-key conventions in Check mode follow a shipped pattern: "With an edit focused, `A` accepts it, `R` rejects it, and `↑` `↓` move between edits" — [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**.)*

### 9.7 Focus management plan

| Situation | Behaviour | Criterion |
| --- | --- | --- |
| **Skip link** | First focusable element: "Skip to editor" / "Skip to preview" | [2.4.1 Bypass Blocks (A)](https://www.w3.org/TR/WCAG22/#bypass-blocks) |
| **Mode switch** | Focus moves to that mode's `<h1>` (with `tabindex="-1"`), announced. Focus is **never** lost to `<body>`. | [2.4.3 Focus Order (A)](https://www.w3.org/TR/WCAG22/#focus-order) |
| **Section expand/collapse** | Focus stays on the section header toggle; `aria-expanded` flips. | [4.1.2 Name, Role, Value (A)](https://www.w3.org/TR/WCAG22/#name-role-value) |
| **Adding a bullet / entry** | Focus moves into the **new** field's first line. | [2.4.3 (A)](https://www.w3.org/TR/WCAG22/#focus-order) |
| **Deleting a bullet / entry** | Focus moves to the previous sibling; if none, to the "Add" control. Never to `<body>`. | [2.4.3 (A)](https://www.w3.org/TR/WCAG22/#focus-order) |
| **Reorder** | Focus **follows the moved item**. | [2.4.3 (A)](https://www.w3.org/TR/WCAG22/#focus-order) |
| **Validation error** | Focus moves to the **error summary** (`role="alert"`), which links to each offending field. | [GOV.UK Error summary](https://design-system.service.gov.uk/components/error-summary/) **[P]**, [3.3.1 (A)](https://www.w3.org/TR/WCAG22/#error-identification) |
| **Modals / dialogs** | Focus trap; `Esc` closes; focus returns to the invoking element; background inert. | [2.1.2 No Keyboard Trap (A)](https://www.w3.org/TR/WCAG22/#no-keyboard-trap) |
| **Toasts** | Never steal focus; use `role="status"` / `aria-live="polite"`; the Undo action is reachable by a documented shortcut (`Ctrl/Cmd + Z`). | [4.1.3 Status Messages (AA)](https://www.w3.org/TR/WCAG22/#status-messages) |
| **Sticky toolbars** | The focused element must never be hidden behind the sticky editor bar or a floating action bar; use `scroll-margin-top` equal to the bar height. | **[2.4.11 Focus Not Obscured (Minimum) (AA)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)** |
| **Focus indicator** | A **2 px solid** `#2354D6` outline with a **2 px white/offset gap** (`outline-offset: 2px`), so it is visible on any background. | **[2.4.13 Focus Appearance (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)** — "at least as large as the area of a 2 CSS pixel thick perimeter of the unfocused component," with "a contrast ratio of at least 3:1 between the same pixels in the focused and unfocused states." Our token gives **6.34:1** change-of-contrast on white. |
| **Splitter focus** | The splitter is focusable with `role="separator"`, `aria-valuenow/min/max`, `aria-controls`. | [APG Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) **[P]**, [4.1.2 (A)](https://www.w3.org/TR/WCAG22/#name-role-value) |

**Focus-appearance implementation note.** WCAG 2.4.13's own documentation warns that indicators *inset* from the component edge must be thicker than 2 px to meet the minimum-area requirement, whereas outset/outline/border indicators pass at 2 px ([Understanding SC 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) **[P]**). We therefore use `outline-offset: 2px` (outset), not an inset ring. Where a two-colour indicator is needed on variable backgrounds, technique **C40** ("Creating a two-color focus indicator to ensure sufficient contrast with all components") is the documented sufficient technique ([C40](https://www.w3.org/WAI/WCAG22/Techniques/css/C40) **[P]**); **G195** (author-supplied visible focus indicator) and **C41** (strong focus indicator within the component) are the alternatives ([G195](https://www.w3.org/WAI/WCAG22/Techniques/general/G195) **[P]**, [C41](https://www.w3.org/WAI/WCAG22/Techniques/css/C41) **[P]**).

---

## 10. WCAG 2.2 checklist

Levels: **A** = minimum, **AA** = target conformance for this product, **AAA** = aspirational, adopted where cheap and high-value. Normative text: [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) **[P]**; quick lookup: [How to Meet WCAG Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) **[P]**.

### 10.1 New in WCAG 2.2 — required for any conformance claim

| SC | Name | Level | Requirement, in the product's terms | Our implementation |
| --- | --- | --- | --- | --- |
| **2.4.11** | Focus Not Obscured (Minimum) | AA | A focused component must not be *entirely* hidden by author-created content | Sticky bars reserve space; `scroll-margin-top` on all focusables ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) **[P]**) |
| **2.4.12** | Focus Not Obscured (Enhanced) | AAA | No part of the focused component is hidden | Aspirational; the floating action bar auto-hides on keyboard focus |
| **2.5.7** | Dragging Movements | AA | All drag functionality achievable by a single pointer without dragging | Three-path reorder: drag + always-available Move buttons + keyboard (§4.4) ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**, [G219](https://www.w3.org/WAI/WCAG22/Techniques/general/G219) **[P]**, avoid [F108](https://www.w3.org/WAI/WCAG22/Techniques/failures/F108) **[P]**) |
| **2.5.8** | Target Size (Minimum) | AA | ≥ **24 × 24 CSS px**, or sufficient spacing (24 px circles must not intersect) | Buttons 32 × 32 px hit area; technique [C42](https://www.w3.org/WAI/WCAG22/Techniques/css/C42) **[P]** ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) **[P]**) |
| **3.2.6** | Consistent Help | A | Help mechanisms appear in a consistent relative order across pages | Help/`?` is always the last item in the editor bar and the first item in the user menu ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html) **[P]**) |
| **3.3.7** | Redundant Entry | A | Previously entered information must be auto-populated or selectable | Shared contact details, employer and date reuse across entries; "same as previous role" control ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) **[P]**, [G221](https://www.w3.org/WAI/WCAG22/Techniques/general/G221) **[P]**) |
| **3.3.8** | Accessible Authentication (Minimum) | AA | No cognitive function test for login; allow paste and password managers | Passkeys, magic-link, paste-enabled OTP fields, `autocomplete="current-password"` / `"one-time-code"`; **never** block paste ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) **[P]**) |

*(SC 2.4.13 Focus Appearance is **AAA**, not AA — but we adopt it deliberately because focus visibility is load-bearing in a dense editor. Note that 2.4.13 is listed under the "new in 2.2" heading in many summaries; its level is AAA.)*

### 10.2 Perceivable

| SC | Name | Level | Application |
| --- | --- | --- | --- |
| 1.1.1 | Non-text Content | A | All icons have accessible names; no meaning carried by an image alone |
| 1.3.1 | Info and Relationships | A | Section/entry/bullet is real `<section>`/`<ul>`/`<li>` structure; labels bound to inputs |
| 1.3.2 | Meaningful Sequence | A | DOM order matches visual order in both the editor and the preview |
| 1.3.4 | Orientation | AA | Editor and preview work in portrait and landscape; no orientation lock |
| 1.3.5 | Identify Input Purpose | AA | `autocomplete` on name, email, phone, organisation, job title |
| 1.4.1 | Use of Color | A | Status always carries an icon **and** text, never colour alone |
| **1.4.3** | **Contrast (Minimum)** | **AA** | **4.5:1 body, 3:1 large (≥24 px, or ≥18.66 px bold).** Our `text/muted` floor is **4.83:1** on white and **4.51:1** on canvas — see §7.1 ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) **[P]**) |
| 1.4.4 | Resize Text | AA | 200 % browser zoom with no loss; app zoom is *additional*, never a substitute |
| 1.4.5 | Images of Text | AA | Never render resume text as an image; the preview is real text |
| 1.4.10 | Reflow | AA | Usable at **320 CSS px** with no two-dimensional scrolling ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) **[P]**) |
| **1.4.11** | **Non-text Contrast** | **AA** | **3:1** for control boundaries and state indicators. `border/control` = **3.76:1** on white, **3.51:1** on canvas ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) **[P]**) |
| 1.4.12 | Text Spacing | AA | No clipping at line-height 1.5×, paragraph 2×, letter-spacing 0.12 em, word-spacing 0.16 em |
| 1.4.13 | Content on Hover or Focus | AA | Any tooltip is **dismissible, hoverable, persistent**. Error text is never a tooltip ([Understanding](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) **[P]**) |

### 10.3 Operable

| SC | Name | Level | Application |
| --- | --- | --- | --- |
| 2.1.1 | Keyboard | A | Every function keyboard-operable, including reorder, zoom, page nav, and all check actions |
| 2.1.2 | No Keyboard Trap | A | Modals, the command bar, and the parser view all release focus on `Esc` |
| 2.1.4 | Character Key Shortcuts | A | Single-key shortcuts (`1/2/3`, `J/K`, `F`, `I`, `A/R`) are **only active outside text fields**, and can be turned off or remapped in Settings |
| 2.2.1 | Timing Adjustable | A | No session timeouts that discard work; autosave means there is nothing to lose |
| 2.2.2 | Pause, Stop, Hide | A | Scroll sync, animations and auto-advancing UI are user-controllable |
| 2.3.1 | Three Flashes or Below Threshold | A | No flashing; the fix-confirmation highlight is a single 600 ms fade |
| 2.4.1 | Bypass Blocks | A | Skip links to editor and preview |
| 2.4.2 | Page Titled | A | Title reflects the document name; prefixed `Error: ` on validation failure ([GOV.UK validation](https://design-system.service.gov.uk/patterns/validation/) **[P]**) |
| 2.4.3 | Focus Order | A | Focus order follows reading order; focus follows moved/reordered items |
| 2.4.4 | Link Purpose (In Context) | A | No bare "click here"; links name their destination |
| 2.4.6 | Headings and Labels | AA | One `<h1>` per mode; labels are descriptive |
| 2.4.7 | Focus Visible | AA | Always-visible 2 px `#2354D6` outline with a 2 px offset gap |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | *(see §10.1)* |
| 2.4.13 | Focus Appearance | AAA | Adopted: 2 px outset ring, 6.34:1 change-of-contrast |
| 2.5.1 | Pointer Gestures | A | No path-based or multipoint gestures required |
| 2.5.2 | Pointer Cancellation | A | Actions fire on `pointerup`, not `pointerdown`; drag is cancellable with `Esc` |
| 2.5.3 | Label in Name | A | Visible button text is contained in the accessible name (do not use `aria-label="Edit entry"` on a button reading "Edit role") |
| 2.5.4 | Motion Actuation | A | No device-motion or user-motion input |
| 2.5.7 | Dragging Movements | AA | *(see §10.1)* |
| 2.5.8 | Target Size (Minimum) | AA | *(see §10.1)* |

### 10.4 Understandable

| SC | Name | Level | Application |
| --- | --- | --- | --- |
| 3.1.1 | Language of Page | A | `<html lang>` set from the resume's language setting |
| 3.2.1 | On Focus | A | Focusing any control never changes context unexpectedly |
| 3.2.2 | On Input | A | Changing a field never auto-submits or navigates |
| 3.2.3 | Consistent Navigation | AA | Mode switcher and user menu in the same place in every mode |
| 3.2.4 | Consistent Identification | AA | "Add bullet" is always called "Add bullet" |
| 3.2.6 | Consistent Help | A | *(see §10.1)* |
| 3.3.1 | Error Identification | A | Errors are described in text, adjacent to the field, and listed in a `role="alert"` summary ([GOV.UK Error message](https://design-system.service.gov.uk/components/error-message/) **[P]**) |
| 3.3.2 | Labels or Instructions | A | Every field has a persistent visible label — **never** placeholder-only |
| 3.3.3 | Error Suggestion | AA | Every error states how to fix it ("Enter a date in MM/YYYY format") |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | Destructive actions are undoable; account/data deletion requires confirmation |
| 3.3.7 | Redundant Entry | A | *(see §10.1)* |
| 3.3.8 | Accessible Authentication (Minimum) | AA | *(see §10.1)* |

### 10.5 Robust

| SC | Name | Level | Application |
| --- | --- | --- | --- |
| 4.1.2 | Name, Role, Value | A | The splitter is `role="separator"` with `aria-valuenow/min/max`; toggles use `aria-expanded`/`aria-pressed`; the issue list is a real list with states |
| 4.1.3 | Status Messages | AA | Autosave state, reorder results, check results and toasts announce via `aria-live` without stealing focus |

### 10.6 Additional conformance obligations adopted voluntarily

| Obligation | Source | Why |
| --- | --- | --- |
| `prefers-reduced-motion` respected everywhere | [SC 2.3.3 Animation from Interactions (AAA)](https://www.w3.org/TR/WCAG22/#animation-from-interactions) | Low cost, high benefit; a document tool should be calm |
| `prefers-contrast: more` raises text to `#14161A` and borders to a 4.5:1 grey | [SC 1.4.6 Contrast (Enhanced) (AAA)](https://www.w3.org/TR/WCAG22/#contrast-enhanced) | One token swap |
| Forced-colors (Windows High Contrast) verified in CI | [SC 1.4.8 Visual Presentation (AAA)](https://www.w3.org/TR/WCAG22/#visual-presentation) | Dense editors with custom controls break here first |
| PDF/A-2u export with embedded fonts + `/ToUnicode` | [veraPDF PDF/UA rules](https://github.com/veraPDF/veraPDF-validation-profiles/wiki/PDFUA-Part-1-rules) **[P]**, [iText KB](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]** | Makes "parser-readable" a property of the file, not a promise |
| A published Accessibility Conformance Report (ACR/VPAT) at AA | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) **[P]** | Turns the differentiator into a purchasable claim for institutional buyers |

### 10.7 Testing gates (definition of done)

1. **Automated:** axe-core in CI on every route, zero violations at AA.
2. **Contrast:** every token pair in §7 is asserted in a unit test against the computed ratio — the numbers in this document are the test fixtures.
3. **Keyboard-only run-through:** add a role, three bullets, reorder, generate PDF, fix two checks — all without a pointer.
4. **Screen reader matrix:** NVDA + Firefox, JAWS + Chrome, VoiceOver + Safari. Reorder announcements and error-summary focus are the two scenarios that most often fail.
5. **320 px reflow check** at 400 % zoom.
6. **Print-accurate export verification:** render the PDF, extract the text layer, and assert that it matches the preview's reading order. This is the differentiator's own regression test, and it is the one test that must never be allowed to go red.

---

## 11. Recommendation index (one source per commitment)

| # | Commitment | Primary evidence |
| --- | --- | --- |
| 1 | Mode-based sectioned editor, not a wizard | [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) **[P]** |
| 2 | Autosave with local draft recovery and version history | [Reactive Resume README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]** |
| 3 | Structured fields, not `contenteditable` | [MDN — contenteditable](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contenteditable) **[P]** |
| 4 | Three-path reorder (drag + buttons + keyboard) | [Understanding SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) **[P]**, [G219](https://www.w3.org/WAI/WCAG22/Techniques/general/G219) **[P]**, [F108](https://www.w3.org/WAI/WCAG22/Techniques/failures/F108) **[P]** |
| 5 | 24 × 24 px minimum targets, spaced | [Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) **[P]**, [C42](https://www.w3.org/WAI/WCAG22/Techniques/css/C42) **[P]** |
| 6 | Undo over confirmation; ≥100 steps incl. structure | [NN/g — User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/) **[P]** |
| 7 | Blur-validated fields + error summary with focus move | [GOV.UK — Error summary](https://design-system.service.gov.uk/components/error-summary/) **[P]**, [GOV.UK — Validation](https://design-system.service.gov.uk/patterns/validation/) **[P]** |
| 8 | Reuse previously entered data (no redundant entry) | [Understanding SC 3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) **[P]**, [G221](https://www.w3.org/WAI/WCAG22/Techniques/general/G221) **[P]** |
| 9 | APG-conformant resizable splitter | [ARIA APG — Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) **[P]** |
| 10 | One-way, anchor-based scroll sync; `overflow-anchor` | [MDN — overflow-anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor) **[P]** |
| 11 | Paged-media parity between preview and PDF | [MDN — @page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page) **[P]**, [MDN — print-color-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/print-color-adjust) **[P]** |
| 12 | A "what a parser reads" view | [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]** |
| 13 | Cardinal check counts, named categories, pinned findings | [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]** |
| 14 | Explicit "this does not predict shortlisting" disclaimer | [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]** |
| 15 | Ignore / Keep for issues the user disagrees with | [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]** |
| 16 | Recommendations framed as recommendations, with named criteria | [Teal — Resume Analyzer](https://help.tealhq.com/en/articles/9524748-using-the-resume-analyzer) **[P]** |
| 17 | Match score is keyword overlap, not an ATS verdict | [Jobscan support](https://jobscansupport.frontkb.com/en/articles/11537409) **[P]** |
| 18 | Reject the "75 % auto-rejected" framing | [Workday Perspectives](https://www.workday.com/en-us/perspectives/hr/2026/04/debunking-ai-in-hiring-misconceptions.html) **[P]**, [IT Brief](https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth) **[X]** |
| 19 | No watermarks, no download paywall | [FlowCV — About](https://flowcv.com/about) **[P]** |
| 20 | Monochrome-first palette, one accent, AA-verified tokens | [Carbon — Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) **[P]**, computed per [WCAG contrast definition](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) **[P]** |
| 21 | 4 px spacing scale, 8 px rhythm | [Carbon — Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) **[P]**, [Atlassian — Spacing](https://atlassian.design/foundations/spacing) **[P]**, [Polaris — Layout tokens](https://polaris-react.shopify.com/design/layout/layout-tokens) **[P]** |
| 22 | 2 / 4 / 8 / 12 / full radius scale | [Material 3 — Corner radius](https://m3.material.io/styles/shape/corner-radius-scale) **[P]** |
| 23 | Elevation as layering; dark mode via surface tint | [Material 3 — Elevation](https://m3.material.io/styles/elevation/overview) **[P]** |
| 24 | Focus style: 2 px outset ring, ≥3:1 change of contrast | [GOV.UK — Focus states](https://design-system.service.gov.uk/get-started/focus-states/) **[P]**, [Understanding SC 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) **[P]**, [C40](https://www.w3.org/WAI/WCAG22/Techniques/css/C40) **[P]** |
| 25 | Base-14 fonts need no embedding; others must be embedded | [iText KB quoting ISO 32000 §9.6.2.2](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]** |
| 26 | Embed + `/ToUnicode` beats base-14 for *extraction* | [iText KB — encodings](https://kb.itextpdf.com/itext/chapter-6-using-fonts-in-pdfhtml) **[P]**, [veraPDF PDF/UA rules](https://github.com/veraPDF/veraPDF-validation-profiles/wiki/PDFUA-Part-1-rules) **[P]** |
| 27 | Single-column, no tables/frames/headers/footers in resumes | [Reactive Resume — Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]** |
| 28 | One renderer for preview and export | [Reactive Resume README (Forme + PDF.js)](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**, anti-pattern documented at [GoodSpace](https://goodspace.ai/support/resume-builder/pdf-looks-different) **[P]** |
| 29 | Empty states explain, seed, and offer one action | [NN/g — Empty States](https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/) **[P]**, [Carbon — Empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) **[P]** |
| 30 | No manufactured urgency or anxiety in scoring | [deceptive.design](https://www.deceptive.design/) **[P]** |

---

## 12. Open questions for the product team

These are genuine gaps, flagged rather than papered over.

1. **Renderer choice is the whole ballgame.** The guarantee in §5.5 requires a single layout engine that can produce both an interactive on-screen page and a final PDF with the same pagination. Reactive Resume's move to Forme in-browser is the closest public precedent ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**). **Decide this before any editor UI work**; every other commitment in this document is downstream of it.
2. **DOCX export.** Novoresume's PDF-only limitation is a documented user complaint ([Careerkit](https://www.careerkit.me/blog/novoresume-review) **[S]**), and some ATS upload fields ask for Word. Decide whether to support DOCX and, if so, whether the DOCX is generated from the same model (it must be).
3. **Free-tier limits.** We commit to no watermark and a real PDF. The remaining lever is *number of resumes* (FlowCV's approach — [About](https://flowcv.com/about) **[P]**) rather than *quality of output*. Confirm this is commercially acceptable.
4. **A4 vs Letter default** should be inferred from locale, with an explicit, always-visible toggle — page-size changes alter pagination, and the preview must update immediately.
5. **Check-instrument validity.** Every check needs a documented rationale and a test fixture. A check we cannot justify is a check we should not ship; Reactive Resume's public 22-check taxonomy and its category definitions ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**) are a reasonable baseline to audit against.
6. **Where AI is allowed to touch content.** Reactive Resume's guardrail is the right model: proposed edits are shown with what changes and why, and each is accepted or rejected individually ([README](https://raw.githubusercontent.com/AmruthPillai/Reactive-Resume/main/README.md) **[P]**). Its documentation also warns plainly: "A model's opinion can be wrong, and the review never changes the score. Accept only the rewrites that are true to your experience." ([Check guide](https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/docs/guides/checking-your-resume.mdx) **[P]**) Adopt both.
