import type { ErrorStateProblem } from '../error-state';

export interface CommentThreadItem {
  id: string;
  authorName: string;
  body: string;
  createdAtLabel: string;
  canWithdraw?: boolean;
}

export interface CommentThreadLabels {
  caption: string;
  loading: string;
  loadError: string;
  empty: string;
  composerLabel: string;
  composerPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  withdrawLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface CommentThreadProps {
  items: readonly CommentThreadItem[];
  labels: CommentThreadLabels;
  isLoading?: boolean;
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  commentValue: string;
  onCommentValueChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  canComment?: boolean;
  onWithdraw?: (id: string) => void;
  className?: string;
}

export interface AttachmentListItem {
  id: string;
  fileName: string;
  contentType: string;
  sizeLabel: string;
  uploadedByName: string;
  uploadedAtLabel: string;
  contentUrl: string;
  canWithdraw?: boolean;
}

export interface AttachmentListLabels {
  caption: string;
  loading: string;
  loadError: string;
  empty: string;
  chooseFileLabel: string;
  uploadLabel: string;
  uploadingLabel: string;
  allowedTypesHint: string;
  uploadError?: string | null;
  downloadLabel: string;
  withdrawLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface AttachmentListProps {
  items: readonly AttachmentListItem[];
  labels: AttachmentListLabels;
  isLoading?: boolean;
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  canUpload?: boolean;
  onUpload?: (file: File) => void;
  isUploading?: boolean;
  acceptAttribute?: string;
  onWithdraw?: (id: string) => void;
  className?: string;
}
