"use strict";

(() => {
  const MAX_DIM = 520;

  const els = {
    dropZone: document.getElementById("dropZone"),
    fileInput: document.getElementById("fileInput"),
    previewWrap: document.getElementById("previewWrap"),
    photo: document.getElementById("photo"),
    overlay: document.getElementById("overlay"),
    toggleOverlay: document.getElementById("toggleOverlay"),
    newPhoto: document.getElementById("newPhoto"),
    statusLine: document.getElementById("statusLine"),
    guessRows: document.getElementById("guessRows"),
    addPlayer: document.getElementById("addPlayer"),
    revealBtn: document.getElementById("revealBtn"),
    peekCount: document.getElementById("peekCount"),
    resultBox: document.getElementById("resultBox"),
    officialCount: document.getElementById("officialCount"),
    rankingList: document.getElementById("rankingList"),
    nextRound: document.getElementById("nextRound"),
    resetAll: document.getElementById("resetAll"),
    standingsList: document.getElementById("standingsList")
  };

  const state = {
    imageDataUrl: null,
    payload: null,
    result: null,
    revealed: false,
    overlayOn: false
  };

  let leaderboard = {};
  try {
    leaderboard = JSON.parse(localStorage.getItem("ctj-leaderboard") || "{}");
  } catch { leaderboard = {}; }

  function setStatus(msg, isError = false) {
    els.statusLine.textContent = msg;
    els.statusLine.classList.toggle("error", isError);
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setStatus("Reading photo...");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);

      state.imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      els.photo.src = state.imageDataUrl;

      const imgData = canvas.getContext("2d").getImageData(0, 0, w, h);
      state.payload = {
        width: w,
        height: h,
        data: arrayBufferToBase64(imgData.data.buffer)
      };

      els.dropZone.classList.add("hidden");
      els.previewWrap.classList.remove("hidden");
      els.resultBox.classList.add("hidden");
      state.revealed = false;
      state.overlayOn = false;
      els.toggleOverlay.textContent = "Show detection";
      drawOverlay([]);
      await analyze();
    } catch (err) {
      setStatus(`Could not read that image: ${err.message}`, true);
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function analyze() {
    setStatus("Counting beans (overlap + occlusion pass)...");
    els.revealBtn.disabled = true;
    try {
      const res = await fetch("/api/count-jar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      state.result = json;
      drawOverlay(json.beans);
      els.revealBtn.disabled = false;
      updateOfficialCount();
      setStatus(
        `Locked in. Found ${json.visibleCount} visible beans; ` +
        `bean size ~${json.beanDiameterPx}px, analyzed in ${json.ms}ms.`
      );
    } catch (err) {
      setStatus(`Counting failed: ${err.message}`, true);
    }
  }

  function drawOverlay(beans) {
    const w = state.result?.width || state.payload?.width || 0;
    const h = state.result?.height || state.payload?.height || 0;
    els.overlay.setAttribute("viewBox", `0 0 ${w} ${h}`);
    els.overlay.innerHTML = beans
      .map(b => `<circle cx="${b.x}" cy="${b.y}" r="${Math.max(3, b.r)}"></circle>`)
      .join("");
    els.overlay.style.display = state.overlayOn ? "block" : "none";
  }

  function updateOfficialCount() {
    if (!state.result) return;
    els.officialCount.textContent = state.result.count;
    els.officialCount.parentElement.classList.toggle("blurred", !state.revealed && !els.peekCount.checked);
  }

  function guessRow(name = "", guess = "") {
    const row = document.createElement("div");
    row.className = "guess-row";
    row.innerHTML = `
      <input type="text" class="p-name" placeholder="Name" value="${name}">
      <input type="number" min="0" class="p-guess" placeholder="Guess" value="${guess}">
      <button class="remove" title="Remove">&times;</button>`;
    row.querySelector(".remove").addEventListener("click", () => row.remove());
    return row;
  }

  function collectGuesses() {
    return [...els.guessRows.querySelectorAll(".guess-row")]
      .map(row => ({
        name: row.querySelector(".p-name").value.trim(),
        guess: parseInt(row.querySelector(".p-guess").value, 10)
      }))
      .filter(g => g.name && Number.isFinite(g.guess));
  }

  function reveal() {
    if (!state.result) return;
    const guesses = collectGuesses();
    if (!guesses.length) {
      setStatus("Add at least one named guess before revealing.", true);
      return;
    }
    const truth = state.result.count;
    const ranked = guesses
      .map(g => ({ ...g, delta: Math.abs(g.guess - truth) }))
      .sort((a, b) => a.delta - b.delta);

    els.rankingList.innerHTML = ranked
      .map((g, i) => {
        const off = g.delta === 0 ? "dead on" : `${g.delta} away`;
        const dir = g.guess > truth ? "high" : g.guess < truth ? "low" : "";
        return `<li class="${i === 0 ? "winner" : ""}">${escapeHtml(g.name)} guessed ${g.guess}
          <span class="delta">${off}${dir ? ` (${dir})` : ""}</span></li>`;
      })
      .join("");

    const winner = ranked[0].name;
    leaderboard[winner] = (leaderboard[winner] || 0) + 1;
    localStorage.setItem("ctj-leaderboard", JSON.stringify(leaderboard));
    renderStandings();

    state.revealed = true;
    updateOfficialCount();
    els.resultBox.classList.remove("hidden");
    setStatus(`Winner: ${winner}. Confetti is implied.`);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function renderStandings() {
    const entries = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      els.standingsList.innerHTML = '<li class="muted">No rounds played yet.</li>';
      return;
    }
    els.standingsList.innerHTML = entries
      .map(([name, wins]) => `<li>${escapeHtml(name)} <span class="wins">${wins}</span></li>`)
      .join("");
  }

  els.dropZone.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => handleFile(els.fileInput.files[0]));
  ["dragover", "dragenter"].forEach(ev =>
    els.dropZone.addEventListener(ev, e => { e.preventDefault(); els.dropZone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach(ev =>
    els.dropZone.addEventListener(ev, e => { e.preventDefault(); els.dropZone.classList.remove("dragover"); })
  );
  els.dropZone.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));

  els.newPhoto.addEventListener("click", () => {
    state.payload = null;
    state.result = null;
    state.revealed = false;
    els.previewWrap.classList.add("hidden");
    els.dropZone.classList.remove("hidden");
    els.resultBox.classList.add("hidden");
    els.fileInput.value = "";
    setStatus("");
  });

  els.toggleOverlay.addEventListener("click", () => {
    state.overlayOn = !state.overlayOn;
    els.toggleOverlay.textContent = state.overlayOn ? "Hide detection" : "Show detection";
    drawOverlay(state.result ? state.result.beans : []);
  });

  els.peekCount.addEventListener("change", updateOfficialCount);
  els.addPlayer.addEventListener("click", () => els.guessRows.appendChild(guessRow()));
  els.revealBtn.addEventListener("click", reveal);

  els.nextRound.addEventListener("click", () => {
    const names = collectGuesses().map(g => g.name);
    els.guessRows.innerHTML = "";
    names.forEach(n => els.guessRows.appendChild(guessRow(n)));
    els.guessRows.appendChild(guessRow());
    els.resultBox.classList.add("hidden");
    state.revealed = false;
    updateOfficialCount();
    setStatus("Same crew, new jar photo?");
  });

  els.resetAll.addEventListener("click", () => {
    leaderboard = {};
    localStorage.removeItem("ctj-leaderboard");
    renderStandings();
    els.guessRows.innerHTML = "";
    els.guessRows.appendChild(guessRow());
    els.guessRows.appendChild(guessRow());
    els.newPhoto.click();
  });

  els.guessRows.appendChild(guessRow());
  els.guessRows.appendChild(guessRow());
  renderStandings();
})();
