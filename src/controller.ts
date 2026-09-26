import type { Episode, EpisodeInput, ImportProgress, ItemEdit, ManualItemInput, DeleteOptions, SaveState } from './core/types';
export interface WorkspaceController {
  episode: Episode | null; saveState: SaveState; error: string; notice: string; progress: ImportProgress[]; busy: boolean;
  create: (input: EpisodeInput) => boolean;
  loadDemo: () => Promise<void>;
  importFiles: (files: File[], replaceId?: string) => Promise<void>;
  addText: (name: string, text: string, kind: 'order' | 'report' | 'note') => Promise<boolean>;
  addItem: (input: ManualItemInput) => boolean;
  editItem: (id: string, edit: ItemEdit) => boolean;
  removeItem: (id: string) => boolean;
  reviewItem: (id: string) => void;
  link: (itemId: string, docId: string) => void;
  unlink: (linkId: string) => void;
  reject: (itemId: string, docId: string) => void;
  restoreSuggestions: (itemId: string) => void;
  deleteDocument: (id: string, options: DeleteOptions) => boolean;
  editQuestion: (id: string, text: string) => void;
  selectQuestion: (id: string, selected: boolean) => void;
  reviewQuestion: (id: string) => void;
  resetQuestion: (id: string) => void;
  undo: () => void; canUndo: boolean;
  retrySave: () => void;
  clear: () => Promise<boolean>;
  dismissNotice: () => void;
}
