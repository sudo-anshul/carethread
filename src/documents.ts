import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseDocument } from './core/parser';
import type { DocumentKind, SourceDocument, SourcePage } from './core/types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 30;

export async function fingerprint(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function documentFromText(name: string, text: string, kind?: DocumentKind): Promise<SourceDocument> {
  const data = new TextEncoder().encode(text);
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('This text is too large. Use up to 10 MB at a time.');
  const hash = await fingerprint(data.buffer);
  return { ...parseDocument({ id: crypto.randomUUID(), name, pages: [{ number: 1, text }], fingerprint: hash, kind, mime: 'text/plain', size: data.byteLength }), blob: new Blob([text], { type: 'text/plain' }) };
}

export async function readFile(file: File): Promise<SourceDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 10 MB. Choose a smaller file or enter its details manually.');
  if (!file.size) throw new Error('This file is empty. Choose another copy or enter its details manually.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isPdf = file.type === 'application/pdf' || ext === 'pdf';
  const isText = file.type === 'text/plain' || ext === 'txt';
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '');
  if (!isPdf && !isText && !isImage) throw new Error('Choose a PDF, text file, PNG, JPG or WebP. Images can be kept as references for manual entry.');
  const data = await file.arrayBuffer();
  const hash = await fingerprint(data);
  const imageMime = ['jpg', 'jpeg'].includes(ext ?? '') ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  const base = { id: crypto.randomUUID(), name: file.name, fingerprint: hash, mime: isPdf ? 'application/pdf' : isText ? 'text/plain' : imageMime, size: file.size };
  if (isImage) return { ...parseDocument({ ...base, pages: [] }), status: 'unreadable', error: 'This image has not been read automatically. View it and add the test details manually.', blob: file };
  if (isText) return { ...parseDocument({ ...base, pages: [{ number: 1, text: new TextDecoder().decode(data) }] }), blob: file };
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({ data: new Uint8Array(data), useWorkerFetch: false });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void task.destroy(); reject(new Error('Reading took too long. Your other files are safe; try a smaller copy or enter the details manually.')); }, 25000); });
    return await Promise.race([(async () => {
      const pdf = await task.promise;
      if (pdf.numPages > MAX_PAGES) throw new Error(`This PDF has ${pdf.numPages} pages. Use a PDF of up to ${MAX_PAGES} pages or enter details manually.`);
      const pages: SourcePage[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        let text = '', previousY: number | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          if (previousY !== undefined && Math.abs(y - previousY) > 3 && !text.endsWith('\n')) text += '\n';
          text += item.str;
          text += item.hasEOL ? '\n' : ' ';
          previousY = y;
        }
        pages.push({ number, text: text.replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n').trim() });
        page.cleanup();
      }
      return { ...parseDocument({ ...base, pages }), blob: file };
    })(), timeout]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read this PDF.';
    if (message.toLowerCase().includes('password')) throw new Error('This PDF is password-protected. Use an unlocked copy or enter the details manually.');
    throw new Error(message.length > 200 ? 'This PDF could not be read. Use another copy or enter the details manually.' : message);
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}
