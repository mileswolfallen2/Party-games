"use strict";

const state = {
  left: "Player 1",
  right: "Player 2",
  bestOf: 5,
  winsL: 0,
  winsR: 0,
  round: 1,
  phase: "idle",
  goTime: 0,
  armTimer: null,
  settleTimer: null
};

const $ = id => document.getElementById(id);
const targetWins = () => Math.ceil(state.bestOf / 2);

function renderRounds() {
  const picker = $("roundPicker");
  picker.innerHTML = "";
  [3, 5, 7].forEach(n => {
    const btn = document.createElement("button");
    btn.className = "chip-btn" + (state.bestOf === n ? " selected" : "");
    btn.textContent = `Best of ${n}`;
    btn.addEventListener("click", () => {
      state.bestOf = n;
      renderRounds();
    });
    picker.appendChild(btn);
  });
}

function renderPips() {
  const box = $("pips");
  box.innerHTML = "";
  for (let i = 0; i < state.bestOf; i++) {
    const pip = document.createElement("div");
    pip.className = "pip";
    if (i < state.winsL) pip.classList.add("l-won");
    else if (i < state.winsR) pip.classList.add("r-won");
    box.appendChild(pip);
  }
}

function updateScoreboard() {
  $("sbLeft").textContent = state.left;
  $("sbRight").textContent = state.right;
  $("sbLeftPts").textContent = state.winsL;
  $("sbRightPts").textContent = state.winsR;
}

function setMsgs(left, right) {
  $("msgLeft").textContent = left;
  $("msgRight").textContent = right;
}

function armRound() {
  state.phase = "waiting";
  const stage = $("stage");
  stage.classList.remove("go");
  stage.classList.add("waiting");
  $("msLeft").textContent = "";
  $("msRight").textContent = "";
  setMsgs("Wait for green...", "Wait for green...");
  $("statusLine").textContent = `Round ${state.round} \u2014 hands off until green!`;

  clearTimeout(state.armTimer);
  state.armTimer = setTimeout(() => {
    state.phase = "go";
    state.goTime = performance.now();
    stage.classList.remove("waiting");
    stage.classList.add("go");
    setMsgs("TAP!", "TAP!");
  }, 1200 + Math.random() * 2600);
}

function flashWinner(side, note) {
  const el = side === "left" ? $("halfLeft") : $("halfRight");
  el.classList.add("winner-flash");
  setTimeout(() => el.classList.remove("winner-flash"), 720);
  void note;
}

function endRound(winnerSide, reason, msText) {
  state.phase = "settled";
  clearTimeout(state.armTimer);

  if (winnerSide === "left") state.winsL++;
  else state.winsR++;

  const winnerName = winnerSide === "left" ? state.left : state.right;
  const loserMsg = reason === "foul" ? "Too early!" : "Slow!";
  if (winnerSide === "left") {
    $("msgLeft").textContent = "You win!";
    $("msgRight").textContent = loserMsg;
    $("msLeft").textContent = msText || "";
  } else {
    $("msgRight").textContent = "You win!";
    $("msgLeft").textContent = loserMsg;
    $("msRight").textContent = msText || "";
  }
  flashWinner(winnerSide);

  updateScoreboard();
  renderPips();

  if (state.winsL >= targetWins() || state.winsR >= targetWins()) {
    const champ = state.winsL > state.winsR ? state.left : state.right;
    $("statusLine").textContent = "";
    const banner = document.createElement("div");
    banner.className = "banner";
    banner.textContent = `${champ} wins the duel!`;
    $("statusLine").replaceWith(banner);
    banner.id = "statusLine";
    $("resultActions").classList.remove("hidden");
  } else {
    $("statusLine").textContent =
      `${winnerName} takes round ${state.round}. Next round starting...`;
    state.round++;
    state.settleTimer = setTimeout(armRound, 1900);
  }
}

function tap(side) {
  if (state.phase === "waiting") {
    endRound(side === "left" ? "right" : "left", "foul", "");
    return;
  }
  if (state.phase !== "go") return;

  const ms = Math.round(performance.now() - state.goTime);
  const other = side === "left" ? "right" : "left";
  endRound(side, "tap", `${ms} ms`);
  void other;
}

function resetMatch() {
  state.winsL = 0;
  state.winsR = 0;
  state.round = 1;
  state.phase = "idle";
  clearTimeout(state.armTimer);
  clearTimeout(state.settleTimer);
  const oldBanner = document.querySelector(".banner");
  if (oldBanner && oldBanner.id === "statusLine") {
    const line = document.createElement("div");
    line.className = "status-line";
    line.id = "statusLine";
    oldBanner.replaceWith(line);
  }
  $("resultActions").classList.add("hidden");
  updateScoreboard();
  renderPips();
  armRound();
}

$("startBtn").addEventListener("click", () => {
  state.left = $("leftName").value.trim() || "Player 1";
  state.right = $("rightName").value.trim() || "Player 2";
  $("whoLeft").textContent = state.left;
  $("whoRight").textContent = state.right;
  $("setupScreen").classList.add("hidden");
  $("duelScreen").classList.remove("hidden");
  resetMatch();
});

$("halfLeft").addEventListener("pointerdown", e => { e.preventDefault(); tap("left"); });
$("halfRight").addEventListener("pointerdown", e => { e.preventDefault(); tap("right"); });

$("rematchBtn").addEventListener("click", resetMatch);

$("newSetupBtn").addEventListener("click", () => {
  clearTimeout(state.armTimer);
  clearTimeout(state.settleTimer);
  $("duelScreen").classList.add("hidden");
  $("setupScreen").classList.remove("hidden");
});

renderRounds();
