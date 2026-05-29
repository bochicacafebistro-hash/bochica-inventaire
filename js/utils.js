// ── Utilitaires ───────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 10); }

// ── Permissions par rôle ──────────────────────────────
// (L'auth est gérée par Firebase Auth — voir auth.js)
function canAccess(page) {
  if (!userRole) return false;
  const perm = ROLE_PERMISSIONS[userRole];
  if (!perm) return false;
  return perm.canAccess.includes(page);
}
function canWrite(section) {
  if (!userRole) return false;
  const perm = ROLE_PERMISSIONS[userRole];
  if (!perm) return false;
  return perm.canWrite.includes(section);
}
function getHomePage() {
  const perm = ROLE_PERMISSIONS[userRole];
  return (perm && perm.homePage) || "inventaire";
}

// v3.28.0 — Mode aperçu admin ─────────────────────────────
// Permet à l'admin de visualiser l'app comme un autre rôle
// (chef ou employee) sans changer de compte. Implémenté en
// écrasant temporairement userRole/isAdmin pour que toutes
// les vérifications existantes (canAccess, userRole === "X",
// isAdmin, etc.) soient cohérentes.
//
// ⚠ Les writes Firestore continuent à utiliser le VRAI auth
// (côté serveur les règles vérifient le token Firebase Auth),
// donc l'aperçu reste sécurisé : un admin en aperçu employé
// ne peut pas faire de modifs interdites côté serveur, mais
// l'UI les cache pour une expérience cohérente.
function enterPreviewMode(role) {
  if (_previewActive) {
    // Déjà en aperçu — change juste de rôle ciblé (sans écraser _real*)
    if (!["chef", "employee"].includes(role)) return;
    userRole = role;
    isAdmin = (role === "chef"); // chef peut écrire, employee non
    buildSidebar();
    navTo(getHomePage());
    return;
  }
  // Seul le VRAI admin peut entrer en aperçu
  if (userRole !== "global_admin") {
    toast("Seul l'admin peut activer le mode aperçu.", "warning");
    return;
  }
  if (!["chef", "employee"].includes(role)) return;
  _realUserRole = userRole;
  _realIsAdmin = isAdmin;
  userRole = role;
  isAdmin = (role === "chef");
  _previewActive = true;
  buildSidebar();
  navTo(getHomePage());
  const label = role === "chef" ? "Chef de cuisine" : "Employé";
  toast(`Aperçu activé : ${label}`, "info", 2500);
}

function exitPreviewMode() {
  if (!_previewActive) return;
  userRole = _realUserRole;
  isAdmin = _realIsAdmin;
  _realUserRole = null;
  _realIsAdmin = false;
  _previewActive = false;
  buildSidebar();
  navTo(getHomePage());
  toast("Aperçu terminé — retour admin.", "success", 2000);
}

// Handler du select dans la sidebar : value === "" → sortir de l'aperçu,
// value === "chef"|"employee" → entrer (ou changer) le rôle prévisualisé.
function onPreviewRoleChange(value) {
  if (!value) {
    exitPreviewMode();
  } else {
    enterPreviewMode(value);
  }
}
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
  if (st === "red") return `<span class="icon-inline text-danger">${icon("alert", 13)} ${t("status_commander")}</span>`;
  if (st === "yellow") return `<span class="icon-inline text-warning">${icon("clock", 13)} ${t("status_bientot_bas")}</span>`;
  return `<span class="icon-inline text-success">${icon("check", 13)} ${t("status_ok")}</span>`;
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
// Le dropdown est en position:fixed ET "portaillé" dans <body> à l'ouverture.
// Raisons :
//  1) overflow:hidden sur un parent (ex: .table-wrap) → fixed règle ça
//  2) transform/filter sur un parent (ex: .recipe-card:hover translateY)
//     crée un nouveau containing block qui CASSE position:fixed.
//     Seule solution : sortir physiquement l'élément du DOM parent.
function toggleDrop(id) {
  if (openDropId === id) { closeAllDrops(); return; }
  closeAllDrops();
  const el = document.getElementById("drop-" + id);
  if (!el) return;
  // Trouver le bouton déclencheur dans le même .menu-wrap AVANT de déplacer
  const wrap = el.closest(".menu-wrap");
  const btn = wrap ? wrap.querySelector(".dots-btn") : null;
  // Portal : mémoriser la position originale puis déplacer dans body
  el._portalParent = el.parentNode;
  el._portalNextSibling = el.nextSibling;
  document.body.appendChild(el);
  if (btn) positionDropdown(el, btn);
  el.classList.add("open");
  openDropId = id;
}

function positionDropdown(el, btn) {
  // Mesurer la taille réelle du dropdown (hidden mais layouté)
  const prevVisibility = el.style.visibility;
  const prevDisplay = el.style.display;
  el.style.visibility = "hidden";
  el.style.display = "block";
  el.style.left = "0";
  el.style.top = "0";
  const dropW = el.offsetWidth;
  const dropH = el.offsetHeight;
  el.style.visibility = prevVisibility;
  el.style.display = prevDisplay;

  const btnRect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 8; // marge de sécurité par rapport aux bords

  // Horizontal : aligner le bord droit du dropdown avec le bord droit du bouton.
  // Si ça déborde à gauche → aligner à gauche. Si ça déborde à droite → coller à droite.
  let left = btnRect.right - dropW;
  if (left < m) left = Math.max(m, btnRect.left); // aligner à gauche du bouton
  if (left + dropW > vw - m) left = vw - dropW - m;

  // Vertical : en-dessous du bouton par défaut. Si pas la place → au-dessus.
  const spaceBelow = vh - btnRect.bottom - m;
  const spaceAbove = btnRect.top - m;
  let top;
  if (dropH + 4 <= spaceBelow || spaceBelow >= spaceAbove) {
    top = btnRect.bottom + 4;
  } else {
    top = btnRect.top - dropH - 4;
  }
  // Cap si vraiment pas la place nulle part
  if (top < m) top = m;
  if (top + dropH > vh - m) top = Math.max(m, vh - dropH - m);

  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
}

function closeAllDrops() {
  document.querySelectorAll(".dropdown.open").forEach(el => {
    el.classList.remove("open");
    // Reset les coordonnées inline pour pas polluer le prochain affichage
    el.style.left = "";
    el.style.top = "";
    // Remettre l'élément à sa place originale (portal reverse)
    const parent = el._portalParent;
    const next = el._portalNextSibling;
    if (parent && parent.isConnected) {
      // Parent toujours dans le DOM → on remet dedans
      parent.insertBefore(el, next);
    } else {
      // Parent détruit (ex: renderPage a re-rendu) → on retire carrément
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    el._portalParent = null;
    el._portalNextSibling = null;
  });
  openDropId = null;
}

// Fermer les dropdowns lors d'un clic extérieur (n'importe où dans la page)
document.addEventListener("click", (e) => {
  if (!openDropId) return;
  const t = e.target;
  if (!t || !t.closest) return;
  // Si le clic est sur le bouton déclencheur (.dots-btn) ou dans un dropdown ouvert, ne rien faire
  if (t.closest(".dots-btn") || t.closest(".dropdown")) return;
  closeAllDrops();
});
// Fermer avec Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openDropId) closeAllDrops();
});
// Fermer au scroll / resize (le position:fixed ne suit pas le scroll)
window.addEventListener("scroll", () => { if (openDropId) closeAllDrops(); }, true);
window.addEventListener("resize", () => { if (openDropId) closeAllDrops(); });

// ── Duplication générique d'un document Firestore ─────
// Clone un document en ajoutant " (Copie)" au nom et en générant un nouvel ID.
// Après duplication, ouvre AUTOMATIQUEMENT la modale d'édition du nouvel item
// pour permettre de changer le nom rapidement.
// collection : nom de la collection Firestore (products, recipes, menu, etc.)
// id : ID du document à dupliquer
// nameField : champ qui contient le nom (default "name", "title" pour tasks, "description" pour expenses/revenues)

// Mapping collection → fonction d'édition (window.*) + accesseur au state local
// + ID du champ "nom" à focuser automatiquement dans la modale d'édition
const DUPLICATE_CONFIG = {
  products:     { editor: "openProductModal",    getState: () => products,     nameInput: "p-name" },
  recipes:      { editor: "openRecipeModal",     getState: () => recipes,      nameInput: "rec-name" },
  menu:         { editor: "openMenuModal",       getState: () => menuItems,    nameInput: "mn-name" },
  suppliers:    { editor: "openSupplierModal",   getState: () => suppliers,    nameInput: "s-name" },
  ingredients:  { editor: "openIngredientModal", getState: () => ingredients,  nameInput: "ing-name" },
  employees:    { editor: "openEmployeeModal",   getState: () => employees,    nameInput: "e-name" },
  tasks:        { editor: "openTaskModal",       getState: () => tasks,        nameInput: "t-title" },
  expenses:     { editor: "openExpenseModal",    getState: () => expenses,     nameInput: "ex-desc" },
  revenues:     { editor: "openRevenueModal",    getState: () => revenues,     nameInput: "rv-desc" },
  shoppingList: { editor: "openShoppingModal",   getState: () => shoppingList, nameInput: "shop-name" },
  events:       { editor: "openEventModal",      getState: () => events,       nameInput: "ev-name" },
  quotes:       { editor: "openQuoteModal",      getState: () => quotes,       nameInput: "q-client-name" }
};

// Attend que le listener Firestore ait propagé le nouvel item dans le state local
function waitForItem(collection, id, maxMs = 2500) {
  return new Promise((resolve) => {
    const cfg = DUPLICATE_CONFIG[collection];
    if (!cfg) return resolve(false);
    const start = Date.now();
    const tick = () => {
      const arr = cfg.getState();
      if (arr && arr.find(x => x.id === id)) return resolve(true);
      if (Date.now() - start > maxMs) return resolve(false);
      setTimeout(tick, 40);
    };
    tick();
  });
}

async function duplicateItem(collection, id, nameField = "name") {
  try {
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists) { toast("Document introuvable.", "error"); return; }
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

    // Ouvrir la modale d'édition du nouvel item pour renommage rapide
    const cfg = DUPLICATE_CONFIG[collection];
    if (cfg && typeof window[cfg.editor] === "function") {
      // Attendre que le listener Firestore ait mis à jour le state local
      await waitForItem(collection, nid);
      window[cfg.editor](nid);
      // Focus + sélection du nom pour permettre l'édition immédiate
      setTimeout(() => {
        const input = document.getElementById(cfg.nameInput);
        if (input) {
          input.focus();
          if (typeof input.select === "function") input.select();
        }
      }, 120);
    }
  } catch (err) {
    console.error("duplicateItem:", err);
    toast("Erreur lors de la duplication : " + (err.message || err), "error");
  }
}

// ── Modal ─────────────────────────────────────────────
function showModal(html) { document.getElementById("modals").innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()">${html}</div>`; }
function closeModal() { document.getElementById("modals").innerHTML = ""; }

// ── Animation de chiffres (compteur) ──────────────────
// Anime un texte numérique de `from` à `to` sur `duration` ms.
// `formatter` transforme le nombre courant en string (ex: fmtMoney).
// `el` peut être un Element OU un sélecteur (string).
// Respecte prefers-reduced-motion : si l'utilisateur ne veut pas d'animation,
// on saute directement à la valeur finale.
function animateNumber(el, from, to, duration = 600, formatter = String) {
  const target = (typeof el === "string") ? document.querySelector(el) : el;
  if (!target) return;
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced || duration <= 0 || from === to) {
    target.textContent = formatter(to);
    return;
  }
  const start = performance.now();
  target.classList.add("is-updating");
  function tick(now) {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    // Easing : easeOutCubic (départ rapide, arrivée douce)
    const eased = 1 - Math.pow(1 - t, 3);
    const value = from + (to - from) * eased;
    target.textContent = formatter(value);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      target.textContent = formatter(to);
      target.classList.remove("is-updating");
    }
  }
  requestAnimationFrame(tick);
}

// ── Empty states illustrés ─────────────────────────────
// Mini illustrations SVG inline, charmantes mais minimalistes.
// Toutes utilisent currentColor + accent pour s'adapter au thème.
const EMPTY_ILLUSTRATIONS = {
  // Boîte ouverte avec rayons — pour Inventaire vide
  inventaire: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="55" y="65" width="90" height="65" rx="4" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.08)"/>
    <path d="M55 80h90" stroke="var(--accent)"/>
    <path d="M95 80v50M105 80v50" stroke="var(--accent)" opacity=".4"/>
    <path d="M70 55l30-15 30 15" stroke="var(--accent)" stroke-dasharray="3 4"/>
    <circle cx="40" cy="40" r="3" fill="var(--accent)"/>
    <circle cx="160" cy="50" r="2.5" fill="var(--accent)" opacity=".6"/>
    <circle cx="170" cy="100" r="2" fill="var(--accent)" opacity=".4"/>
    <path d="M30 95l8-3M170 130l-8-3" stroke="var(--text3)" opacity=".5"/>
  </svg>`,

  // Liste avec checkmarks — pour Tâches vides
  taches: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="50" y="35" width="100" height="100" rx="6" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.05)"/>
    <rect x="62" y="50" width="14" height="14" rx="3" stroke="var(--accent)"/>
    <path d="M65 57l3 3 5-5" stroke="#7dbf66"/>
    <line x1="82" y1="57" x2="135" y2="57" stroke="var(--text3)" opacity=".6"/>
    <rect x="62" y="72" width="14" height="14" rx="3" stroke="var(--accent)"/>
    <path d="M65 79l3 3 5-5" stroke="#7dbf66"/>
    <line x1="82" y1="79" x2="125" y2="79" stroke="var(--text3)" opacity=".6"/>
    <rect x="62" y="94" width="14" height="14" rx="3" stroke="var(--accent)" stroke-dasharray="3 3"/>
    <line x1="82" y1="101" x2="130" y2="101" stroke="var(--text3)" opacity=".3"/>
    <rect x="62" y="116" width="14" height="14" rx="3" stroke="var(--accent)" stroke-dasharray="3 3"/>
    <line x1="82" y1="123" x2="120" y2="123" stroke="var(--text3)" opacity=".3"/>
  </svg>`,

  // Silhouettes d'employés — pour Employés vides
  employes: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="100" cy="55" r="18" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.1)"/>
    <path d="M70 130c0-16 13-30 30-30s30 14 30 30" stroke="var(--accent)"/>
    <circle cx="55" cy="68" r="13" stroke="var(--accent)" opacity=".5" fill="rgba(var(--accent-rgb),.05)"/>
    <path d="M35 130c0-12 9-22 20-22" stroke="var(--accent)" opacity=".5"/>
    <circle cx="145" cy="68" r="13" stroke="var(--accent)" opacity=".5" fill="rgba(var(--accent-rgb),.05)"/>
    <path d="M165 130c0-12-9-22-20-22" stroke="var(--accent)" opacity=".5"/>
    <circle cx="40" cy="35" r="2" fill="var(--accent)"/>
    <circle cx="165" cy="40" r="2.5" fill="var(--accent)" opacity=".7"/>
  </svg>`,

  // Reçu avec dollars — pour Soumissions vides
  soumissions: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M70 30h60v110l-15-8-15 8-15-8-15 8z" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.06)"/>
    <line x1="80" y1="55" x2="120" y2="55" stroke="var(--text3)" opacity=".5"/>
    <line x1="80" y1="70" x2="115" y2="70" stroke="var(--text3)" opacity=".5"/>
    <line x1="80" y1="85" x2="120" y2="85" stroke="var(--accent)"/>
    <circle cx="100" cy="110" r="13" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.12)"/>
    <text x="100" y="115" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="var(--accent-warm)" stroke="none">$</text>
    <circle cx="40" cy="40" r="2.5" fill="#e74c3c"/>
    <circle cx="160" cy="50" r="2" fill="#4a90e2"/>
    <circle cx="40" cy="130" r="2" fill="#4a90e2"/>
  </svg>`,

  // Plat / fourchette croisée — pour Menu vide
  menu: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="100" cy="85" r="45" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.06)"/>
    <circle cx="100" cy="85" r="30" stroke="var(--accent)" opacity=".5" stroke-dasharray="4 4"/>
    <path d="M60 30l-5 25h10z" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.15)"/>
    <line x1="60" y1="55" x2="60" y2="135" stroke="var(--accent)"/>
    <path d="M140 30v25c0 3 2 5 5 5s5-2 5-5V30M145 60v75" stroke="var(--accent)"/>
    <circle cx="100" cy="85" r="6" fill="var(--accent)" stroke="none"/>
  </svg>`,

  // Livre ouvert — pour Recettes vides
  recettes: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 50c0-3 2-5 5-5h60v90H35c-3 0-5-2-5-5z" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.08)"/>
    <path d="M170 50c0-3-2-5-5-5h-60v90h60c3 0 5-2 5-5z" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.08)"/>
    <line x1="45" y1="65" x2="85" y2="65" stroke="var(--text3)" opacity=".7"/>
    <line x1="45" y1="78" x2="80" y2="78" stroke="var(--text3)" opacity=".5"/>
    <line x1="45" y1="91" x2="85" y2="91" stroke="var(--text3)" opacity=".5"/>
    <line x1="45" y1="104" x2="75" y2="104" stroke="var(--text3)" opacity=".5"/>
    <line x1="115" y1="65" x2="155" y2="65" stroke="var(--text3)" opacity=".7"/>
    <line x1="115" y1="78" x2="150" y2="78" stroke="var(--text3)" opacity=".5"/>
    <line x1="115" y1="91" x2="155" y2="91" stroke="var(--text3)" opacity=".5"/>
    <line x1="115" y1="104" x2="145" y2="104" stroke="var(--text3)" opacity=".5"/>
  </svg>`,

  // Sac de courses — pour Liste d'ingrédients vide
  shopping: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M60 60h80l-7 75H67z" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.08)"/>
    <path d="M78 60V45c0-12 10-22 22-22s22 10 22 22v15" stroke="var(--accent)"/>
    <circle cx="85" cy="85" r="2.5" fill="var(--accent)"/>
    <circle cx="115" cy="85" r="2.5" fill="var(--accent)"/>
    <path d="M80 105c5 5 12 8 20 8s15-3 20-8" stroke="var(--accent)" opacity=".7"/>
  </svg>`,

  // Calendrier avec étoile — pour Événements vides
  evenements: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="45" y="45" width="110" height="90" rx="6" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.05)"/>
    <line x1="45" y1="65" x2="155" y2="65" stroke="var(--accent)"/>
    <line x1="70" y1="35" x2="70" y2="55" stroke="var(--accent)"/>
    <line x1="130" y1="35" x2="130" y2="55" stroke="var(--accent)"/>
    <path d="M100 82l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="var(--accent)" stroke="var(--accent)"/>
    <circle cx="65" cy="80" r="2" fill="var(--text3)"/>
    <circle cx="80" cy="80" r="2" fill="var(--text3)"/>
    <circle cx="65" cy="105" r="2" fill="var(--text3)"/>
    <circle cx="135" cy="80" r="2" fill="var(--text3)"/>
    <circle cx="135" cy="105" r="2" fill="var(--text3)"/>
  </svg>`,

  // Wallet — pour Dépenses vides
  depenses: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="40" y="55" width="120" height="75" rx="8" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.06)"/>
    <path d="M40 75h120" stroke="var(--accent)"/>
    <rect x="130" y="85" width="35" height="22" rx="4" fill="rgba(var(--accent-rgb),.15)" stroke="var(--accent)"/>
    <circle cx="145" cy="96" r="3" fill="var(--accent)" stroke="none"/>
    <path d="M55 50V40c0-3 2-5 5-5h75c3 0 5 2 5 5v15" stroke="var(--accent)"/>
  </svg>`,

  // Fournisseurs — store
  fournisseurs: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 70h120v65H40z" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.06)"/>
    <path d="M35 55l8-20h114l8 20" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.12)"/>
    <line x1="35" y1="55" x2="165" y2="55" stroke="var(--accent)"/>
    <line x1="60" y1="55" x2="60" y2="70" stroke="var(--accent)" opacity=".5"/>
    <line x1="85" y1="55" x2="85" y2="70" stroke="var(--accent)" opacity=".5"/>
    <line x1="115" y1="55" x2="115" y2="70" stroke="var(--accent)" opacity=".5"/>
    <line x1="140" y1="55" x2="140" y2="70" stroke="var(--accent)" opacity=".5"/>
    <rect x="85" y="95" width="30" height="40" stroke="var(--accent)" fill="none"/>
    <circle cx="105" cy="115" r="1.5" fill="var(--accent)"/>
  </svg>`,

  // Générique — pour fallback
  default: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="100" cy="80" r="40" stroke="var(--accent)" fill="rgba(var(--accent-rgb),.06)"/>
    <path d="M85 75c0-6 7-12 15-12s15 6 15 12-7 8-15 12v6" stroke="var(--accent)"/>
    <circle cx="100" cy="105" r="2.5" fill="var(--accent)" stroke="none"/>
  </svg>`
};

// Rendu d'un empty state illustré.
// Usage : renderEmptyState({ kind: "inventaire", title: "...", subtitle: "...", cta: { label, onClick } })
function renderEmptyState({ kind = "default", title = "Rien à afficher", subtitle = "", cta = null, hint = "" } = {}) {
  const svg = EMPTY_ILLUSTRATIONS[kind] || EMPTY_ILLUSTRATIONS.default;
  const ctaHtml = cta && cta.label
    ? `<button class="empty-illustrated__cta" onclick="${cta.onClick || ''}">${cta.icon ? icon(cta.icon, 16) : ''} ${cta.label}</button>`
    : "";
  return `<div class="empty-illustrated">
    <div class="empty-illustrated__svg">${svg}</div>
    <h3 class="empty-illustrated__title">${title}</h3>
    ${subtitle ? `<p class="empty-illustrated__subtitle">${subtitle}</p>` : ""}
    ${ctaHtml}
    ${hint ? `<div class="empty-illustrated__hint">${hint}</div>` : ""}
  </div>`;
}

// ── Confirmation visuelle après save sur un bouton ────
// Usage typique : await saveData(); flashSaveSuccess(btn); closeModal();
// Le bouton prend brièvement un état "saved" (✓ vert) avant que la modale
// ne se ferme. Donne un feedback rassurant à l'utilisateur.
function flashSaveSuccess(btnOrSelector, duration = 600) {
  const btn = (typeof btnOrSelector === "string") ? document.querySelector(btnOrSelector) : btnOrSelector;
  if (!btn) return Promise.resolve();
  const original = btn.innerHTML;
  const originalLabel = btn.textContent.trim();
  btn.classList.add("is-saved");
  // On garde le label original mais on ajoute le ✓ via CSS ::before
  btn.dataset.originalHtml = original;
  return new Promise(resolve => {
    setTimeout(() => {
      btn.classList.remove("is-saved");
      btn.innerHTML = original;
      delete btn.dataset.originalHtml;
      resolve();
    }, duration);
  });
}

// ── Toasts (remplacent les alert() natifs) ────────────
// Usage :
//   toast("Produit enregistré")              → info (défaut)
//   toast("Stock mis à jour", "success")     → vert
//   toast("Champ requis", "error")           → rouge
//   toast("Attention...", "warning")         → jaune
//   toast("Longue explication", "info", 6000) → durée custom (ms)
let _toastCounter = 0;
function toast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toasts");
  if (!container) { console.warn("toast: #toasts container missing"); return; }
  const id = "toast-" + (++_toastCounter);
  const iconMap = {
    success: "check-circle",
    error:   "alert",
    warning: "alert",
    info:    "info"
  };
  const iconName = iconMap[type] || "info";
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.id = id;
  el.setAttribute("role", type === "error" || type === "warning" ? "alert" : "status");
  el.innerHTML = `
    <span class="toast__icon">${icon(iconName, 18)}</span>
    <span class="toast__msg">${String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</span>
    <button class="toast__close" onclick="dismissToast('${id}')" aria-label="Fermer">${icon("x", 14)}</button>
  `;
  container.appendChild(el);
  // Animation slide-in
  requestAnimationFrame(() => el.classList.add("toast--visible"));
  // Auto-dismiss (sauf si duration = 0 = permanent)
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

function dismissToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("toast--visible");
  el.classList.add("toast--leaving");
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
}

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
    {
      title: "Événements",
      icon: "calendar",
      items: (typeof events !== "undefined" ? events : []).filter(ev =>
        (ev.name || "").toLowerCase().includes(q) ||
        (ev.contactName || "").toLowerCase().includes(q) ||
        (ev.notes || "").toLowerCase().includes(q)
      ).slice(0, 5)
        .map(ev => ({ label: ev.name, sub: `${ev.date || ""}${ev.time ? " · " + ev.time : ""}`, page: "evenements", id: ev.id, action: "openEventModal" }))
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
