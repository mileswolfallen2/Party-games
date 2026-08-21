"use strict";

const RANKS = "23456789TJQKA";
const CATEGORY_NAMES = [
  "High Card", "Pair", "Two Pair", "Three of a Kind", "Straight",
  "Flush", "Full House", "Four of a Kind", "Straight Flush"
];

function makeDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 2; r <= 14; r++) {
      deck.push({ rank: r, suit: s });
    }
  }
  return deck;
}

function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function evaluate5(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const flush = cards.every(c => c.suit === cards[0].suit);
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let straightHigh = 0;
  const uniq = [...new Set(ranks)];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }

  if (flush && straightHigh) return { category: 8, tiebreak: [straightHigh] };
  if (groups[0][1] === 4) return { category: 7, tiebreak: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { category: 6, tiebreak: [groups[0][0], groups[1][0]] };
  if (flush) return { category: 5, tiebreak: ranks };
  if (straightHigh) return { category: 4, tiebreak: [straightHigh] };
  if (groups[0][1] === 3) return { category: 3, tiebreak: [groups[0][0], ...groups.slice(1).map(g => g[0])] };
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return { category: 2, tiebreak: [groups[0][0], groups[1][0], groups[2][0]] };
  }
  if (groups[0][1] === 2) return { category: 1, tiebreak: [groups[0][0], ...groups.slice(1).map(g => g[0])] };
  return { category: 0, tiebreak: ranks };
}

function cmpEval(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const tA = a.tiebreak, tB = b.tiebreak;
  for (let i = 0; i < Math.min(tA.length, tB.length); i++) {
    if (tA[i] !== tB[i]) return tA[i] - tB[i];
  }
  return 0;
}

const COMBO_CACHE = {};

function combos(n, k) {
  const key = `${n}:${k}`;
  if (COMBO_CACHE[key]) return COMBO_CACHE[key];
  const out = [];
  const idx = [];
  const rec = start => {
    if (idx.length === k) {
      out.push(idx.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      idx.push(i);
      rec(i + 1);
      idx.pop();
    }
  };
  rec(0);
  COMBO_CACHE[key] = out;
  return out;
}

function evaluateBest(cards) {
  let best = null;
  for (const idx of combos(cards.length, 5)) {
    const ev = evaluate5([cards[idx[0]], cards[idx[1]], cards[idx[2]], cards[idx[3]], cards[idx[4]]]);
    if (!best || cmpEval(ev, best) > 0) best = ev;
  }
  return best;
}

const evaluate7 = evaluateBest;

function rankLabel(r) {
  if (r === 14) return "Ace";
  if (r === 13) return "King";
  if (r === 12) return "Queen";
  if (r === 11) return "Jack";
  return String(r);
}
function rankLabelPlural(r) {
  return r === 6 ? "Sixes" : rankLabel(r) + "s";
}

function handName(ev) {
  const t = ev.tiebreak;
  switch (ev.category) {
    case 8: return t[0] === 14 ? "Royal Flush" : `Straight Flush, ${rankLabel(t[0])} high`;
    case 7: return `Four of a Kind, ${rankLabelPlural(t[0])}`;
    case 6: return `Full House, ${rankLabelPlural(t[0])} full of ${rankLabelPlural(t[1])}`;
    case 5: return `Flush, ${rankLabel(t[0])} high`;
    case 4: return `Straight, ${rankLabel(t[0])} high`;
    case 3: return `Three of a Kind, ${rankLabelPlural(t[0])}`;
    case 2: return `Two Pair, ${rankLabelPlural(t[0])} and ${rankLabelPlural(t[1])}`;
    case 1: return `Pair of ${rankLabelPlural(t[0])}`;
    default: return `${rankLabel(t[0])} High`;
  }
}

class Game {
  constructor({ playerNames, startingChips = 1000, smallBlind = 10, bigBlind = 20, rng = Math.random }) {
    this.rng = rng;
    this.sbAmount = smallBlind;
    this.bbAmount = bigBlind;
    this.players = playerNames.map((name, id) => ({
      id, name, chips: startingChips, hole: [], folded: false, allIn: false,
      bet: 0, totalBet: 0, acted: false, out: false
    }));
    this.dealerIdx = this.players.length - 1;
    this.deck = [];
    this.board = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = bigBlind;
    this.phase = "idle";
    this.toActIdx = -1;
    this.log = [];
    this.lastResult = null;
  }

  get activePlayers() {
    return this.players.filter(p => !p.out);
  }
  get livePlayers() {
    return this.activePlayers.filter(p => !p.folded);
  }
  get canActPlayers() {
    return this.livePlayers.filter(p => !p.allIn && p.chips > 0);
  }
  get isHeadsUp() {
    return this.activePlayers.length === 2;
  }

  nextSeat(from, filter = p => !p.out) {
    const n = this.players.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + step) % n;
      if (filter(this.players[i])) return i;
    }
    return -1;
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 200) this.log.shift();
  }

  postBet(p, amount) {
    const real = Math.min(amount, p.chips);
    p.chips -= real;
    p.bet += real;
    p.totalBet += real;
    if (p.chips === 0 && real > 0) p.allIn = true;
    return real;
  }

  startHand() {
    const alive = this.activePlayers;
    if (alive.length < 2) {
      this.phase = "gameover";
      return;
    }
    for (const p of this.players) {
      p.hole = [];
      p.folded = p.out;
      p.allIn = false;
      p.bet = 0;
      p.totalBet = 0;
      p.acted = false;
    }
    this.board = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = this.bbAmount;
    this.lastResult = null;
    this.deck = shuffle(makeDeck(), this.rng);
    this.dealerIdx = this.nextSeat(this.dealerIdx);

    const sbIdx = this.isHeadsUp ? this.dealerIdx : this.nextSeat(this.dealerIdx);
    const bbIdx = this.nextSeat(sbIdx);
    this.addLog(`--- New hand. Dealer: ${this.players[this.dealerIdx].name} ---`);
    this.postBet(this.players[sbIdx], this.sbAmount);
    this.postBet(this.players[bbIdx], this.bbAmount);
    this.currentBet = Math.max(this.players[sbIdx].bet, this.players[bbIdx].bet, this.bbAmount);
    this.minRaise = this.bbAmount;

    for (let round = 0; round < 2; round++) {
      let i = sbIdx;
      for (let k = 0; k < alive.length; k++) {
        const p = this.players[i];
        if (!p.out) p.hole.push(this.deck.pop());
        i = this.nextSeat(i);
      }
    }

    this.phase = "preflop";
    this.toActIdx = this.isHeadsUp ? sbIdx : this.nextSeat(bbIdx);
    this.advanceIfNeeded();
  }

  needsAction(p) {
    return !p.out && !p.folded && !p.allIn && p.chips > 0 && (!p.acted || p.bet < this.currentBet);
  }

  advanceIfNeeded() {
    if (this.livePlayers.length <= 1) {
      this.finishByFold();
      return;
    }
    if (!this.players.some(q => this.needsAction(q))) {
      this.endStreet();
    }
  }

  legalActions(pid) {
    const p = this.players[pid];
    if (pid !== this.toActIdx || !this.needsAction(p)) return null;
    const toCall = Math.max(0, this.currentBet - p.bet);
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && p.chips > 0;
    const callAmount = Math.min(toCall, p.chips);
    const minRaiseTo = Math.min(p.bet + p.chips, this.currentBet + this.minRaise);
    const maxRaiseTo = p.bet + p.chips;
    const canRaise = maxRaiseTo > this.currentBet;
    return { toCall, canCheck, canCall, callAmount, canRaise, minRaiseTo, maxRaiseTo };
  }

  act(pid, action, raiseTo = 0) {
    const p = this.players[pid];
    const legal = this.legalActions(pid);
    if (!legal) throw new Error(`not ${p.name}'s turn or no action available`);
    if (action === "fold") {
      p.folded = true;
      p.acted = true;
      this.addLog(`${p.name} folds`);
    } else if (action === "check") {
      if (!legal.canCheck) throw new Error("cannot check");
      p.acted = true;
      this.addLog(`${p.name} checks`);
    } else if (action === "call") {
      if (!legal.canCall) throw new Error("cannot call");
      const paid = this.postBet(p, legal.callAmount);
      p.acted = true;
      this.addLog(`${p.name} calls ${paid}${p.allIn ? " (all-in)" : ""}`);
    } else if (action === "raise") {
      if (!legal.canRaise) throw new Error("cannot raise");
      let target = Math.min(raiseTo, legal.maxRaiseTo);
      if (target < legal.maxRaiseTo && target < this.currentBet + this.minRaise) {
        target = Math.min(legal.minRaiseTo, legal.maxRaiseTo);
      }
      const prevBet = this.currentBet;
      const paid = this.postBet(p, target - p.bet);
      const newBet = p.bet;
      if (newBet > prevBet) {
        this.minRaise = Math.max(this.bbAmount, newBet - prevBet);
        this.currentBet = newBet;
        for (const q of this.players) if (q !== p && !q.out && !q.folded && !q.allIn) q.acted = false;
      }
      p.acted = true;
      this.addLog(`${p.name} raises to ${newBet}${p.allIn ? " (all-in)" : ""}`);
    } else {
      throw new Error(`unknown action ${action}`);
    }

    if (this.livePlayers.length <= 1) {
      this.finishByFold();
      return;
    }
    const nxt = this.nextSeat(this.toActIdx, q => this.needsAction(q));
    if (nxt === -1) {
      this.endStreet();
    } else {
      this.toActIdx = nxt;
    }
  }

  endStreet() {
    for (const p of this.players) {
      this.pot += p.bet;
      p.bet = 0;
      p.acted = false;
    }
    this.currentBet = 0;
    this.minRaise = this.bbAmount;

    if (this.phase === "preflop") {
      this.dealBoard(3);
      this.phase = "flop";
    } else if (this.phase === "flop") {
      this.dealBoard(1);
      this.phase = "turn";
    } else if (this.phase === "turn") {
      this.dealBoard(1);
      this.phase = "river";
    } else if (this.phase === "river") {
      this.showdown();
      return;
    }

    if (this.canActPlayers.length <= 1) {
      while ((this.phase === "flop" || this.phase === "turn") && this.board.length < 5) {
        this.dealBoard(this.phase === "flop" ? 2 : 1);
        this.phase = this.phase === "flop" ? "turn" : "river";
      }
      if (this.phase === "river" || this.board.length === 5) {
        this.showdown();
        return;
      }
    }

    this.toActIdx = this.nextSeat(this.dealerIdx, q => this.needsAction(q));
    if (this.toActIdx === -1) {
      this.endStreet();
    } else {
      this.addLog(`Board: ${this.board.map(cardStr).join(" ")}`);
    }
  }

  dealBoard(count) {
    if (this.board.length === 0 && count === 3) this.addLog("Flop dealt");
    else if (count === 1 && this.board.length === 4) this.addLog("Turn dealt");
    else if (count === 1 && this.board.length === 5) this.addLog("River dealt");
    for (let i = 0; i < count && this.deck.length; i++) this.board.push(this.deck.pop());
  }

  refundExcess() {
    for (;;) {
      const totals = this.players.filter(p => p.totalBet > 0).map(p => p.totalBet);
      if (totals.length < 2) return;
      const maxT = Math.max(...totals);
      const atMax = this.players.filter(p => p.totalBet === maxT);
      if (atMax.length === 1 && !atMax[0].folded) {
        const second = Math.max(...totals.filter(t => t < maxT), 0);
        if (second >= maxT) return;
        const refund = maxT - second;
        atMax[0].chips += refund;
        atMax[0].totalBet -= refund;
        atMax[0].bet -= refund;
        this.addLog(`${refund} uncalled returned to ${atMax[0].name}`);
        continue;
      }
      return;
    }
  }

  finishByFold() {
    this.refundExcess();
    for (const p of this.players) {
      this.pot += p.bet;
      p.bet = 0;
    }
    const winner = this.livePlayers[0];
    winner.chips += this.pot;
    this.addLog(`${winner.name} wins ${this.pot} uncontested`);
    this.lastResult = {
      winners: [{ player: winner.name, amount: this.pot, hand: "everyone folded" }],
      pots: [{ amount: this.pot, winners: [winner.name] }]
    };
    this.pot = 0;
    this.phase = "payout";
  }

  showdown() {
    this.refundExcess();
    for (const p of this.players) {
      this.pot += p.bet;
      p.bet = 0;
    }
    const contenders = this.livePlayers.slice();
    const evals = new Map();
    for (const p of contenders) {
      evals.set(p, evaluate7([...p.hole, ...this.board]));
      this.addLog(`${p.name} shows ${p.hole.map(cardStr).join(" ")} (${handName(evals.get(p))})`);
    }

    const contribs = this.players
      .filter(p => p.totalBet > 0)
      .map(p => ({ p, amt: p.totalBet }));
    const levels = [...new Set(contribs.map(c => c.amt))].sort((a, b) => a - b);
    const results = [];
    let prev = 0;
    for (const level of levels) {
      let potAmt = 0;
      for (const { p, amt } of contribs) potAmt += Math.max(0, Math.min(amt, level) - prev);
      const eligible = contenders.filter(p => p.totalBet >= level);
      if (!eligible.length || potAmt === 0) {
        prev = level;
        continue;
      }
      eligible.sort((a, b) => cmpEval(evals.get(b), evals.get(a)));
      const best = evals.get(eligible[0]);
      const winners = eligible.filter(p => cmpEval(evals.get(p), best) === 0);
      const share = Math.floor(potAmt / winners.length);
      let remainder = potAmt - share * winners.length;
      const ordered = [];
      let seat = this.nextSeat(this.dealerIdx, q => true);
      for (let k = 0; k < this.players.length && ordered.length < winners.length; k++) {
        if (winners.includes(this.players[seat])) ordered.push(this.players[seat]);
        seat = (seat + 1) % this.players.length;
      }
      const winNames = [];
      for (const wp of ordered) {
        const got = share + (remainder-- > 0 ? 1 : 0);
        wp.chips += got;
        winNames.push(wp.name);
      }
      results.push({
        amount: potAmt,
        winners: winNames,
        hand: handName(best),
        label: levels.length > 1 ? (prev === 0 ? "Main pot" : "Side pot") : "Pot"
      });
      prev = level;
    }

    for (const r of results) {
      this.addLog(`${r.label} (${r.amount}) -> ${r.winners.join(", ")} with ${r.hand}`);
    }
    this.lastResult = { winners: results.flatMap(r => r.winners.map(w => ({ player: w, amount: r.amount / r.winners.length, hand: r.hand }))), pots: results };
    this.pot = 0;
    this.phase = "payout";

    for (const p of this.players) {
      if (!p.out && p.chips <= 0) {
        p.out = true;
        this.addLog(`${p.name} is busted`);
      }
    }
    if (this.activePlayers.length <= 1) {
      this.phase = "gameover";
      this.addLog(`${this.activePlayers[0]?.name ?? "Nobody"} wins the game!`);
    }
  }

  publicState(forPid = null) {
    return {
      phase: this.phase,
      board: this.board,
      pot: this.pot + this.players.reduce((s, p) => s + p.bet, 0),
      currentBet: this.currentBet,
      dealerIdx: this.dealerIdx,
      toActIdx: this.toActIdx,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        out: p.out,
        holeCount: p.hole.length,
        hole: p.id === forPid || (this.phase === "payout" || this.phase === "gameover") ? p.hole : []
      })),
      legal: forPid != null ? this.legalActions(forPid) : null,
      log: this.log.slice(-40),
      lastResult: this.lastResult
    };
  }
}

function cardStr(c) {
  const suits = ["\u2660", "\u2665", "\u2666", "\u2663"];
  return RANKS[c.rank - 2] + suits[c.suit];
}

const exportsObj = {
  RANKS, makeDeck, shuffle, evaluate5, evaluate7, cmpEval, handName, Game, cardStr
};
if (typeof module !== "undefined" && module.exports) module.exports = exportsObj;
if (typeof window !== "undefined") window.PokerEngine = exportsObj;
