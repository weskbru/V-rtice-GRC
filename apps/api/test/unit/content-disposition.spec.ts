/**
 * Unit tests for T190's `Content-Disposition` header builder (FR-099,
 * ADR-010) — no I/O.
 */
import { describe, expect, it } from 'vitest';

import { buildContentDispositionHeader } from '../../src/core/files/presentation/content-disposition';

describe('buildContentDispositionHeader (T190, FR-099)', () => {
  it('is always attachment, never inline', () => {
    expect(buildContentDispositionHeader('report.pdf')).toMatch(/^attachment;/);
  });

  it('includes the plain file name for an ordinary ASCII name', () => {
    const header = buildContentDispositionHeader('assessment-worksheet.xlsx');
    expect(header).toContain('filename="assessment-worksheet.xlsx"');
    expect(header).toContain("filename*=UTF-8''assessment-worksheet.xlsx");
  });

  it('strips quotes and backslashes from the ASCII fallback so they cannot terminate the parameter early', () => {
    const header = buildContentDispositionHeader('evil".pdf');
    // The ASCII fallback segment must not contain a bare, unescaped quote
    // that could close the filename="..." parameter early.
    const fallbackMatch = /filename="([^]*?)";/.exec(header);
    expect(fallbackMatch).not.toBeNull();
    expect(fallbackMatch?.[1]).not.toContain('"');
  });

  it('strips CR/LF and other control characters so they cannot inject a second header', () => {
    const malicious = 'evil.pdf\r\nX-Injected: true';
    const header = buildContentDispositionHeader(malicious);
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });

  it('a path-traversal-shaped name is carried through as inert display text, never interpreted as a path', () => {
    const header = buildContentDispositionHeader('../../etc/passwd');
    // Rendered as literal text inside the header value — no path
    // separator is special-cased or stripped, because this function never
    // touches the filesystem.
    expect(header).toContain('filename="../../etc/passwd"');
  });

  it('percent-encodes a Unicode file name in the RFC 5987 extended parameter', () => {
    const header = buildContentDispositionHeader('relatório de risco.pdf');
    expect(header).toContain("filename*=UTF-8''relat%C3%B3rio%20de%20risco.pdf");
  });

  it('falls back to a generic name when the sanitized ASCII fallback would otherwise be empty', () => {
    // Every character here is a control character `sanitizeAsciiFallback`
    // strips outright (not substituted, unlike a non-ASCII character,
    // which becomes `_`) — the empty-string case its own fallback exists
    // for.
    const controlCharsOnly = '\x01\x02\x03';
    const header = buildContentDispositionHeader(controlCharsOnly);
    expect(header).toContain('filename="attachment"');
  });
});
