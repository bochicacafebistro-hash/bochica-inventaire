// ── Utilitaires ───────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 10); }
function getAllSections() { return ["Toutes", ...DEFAULT_SECTIONS, ...customSections]; }
function getCurrentStock(p) { return Number(p.currentStock ?? 0); }

function getStatus(p) {
  const s = getCurrentStock(p), m = Number(p.minimum || 0);
  if (s <= m) return "red";
  if (s <= m * 1.2) return "yellow";
  return "green";
}

function statusLabel(st) {
  if (st === "red") return `<span class="icon-inline" style="color:var(--status-red)">${icon("alert", 13)} Commander</span>`;
  if (st === "yellow") return `<span class="icon-inline" style="color:var(--status-yellow)">${icon("clock", 13)} Bientôt bas</span>`;
  return `<span class="icon-inline" style="color:var(--status-green)">${icon("check", 13)} OK</span>`;
}

function orderLabel(p) {
  const q = p.orderQty || 0;
  return p.orderUnit === "boîte" ? `${q} boîte${q > 1 ? "s" : ""}` : `${q} unité${q > 1 ? "s" : ""}`;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(n) { return `${Number(n || 0).toFixed(2)} $`; }

function esc(s) { return (s || "").replace(/'/g, "\\'").replace(/"/g, "&quot;"); }

async function addLog(productName, action, detail) {
  await db.collection("logs").add({
    productName, action, detail,
    ts: firebase.firestore.FieldValue.serverTimestamp(),
    role: isAdmin ? "admin" : "employé"
  });
}

// ── Dark mode ─────────────────────────────────────────
function initDark() { darkMode = localStorage.getItem("bochica-dark") === "1"; applyDark(); }
function toggleDark() { darkMode = !darkMode; localStorage.setItem("bochica-dark", darkMode ? "1" : "0"); applyDark(); renderPage(); }
function applyDark() {
  document.body.classList.toggle("dark", darkMode);
  const b = document.getElementById("dark-btn");
  if (b) {
    b.innerHTML = icon(darkMode ? "sun" : "moon", 14);
    b.setAttribute("aria-label", darkMode ? "Activer le mode clair" : "Activer le mode sombre");
    b.setAttribute("title", darkMode ? "Mode clair" : "Mode sombre");
  }
}

// ── Dropdown ──────────────────────────────────────────
function toggleDrop(id) { closeAllDrops(); if (openDropId === id) { openDropId = null; return; } const el = document.getElementById("drop-" + id); if (el) { el.classList.add("open"); openDropId = id; } }
function closeAllDrops() { document.querySelectorAll(".dropdown.open").forEach(el => el.classList.remove("open")); openDropId = null; }

// ── Modal ─────────────────────────────────────────────
function showModal(html) { document.getElementById("modals").innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()">${html}</div>`; }
function closeModal() { document.getElementById("modals").innerHTML = ""; }

function openConfirm(title, msg, action, isDanger = false) {
  pendingConfirm = action;
  showModal(`<div class="modal" style="max-width:380px">
    <div class="modal-header"><h3>${title}</h3><button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button></div>
    <p style="color:var(--text2);font-size:14px;margin-bottom:20px;line-height:1.6">${msg}</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button style="background:${isDanger ? "var(--status-red)" : "var(--status-green)"};color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:600;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;gap:6px" onclick="confirmAction()">
        ${icon(isDanger ? "trash" : "check", 14)} ${isDanger ? "Supprimer" : "Confirmer"}
      </button>
    </div>
  </div>`);
}
function confirmAction() { if (pendingConfirm) pendingConfirm(); closeModal(); }

// ── Helpers divers ────────────────────────────────────
function setSection(s) { activeSection = s; searchQuery = ""; renderPage(); }
function setSearch(v) { searchQuery = v; renderPage(); }
function toggleSections() { sectionsExpanded = !sectionsExpanded; renderPage(); }
function toggleShowArchived() { showArchived = !showArchived; renderPage(); }
function setLogFilter(v) { logFilter = v; renderPage(); }
function setExpensePeriod(p) { activeExpensePeriod = p; renderPage(); }
function setMenuCat(c) { activeMenuCat = c; renderPage(); }

// ── Resize + Midnight ─────────────────────────────────
window.addEventListener("resize", () => { if (isLoggedIn) renderPage(); });

function scheduleMidnight() {
  const now = new Date(), m = new Date(now);
  m.setDate(now.getDate() + 1); m.setHours(0, 0, 10, 0);
  setTimeout(() => { scheduleMidnight(); if (isLoggedIn) renderPage(); }, m - now);
}
scheduleMidnight();
