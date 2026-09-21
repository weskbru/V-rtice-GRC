/**
 * Unit tests for T189's magic-byte sniffing (no I/O). Proves the mismatch
 * case explicitly (FR-097): a declared type disagreeing with the actual
 * bytes is detectable — `UploadService`'s own test coverage (T185) proves
 * the end-to-end refusal, this file proves the sniffing primitive alone.
 */
import { describe, expect, it } from 'vitest';

import { sniffContentType } from '../../src/core/files/domain/magic-bytes';

const PDF_BYTES = Buffer.from('%PDF-1.7\n%rest of a pdf', 'ascii');
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const TEXT_BYTES = Buffer.from('Este é um comentário em texto simples.', 'utf-8');
const EXE_BYTES = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // "MZ" PE header

describe('magic-byte sniffing (T189, FR-097)', () => {
  it('recognizes a real PDF by its %PDF- signature', () => {
    expect(sniffContentType(PDF_BYTES)).toBe('application/pdf');
  });

  it('recognizes a real PNG by its 8-byte signature', () => {
    expect(sniffContentType(PNG_BYTES)).toBe('image/png');
  });

  it('recognizes a real JPEG by its SOI marker', () => {
    expect(sniffContentType(JPEG_BYTES)).toBe('image/jpeg');
  });

  it('recognizes plain UTF-8 text with no NUL byte as text/plain', () => {
    expect(sniffContentType(TEXT_BYTES)).toBe('text/plain');
  });

  it('does not recognize an executable (PE/MZ header) as any allow-listed type — never defaults to text/plain', () => {
    expect(sniffContentType(EXE_BYTES)).toBeUndefined();
  });

  it('does not recognize binary content containing a NUL byte as text/plain', () => {
    const binaryWithNul = Buffer.from([0x41, 0x42, 0x00, 0x43, 0x44]);
    expect(sniffContentType(binaryWithNul)).toBeUndefined();
  });

  it('does not recognize invalid UTF-8 byte sequences as text/plain', () => {
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd, 0xfc]);
    expect(sniffContentType(invalidUtf8)).toBeUndefined();
  });

  it('returns undefined for an empty buffer', () => {
    expect(sniffContentType(Buffer.alloc(0))).toBeUndefined();
  });

  it('a PDF renamed with a PNG-like declared type still sniffs as its REAL type, not the declared one — this is what lets UploadService detect the mismatch', () => {
    const sniffed = sniffContentType(PDF_BYTES);
    expect(sniffed).toBe('application/pdf');
    expect(sniffed).not.toBe('image/png');
  });
});
