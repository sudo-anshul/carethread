import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  ListChecks,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Unlink,
} from "lucide-react";
import type { WorkspaceController } from "../controller";
import type { Episode, SourceDocument, TestItem, View } from "../core/types";
import {
  getCandidates,
  getItemLinks,
  getItemNotices,
  getItemStatus,
} from "../core/model";
import { Empty, ItemBadge, dateText, type OpenModal } from "./shared";

export function TestsView({
  ep,
  search,
  setSearch,
  selectedItem,
  setSelectedId,
  workspace,
  openModal,
  go,
}: {
  ep: Episode;
  search: string;
  setSearch: (search: string) => void;
  selectedItem?: TestItem;
  setSelectedId: (id: string) => void;
  workspace: WorkspaceController;
  openModal: OpenModal;
  go: (view: View) => void;
}) {
  const visibleItems = ep.items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase()),
  );
  const visibleSelection =
    visibleItems.find((item) => item.id === selectedItem?.id) || visibleItems[0];

  return (
    <>
      <div className="section-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search test items"
            placeholder="Find a test item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="button secondary"
          onClick={() => openModal({ type: "manual" })}
        >
          <Plus size={16} /> Add test item
        </button>
      </div>
      {ep.items.length ? (
        <div className="test-workspace">
          <section className="test-index" aria-label="Test items">
            <div className="index-heading">
              {ep.items.length} items in this episode
            </div>
            {visibleItems.map((item) => (
              <button
                key={item.id}
                className={`test-index-row ${visibleSelection?.id === item.id ? "selected" : ""}`}
                aria-current={
                  visibleSelection?.id === item.id ? "true" : undefined
                }
                onClick={() => setSelectedId(item.id)}
              >
                <strong>{item.label}</strong>
                <span>
                  {item.orderId || "No order reference"}
                  {item.date ? ` · ${dateText(item.date)}` : ""}
                </span>
                <ItemBadge episode={ep} item={item} />
              </button>
            ))}
            {!visibleItems.length && (
              <p className="index-empty">No items match “{search}”.</p>
            )}
          </section>
          {visibleSelection && (
            <TestDetail
              episode={ep}
              item={visibleSelection}
              workspace={workspace}
              onEdit={() => openModal({ type: "edit", item: visibleSelection })}
              onSource={(doc) => openModal({ type: "source", doc })}
              onQuestions={() => go("questions")}
            />
          )}
        </div>
      ) : (
        <section className="panel">
          <Empty
            icon={<ListChecks size={28} />}
            title="Add the first test item"
            action={
              <button
                className="button primary"
                onClick={() => openModal({ type: "manual" })}
              >
                <Plus size={16} /> Add test item
              </button>
            }
          >
            Use the exact name on your order, or enter a recollection as your
            own note. You can add documents at any time.
          </Empty>
        </section>
      )}
    </>
  );
}

function TestDetail({
  episode,
  item,
  workspace,
  onEdit,
  onSource,
  onQuestions,
}: {
  episode: Episode;
  item: TestItem;
  workspace: WorkspaceController;
  onEdit: () => void;
  onSource: (doc: SourceDocument) => void;
  onQuestions: () => void;
}) {
  const candidates = getCandidates(episode, item.id);
  const links = getItemLinks(episode, item.id);
  const notices = getItemNotices(episode, item.id);
  const source = episode.documents.find(
    (d) => d.id === item.evidence?.documentId,
  );
  const status = getItemStatus(episode, item.id);
  return (
    <section className="test-detail" aria-label={`Review ${item.label}`}>
      <div className="detail-heading">
        <div>
          <span className="detail-label">Evidence review</span>
          <h2>{item.label}</h2>
          <p>
            {item.orderId || "Order reference not supplied"}
            {item.date ? ` · ${dateText(item.date)}` : ""}
          </p>
        </div>
        <button className="button small secondary" onClick={onEdit}>
          <Pencil size={14} /> Edit
        </button>
      </div>
      <div className="detail-status">
        <ItemBadge episode={episode} item={item} />
        <p>{status.detail}</p>
      </div>
      <div className="evidence-block">
        <div className="evidence-section-heading">
          <h3>
            {item.basis === "source"
              ? "Where this item came from"
              : "Your note"}
          </h3>
          {source && source.status !== "quarantined" && (
            <button className="text-button" onClick={() => onSource(source)}>
              View source <ExternalLink size={13} />
            </button>
          )}
        </div>
        {item.evidence && source && source.status !== "quarantined" ? (
          <div className="source-excerpt">
            <div className="excerpt-meta">
              <FileText size={14} />
              <span>{source.name}</span>
              <span>Page {item.evidence.page}</span>
            </div>
            <blockquote>{item.evidence.quote}</blockquote>
            <div className="excerpt-bottom">
              {item.reviewed ? (
                <span className="checked-text">
                  <Check size={14} /> Transcription checked by you
                </span>
              ) : (
                <button
                  className="text-button"
                  onClick={() => workspace.reviewItem(item.id)}
                >
                  <Check size={14} /> I checked this transcription
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="source-excerpt note-excerpt">
            <NotebookPen size={17} />
            <p>
              {item.note ||
                "This item was entered by you. No original order evidence is attached."}
            </p>
          </div>
        )}
        {item.note && item.basis === "source" && (
          <p className="user-note">
            <strong>Your note:</strong> {item.note}
          </p>
        )}
      </div>
      {notices.length > 0 && (
        <div className="notice-stack">
          {notices.map((notice, i) => (
            <div className="source-notice" key={`${notice.type}-${i}`}>
              <AlertTriangle size={17} />
              <div>
                <strong>The source says “{notice.type}”</strong>
                <blockquote>{notice.evidence.quote}</blockquote>
                <span>
                  Page {notice.evidence.page}. This dated wording remains part
                  of the evidence.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="evidence-block report-evidence">
        <div className="evidence-section-heading">
          <h3>
            {links.length
              ? "Reports you linked"
              : "Possible report connections"}
          </h3>
          <span className="count-label">
            {links.length || candidates.length}
          </span>
        </div>
        {links.map((link) => {
          const doc = episode.documents.find((d) => d.id === link.documentId);
          return doc ? (
            <div className="candidate linked-candidate" key={link.id}>
              <div className="candidate-title">
                <FileText size={18} />
                <strong>{doc.reportLabel || doc.name}</strong>
                <span className="status-badge status-linked">
                  <Link2 size={12} /> Linked by you
                </span>
              </div>
              <p className="candidate-filename">{doc.name}</p>
              <div className="candidate-facts">
                <span>
                  {doc.collectionDate
                    ? `Collected ${dateText(doc.collectionDate)}`
                    : "Collection date not supplied"}
                </span>
                {doc.reportDate && (
                  <span>Reported {dateText(doc.reportDate)}</span>
                )}
              </div>
              {doc.notices.map((n, i) => (
                <div className="candidate-conflict" key={i}>
                  <AlertTriangle size={14} />
                  <span>{n.evidence.quote}</span>
                </div>
              ))}
              <div className="candidate-actions">
                <button className="text-button" onClick={() => onSource(doc)}>
                  View source <ExternalLink size={13} />
                </button>
                <button
                  className="text-button"
                  onClick={() => workspace.unlink(link.id)}
                >
                  <Unlink size={14} /> Remove connection
                </button>
              </div>
            </div>
          ) : null;
        })}
        {candidates.map((candidate) => {
          const doc = episode.documents.find(
            (d) => d.id === candidate.documentId,
          );
          if (!doc || doc.status === "quarantined") return null;
          const blocked = candidate.conflicts.length > 0;
          return (
            <div
              className={`candidate ${blocked ? "candidate-has-conflicts" : ""}`}
              key={candidate.documentId}
            >
              <div className="candidate-title">
                <FileText size={18} />
                <strong>{doc.reportLabel || doc.name}</strong>
                {blocked && (
                  <span className="candidate-warning">Check conflicts</span>
                )}
              </div>
              <p className="candidate-filename">{doc.name}</p>
              {candidate.evidence && (
                <blockquote className="candidate-quote">
                  {candidate.evidence.quote}
                  <span>Page {candidate.evidence.page}</span>
                </blockquote>
              )}
              <ul className="candidate-reasons">
                {candidate.reasons.map((reason, i) => (
                  <li key={i}>
                    <span />
                    {reason}
                  </li>
                ))}
              </ul>
              {candidate.conflicts.map((conflict, i) => (
                <div className="candidate-conflict" key={i}>
                  <AlertTriangle size={15} />
                  <span>{conflict}</span>
                </div>
              ))}
              {doc.notices.map((n, i) => (
                <div className="candidate-conflict" key={`notice-${i}`}>
                  <AlertTriangle size={15} />
                  <span>{n.evidence.quote}</span>
                </div>
              ))}
              <div className="candidate-actions">
                <button className="text-button" onClick={() => onSource(doc)}>
                  View source <ExternalLink size={13} />
                </button>
                <div>
                  <button
                    className="button small ghost"
                    onClick={() => workspace.reject(item.id, doc.id)}
                  >
                    Not this report
                  </button>
                  <button
                    className="button small secondary"
                    disabled={blocked}
                    onClick={() => workspace.link(item.id, doc.id)}
                  >
                    <Link2 size={14} /> Link report
                  </button>
                </div>
              </div>
              {blocked && (
                <p className="candidate-blocked-note">
                  This connection cannot be made while these conflicts remain.
                </p>
              )}
            </div>
          );
        })}
        {!links.length && !candidates.length && (
          <div className="no-candidate">
            <FolderOpen size={22} />
            <p>
              <strong>No report connection to inspect</strong>
              <span>
                A matching report may not have been supplied or read. You can
                leave this unresolved and prepare a question.
              </span>
            </p>
          </div>
        )}
        <div className="matching-note">
          <CircleHelp size={14} />
          <p>
            Suggestions use local names and reference rules. You decide which
            sources belong together.
          </p>
        </div>
        <div className="detail-footer">
          <button
            className="text-button"
            onClick={() => workspace.restoreSuggestions(item.id)}
          >
            Restore dismissed suggestions
          </button>
          <button className="button secondary small" onClick={onQuestions}>
            Leave for now <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
