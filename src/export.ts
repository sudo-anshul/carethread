import fontUrl from '@fontsource/manrope/files/manrope-latin-400-normal.woff?url';
import type { Episode, Question, SourceDocument } from './core/types';

function selectedQuestions(episode: Episode): Question[] {
  const selected = episode.questions.filter(q => q.selected);
  if (selected.some(q => q.reviewRequired)) throw new Error('Review the questions marked “needs review” before exporting. Your sources have changed.');
  if (selected.some(q => !q.text.trim())) throw new Error('A selected question is empty. Add wording or leave it off this sheet.');
  for (const q of selected) for (const e of q.evidence) {
    const doc = episode.documents.find(d => d.id === e.documentId);
    if (!doc || doc.status !== 'ready' || doc.fingerprint !== e.fingerprint || !doc.pages.some(p => p.number === e.page && p.text.includes(e.quote))) {
      throw new Error('A question refers to evidence that has changed. Review it and create a fresh draft before exporting.');
    }
  }
  return selected;
}

export function questionSheetText(episode: Episode): string {
  const selected = selectedQuestions(episode);
  const lines = [
    'CareThread', 'Questions for my clinic', '',
    ...(episode.demo ? ['SYNTHETIC DEMONSTRATION — NOT A REAL PATIENT RECORD', ''] : []),
    `For: ${episode.person}`, `Episode: ${episode.label}`,
    ...(episode.date ? [`Visit context: ${episode.date}`] : []),
    `Prepared: ${new Date().toLocaleString()}`, `Workspace revision: ${episode.revision}`, '',
    'Prepared from the documents and notes added to CareThread. This sheet may not include every test or report. A linked report does not confirm clinical review.', '',
  ];
  if (!selected.length) lines.push('No questions selected for this sheet. This does not establish that care is complete.');
  selected.forEach((q, index) => {
    lines.push(`${index + 1}. ${q.text}`, '');
    if (q.basis === 'note' || q.edited) lines.push('Wording includes information entered or edited by you.');
    q.evidence.forEach(e => {
      const source = episode.documents.find(d => d.id === e.documentId)!;
      lines.push(`Source: ${source.name}, page ${e.page}`, `“${e.quote}”`);
    });
    if (!q.evidence.length) lines.push('Source: your note; no supporting order attached.');
    lines.push('');
  });
  lines.push('This is a dated snapshot. Later changes in CareThread do not update this copy.');
  return lines.join('\n');
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.rel = 'noopener';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function downloadText(episode: Episode) {
  download(new Blob([questionSheetText(episode)], { type: 'text/plain;charset=utf-8' }), `carethread-questions-r${episode.revision}.txt`);
}

export function openSource(doc: SourceDocument) {
  if (doc.status === 'quarantined') throw new Error('This document is set aside from this episode.');
  // Force a safe content type, including for files with a misleading extension/MIME.
  const type = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(doc.mime) ? doc.mime : 'text/plain';
  const blob = doc.blob ? new Blob([doc.blob], { type }) : new Blob([doc.pages.map(p => p.text).join('\n\n')], { type: 'text/plain' });
  download(blob, doc.name);
}

let fontBytes: Promise<ArrayBuffer> | undefined;
export async function exportQuestionsPdf(episode: Episode): Promise<void> {
  const text = questionSheetText(episode);
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  fontBytes ??= fetch(fontUrl).then(r => { if (!r.ok) throw new Error('The PDF font could not be loaded. Try again, or download the text version.'); return r.arrayBuffer(); }).catch(error => { fontBytes = undefined; throw error; });
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await fontBytes, { subset: true });
  const characterSet = new Set(font.getCharacterSet());
  const unsupported = [...text].find(c => !['\n', '\r', '\t'].includes(c) && !characterSet.has(c.codePointAt(0)!));
  if (unsupported) throw new Error(`The PDF font cannot display “${unsupported}”. Download the text version to preserve your wording.`);
  pdf.setTitle('CareThread — Questions for my clinic');
  pdf.setAuthor('CareThread');
  pdf.setSubject('User-prepared questions based on supplied documents and notes');
  const width = 595.28, height = 841.89, margin = 50;
  const ink = rgb(.09, .22, .21), muted = rgb(.34, .40, .39);
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const newPage = () => { page = pdf.addPage([width, height]); y = height - margin; };
  const wrap = (line: string, size: number): string[] => {
    const words = line.split(/\s+/); const rows: string[] = []; let current = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(word, size) > width - 2 * margin) {
        if (current) { rows.push(current); current = ''; }
        let fragment = '';
        for (const c of word) {
          if (font.widthOfTextAtSize(fragment + c, size) > width - 2 * margin) { rows.push(fragment); fragment = c; } else fragment += c;
        }
        current = fragment;
      } else if (font.widthOfTextAtSize(current ? `${current} ${word}` : word, size) > width - 2 * margin) {
        rows.push(current); current = word;
      } else current = current ? `${current} ${word}` : word;
    }
    if (current) rows.push(current);
    return rows;
  };
  text.split('\n').forEach((line, index) => {
    if (!line) { y -= 10; return; }
    const size = index === 0 ? 12 : index === 1 ? 25 : 10.5;
    const leading = size * 1.5;
    for (const row of wrap(line, size)) {
      if (y - leading < margin + 20) newPage();
      page.drawText(row, { x: margin, y: y - size, size, font, color: line.startsWith('Source:') ? muted : ink });
      y -= leading;
    }
  });
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({ start: { x: margin, y: 42 }, end: { x: width - margin, y: 42 }, color: rgb(.82, .87, .85), thickness: .5 });
    p.drawText(`CareThread   |   Revision ${episode.revision}   |   ${index + 1} / ${pages.length}`, { x: margin, y: 27, font, size: 8, color: muted });
  });
  const bytes = await pdf.save();
  download(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), `carethread-questions-r${episode.revision}.pdf`);
}
