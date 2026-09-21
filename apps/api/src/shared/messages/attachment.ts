/** Files/Attachments (US9, T188-T190). Every upload refusal reason
 * (FR-097) is here — none is embedded inline in `UploadService` or the
 * controller. */
export const attachment = {
  fileRequired: 'É necessário selecionar um arquivo para enviar.',
  /** The declared `Content-Type` is not on the configured allow-list. */
  typeNotAllowed: 'O tipo de arquivo informado não é permitido.',
  /** The declared `Content-Type` does not match the sniffed magic bytes
   * of the uploaded content. */
  typeMismatch: 'O conteúdo do arquivo não corresponde ao tipo declarado.',
  /** `PayloadTooLargeException` (multer's own `limits.fileSize`,
   * surfaced before `UploadService` is ever reached — see
   * `ProblemDetailsFilter`). */
  fileTooLarge: 'O arquivo enviado excede o tamanho máximo permitido.',
} as const;
