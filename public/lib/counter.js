"use strict";

function toHSV(data, n) {
  const sat = new Float32Array(n);
  const val = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    val[i] = mx;
    sat[i] = mx > 0 ? (mx - mn) / mx : 0;
  }
  return { sat, val };
}

function otsu(values, bins = 256) {
  const hist = new Float64Array(bins);
  for (let i = 0; i < values.length; i++) {
    let b = (values[i] * (bins - 1)) | 0;
    if (b < 0) b = 0;
    if (b >= bins) b = bins - 1;
    hist[b]++;
  }
  const total = values.length;
  let sumAll = 0;
  for (let b = 0; b < bins; b++) sumAll += b * hist[b];
  let sumB = 0, wB = 0, best = 0, bestVar = -1;
  for (let b = 0; b < bins; b++) {
    wB += hist[b];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += b * hist[b];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = b;
    }
  }
  return best / (bins - 1);
}

function erode(mask, w, h, r) {
  const out = new Uint8Array(mask.length);
  const tmp = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dx = -r; dx <= r && v; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        if (!mask[y * w + xx]) v = 0;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dy = -r; dy <= r && v; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        if (!tmp[yy * w + x]) v = 0;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function dilate(mask, w, h, r) {
  return erodeInvert(mask, w, h, r);
}

function erodeInvert(mask, w, h, r) {
  const inv = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inv[i] = mask[i] ? 0 : 1;
  const e = erode(inv, w, h, r);
  for (let i = 0; i < e.length; i++) e[i] = e[i] ? 0 : 1;
  return e;
}

function distanceTransform(mask, w, h) {
  const INF = 1e9;
  const d = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
      if (y > 0) {
        if (d[i - w] + 1 < v) v = d[i - w] + 1;
        if (x > 0 && d[i - w - 1] + 1.4142 < v) v = d[i - w - 1] + 1.4142;
        if (x < w - 1 && d[i - w + 1] + 1.4142 < v) v = d[i - w + 1] + 1.4142;
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x < w - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
      if (y < h - 1) {
        if (d[i + w] + 1 < v) v = d[i + w] + 1;
        if (x < w - 1 && d[i + w + 1] + 1.4142 < v) v = d[i + w + 1] + 1.4142;
        if (x > 0 && d[i + w - 1] + 1.4142 < v) v = d[i + w - 1] + 1.4142;
      }
      d[i] = v;
    }
  }
  return d;
}

function labelComponents(mask, w, h) {
  const labels = new Int32Array(mask.length).fill(-1);
  const areas = [];
  const stack = new Int32Array(mask.length);
  let next = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const id = next++;
    let sp = 0, area = 0;
    stack[sp++] = start;
    labels[start] = id;
    while (sp > 0) {
      const i = stack[--sp];
      area++;
      const x = i % w, y = (i / w) | 0;
      if (x > 0 && mask[i - 1] && labels[i - 1] === -1) { labels[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && labels[i + 1] === -1) { labels[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - w] && labels[i - w] === -1) { labels[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && mask[i + w] && labels[i + w] === -1) { labels[i + w] = id; stack[sp++] = i + w; }
    }
    areas.push(area);
  }
  return { labels, areas };
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)));
  return s[pos];
}

function findPeaks(dist, w, h, minDist, minVal) {
  const cands = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = dist[i];
      if (v < minVal) continue;
      if (
        v >= dist[i - 1] && v >= dist[i + 1] &&
        v >= dist[i - w] && v >= dist[i + w] &&
        v >= dist[i - w - 1] && v >= dist[i - w + 1] &&
        v >= dist[i + w - 1] && v >= dist[i + w + 1]
      ) {
        cands.push({ x, y, v });
      }
    }
  }
  cands.sort((a, b) => b.v - a.v);
  const kept = [];
  const minD2 = minDist * minDist;
  for (const c of cands) {
    let ok = true;
    for (const k of kept) {
      const dx = c.x - k.x, dy = c.y - k.y;
      if (dx * dx + dy * dy < minD2) { ok = false; break; }
    }
    if (ok) kept.push(c);
  }
  return kept;
}

function assignSegments(peaks, labels, compIds, w, h) {
  const segOf = new Int32Array(labels.length).fill(-1);
  const queue = new Int32Array(labels.length);
  let qh = 0, qt = 0;
  peaks.forEach((p, idx) => {
    const i = p.y * w + p.x;
    segOf[i] = idx;
    queue[qt++] = i;
  });
  while (qh < qt) {
    const i = queue[qh++];
    const lab = labels[i];
    const seg = segOf[i];
    const x = i % w, y = (i / w) | 0;
    const tryN = j => {
      if (labels[j] === lab && segOf[j] === -1) {
        segOf[j] = seg;
        queue[qt++] = j;
      }
    };
    if (x > 0) tryN(i - 1);
    if (x < w - 1) tryN(i + 1);
    if (y > 0) tryN(i - w);
    if (y < h - 1) tryN(i + w);
  }
  return segOf;
}

function countJar(img, opts = {}) {
  const { width: w, height: h } = img;
  const n = w * h;
  const data = img.data;

  const { sat, val } = toHSV(data, n);
  const otsuSat = otsu(sat);
  const satThr = Math.max(opts.satMin ?? 0.15, Math.min(otsuSat * 0.8, 0.55));
  const valMin = opts.valMin ?? 0.12;

  let mask = new Uint8Array(n);
  let maskCount = 0;
  for (let i = 0; i < n; i++) {
    if (sat[i] >= satThr && val[i] >= valMin && val[i] <= 0.995) {
      mask[i] = 1;
      maskCount++;
    }
  }

  mask = dilate(mask, w, h, 2);
  mask = erode(mask, w, h, 2);
  mask = erode(mask, w, h, 1);
  mask = dilate(mask, w, h, 1);

  const minArea = opts.minArea ?? Math.max(12, (n * 0.00004) | 0);
  const { labels, areas } = labelComponents(mask, w, h);
  const compIds = [];
  for (let c = 0; c < areas.length; c++) {
    if (areas[c] >= minArea) compIds.push(c);
    else maskRemove(c);
  }
  function maskRemove(id) {
    for (let i = 0; i < n; i++) if (labels[i] === id) mask[i] = 0;
  }

  const dist = distanceTransform(mask, w, h);

  const dEqs = [];
  for (const c of compIds) dEqs.push(2 * Math.sqrt(areas[c] / Math.PI));
  let guess = quantile(dEqs.filter(d => d >= 6 && d <= 140), 0.35);
  if (!guess || !isFinite(guess)) guess = Math.max(8, Math.sqrt((maskCount || n) / 40));

  let peaks = findPeaks(dist, w, h, guess * 0.85, Math.max(2.5, guess * 0.3));
  let radii = peaks.map(p => p.v);
  let rMed = median(radii) || guess / 2;
  const spacing = Math.max(5, Math.min(200, rMed * 1.55));
  peaks = findPeaks(dist, w, h, spacing, Math.max(2.5, rMed * 0.42));
  radii = peaks.map(p => p.v);
  rMed = median(radii) || rMed;

  const peakComp = peaks.map(p => labels[p.y * w + p.x]);
  let segOf = assignSegments(peaks, labels, peakComp, w, h);
  let segAreas = new Array(peaks.length).fill(0);
  let segBBox = new Array(peaks.length).fill(null);
  for (let i = 0; i < n; i++) {
    const s = segOf[i];
    if (s < 0) continue;
    segAreas[s]++;
    const x = i % w, y = (i / w) | 0;
    const bb = segBBox[s];
    if (!bb) segBBox[s] = [x, y, x, y];
    else {
      if (x < bb[0]) bb[0] = x;
      if (y < bb[1]) bb[1] = y;
      if (x > bb[2]) bb[2] = x;
      if (y > bb[3]) bb[3] = y;
    }
  }

  const singleGuess0 = Math.PI * rMed * rMed;
  let A1 = median(segAreas);
  if (!A1 || A1 <= 0) A1 = Math.max(20, singleGuess0);

  const extraPeaks = [];
  if (peaks.length) {
    for (let pi = 0; pi < peaks.length; pi++) {
      if (segAreas[pi] <= A1 * 1.55) continue;
      const bb = segBBox[pi];
      if (!bb) continue;
      const comp = peakComp[pi];
      const step = Math.max(4, rMed * 1.55);
      const dedupeD2 = (rMed * 1.15) * (rMed * 1.15);
      let row = 0;
      for (let gy = bb[1] + step / 2; gy <= bb[3]; gy += step * 0.87, row++) {
        const off = row % 2 ? step / 2 : 0;
        for (let gx = bb[0] + off; gx <= bb[2]; gx += step) {
          const xi = Math.min(w - 2, Math.max(1, gx | 0));
          const yi = Math.min(h - 2, Math.max(1, gy | 0));
          const i = yi * w + xi;
          if (labels[i] !== comp || dist[i] < rMed * 0.4) continue;
          let nearExisting = false;
          for (const q of peaks.concat(extraPeaks)) {
            const dx = xi - q.x, dy = yi - q.y;
            if (dx * dx + dy * dy < dedupeD2) { nearExisting = true; break; }
          }
          if (!nearExisting) extraPeaks.push({ x: xi, y: yi, v: dist[i] });
        }
      }
    }
  }
  if (extraPeaks.length) {
    peaks = peaks.concat(extraPeaks);
    peakComp.push(...extraPeaks.map(p => labels[p.y * w + p.x]));
    segOf = assignSegments(peaks, labels, peakComp, w, h);
    segAreas = new Array(peaks.length).fill(0);
    for (let i = 0; i < n; i++) if (segOf[i] >= 0) segAreas[segOf[i]]++;
  }

  const singleGuess = Math.PI * rMed * rMed;
  const plausible = segAreas.filter(a => a >= singleGuess * 0.55 && a <= singleGuess * 1.5);
  A1 = plausible.length >= Math.max(3, segAreas.length * 0.15)
    ? median(plausible)
    : median(segAreas);
  if (!A1 || A1 <= 0) A1 = Math.max(20, singleGuess);

  const assignedArea = segAreas.reduce((s, a) => s + a, 0);
  const leftoverArea = Math.max(0, maskCount - assignedArea);
  const areaEstimate = (assignedArea + leftoverArea) / A1;
  let visibleCount = Math.max(peaks.length, Math.round(areaEstimate));

  const coverage = maskCount / n;
  const hiddenFactor = opts.hiddenFactor ?? (1 + Math.min(0.5, coverage * 1.1));
  const estimate = Math.round(visibleCount * hiddenFactor);
  return {
    count: estimate,
    visibleCount,
    beans: peaks.map(p => ({ x: p.x, y: p.y, r: Math.max(3, p.v * 0.95) })),
    beanDiameterPx: +(rMed * 2).toFixed(1),
    candyCoverage: +coverage.toFixed(3),
    threshold: +satThr.toFixed(3),
    width: w,
    height: h
  };
}

module.exports = { countJar };
