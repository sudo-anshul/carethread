import type {
  Candidate, DeleteOptions, Episode, EpisodeInput, Evidence, ItemEdit, ManualItemInput,
  Question, ReportLink, SourceDocument, SourceNotice, TestItem,
} from './types';

const normalized = (value?: string) => (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const clean = (value?: string) => value?.trim() || undefined;
const now = () => new Date().toISOString();
const key = (itemId: string, documentId: string) => `${itemId}::${documentId}`;
const questionId = (itemId: string) => `question:${itemId}`;

function required(value: string, label: string): string {
  const result = value.trim();
  if (!result) throw new Error(`Enter ${label}.`);
  return result;
}

function nextId(ep: Episode, prefix: string): string {
  const used = new Set([...ep.items, ...ep.links, ...ep.documents].map((entry) => entry.id));
  let suffix = ep.revision + 1;
  while (used.has(`${prefix}:${ep.id}:${suffix}`)) suffix += 1;
  return `${prefix}:${ep.id}:${suffix}`;
}

function changed(before: Episode, after: Episode): Episode {
  return { ...after, revision: before.revision + 1, updatedAt: now() };
}

function findItem(ep: Episode, id: string): TestItem {
  const item = ep.items.find((entry) => entry.id === id);
  if (!item) throw new Error('This test item is no longer in the episode. Refresh the list and try again.');
  return item;
}

function findDocument(ep: Episode, id: string): SourceDocument {
  const document = ep.documents.find((entry) => entry.id === id);
  if (!document) throw new Error('This source has been removed. Add the document again before using it.');
  return document;
}

function findQuestion(ep: Episode, id: string): Question {
  const question = ep.questions.find((entry) => entry.id === id);
  if (!question) throw new Error('This question is no longer available. Review the current question sheet.');
  return question;
}

/** Evidence is valid only for the retained, readable version and an exact passage. */
function evidenceValid(document: SourceDocument | undefined, evidence: Evidence | undefined): boolean {
  return Boolean(document && evidence && document.status === 'ready'
    && document.id === evidence.documentId && document.fingerprint === evidence.fingerprint
    && evidence.quote.trim() && document.pages.some((page) => page.number === evidence.page && page.text.includes(evidence.quote)));
}

function checkEvidence(document: SourceDocument, evidence: Evidence, label?: string): void {
  if (!evidenceValid(document, evidence)) {
    throw new Error(`A passage in “${document.name}” could not be verified against its page and source version. Try reading it again or add a manual note.`);
  }
  if (label && !normalized(evidence.quote).includes(normalized(label))) {
    throw new Error(`The passage for “${label}” does not contain that test name. Correct the name or add it as your own note.`);
  }
}

function currentEvidence(ep: Episode, evidence?: Evidence): evidence is Evidence {
  return Boolean(evidence && evidenceValid(ep.documents.find((doc) => doc.id === evidence.documentId), evidence));
}

/** Numeric slash dates deliberately have no inferred locale. */
function comparableDate(value?: string): string | undefined {
  if (!value) return undefined;
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else {
    const names = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const dayFirst = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text);
    const monthFirst = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
    if (!dayFirst && !monthFirst) return undefined;
    const monthName = (dayFirst?.[2] ?? monthFirst?.[1] ?? '').toLowerCase();
    month = names.findIndex((name) => name === monthName || name.slice(0, 3) === monthName) + 1;
    day = Number(dayFirst?.[1] ?? monthFirst?.[2]);
    year = Number(dayFirst?.[3] ?? monthFirst?.[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!month || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function supportsDate(quote: string, value: string): boolean {
  if (normalized(quote).includes(normalized(value))) return true;
  const date = comparableDate(value);
  if (!date) return false;
  const writtenDates = quote.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b|\b[A-Za-z]+\s+\d{1,2},?\s+\d{4}\b/g) ?? [];
  return writtenDates.some((written) => comparableDate(written) === date);
}

function supportsIdentifier(quote: string, value: string): boolean {
  const escaped = value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}._/-])${escaped}(?=$|[^\\p{L}\\p{N}._/-])`, 'iu').test(quote);
}

function identityConflict(ep: Episode, document: SourceDocument): string | undefined {
  if (ep.patientId && document.patientId && normalized(ep.patientId) !== normalized(document.patientId)) {
    return `The document’s record ID does not match this episode. Remove it and check that you selected the correct person’s file.`;
  }
  if (ep.person && document.person && normalized(ep.person) !== normalized(document.person)) {
    return `The document’s person name does not match this episode. Remove it and check that you selected the correct person’s file.`;
  }
  return undefined;
}

function sourceEvidence(document: SourceDocument, item?: TestItem): Evidence | undefined {
  const entry = document.entries.find((value) => item && ((item.orderId && normalized(value.orderId) === normalized(item.orderId)) || normalized(value.label) === normalized(item.label)))
    ?? document.entries[0];
  if (entry && evidenceValid(document, entry.evidence)) return entry.evidence;
  const page = document.pages.find((value) => value.text.trim());
  const quote = page?.text.split('\n').find((line) => line.trim());
  return page && quote ? { documentId: document.id, fingerprint: document.fingerprint, page: page.number, quote } : undefined;
}

function candidateFor(ep: Episode, item: TestItem, document: SourceDocument): Candidate {
  const reasons: string[] = [];
  const conflicts: string[] = [];
  const identity = identityConflict(ep, document);
  if (identity) conflicts.push(identity);
  if (document.status !== 'ready' || document.kind !== 'report') conflicts.push('This document is not a readable report.');
  if (document.entries.some((entry) => !evidenceValid(document, entry.evidence)) || document.notices.some((notice) => !evidenceValid(document, notice.evidence))) {
    conflicts.push('The report’s extracted passages do not match its retained source version. Read the source again before linking.');
  }
  if (!document.patientId && !document.person) reasons.push('This report does not identify a person; check the original before linking.');
  if (item.basis === 'source' && !currentEvidence(ep, item.evidence)) conflicts.push('The order passage or its source version changed. Review the item before linking.');
  if (ep.reference && document.episodeRef) {
    if (normalized(ep.reference) === normalized(document.episodeRef)) reasons.push(`Episode matches: ${document.episodeRef}.`);
    else conflicts.push(`Different episode: report ${document.episodeRef}; this episode ${ep.reference}.`);
  } else reasons.push('An episode reference is unavailable on one side; check the document context.');
  if (item.orderId && document.orderIds.length) {
    if (document.orderIds.some((id) => normalized(id) === normalized(item.orderId))) reasons.push(`Order ID matches: ${item.orderId}.`);
    else conflicts.push(`Different order ID: report ${document.orderIds.join(', ')}; item ${item.orderId}.`);
  } else reasons.push('An order identifier is unavailable on one side; a test name alone does not establish a match.');
  const labels = document.entries.map((entry) => entry.label);
  if (labels.some((label) => normalized(label) === normalized(item.label))) reasons.push(`Test name matches: ${item.label}.`);
  else if (labels.length) reasons.push(`Report lists: ${labels.join(', ')}. Compare the wording before linking.`);
  const orderDate = comparableDate(item.date || ep.date);
  for (const [label, value] of [['Collection date', document.collectionDate], ['Report date', document.reportDate]] as const) {
    if (!value) continue;
    const date = comparableDate(value);
    if (!date) reasons.push(`${label}: ${value} (format not interpreted; check the original).`);
    else if (orderDate && date < orderDate) conflicts.push(`${label} ${value} is earlier than the order/episode date ${item.date || ep.date}.`);
    else reasons.push(`${label}: ${value}.`);
  }
  if (item.date && !comparableDate(item.date)) reasons.push(`Order date: ${item.date} (format not interpreted).`);
  if (document.reportLabel) reasons.push(`Source report label: “${document.reportLabel}”.`);
  for (const notice of document.notices) {
    if (notice.type === 'amended') reasons.push(`Source amendment to inspect: “${notice.evidence.quote}”.`);
  }
  const evidence = sourceEvidence(document, item);
  if (!evidence || !evidenceValid(document, evidence)) conflicts.push('There is no verified readable report passage. Add a manual entry or a readable source.');
  return { itemId: item.id, documentId: document.id, reasons, conflicts, evidence };
}

export function getItemLinks(ep: Episode, itemId: string): ReportLink[] {
  const item = ep.items.find((entry) => entry.id === itemId);
  if (!item || (item.basis === 'source' && !currentEvidence(ep, item.evidence))) return [];
  return ep.links.filter((link) => {
    const doc = ep.documents.find((value) => value.id === link.documentId);
    return link.itemId === itemId && doc?.status === 'ready' && doc.kind === 'report'
      && link.fingerprint === doc.fingerprint && !identityConflict(ep, doc)
      && candidateFor(ep, item, doc).conflicts.length === 0;
  });
}

export function getCandidates(ep: Episode, itemId: string): Candidate[] {
  const item = findItem(ep, itemId);
  const linked = new Set(getItemLinks(ep, itemId).map((link) => link.documentId));
  return ep.documents.filter((doc) => doc.kind === 'report' && doc.status === 'ready' && !identityConflict(ep, doc)
    && !linked.has(doc.id) && !ep.rejections.includes(key(itemId, doc.id)))
    .map((doc) => candidateFor(ep, item, doc))
    .sort((a, b) => a.conflicts.length - b.conflicts.length);
}

export function getItemNotices(ep: Episode, itemId: string): SourceNotice[] {
  const item = ep.items.find((value) => value.id === itemId);
  if (!item) return [];
  const linkedIds = new Set(getItemLinks(ep, itemId).map((link) => link.documentId));
  const linkedReportIds = ep.documents.filter((doc) => linkedIds.has(doc.id)).map((doc) => normalized(doc.reportId)).filter(Boolean);
  const result: SourceNotice[] = [];
  for (const doc of ep.documents) {
    if (doc.status !== 'ready' || identityConflict(ep, doc)) continue;
    for (const notice of doc.notices) {
      if (!evidenceValid(doc, notice.evidence)) continue;
      const target = normalized(notice.targetId);
      const pointsToOrder = Boolean(target && item.orderId && target === normalized(item.orderId));
      const pointsToLinkedReport = Boolean(target && linkedReportIds.includes(target));
      const scopedLinked = linkedIds.has(doc.id) && (!target || pointsToOrder || pointsToLinkedReport);
      if (notice.type === 'partial' || notice.type === 'preliminary') {
        if (scopedLinked) result.push(notice);
      } else if (pointsToOrder || pointsToLinkedReport || scopedLinked) result.push(notice);
    }
  }
  return result;
}

function uniqueEvidence(evidence: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evidence.filter((entry) => {
    const id = JSON.stringify(entry);
    if (seen.has(id)) return false;
    seen.add(id); return true;
  });
}

function questionTemplate(ep: Episode, item: TestItem): Question {
  const links = getItemLinks(ep, item.id);
  const notices = getItemNotices(ep, item.id);
  const limits = notices.filter((notice) => notice.type === 'partial' || notice.type === 'preliminary');
  const changes = notices.filter((notice) => notice.type === 'cancelled' || notice.type === 'amended');
  const orderEvidence = currentEvidence(ep, item.evidence) ? [item.evidence] : [];
  const reportEvidence = links.flatMap((link) => {
    const doc = ep.documents.find((entry) => entry.id === link.documentId);
    const evidence = doc && sourceEvidence(doc, item);
    return evidence ? [evidence] : [];
  });
  const evidence = uniqueEvidence([...orderEvidence, ...reportEvidence, ...notices.map((notice) => notice.evidence)]);
  const order = item.orderId ? `, order ${item.orderId}` : '';
  let text: string;
  if (changes.length) {
    text = `A supplied document says “${changes[0]!.evidence.quote}” for “${item.label}”${order}. Could you confirm this order’s status and whether there is another order or report I should obtain?`;
  } else if (limits.length) {
    text = `The report I linked for “${item.label}”${order} says “${limits[0]!.evidence.quote}”. Is there another report I should obtain?`;
  } else if (!links.length) {
    text = item.basis === 'source' && orderEvidence.length
      ? `My supplied order ${item.reviewed ? 'lists' : 'appears to list'} “${item.label}”${order}. I have not linked a report for it. Could you confirm where I can obtain the report, or whether this order changed?`
      : `I noted “${item.label}”${order}. I have not linked a report for it. Could you confirm whether it was ordered and which report, if any, I should obtain?`;
  } else {
    text = `I linked ${links.length === 1 ? 'a supplied report' : 'supplied reports'} to “${item.label}”${order}. Could you confirm whether there is any other report I should obtain or question to discuss?`;
  }
  return {
    id: questionId(item.id), itemId: item.id, text, selected: !links.length || Boolean(limits.length || changes.length),
    edited: false, reviewRequired: !item.reviewed, sourceIds: [...new Set(evidence.map((entry) => entry.documentId))],
    evidence, basis: item.basis === 'source' && orderEvidence.length ? 'source' : 'note',
  };
}

function fallbackTemplate(): Question {
  return {
    id: 'question:order-list', text: 'Could you share my original order or confirm the list of tests for this episode? I have not supplied an order, so my notes and reports may not cover every requested test.',
    selected: true, edited: false, reviewRequired: false, sourceIds: [], evidence: [], basis: 'note',
  };
}

function questionContext(ep: Episode, itemId?: string): string {
  const item = ep.items.find((value) => value.id === itemId);
  if (!item) return JSON.stringify(ep.items.filter((value) => value.basis === 'source').map((value) => value.id));
  return JSON.stringify({ item, links: getItemLinks(ep, item.id), candidates: getCandidates(ep, item.id), notices: getItemNotices(ep, item.id) });
}

function syncQuestions(before: Episode, ep: Episode, options: { omit?: Set<string>; asNotes?: Set<string> } = {}): Episode {
  const templates = ep.items.map((item) => questionTemplate(ep, item));
  if (!ep.items.some((item) => item.basis === 'source' && currentEvidence(ep, item.evidence))) templates.push(fallbackTemplate());
  const available = new Set(templates.map((template) => template.id));
  const questions = templates.map((template) => {
    const previous = options.omit?.has(template.id) ? undefined : before.questions.find((question) => question.id === template.id);
    if (!previous) return template;
    const contextChanged = questionContext(before, previous.itemId) !== questionContext(ep, template.itemId);
    if (options.asNotes?.has(previous.id)) {
      return { ...previous, itemId: template.itemId, reviewRequired: true, basis: 'note' as const, sourceIds: [], evidence: [] };
    }
    if (previous.edited) {
      const evidence = previous.evidence.filter((entry) => currentEvidence(ep, entry));
      return { ...previous, evidence, sourceIds: [...new Set(evidence.map((entry) => entry.documentId))],
        basis: evidence.length ? previous.basis : 'note' as const, reviewRequired: previous.reviewRequired || contextChanged };
    }
    return {
      ...template, text: template.text, edited: false,
      selected: previous.selected, reviewRequired: previous.reviewRequired || contextChanged,
    };
  });
  for (const previous of before.questions) {
    if (available.has(previous.id) || options.omit?.has(previous.id) || !previous.edited) continue;
    // Explicit edits survive automatic draft changes and item removal, as a reviewed user note.
    questions.push({ ...previous, itemId: undefined, basis: 'note', sourceIds: [], evidence: [], reviewRequired: true });
  }
  return { ...ep, questions };
}

function commit(before: Episode, ep: Episode): Episode {
  return changed(before, syncQuestions(before, ep));
}

export function createEpisode(input: EpisodeInput): Episode {
  const timestamp = now();
  return {
    schemaVersion: 1, id: crypto.randomUUID(), label: required(input.label, 'an episode name'),
    person: input.person.trim(), patientId: input.patientId?.trim() ?? '', date: input.date?.trim() ?? '',
    reference: input.reference?.trim() ?? '', demo: false, revision: 0, updatedAt: timestamp,
    documents: [], items: [], links: [], rejections: [], questions: [fallbackTemplate()],
  };
}

export function addDocument(ep: Episode, document: SourceDocument): Episode {
  required(document.id, 'a document identifier');
  required(document.fingerprint, 'a document fingerprint');
  const duplicate = ep.documents.find((entry) => entry.fingerprint === document.fingerprint);
  if (duplicate && (duplicate.status === 'ready' || duplicate.status === 'quarantined' || document.status !== 'ready')) return ep;
  if (ep.documents.some((entry) => entry.id === document.id && entry.fingerprint !== document.fingerprint)) {
    throw new Error('This document ID belongs to a different source version. Remove the old source or add the new version with its own ID.');
  }
  const identity = identityConflict(ep, document);
  const wrongOrderEpisode = document.kind === 'order' && ep.reference && document.episodeRef
    && normalized(ep.reference) !== normalized(document.episodeRef);
  const excluded = identity || (wrongOrderEpisode ? 'This order names a different episode. Check the episode and add the correct order.' : undefined);
  const doc: SourceDocument = {
    ...document, pages: document.pages.map((page) => ({ ...page })), orderIds: [...document.orderIds],
    entries: document.entries.map((entry) => ({ ...entry, evidence: { ...entry.evidence } })),
    notices: document.notices.map((notice) => ({ ...notice, evidence: { ...notice.evidence } })),
    ...(excluded ? { status: 'quarantined', error: excluded, entries: [], notices: [] } : {}),
  };
  if (doc.status === 'ready') {
    if (!doc.pages.some((page) => page.text.trim())) throw new Error(`“${doc.name}” has no readable text. Keep it as an unreadable attachment and add notes manually.`);
    const pageNumbers = new Set(doc.pages.map((page) => page.number));
    if (pageNumbers.size !== doc.pages.length || doc.pages.some((page) => !Number.isInteger(page.number) || page.number < 1)) throw new Error('The source has invalid page references. Read the file again or add a manual note.');
    for (const entry of doc.entries) {
      required(entry.label, 'a test name');
      checkEvidence(doc, entry.evidence, entry.label);
      if (entry.orderId && !supportsIdentifier(entry.evidence.quote, entry.orderId)) throw new Error('An extracted order ID is not supported by its cited passage. Review the source or add a manual note.');
      if (entry.date && !supportsDate(entry.evidence.quote, entry.date)) throw new Error('An extracted date is not supported by its cited passage. Review the source or add a manual note.');
    }
    for (const notice of doc.notices) checkEvidence(doc, notice.evidence);
  } else { doc.entries = []; doc.notices = []; }
  let next: Episode = { ...ep, documents: [...ep.documents.filter((entry) => entry.id !== duplicate?.id), doc] };
  if (doc.status === 'ready' && doc.kind === 'order') {
    const items = [...ep.items];
    for (const [index, entry] of doc.entries.entries()) {
      if (entry.orderId && items.some((item) => item.orderId && normalized(item.orderId) === normalized(entry.orderId))) continue;
      items.push({ id: `item:${doc.id}:${index}`, label: entry.label.trim(), orderId: clean(entry.orderId), date: clean(entry.date), basis: 'source', evidence: { ...entry.evidence }, reviewed: false, note: '' });
    }
    next = { ...next, items };
  }
  return commit(ep, next);
}

export function addManualItem(ep: Episode, input: ManualItemInput): Episode {
  const label = required(input.label, 'a test name');
  let evidence: Evidence | undefined;
  if (input.sourceDocumentId) {
    const doc = findDocument(ep, input.sourceDocumentId);
    if (doc.status === 'quarantined' || identityConflict(ep, doc)) throw new Error('This source belongs to a different person or episode and cannot support an item here.');
    if (doc.kind !== 'order') throw new Error('Only an order can support a requested test. Add a report-based recollection as your own note.');
    evidence = { documentId: doc.id, fingerprint: doc.fingerprint, page: input.page ?? 1, quote: required(input.quote ?? '', 'the exact supporting passage') };
    checkEvidence(doc, evidence, label);
    if (input.orderId && !supportsIdentifier(evidence.quote, input.orderId)) throw new Error('The order ID is not in the supporting passage. Correct it or add the item as your own note.');
    if (input.date && !supportsDate(evidence.quote, input.date)) throw new Error('The order date is not in the supporting passage. Correct it or add the item as your own note.');
  }
  const item: TestItem = { id: nextId(ep, 'manual'), label, orderId: clean(input.orderId), date: clean(input.date), note: input.note?.trim() ?? '', evidence, basis: evidence ? 'source' : 'note', reviewed: true };
  return commit(ep, { ...ep, items: [...ep.items, item] });
}

export function editItem(ep: Episode, id: string, edit: ItemEdit): Episode {
  const previous = findItem(ep, id);
  const label = required(edit.label, 'a test name');
  const orderId = clean(edit.orderId);
  const date = clean(edit.date);
  const factChanged = previous.label !== label || previous.orderId !== orderId || previous.date !== date;
  const quoteSupports = currentEvidence(ep, previous.evidence)
    && normalized(previous.evidence.quote).includes(normalized(label))
    && (!orderId || supportsIdentifier(previous.evidence.quote, orderId))
    && (!date || supportsDate(previous.evidence.quote, date));
  const edited: TestItem = { ...previous, label, orderId, date, note: edit.note?.trim() ?? previous.note, reviewed: true,
    basis: previous.basis === 'source' && quoteSupports ? 'source' : 'note', evidence: quoteSupports ? previous.evidence : undefined };
  return commit(ep, { ...ep, items: ep.items.map((item) => item.id === id ? edited : item),
    links: factChanged ? ep.links.filter((link) => link.itemId !== id) : ep.links,
    rejections: factChanged ? ep.rejections.filter((value) => !value.startsWith(`${id}::`)) : ep.rejections });
}

export function removeItem(ep: Episode, id: string): Episode {
  findItem(ep, id);
  return commit(ep, { ...ep, items: ep.items.filter((item) => item.id !== id), links: ep.links.filter((link) => link.itemId !== id), rejections: ep.rejections.filter((value) => !value.startsWith(`${id}::`)) });
}

export function reviewItem(ep: Episode, id: string): Episode {
  const item = findItem(ep, id);
  if (item.basis === 'source' && !currentEvidence(ep, item.evidence)) throw new Error('This order passage is no longer valid. Correct the item or add it as your own note.');
  return commit(ep, { ...ep, items: ep.items.map((value) => value.id === id ? { ...value, reviewed: true } : value) });
}

export function confirmLink(ep: Episode, itemId: string, documentId: string): Episode {
  const item = findItem(ep, itemId);
  const doc = findDocument(ep, documentId);
  const candidate = candidateFor(ep, item, doc);
  if (candidate.conflicts.length) throw new Error(`These sources cannot be linked: ${candidate.conflicts.join(' ')}`);
  if (ep.rejections.includes(key(itemId, documentId))) throw new Error('This report was dismissed for this item. Restore dismissed reports before linking it.');
  if (getItemLinks(ep, itemId).some((link) => link.documentId === documentId)) return ep;
  const link: ReportLink = { id: nextId(ep, 'link'), itemId, documentId, fingerprint: doc.fingerprint, confirmedAt: now() };
  return commit(ep, { ...ep, items: ep.items.map((value) => value.id === itemId ? { ...value, reviewed: true } : value), links: [...ep.links, link] });
}

export function unlink(ep: Episode, linkId: string): Episode {
  if (!ep.links.some((link) => link.id === linkId)) throw new Error('This connection is no longer present. Review the current report connections.');
  return commit(ep, { ...ep, links: ep.links.filter((link) => link.id !== linkId) });
}

export function rejectCandidate(ep: Episode, itemId: string, documentId: string): Episode {
  findItem(ep, itemId); findDocument(ep, documentId);
  const rejection = key(itemId, documentId);
  if (ep.rejections.includes(rejection)) return ep;
  return commit(ep, { ...ep, rejections: [...ep.rejections, rejection] });
}

export function restoreCandidates(ep: Episode, itemId: string): Episode {
  findItem(ep, itemId);
  return commit(ep, { ...ep, rejections: ep.rejections.filter((value) => !value.startsWith(`${itemId}::`)) });
}

export function deleteDocument(ep: Episode, id: string, options: DeleteOptions): Episode {
  findDocument(ep, id);
  const dependentItems = new Set(ep.items.filter((item) => item.evidence?.documentId === id).map((item) => item.id));
  const affectedQuestions = ep.questions.filter((question) => question.sourceIds.includes(id) || question.evidence.some((evidence) => evidence.documentId === id) || (question.itemId && dependentItems.has(question.itemId)));
  const editedIds = affectedQuestions.filter((question) => question.edited).map((question) => question.id);
  const omitted = new Set(options.keepEditedQuestions ? [] : editedIds);
  const retained = new Set(options.keepEditedQuestions ? editedIds : []);
  const items = options.keepItemsAsNotes
    ? ep.items.map((item) => dependentItems.has(item.id) ? { ...item, basis: 'note' as const, evidence: undefined, reviewed: false, note: item.note } : item)
    : ep.items.filter((item) => !dependentItems.has(item.id));
  const itemIds = new Set(items.map((item) => item.id));
  const next: Episode = { ...ep, documents: ep.documents.filter((doc) => doc.id !== id), items,
    links: ep.links.filter((link) => link.documentId !== id && !dependentItems.has(link.itemId) && itemIds.has(link.itemId)),
    rejections: ep.rejections.filter((value) => !value.endsWith(`::${id}`) && ![...dependentItems].some((itemId) => value.startsWith(`${itemId}::`))) };
  return changed(ep, syncQuestions(ep, next, { omit: omitted, asNotes: retained }));
}

export function updateQuestion(ep: Episode, id: string, text: string): Episode {
  findQuestion(ep, id);
  if (typeof text !== 'string') throw new Error('Use text for this question draft.');
  // Drafts may be temporarily empty while typing. Explicit evidence review is
  // separate from editing, and export validates selected questions for content.
  return changed(ep, { ...ep, questions: ep.questions.map((question) => question.id === id ? { ...question, text, edited: true } : question) });
}

export function selectQuestion(ep: Episode, id: string, selected: boolean): Episode {
  findQuestion(ep, id);
  return changed(ep, { ...ep, questions: ep.questions.map((question) => question.id === id ? { ...question, selected } : question) });
}

export function reviewQuestion(ep: Episode, id: string): Episode {
  const question = findQuestion(ep, id);
  if (question.evidence.some((evidence) => !currentEvidence(ep, evidence))) throw new Error('A cited passage is no longer available. Reset this draft or keep an edited question as your own note.');
  return changed(ep, { ...ep, questions: ep.questions.map((value) => value.id === id ? { ...value, reviewRequired: false } : value) });
}

export function resetQuestion(ep: Episode, id: string): Episode {
  const previous = findQuestion(ep, id);
  const item = ep.items.find((value) => value.id === previous.itemId);
  const template = item ? questionTemplate(ep, item) : id === 'question:order-list' ? fallbackTemplate() : undefined;
  if (!template) throw new Error('This note no longer has an item to draft from. Edit the question directly or leave it off the sheet.');
  return changed(ep, { ...ep, questions: ep.questions.map((question) => question.id === id ? { ...template, selected: previous.selected, reviewRequired: true } : question) });
}

export function getItemStatus(ep: Episode, itemId: string): { label: string; tone: 'neutral' | 'review' | 'linked' | 'warning'; detail: string } {
  const item = findItem(ep, itemId);
  if (item.basis === 'source' && !currentEvidence(ep, item.evidence)) return { label: 'Connection needs another look', tone: 'warning', detail: 'The supporting order passage is unavailable or changed. Correct the item before using its connections.' };
  const notices = getItemNotices(ep, itemId);
  const change = notices.find((notice) => notice.type === 'cancelled' || notice.type === 'amended');
  if (change) return { label: 'Order change to review', tone: 'warning', detail: `The source says “${change.evidence.quote}”. Confirm what this means for this order instance.` };
  const links = getItemLinks(ep, itemId);
  const limit = notices.find((notice) => notice.type === 'partial' || notice.type === 'preliminary');
  if (links.length && limit) return { label: `Report linked by you · source says ${limit.type}`, tone: 'warning', detail: `“${limit.evidence.quote}” — the source wording remains part of your question sheet.` };
  if (links.length) return { label: 'Report linked by you', tone: 'linked', detail: `${links.length} ${links.length === 1 ? 'report connected' : 'reports connected'} to this item. A connection does not establish clinician review.` };
  if (!item.reviewed) return { label: 'Check order details', tone: 'review', detail: 'Review the extracted test name, order identifier and date beside the source.' };
  const candidates = getCandidates(ep, itemId);
  if (candidates.some((candidate) => !candidate.conflicts.length)) return { label: 'Possible match to review', tone: 'review', detail: 'Compare the report and order passages before making a connection.' };
  if (candidates.length) return { label: 'No report linked', tone: 'warning', detail: 'Supplied reports have conflicting details. Inspect those conflicts or add the correct source.' };
  const unread = ep.documents.some((doc) => doc.status === 'unreadable' || doc.status === 'failed');
  return { label: 'No report linked', tone: 'neutral', detail: unread ? 'Some supplied files could not be read. Inspect them manually; absence of a link does not establish an absent report.' : 'No supplied report is connected to this item. You can prepare a question for your clinic.' };
}
