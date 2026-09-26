import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDocument, addManualItem, confirmLink, createEpisode, deleteDocument, reviewQuestion, updateQuestion } from './core/model';
import { SAMPLES } from './core/demo';
import { parseDocument } from './core/parser';
import { clearEpisode, isStoredEpisode, loadEpisode, saveEpisode } from './storage';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), clear: vi.fn(), close: vi.fn(), open: vi.fn(), transaction: vi.fn(),
}));
vi.mock('idb', () => ({ openDB: mocks.open }));

function workspace() {
  let ep = createEpisode({ label: 'September visit', person: 'Demo Patient A', patientId: 'DEMO-A', date: '2026-09-21', reference: 'VISIT-A-0921' });
  for (const sample of SAMPLES.filter(value => value.group === 'initial')) {
    ep = addDocument(ep, parseDocument({ id: sample.id, name: sample.filename, pages: sample.pages, fingerprint: sample.id, kind: sample.kind }));
  }
  const item = ep.items.find(value => value.orderId === 'CT-O-02')!;
  return confirmLink(ep, item.id, 'demo-panel-partial');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(undefined);
  mocks.put.mockResolvedValue(undefined);
  mocks.clear.mockResolvedValue(undefined);
  mocks.transaction.mockReturnValue({ store: { put: mocks.put, clear: mocks.clear }, done: Promise.resolve() });
  mocks.open.mockResolvedValue({ get: mocks.get, close: mocks.close, transaction: mocks.transaction });
});

describe('stored v1 boundary', () => {
  it('saves and resumes empty and whitespace-preserving edits with the evidence review flag intact', async () => {
    let ep = workspace();
    const question = ep.questions.find(value => value.reviewRequired)!;
    for (const text of ['', '  A question with spaces.\n\n  ']) {
      ep = updateQuestion(ep, question.id, text);
      expect(isStoredEpisode(ep)).toBe(true);
      await expect(saveEpisode(ep)).resolves.toBeUndefined();
      expect(mocks.put).toHaveBeenLastCalledWith(ep, 'episode');
      mocks.get.mockResolvedValue(ep);
      const resumed = await loadEpisode();
      expect(resumed?.questions.find(value => value.id === question.id)).toMatchObject({ text, edited: true, reviewRequired: true });
    }
  });

  it('accepts current model output, source blobs, explicit retained notes, and removed-item questions', () => {
    let ep = workspace();
    ep.documents[0]!.blob = new Blob(['original source'], { type: 'application/pdf' });
    expect(isStoredEpisode(ep)).toBe(true);
    const item = ep.items.find(value => value.orderId === 'CT-O-02')!;
    const question = ep.questions.find(value => value.itemId === item.id)!;
    ep = updateQuestion(ep, question.id, 'A question I intentionally edited.');
    ep = deleteDocument(ep, 'demo-order', { keepItemsAsNotes: false, keepEditedQuestions: true });
    expect(isStoredEpisode(ep)).toBe(true);
    expect(ep.questions.find(value => value.id === question.id)).toMatchObject({ basis: 'note', evidence: [], itemId: undefined });
    ep = addManualItem(ep, { label: 'My recollection' });
    expect(isStoredEpisode(ep)).toBe(true);
  });

  it('rejects incomplete nested v1 data, invalid enums, and duplicate identities', () => {
    const ep = workspace();
    for (const invalid of [
      { ...ep, links: undefined }, { ...ep, rejections: undefined }, { ...ep, items: [null] },
      { ...ep, questions: [{ ...ep.questions[0], evidence: undefined }] },
      { ...ep, documents: [{ ...ep.documents[0], pages: [{ number: 1, text: null }] }] },
      { ...ep, documents: [{ ...ep.documents[0], status: 'complete' }] },
      { ...ep, items: [...ep.items, ep.items[0]] },
      { ...ep, revision: -1 }, { ...ep, updatedAt: 'not-a-time' },
    ]) expect(isStoredEpisode(invalid)).toBe(false);
  });

  it('rejects dangling, stale, unreadable, and fabricated source references', () => {
    const ep = workspace();
    const partial = ep.documents.find(doc => doc.id === 'demo-panel-partial')!;
    expect(isStoredEpisode({ ...ep, documents: ep.documents.filter(doc => doc.id !== partial.id) })).toBe(false);
    expect(isStoredEpisode({ ...ep, documents: ep.documents.map(doc => doc.id === partial.id ? { ...doc, fingerprint: 'new-version' } : doc) })).toBe(false);
    expect(isStoredEpisode({ ...ep, documents: ep.documents.map(doc => doc.id === partial.id ? { ...doc, status: 'unreadable', entries: [], notices: [] } : doc) })).toBe(false);
    const question = ep.questions.find(q => q.evidence.length)!;
    expect(isStoredEpisode({ ...ep, questions: ep.questions.map(q => q.id === question.id ? { ...q, evidence: [{ ...q.evidence[0], quote: 'fabricated passage' }] } : q) })).toBe(false);
    expect(isStoredEpisode({ ...ep, links: [{ ...ep.links[0], itemId: 'deleted-item' }] })).toBe(false);
    expect(isStoredEpisode({ ...ep, rejections: ['deleted-item::deleted-source'] })).toBe(false);
    expect(isStoredEpisode({ ...ep, questions: ep.questions.map(q => q.id === question.id ? { ...q, sourceIds: ['unrelated-source'] } : q) })).toBe(false);
  });

  it('requires known wrong-person sources to remain quarantined on resume', () => {
    const ep = workspace();
    const sample = SAMPLES.find(value => value.id === 'demo-wrong-person')!;
    const wrong = parseDocument({ id: sample.id, name: sample.filename, pages: sample.pages, fingerprint: sample.id, kind: sample.kind });
    expect(isStoredEpisode({ ...ep, documents: [...ep.documents, wrong] })).toBe(false);
    const quarantined = addDocument(ep, wrong);
    expect(isStoredEpisode(quarantined)).toBe(true);
    expect(quarantined.documents.at(-1)?.status).toBe('quarantined');
  });

  it('closes the connection and preserves invalid stored data rather than returning a falsely saved workspace', async () => {
    const invalid = { ...workspace(), links: undefined };
    mocks.get.mockResolvedValue(invalid);
    await expect(loadEpisode()).rejects.toThrow('browser copy has been kept');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('distinguishes an empty store from a malformed falsy value and returns valid data unchanged', async () => {
    await expect(loadEpisode()).resolves.toBeNull();
    mocks.get.mockResolvedValue(false);
    await expect(loadEpisode()).rejects.toThrow('could not be opened');
    const ep = workspace();
    mocks.get.mockResolvedValue(ep);
    await expect(loadEpisode()).resolves.toBe(ep);
  });
});

describe('transaction outcomes', () => {
  it('CT-15 resolves saving only after the IndexedDB transaction commits', async () => {
    const ep = workspace();
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    mocks.transaction.mockReturnValue({ store: { put: mocks.put }, done });
    let saved = false;
    const pending = saveEpisode(ep).then(() => { saved = true; });
    await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
    expect(saved).toBe(false);
    expect(mocks.close).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(saved).toBe(true);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('CT-15 surfaces transaction failure, keeps the passed draft intact, and allows a retry', async () => {
    let ep = workspace();
    for (const q of ep.questions) ep = reviewQuestion(ep, q.id);
    const snapshot = JSON.stringify(ep);
    let fail!: (reason: Error) => void;
    const done = new Promise<void>((_resolve, reject) => { fail = reject; });
    mocks.transaction.mockReturnValueOnce({ store: { put: mocks.put }, done });
    const result = saveEpisode(ep);
    const rejected = expect(result).rejects.toThrow('Quota exceeded');
    await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
    fail(new Error('Quota exceeded'));
    await rejected;
    expect(JSON.stringify(ep)).toBe(snapshot);
    expect(mocks.close).toHaveBeenCalledOnce();
    await expect(saveEpisode(ep)).resolves.toBeUndefined();
    expect(mocks.put).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite the stored copy when an in-memory state fails validation', async () => {
    const ep = workspace();
    ep.links[0]!.documentId = 'removed-document';
    await expect(saveEpisode(ep)).rejects.toThrow('was not saved');
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('awaits deletion commit before reporting clear success', async () => {
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    mocks.transaction.mockReturnValue({ store: { clear: mocks.clear }, done });
    let cleared = false;
    const result = clearEpisode().then(() => { cleared = true; });
    await vi.waitFor(() => expect(mocks.clear).toHaveBeenCalledOnce());
    expect(cleared).toBe(false);
    finish(); await result;
    expect(cleared).toBe(true);
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
