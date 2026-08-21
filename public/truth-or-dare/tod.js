"use strict";

const state = {
  players: [],
  spice: "spicy",
  rotation: 0,
  spinning: false,
  victim: null,
  used: new Set(),
  stats: { spins: 0, passes: 0 }
};

const $ = id => document.getElementById(id);
const SEG_COLORS = ["#2b3358", "#3a2f5e", "#274a52", "#4a2f47", "#2f4560", "#443a63"];

function renderPlayers() {
  const box = $("playerRows");
  box.innerHTML = "";
  state.players.forEach((name, i) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = name;
    input.placeholder = `Player ${i + 1}`;
    input.maxLength = 16;
    input.addEventListener("input", () => { state.players[i] = input.value; });
    row.appendChild(input);
    if (state.players.length > 2) {
      const rm = document.createElement("button");
      rm.className = "remove";
      rm.textContent = "\u00d7";
      rm.addEventListener("click", () => {
        state.players.splice(i, 1);
        renderPlayers();
      });
      row.appendChild(rm);
    }
    box.appendChild(row);
  });
}

function renderSpice() {
  const picker = $("spicePicker");
  picker.innerHTML = "";
  [["mild", "Mild"], ["spicy", "Spicy"], ["wild", "Wild"]].forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.className = `chip-btn ${key}` + (state.spice === key ? ` selected ${key}` : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.spice = key;
      renderSpice();
    });
    picker.appendChild(btn);
  });
}

function buildWheel() {
  const wheel = $("wheel");
  wheel.innerHTML = "";
  const n = state.players.length;
  const seg = 360 / n;
  const r = 50;
  const gradientParts = [];
  for (let i = 0; i < n; i++) {
    const from = i * seg;
    const to = (i + 1) * seg;
    gradientParts.push(`${SEG_COLORS[i % SEG_COLORS.length]} ${from}deg ${to}deg`);
  }
  wheel.style.background = `conic-gradient(${gradientParts.join(", ")})`;

  for (let i = 0; i < n; i++) {
    const mid = i * seg + seg / 2;
    const label = document.createElement("div");
    label.className = "wheel-label";
    label.style.transform = `rotate(${mid}deg) translate(${r}%) rotate(90deg)`;
    label.style.transformOrigin = "0 0";
    label.style.marginLeft = "-40px";
    label.textContent = state.players[i];
    wheel.appendChild(label);
  }
}

function pickPrompt(type) {
  const bank = type === "truth" ? TRUTHS : DARES;
  const pool = bank[state.spice];
  const fresh = pool.filter(p => !state.used.has(p));
  const source = fresh.length ? fresh : [...pool];
  if (!fresh.length) {
    for (const p of pool) state.used.delete(p);
  }
  const pick = source[Math.floor(Math.random() * source.length)];
  state.used.add(pick);
  return pick;
}

function spin() {
  if (state.spinning || !$("promptCard").classList.contains("hidden")) return;
  state.spinning = true;
  $("victimLine").textContent = "Spinning...";
  $("fateButtons").classList.add("hidden");
  $("promptCard").classList.add("hidden");

  const n = state.players.length;
  const idx = Math.floor(Math.random() * n);
  const seg = 360 / n;

  const targetCenter = idx * seg + seg / 2;
  const jitter = (Math.random() - 0.5) * seg * 0.55;
  const pointerAt = 360 - (targetCenter + jitter);
  const turns = 5 + Math.floor(Math.random() * 3);
  state.rotation += turns * 360 + ((pointerAt - (state.rotation % 360)) + 360) % 360;

  const wheel = $("wheel");
  wheel.style.transform = `rotate(${state.rotation}deg)`;

  setTimeout(() => {
    state.victim = state.players[idx];
    state.stats.spins++;
    $("victimLine").innerHTML = `The wheel chose <span class="name">${escapeHtml(state.victim)}</span>`;
    $("fateButtons").classList.remove("hidden");
    state.spinning = false;
    updateStats();
  }, 4350);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function revealPrompt(type) {
  const card = $("promptCard");
  card.classList.remove("hidden", "truth-mode", "dare-mode");
  card.classList.add(type === "truth" ? "truth-mode" : "dare-mode");
  $("promptKind").textContent =
    `${type === "truth" ? "Truth" : "Dare"} \u00b7 ${state.spice} \u00b7 for ${state.victim}`;
  $("promptText").textContent = pickPrompt(type);
  $("fateButtons").classList.add("hidden");
}

function closePrompt(passed) {
  if (passed) state.stats.passes++;
  $("promptCard").classList.add("hidden");
  $("victimLine").textContent = "Spin the wheel";
  updateStats();
}

function updateStats() {
  $("statLine").textContent =
    `${state.stats.spins} spins \u00b7 ${state.stats.passes} passes \u00b7 spice: ${state.spice}`;
}

$("addPlayer").addEventListener("click", () => {
  if (state.players.length >= 12) return;
  state.players.push(`Player ${state.players.length + 1}`);
  renderPlayers();
});

$("startBtn").addEventListener("click", () => {
  state.players = state.players.map(n => n.trim() || "Player");
  buildWheel();
  updateStats();
  $("setupScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
});

$("wheel").parentElement.addEventListener("click", spin);

$("truthBtn").addEventListener("click", () => revealPrompt("truth"));
$("dareBtn").addEventListener("click", () => revealPrompt("dare"));
$("doneBtn").addEventListener("click", () => closePrompt(false));
$("passBtn").addEventListener("click", () => closePrompt(true));

$("backBtn").addEventListener("click", () => {
  $("gameScreen").classList.add("hidden");
  $("setupScreen").classList.remove("hidden");
});

state.players = ["Alex", "Sam"];
renderPlayers();
renderSpice();
