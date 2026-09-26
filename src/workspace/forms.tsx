import { useState } from "react";
import {
  ArrowRight,
  FilePlus2,
  LoaderCircle,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import type { WorkspaceController } from "../controller";
import type { Episode, TestItem } from "../core/types";
import { addManualItem } from "../core/model";

function requireText(
  field: HTMLInputElement | HTMLTextAreaElement,
  message: string,
) {
  field.setCustomValidity(field.value.trim() ? "" : message);
}

export function CreateForm({
  onCreate,
  onCancel,
}: {
  onCreate: WorkspaceController["create"];
  onCancel: () => void;
}) {
  const [person, setPerson] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [patientId, setPatientId] = useState("");
  const [reference, setReference] = useState("");
  return (
    <form
      className="dialog-body"
      onSubmit={(e) => {
        e.preventDefault();
        if (person.trim() && label.trim())
          onCreate({
            person: person.trim(),
            label: label.trim(),
            date,
            patientId: patientId.trim(),
            reference: reference.trim(),
          });
      }}
    >
      <p className="form-intro">
        Choose a recognizable name for one set of tests. You can begin without
        an order or a date.
      </p>
      <label className="field">
        Person’s name
        <input
          required
          value={person}
          onChange={(e) => {
            requireText(e.currentTarget, "Enter the person’s name.");
            setPerson(e.target.value);
          }}
          placeholder="e.g. Maya Rao"
          autoComplete="off"
          maxLength={120}
        />
      </label>
      <label className="field">
        Episode name
        <input
          required
          value={label}
          onChange={(e) => {
            requireText(e.currentTarget, "Enter an episode name.");
            setLabel(e.target.value);
          }}
          placeholder="e.g. September clinic visit"
          maxLength={160}
        />
      </label>
      <label className="field">
        Episode date <span>Optional</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <details className="form-details">
        <summary>
          Patient and episode references <span>Optional</span>
        </summary>
        <label className="field">
          Patient ID
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="As printed on the documents"
            maxLength={100}
          />
        </label>
        <label className="field">
          Episode reference
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="If this visit has a reference"
            maxLength={100}
          />
        </label>
      </details>
      <div className="form-note">
        <LockKeyhole size={15} /> This prototype stores data only in this
        browser. Use fictional data while exploring.
      </div>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" type="submit">
          Create episode <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}

export function PasteForm({
  onAdd,
  onCancel,
  busy,
}: {
  onAdd: WorkspaceController["addText"];
  onCancel: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"order" | "report" | "note">("order");
  return (
    <form
      className="dialog-body"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && name.trim() && text.trim())
          void onAdd(name.trim(), text, kind);
      }}
    >
      <p className="form-intro">
        Paste the original wording, including any names, dates and reference
        numbers. The text stays available as a source.
      </p>
      <div className="field-row">
        <label className="field">
          Document name
          <input
            required
            value={name}
            onChange={(e) => {
              requireText(e.currentTarget, "Enter a document name.");
              setName(e.target.value);
            }}
            placeholder="e.g. Clinic test order"
            maxLength={180}
          />
        </label>
        <label className="field">
          Document type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="order">Test order</option>
            <option value="report">Report</option>
            <option value="note">Note</option>
          </select>
        </label>
      </div>
      <label className="field">
        Original document text
        <textarea
          required
          value={text}
          onChange={(e) => {
            requireText(e.currentTarget, "Paste the original document text.");
            setText(e.target.value);
          }}
          rows={11}
          placeholder={
            "Patient: Maya Rao\nPatient ID: CT-DEMO-104\nEpisode: CT-2026-09\nOrder date: 2026-09-21\nTest: Complete blood count\nOrder ID: CT-101"
          }
        />
      </label>
      <div className="dialog-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy} type="submit">
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <FilePlus2 size={16} />
          )}{" "}
          Add source text
        </button>
      </div>
    </form>
  );
}

export function ItemForm({
  episode,
  item,
  onSave,
  onCancel,
  onRemove,
  busy = false,
}: {
  episode: Episode;
  item?: TestItem;
  onSave: WorkspaceController["addItem"];
  onCancel: () => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  const [label, setLabel] = useState(item?.label || "");
  const [date, setDate] = useState(item?.date || "");
  const [orderId, setOrderId] = useState(item?.orderId || "");
  const [note, setNote] = useState(item?.note || "");
  const [sourceDocumentId, setSourceId] = useState("");
  const [quote, setQuote] = useState("");
  const [page, setPage] = useState(1);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [error, setError] = useState("");
  const source = episode.documents.find((d) => d.id === sourceDocumentId);
  return (
    <form
      className="dialog-body"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !label.trim()) return;
        if (
          source &&
          (!source.pages
            .find((p) => p.number === page)
            ?.text.includes(quote.trim()) ||
            !quote
              .trim()
              .toLocaleLowerCase()
              .includes(label.trim().toLocaleLowerCase()))
        ) {
          setError(
            "The exact quote must appear on the selected page and include this test name. Check the wording or save this as your own note.",
          );
          return;
        }
        const input = {
          label: label.trim(),
          date,
          orderId: orderId.trim(),
          note: note.trim(),
          ...(sourceDocumentId
            ? { sourceDocumentId, quote: quote.trim(), page }
            : {}),
        };
        if (!item) {
          try {
            addManualItem(episode, input);
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Check the source evidence and try again.",
            );
            return;
          }
        }
        onSave(input);
      }}
    >
      {busy && (
        <p className="form-note" role="status">
          Files are still being read. Your draft stays here; you can save it when reading finishes.
        </p>
      )}
      <p className="form-intro">
        {item
          ? "Changing a name, date or reference removes existing report connections. If your edited fields are not supported by the source passage, the item becomes your own note."
          : "Use the test name on the order. Without a source, this item is clearly labeled as a note added by you."}
      </p>
      <label className="field">
        Test name
        <input
          required
          value={label}
          onChange={(e) => {
            requireText(e.currentTarget, "Enter a test name.");
            setLabel(e.target.value);
          }}
          placeholder="e.g. Complete blood count"
          maxLength={180}
        />
      </label>
      <div className="field-row">
        <label className="field">
          Order reference <span>Optional</span>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="As printed"
            maxLength={100}
          />
        </label>
        <label className="field">
          Order date <span>Optional</span>
          <input
            value={date}
            placeholder="As written, if known"
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        Your note <span>Optional</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What would you like to clarify?"
          maxLength={2000}
        />
      </label>
      {!item && (
        <details className="form-details">
          <summary>
            Attach exact source evidence <span>Optional</span>
          </summary>
          <label className="field">
            Source document
            <select
              value={sourceDocumentId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setPage(1);
                setQuote("");
              }}
            >
              <option value="">No source · keep as my note</option>
              {episode.documents
                .filter((d) => d.status === "ready" && d.kind === "order")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          {source && (
            <>
              <label className="field">
                Page
                <select
                  value={page}
                  onChange={(e) => setPage(Number(e.target.value))}
                >
                  {source.pages.map((p) => (
                    <option key={p.number} value={p.number}>
                      Page {p.number}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="form-source-text"
                role="region"
                aria-label={`Source text from ${source.name}, page ${page}`}
                tabIndex={0}
              >
                {source.pages.find((p) => p.number === page)?.text}
              </div>
              <label className="field">
                Exact quote
                <textarea
                  required
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  rows={3}
                  placeholder="Copy the passage with this test and any date or reference entered above"
                />
              </label>
            </>
          )}
        </details>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {removeConfirm && (
        <div className="warning-banner">
          <p>
            Remove this item and its question? Source documents stay in the
            library. You can undo this action.
          </p>
          <button
            type="button"
            className="button small danger"
            disabled={busy}
            onClick={() => {
              if (!busy) onRemove?.();
            }}
          >
            Remove item
          </button>
        </div>
      )}
      <div className="dialog-actions">
        {onRemove && (
          <button
            type="button"
            className="button ghost danger-text"
            disabled={busy}
            onClick={() => {
              if (!busy) setRemoveConfirm(true);
            }}
          >
            <Trash2 size={15} /> Remove item
          </button>
        )}
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={busy}>
          {item ? "Save changes" : "Add test item"}
        </button>
      </div>
    </form>
  );
}
