import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../core/demo';
import { addDocument, confirmLink, createEpisode, reviewQuestion, updateQuestion } from '../core/model';
import { parseDocument } from '../core/parser';
import type { SourceDocument } from '../core/types';
import { applyImportedDocument } from './documentImport';

function sample(sampleId: string, id = sampleId): SourceDocument {
  const source = SAMPLES.find(value => value.id === sampleId)!;
  return parseDocument({ id, name: source.filename, kind: source.kind,
    pages: source.pages, fingerprint: `sample-${id}` });
}

function episode() {
  return createEpisode({ label: 'September visit', person: 'Demo Patient A', patientId: 'DEMO-A',
    reference: 'VISIT-A-0921', date: '2026-09-21' });
}

function linkedEpisode() {
  let current = addDocument(episode(), sample('demo-order'));
  current = addDocument(current, sample('demo-panel-partial'));
  const item = current.items.find(value => value.orderId === 'CT-O-02')!;
  current = confirmLink(current, item.id, 'demo-panel-partial');
  const question = current.questions.find(value => value.itemId === item.id)!;
  current = updateQuestion(current, question.id, 'My copied partial-report text needs clarification.');
  return reviewQuestion(current, question.id);
}

describe('document import application boundary', () => {
  it('treats a renamed duplicate as a no-op even when replacement was requested', () => {
    const current = linkedEpisode();
    const source = { ...current.documents[1]!, id: 'renamed', name: 'download-copy.pdf' };
    const result = applyImportedDocument(current, source, 'demo-order');
    expect(result.episode).toBe(current);
    expect(result.message).toBe('Already added as metabolic-panel-partial.pdf. No duplicate was created.');
    expect(result.episode.documents.some(value => value.id === 'demo-order')).toBe(true);
  });

  it('rejects a wrong-person replacement without losing the original or its reviewed evidence', () => {
    const current = linkedEpisode();
    const source = sample('demo-wrong-person');
    const before = structuredClone(current);
    const beforeSource = structuredClone(source);
    expect(() => applyImportedDocument(current, source, 'demo-panel-partial'))
      .toThrow('The replacement belongs to a different person. The original has been kept.');
    expect(current).toEqual(before);
    expect(source).toEqual(beforeSource);
  });

  it('keeps the entire original episode when a replacement order names a different episode', () => {
    const current = linkedEpisode();
    const fixture = SAMPLES.find(value => value.id === 'demo-order')!;
    const source = parseDocument({
      id: 'different-episode-order', name: fixture.filename, kind: 'order',
      fingerprint: 'sample-different-episode-order',
      pages: fixture.pages.map(page => ({ ...page, text: page.text.replace('VISIT-A-0921', 'VISIT-A-0702') })),
    });
    const before = structuredClone(current);
    const beforeSource = structuredClone(source);
    expect(source.status).toBe('ready');
    expect(() => applyImportedDocument(current, source, 'demo-order'))
      .toThrow('The replacement belongs to a different person. The original has been kept.');
    expect(current).toEqual(before);
    expect(source).toEqual(beforeSource);
  });

  it.each(['unreadable', 'failed'] as const)('keeps the original when replacement status is %s', status => {
    const current = linkedEpisode();
    const source = { ...sample('demo-scan-only'), status };
    const before = structuredClone(current);
    expect(() => applyImportedDocument(current, source, 'demo-panel-partial'))
      .toThrow('The replacement could not be read. The original has been kept; add this copy separately for manual reference.');
    expect(current).toEqual(before);
  });

  it('preserves the original when a readable replacement fails source validation', () => {
    const current = linkedEpisode();
    const source = sample('demo-panel-partial', 'invalid-replacement');
    source.entries[0]!.evidence.quote = 'This passage is absent from the original source.';
    const before = structuredClone(current);
    expect(() => applyImportedDocument(current, source, 'demo-panel-partial')).toThrow(/could not be verified/);
    expect(current).toEqual(before);
  });

  it('does not add a replacement if its target was removed', () => {
    const current = linkedEpisode();
    const before = structuredClone(current);
    expect(() => applyImportedDocument(current, sample('demo-amended-report'), 'removed-source'))
      .toThrow('This source has been removed. Add the document again before using it.');
    expect(current).toEqual(before);
  });

  it('invalidates old report links and copied questions when replacing a valid report', () => {
    const current = linkedEpisode();
    const source = sample('demo-amended-report');
    const before = structuredClone(current);
    const beforeSource = structuredClone(source);
    const result = applyImportedDocument(current, source, 'demo-panel-partial');
    expect(result.message).toBe('Added. Check the extracted details.');
    expect(result.episode.documents.map(value => value.id)).toEqual(['demo-order', 'demo-amended-report']);
    expect(result.episode.links).toEqual([]);
    expect(result.episode.items).toEqual(current.items);
    const item = current.items.find(value => value.orderId === 'CT-O-02')!;
    const question = result.episode.questions.find(value => value.itemId === item.id)!;
    expect(question).toMatchObject({ edited: false, reviewRequired: true });
    expect(question.text).not.toContain('My copied partial-report text');
    expect(question.sourceIds).not.toContain('demo-panel-partial');
    expect(question.evidence.every(value => value.documentId !== 'demo-panel-partial')).toBe(true);
    expect(current).toEqual(before);
    expect(source).toEqual(beforeSource);
  });

  it('rebuilds source items from a replacement order and requires fresh review and connections', () => {
    const current = linkedEpisode();
    const source = sample('demo-order', 'replacement-order');
    const result = applyImportedDocument(current, source, 'demo-order');
    expect(result.episode.items).toHaveLength(3);
    expect(result.episode.items.every(value => value.evidence?.documentId === 'replacement-order'
      && value.evidence.fingerprint === source.fingerprint && !value.reviewed)).toBe(true);
    expect(result.episode.links).toEqual([]);
    expect(result.episode.questions.every(value => !value.sourceIds.includes('demo-order')
      && value.evidence.every(evidence => evidence.documentId !== 'demo-order'))).toBe(true);
    expect(result.episode.documents.some(value => value.id === 'demo-panel-partial')).toBe(true);
  });

  it('retains a wrong-person import separately without incorporating its facts', () => {
    const current = addDocument(episode(), sample('demo-order'));
    const source = sample('demo-wrong-person');
    const beforeSource = structuredClone(source);
    const result = applyImportedDocument(current, source);
    expect(result.message).toBe('Set aside. Check the person on this document.');
    expect(result.episode.documents.find(value => value.id === source.id))
      .toMatchObject({ status: 'quarantined', entries: [], notices: [] });
    expect(result.episode.items).toEqual(current.items);
    expect(result.episode.links).toEqual([]);
    expect(result.episode.questions).toEqual(current.questions);
    expect(source).toEqual(beforeSource);
  });

  it('retains an unreadable import for manual reference without creating facts', () => {
    const current = episode();
    const source = sample('demo-scan-only');
    const result = applyImportedDocument(current, source);
    expect(result.message).toBe('Kept as a reference. Add details manually.');
    expect(result.episode.documents[0]).toMatchObject({ id: source.id, status: 'unreadable', entries: [] });
    expect(result.episode.items).toEqual([]);
    expect(result.episode.questions).toEqual(current.questions);
    expect(current.documents).toEqual([]);
  });

  it('allows a readable retry of unreadable bytes to replace the reference without duplicating it', () => {
    const source = sample('demo-order', 'readable-retry');
    const unreadable = { ...source, id: 'unreadable-copy', status: 'unreadable' as const };
    const current = addDocument(episode(), unreadable);
    const result = applyImportedDocument(current, source);
    expect(result.message).toBe('Added. Check the extracted details.');
    expect(result.episode.documents).toHaveLength(1);
    expect(result.episode.documents[0]).toMatchObject({ id: source.id, status: 'ready' });
    expect(result.episode.items).toHaveLength(3);
    expect(current.documents[0]!.status).toBe('unreadable');
  });
});
