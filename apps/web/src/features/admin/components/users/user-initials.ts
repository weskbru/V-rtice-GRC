export function userInitials(fullName: string): string {
  const words = fullName.split(/\s+/).filter(Boolean);
  const letters = words
    .map((word) => /\p{L}/u.exec(word)?.[0] ?? '')
    .filter((letter) => letter !== '')
    .slice(0, 2)
    .map((letter) => letter.toUpperCase());
  return letters.length > 0 ? letters.join('') : '?';
}
