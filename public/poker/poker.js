"use strict";

(() => {
  const E = window.PokerEngine;
  const AI = window.PokerAI;
  const SUITS = ["\u2660", "\u2665", "\u2666", "\u2663"];
  const RED_SUITS = new Set([1, 2]);
  const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const BETTING_PHASES = new Set(["preflop", "flop", "turn", "river"]);
  const HUMAN = 0;

  const els = {
    seats: document.getElementById("seats"),
    community: document.getElementById("community"),
    potAmount: document.getElementById("potAmount"),
    phaseLine: document.getElementById("phaseLine"),
    banner: document.getElementById("banner"),
    hintBox: document.getElementById("hintBox"),
    logBox: document.getElementById("logBox"),
    actionBar: document.getElementById("actionBar"),
    foldBtn: document.getElementById("foldBtn"),
    checkBtn: document.getElementById("checkBtn"),
    callBtn: document.getElementById("callBtn"),
    raiseBtn: document.getElementById("raiseBtn"),
    raiseSlider: document.getElementById("raiseSlider"),
    raiseAmount: document.getElementById("raiseAmount"),
    nextHandBtn: document.getElementById("nextHandBtn"),
    newGameBtn: document.getElementById("newGameBtn")
  };

  let game;
  let botTimer = null;

  function cardHTML(card, small = false) {
    if (!card) return `<div class="card back${small ? " small" : ""}"></div>`;
    const label = RANK_LABEL[card.rank] || String(card.rank);
    const suit = SUITS[card.suit];
    const red = RED_SUITS.has(card.suit) ? " red" : "";
    return `<div class="card${red}${small ? " small" : ""}"><span class="r">${label}</span><span class="s">${suit}</span></div>`;
  }

  function seatPos(i, total) {
    const spots = [
      { x: 50, y: 88 },
      { x: 16, y: 22 },
      { x: 50, y: 10 },
      { x: 84, y: 22 }
    ];
    return spots[i % Math.max(total, 1)] || { x: 50, y: 50 };
  }

  function render() {
    const st = game.publicState(HUMAN);

    els.seats.innerHTML = "";
    st.players.forEach(p => {
      const pos = seatPos(p.id, st.players.length);
      const div = document.createElement("div");
      div.className = "seat" +
        (p.id === st.toActIdx && BETTING_PHASES.has(st.phase) ? " active-turn" : "") +
        (p.folded && !p.out ? " folded" : "") +
        (p.out ? " out" : "");
      div.style.left = `${pos.x}%`;
      div.style.top = `${pos.y}%`;

      const holeCards = p.hole.length
        ? p.hole.map(c => cardHTML(c, p.id !== HUMAN)).join("")
        : p.id === HUMAN ? "" : `<div class="hole-cards">${cardHTML(null, true)}${cardHTML(null, true)}</div>`;

      div.innerHTML = `
        <div class="name-row">${escapeHtml(p.name)}
          ${p.id === st.dealerIdx ? '<span class="dealer-btn">D</span>' : ""}
        </div>
        <div class="chips-row">${p.chips} chips</div>
        ${p.bet > 0 ? `<span class="bet-chip">bet ${p.bet}</span>` : ""}
        <div class="hole-cards">${p.id === HUMAN ? p.hole.map(c => cardHTML(c)).join("") : holeCards}</div>`;
      els.seats.appendChild(div);
    });

    const slots = [];
    for (let i = 0; i < 5; i++) {
      slots.push(st.board[i] ? cardHTML(st.board[i]) : '<div class="slot"></div>');
    }
    els.community.innerHTML = slots.join("");
    els.potAmount.textContent = st.pot;
    els.phaseLine.textContent =
      st.phase === "payout" ? "Showdown" :
      st.phase === "gameover" ? "Game over" :
      st.phase === "idle" ? "Waiting" : st.phase;

    renderLog(st.log);
    renderActions(st);
    renderBanner(st);
    renderHint(st);
  }

  function renderLog(lines) {
    els.logBox.innerHTML = lines
      .map(l => l.startsWith("---") ? `<div class="new-hand">${escapeHtml(l)}</div>` : escapeHtml(l))
      .join("<br>");
    els.logBox.scrollTop = els.logBox.scrollHeight;
  }

  function renderActions(st) {
    const legal = st.legal;
    const myTurn = legal && st.toActIdx === HUMAN && BETTING_PHASES.has(st.phase);
    els.actionBar.style.display = myTurn ? "flex" : "none";
    if (!myTurn) return;

    els.foldBtn.disabled = false;
    els.checkBtn.disabled = !legal.canCheck;
    els.callBtn.disabled = !legal.canCall;
    els.callBtn.textContent = legal.canCall
      ? `Call ${legal.callAmount}${legal.callAmount >= playerChips() ? " (all-in)" : ""}`
      : "Call";
    els.raiseBtn.disabled = !legal.canRaise;
    els.raiseSlider.min = legal.minRaiseTo;
    els.raiseSlider.max = legal.maxRaiseTo;
    if (+els.raiseSlider.value < legal.minRaiseTo || +els.raiseSlider.value > legal.maxRaiseTo) {
      els.raiseSlider.value = clampRaiseTarget(st, legal.minRaiseTo);
    }
    els.raiseAmount.textContent = `to ${els.raiseSlider.value}`;
  }

  function playerChips() {
    return game.players[HUMAN].chips;
  }

  function clampRaiseTarget(st, fallback) {
    const potNow = st.pot;
    const target = Math.round(game.currentBet + potNow * 0.66);
    return Math.max(fallback, Math.min(target, +els.raiseSlider.max));
  }

  function renderBanner(st) {
    if (!st.lastResult) {
      els.banner.classList.add("hidden");
      return;
    }
    const r = st.lastResult;
    const lines = r.winners
      .map(w => `${escapeHtml(w.player)} wins ${Math.round(w.amount)} with ${w.hand}`)
      .join("<br>");
    els.banner.innerHTML = `
      <div class="title">${st.phase === "gameover" ? "Game over" : "Hand complete"}</div>
      <div class="sub">${lines}</div>
      ${st.phase === "gameover"
        ? '<button class="btn" id="restartBtn" style="margin-top:12px">Play again</button>'
        : ""}`;
    els.banner.classList.remove("hidden");
    const restart = document.getElementById("restartBtn");
    if (restart) restart.addEventListener("click", newGame);
  }

  function renderHint(st) {
    const me = game.players[HUMAN];
    if (me.out) {
      els.hintBox.innerHTML = "<strong>Busted.</strong> Start a new game to rebuy the table.";
      return;
    }
    if (me.folded) {
      els.hintBox.innerHTML = "<strong>You folded this hand.</strong> Watch the bots battle it out.";
      return;
    }
    let handDesc;
    if (me.hole.length === 2) {
      if (game.board.length >= 3) {
        handDesc = E.handName(E.evaluate7([...me.hole, ...game.board]));
      } else {
        const [a, b] = [...me.hole].sort((x, y) => y.rank - x.rank);
        const lbl = r => RANK_LABEL[r] || r;
        handDesc = a.rank === b.rank
          ? `Pocket ${lbl(a.rank)}s`
          : `${lbl(a.rank)}-${lbl(b.rank)}${a.suit === b.suit ? " suited" : " offsuit"}`;
      }
    } else {
      handDesc = "waiting for cards";
    }
    const turnNote = st.toActIdx === HUMAN && BETTING_PHASES.has(st.phase)
      ? " Your turn &mdash; act below."
      : "";
    els.hintBox.innerHTML = `<strong>Your best hand:</strong> ${handDesc}.${turnNote}`;
  }

  function scheduleBots() {
    clearTimeout(botTimer);
    const st = game.publicState();
    if (!BETTING_PHASES.has(st.phase)) return;
    if (st.toActIdx === HUMAN) return;
    botTimer = setTimeout(() => {
      const idx = game.toActIdx;
      try {
        const d = AI.decide(game, idx);
        if (d) game.act(idx, d.action, d.amount ?? 0);
      } catch {
        try { game.act(idx, "check"); } catch { game.act(idx, "fold"); }
      }
      render();
      scheduleBots();
    }, 750);
  }

  function humanAct(action) {
    clearTimeout(botTimer);
    try {
      game.act(HUMAN, action, +els.raiseSlider.value);
    } catch (err) {
      addClientLog(err.message);
    }
    render();
    scheduleBots();
  }

  function addClientLog(msg) {
    console.warn(msg);
  }

  function newGame() {
    clearTimeout(botTimer);
    game = new E.Game({
      playerNames: ["You", "Ada", "Bo", "Cy"],
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20
    });
    game.startHand();
    render();
    scheduleBots();
  }

  function nextHand() {
    clearTimeout(botTimer);
    if (game.phase === "gameover") {
      newGame();
      return;
    }
    game.startHand();
    render();
    scheduleBots();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  els.foldBtn.addEventListener("click", () => humanAct("fold"));
  els.checkBtn.addEventListener("click", () => humanAct("check"));
  els.callBtn.addEventListener("click", () => humanAct("call"));
  els.raiseBtn.addEventListener("click", () => humanAct("raise"));
  els.raiseSlider.addEventListener("input", () => {
    els.raiseAmount.textContent = `to ${els.raiseSlider.value}`;
  });
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const legal = game.legalActions(HUMAN);
      if (!legal) return;
      const potNow = game.pot + game.players.reduce((s, p) => s + p.bet, 0);
      let v;
      switch (btn.dataset.quick) {
        case "min": v = legal.minRaiseTo; break;
        case "half": v = game.currentBet + Math.round(potNow * 0.5); break;
        case "pot": v = game.currentBet + potNow; break;
        default: v = legal.maxRaiseTo;
      }
      els.raiseSlider.value = Math.max(legal.minRaiseTo, Math.min(v, legal.maxRaiseTo));
      els.raiseAmount.textContent = `to ${els.raiseSlider.value}`;
    });
  });
  els.nextHandBtn.addEventListener("click", nextHand);
  els.newGameBtn.addEventListener("click", newGame);

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".tab-page").forEach(p =>
        p.classList.toggle("active", p.id === `tab-${tab.dataset.tab}`));
    });
  });

  const QUIZ = [
    {
      q: "Which hand is stronger?",
      opts: ["A straight (10-9-8-7-6)", "A flush (any five of one suit)", "They tie"], answer: 1,
      why: "A flush beats a straight."
    },
    {
      q: "Who posts the big blind?",
      opts: ["The dealer", "The player two seats left of the dealer", "The winner of the last hand"], answer: 1,
      why: "Small blind is immediately left of the button; big blind is left of that."
    },
    {
      q: "Nobody has bet yet and it is your turn. What can you do?",
      opts: ["Only fold or raise", "Check or bet (raise)", "Only go all-in"], answer: 1,
      why: "With no bet facing you, checking passes or betting starts the action."
    },
    {
      q: "You hold two spades and the flop brings two more spades. What do you have?",
      opts: ["A flush", "A flush draw", "Nothing"], answer: 1,
      why: "Four spades is a draw: one more spade on the turn or river completes it."
    },
    {
      q: "At showdown, how many cards form your final hand?",
      opts: ["Exactly your two hole cards plus three from the board", "The best five of the seven available", "All seven"], answer: 1,
      why: "You may use both, one, or neither of your hole cards as long as the best five-card hand results."
    }
  ];

  const quizBox = document.getElementById("quizBox");
  const quizScore = document.getElementById("quizScore");
  let answered = 0;
  let correct = 0;

  QUIZ.forEach((item, qi) => {
    const div = document.createElement("div");
    div.className = "quiz-q";
    div.innerHTML = `<p><strong>${qi + 1}.</strong> ${item.q}</p>`;
    item.opts.forEach((opt, oi) => {
      const b = document.createElement("button");
      b.className = "quiz-opt";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (div.dataset.done) return;
        div.dataset.done = "1";
        answered++;
        if (oi === item.answer) {
          b.classList.add("correct");
          correct++;
        } else {
          b.classList.add("wrong");
          div.querySelectorAll(".quiz-opt")[item.answer].classList.add("correct");
        }
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = item.why;
        div.appendChild(note);
        quizScore.textContent = `Score: ${correct} / ${answered}`;
      });
      div.appendChild(b);
    });
    quizBox.appendChild(div);
  });

  newGame();
})();
