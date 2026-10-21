import { inflateSync } from 'node:zlib';

/**
 * Dominant color of a cover image without image dependencies.
 *
 * - PNG: fully decoded (8/16-bit gray, RGB, palette, gray+alpha, RGBA; non-interlaced).
 * - JPEG (baseline and progressive, Huffman-coded): only the DC coefficient of every 8x8 block
 *   is decoded. The DC term is the block's mean value, so this yields an exact 1/8-scale
 *   thumbnail, which is all a dominant color needs, at a fraction of a full decode's cost.
 *
 * Unsupported inputs (CMYK JPEG, arithmetic coding, interlaced PNG, other formats) return null and
 * the release keeps its default color.
 */

export type Rgb = readonly [number, number, number];

/** Larger images are ignored (covers are requested as small thumbnails anyway). */
const MAX_PIXELS = 4096 * 4096;

export function dominantColorOf(image: Uint8Array): string | null {
  const pixels = isPng(image) ? decodePngPixels(image) : isJpeg(image) ? decodeJpegDc(image) : null;
  if (!pixels || pixels.length === 0) return null;
  return toHex(pickDominant(pixels));
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`;
}

/**
 * Coarse histogram (4 bits per channel) weighted towards saturated colors, so a red cover with a
 * white border is "red", then the mean of the winning bucket. Near-white and near-black pixels
 * only win when nothing else is there.
 */
export function pickDominant(pixels: readonly Rgb[]): Rgb {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number; n: number }>();
  for (const [r, g, b] of pixels) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const extreme = max < 24 || min > 232;
    const weight = (extreme ? 0.15 : 1) * (0.35 + saturation);
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, n: 0 };
    bucket.weight += weight;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  let best: { weight: number; r: number; g: number; b: number; n: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket;
  }
  if (!best) return [38, 38, 43];
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(data: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, i) => data[i] === byte);
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) * 0x1000000 +
      (((data[offset + 1] ?? 0) << 16) |
        ((data[offset + 2] ?? 0) << 8) |
        (data[offset + 3] ?? 0))) >>>
    0
  );
}

export function decodePngPixels(data: Uint8Array): Rgb[] | null {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  while (offset + 8 <= data.length) {
    const length = readU32(data, offset);
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = readU32(body, 0);
      height = readU32(body, 4);
      bitDepth = body[8] ?? 0;
      colorType = body[9] ?? 0;
      interlace = body[12] ?? 0;
    } else if (type === 'PLTE') {
      palette = body;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels || width === 0 || height === 0 || interlace !== 0) return null;
  const subByte = bitDepth === 1 || bitDepth === 2 || bitDepth === 4;
  if (bitDepth !== 8 && bitDepth !== 16 && !(subByte && (colorType === 0 || colorType === 3))) {
    return null;
  }
  if (colorType === 3 && !palette) return null;
  if (width * height > MAX_PIXELS) return null;

  // Filters work on whole bytes: sub-byte formats use 1 as the "pixel" distance.
  const bytesPerPixel = Math.max(1, (channels * bitDepth) / 8);
  const stride = Math.ceil((width * channels * bitDepth) / 8);
  let raw: Buffer;
  try {
    // Never inflate more than the header promises: a few KB of zlib can expand to gigabytes.
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  } catch {
    return null;
  }
  if (raw.length < (stride + 1) * height) return null;

  const current = new Uint8Array(stride);
  const previous = new Uint8Array(stride);
  const pixels: Rgb[] = [];
  // Sampling every pixel of a 1000px cover is wasteful: ~64 samples per row/column is plenty.
  const step = Math.max(1, Math.floor(Math.max(width, height) / 64));

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart] ?? 0;
    for (let x = 0; x < stride; x++) {
      const value = raw[rowStart + 1 + x] ?? 0;
      const left = x >= bytesPerPixel ? (current[x - bytesPerPixel] ?? 0) : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bytesPerPixel ? (previous[x - bytesPerPixel] ?? 0) : 0;
      let out: number;
      switch (filter) {
        case 0:
          out = value;
          break;
        case 1:
          out = value + left;
          break;
        case 2:
          out = value + up;
          break;
        case 3:
          out = value + ((left + up) >> 1);
          break;
        case 4:
          out = value + paeth(left, up, upLeft);
          break;
        default:
          return null;
      }
      current[x] = out & 0xff;
    }

    if (y % step === 0) {
      for (let x = 0; x < width; x += step) {
        const sample = (channel: number): number => {
          if (subByte) {
            const bit = x * bitDepth;
            const byte = current[bit >> 3] ?? 0;
            const value = (byte >> (8 - bitDepth - (bit & 7))) & ((1 << bitDepth) - 1);
            return colorType === 3 ? value : Math.round((value * 255) / ((1 << bitDepth) - 1));
          }
          return current[x * bytesPerPixel + channel * (bitDepth / 8)] ?? 0;
        };
        if (colorType === 3 && palette) {
          const index = sample(0) * 3;
          pixels.push([palette[index] ?? 0, palette[index + 1] ?? 0, palette[index + 2] ?? 0]);
        } else if (colorType === 0 || colorType === 4) {
          if (colorType === 4 && sample(1) < 128) continue;
          pixels.push([sample(0), sample(0), sample(0)]);
        } else {
          if (colorType === 6 && sample(3) < 128) continue;
          pixels.push([sample(0), sample(1), sample(2)]);
        }
      }
    }
    previous.set(current);
  }
  return pixels;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// ---------------------------------------------------------------------------
// JPEG (DC coefficients only)
// ---------------------------------------------------------------------------

function isJpeg(data: Uint8Array): boolean {
  return data[0] === 0xff && data[1] === 0xd8;
}

interface HuffmanTable {
  /** code length (1..16) -> Map<code, symbol> */
  lookup: Array<Map<number, number>>;
}

interface Component {
  id: number;
  h: number;
  v: number;
  tq: number;
  blocksPerLine: number;
  blocksPerColumn: number;
  /** Dequantized DC per block, row-major over the padded component block grid. */
  dc: Float64Array;
  pred: number;
  dcTable: number;
  acTable: number;
}

function buildHuffman(counts: Uint8Array, symbols: Uint8Array): HuffmanTable {
  const lookup: Array<Map<number, number>> = [];
  let code = 0;
  let k = 0;
  for (let length = 1; length <= 16; length++) {
    const map = new Map<number, number>();
    const n = counts[length - 1] ?? 0;
    for (let i = 0; i < n; i++) {
      map.set(code, symbols[k] ?? 0);
      code++;
      k++;
    }
    lookup[length] = map;
    code <<= 1;
  }
  return { lookup };
}

class BitReader {
  private bitBuffer = 0;
  private bitCount = 0;
  /** Set when a marker (other than stuffing) is reached: further reads return zeros. */
  markerHit = false;

  constructor(
    private readonly data: Uint8Array,
    public offset: number
  ) {}

  private readByte(): number {
    if (this.markerHit || this.offset >= this.data.length) return 0;
    const byte = this.data[this.offset] ?? 0;
    if (byte === 0xff) {
      const next = this.data[this.offset + 1] ?? 0;
      if (next === 0x00) {
        this.offset += 2;
        return 0xff;
      }
      this.markerHit = true;
      return 0;
    }
    this.offset++;
    return byte;
  }

  bit(): number {
    if (this.bitCount === 0) {
      this.bitBuffer = this.readByte();
      this.bitCount = 8;
    }
    this.bitCount--;
    return (this.bitBuffer >> this.bitCount) & 1;
  }

  bits(n: number): number {
    let value = 0;
    for (let i = 0; i < n; i++) value = (value << 1) | this.bit();
    return value;
  }

  decode(table: HuffmanTable): number {
    let code = 0;
    for (let length = 1; length <= 16; length++) {
      code = (code << 1) | this.bit();
      const symbol = table.lookup[length]?.get(code);
      if (symbol !== undefined) return symbol;
    }
    throw new Error('invalid huffman code');
  }

  /** JPEG "receive and extend": an s-bit magnitude category into a signed value. */
  receiveExtend(s: number): number {
    if (s === 0) return 0;
    const value = this.bits(s);
    return value < 1 << (s - 1) ? value - (1 << s) + 1 : value;
  }

  /** Discards buffered bits and skips an RSTn marker (restart interval boundary). */
  restart(): void {
    this.bitCount = 0;
    this.markerHit = false;
    while (this.offset + 1 < this.data.length) {
      if (this.data[this.offset] === 0xff) {
        const marker = this.data[this.offset + 1] ?? 0;
        if (marker >= 0xd0 && marker <= 0xd7) {
          this.offset += 2;
          return;
        }
        if (marker !== 0x00 && marker !== 0xff) return;
      }
      this.offset++;
    }
  }
}

/** Offset of the first marker after entropy-coded data starting at `offset`. */
function skipEntropyData(data: Uint8Array, offset: number): number {
  let i = offset;
  while (i + 1 < data.length) {
    if (data[i] === 0xff) {
      const next = data[i + 1] ?? 0;
      if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) return i;
    }
    i++;
  }
  return data.length;
}

export function decodeJpegDc(data: Uint8Array): Rgb[] | null {
  try {
    return decodeJpegDcUnsafe(data);
  } catch {
    return null;
  }
}

function decodeJpegDcUnsafe(data: Uint8Array): Rgb[] | null {
  const quant: Array<number> = []; // DC quantizer per table id
  const dcTables: HuffmanTable[] = [];
  const acTables: HuffmanTable[] = [];
  let components: Component[] = [];
  let progressive = false;
  let width = 0;
  let height = 0;
  let maxH = 1;
  let maxV = 1;
  let mcusPerLine = 0;
  let mcusPerColumn = 0;
  let restartInterval = 0;
  let adobeTransform: number | null = null;
  let offset = 2;

  const u16 = (at: number) => ((data[at] ?? 0) << 8) | (data[at + 1] ?? 0);

  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = data[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (marker === 0xd9) break; // EOI
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    const length = u16(offset + 2);
    const segment = offset + 4;
    const end = offset + 2 + length;

    switch (marker) {
      case 0xdb: {
        // DQT: only the first (DC) entry of each table matters.
        let p = segment;
        while (p < end) {
          const pq = (data[p] ?? 0) >> 4;
          const tq = (data[p] ?? 0) & 15;
          quant[tq] = pq === 0 ? (data[p + 1] ?? 1) : u16(p + 1);
          p += 1 + 64 * (pq === 0 ? 1 : 2);
        }
        break;
      }
      case 0xc4: {
        let p = segment;
        while (p < end) {
          const tc = (data[p] ?? 0) >> 4;
          const th = (data[p] ?? 0) & 15;
          const counts = data.subarray(p + 1, p + 17);
          const total = counts.reduce((sum, n) => sum + n, 0);
          const table = buildHuffman(counts, data.subarray(p + 17, p + 17 + total));
          if (tc === 0) dcTables[th] = table;
          else acTables[th] = table;
          p += 17 + total;
        }
        break;
      }
      case 0xdd:
        restartInterval = u16(segment);
        break;
      case 0xee:
        // Adobe APP14: transform flag tells YCbCr (1) from RGB (0) / YCCK (2).
        if (String.fromCharCode(...data.subarray(segment, segment + 5)) === 'Adobe') {
          adobeTransform = data[segment + 11] ?? null;
        }
        break;
      case 0xc0:
      case 0xc1:
      case 0xc2: {
        progressive = marker === 0xc2;
        if ((data[segment] ?? 8) !== 8) return null; // 12-bit precision
        height = u16(segment + 1);
        width = u16(segment + 3);
        const count = data[segment + 5] ?? 0;
        if (width === 0 || height === 0 || (count !== 1 && count !== 3)) return null;
        if (width * height > MAX_PIXELS) return null; // DC buffers grow with the image size
        components = [];
        for (let i = 0; i < count; i++) {
          const p = segment + 6 + i * 3;
          components.push({
            id: data[p] ?? 0,
            h: (data[p + 1] ?? 0x11) >> 4 || 1,
            v: (data[p + 1] ?? 0x11) & 15 || 1,
            tq: data[p + 2] ?? 0,
            blocksPerLine: 0,
            blocksPerColumn: 0,
            dc: new Float64Array(0),
            pred: 0,
            dcTable: 0,
            acTable: 0,
          });
        }
        maxH = Math.max(...components.map((c) => c.h));
        maxV = Math.max(...components.map((c) => c.v));
        mcusPerLine = Math.ceil(width / (8 * maxH));
        mcusPerColumn = Math.ceil(height / (8 * maxV));
        for (const c of components) {
          c.blocksPerLine = mcusPerLine * c.h;
          c.blocksPerColumn = mcusPerColumn * c.v;
          c.dc = new Float64Array(c.blocksPerLine * c.blocksPerColumn);
        }
        break;
      }
      case 0xc3:
      case 0xc5:
      case 0xc6:
      case 0xc7:
      case 0xc9:
      case 0xca:
      case 0xcb:
      case 0xcd:
      case 0xce:
      case 0xcf:
        return null; // lossless / hierarchical / arithmetic coding
      case 0xda: {
        if (components.length === 0) return null;
        const count = data[segment] ?? 0;
        const scanComponents: Component[] = [];
        for (let i = 0; i < count; i++) {
          const id = data[segment + 1 + i * 2] ?? 0;
          const tables = data[segment + 2 + i * 2] ?? 0;
          const component = components.find((c) => c.id === id);
          if (!component) return null;
          component.dcTable = tables >> 4;
          component.acTable = tables & 15;
          scanComponents.push(component);
        }
        const p = segment + 1 + count * 2;
        const ss = data[p] ?? 0;
        const ah = (data[p + 2] ?? 0) >> 4;
        const al = (data[p + 2] ?? 0) & 15;
        const scanStart = end;
        if (progressive && (ss !== 0 || ah !== 0)) {
          // AC scans and DC refinement bits do not change the block means meaningfully.
          offset = skipEntropyData(data, scanStart);
          continue;
        }
        const reader = new BitReader(data, scanStart);
        decodeDcScan(reader, scanComponents, {
          progressive,
          al,
          restartInterval,
          mcusPerLine,
          mcusPerColumn,
          width,
          height,
          maxH,
          maxV,
          dcTables,
          acTables,
          quant,
        });
        offset = skipEntropyData(data, reader.offset);
        continue;
      }
      default:
        break;
    }
    offset = end;
  }

  if (components.length === 0) return null;
  return blocksToPixels(components, width, height, maxH, maxV, adobeTransform);
}

interface ScanContext {
  progressive: boolean;
  al: number;
  restartInterval: number;
  mcusPerLine: number;
  mcusPerColumn: number;
  width: number;
  height: number;
  maxH: number;
  maxV: number;
  dcTables: HuffmanTable[];
  acTables: HuffmanTable[];
  quant: number[];
}

function decodeDcScan(reader: BitReader, scan: Component[], ctx: ScanContext): void {
  for (const c of scan) c.pred = 0;

  const decodeBlock = (c: Component, row: number, col: number) => {
    const dcTable = ctx.dcTables[c.dcTable];
    if (!dcTable) throw new Error('missing DC table');
    const t = reader.decode(dcTable);
    c.pred += reader.receiveExtend(t);
    if (row < c.blocksPerColumn && col < c.blocksPerLine) {
      const coefficient = ctx.progressive ? c.pred * (1 << ctx.al) : c.pred;
      c.dc[row * c.blocksPerLine + col] = coefficient * (ctx.quant[c.tq] ?? 1);
    }
    if (!ctx.progressive) {
      // Baseline: AC coefficients follow in the same scan; decode them only to skip them.
      const acTable = ctx.acTables[c.acTable];
      if (!acTable) throw new Error('missing AC table');
      let k = 1;
      while (k < 64) {
        const rs = reader.decode(acTable);
        const s = rs & 15;
        const r = rs >> 4;
        if (s === 0) {
          if (r !== 15) break;
          k += 16;
          continue;
        }
        k += r;
        reader.bits(s);
        k++;
      }
    }
  };

  const single = scan.length === 1 ? scan[0] : undefined;
  if (single) {
    // Non-interleaved: blocks in raster order over the component's own (unpadded) size.
    const blocksPerLine = Math.ceil(Math.ceil((ctx.width * single.h) / ctx.maxH) / 8);
    const blocksPerColumn = Math.ceil(Math.ceil((ctx.height * single.v) / ctx.maxV) / 8);
    const total = blocksPerLine * blocksPerColumn;
    for (let n = 0; n < total; n++) {
      if (ctx.restartInterval > 0 && n > 0 && n % ctx.restartInterval === 0) {
        reader.restart();
        single.pred = 0;
      }
      decodeBlock(single, Math.floor(n / blocksPerLine), n % blocksPerLine);
    }
    return;
  }

  const totalMcus = ctx.mcusPerLine * ctx.mcusPerColumn;
  for (let m = 0; m < totalMcus; m++) {
    if (ctx.restartInterval > 0 && m > 0 && m % ctx.restartInterval === 0) {
      reader.restart();
      for (const c of scan) c.pred = 0;
    }
    const mcuRow = Math.floor(m / ctx.mcusPerLine);
    const mcuCol = m % ctx.mcusPerLine;
    for (const c of scan) {
      for (let v = 0; v < c.v; v++) {
        for (let h = 0; h < c.h; h++) {
          decodeBlock(c, mcuRow * c.v + v, mcuCol * c.h + h);
        }
      }
    }
  }
}

function blocksToPixels(
  components: Component[],
  width: number,
  height: number,
  maxH: number,
  maxV: number,
  adobeTransform: number | null
): Rgb[] {
  // The DC term is 8x the mean of the level-shifted samples: mean = DC / 8 + 128.
  const mean = (c: Component, row: number, col: number) =>
    (c.dc[row * c.blocksPerLine + col] ?? 0) / 8 + 128;
  const luma = components[0];
  if (!luma) return [];
  const rows = Math.ceil(height / (8 * (maxV / luma.v)));
  const cols = Math.ceil(width / (8 * (maxH / luma.h)));
  const pixels: Rgb[] = [];
  const step = Math.max(1, Math.floor(Math.max(rows, cols) / 64));
  const isRgb = components.length === 3 && adobeTransform === 0;

  for (let row = 0; row < rows; row += step) {
    for (let col = 0; col < cols; col += step) {
      const y = mean(luma, row, col);
      if (components.length === 1) {
        pixels.push([y, y, y]);
        continue;
      }
      const sample = (c: Component | undefined) => {
        if (!c) return 128;
        const r = Math.floor((row * c.v) / luma.v);
        const k = Math.floor((col * c.h) / luma.h);
        return mean(c, r, k);
      };
      const second = sample(components[1]);
      const third = sample(components[2]);
      if (isRgb) {
        pixels.push([clamp(y), clamp(second), clamp(third)]);
        continue;
      }
      const cb = second - 128;
      const cr = third - 128;
      pixels.push([
        clamp(y + 1.402 * cr),
        clamp(y - 0.344136 * cb - 0.714136 * cr),
        clamp(y + 1.772 * cb),
      ]);
    }
  }
  return pixels;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}
