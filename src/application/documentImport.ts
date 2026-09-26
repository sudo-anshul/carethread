import { addDocument, deleteDocument } from '../core/model';
import type { Episode, SourceDocument } from '../core/types';

export interface DocumentImportResult {
  episode: Episode;
  message: string;
}

/**
 * Apply one already-read source without changing the supplied episode or source.
 * File reading, batch progress, and persistence belong to the caller. A duplicate
 * returns the original episode; a rejected replacement throws before any change
 * can be committed, so its original source and evidence remain available.
 */
export function applyImportedDocument(
  episode: Episode,
  document: SourceDocument,
  replaceId?: string,
): DocumentImportResult {
  const duplicate = episode.documents.find(source => source.fingerprint === document.fingerprint
    && source.status !== 'failed' && source.status !== 'unreadable');
  if (duplicate) {
    return { episode, message: `Already added as ${duplicate.name}. No duplicate was created.` };
  }

  let next: Episode;
  if (replaceId) {
    if (document.status !== 'ready') {
      throw new Error('The replacement could not be read. The original has been kept; add this copy separately for manual reference.');
    }
    // Validate against the complete episode before removing the original source.
    const validated = addDocument(episode, document);
    if (validated.documents.find(source => source.id === document.id)?.status === 'quarantined') {
      throw new Error('The replacement belongs to a different person. The original has been kept.');
    }
    const withoutOriginal = deleteDocument(episode, replaceId, {
      keepItemsAsNotes: false,
      keepEditedQuestions: false,
    });
    next = addDocument(withoutOriginal, document);
  } else {
    next = addDocument(episode, document);
  }

  const stored = next.documents.find(source => source.id === document.id);
  return {
    episode: next,
    message: stored?.status === 'quarantined' ? 'Set aside. Check the person on this document.'
      : document.status === 'unreadable' ? 'Kept as a reference. Add details manually.'
        : 'Added. Check the extracted details.',
  };
}
