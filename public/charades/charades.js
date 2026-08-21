"use strict";

const state = {
  teams: [],
  decks: new Set(["animals", "actions"]),
  seconds: 60,
  teamIdx: 0,
  queue: [],
  roundHits: [],
  roundMissed: [],
  timerId: null,
  timeLeft: 0,
  locked: false
};

const $ = id => document.getElementById(id);

function renderTeamRows() {
  const box = $("teamRows");
  box.innerHTML = "";
  state.teams.forEach((name, i) => {
    const row = document.createElement("div");
    row.className = "team-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = name;
    input.placeholder = `Team ${i + 1} name`;
    input.maxLength = 18;
    input.addEventListener("input", () => { state.teams[i] = input.value; });
    row.appendChild(input);
    if (state.teams.length > 1) {
      const rm = document.createElement("button");
      rm.className = "remove";
      rm.textContent = "\u00d7";
      rm.title = "Remove team";
      rm.addEventListener("click", () => {
        state.teams.splice(i, 1);
        renderTeamRows();
      });
      row.appendChild(rm);
    }
    box.appendChild(row);
  });
}

function renderDecks() {
  const picker = $("deckPicker");
  picker.innerHTML = "";
  Object.entries(DECKS).forEach(([key, deck]) => {
    const btn = document.createElement("button");
    btn.className = "deck-chip" + (state.decks.has(key) ? " selected" : "");
    btn.textContent = `${deck.label} (${deck.words.length})`;
    btn.addEventListener("click", () => {
      if (state.decks.has(key)) {
        if (state.decks.size > 1) state.decks.delete(key);
      } else {
        state.decks.add(key);
      }
      renderDecks();
    });
    picker.appendChild(btn);
  });
}

function renderTimes() {
  const picker = $("timePicker");
  picker.innerHTML = "";
  [30, 60, 90].forEach(sec => {
    const btn = document.createElement("button");
    btn.className = "chip-btn" + (state.seconds === sec ? " selected" : "");
    btn.textContent = sec + "s";
    btn.addEventListener("click", () => {
      state.seconds = sec;
      renderTimes();
    });
    picker.appendChild(btn);
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function refillQueue() {
  let pool = [];
  for (const key of state.decks) pool = pool.concat(DECKS[key].words);
  state.queue = shuffle(pool);
}

function nextWord() {
  if (!state.queue.length) refillQueue();
  $("wordText").textContent = state.queue.pop();
}

function show(screen) {
  ["setupScreen", "playScreen", "recapScreen", "finalScreen"].forEach(id => {
    $(id).classList.toggle("hidden", id !== screen);
  });
}

function updateHud() {
  const team = state.teams[state.teamIdx];
  $("hudTeam").textContent = team;
  $("hudScore").textContent = `score ${team.score}`;
}

function endRound() {
  clearInterval(state.timerId);
  const team = state.teams[state.teamIdx];
  team.score += state.roundHits.length;

  $("recapTitle").textContent = `${team} \u2014 ${state.roundHits.length} guessed`;
  const list = $("recapList");
  list.innerHTML = "";
  for (const w of state.roundHits) {
    const li = document.createElement("li");
    li.className = "hit";
    li.textContent = w;
    list.appendChild(li);
  }
  for (const w of state.roundMissed) {
    const li = document.createElement("li");
    li.className = "missed";
    li.textContent = w;
    list.appendChild(li);
  }

  const lastTeam = state.teamIdx === state.teams.length - 1;
  $("nextTeamBtn").classList.toggle("hidden", lastTeam);
  $("endGameBtn").textContent = lastTeam ? "Final scores" : "Skip to final scores";
  show("recapScreen");
}

function startRound() {
  state.roundHits = [];
  state.roundMissed = [];
  state.locked = false;
  updateHud();
  nextWord();
  state.timeLeft = state.seconds;
  $("hudTimer").textContent = state.timeLeft;
  $("hudTimer").classList.remove("low");
  show("playScreen");

  state.timerId = setInterval(() => {
    state.timeLeft--;
    $("hudTimer").textContent = state.timeLeft;
    if (state.timeLeft <= 5) $("hudTimer").classList.add("low");
    if (state.timeLeft <= 0) endRound();
  }, 1000);
}

function guess(hit) {
  if (state.locked) return;
  state.locked = true;
  const card = $("wordCard");
  const word = $("wordText").textContent;
  (hit ? state.roundHits : state.roundMissed).push(word);
  card.classList.add(hit ? "correct-flash" : "skip-flash");
  setTimeout(() => {
    card.classList.remove("correct-flash", "skip-flash");
    state.locked = false;
    nextWord();
  }, 320);
}

function readTeams() {
  return state.teams.map(name => ({ name: name.trim() || "Team", score: 0 }));
}

function showFinal() {
  const ranked = [...state.teams].sort((a, b) => b.score - a.score);
  const list = $("podiumList");
  list.innerHTML = "";
  ranked.forEach(t => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = t.name;
    const pts = document.createElement("span");
    pts.className = "pts";
    pts.textContent = t.score + " pts";
    li.append(name, pts);
    list.appendChild(li);
  });
  show("finalScreen");
}

$("addTeam").addEventListener("click", () => {
  if (state.teams.length >= 6) return;
  state.teams.push(`Team ${state.teams.length + 1}`);
  renderTeamRows();
});

$("startBtn").addEventListener("click", () => {
  state.teams = readTeams();
  state.teamIdx = 0;
  refillQueue();
  startRound();
});

$("gotBtn").addEventListener("click", () => guess(true));
$("skipBtn").addEventListener("click", () => guess(false));

$("nextTeamBtn").addEventListener("click", () => {
  state.teamIdx = (state.teamIdx + 1) % state.teams.length;
  startRound();
});

$("endGameBtn").addEventListener("click", showFinal);

$("rematchBtn").addEventListener("click", () => {
  state.teams.forEach(t => { t.score = 0; });
  state.teamIdx = 0;
  refillQueue();
  startRound();
});

$("newSetupBtn").addEventListener("click", () => show("setupScreen"));

state.teams = ["Team Red", "Team Blue"];
renderTeamRows();
renderDecks();
renderTimes();
