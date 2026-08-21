"use strict";

const QRCode = (() => {
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gmul(a, b) {
    return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
  }

  const ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
  };
  const NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
  };
  const ALIGN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      r -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function dataCapacity(ver, level) {
    const total = Math.floor(rawDataModules(ver) / 8);
    return total - ECC_PER_BLOCK[level][ver] * NUM_BLOCKS[level][ver];
  }

  function rsGenerator(degree) {
    let gen = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= gmul(gen[j], EXP[i]);
      }
      gen = next;
    }
    return gen;
  }

  function rsRemainder(data, degree, gen) {
    const rem = new Array(degree).fill(0);
    for (const b of data) {
      const factor = b ^ rem[0];
      for (let i = 0; i < degree - 1; i++) rem[i] = rem[i + 1];
      rem[degree - 1] = 0;
      if (factor !== 0) {
        for (let i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor);
      }
    }
    return rem;
  }

  function buildCodewords(bytes, ver, level) {
    const cap = dataCapacity(ver, level);
    const eccLen = ECC_PER_BLOCK[level][ver];
    const blocks = NUM_BLOCKS[level][ver];

    const bits = [];
    const pushBits = (val, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    pushBits(4, 4);
    pushBits(bytes.length, ver < 10 ? 8 : 16);
    for (const b of bytes) pushBits(b, 8);
    while (bits.length % 8 !== 0) bits.push(0);
    let pi = 0;
    while (bits.length / 8 < cap) pushBits([0xec, 0x11][pi++ % 2], 8);

    const dataCw = [];
    for (let i = 0; i < cap; i++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
      dataCw.push(v);
    }

    const shortLen = Math.floor(cap / blocks);
    const numLong = cap % blocks;
    const blockData = [];
    const blockEcc = [];
    const gen = rsGenerator(eccLen);
    let off = 0;
    for (let i = 0; i < blocks; i++) {
      const len = shortLen + (i < numLong ? 1 : 0);
      const chunk = dataCw.slice(off, off + len);
      off += len;
      blockData.push(chunk);
      blockEcc.push(rsRemainder(chunk, eccLen, gen));
    }

    const out = [];
    const maxDataLen = shortLen + (numLong ? 1 : 0);
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < blocks; b++) if (i < blockData[b].length) out.push(blockData[b][i]);
    }
    for (let i = 0; i < eccLen; i++) {
      for (let b = 0; b < blocks; b++) out.push(blockEcc[b][i]);
    }
    return out;
  }

  function levelBits(level) {
    return level === "L" ? 1 : 0;
  }

  function formatBits(level, maskId) {
    const data = (levelBits(level) << 3) | maskId;
    let v = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((v >>> i) & 1) v ^= 0x537 << (i - 10);
    }
    return ((data << 10) | v) ^ 0x5412;
  }

  function drawFormat(mat, level, maskId) {
    const { size } = mat;
    const bits = formatBits(level, maskId);
    const bit = i => ((bits >>> i) & 1) !== 0;
    const setFn = (x, y, dark) => {
      mat.modules[y][x] = dark;
      mat.isFunc[y][x] = true;
    };
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6));
    setFn(8, 8, bit(7));
    setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  }

  function makeMatrix(ver, level) {
    const size = ver * 4 + 17;
    const mat = {
      size,
      modules: Array.from({ length: size }, () => new Array(size).fill(false)),
      isFunc: Array.from({ length: size }, () => new Array(size).fill(false))
    };

    const setFn = (x, y, dark) => {
      mat.modules[y][x] = dark;
      mat.isFunc[y][x] = true;
    };

    const drawFinder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(x, y, d !== 2 && d !== 4);
        }
      }
    };
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);

    for (let i = 8; i < size - 8; i++) {
      const dark = i % 2 === 0;
      if (!mat.isFunc[6][i]) setFn(i, 6, dark);
      if (!mat.isFunc[i][6]) setFn(6, i, dark);
    }

    for (const ay of ALIGN[ver - 1]) {
      for (const ax of ALIGN[ver - 1]) {
        if (mat.isFunc[ay][ax]) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const b = ((bits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const c = Math.floor(i / 3);
        setFn(a, c, b);
        setFn(c, a, b);
      }
    }

    drawFormat(mat, level, 0);
    return mat;
  }

  function placeData(codewords, mat) {
    const { size, modules, isFunc } = mat;
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    const getBit = () => (bitIdx < totalBits ? (codewords[bitIdx >> 3] >>> (7 - (bitIdx & 7))) & 1 : 0);

    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let v = 0; v < size; v++) {
        const y = upward ? size - 1 - v : v;
        for (const x of [right, right - 1]) {
          if (!isFunc[y][x]) {
            modules[y][x] = getBit() === 1;
            bitIdx++;
          }
        }
      }
    }
  }

  function maskBit(m, y, x) {
    switch (m) {
      case 0: return (y + x) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (y + x) % 3 === 0;
      case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5: return ((y * x) % 2) + ((y * x) % 3) === 0;
      case 6: return (((y * x) % 2) + ((y * x) % 3)) % 2 === 0;
      default: return (((y + x) % 2) + ((y * x) % 3)) % 2 === 0;
    }
  }

  function applyMask(mat, maskId) {
    const { size, modules, isFunc } = mat;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunc[y][x] && maskBit(maskId, y, x)) modules[y][x] = !modules[y][x];
      }
    }
  }

  function penalty(mat) {
    const { size, modules } = mat;
    let p = 0;

    const linePenalty = getter => {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        let runColor = getter(i, 0), runLen = 1;
        for (let j = 1; j < size; j++) {
          const c = getter(i, j);
          if (c === runColor) runLen++;
          else {
            if (runLen >= 5) sum += 3 + runLen - 5;
            runColor = c;
            runLen = 1;
          }
        }
        if (runLen >= 5) sum += 3 + runLen - 5;
      }
      return sum;
    };
    p += linePenalty((i, j) => modules[i][j]);
    p += linePenalty((i, j) => modules[j][i]);

    const pat = [true, true, true, true, true, false, true];
    const finderPenalty = getter => {
      let count = 0;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j <= size - 7; j++) {
          let ok = true;
          for (let k = 0; k < 7; k++) {
            if (getter(i, j + k) !== pat[k]) { ok = false; break; }
          }
          if (!ok) continue;
          const before = j >= 4 &&
            !getter(i, j - 1) && !getter(i, j - 2) && !getter(i, j - 3) && !getter(i, j - 4);
          const after = j + 10 < size &&
            !getter(i, j + 7) && !getter(i, j + 8) && !getter(i, j + 9) && !getter(i, j + 10);
          if (before || after) count++;
        }
      }
      return count * 40;
    };
    p += finderPenalty((i, j) => modules[i][j]);
    p += finderPenalty((i, j) => modules[j][i]);

    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
    }
    const total = size * size;
    const k = Math.abs(Math.ceil(dark * 20 / total) * 5 - 10);
    p += k * 10;
    return p;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    for (const level of ["M", "L"]) {
      for (let ver = 1; ver <= 10; ver++) {
        const overheadBits = 4 + (ver < 10 ? 8 : 16);
        if (bytes.length * 8 + overheadBits > dataCapacity(ver, level) * 8) continue;

        const codewords = buildCodewords(bytes, ver, level);
        const base = makeMatrix(ver, level);
        placeData(codewords, base);

        let best = null;
        let bestPenalty = Infinity;
        for (let m = 0; m < 8; m++) {
          const trial = {
            size: base.size,
            modules: base.modules.map(r => r.slice()),
            isFunc: base.isFunc
          };
          applyMask(trial, m);
          drawFormat(trial, level, m);
          const pen = penalty(trial);
          if (pen < bestPenalty) {
            bestPenalty = pen;
            best = trial;
          }
        }
        return best;
      }
    }
    throw new Error("text too long");
  }

  function svg(text, opts = {}) {
    const mat = encode(text);
    const quiet = opts.quietZone ?? 4;
    const scale = opts.scale ?? 8;
    const dim = (mat.size + quiet * 2) * scale;
    let path = "";
    for (let y = 0; y < mat.size; y++) {
      for (let x = 0; x < mat.size; x++) {
        if (mat.modules[y][x]) {
          path += `M${(x + quiet) * scale} ${(y + quiet) * scale}h${scale}v${scale}h-${scale}z`;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${opts.px ?? dim}" height="${opts.px ?? dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${opts.bg || "#ffffff"}"/><path d="${path}" fill="${opts.fg || "#111111"}"/></svg>`;
  }

  return { encode, svg };
})();

if (typeof module !== "undefined" && module.exports) module.exports = QRCode;
if (typeof window !== "undefined") window.QRCode = QRCode;
