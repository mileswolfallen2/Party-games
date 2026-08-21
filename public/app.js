"use strict";

(() => {
  const cfg = window.PARTY_CONFIG || {};
  const siteUrl = cfg.siteUrl || "https://YOUR-PARTY-URL.example.com";
  const isPlaceholder = /YOUR-PARTY-URL|example\.com/.test(siteUrl);

  const modal = document.getElementById("qrModal");
  const qrBox = document.getElementById("qrBox");
  const urlLine = document.getElementById("urlLine");
  const note = document.getElementById("placeholderNote");

  function openModal() {
    qrBox.innerHTML = QRCode.svg(siteUrl, { px: 240, scale: 8 });
    urlLine.textContent = siteUrl;
    note.textContent = isPlaceholder
      ? "Placeholder URL. Set your real address in public/config.js before the party."
      : "Scan to open on your phone.";
    modal.classList.add("open");
  }

  document.getElementById("hostBtn").addEventListener("click", openModal);
  document.getElementById("closeModal").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("open");
  });
})();
