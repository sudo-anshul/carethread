import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  Copy,
  Eye,
  MessageSquareText,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { WorkspaceController } from "../controller";
import type { Episode, Question } from "../core/types";
import { Brand, Empty, dateText, type OpenModal } from "./shared";

export function QuestionsView({
  ep,
  workspace,
  selectedQuestions,
  blockedExport,
  hasEmptyQuestion,
  exporting,
  safeExport,
  openModal,
}: {
  ep: Episode;
  workspace: WorkspaceController;
  selectedQuestions: Question[];
  blockedExport: boolean;
  hasEmptyQuestion: boolean;
  exporting: boolean;
  safeExport: (kind: "pdf" | "text" | "copy") => Promise<void>;
  openModal: OpenModal;
}) {
  return (
    <>
      <div className="question-toolbar">
        <span>
          {selectedQuestions.length} of {ep.questions.length} questions selected
        </span>
        <div>
          <button
            className="button secondary"
            disabled={blockedExport || exporting}
            onClick={() => void safeExport("copy")}
          >
            <Copy size={16} /> Copy sheet
          </button>
          <button
            className="button secondary"
            disabled={blockedExport || exporting}
            onClick={() => void safeExport("text")}
          >
            <ArrowDownToLine size={16} /> Text
          </button>
        </div>
      </div>
      {blockedExport && (
        <div className="warning-banner">
          <AlertTriangle size={19} />
          <p>
            <strong>
              {hasEmptyQuestion
                ? "A selected question is empty."
                : "Review your selected questions."}
            </strong>{" "}
            {hasEmptyQuestion
              ? "Write your question or uncheck it to leave it off this sheet. Review any flagged questions before exporting."
              : "Check the current sources and wording for each flagged question before exporting."}
          </p>
        </div>
      )}
      <div className="questions-layout">
        <section className="question-editor">
          <div className="editor-heading">
            <h2>Make these yours</h2>
            <p>Drafts help you ask; they do not decide what care is needed.</p>
          </div>
          {ep.questions.length ? (
            ep.questions.map((q) => (
              <QuestionEditor key={q.id} q={q} ep={ep} workspace={workspace} />
            ))
          ) : (
            <Empty
              icon={<MessageSquareText size={28} />}
              title="Your questions will appear here"
              action={
                <button
                  className="button secondary"
                  onClick={() => openModal({ type: "manual" })}
                >
                  <Plus size={16} /> Add an item to ask about
                </button>
              }
            >
              Add an order item or your own note to begin preparing a question.
            </Empty>
          )}
        </section>
        <aside className="full-preview">
          <div className="preview-label">
            <Eye size={15} /> Sheet preview<span>Revision {ep.revision}</span>
          </div>
          <QuestionPreview episode={ep} />
        </aside>
      </div>
    </>
  );
}

export function QuestionPreview({
  episode,
  compact = false,
}: {
  episode: Episode;
  compact?: boolean;
}) {
  const selected = episode.questions.filter((q) => q.selected);
  return (
    <div className={`sheet ${compact ? "sheet-compact" : ""}`}>
      <div className="sheet-title">
        <Brand small />
        <span>For your next conversation</span>
      </div>
      <div className="sheet-person">
        <h3>{episode.person}</h3>
        <p>{episode.label}</p>
        <span>
          {episode.date ? dateText(episode.date) : "Episode date not supplied"}
        </span>
      </div>
      {episode.demo && (
        <div className="sheet-demo">
          Fictional demonstration · no real patient data
        </div>
      )}
      <h4>Questions for my clinic</h4>
      {selected.length ? (
        <ol className="sheet-questions">
          {selected.slice(0, compact ? 1 : undefined).map((q) => (
            <li key={q.id}>
              <p>{q.text || "Add wording before exporting this question."}</p>
              {q.reviewRequired && (
                <span className="text-warning">
                  Review sources and wording before export
                </span>
              )}
              {!compact &&
                q.evidence.map((ev, i) => (
                  <div className="sheet-citation" key={`${ev.documentId}-${i}`}>
                    {episode.documents.find((d) => d.id === ev.documentId)
                      ?.name || "Source unavailable"}
                    , p. {ev.page}
                    <br />“{ev.quote}”
                  </div>
                ))}
              {!compact && (q.basis === "note" || q.edited) && (
                <div className="sheet-citation">
                  Wording includes information entered or edited by you.
                </div>
              )}
              {!compact && !q.evidence.length && (
                <div className="sheet-citation">
                  Source: your note; no supporting order attached.
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="sheet-empty">
          No questions selected for this sheet. This does not establish that
          care is complete.
        </p>
      )}
      {compact && selected.length > 1 && (
        <p className="subtle">+ {selected.length - 1} more on your sheet</p>
      )}
      <div className="sheet-footer">
        Prepared from the documents and notes added to CareThread. This sheet
        may not include every test or report. A linked report does not confirm
        clinical review.<span>Workspace revision: {episode.revision}</span>
        {!compact && (
          <span>
            A preparation timestamp is added on export. This is a dated
            snapshot. Later changes in CareThread do not update this copy.
          </span>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({
  q,
  ep,
  workspace,
}: {
  q: Question;
  ep: Episode;
  workspace: WorkspaceController;
}) {
  const item = ep.items.find((i) => i.id === q.itemId);
  return (
    <div
      className={`question-edit-card ${q.selected ? "question-selected" : ""} ${q.reviewRequired ? "question-stale" : ""}`}
    >
      <label className="question-select">
        <input
          type="checkbox"
          checked={q.selected}
          onChange={(e) => workspace.selectQuestion(q.id, e.target.checked)}
        />
        <span>
          {item?.label ||
            (q.id === "question:order-list"
              ? "Confirm the original test list"
              : "Your retained question")}
        </span>
        {q.edited && <span className="edited-label">Your wording</span>}
      </label>
      <textarea
        aria-label={`Question about ${item?.label || (q.id === "question:order-list" ? "the original test list" : "your retained note")}`}
        value={q.text}
        onChange={(e) => workspace.editQuestion(q.id, e.target.value)}
        rows={4}
      />
      <div className="question-card-footer">
        <span>
          {q.evidence.length
            ? `${q.evidence.length} source ${q.evidence.length === 1 ? "reference" : "references"}`
            : "Based on your note"}
        </span>
        <button
          className="text-button"
          onClick={() => workspace.resetQuestion(q.id)}
        >
          <RefreshCw size={12} /> Reset draft
        </button>
      </div>
      {q.reviewRequired && (
        <div className="question-review">
          <p>
            <AlertTriangle size={15} /> Review needed. Check the current item,
            its sources and this wording.
          </p>
          <button
            className="button small secondary"
            disabled={!q.text.trim()}
            onClick={() => workspace.reviewQuestion(q.id)}
          >
            <Check size={14} /> I reviewed this question
          </button>
        </div>
      )}
    </div>
  );
}
