const fs = require('fs');
const path = require('path');

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate valid 1x1 or 16x16 PNG file bytes
// Standard minimal 8x8 RGBA PNG header + data
const minimalPngBuffer = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 16, 0, 0, 0, 16, 8, 6, 0, 0, 0, 31, 243, 255,
  97, 0, 0, 0, 39, 73, 68, 65, 84, 120, 156, 99, 252, 255, 255,
  63, 3, 24, 24, 24, 216, 132, 212, 194, 192, 192, 192, 208, 132,
  196, 192, 192, 224, 132, 204, 192, 192, 192, 0, 0, 107, 7,
  2, 133, 172, 178, 176, 210, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130
]);

fs.writeFileSync(path.join(assetsDir, 'icon.png'), minimalPngBuffer);
console.log('Successfully generated assets/icon.png!');
