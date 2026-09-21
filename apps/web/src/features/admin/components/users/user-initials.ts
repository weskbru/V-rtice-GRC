/**
 * PharosGRC — Administration, a user's avatar initials, shared by
 * `user-admin-columns.tsx` (table) and `user-admin-card.tsx` (card) — ONE
 * function, not two independent copies (the coordinator's own instruction
 * for every other shared piece of this screen).
 *
 * ## A real defect, found by a rendered measurement, not by reasoning
 *
 * `components/shell/user-menu.tsx` already has an `initialsOf` helper —
 * checked first, per CLAUDE.md §19.4 ("reutilizar antes de criar") — but it
 * takes the first RAW character of the first two whitespace-separated
 * words: `fullName.split(' ').slice(0, 2).map((part) => part[0])`. That is
 * correct for "Platform Administrator" → "PA", but this screen's own seeded
 * fixture data includes names like "[AUDIT-A3] Usuário escopo Controles…",
 * whose first "word" is a bracket, not a letter — the coordinator's own
 * measurement caught eight consecutive avatars reading `[U`, `[R`, `[S`.
 *
 * `user-menu.tsx` sits outside this screen's edit territory (only one
 * caller, the signed-in user's own name, which is never bracketed in
 * practice) — this is reported as a shared defect rather than fixed
 * silently there. This function is therefore a DELIBERATE divergence, not a
 * second copy of the same correct logic: for each of the first two
 * whitespace-separated words, it takes that word's first Unicode LETTER
 * (`\p{L}`, so accented names work — "Íris" → "Í") wherever it falls in the
 * word, skipping a word that contains no letter at all rather than
 * defaulting to whatever character sits at position 0.
 */
export function userInitials(fullName: string): string {
  const words = fullName.split(/\s+/).filter(Boolean);
  const letters = words
    .map((word) => /\p{L}/u.exec(word)?.[0] ?? '')
    .filter((letter) => letter !== '')
    .slice(0, 2)
    .map((letter) => letter.toUpperCase());
  return letters.length > 0 ? letters.join('') : '?';
}
