"use strict";

const { evaluate7, cmpEval } = require("./poker-engine");

const MADE_STRENGTH = [0.18, 0.42, 0.6, 0.72, 0.8, 0.87, 0.93, 0.97, 0.995];

function preflopStrength(hole) {
  const [a, b] = [...hole].sort((x, y) => y.rank - x.rank);
  const gap = a.rank - b.rank;
  let score;
  if (a.rank === b.rank) {
    score = 11 + a.rank * 0.75;
  } else {
    score = a.rank * 0.7 + b.rank * 0.32;
    if (a.suit === b.suit) score += 1.8;
    if (gap === 1) score += 1.8;
    else if (gap === 2) score += 0.9;
    else if (gap === 3) score += 0.3;
    else score -= Math.min(2.5, (gap - 3) * 0.6);
    if (a.rank === 14) score += 1.2;
  }
  return Math.max(0.05, Math.min(0.93, (score - 6) / 17));
}

function postflopStrength(hole, board) {
  const ev = evaluate7([...hole, ...board]);
  let s = MADE_STRENGTH[ev.category];
  if (ev.category <= 1) {
    const suits = {};
    for (const c of [...hole, ...board]) suits[c.suit] = (suits[c.suit] || 0) + 1;
    if (Object.values(suits).some(v => v === 4)) s += 0.16;
    const ranks = [...new Set([...hole, ...board].map(c => c.rank))].sort((a, b) => a - b);
    let run = 1, bestRun = 1;
    for (let i = 1; i < ranks.length; i++) {
      run = ranks[i] === ranks[i - 1] + 1 ? run + 1 : 1;
      bestRun = Math.max(bestRun, run);
    }
    if (bestRun >= 4) s += 0.12;
    else if (bestRun === 3 && board.length >= 4) s += 0.05;
    if (ev.category === 1 && ev.tiebreak[0] >= 12) s += 0.05;
  }
  return Math.min(0.985, s);
}

function decide(game, pid, rng = Math.random) {
  const p = game.players[pid];
  const legal = game.legalActions(pid);
  if (!legal) return null;

  const strength = game.phase === "preflop"
    ? preflopStrength(p.hole)
    : postflopStrength(p.hole, game.board);

  const potNow = game.pot + game.players.reduce((s, q) => s + q.bet, 0);
  const toCall = legal.toCall;

  if (toCall === 0) {
    const bluff = rng() < 0.12;
    if ((strength > 0.66 || bluff) && legal.canRaise && p.chips > game.bbAmount * 3) {
      const size = Math.max(game.bbAmount * 2, Math.round(potNow * (0.4 + strength * 0.3)));
      return { action: "raise", amount: p.bet + size };
    }
    return { action: "check" };
  }

  const potOdds = toCall / (potNow + toCall);
  const callMargin = strength - potOdds;

  if (callMargin > 0.25 && legal.canRaise && rng() < 0.3 + strength * 0.45) {
    const raiseSize = Math.round(Math.max(game.minRaise, potNow * (0.45 + strength * 0.4)));
    return { action: "raise", amount: Math.min(p.bet + toCall + raiseSize, legal.maxRaiseTo) };
  }
  if (callMargin > -0.03 || (toCall <= game.bbAmount && strength > 0.25)) {
    return { action: "call" };
  }
  if (toCall <= p.chips * 0.04 && strength > 0.2) {
    return { action: "call" };
  }
  return { action: "fold" };
}

const exportsObj = { decide, preflopStrength, postflopStrength };
if (typeof module !== "undefined" && module.exports) module.exports = exportsObj;
if (typeof window !== "undefined") window.PokerAI = exportsObj;
