export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function formatDateOnly(value: string): string {
  return parseDateOnly(value).toLocaleDateString('pt-BR');
}

export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
