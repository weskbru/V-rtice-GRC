/**
 * PharosGRC Design System — `CommentThread`/`AttachmentList` shared types
 * (T194, US9, FR-095 to FR-100).
 *
 * Generic and reusable, exactly like `packages/design-system/src/components/
 * timeline`: nothing here names "Risk" or any other business concept.
 * `platform.openapi.yaml`'s `/comments` and `/attachments` are keyed by
 * `(entityType, entityId)` against a registry of participating entity types
 * (ADR-008) — `RISK` is only the first caller
 * (`risk-comments-section.tsx`/`risk-attachments-section.tsx`); a future
 * Problems/Incidents module's own comments and attachments reuse these
 * components unchanged (CLAUDE.md §2, §13.8).
 *
 * Per D-10, every user-facing string is a required prop — never a default,
 * never hardcoded — exactly like `ActivityHistoryLabels`/`AuditTimelineLabels`/
 * `DataTableLabels`. `apps/web/src/lib/messages/risks.ts` is the pt-BR source
 * for both `CommentThreadLabels` and `AttachmentListLabels` today.
 */
import type { ErrorStateProblem } from '../error-state';

// ---------------------------------------------------------------------
// CommentThread — attributed notes on a GRC record (FR-095).
// ---------------------------------------------------------------------

/**
 * One comment, already resolved for display. `body` is PLAIN TEXT — a
 * comment is user-supplied content from another user and this component
 * never interprets it as markup (never `dangerouslySetInnerHTML`, never an
 * HTML-parsing markdown renderer). This is the stored-XSS defense on the
 * READ side, matching the contract's own guarantee that the body "is stored
 * raw and rendered as plain text" (FR-095).
 */
export interface CommentThreadItem {
  /** Stable identity — used as the React key and passed back to `onWithdraw`. */
  id: string;
  authorName: string;
  /** Plain text. Rendered as a text node only — see this interface's own doc comment. */
  body: string;
  /** Already formatted for display (e.g. "05/09/2026 14:32") — this package never parses a date or assumes a locale. */
  createdAtLabel: string;
  /**
   * Whether THIS specific comment may be withdrawn by the current caller
   * (the caller already resolved `comment:delete` plus authorship/scope
   * rules server-side; this component only decides whether to render the
   * control). Omit/`false` hides the withdraw action for this item.
   */
  canWithdraw?: boolean;
}

export interface CommentThreadLabels {
  /** Visually hidden accessible name for the comment list, e.g. "Comentários do risco". */
  caption: string;
  loading: string;
  loadError: string;
  /** Shown when `items` is empty and there is no error/loading. */
  empty: string;
  /** Visible label for the composer textarea, e.g. "Novo comentário". */
  composerLabel: string;
  composerPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  /** Per-item withdraw control text, e.g. "Remover". */
  withdrawLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface CommentThreadProps {
  /** The current page's comments, newest first — already sorted by the caller/server. */
  items: readonly CommentThreadItem[];
  labels: CommentThreadLabels;
  isLoading?: boolean;
  /** Renders `ErrorState` instead of the list. */
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Composer value — fully controlled by the caller. This package holds no draft state and applies no business rule (e.g. the server's 10000-character maximum) beyond disabling submission when the trimmed value is empty. */
  commentValue: string;
  onCommentValueChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  /** Whether the caller may add a comment at all (`comment:create`) — hides the composer entirely when `false`, exactly like a hidden `EntityTabs` tab hides an unauthorized section (FR-030's spirit: no control is shown only to be disabled). */
  canComment?: boolean;
  /**
   * Called with an item's `id` when its withdraw control is activated. This
   * package never confirms or performs the withdrawal itself — the caller
   * owns the confirm-before-destructive-action step (`ConfirmDialog`) and
   * the actual API call, exactly like `RiskControlsSection`'s own unlink
   * pattern.
   */
  onWithdraw?: (id: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------
// AttachmentList — evidence files governed by their parent record
// (FR-096 to FR-100).
// ---------------------------------------------------------------------

/** One attachment's metadata, already resolved for display. */
export interface AttachmentListItem {
  /** Stable identity — used as the React key and passed back to `onWithdraw`. */
  id: string;
  fileName: string;
  /** The stored, allow-listed content type, shown verbatim (a technical identifier, CLAUDE.md §11.1) — never translated. */
  contentType: string;
  /** Already formatted for display (e.g. "1,2 MB") — this package never computes a byte-size string. */
  sizeLabel: string;
  uploadedByName: string;
  uploadedAtLabel: string;
  /** The authorizing download path (`Attachment.contentUrl`, e.g. `/api/v1/attachments/{id}/content`) — every retrieval is re-authorized server-side; this is not a shareable link (ADR-010). Rendered as a plain navigation, never fetched/blobbed by this component. */
  contentUrl: string;
  /** Same withdraw-visibility contract as `CommentThreadItem.canWithdraw`. */
  canWithdraw?: boolean;
}

export interface AttachmentListLabels {
  /** Visually hidden accessible name for the attachment list, e.g. "Anexos do risco". */
  caption: string;
  loading: string;
  loadError: string;
  empty: string;
  /** Visible label for the native file input, e.g. "Selecionar arquivo". */
  chooseFileLabel: string;
  uploadLabel: string;
  uploadingLabel: string;
  /**
   * Shown near the upload control BEFORE any file is chosen — states the
   * allow-listed types and the size limit so a user learns the constraint
   * before attempting an upload, not only after a refusal (US9 AS3). The
   * exact wording (which types, which limit) is the caller's business
   * knowledge, not this package's — this package only renders the string
   * it is given.
   */
  allowedTypesHint: string;
  /**
   * The server's own refusal reason for the LAST failed upload attempt,
   * already pt-BR (the backend's `422`/`413` `detail` — see
   * `AttachmentController`'s doc comment) — rendered verbatim, never
   * replaced by a generic failure message. `null`/omitted when the last
   * attempt did not fail.
   */
  uploadError?: string | null;
  downloadLabel: string;
  /** Per-item withdraw control text, e.g. "Remover". */
  withdrawLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface AttachmentListProps {
  /** The current page's attachments, newest first. */
  items: readonly AttachmentListItem[];
  labels: AttachmentListLabels;
  isLoading?: boolean;
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Whether the caller may upload at all (`attachment:create`). */
  canUpload?: boolean;
  /** Called with the chosen `File` when the upload control is activated. This package never validates file type/size beyond what the browser's native `accept` attribute hints — the server is the actual authority (magic-byte sniffing, FR-097) and its refusal reaches this component only through `labels.uploadError`. */
  onUpload?: (file: File) => void;
  isUploading?: boolean;
  /** The native file input's `accept` attribute (e.g. `"application/pdf,image/png,image/jpeg,text/plain"`) — caller-supplied so the allow-list itself is not hardcoded in this package either; it is business/backend configuration, not this package's concern. */
  acceptAttribute?: string;
  /** Same withdraw-trigger contract as `CommentThreadProps.onWithdraw`. */
  onWithdraw?: (id: string) => void;
  className?: string;
}
