export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
