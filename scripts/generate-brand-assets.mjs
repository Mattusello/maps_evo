/**
 * Genera gli asset di brand (icona app, splash, favicon, icona adattiva Android) dal
 * **motivo della linea-percorso**, lo stesso `RouteStrip` che firma la lista itinerari:
 * un percorso che parte da una fermata piena, gira, e arriva a una fermata "aperta".
 *
 * Perché uno script e non file disegnati a mano: i colori vengono dai token di
 * `src/ui/theme/palette.ts`, quindi il marchio non può divergere dall'interfaccia, e
 * rigenerare tutte le taglie è un comando solo.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Nessuna dipendenza: il PNG è scritto a mano (zlib è nella libreria standard di Node) e
 * le forme sono rasterizzate per distanza, con antialiasing su un pixel.
 *
 * ⚠️ Resta un marchio **provvisorio**, coerente col mondo visivo ma non un logo disegnato
 * da un designer: sostituirlo quando ci sarà l'asset vero.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- Colori (specchio di src/ui/theme/palette.ts) ---
const INDIGO = '#3A31E0'; // primary
const LILAC = '#E7E5FF'; // primaryContainer
const WHITE = '#FFFFFF';

// --- PNG ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA (Uint8ClampedArray, 4 byte per pixel) → file PNG. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filtro "none": le immagini sono piatte, comprime già bene
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Disegno ---

function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Distanza di un punto dal segmento AB: la base di tutte le forme qui sotto. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Il marchio, in uno spazio di disegno 100×100. Il percorso ha giunzioni e terminali
 * arrotondati perché è fatto di segmenti disegnati per distanza: gli spigoli non esistono.
 */
const MARK = {
  path: [
    [30, 79],
    [30, 50],
    [70, 50],
    [70, 21],
  ],
  strokeWidth: 11,
  start: { x: 30, y: 79, radius: 11 },
  end: { x: 70, y: 21, radius: 11, ringWidth: 6 },
};

/**
 * Distanza (con segno) dal marchio: negativa dentro la forma, positiva fuori.
 * Restituisce due campi separati perché la fermata d'arrivo è un anello vuoto e va
 * "bucata" nel colore del fondo.
 */
function markFields(x, y) {
  let line = Infinity;
  for (let i = 0; i < MARK.path.length - 1; i += 1) {
    const [ax, ay] = MARK.path[i];
    const [bx, by] = MARK.path[i + 1];
    line = Math.min(line, distanceToSegment(x, y, ax, ay, bx, by));
  }
  const stroke = line - MARK.strokeWidth / 2;
  const start = Math.hypot(x - MARK.start.x, y - MARK.start.y) - MARK.start.radius;
  const endDistance = Math.hypot(x - MARK.end.x, y - MARK.end.y);
  const endRing = Math.abs(endDistance - (MARK.end.radius - MARK.end.ringWidth / 2)) - MARK.end.ringWidth / 2;
  const endHole = endDistance - (MARK.end.radius - MARK.end.ringWidth);
  return { solid: Math.min(stroke, start, endRing), hole: endHole };
}

/** Copertura antialiasata di una distanza con segno, in unità di pixel. */
function coverage(distance, pixelSize) {
  return Math.max(0, Math.min(1, 0.5 - distance / pixelSize));
}

/**
 * Compone un'icona quadrata.
 * @param {number} size lato in pixel
 * @param {object} options
 * @param {string|null} options.background colore di fondo, o null per trasparente
 * @param {string} options.mark colore del marchio
 * @param {number} options.scale quanto del lato occupa il marchio (1 = tutto)
 */
function renderIcon(size, { background, mark, scale = 1 }) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const [br, bg, bb] = background ? rgb(background) : [0, 0, 0];
  const [mr, mg, mb] = rgb(mark);
  // Il marchio vive in 100×100 centrato: qui si converte il pixel in quelle coordinate.
  const unit = (size * scale) / 100;
  const offset = (size - size * scale) / 2;
  const pixelSize = 1 / unit;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const mx = (x + 0.5 - offset) / unit;
      const my = (y + 0.5 - offset) / unit;
      const { solid, hole } = markFields(mx, my);
      // La fermata d'arrivo è vuota: dentro il buco il marchio non copre.
      const alpha = Math.max(0, coverage(solid, pixelSize) - coverage(hole, pixelSize));

      const i = (y * size + x) * 4;
      if (background) {
        pixels[i] = br + (mr - br) * alpha;
        pixels[i + 1] = bg + (mg - bg) * alpha;
        pixels[i + 2] = bb + (mb - bb) * alpha;
        pixels[i + 3] = 255;
      } else {
        pixels[i] = mr;
        pixels[i + 1] = mg;
        pixels[i + 2] = mb;
        pixels[i + 3] = Math.round(alpha * 255);
      }
    }
  }
  return encodePng(size, pixels);
}

/** Tinta piatta (fondo dell'icona adattiva Android). */
function renderSolid(size, color) {
  const [r, g, b] = rgb(color);
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
  return encodePng(size, pixels);
}

function write(relativePath, buffer) {
  const file = resolve(ROOT, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buffer);
  console.log(`${relativePath} — ${(buffer.length / 1024).toFixed(1)} KB`);
}

// L'icona iOS/web ha il fondo lilla; il marchio sta all'80% del lato, con aria attorno.
write('assets/images/icon.png', renderIcon(1024, { background: LILAC, mark: INDIGO, scale: 0.8 }));
write('assets/images/favicon.png', renderIcon(96, { background: LILAC, mark: INDIGO, scale: 0.86 }));

// Splash: fondo indaco pieno (app.json), quindi il marchio va in bianco su trasparente.
write('assets/images/splash-icon.png', renderIcon(512, { background: null, mark: WHITE, scale: 0.92 }));

// Android adattiva: il primo piano deve stare nel 66% centrale, il resto lo ritaglia il sistema.
write(
  'assets/images/android-icon-foreground.png',
  renderIcon(1024, { background: null, mark: INDIGO, scale: 0.56 })
);
write('assets/images/android-icon-background.png', renderSolid(1024, LILAC));
write(
  'assets/images/android-icon-monochrome.png',
  renderIcon(1024, { background: null, mark: WHITE, scale: 0.56 })
);
