import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { WorkspaceController } from "../controller";
import type { Episode, View } from "../core/types";
import { Dialog, type Modal } from "./shared";
import { CreateForm, ItemForm, PasteForm } from "./forms";
import { DeleteDocumentForm, SourceView } from "./documents";

export function WorkspaceDialog({
  modal,
  ep,
  workspace,
  close,
  upload,
  setView,
}: {
  modal: Exclude<Modal, null>;
  ep: Episode | null;
  workspace: WorkspaceController;
  close: () => void;
  upload: (id?: string) => void;
  setView: (view: View) => void;
}) {
  const [failed, setFailed] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const finish = (succeeded: boolean) => {
    if (succeeded) close();
    else setFailed(true);
    return succeeded;
  };
  useEffect(() => {
    if (failed) errorRef.current?.focus();
  }, [failed, workspace.error]);
  return (
    <Dialog
      title={
        modal.type === "create"
          ? "Start one care episode"
          : modal.type === "paste"
            ? "Add document text"
            : modal.type === "manual"
              ? "Add a test item"
              : modal.type === "edit"
                ? "Edit test item"
                : modal.type === "source"
                  ? "Source document"
                  : modal.type === "replace"
                    ? "Replace this document?"
                    : modal.type === "delete"
                      ? "Remove this document?"
                      : modal.type === "clear"
                        ? "Clear this episode?"
                        : "About CareThread"
      }
      wide={modal.type === "source"}
      onClose={close}
    >
      {failed && (
        <p ref={errorRef} tabIndex={-1} className="form-error dialog-action-error" role="alert">
          {workspace.error || "This change could not be completed. Your entries are still here; try again."}
        </p>
      )}
      {modal.type === "create" && (
        <CreateForm
          onCancel={close}
          onCreate={(input) => {
            const succeeded = finish(workspace.create(input));
            if (succeeded) setView("overview");
            return succeeded;
          }}
        />
      )}
      {modal.type === "paste" && (
        <PasteForm
          busy={workspace.busy}
          onCancel={close}
          onAdd={async (name, text, kind) => {
            return finish(await workspace.addText(name, text, kind));
          }}
        />
      )}
      {(modal.type === "manual" || modal.type === "edit") && ep && (
        <ItemForm
          episode={ep}
          busy={workspace.busy}
          item={modal.type === "edit" ? modal.item : undefined}
          onCancel={close}
          onSave={(input) => {
            return finish(modal.type === "edit"
              ? workspace.editItem(modal.item.id, input)
              : workspace.addItem(input));
          }}
          onRemove={
            modal.type === "edit"
              ? () => {
                  finish(workspace.removeItem(modal.item.id));
                }
              : undefined
          }
        />
      )}
      {modal.type === "source" && (
        <SourceView
          doc={ep?.documents.find((d) => d.id === modal.doc.id) || modal.doc}
          onClose={close}
        />
      )}
      {modal.type === "replace" && (
        <div className="dialog-body">
          <p>
            Choose a new file to replace <strong>{modal.doc.name}</strong>.
            After the replacement is read, the old source and its extracted
            items, links and source-based questions will be removed. Edited
            questions may also be removed. Review the replacement as new
            evidence.
          </p>
          <div className="warning-banner">
            <AlertTriangle size={18} />
            <p>
              Removing the old source cannot be undone. If the replacement
              cannot be read or belongs to another person, the original is kept.
            </p>
          </div>
          <div className="dialog-actions">
            <button className="button secondary" onClick={close}>
              Keep original
            </button>
            <button
              className="button primary"
              disabled={workspace.busy}
              onClick={() => {
                upload(modal.doc.id);
                close();
              }}
            >
              Choose replacement
            </button>
          </div>
        </div>
      )}
      {modal.type === "delete" && (
        <DeleteDocumentForm
          doc={modal.doc}
          onCancel={close}
          onDelete={(options) => {
            finish(workspace.deleteDocument(modal.doc.id, options));
          }}
        />
      )}
      {modal.type === "clear" && (
        <div className="dialog-body">
          <p>
            Remove this episode, its documents, links and questions from this
            browser. Downloaded question sheets and your original files are
            unaffected.
          </p>
          <div className="warning-banner">
            <AlertTriangle size={18} />
            <p>This deletion cannot be undone.</p>
          </div>
          <div className="dialog-actions">
            <button className="button secondary" onClick={close}>
              Keep episode
            </button>
            <button
              className="button danger"
              disabled={workspace.busy}
              onClick={async () => {
                if (finish(await workspace.clear())) setView("overview");
              }}
            >
              Clear episode
            </button>
          </div>
        </div>
      )}
      {modal.type === "help" && (
        <div className="dialog-body help-content">
          <div className="help-intro">
            <ShieldCheck size={27} />
            <p>
              A place to prepare questions
              <br />
              <strong>with the source beside you.</strong>
            </p>
          </div>
          <h3>What a connection means</h3>
          <p>
            “Report linked by you” records your choice to connect two pieces of
            information. It does not establish that a test or your care is
            complete, or that a clinician reviewed the report.
          </p>
          <h3>Suggestions you can inspect</h3>
          <p>
            CareThread uses local text-reading and matching rules to suggest
            connections. Check names, references, dates and exact source
            wording. Conflicting evidence remains visible; there are no clinical
            interpretations.
          </p>
          <h3>Where your information lives</h3>
          <p>
            Documents and your changes stay in IndexedDB in this browser. This
            version makes no external document or AI calls. Saving is confirmed
            only after the browser accepts the changes. There is no account,
            sync or server backup.
          </p>
          <p>
            This is a working prototype intended for fictional demonstration
            data. Anyone with access to this browser profile may be able to open
            saved work.
          </p>
          <h3>Removing information</h3>
          <p>
            Remove a source from Documents or clear the episode to delete
            locally saved information. Actual document deletion cannot be
            undone. Clearing browser data also removes the workspace; downloaded
            exports remain separate copies.
          </p>
          <div className="dialog-actions">
            <button className="button primary" onClick={close}>
              Back to workspace
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
