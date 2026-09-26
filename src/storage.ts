import { openDB } from 'idb';
import { getItemLinks } from './core/model';
import type { Episode, Evidence, SourceDocument } from './core/types';

const DB_NAME = 'carethread-local';
const db = () => openDB(DB_NAME, 1, { upgrade(database) { database.createObjectStore('workspace'); } });

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
const nonempty = (value: unknown): value is string => string(value) && value.trim().length > 0;
const optionalString = (value: unknown): boolean => value === undefined || string(value);
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const integer = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum;
const oneOf = (value: unknown, choices: string[]): boolean => string(value) && choices.includes(value);
const timestamp = (value: unknown): value is string => string(value) && Number.isFinite(Date.parse(value));
const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

function evidenceShape(value: unknown): value is Evidence {
  return record(value) && nonempty(value.documentId) && nonempty(value.fingerprint) && integer(value.page, 1) && nonempty(value.quote);
}

function documentShape(value: unknown): value is SourceDocument {
  if (!record(value) || !nonempty(value.id) || !nonempty(value.name) || !nonempty(value.fingerprint)
    || !oneOf(value.kind, ['order', 'report', 'note', 'unknown']) || !oneOf(value.status, ['ready', 'unreadable', 'failed', 'quarantined'])
    || !Array.isArray(value.pages) || !Array.isArray(value.entries) || !Array.isArray(value.notices)
    || !stringList(value.orderIds) || !value.orderIds.every(nonempty) || !timestamp(value.createdAt)
    || !string(value.mime) || !integer(value.size)) return false;
  if (!['person', 'patientId', 'episodeRef', 'date', 'collectionDate', 'reportDate', 'reportId', 'reportLabel', 'error'].every(key => optionalString(value[key]))) return false;
  if (value.blob !== undefined && !(value.blob instanceof Blob)) return false;
  if (!value.pages.every(page => record(page) && integer(page.number, 1) && string(page.text))) return false;
  if (new Set(value.pages.map(page => page.number)).size !== value.pages.length) return false;
  if (!value.entries.every(entry => record(entry) && nonempty(entry.label) && optionalString(entry.orderId) && optionalString(entry.date) && evidenceShape(entry.evidence))) return false;
  return value.notices.every(notice => record(notice) && oneOf(notice.type, ['cancelled', 'amended', 'partial', 'preliminary']) && optionalString(notice.targetId) && evidenceShape(notice.evidence));
}

function backedBy(document: SourceDocument | undefined, evidence: Evidence): boolean {
  return Boolean(document && document.status === 'ready' && document.id === evidence.documentId && document.fingerprint === evidence.fingerprint
    && document.pages.some(page => page.number === evidence.page && page.text.includes(evidence.quote)));
}

/** Reject incomplete or internally inconsistent saved versions without altering the browser copy. */
export function isStoredEpisode(value: unknown): value is Episode {
  if (!record(value) || value.schemaVersion !== 1 || !nonempty(value.id) || !nonempty(value.label)
    || !['person', 'patientId', 'date', 'reference'].every(key => string(value[key]))
    || typeof value.demo !== 'boolean' || !integer(value.revision) || !timestamp(value.updatedAt)
    || !Array.isArray(value.documents) || !value.documents.every(documentShape)
    || !Array.isArray(value.items) || !Array.isArray(value.links) || !Array.isArray(value.questions) || !stringList(value.rejections)) return false;
  if (!value.items.every(item => record(item) && nonempty(item.id) && nonempty(item.label) && optionalString(item.orderId) && optionalString(item.date)
    && oneOf(item.basis, ['source', 'note']) && typeof item.reviewed === 'boolean' && string(item.note)
    && (item.evidence === undefined || evidenceShape(item.evidence)))) return false;
  if (!value.links.every(link => record(link) && nonempty(link.id) && nonempty(link.itemId) && nonempty(link.documentId) && nonempty(link.fingerprint) && timestamp(link.confirmedAt))) return false;
  if (!value.questions.every(question => record(question) && nonempty(question.id) && optionalString(question.itemId) && string(question.text)
    && typeof question.selected === 'boolean' && typeof question.edited === 'boolean' && typeof question.reviewRequired === 'boolean'
    && stringList(question.sourceIds) && Array.isArray(question.evidence) && question.evidence.every(evidenceShape) && oneOf(question.basis, ['source', 'note']))) return false;
  // The shape checks above establish the nested types; the remaining checks bind references and versions.
  const episode = value as unknown as Episode;
  const docs = new Map(episode.documents.map(doc => [doc.id, doc]));
  const items = new Map(episode.items.map(item => [item.id, item]));
  if (docs.size !== episode.documents.length || items.size !== episode.items.length
    || new Set(episode.documents.map(doc => doc.fingerprint)).size !== episode.documents.length
    || new Set(episode.links.map(link => link.id)).size !== episode.links.length
    || new Set(episode.links.map(link => `${link.itemId}::${link.documentId}`)).size !== episode.links.length
    || new Set(episode.questions.map(question => question.id)).size !== episode.questions.length) return false;
  for (const doc of episode.documents) {
    if (doc.status !== 'ready') {
      if (doc.entries.length || doc.notices.length) return false;
      continue;
    }
    if (!doc.pages.some(page => page.text.trim())) return false;
    if (episode.person && doc.person && normalize(episode.person) !== normalize(doc.person)) return false;
    if (episode.patientId && doc.patientId && normalize(episode.patientId) !== normalize(doc.patientId)) return false;
    if (doc.kind === 'order' && episode.reference && doc.episodeRef && normalize(episode.reference) !== normalize(doc.episodeRef)) return false;
    if (doc.entries.some(entry => !backedBy(doc, entry.evidence) || !normalize(entry.evidence.quote).includes(normalize(entry.label)))) return false;
    if (doc.notices.some(notice => !backedBy(doc, notice.evidence))) return false;
  }
  for (const item of episode.items) {
    if (item.basis === 'source' && (!item.evidence || docs.get(item.evidence.documentId)?.kind !== 'order' || !backedBy(docs.get(item.evidence.documentId), item.evidence) || !normalize(item.evidence.quote).includes(normalize(item.label)))) return false;
    if (item.basis === 'note' && item.evidence) return false;
  }
  for (const link of episode.links) {
    const doc = docs.get(link.documentId);
    if (!items.has(link.itemId) || doc?.kind !== 'report' || doc.status !== 'ready' || doc.fingerprint !== link.fingerprint) return false;
  }
  if (episode.items.reduce((count, item) => count + getItemLinks(episode, item.id).length, 0) !== episode.links.length) return false;
  for (const question of episode.questions) {
    if (question.itemId !== undefined && !items.has(question.itemId)) return false;
    if (question.evidence.some(evidence => !backedBy(docs.get(evidence.documentId), evidence))) return false;
    const cited = new Set(question.evidence.map(evidence => evidence.documentId));
    if (cited.size !== question.sourceIds.length || question.sourceIds.some(id => !cited.has(id))) return false;
    if (question.basis === 'source' && !question.evidence.length) return false;
  }
  const validRejections = new Set(episode.items.flatMap(item => episode.documents.map(doc => `${item.id}::${doc.id}`)));
  return episode.rejections.every(rejection => validRejections.has(rejection));
}

export async function loadEpisode(): Promise<Episode | null> {
  const database = await db();
  try {
    const value = await database.get('workspace', 'episode');
    if (value === undefined || value === null) return null;
    if (!isStoredEpisode(value)) {
      throw new Error('This saved workspace could not be opened. Your browser copy has been kept.');
    }
    return value;
  } finally { database.close(); }
}

export async function saveEpisode(episode: Episode): Promise<void> {
  if (!isStoredEpisode(episode)) throw new Error('This workspace contains inconsistent source references and was not saved. Keep this window open and review its source evidence.');
  const database = await db();
  try {
    const tx = database.transaction('workspace', 'readwrite');
    await tx.store.put(episode, 'episode');
    await tx.done;
  } finally { database.close(); }
}

export async function clearEpisode(): Promise<void> {
  const database = await db();
  try {
    const tx = database.transaction('workspace', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } finally { database.close(); }
}
