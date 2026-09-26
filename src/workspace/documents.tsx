import { useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  LockKeyhole,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { Episode, SourceDocument } from "../core/types";
import { openSource } from "../export";
import { Empty, dateText, kindLabel, type OpenModal } from "./shared";

export function DocumentsView({
  ep,
  openModal,
  upload,
}: {
  ep: Episode;
  openModal: OpenModal;
  upload: () => void;
}) {
  return (
    <>
      <div className="document-intro">
        <div>
          <FileText size={20} />
          <p>
            <strong>PDFs with selectable text and plain text</strong>
            <span>
              Images and scanned PDFs can be kept as attachments for manual
              reference.
            </span>
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => openModal({ type: "paste" })}
        >
          <NotebookPen size={16} /> Paste text
        </button>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            Source library{" "}
            <span className="count-label">{ep.documents.length}</span>
          </h2>
          <span className="subtle">Only for {ep.person}</span>
        </div>
        {ep.documents.length ? (
          ep.documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onOpen={() => openModal({ type: "source", doc })}
              onDelete={() => openModal({ type: "delete", doc })}
              onReplace={() => openModal({ type: "replace", doc })}
            />
          ))
        ) : (
          <Empty
            icon={<FolderOpen size={28} />}
            title="Bring the pieces together"
            action={
              <button className="button primary" onClick={() => upload()}>
                <Upload size={16} /> Choose files
              </button>
            }
          >
            Add an order, report, or note. Each document keeps its own source
            text and reading status.
          </Empty>
        )}
      </section>
      <div className="source-note">
        <ShieldCheck size={17} />
        <p>
          Files are stored in this browser. Clearing browser data can remove
          them. Keep your original files elsewhere.
        </p>
      </div>
    </>
  );
}

export function DocumentRow({
  doc,
  compact,
  onOpen,
  onDelete,
  onReplace,
}: {
  doc: SourceDocument;
  compact?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onReplace: () => void;
}) {
  const quarantined = doc.status === "quarantined";
  const unread = doc.status === "unreadable" || doc.status === "failed";
  return (
    <div className={`document-row ${quarantined ? "quarantined-row" : ""}`}>
      <div
        className={`document-icon ${quarantined || unread ? "document-warning" : ""}`}
      >
        {quarantined ? <LockKeyhole size={21} /> : <FileText size={21} />}
      </div>
      <div className="document-info">
        <strong>{doc.name}</strong>
        {quarantined ? (
          <>
            <span className="text-warning">Excluded from this episode</span>
            <p>
              Source identity or episode does not match. Its contents are hidden
              here.
            </p>
          </>
        ) : (
          <>
            <span>
              {kindLabel(doc)}
              {doc.reportDate || doc.date
                ? ` · ${dateText(doc.reportDate || doc.date)}`
                : ""}
              {doc.pages.length
                ? ` · ${doc.pages.length} ${doc.pages.length === 1 ? "page" : "pages"}`
                : ""}
            </span>
            {!compact && (
              <p className={unread ? "text-warning" : ""}>
                {doc.error ||
                  (doc.status === "ready"
                    ? "Text available to check against the original."
                    : "Automatic reading unavailable. Keep as a reference and add notes manually.")}
              </p>
            )}
          </>
        )}
      </div>
      <div className="document-actions">
        {!quarantined && (
          <span className={`reading-status ${unread ? "reading-warning" : ""}`}>
            {doc.status === "ready" ? (
              <>
                <CheckCheck size={13} /> Text read
              </>
            ) : (
              <>
                <AlertTriangle size={13} />{" "}
                {doc.status === "failed" ? "Reading failed" : "Not read"}
              </>
            )}
          </span>
        )}
        {!quarantined && (
          <button className="button small secondary" onClick={onOpen}>
            <Eye size={14} />
            {compact ? "View" : "View source"}
          </button>
        )}
        {(!compact || quarantined) && (
          <>
            <button
              className="icon-button"
              title="Replace file"
              aria-label={`Replace ${doc.name}`}
              onClick={onReplace}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="icon-button"
              title="Remove document"
              aria-label={`Remove ${doc.name}`}
              onClick={onDelete}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function SourceView({
  doc,
  onClose,
}: {
  doc: SourceDocument;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [openError, setOpenError] = useState("");
  if (doc.status === "quarantined")
    return (
      <div className="dialog-body">
        <div className="warning-banner">
          <LockKeyhole size={20} />
          <p>
            This document is excluded because its identity or episode conflicts
            with the active episode. Its source contents are hidden. Remove it
            or replace it from Documents.
          </p>
        </div>
        <div className="dialog-actions">
          <button className="button primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  return (
    <div className="dialog-body">
      <div className="source-view-heading">
        <div>
          <h3>{doc.name}</h3>
          <p>
            {kindLabel(doc)} ·{" "}
            {doc.status === "ready" ? "Extracted text" : "Text not read"}
          </p>
        </div>
        {doc.blob && (
          <button
            className="button secondary small"
            onClick={() => {
              try {
                openSource(doc);
              } catch {
                setOpenError(
                  "The original could not be downloaded. Try viewing the extracted text below.",
                );
              }
            }}
          >
            <ExternalLink size={15} /> Download original
          </button>
        )}
      </div>
      {openError && (
        <p className="form-error" role="alert">
          {openError}
        </p>
      )}
      {doc.error && (
        <div className="warning-banner">
          <AlertTriangle size={17} />
          <p>{doc.error}</p>
        </div>
      )}
      {doc.pages.length ? (
        <>
          <div className="source-page-controls">
            <label>
              Page{" "}
              <select
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              >
                {doc.pages.map((p) => (
                  <option key={p.number} value={p.number}>
                    {p.number}
                  </option>
                ))}
              </select>{" "}
              of {doc.pages.length}
            </label>
            <span>Compare this text with the original.</span>
          </div>
          <pre className="source-full-text">
            {doc.pages.find((p) => p.number === page)?.text ||
              doc.pages[0].text}
          </pre>
        </>
      ) : (
        <Empty icon={<FileText size={25} />} title="No text was read">
          Download the original for manual reference. You can add a test item or
          note without claiming it came from extracted text.
        </Empty>
      )}
      <div className="dialog-actions">
        <button className="button primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export function DeleteDocumentForm({
  doc,
  onCancel,
  onDelete,
}: {
  doc: SourceDocument;
  onCancel: () => void;
  onDelete: (options: {
    keepItemsAsNotes: boolean;
    keepEditedQuestions: boolean;
  }) => void;
}) {
  const [keepItems, setKeepItems] = useState(false);
  const [keepQuestions, setKeepQuestions] = useState(false);
  return (
    <div className="dialog-body">
      <p>
        <strong>{doc.name}</strong> will be removed, along with its extracted
        text, source quotations and connections. Affected questions will be
        updated.
      </p>
      {doc.status !== "quarantined" && (
        <div className="delete-options">
          <label>
            <input
              type="checkbox"
              checked={keepItems}
              onChange={(e) => setKeepItems(e.target.checked)}
            />
            <span>
              <strong>Keep item names as my own notes</strong>
              <span>
                The deleted document will no longer support these items.
              </span>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={keepQuestions}
              onChange={(e) => setKeepQuestions(e.target.checked)}
            />
            <span>
              <strong>Keep questions I edited</strong>
              <span>
                Their wording may mention removed information and will need
                review.
              </span>
            </span>
          </label>
        </div>
      )}
      <div className="warning-banner">
        <AlertTriangle size={18} />
        <p>
          Deleting a source cannot be undone. Existing downloads are separate
          copies.
        </p>
      </div>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onCancel}>
          Keep document
        </button>
        <button
          className="button danger"
          onClick={() =>
            onDelete({
              keepItemsAsNotes: keepItems,
              keepEditedQuestions: keepQuestions,
            })
          }
        >
          <Trash2 size={15} /> Remove document
        </button>
      </div>
    </div>
  );
}
