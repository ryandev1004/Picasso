// Turns the icon designs in resources/*.svg into the files Picasso loads:
//   tray.svg -> tray.ico            (the system tray)
//   icon.svg -> icon.ico, icon.png  (the window/taskbar now, and the installer later)
// Electron draws the SVGs at each size, so small sizes are rendered sharp, not shrunk.
//
//   npm run icons
const { app, BrowserWindow } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { crc32, deflateSync } = require("node:zlib");

const RESOURCES = join(__dirname, "..", "resources");

// 16-32 cover the tray at 100-200% display scaling; Windows picks the closest size.
const ICONS = [
  {
    svg: "tray.svg",
    ico: "tray.ico",
    sizes: [16, 20, 24, 32, 40, 48, 64, 256],
  },
  {
    svg: "icon.svg",
    ico: "icon.ico",
    sizes: [16, 24, 32, 48, 64, 128, 256],
    png: { file: "icon.png", size: 512 },
  },
];

/** Runs in the hidden window: draws the SVG at `size` px and returns its RGBA pixels. */
async function rasterize(svg, size, asPng) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, size, size);
  if (asPng) return canvas.toDataURL("image/png");
  return Array.from(ctx.getImageData(0, 0, size, size).data);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL("data:text/html,<title>icons</title>");
  const draw = (svg, size, asPng = false) =>
    win.webContents.executeJavaScript(
      `(${rasterize})(${JSON.stringify(svg)}, ${size}, ${asPng})`,
    );

  for (const icon of ICONS) {
    const svg = readFileSync(join(RESOURCES, icon.svg), "utf8");
    const images = [];
    for (const size of icon.sizes) {
      images.push({ size, rgba: Uint8Array.from(await draw(svg, size)) });
    }
    writeFileSync(join(RESOURCES, icon.ico), ico(images));
    console.log(`wrote resources/${icon.ico} (${icon.sizes.join(", ")} px)`);

    if (icon.png) {
      const dataUrl = await draw(svg, icon.png.size, true);
      writeFileSync(
        join(RESOURCES, icon.png.file),
        Buffer.from(dataUrl.split(",")[1], "base64"),
      );
      console.log(`wrote resources/${icon.png.file} (${icon.png.size} px)`);
    }
  }
  app.quit();
});

/** A multi-size .ico: the 256px image PNG-compressed (standard), smaller ones as 32-bit BMPs. */
function ico(images) {
  const entries = images.map(({ size, rgba }) =>
    size === 256 ? png(size, rgba) : bmp(size, rgba),
  );
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({ size }, i) => {
    const at = 6 + 16 * i;
    directory.writeUInt8(size === 256 ? 0 : size, at); // 0 means 256
    directory.writeUInt8(size === 256 ? 0 : size, at + 1);
    directory.writeUInt16LE(1, at + 4); // color planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(entries[i].length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entries[i].length;
  });
  return Buffer.concat([directory, ...entries]);
}

/** One ICO bitmap: a BITMAPINFOHEADER, bottom-up BGRA pixels, then a 1-bit transparency mask. */
function bmp(size, rgba) {
  const maskRow = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // ICO convention: the height covers pixels + mask
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  const pixels = Buffer.alloc(size * size * 4);
  const mask = Buffer.alloc(maskRow * size);
  for (let y = 0; y < size; y++) {
    const from = size - 1 - y; // BMP rows run bottom to top
    for (let x = 0; x < size; x++) {
      const s = (from * size + x) * 4;
      const d = (y * size + x) * 4;
      pixels[d] = rgba[s + 2];
      pixels[d + 1] = rgba[s + 1];
      pixels[d + 2] = rgba[s];
      pixels[d + 3] = rgba[s + 3];
      if (rgba[s + 3] === 0) mask[y * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return Buffer.concat([header, pixels, mask]);
}

/** A minimal PNG encoder for the 256px ICO entry. */
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size); // each row starts with filter byte 0
  for (let y = 0; y < size; y++) {
    Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(
      raw,
      y * (size * 4 + 1) + 1,
    );
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
