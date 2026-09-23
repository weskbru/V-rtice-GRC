export interface UserOption {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
}

export interface UserSearchResult {
  readonly data: readonly UserOption[];
  readonly isPartial: boolean;
}
