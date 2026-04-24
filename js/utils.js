// ── Utilitaires ───────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 10); }
function getAllSections() {
  // Utilise la liste unifiée `allSections` (par défaut + personnalisées, gérée via Firestore).
  // Fallback pour tout premier chargement avant que le listener n'ait répondu.
  const base = (allSections && allSections.length) ? allSections : [...DEFAULT_SECTIONS, ...customSections];
  return ["Toutes", ...base];
}
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

// ── Markdown léger : gras, italique, barré, liens, listes, paragraphes ──
// Sécurisé : on échappe d'abord tout le HTML, puis on injecte nos tags.
// Usage : renderMarkdown("**Salut** *toi*\n- puce 1\n- puce 2")
function renderMarkdown(text) {
  if (!text) return "";
  // 1. Échapper tout le HTML pour bloquer les injections
  let s = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // 2. Inline : gras, italique, barré (l'ordre compte)
  // Gras : **texte** (doit être traité avant l'italique pour pas matcher **)
  s = s.replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "<strong>$1</strong>");
  // Italique : *texte* (un seul astérisque)
  s = s.replace(/(^|[^*<\w])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  // Barré : ~~texte~~
  s = s.replace(/~~([^~\n]+?)~~/g, "<del>$1</del>");

  // 3. Bloc : listes + paragraphes (traitement ligne par ligne)
  const lines = s.split("\n");
  const out = [];
  let inUl = false, inOl = false, paraBuf = [];
  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${paraBuf.join("<br>")}</p>`);
      paraBuf = [];
    }
  };
  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  lines.forEach(raw => {
    const line = raw.replace(/\s+$/, ""); // trim droite
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${ul[1]}</li>`);
    } else if (ol) {
      flushPara();
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${ol[1]}</li>`);
    } else if (line.trim() === "") {
      flushPara();
      closeLists();
    } else {
      closeLists();
      paraBuf.push(line);
    }
  });
  flushPara();
  closeLists();
  return out.join("");
}

// Rétrocompat : si un texte legacy n'a AUCUN marker markdown et plusieurs lignes,
// on le considère comme une liste implicite et on préfixe chaque ligne.
// type = "bullet" | "numbered"
function autoMarkdownList(text, type) {
  if (!text) return "";
  const lines = String(text).split("\n").filter(l => l.trim());
  if (!lines.length) return "";
  // A-t-on déjà des markers ? (`- `, `* `, `• `, `1. `, `**`, etc.)
  const hasMarkdown = lines.some(l => /^\s*([-*•]|\d+\.)\s+/.test(l) || /\*\*|~~|(^|\s)\*[^*]/.test(l));
  if (hasMarkdown) return text;
  // Préfixer chaque ligne non-vide selon le type
  const prefix = type === "numbered" ? "1. " : "- ";
  return lines.map(l => prefix + l).join("\n");
}

// ── Toolbar markdown pour textareas ───────────────────
// Génère une barre d'outils avec boutons gras/italique/listes qui agit sur un textarea
function mdToolbar(textareaId) {
  return `<div class="md-toolbar" role="toolbar" aria-label="Mise en forme">
    <button type="button" class="md-btn" onclick="mdWrap('${textareaId}','**','**')" title="Gras (Ctrl+B)" aria-label="Gras">${icon("bold", 14)}</button>
    <button type="button" class="md-btn" onclick="mdWrap('${textareaId}','*','*')" title="Italique (Ctrl+I)" aria-label="Italique">${icon("italic", 14)}</button>
    <button type="button" class="md-btn" onclick="mdWrap('${textareaId}','~~','~~')" title="Barré" aria-label="Barré">${icon("strikethrough", 14)}</button>
    <span class="md-toolbar__sep" aria-hidden="true"></span>
    <button type="button" class="md-btn" onclick="mdPrefixLines('${textareaId}','- ')" title="Liste à puces" aria-label="Liste à puces">${icon("list", 14)}</button>
    <button type="button" class="md-btn" onclick="mdPrefixLines('${textareaId}','1. ')" title="Liste numérotée" aria-label="Liste numérotée">${icon("list-ordered", 14)}</button>
  </div>`;
}

function mdWrap(id, before, after) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = el.selectionStart, end = el.selectionEnd;
  const selected = el.value.substring(start, end);
  const placeholder = selected || "texte";
  const replacement = before + placeholder + after;
  el.value = el.value.substring(0, start) + replacement + el.value.substring(end);
  el.focus();
  // Si rien n'était sélectionné, on sélectionne le placeholder pour remplacement facile
  if (selected) {
    const pos = start + replacement.length;
    el.setSelectionRange(pos, pos);
  } else {
    el.setSelectionRange(start + before.length, start + before.length + placeholder.length);
  }
}

function mdPrefixLines(id, prefix) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = el.selectionStart, end = el.selectionEnd;
  const full = el.value;
  // Étendre la sélection aux bornes des lignes
  const lineStart = full.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = full.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = full.length;
  const before = full.substring(0, lineStart);
  const selected = full.substring(lineStart, lineEnd) || "texte";
  const after = full.substring(lineEnd);
  // Si toutes les lignes ont déjà le préfixe → on le retire (toggle)
  const lines = selected.split("\n");
  const allHave = lines.every(l => l.startsWith(prefix));
  const newLines = allHave
    ? lines.map(l => l.substring(prefix.length))
    : lines.map(l => l.startsWith(prefix) ? l : prefix + l);
  const joined = newLines.join("\n");
  el.value = before + joined + after;
  el.focus();
  el.setSelectionRange(lineStart, lineStart + joined.length);
}

// Raccourcis clavier sur un textarea markdown (Ctrl/Cmd + B/I)
function mdAttachShortcuts(textareaId) {
  const el = document.getElementById(textareaId);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); mdWrap(textareaId, "**", "**"); }
    else if (k === "i") { e.preventDefault(); mdWrap(textareaId, "*", "*"); }
  });
}

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
function toggleDrop(id) {
  // Si le même dropdown est déjà ouvert, on le ferme (toggle)
  if (openDropId === id) { closeAllDrops(); return; }
  closeAllDrops();
  const el = document.getElementById("drop-" + id);
  if (el) { el.classList.add("open"); openDropId = id; }
}
function closeAllDrops() { document.querySelectorAll(".dropdown.open").forEach(el => el.classList.remove("open")); openDropId = null; }

// Fermer les dropdowns lors d'un clic extérieur (n'importe où dans la page)
document.addEventListener("click", (e) => {
  if (!openDropId) return;
  const t = e.target;
  if (!t || !t.closest) return;
  // Si le clic est sur le bouton déclencheur (.dots-btn) ou dans un dropdown ouvert, ne rien faire
  if (t.closest(".dots-btn") || t.closest(".dropdown")) return;
  closeAllDrops();
});
// Fermer aussi avec Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openDropId) closeAllDrops();
});

// ── Duplication générique d'un document Firestore ─────
// Clone un document en ajoutant " (Copie)" au nom et en générant un nouvel ID.
// collection : nom de la collection Firestore (products, recipes, menu, etc.)
// id : ID du document à dupliquer
// nameField : champ qui contient le nom (default "name", "title" pour tasks, "description" pour expenses/revenues)
async function duplicateItem(collection, id, nameField = "name") {
  try {
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists) { alert("Document introuvable."); return; }
    const data = snap.data();
    const copy = { ...data };
    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;
    const orig = copy[nameField] || "";
    copy[nameField] = orig + " (Copie)";
    copy.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    copy.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    // Ajustements par collection
    if (collection === "products") {
      // Placer la copie à la fin + désarchiver
      const maxSort = products.reduce((m, p) => Math.max(m, p.sortOrder || 0), 0);
      copy.sortOrder = maxSort + 1;
      copy.archived = false;
      copy.currentStock = 0; // on ne duplique pas le stock
    }
    if (collection === "menu") {
      // Par défaut, la copie est disponible
      copy.available = copy.available !== false;
    }
    const nid = genId();
    await db.collection(collection).doc(nid).set({ ...copy, id: nid });
    await addLog(copy[nameField] || "—", "Dupliqué", `Depuis « ${orig} »`);
  } catch (err) {
    console.error("duplicateItem:", err);
    alert("Erreur lors de la duplication : " + (err.message || err));
  }
}

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
function setSearch(v) {
  searchQuery = v;
  renderPage();
  // Restaurer le focus + position du curseur (perdu par le re-render complet).
  // Sans ça, seul le 1er caractère tapé est capté car l'input est recréé à chaque frappe.
  requestAnimationFrame(() => {
    const el = document.getElementById("inv-search");
    if (el) {
      el.focus();
      const len = el.value.length;
      try { el.setSelectionRange(len, len); } catch (_) {}
    }
  });
}
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
