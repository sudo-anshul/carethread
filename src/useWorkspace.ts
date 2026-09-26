import { useEffect, useRef, useState } from 'react';
import * as model from './core/model';
import { DEMO_EPISODE, demoDocuments } from './core/demo';
import type { WorkspaceController } from './controller';
import type { Episode, ImportProgress, SaveState } from './core/types';
import { loadEpisode, saveEpisode, clearEpisode } from './storage';
import { documentFromText, readFile } from './documents';
import { applyImportedDocument } from './application/documentImport';
import { createWorkspacePersistence, type WorkspacePersistence } from './application/workspacePersistence';

export function useWorkspace(): WorkspaceController {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const current = useRef<Episode | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<ImportProgress[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const previous = useRef<Episode | null>(null);
  const loaded = useRef(false);
  const loadingFailed = useRef(false);
  const persistence = useRef<WorkspacePersistence | null>(null);

  useEffect(() => {
    let active = true;
    const writes = createWorkspacePersistence({ save: saveEpisode, clear: clearEpisode }, state => {
      if (!active) return;
      setSaveState(state);
      if (state === 'error') setError('Changes are still open here, but could not be saved on this device. The previous saved copy, including any documents removed from this draft, may still be stored. Retry saving before leaving, or export your questions.');
    });
    persistence.current = writes;
    void loadEpisode().then(value => {
      if (!active) return;
      current.current = value; setEpisode(value); loaded.current = true; setSaveState('saved');
    }).catch(() => {
      if (!active) return;
      loaded.current = true; loadingFailed.current = true;
      setError('Saved data could not be opened. Reload to retry. Clear this device’s workspace only if you want to discard its saved copy.'); setSaveState('error');
    });
    return () => {
      active = false;
      persistence.current = null;
      void writes.dispose();
    };
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === 'saving' || saveState === 'error' || busy) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saveState, busy]);

  function message(error: unknown) { return error instanceof Error ? error.message : 'That change could not be completed. Your existing work is still here.'; }
  function commit(next: Episode, allowUndo = true) {
    if (next === current.current) return;
    if (allowUndo) { previous.current = current.current; setCanUndo(!!previous.current); }
    else { previous.current = null; setCanUndo(false); }
    current.current = next; setEpisode(next); setError(''); persistence.current?.schedule(next);
  }
  function change(action: (ep: Episode) => Episode, success?: string, allowUndo = true) {
    try {
      if (busyRef.current) throw new Error('Wait for the current files to finish reading before changing this workspace.');
      if (!current.current) throw new Error('Start an episode first.');
      commit(action(current.current), allowUndo);
      if (success) setNotice(success);
      return true;
    } catch (e) { setError(message(e)); return false; }
  }
  function lock(value: boolean) { busyRef.current = value; setBusy(value); }

  return {
    episode, saveState, error, notice, progress, busy, canUndo,
    create(input) {
      if (!loaded.current || busyRef.current) return false;
      if (loadingFailed.current) { setError('Clear the unreadable saved workspace before starting another one.'); return false; }
      if (current.current) { setError('Clear the current workspace before starting another episode.'); return false; }
      try { commit(model.createEpisode(input), false); setNotice('Your workspace is ready. Add an order or begin with a note.'); return true; }
      catch (e) { setError(message(e)); return false; }
    },
    async loadDemo() {
      if (busyRef.current || !loaded.current) return;
      if (loadingFailed.current || (current.current && !current.current.demo)) { setError('Clear the existing workspace before opening the sample. Your current work has been kept.'); return; }
      lock(true); setError('');
      try {
        const docs = await demoDocuments();
        let next = { ...model.createEpisode(DEMO_EPISODE), demo: true };
        for (const doc of docs) next = model.addDocument(next, doc);
        commit(next, false); setProgress([]);
        setNotice('Fictional sample loaded. Review the two possible matches and the older report.');
      } catch (e) { setError(message(e)); }
      finally { lock(false); }
    },
    async importFiles(files, replaceId) {
      if (busyRef.current || !current.current || !files.length) return;
      lock(true); setError('');
      const accepted = files.slice(0, 10);
      setProgress(accepted.map(f => ({ name: f.name, state: 'reading' })));
      if (files.length > 10) setNotice('Reading the first 10 files. Add any remaining files in another batch.');
      try {
        for (let index = 0; index < accepted.length; index++) {
          const file = accepted[index];
          try {
            const doc = await readFile(file);
            const result = applyImportedDocument(current.current!, doc, index === 0 ? replaceId : undefined);
            commit(result.episode, false);
            setProgress(p => p.map((v, i) => i === index ? { ...v, state: 'done', message: result.message } : v));
          } catch (e) {
            setProgress(p => p.map((v, i) => i === index ? { ...v, state: 'error', message: message(e) } : v));
          }
        }
      } finally { lock(false); }
    },
    async addText(name, text, kind) {
      if (busyRef.current || !current.current) return false;
      lock(true); setError('');
      try {
        if (!text.trim()) throw new Error('Add some source text first.');
        const doc = await documentFromText(name || 'Pasted document', text, kind);
        const next = model.addDocument(current.current, doc);
        if (next === current.current) setNotice('This source text is already in the workspace.');
        else { commit(next, false); setNotice('Text added. Check the details we found.'); }
        return true;
      } catch (e) { setError(message(e)); return false; }
      finally { lock(false); }
    },
    addItem: input => change(ep => model.addManualItem(ep, input), 'Item added. You can connect a report or prepare a question.'),
    editItem: (id, edit) => change(ep => model.editItem(ep, id, edit), 'Item updated. Check any affected connections.'),
    removeItem: id => change(ep => model.removeItem(ep, id), 'Item removed. Its original documents are still here.'),
    reviewItem: id => change(ep => model.reviewItem(ep, id), 'Details marked as checked by you.'),
    link: (itemId, docId) => change(ep => model.confirmLink(ep, itemId, docId), 'Report linked by you. This does not confirm clinical review.'),
    unlink: id => change(ep => model.unlink(ep, id), 'Connection removed. Both documents are still here.'),
    reject: (itemId, docId) => change(ep => model.rejectCandidate(ep, itemId, docId), 'Suggestion dismissed.'),
    restoreSuggestions: itemId => change(ep => model.restoreCandidates(ep, itemId), 'Dismissed suggestions are available again.'),
    deleteDocument: (id, options) => change(ep => model.deleteDocument(ep, id, options), 'Source removed from the open draft. Related evidence and questions were updated. Wait for “Saved on this device” to confirm the stored copy is updated.', false),
    editQuestion: (id, text) => change(ep => model.updateQuestion(ep, id, text)),
    selectQuestion: (id, selected) => change(ep => model.selectQuestion(ep, id, selected)),
    reviewQuestion: id => change(ep => model.reviewQuestion(ep, id), 'Question reviewed for the current sources.'),
    resetQuestion: id => change(ep => model.resetQuestion(ep, id), 'Question restored from the current evidence.'),
    undo() {
      if (!previous.current || busyRef.current || !current.current) return;
      const next = { ...previous.current, revision: current.current.revision + 1, updatedAt: new Date().toISOString() };
      commit(next, false); setNotice('Previous change undone.');
    },
    retrySave() {
      if (current.current && !busyRef.current) {
        setError(''); persistence.current?.schedule(current.current, true);
      }
    },
    async clear() {
      if (busyRef.current || !loaded.current || !persistence.current) return false;
      lock(true);
      try {
        await persistence.current.clear();
        previous.current = null; setCanUndo(false); current.current = null; setEpisode(null); setProgress([]);
        loadingFailed.current = false; setSaveState('saved'); setError(''); setNotice('Workspace cleared from this device. Downloaded copies are unaffected.');
        return true;
      } catch { setSaveState('error'); setError('The saved workspace could not be cleared. Your data is still here; try again.'); return false; }
      finally { lock(false); }
    },
    dismissNotice() { setNotice(''); setError(''); },
  };
}
