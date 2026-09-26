export type DocumentKind = 'order' | 'report' | 'note' | 'unknown';
export type DocumentStatus = 'ready' | 'unreadable' | 'failed' | 'quarantined';
export interface SourcePage { number: number; text: string }
export interface Evidence { documentId: string; fingerprint: string; page: number; quote: string }
export interface SourceEntry { label: string; orderId?: string; date?: string; evidence: Evidence }
export interface SourceNotice { type: 'cancelled' | 'amended' | 'partial' | 'preliminary'; targetId?: string; evidence: Evidence }
export interface SourceDocument {
  id: string; name: string; kind: DocumentKind; status: DocumentStatus; fingerprint: string;
  pages: SourcePage[]; entries: SourceEntry[]; notices: SourceNotice[];
  person?: string; patientId?: string; episodeRef?: string; orderIds: string[];
  date?: string; collectionDate?: string; reportDate?: string; reportId?: string; reportLabel?: string;
  createdAt: string; error?: string; mime: string; size: number; blob?: Blob;
}
export interface TestItem {
  id: string; label: string; orderId?: string; date?: string; basis: 'source' | 'note';
  evidence?: Evidence; reviewed: boolean; note: string;
}
export interface ReportLink { id: string; itemId: string; documentId: string; fingerprint: string; confirmedAt: string }
export interface Candidate { itemId: string; documentId: string; reasons: string[]; conflicts: string[]; evidence?: Evidence }
export interface Question {
  id: string; itemId?: string; text: string; selected: boolean; edited: boolean;
  reviewRequired: boolean; sourceIds: string[]; evidence: Evidence[]; basis: 'source' | 'note';
}
export interface Episode {
  schemaVersion: 1; id: string; label: string; person: string; patientId: string; date: string; reference: string;
  demo: boolean; revision: number; updatedAt: string;
  documents: SourceDocument[]; items: TestItem[]; links: ReportLink[]; rejections: string[]; questions: Question[];
}
export interface EpisodeInput { label: string; person: string; patientId?: string; date?: string; reference?: string }
export interface ManualItemInput { label: string; orderId?: string; date?: string; note?: string; sourceDocumentId?: string; page?: number; quote?: string }
export interface ItemEdit { label: string; orderId?: string; date?: string; note?: string }
export interface DeleteOptions { keepItemsAsNotes: boolean; keepEditedQuestions: boolean }
export interface ImportProgress { name: string; state: 'reading' | 'done' | 'error'; message?: string }
export type SaveState = 'loading' | 'saving' | 'saved' | 'error';
export type View = 'overview' | 'tests' | 'documents' | 'questions';
