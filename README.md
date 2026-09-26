# CareThread

CareThread is a browser-based prototype for organizing one person's test orders and reports from one care episode, reviewing possible connections, and preparing source-linked questions for a clinic. Each connection requires the user's review; it does not establish completed care or clinician review.

A solo hackathon project by **Anshul Kushwaha, GCET**.

[Live demo](https://carethread-one.vercel.app) · [Open workspace](https://carethread-one.vercel.app/workspace)

## Run locally

Use **Node.js 22.13 or newer** and npm:

```sh
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173`. For a production build served locally:

```sh
npm run build
npm run preview
```

The app uses React, TypeScript and Vite. It requires no account, backend, API key or model service. Document reading, rule-based matching, question drafting and export run in the browser. Fonts, the PDF worker and sample documents are served as app assets.

## Try the sample workflow

1. Choose **Explore a sample** on the landing page. The fictional September episode includes three ordered tests and four source documents; no reports are automatically linked.
2. Open **Test items**, compare suggestions against the quoted sources, and explicitly link the appropriate current reports. The older July report has conflicting references, and the metabolic-panel report remains marked partial.
3. Open **Question sheet**, review or edit questions, and download a PDF or text copy.
4. Import `public/samples/culture-returning.pdf`, review it against order `CT-O-03`, link it explicitly, and review the changed questions.
5. Wait for **Saved on this device**, then reload at the same site address to reopen the episode.

The nine sample PDFs in `public/samples/` cover a current report, a partial report, an older conflicting report, a returning report, an identity conflict, an image-only scan, an order change and an amended report. All are fictional fixtures without real patient data or clinical result values. Use synthetic documents to explore the prototype.

## Scope and limitations

- One care episode, one browser operator and one open workspace tab at a time. Separate tabs do not detect conflicting writes.
- Selectable-text PDF and UTF-8 text import, pasted text, and PNG/JPG/WebP attachments for manual reference.
- Import limits: 10 MB per file, 30 pages per PDF and 10 files per batch. PDF reading has a 25-second timeout.
- No OCR. Scans and photographs require manual review and entry. Password-protected or unreadable PDFs need an accessible copy or manual entry.
- Deterministic extraction recognizes explicit English administrative labels and simple tables. Missing fields remain unknown; ambiguous dates are not guessed.
- Suggested associations require confirmation. A partial report remains partial after linking. Manual items without valid order evidence remain the user's notes.
- No clinical interpretation, medical urgency assessment, hospital integration, shared accounts or cloud synchronization. This prototype has no clinical, production, privacy or regulatory certification.

## Browser storage and exports

IndexedDB stores the episode, retained files, extracted text, links and questions in the current browser profile for the exact site origin. A different hostname, protocol, port, browser or profile has separate storage. There is no automatic expiry or remote backup; clearing site data or browser storage eviction can remove it. The app is not an encrypted clinical-record system.

**Saved on this device** appears after a successful write. A failed save leaves the current draft in memory and offers retry and export; the previously saved copy can still contain older information. Keep the page open and retry before relying on a reload or persisted deletion.

Removing a source removes its retained bytes, extracted text, quotations and dependent connections from the next successfully saved episode. **Clear this episode** clears the saved workspace after the transaction succeeds. Neither action deletes original files or existing downloads or clipboard copies.

PDF, text and copied question sheets are dated snapshots with a workspace revision. They do not update automatically or send information to a clinic. Text export preserves characters unsupported by the bundled PDF font.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/core/` | Source model, deterministic extraction and matching, synthetic fixtures |
| `src/application/` | Ordered saving/deletion and pure import decisions |
| `src/useWorkspace.ts`, `src/controller.ts` | React workspace state and controller contract |
| `src/documents.ts` | PDF/text reading and retained document adapters |
| `src/storage.ts` | IndexedDB persistence |
| `src/export.ts` | PDF, text and clipboard question-sheet exports |
| `src/App.tsx`, `src/workspace/` | Workspace shell, views, forms and dialogs |
| `src/LandingPage.tsx`, `src/main.tsx` | Landing page and `/workspace` navigation |

Vercel serves the Vite production output from `dist/`. `vercel.json` routes direct `/workspace` requests to the app entry point so reloads work. No server-side application or environment variables are needed.

## Checks

```sh
npm test
npm run build
npm run test:samples
npx playwright install chromium
npm run test:e2e
```

Fresh publication checks passed **70 unit tests and 24 Chromium browser tests** after `npm ci`, along with a production build and verification of all nine sample PDFs. They cover deterministic parsing and matching, ordered persistence, import decisions, saved-record compatibility, document review and question export, validation and recovery, search, and landing navigation. The sample check verifies the text and fields of all nine PDFs. Browser tests use fictional data and serve the production build at `http://127.0.0.1:4174`; keep that port available.

These checks establish behavior in the tested scope. They do not establish clinical accuracy, user benefit, accessibility conformance, cross-browser coverage or real-device performance.

## Third-party notices

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency, font, icon and photography notices. No license is assigned to CareThread's own code in this repository.
