import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertTriangle,
  Link2,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import type { WorkspaceController } from "../controller";
import type { Episode, SourceDocument, TestItem, View } from "../core/types";
import { getItemStatus } from "../core/model";

export type Modal =
  | { type: "create" | "paste" | "manual" | "clear" | "help" }
  | { type: "edit"; item: TestItem }
  | { type: "source" | "delete" | "replace"; doc: SourceDocument }
  | null;
export const viewNames: Record<View, string> = {
  overview: "Overview",
  tests: "Test items",
  documents: "Documents",
  questions: "Question sheet",
};
export const dateText = (value?: string) =>
  value
    ? /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : value
    : "Date not supplied";
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export const kindLabel = (doc: SourceDocument) =>
  ({
    order: "Test order",
    report: "Report",
    note: "Note",
    unknown: "Attachment",
  })[doc.kind];
export type OpenModal = (modal: Exclude<Modal, null>) => void;

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path
            d="M8 6h7a6 6 0 0 1 0 12h-1a4 4 0 0 0 0 8h10M24 6h-2M8 14H6m18 4h2M8 26H6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>
        CareThread<span className="brand-dot">.</span>
      </span>
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const heading = dialog?.querySelector<HTMLElement>(".dialog-heading");
    const updateScrollInset = () => {
      if (dialog && heading) dialog.style.setProperty("--dialog-heading-height", `${heading.getBoundingClientRect().height + 12}px`);
    };
    updateScrollInset();
    const observer = new ResizeObserver(updateScrollInset);
    if (heading) observer.observe(heading);
    const initial = dialog?.querySelector<HTMLElement>(
      'input:not([type="checkbox"]):not([type="file"]), textarea, select',
    );
    initial?.focus({ preventScroll: true });
    return () => {
      observer.disconnect();
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function ItemBadge({
  episode,
  item,
}: {
  episode: Episode;
  item: TestItem;
}) {
  const status = getItemStatus(episode, item.id);
  return (
    <span className={`status-badge status-${status.tone}`}>
      {status.tone === "linked" ? (
        <Link2 size={12} />
      ) : status.tone === "warning" ? (
        <AlertTriangle size={12} />
      ) : (
        <span className="status-dot" />
      )}
      {status.label}
    </span>
  );
}

export function SaveStatus({ workspace }: { workspace: WorkspaceController }) {
  const { saveState } = workspace;
  return (
    <div
      className={`save-status ${saveState === "error" ? "save-failed" : ""}`}
      role="status"
    >
      {saveState === "saved" ? (
        <>
          <ShieldCheck size={14} /> Saved on this device
        </>
      ) : saveState === "error" ? (
        <>
          <AlertTriangle size={14} /> Changes not saved{" "}
          <button onClick={workspace.retrySave}>Retry</button>
        </>
      ) : (
        <>
          <LoaderCircle size={14} className="spin" />{" "}
          {saveState === "loading"
            ? "Opening your workspace…"
            : "Saving on this device…"}
        </>
      )}
    </div>
  );
}
