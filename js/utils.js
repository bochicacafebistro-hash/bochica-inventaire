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
  if (st === "red") return `<span class="icon-inline" style="color:var(--status-red)">${icon("alert", 13)} ${t("status_commander")}</span>`;
  if (st === "yellow") return `<span class="icon-inline" style="color:var(--status-yellow)">${icon("clock", 13)} ${t("status_bientot_bas")}</span>`;
  return `<span class="icon-inline" style="color:var(--status-green)">${icon("check", 13)} ${t("status_ok")}</span>`;
}

function orderLabel(p) {
  const q = p.orderQty || 0;
  if (p.orderUnit === "boîte") {
    const word = q > 1 ? t("unit_box") + (getUILang() === "fr" ? "s" : "s") : t("unit_box");
    return `${q} ${word}`;
  }
  const word = q > 1 ? t("unit_units") : t("unit_unit");
  return `${q} ${word}`;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(n) { return `${Number(n || 0).toFixed(2)} $`; }

function esc(s) { return (s || "").replace(/'/g, "\\'").replace(/"/g, "&quot;"); }

async function addLog(productName, action, detail) {
  const userName = loggedInUser?.name || (isAdmin ? "Admin" : "Employé");
  await db.collection("logs").add({
    productName, action, detail,
    ts: firebase.firestore.FieldValue.serverTimestamp(),
    role: isAdmin ? "admin" : "employé",
    userName,
    userId: loggedInUser?.id || null
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
    <div class="modal-header"><h3>${title}</h3><button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button></div>
    <p style="color:var(--text2);font-size:14px;margin-bottom:20px;line-height:1.6">${msg}</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button style="background:${isDanger ? "var(--status-red)" : "var(--status-green)"};color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:600;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;gap:6px" onclick="confirmAction()">
        ${icon(isDanger ? "trash" : "check", 14)} ${isDanger ? t("delete") : t("confirm")}
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

// ═══════════════════════════════════════════════════════════════
// RECHERCHE GLOBALE (Command Palette Cmd+K)
// ═══════════════════════════════════════════════════════════════

let cmdkSelectedIdx = 0;
let cmdkResults = [];

function openCmdK() {
  if (document.getElementById("cmdk-modal")) return; // déjà ouvert
  cmdkSelectedIdx = 0;
  cmdkResults = [];
  const modalsEl = document.getElementById("modals");
  modalsEl.innerHTML = `
    <div class="cmdk-overlay" id="cmdk-modal" onclick="if(event.target===this)closeCmdK()">
      <div class="cmdk-box">
        <div class="cmdk-input-wrap">
          ${icon("search", 18)}
          <input type="text" id="cmdk-input" placeholder="${t("search_placeholder")}" autocomplete="off" autofocus/>
          <kbd class="cmdk-esc">esc</kbd>
        </div>
        <div class="cmdk-results" id="cmdk-results"></div>
        <div class="cmdk-footer">${t("search_keyboard_hint")}</div>
      </div>
    </div>`;
  setTimeout(() => {
    const input = document.getElementById("cmdk-input");
    if (input) {
      input.focus();
      input.addEventListener("input", e => updateCmdKResults(e.target.value));
    }
    updateCmdKResults("");
  }, 50);
}

function closeCmdK() {
  const m = document.getElementById("cmdk-modal");
  if (m) m.remove();
  cmdkResults = [];
}

function updateCmdKResults(query) {
  const q = (query || "").trim().toLowerCase();
  cmdkResults = [];

  if (q.length === 0) {
    document.getElementById("cmdk-results").innerHTML = `
      <div class="cmdk-empty">${icon("info", 16)} Tapez pour rechercher partout</div>`;
    return;
  }

  // Recherche dans toutes les collections
  const sections = [
    {
      title: t("search_section_products"),
      icon: "package",
      items: products.filter(p => !p.archived && (p.name || "").toLowerCase().includes(q)).slice(0, 5)
        .map(p => ({ label: p.name, sub: `Stock: ${getCurrentStock(p)}`, page: "inventaire" }))
    },
    {
      title: t("search_section_ingredients"),
      icon: "tag",
      items: ingredients.filter(i => (i.name || "").toLowerCase().includes(q)).slice(0, 5)
        .map(i => ({ label: i.name, sub: `${fmtMoney(i.costPerUnit || 0)}/${i.unit}`, page: "ingredients" }))
    },
    {
      title: t("search_section_recipes"),
      icon: "file-text",
      items: recipes.filter(r =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.ingredients || "").toLowerCase().includes(q)
      ).slice(0, 5)
        .map(r => ({ label: r.name, sub: r.description || "", page: "recettes", id: r.id, action: "openRecipeViewModal" }))
    },
    {
      title: t("search_section_menu"),
      icon: "utensils",
      items: menuItems.filter(m => (m.name || "").toLowerCase().includes(q)).slice(0, 5)
        .map(m => ({ label: m.name, sub: `${fmtMoney(m.price)} · ${m.category}`, page: "menu" }))
    },
    {
      title: t("search_section_employees"),
      icon: "users",
      items: employees.filter(e => (e.name || "").toLowerCase().includes(q)).slice(0, 5)
        .map(e => ({ label: e.name, sub: e.role || "", page: "employes" }))
    },
    {
      title: t("search_section_suppliers"),
      icon: "store",
      items: suppliers.filter(s => (s.name || "").toLowerCase().includes(q)).slice(0, 5)
        .map(s => ({ label: s.name, sub: s.contact || "", page: "fournisseurs" }))
    },
  ];

  // Filtrer les sections vides + accumuler dans cmdkResults
  let html = "";
  let idx = 0;
  sections.forEach(sec => {
    if (sec.items.length === 0) return;
    html += `<div class="cmdk-section-title">${icon(sec.icon, 12)} ${sec.title}</div>`;
    sec.items.forEach(it => {
      cmdkResults.push(it);
      html += `<div class="cmdk-result" data-idx="${idx}" onclick="cmdkSelect(${idx})">
        <span class="cmdk-result__label">${esc(it.label || "?")}</span>
        ${it.sub ? `<span class="cmdk-result__sub">${esc(it.sub)}</span>` : ""}
      </div>`;
      idx++;
    });
  });

  if (cmdkResults.length === 0) {
    html = `<div class="cmdk-empty">${icon("x-circle", 16)} ${t("search_no_results")}</div>`;
  }

  document.getElementById("cmdk-results").innerHTML = html;
  cmdkSelectedIdx = 0;
  updateCmdKSelection();
}

function updateCmdKSelection() {
  document.querySelectorAll(".cmdk-result").forEach((el, i) => {
    el.classList.toggle("cmdk-result--active", i === cmdkSelectedIdx);
    if (i === cmdkSelectedIdx) el.scrollIntoView({ block: "nearest" });
  });
}

function cmdkSelect(idx) {
  const result = cmdkResults[idx];
  if (!result) return;
  closeCmdK();
  if (result.page) navTo(result.page);
  // Si action spéciale (ex: ouvrir directement un modal)
  if (result.action && result.id) {
    setTimeout(() => {
      if (typeof window[result.action] === "function") window[result.action](result.id);
    }, 100);
  }
}

// Listener global pour Cmd+K / Ctrl+K + navigation clavier
document.addEventListener("keydown", e => {
  // Ouvrir avec Cmd+K ou Ctrl+K
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    if (!isLoggedIn) return;
    e.preventDefault();
    openCmdK();
    return;
  }
  // Si command palette ouverte
  if (document.getElementById("cmdk-modal")) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCmdK();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cmdkResults.length > 0) {
        cmdkSelectedIdx = (cmdkSelectedIdx + 1) % cmdkResults.length;
        updateCmdKSelection();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdkResults.length > 0) {
        cmdkSelectedIdx = (cmdkSelectedIdx - 1 + cmdkResults.length) % cmdkResults.length;
        updateCmdKSelection();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      cmdkSelect(cmdkSelectedIdx);
    }
  }
});
