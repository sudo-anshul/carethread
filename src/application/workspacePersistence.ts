import type { Episode } from '../core/types';

/** The durable boundary. A write resolves only after its transaction commits. */
export interface EpisodeWriter {
  save: (episode: Episode) => Promise<void>;
  clear: () => Promise<void>;
}

export type WriteState = 'saving' | 'saved' | 'error';

/** Owns save ordering and deletion barriers independently of React and IndexedDB. */
export function createWorkspacePersistence(writer: EpisodeWriter, report: (state: WriteState) => void) {
  let sequence = 0;
  let pending: { episode: Episode; token: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  let clearing: Promise<void> | undefined;
  let disposed = false;

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function enqueuePending() {
    cancelTimer();
    const snapshot = pending;
    pending = undefined;
    if (!snapshot) return;
    queue = queue.then(async () => {
      // A newer draft or a clear supersedes writes that have not started yet.
      if (snapshot.token !== sequence) return;
      try {
        await writer.save(snapshot.episode);
        if (!disposed && snapshot.token === sequence) report('saved');
      } catch {
        if (!disposed && snapshot.token === sequence) report('error');
      }
    });
  }

  function flush(): Promise<void> {
    enqueuePending();
    return queue;
  }

  return {
    /** Returns false when a deletion or disposal has closed the write boundary. */
    schedule(episode: Episode, immediate = false): boolean {
      if (disposed || clearing) return false;
      pending = { episode, token: ++sequence };
      cancelTimer();
      report('saving');
      if (immediate) enqueuePending();
      else timer = setTimeout(enqueuePending, 300);
      return true;
    },
    flush,
    clear(): Promise<void> {
      if (clearing) return clearing;
      if (disposed) return Promise.reject(new Error('This workspace has closed.'));
      cancelTimer();
      pending = undefined;
      ++sequence;
      // Drain the active transaction, skip superseded queued writes, then delete.
      // Keep this barrier closed to retries until deletion has settled.
      clearing = queue.then(() => writer.clear()).finally(() => { clearing = undefined; });
      queue = clearing.catch(() => {});
      return clearing;
    },
    /** Flush the last draft, then detach UI notifications. Not an unload guarantee. */
    dispose(): Promise<void> {
      const finished = flush();
      disposed = true;
      return finished;
    },
  };
}

export type WorkspacePersistence = ReturnType<typeof createWorkspacePersistence>;
