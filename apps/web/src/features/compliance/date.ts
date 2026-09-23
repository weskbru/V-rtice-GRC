export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
