"use strict";

const assert = require("assert");
const { countJar } = require("../public/lib/counter");
const {
  makeDeck, shuffle, evaluate5, evaluate7, cmpEval, handName, Game
} = require("../public/lib/poker-engine");
const { decide } = require("../public/lib/ai");
const QRCode = require("../public/qr");

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    process.exitCode = 1;
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log("\n[QR code encoder]");

function qrSyndromesValid(mat) {
  const ver = (mat.size - 17) / 4;
  const levels = ["M", "L"];
  const ECC_PER_BLOCK = { L: [-1,7,10,15,20,26,18,20,24,30,18], M: [-1,10,16,26,18,24,16,18,22,22,26] };
  const NUM_BLOCKS = { L: [-1,1,1,1,1,1,2,2,2,2,4], M: [-1,1,1,1,2,2,4,4,4,5,5] };

  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  function syndromes(cw, eccLen) {
    const S = [];
    for (let i = 0; i < eccLen; i++) {
      let acc = 0;
      for (const b of cw) acc = gmul(acc, EXP[i]) ^ b;
      S.push(acc);
    }
    return S;
  }

  for (const level of levels) {
    const eccLen = ECC_PER_BLOCK[level][ver];
    const blocks = NUM_BLOCKS[level][ver];
    const rawModules = (16 * ver + 128) * ver + 64 -
      (ver >= 2 ? ((25 * (((ver / 7) | 0) + 2) - 10) * (((ver / 7) | 0) + 2) - 55) : 0) -
      (ver >= 7 ? 36 : 0);
    const totalCw = Math.floor(rawModules / 8);
    const dataLen = totalCw - eccLen * blocks;

    for (let mask = 0; mask < 8; mask++) {
      const bits = [];
      for (let right = mat.size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        const upward = ((right + 1) & 2) === 0;
        for (let v = 0; v < mat.size; v++) {
          const y = upward ? mat.size - 1 - v : v;
          for (const xx of [right, right - 1]) {
            if (!mat.isFunc[y][xx]) {
              let cell = mat.modules[y][xx];
              const mOn =
                mask === 0 ? (y + xx) % 2 === 0 :
                mask === 1 ? y % 2 === 0 :
                mask === 2 ? xx % 3 === 0 :
                mask === 3 ? (y + xx) % 3 === 0 :
                mask === 4 ? (Math.floor(y / 2) + Math.floor(xx / 3)) % 2 === 0 :
                mask === 5 ? ((y * xx) % 2) + ((y * xx) % 3) === 0 :
                mask === 6 ? (((y * xx) % 2) + ((y * xx) % 3)) % 2 === 0 :
                (((y + xx) % 2) + ((y * xx) % 3)) % 2 === 0;
              if (mOn) cell = !cell;
              bits.push(cell ? 1 : 0);
            }
          }
        }
      }
      if (bits.length < totalCw * 8) continue;

      const cw = [];
      for (let i = 0; i < totalCw; i++) {
        let val = 0;
        for (let b = 0; b < 8; b++) val = (val << 1) | bits[i * 8 + b];
        cw.push(val);
      }

      const shortLen = Math.floor(dataLen / blocks);
      const numLong = dataLen % blocks;
      const blockDataLen = [];
      for (let i = 0; i < blocks; i++) blockDataLen.push(shortLen + (i < numLong ? 1 : 0));

      const deintData = Array.from({ length: blocks }, () => []);
      const deintEcc = Array.from({ length: blocks }, () => []);
      let idx = 0;
      for (let i = 0; i < shortLen + 1; i++) {
        for (let b = 0; b < blocks; b++) if (i < blockDataLen[b]) deintData[b].push(cw[idx++]);
      }
      for (let i = 0; i < eccLen; i++) {
        for (let b = 0; b < blocks; b++) deintEcc[b].push(cw[idx++]);
      }

      let allZero = true;
      for (let b = 0; b < blocks; b++) {
        const full = deintData[b].concat(deintEcc[b]);
        for (const s of syndromes(full, eccLen)) {
          if (s !== 0) { allZero = false; break; }
        }
        if (!allZero) break;
      }
      if (allZero) return true;
    }
  }
  return false;
}

ok("encodes short URL with structurally valid RS blocks", () => {
  const mat = QRCode.encode("https://party.example.com/join");
  assert.ok(mat.size >= 21 && mat.size <= 57, `unexpected size ${mat.size}`);
  assert.ok(qrSyndromesValid(mat), "no mask/level combination produced zero syndromes");
});

ok("encodes longer URL (higher version)", () => {
  const long = "https://your-party-url.example.com/games/count-the-jar?room=123456";
  const mat = QRCode.encode(long);
  assert.ok(mat.size > 25, "expected larger version for long text");
  assert.ok(qrSyndromesValid(mat), "RS check failed for long text");
});

ok("finder patterns present at three corners", () => {
  const mat = QRCode.encode("https://x.co");
  const isFinder = (ox, oy) => {
    for (let dy = 0; dy < 7; dy++)
      for (let dx = 0; dx < 7; dx++) {
        const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        const want = d !== 2;
        if (mat.modules[oy + dy][ox + dx] !== want) return false;
      }
    return true;
  };
  assert.ok(isFinder(0, 0));
  assert.ok(isFinder(mat.size - 7, 0));
  assert.ok(isFinder(0, mat.size - 7));
});

ok("svg() produces embeddable markup", () => {
  const s = QRCode.svg("https://party.example.com", { px: 120 });
  assert.ok(s.startsWith("<svg") && s.includes("</svg>") && s.includes("<path"));
});

console.log("\n[Jar counter]");

function drawSyntheticJar(w, h, beanCount, rng, opts = {}) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = 120; buf[i * 4 + 1] = 122; buf[i * 4 + 2] = 126; buf[i * 4 + 3] = 255;
  }
  const cx = w / 2, cy = h / 2, jarR = Math.min(w, h) * 0.44;
  const placed = [];
  for (let n = 0; n < beanCount; n++) {
    let bx, by;
    do {
      const ang = rng() * Math.PI * 2;
      const rad = Math.sqrt(rng()) * (jarR - 14);
      bx = cx + Math.cos(ang) * rad;
      by = cy + Math.sin(ang) * rad;
    } while (opts.spread && placed.some(p => Math.hypot(p.x - bx, p.y - by) < 22));
    placed.push({ x: bx, y: by });
    const hue = rng();
    const r = 40 + Math.floor(rng() * 200);
    const g = 40 + Math.floor(rng() * 200);
    const b = 40 + Math.floor(rng() * 200);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const satBoost = mx === 0 ? 0 : (mx - mn) / mx;
    const rr = satBoost > 0.25 ? r : Math.min(255, r + 90);
    const br = 8 + rng() * 4;
    for (let dy = -13; dy <= 13; dy++) {
      for (let dx = -13; dx <= 13; dx++) {
        if (dx * dx + dy * dy > br * br) continue;
        const px = Math.round(bx + dx), py = Math.round(by + dy);
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const i = (py * w + px) * 4;
        buf[i] = rr; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
      }
    }
  }
  return buf;
}

ok("counts sparse separated beans accurately", () => {
  const rng = mulberry32(42);
  const N = 35;
  const buf = drawSyntheticJar(420, 420, N, rng, { spread: true });
  const res = countJar({ width: 420, height: 420, data: buf });
  const err = Math.abs(res.count - N) / N;
  console.log(`       sparse: true=${N} est=${res.count} err=${(err * 100).toFixed(1)}%`);
  assert.ok(err <= 0.15, `sparse error ${(err * 100).toFixed(1)}% exceeds 15%`);
});

ok("counts dense overlapping pile within tolerance", () => {
  const rng = mulberry32(7);
  const N = 110;
  const buf = drawSyntheticJar(420, 420, N, rng);
  const res = countJar({ width: 420, height: 420, data: buf });
  const err = Math.abs(res.count - N) / N;
  console.log(`       dense: true=${N} est=${res.count} err=${(err * 100).toFixed(1)}%`);
  assert.ok(err <= 0.30, `dense error ${(err * 100).toFixed(1)}% exceeds 30%`);
});

ok("returns bean markers for overlay", () => {
  const rng = mulberry32(99);
  const buf = drawSyntheticJar(360, 360, 50, rng, { spread: true });
  const res = countJar({ width: 360, height: 360, data: buf });
  assert.ok(res.beans.length > 0, "no bean centers returned");
  for (const b of res.beans) {
    assert.ok(b.x >= 0 && b.x < 360 && b.y >= 0 && b.y < 360, "bean out of bounds");
    assert.ok(b.r >= 3, "bean radius implausible");
  }
});

ok("handles empty scene without crashing", () => {
  const buf = Buffer.alloc(200 * 200 * 4, 200);
  const res = countJar({ width: 200, height: 200, data: buf });
  assert.strictEqual(res.visibleCount, 0);
});

console.log("\n[Poker engine]");

ok("hand categories order correctly", () => {
  const c = (rs, s) => ({ rank: rs, suit: s });
  const royal = [c(14,0),c(13,0),c(12,0),c(11,0),c(10,0)];
  const quads = [c(9,0),c(9,1),c(9,2),c(9,3),c(5,0)];
  const boat = [c(8,0),c(8,1),c(8,2),c(4,0),c(4,1)];
  const flush = [c(14,2),c(11,2),c(8,2),c(6,2),c(2,2)];
  const wheel = [c(14,0),c(2,1),c(3,0),c(4,2),c(5,3)];
  const broadway = [c(10,0),c(11,1),c(12,2),c(13,3),c(9,0)];
  assert.strictEqual(evaluate5(royal).category, 8);
  assert.ok(cmpEval(evaluate5(royal), evaluate5(quads)) > 0);
  assert.ok(cmpEval(evaluate5(quads), evaluate5(boat)) > 0);
  assert.ok(cmpEval(evaluate5(boat), evaluate5(flush)) > 0);
  assert.ok(cmpEval(evaluate5(flush), evaluate5(broadway)) > 0);
  assert.strictEqual(evaluate5(wheel).category, 4);
  assert.strictEqual(evaluate5(wheel).tiebreak[0], 5);
  assert.ok(cmpEval(evaluate5(broadway), evaluate5(wheel)) > 0);
});

ok("evaluate7 finds best five of seven", () => {
  const c = (r, s) => ({ rank: r, suit: s });
  const holeBoard = [c(6,0),c(13,0), c(10,0),c(11,0),c(12,0), c(2,3),c(9,3)];
  const ev = evaluate7(holeBoard);
  assert.strictEqual(ev.category, 5, "should pick the spade flush");
  assert.strictEqual(handName(ev), "Flush, King high");
});

ok("split pots compare equal", () => {
  const c = (r, s) => ({ rank: r, suit: s });
  const a = evaluate5([c(9,0),c(9,1),c(4,2),c(7,3),c(2,0)]);
  const b = evaluate5([c(9,2),c(9,3),c(4,1),c(7,0),c(2,2)]);
  assert.strictEqual(cmpEval(a, b), 0);
});

ok("full 300-hand AI simulation conserves chips", () => {
  const rng = mulberry32(2026);
  const game = new Game({
    playerNames: ["You", "Ada", "Bo", "Cy"],
    startingChips: 2000,
    smallBlind: 5,
    bigBlind: 10,
    rng
  });
  const TOTAL = game.players.reduce((s, p) => s + p.chips, 0);
  let hands = 0;

  for (let h = 0; h < 300 && game.phase !== "gameover"; h++) {
    game.startHand();
    hands++;
    let acts = 0;
    while (!["payout", "gameover"].includes(game.phase) && acts++ < 800) {
      const pid = game.toActIdx;
      const legal = game.legalActions(pid);
      assert.ok(legal, `no legal actions for ${game.players[pid].name} in ${game.phase}`);
      let action;
      if (rng() < 0.85) {
        const d = decide(game, pid, rng);
        action = d || { action: legal.canCheck ? "check" : "fold" };
      } else {
        const options = ["fold"];
        if (legal.canCheck) options.push("check");
        if (legal.canCall) options.push("call");
        if (legal.canRaise) options.push("raise");
        action = { action: options[(rng() * options.length) | 0], amount: legal.minRaiseTo };
      }
      game.act(pid, action.action, action.amount ?? 0);
    }
    const now = game.players.reduce((s, p) => s + p.chips, 0) + game.pot +
      game.players.reduce((s, p) => s + p.bet, 0);
    assert.strictEqual(now, TOTAL, `chips leaked in hand ${hands}: ${now} != ${TOTAL}`);
  }
  assert.ok(hands >= 100, `only ${hands} hands completed`);
  console.log(`       simulated ${hands} hands, chips conserved at ${TOTAL}`);
});

ok("heads-up blinds behave (dealer is small blind)", () => {
  const rng = mulberry32(5);
  const game = new Game({ playerNames: ["A", "B"], startingChips: 200, smallBlind: 5, bigBlind: 10, rng });
  game.startHand();
  const dealer = game.players[game.dealerIdx];
  const other = game.players.find(p => p !== dealer);
  assert.strictEqual(dealer.bet, 5, "dealer should post SB heads-up");
  assert.strictEqual(other.bet, 10, "non-dealer posts BB heads-up");
  assert.strictEqual(game.toActIdx, dealer.id, "dealer acts first preflop heads-up");
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);
