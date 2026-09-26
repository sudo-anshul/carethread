import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Eye,
  FilePlus2,
  FileText,
  FolderOpen,
  Link2,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { WorkspaceController } from "../controller";
import type { Episode, Question, TestItem, View } from "../core/types";
import { Empty, ItemBadge, dateText, type OpenModal } from "./shared";
import { DocumentRow } from "./documents";
import { QuestionPreview } from "./questions";

export function WelcomeView({
  workspace,
  openModal,
}: {
  workspace: WorkspaceController;
  openModal: OpenModal;
}) {
  return (
    <section className="welcome">
      {workspace.saveState === "error" && (
        <div className="welcome-recovery warning-banner">
          <AlertTriangle size={19} />
          <div>
            <p>
              <strong>Saved workspace unavailable</strong>
              <br />
              Reload to try opening it again, or clear its local copy to start
              over.
            </p>
            <div className="recovery-actions">
              <button
                className="button secondary small"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                className="button secondary small"
                onClick={() => openModal({ type: "clear" })}
              >
                Clear saved workspace
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="welcome-copy">
        <span className="intro-rule">
          <span /> Your tests, brought together
        </span>
        <h1>
          A clearer conversation
          <br />
          starts here.
        </h1>
        <p>
          Bring your test orders and reports together. See what connects, keep
          uncertainty visible, and prepare what to ask your clinic.
        </p>
        <button
          className="button primary large"
          disabled={workspace.saveState === "loading" || workspace.busy}
          onClick={() => openModal({ type: "create" })}
        >
          Create an episode <ArrowRight size={18} />
        </button>
        <button
          className="button demo-button"
          disabled={workspace.saveState === "loading" || workspace.busy}
          onClick={() => void workspace.loadDemo()}
        >
          {workspace.busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Eye size={17} />
          )}{" "}
          Explore the synthetic demo
        </button>
        <div className="welcome-privacy">
          <ShieldCheck size={16} />
          <span>
            Saved in this browser. No account needed.
            <br />
            Use fictional documents to explore this prototype.
          </span>
        </div>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="art-thread">
          <svg viewBox="0 0 300 340">
            <path d="M80 20v60c0 70 145 40 145 120s-145 20-145 105v20" />
          </svg>
        </div>
        <div className="art-document art-order">
          <div className="art-doc-heading">
            <FileText size={19} />
            <span>Test order</span>
          </div>
          <div className="art-line long" />
          <div className="art-line medium" />
          <div className="art-test">
            <span />
            <div className="art-line" />
          </div>
          <div className="art-test">
            <span />
            <div className="art-line" />
          </div>
        </div>
        <div className="art-connection">
          <Link2 size={19} />
        </div>
        <div className="art-document art-report">
          <div className="art-doc-heading">
            <FileText size={19} />
            <span>Report evidence</span>
          </div>
          <div className="art-highlight">
            <div className="art-line long" />
            <div className="art-line medium" />
          </div>
          <div className="art-line medium" />
        </div>
        <div className="art-question">
          <MessageSquareText size={24} />
          <span>
            What should I ask
            <br />
            <strong>at my next visit?</strong>
          </span>
        </div>
        <span className="art-caption">
          From scattered files to useful questions.
        </span>
      </div>
      <div className="welcome-steps">
        <div>
          <span className="step-icon">
            <FilePlus2 size={20} />
          </span>
          <strong>Bring the documents</strong>
          <p>Orders, reports, or your own notes.</p>
        </div>
        <div>
          <span className="step-icon">
            <Link2 size={20} />
          </span>
          <strong>See the connections</strong>
          <p>Check each suggestion against its source.</p>
        </div>
        <div>
          <span className="step-icon">
            <MessageSquareText size={20} />
          </span>
          <strong>Prepare your questions</strong>
          <p>Take an editable question sheet with you.</p>
        </div>
      </div>
    </section>
  );
}

export function OverviewView({
  ep,
  toReview,
  selectedQuestions,
  go,
  review,
  openModal,
}: {
  ep: Episode;
  toReview: TestItem[];
  selectedQuestions: Question[];
  go: (view: View) => void;
  review: (id: string) => void;
  openModal: OpenModal;
}) {
  return (
    <>
      <div className="episode-meta">
        <span>
          <UserRound size={14} />
          {ep.person}
        </span>
        <span>{dateText(ep.date)}</span>
        {ep.reference && <span>Episode {ep.reference}</span>}
      </div>
      <div className="overview-layout">
        <section className="panel overview-main">
          <div className="panel-heading">
            <h2>
              Your test items{" "}
              <span className="count-label">{ep.items.length}</span>
            </h2>
            <button className="text-button" onClick={() => go("tests")}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="next-action">
            <span className="next-action-icon">
              {ep.items.length ? (
                <ListChecks size={21} />
              ) : (
                <FilePlus2 size={21} />
              )}
            </span>
            <div>
              <strong>
                {ep.items.length
                  ? toReview.length
                    ? `${toReview.length} ${toReview.length === 1 ? "item has" : "items have"} evidence to review`
                    : "Your report connections are recorded"
                  : "Start with an order or a note"}
              </strong>
              <p>
                {ep.items.length
                  ? "A connection records your review of these documents, not completed care."
                  : "No order handy? Add what you remember and keep it labeled as a note."}
              </p>
            </div>
            {ep.items.length > 0 && (
              <button
                className="icon-button"
                aria-label="Review test items"
                onClick={() => review(toReview[0]?.id || ep.items[0].id)}
              >
                <ArrowRight size={20} />
              </button>
            )}
          </div>
          {ep.items.length ? (
            <div className="overview-test-list">
              {ep.items.slice(0, 5).map((item) => (
                <button
                  className="overview-test-row"
                  key={item.id}
                  onClick={() => review(item.id)}
                >
                  <span className="test-line-icon">
                    <ListChecks size={18} />
                  </span>
                  <span className="test-name">
                    <strong>{item.label}</strong>
                    <span>
                      {item.basis === "source"
                        ? "Listed on a source"
                        : "Added by you"}
                      {item.orderId ? ` · ${item.orderId}` : ""}
                    </span>
                  </span>
                  <ItemBadge episode={ep} item={item} />
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={<ListChecks size={25} />}
              title="The test list is yours to build"
              action={
                <button
                  className="button secondary"
                  onClick={() => openModal({ type: "manual" })}
                >
                  <Plus size={16} /> Add a test item
                </button>
              }
            >
              Upload an order or enter an item yourself. Reports alone will not
              create expected tests.
            </Empty>
          )}
          <div className="panel-bottom">
            <span>
              <Link2 size={15} /> Every connection stays linked to its source.
            </span>
            <button
              className="text-button"
              onClick={() => openModal({ type: "manual" })}
            >
              <Plus size={14} /> Add manually
            </button>
          </div>
        </section>
        <aside className="question-preview-panel">
          <div className="preview-heading">
            <MessageSquareText size={19} />
            <h2>Your question sheet</h2>
            <span>{selectedQuestions.length}</span>
          </div>
          <QuestionPreview episode={ep} compact />
          <button
            className="button accent full-width"
            onClick={() => go("questions")}
          >
            Prepare my questions <ArrowRight size={17} />
          </button>
        </aside>
      </div>
      <section className="panel recent-documents">
        <div className="panel-heading">
          <h2>
            Documents in this episode{" "}
            <span className="count-label">{ep.documents.length}</span>
          </h2>
          <button className="text-button" onClick={() => go("documents")}>
            Manage documents <ArrowRight size={15} />
          </button>
        </div>
        {ep.documents.length ? (
          <div className="recent-doc-list">
            {ep.documents
              .slice(-3)
              .reverse()
              .map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  compact
                  onOpen={() => openModal({ type: "source", doc })}
                  onDelete={() => openModal({ type: "delete", doc })}
                  onReplace={() => openModal({ type: "replace", doc })}
                />
              ))}
          </div>
        ) : (
          <div className="inline-empty">
            <FolderOpen size={23} />
            <span>No documents added yet.</span>
            <button
              className="text-button"
              onClick={() => openModal({ type: "paste" })}
            >
              Paste document text
            </button>
          </div>
        )}
      </section>
    </>
  );
}
