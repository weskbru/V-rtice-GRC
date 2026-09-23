export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
