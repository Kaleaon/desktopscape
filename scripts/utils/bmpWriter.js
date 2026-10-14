/**
 * Shared 24-bit BMP Buffer Writer Utility.
 * Packs BMP header and DIB BITMAPINFOHEADER with 4-byte row alignment padding and bottom-up pixel ordering.
 */

/**
 * Creates a 24-bit BMP image buffer.
 *
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {Function} pixelFn - Pixel RGB generator function: (x, y, width, height) => { r, g, b }
 * @returns {Buffer} Encoded BMP file buffer
 */
function createBMPBuffer(width, height, pixelFn) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  // BMP Header (14 bytes)
  buf.write('BM', 0);                     // Magic identifier ('BM')
  buf.writeUInt32LE(fileSize, 2);         // File size in bytes
  buf.writeUInt32LE(54, 10);              // Offset to pixel array (54 bytes)

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  buf.writeUInt32LE(40, 14);              // Header size (40 bytes)
  buf.writeInt32LE(width, 18);            // Image width
  buf.writeInt32LE(height, 22);           // Image height
  buf.writeUInt16LE(1, 26);               // Planes count (must be 1)
  buf.writeUInt16LE(24, 28);              // Bits per pixel (24-bit RGB)
  buf.writeUInt32LE(pixelArraySize, 34);  // Image data size

  // Write pixels (bottom-up in standard BMP format)
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const { r, g, b } = pixelFn(x, y, width, height);
      const pixelOffset = rowOffset + x * 3;
      buf[pixelOffset] = Math.max(0, Math.min(255, Math.floor(b)));     // Blue component
      buf[pixelOffset + 1] = Math.max(0, Math.min(255, Math.floor(g))); // Green component
      buf[pixelOffset + 2] = Math.max(0, Math.min(255, Math.floor(r))); // Red component
    }
  }

  return buf;
}

module.exports = { createBMPBuffer };
