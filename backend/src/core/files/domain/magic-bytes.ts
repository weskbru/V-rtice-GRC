const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export const SNIFFABLE_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

export type SniffableContentType = (typeof SNIFFABLE_CONTENT_TYPES)[number];

function startsWith(content: Buffer, signature: Buffer): boolean {
  return (
    content.length >= signature.length && content.subarray(0, signature.length).equals(signature)
  );
}

function looksLikePlainText(content: Buffer): boolean {
  if (content.includes(0x00)) {
    return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
    return true;
  } catch {
    return false;
  }
}

export function sniffContentType(content: Buffer): SniffableContentType | undefined {
  if (content.length === 0) {
    return undefined;
  }
  if (startsWith(content, PDF_SIGNATURE)) {
    return 'application/pdf';
  }
  if (startsWith(content, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(content, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (looksLikePlainText(content)) {
    return 'text/plain';
  }
  return undefined;
}
