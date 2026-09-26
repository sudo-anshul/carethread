import { useRef, useState, type MouseEvent } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Plus,
  Undo2,
  X,
} from "lucide-react";
import type { WorkspaceController } from "./controller";
import type { View } from "./core/types";
import { getItemStatus } from "./core/model";
import { exportQuestionsPdf, questionSheetText, downloadText } from "./export";
import {
  Brand,
  SaveStatus,
  initials,
  viewNames,
  type Modal,
} from "./workspace/shared";
import { WelcomeView, OverviewView } from "./workspace/overview";
import { DocumentsView } from "./workspace/documents";
import { TestsView } from "./workspace/tests";
import { QuestionsView } from "./workspace/questions";
import { WorkspaceDialog } from "./workspace/dialogs";
import "./styles.css";

export default function App({
  workspace,
  onOpenHome,
}: {
  workspace: WorkspaceController;
  onOpenHome: () => void;
}) {
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onOpenHome();
  };
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const modalOpener = useRef<HTMLElement | null>(null);
  const openModal = (next: Exclude<Modal, null>) => {
    modalOpener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setModal(next);
  };
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [replaceId, setReplaceId] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const ep = workspace.episode;
  const go = (next: View) => {
    setView(next);
    setSearch("");
    setUiMessage("");
    requestAnimationFrame(() => {
      contentRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  };
  const upload = (id?: string) => {
    setReplaceId(id);
    if (fileRef.current) {
      fileRef.current.multiple = !id;
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };
  const close = () => {
    setModal(null);
    requestAnimationFrame(() => {
      const target = modalOpener.current?.isConnected
        ? modalOpener.current
        : contentRef.current;
      target?.focus({ preventScroll: true });
    });
  };
  const review = (id: string) => {
    setSelectedId(id);
    go("tests");
  };
  const safeExport = async (kind: "pdf" | "text" | "copy") => {
    if (!ep) return;
    if (
      ep.questions.some(
        (q) => q.selected && (q.reviewRequired || !q.text.trim()),
      )
    ) {
      setUiMessage(
        "Add wording to selected empty questions and review flagged questions before exporting.",
      );
      return;
    }
    setExporting(true);
    try {
      if (kind === "pdf") await exportQuestionsPdf(ep);
      else if (kind === "text") downloadText(ep);
      else {
        await navigator.clipboard.writeText(questionSheetText(ep));
        setUiMessage("Question sheet copied.");
      }
    } catch {
      setUiMessage(
        kind === "copy"
          ? "Copy is unavailable in this browser. Download the text version instead."
          : "The export could not be created. Try downloading the text version.",
      );
    } finally {
      setExporting(false);
    }
  };
  const selectedItem =
    ep?.items.find((i) => i.id === selectedId) || ep?.items[0];
  const toReview =
    ep?.items.filter((i) => getItemStatus(ep, i.id).tone !== "linked") || [];
  const selectedQuestions = ep?.questions.filter((q) => q.selected) || [];
  const blockedExport = selectedQuestions.some(
    (q) => q.reviewRequired || !q.text.trim(),
  );
  const hasEmptyQuestion = selectedQuestions.some((q) => !q.text.trim());
  const nav = [
    { id: "overview" as const, icon: LayoutDashboard },
    { id: "tests" as const, icon: ListChecks, count: ep?.items.length },
    { id: "documents" as const, icon: FolderOpen, count: ep?.documents.length },
    {
      id: "questions" as const,
      icon: MessageSquareText,
      count: selectedQuestions.length,
    },
  ];

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <input
        ref={fileRef}
        type="file"
        className="visually-hidden"
        accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.heic,.tiff"
        multiple={!replaceId}
        aria-label={
          replaceId ? "Choose replacement document" : "Choose documents"
        }
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) void workspace.importFiles(files, replaceId);
        }}
      />
      <aside className="sidebar">
        <a
          href="/"
          aria-label="CareThread home"
          onClick={goHome}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <Brand />
        </a>
        <div className="sidebar-context">
          <span className="sidebar-kicker">Your workspace</span>
          {ep ? (
            <>
              <div className="person-line">
                <div className="avatar">{initials(ep.person)}</div>
                <div>
                  <strong>{ep.person}</strong>
                  <span>
                    {ep.demo ? "Synthetic demo episode" : "One care episode"}
                  </span>
                </div>
              </div>
              <div className="episode-side-label">{ep.label}</div>
            </>
          ) : (
            <p>
              One place for the pieces.
              <br />A clearer next step.
            </p>
          )}
        </div>
        <nav aria-label="Workspace">
          <div className="nav-caption">{ep ? "Episode" : "Get organized"}</div>
          {nav.map(({ id, icon: Icon, count }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              disabled={!ep && id !== "overview"}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{viewNames[id]}</span>
              {typeof count === "number" && count > 0 && (
                <span className="nav-count">{count}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            className="sidebar-help"
            href="/"
            onClick={goHome}
            style={{ marginTop: 0, marginBottom: 20 }}
          >
            <ArrowRight size={17} style={{ transform: "rotate(180deg)" }} />{" "}
            CareThread home
          </a>
          <div className="local-note">
            <LockKeyhole size={17} />
            <p>
              Your documents stay
              <br />
              in this browser.
            </p>
          </div>
          <button
            className="sidebar-help"
            onClick={() => openModal({ type: "help" })}
          >
            <CircleHelp size={18} /> About & privacy
          </button>
          {ep && (
            <button
              className="sidebar-clear"
              onClick={() => openModal({ type: "clear" })}
            >
              Clear this episode
            </button>
          )}
          <span className="prototype-label">
            CareThread · working prototype
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <a
              href="/"
              aria-label="CareThread home"
              onClick={goHome}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Brand small />
            </a>
          </div>
          <div className="breadcrumb">
            <span>My workspace</span>
            <ChevronRight size={14} />
            <strong>{viewNames[view]}</strong>
          </div>
          <SaveStatus workspace={workspace} />
          <button
            className="icon-button help-button"
            aria-label="About CareThread and privacy"
            onClick={() => openModal({ type: "help" })}
          >
            <CircleHelp size={19} />
          </button>
        </header>
        <nav className="mobile-nav" aria-label="Mobile workspace">
          {nav.map(({ id, icon: Icon }) => (
            <button
              key={id}
              disabled={!ep && id !== "overview"}
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={17} />
              {id === "questions"
                ? "Questions"
                : id === "tests"
                  ? "Tests"
                  : viewNames[id]}
            </button>
          ))}
        </nav>
        <main
          id="main-content"
          className={`main-content ${!ep ? "welcome-content" : ""}`}
          ref={contentRef}
          tabIndex={-1}
        >
          {(workspace.error || workspace.notice || uiMessage) && (
            <div
              className={`feedback ${workspace.error ? "feedback-error" : ""}`}
              role={workspace.error ? "alert" : "status"}
            >
              <span>{workspace.error || uiMessage || workspace.notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => {
                  workspace.dismissNotice();
                  setUiMessage("");
                }}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {workspace.progress.length > 0 && (
            <div className="import-progress" aria-live="polite">
              {workspace.progress.map((p, i) => (
                <div key={`${p.name}-${i}`}>
                  {p.state === "reading" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : p.state === "error" ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  <span>{p.name}</span>
                  <small>
                    {p.message ||
                      (p.state === "reading"
                        ? "Reading…"
                        : p.state === "done"
                          ? "Added to documents"
                          : "Could not read")}
                  </small>
                </div>
              ))}
            </div>
          )}
          {!ep ? (
            <WelcomeView workspace={workspace} openModal={openModal} />
          ) : (
            <>
              {ep.demo && (
                <div className="demo-strip">
                  <span>
                    <span className="demo-dot" /> Synthetic demo
                  </span>
                  <p>This episode uses fictional people and documents.</p>
                  <button onClick={() => openModal({ type: "clear" })}>
                    Start your own <ArrowRight size={13} />
                  </button>
                </div>
              )}
              <div className="page-heading">
                <div>
                  <div className="page-eyebrow">{ep.label}</div>
                  <h1>
                    {view === "overview"
                      ? "A clearer view of your tests."
                      : view === "tests"
                        ? "Follow the evidence."
                        : view === "documents"
                          ? "Your source documents."
                          : "Ready for the conversation."}
                  </h1>
                  <p>
                    {view === "overview"
                      ? "Connect what you have. Prepare what to ask next."
                      : view === "tests"
                        ? "Review each item and decide which report belongs with it."
                        : view === "documents"
                          ? "Keep the original information close, including what could not be read."
                          : "Choose your questions, make them your own, and take them with you."}
                  </p>
                </div>
                <div className="heading-actions">
                  {workspace.canUndo && (
                    <button
                      className="button subtle-button"
                      onClick={workspace.undo}
                    >
                      <Undo2 size={16} /> Undo
                    </button>
                  )}
                  {view === "questions" ? (
                    <button
                      className="button primary"
                      disabled={blockedExport || exporting}
                      onClick={() => void safeExport("pdf")}
                    >
                      {exporting ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <ArrowDownToLine size={17} />
                      )}{" "}
                      Download PDF
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      disabled={workspace.busy}
                      onClick={() => upload()}
                    >
                      <Plus size={17} /> Add documents
                    </button>
                  )}
                </div>
              </div>
              {view === "overview" && (
                <OverviewView
                  ep={ep}
                  toReview={toReview}
                  selectedQuestions={selectedQuestions}
                  go={go}
                  review={review}
                  openModal={openModal}
                />
              )}
              {view === "tests" && (
                <TestsView
                  ep={ep}
                  search={search}
                  setSearch={setSearch}
                  selectedItem={selectedItem}
                  setSelectedId={setSelectedId}
                  workspace={workspace}
                  openModal={openModal}
                  go={go}
                />
              )}
              {view === "documents" && (
                <DocumentsView ep={ep} openModal={openModal} upload={upload} />
              )}
              {view === "questions" && (
                <QuestionsView
                  ep={ep}
                  workspace={workspace}
                  selectedQuestions={selectedQuestions}
                  blockedExport={blockedExport}
                  hasEmptyQuestion={hasEmptyQuestion}
                  exporting={exporting}
                  safeExport={safeExport}
                  openModal={openModal}
                />
              )}
              <footer className="workspace-footer">
                <span>
                  <span className="footer-dot" /> Your files. Your review. Your
                  next conversation.
                </span>
                <button onClick={() => openModal({ type: "help" })}>
                  How CareThread works <CircleHelp size={13} />
                </button>
                <button
                  className="mobile-clear"
                  onClick={() => openModal({ type: "clear" })}
                >
                  Clear episode
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && (
        <WorkspaceDialog
          modal={modal}
          ep={ep}
          workspace={workspace}
          close={close}
          upload={upload}
          setView={setView}
        />
      )}
    </div>
  );
}
