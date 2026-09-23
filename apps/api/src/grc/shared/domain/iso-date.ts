export function parseIsoDate(value: string): Date {
  const datePart = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(`${datePart}T00:00:00.000Z`);
}

export function todayDateOnlyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
