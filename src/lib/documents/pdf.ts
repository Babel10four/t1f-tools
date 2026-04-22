/** PDF magic bytes — first non-whitespace should start with %PDF */
export function isLikelyPdf(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }
  let i = 0;
  while (i < buffer.length && (buffer[i] === 0x09 || buffer[i] === 0x0a || buffer[i] === 0x0d || buffer[i] === 0x20)) {
    i++;
  }
  return (
    buffer[i] === 0x25 &&
    buffer[i + 1] === 0x50 &&
    buffer[i + 2] === 0x44 &&
    buffer[i + 3] === 0x46
  );
}
