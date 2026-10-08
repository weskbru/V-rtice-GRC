// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS_OR_QUOTE_OR_BACKSLASH = /[\x00-\x1f\x7f"\\]/g;

function sanitizeAsciiFallback(fileName: string): string {
  const stripped = fileName
    .replace(CONTROL_CHARACTERS_OR_QUOTE_OR_BACKSLASH, '')
    .replace(/[^\x20-\x7e]/g, '_');
  return stripped.length > 0 ? stripped : 'attachment';
}

export function buildContentDispositionHeader(fileName: string): string {
  const asciiFallback = sanitizeAsciiFallback(fileName);
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
