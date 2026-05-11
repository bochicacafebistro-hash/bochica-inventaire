// ═══════════════════════════════════════════════════════════════
// ÉVÉNEMENTS — Calendrier (réservations, soirées spéciales, etc.)
// ───────────────────────────────────────────────────────────────
// Trois vues : Calendrier mensuel (grille), Ce mois-ci (liste),
// À venir (30 prochains jours). Filtre par type, recherche texte.
//
// Types fixes  : reservation, special, ferie, interne
// Statuts fixes: confirme, attente, annule
// Accès        : Admin (global_admin) + Chef
// ═══════════════════════════════════════════════════════════════

const EVENT_TYPES = ["reservation", "karaoke", "spectacle", "hors_bochica", "ferie", "interne"];
const EVENT_STATUSES = ["confirme", "attente", "annule"];

function tEventType(t) {
  const map = {
    reservation:  "Réservation privée",
    karaoke:      "Soirée karaoké",
    spectacle:    "Soirée spectacle",
    hors_bochica: "Événement hors Bochica",
    ferie:        "Journée fériée / fermeture",
    interne:      "Événement interne",
    // Rétrocompat : ancien type 'special' (avant v3.7.1)
    special:      "Soirée spéciale"
  };
  return map[t] || t || "—";
}

function tEventTypeShort(t) {
  const map = {
    reservation:  "Réservation",
    karaoke:      "Karaoké",
    spectacle:    "Spectacle",
    hors_bochica: "Hors Bochica",
    ferie:        "Férié",
    interne:      "Interne",
    special:      "Spécial"
  };
  return map[t] || t || "—";
}

function tEventStatus(s) {
  const map = {
    confirme: "Confirmé",
    attente:  "En attente",
    annule:   "Annulé"
  };
  return map[s] || s || "—";
}

// Icône par type d'événement
function eventTypeIcon(type) {
  const map = {
    reservation:  "users",
    karaoke:      "mic",
    spectacle:    "music",
    hors_bochica: "map-pin",
    ferie:        "flag",
    interne:      "briefcase",
    special:      "star"
  };
  return map[type] || "calendar";
}

// ─── Helpers de date ──────────────────────────────────
// On utilise toujours des strings YYYY-MM-DD en heure locale pour
// éviter les surprises de fuseau horaire (Firestore retourne du local).

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Convertit un YYYY-MM-DD en Date locale (à minuit local, pas UTC)
function isoToLocalDate(iso) {
  if (!iso || typeof iso !== "string") return null;
  const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Différence en jours (entiers) entre deux ISO dates (local)
function daysBetween(isoA, isoB) {
  const a = isoToLocalDate(isoA);
  const b = isoToLocalDate(isoB);
  if (!a || !b) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Affichage relatif convivial : Aujourd'hui / Demain / Dans 3 jours / Il y a 2 jours
function formatRelativeDate(iso) {
  const d = daysBetween(todayISO(), iso);
  if (d === null) return iso || "—";
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  if (d === -1) return "Hier";
  if (d > 1 && d <= 7) return `Dans ${d} jours`;
  if (d < -1 && d >= -7) return `Il y a ${Math.abs(d)} jours`;
  // Sinon date longue : 15 juin 2026
  const date = isoToLocalDate(iso);
  if (!date) return iso;
  const months = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Format long avec jour de semaine : Lundi 11 mai 2026
function formatLongDate(iso) {
  const date = isoToLocalDate(iso);
  if (!date) return iso || "—";
  const dows = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${dows[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Setters ──────────────────────────────────────────
function setEventsView(mode) {
  eventsViewMode = mode;
  renderPage();
}

function setEventsFilter(type) {
  eventsFilterType = type;
  renderPage();
}

function shiftEventCalendar(delta) {
  eventsCalendarOffset += delta;
  renderPage();
}

function resetEventCalendar() {
  eventsCalendarOffset = 0;
  renderPage();
}

function updateEventsSearch(v) {
  eventsSearchQuery = (v || "").toLowerCase();
  const activeId = document.activeElement?.id;
  renderPage();
  requestAnimationFrame(() => {
    if (activeId === "ev-search") {
      const el = document.getElementById("ev-search");
      if (el) {
        el.focus();
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
      }
    }
  });
}

// ─── Filtres ──────────────────────────────────────────
function getFilteredEvents() {
  const q = (eventsSearchQuery || "").trim();
  let items = events.slice();
  if (eventsFilterType !== "all") {
    items = items.filter(e => e.type === eventsFilterType);
  }
  if (q) {
    items = items.filter(e =>
      (e.name || "").toLowerCase().includes(q) ||
      (e.contactName || "").toLowerCase().includes(q) ||
      (e.notes || "").toLowerCase().includes(q)
    );
  }
  return items;
}

// ─── Rendu principal ──────────────────────────────────
function renderEvents() {
  const writable = canWrite("evenements");

  // Comptes par type (avant filtre, pour onglets)
  const counts = { all: events.length };
  EVENT_TYPES.forEach(typ => {
    counts[typ] = events.filter(e => e.type === typ).length;
  });

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">Événements</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">Calendrier · réservations, soirées spéciales, jours fériés, événements internes</p>
      </div>
      ${writable ? `<button class="btn btn-primary" onclick="openEventModal()">${icon("plus", 16)} Ajouter</button>` : ""}
    </div>`;

  // Empty state global
  if (events.length === 0) {
    h += `<div class="empty">
      <div class="empty-state-icon">${icon("calendar", 48)}</div>
      Aucun événement enregistré. ${writable ? "Cliquez sur « Ajouter » pour créer votre premier événement." : ""}
    </div>`;
    return h + `</div>`;
  }

  // ═ Onglets vues ═════════════════════════════════════
  h += `<div class="ev-views" role="tablist" aria-label="Mode de vue">
    <button class="ev-view-btn ${eventsViewMode === "calendar" ? "is-active" : ""}" onclick="setEventsView('calendar')" role="tab" aria-selected="${eventsViewMode === "calendar"}">
      ${icon("calendar", 14)} Calendrier
    </button>
    <button class="ev-view-btn ${eventsViewMode === "month" ? "is-active" : ""}" onclick="setEventsView('month')" role="tab" aria-selected="${eventsViewMode === "month"}">
      ${icon("calendar-range", 14)} Ce mois-ci
    </button>
    <button class="ev-view-btn ${eventsViewMode === "upcoming" ? "is-active" : ""}" onclick="setEventsView('upcoming')" role="tab" aria-selected="${eventsViewMode === "upcoming"}">
      ${icon("clock", 14)} À venir (30 j)
    </button>
  </div>`;

  // ═ Onglets type + recherche ═════════════════════════
  h += `<div class="ev-filters">
    <div class="ev-type-tabs" role="tablist" aria-label="Filtrer par type">
      <button class="ev-type-tab ${eventsFilterType === "all" ? "is-active" : ""}" onclick="setEventsFilter('all')">
        Tous <span class="ev-type-count">${counts.all}</span>
      </button>
      ${EVENT_TYPES.map(typ => `<button class="ev-type-tab ev-type-tab--${typ} ${eventsFilterType === typ ? "is-active" : ""}" onclick="setEventsFilter('${typ}')">
        ${icon(eventTypeIcon(typ), 12)} ${tEventTypeShort(typ)} <span class="ev-type-count">${counts[typ]}</span>
      </button>`).join("")}
    </div>
    <div class="ev-search-wrap">
      <span class="ev-search-icon">${icon("search", 16)}</span>
      <input id="ev-search" type="text" placeholder="Rechercher (nom, contact, notes)..." value="${esc(eventsSearchQuery || "")}" oninput="updateEventsSearch(this.value)" aria-label="Rechercher dans les événements"/>
      ${eventsSearchQuery ? `<button class="ev-search-clear" onclick="updateEventsSearch('')" aria-label="Effacer la recherche" title="Effacer">${icon("x", 14)}</button>` : ""}
    </div>
  </div>`;

  // ═ Vue active ═══════════════════════════════════════
  if (eventsViewMode === "calendar") {
    h += renderEventCalendar(writable);
  } else if (eventsViewMode === "month") {
    h += renderEventMonthList(writable);
  } else {
    h += renderEventUpcoming(writable);
  }

  return h + `</div>`;
}

// ─── Vue 1 : Calendrier mensuel (grille 7 colonnes) ───
function renderEventCalendar(writable) {
  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth() + eventsCalendarOffset, 1);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthLabel = baseDate.toLocaleDateString("fr-CA", { year: "numeric", month: "long" });

  // Premier jour de la grille : lundi de la semaine contenant le 1er
  const firstOfMonth = new Date(year, month, 1);
  // getDay : 0 = dimanche ... 6 = samedi. On veut Lundi en colonne 0.
  const dowMonStart = (firstOfMonth.getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche
  const gridStart = new Date(year, month, 1 - dowMonStart);

  // 42 cases (6 semaines × 7 jours)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push(d);
  }

  // Index des événements par date (filtrés)
  const filtered = getFilteredEvents();
  const evByDate = {};
  filtered.forEach(e => {
    if (!e.date) return;
    if (!evByDate[e.date]) evByDate[e.date] = [];
    evByDate[e.date].push(e);
  });

  const todayStr = todayISO();
  const dows = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  let h = `<div class="ev-calendar">
    <div class="ev-calendar__head">
      <button class="btn-icon-sm ev-cal-nav" onclick="shiftEventCalendar(-1)" aria-label="Mois précédent" title="Mois précédent">${icon("chevron-left", 16)}</button>
      <h3 class="ev-calendar__title">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
      <button class="btn-icon-sm ev-cal-nav" onclick="shiftEventCalendar(1)" aria-label="Mois suivant" title="Mois suivant">${icon("chevron-right", 16)}</button>
      ${eventsCalendarOffset !== 0 ? `<button class="btn-cancel ev-cal-today" onclick="resetEventCalendar()" title="Revenir au mois courant">Aujourd'hui</button>` : ""}
    </div>
    <div class="ev-calendar__dow">
      ${dows.map(d => `<div class="ev-calendar__dow-cell">${d}</div>`).join("")}
    </div>
    <div class="ev-calendar__grid">`;

  cells.forEach(d => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const inMonth = d.getMonth() === month;
    const isToday = iso === todayStr;
    const dayEvents = (evByDate[iso] || []).slice().sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const classes = [
      "ev-calendar__cell",
      inMonth ? "" : "is-other-month",
      isToday ? "is-today" : "",
      dayEvents.length ? "has-events" : ""
    ].filter(Boolean).join(" ");
    const clickHandler = writable
      ? `onclick="openEventModal('', '${iso}')"`
      : "";
    const title = writable ? `title="Ajouter un événement le ${iso}"` : "";

    h += `<div class="${classes}" ${clickHandler} ${title} role="${writable ? 'button' : 'cell'}" tabindex="${writable ? '0' : '-1'}">
      <div class="ev-calendar__day-num">${d.getDate()}</div>
      <div class="ev-calendar__day-list">`;
    // Afficher max 3 events + "+N"
    const visible = dayEvents.slice(0, 3);
    const hidden = dayEvents.length - visible.length;
    visible.forEach(e => {
      const status = e.status || "confirme";
      const typ = e.type || "interne";
      h += `<button class="ev-cal-pill ev-cal-pill--${typ} ev-cal-pill--status-${status}" onclick="event.stopPropagation();openEventModal('${e.id}')" title="${esc(e.name || "")} ${e.time ? "· " + esc(e.time) : ""}">
        ${e.time ? `<span class="ev-cal-pill__time">${esc(e.time)}</span>` : ""}<span class="ev-cal-pill__name">${esc(e.name || "?")}</span>
      </button>`;
    });
    if (hidden > 0) {
      h += `<div class="ev-cal-more">+${hidden} autre${hidden > 1 ? "s" : ""}</div>`;
    }
    h += `</div></div>`;
  });

  h += `</div>
    <div class="ev-calendar__legend">
      <span class="ev-legend-item"><span class="ev-legend-dot ev-legend-dot--reservation"></span>Réservation</span>
      <span class="ev-legend-item"><span class="ev-legend-dot ev-legend-dot--karaoke"></span>Karaoké</span>
      <span class="ev-legend-item"><span class="ev-legend-dot ev-legend-dot--spectacle"></span>Spectacle</span>
      <span class="ev-legend-item"><span class="ev-legend-dot ev-legend-dot--hors_bochica"></span>Hors Bochica</span>
      <span class="ev-legend-item"><span class="ev-legend-dot ev-legend-dot--ferie"></span>Férié / fermeture</span>
      <span class="ev-legend-item"><span class="ev-legend-dot ev-legend-dot--interne"></span>Interne</span>
    </div>
  </div>`;

  return h;
}

// ─── Vue 2 : Liste « Ce mois-ci » ─────────────────────
function renderEventMonthList(writable) {
  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth() + eventsCalendarOffset, 1);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthLabel = baseDate.toLocaleDateString("fr-CA", { year: "numeric", month: "long" });
  const startIso = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const items = getFilteredEvents()
    .filter(e => e.date && e.date >= startIso && e.date <= endIso)
    .sort((a, b) => {
      const c = (a.date || "").localeCompare(b.date || "");
      if (c !== 0) return c;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });

  let h = `<div class="ev-month-list">
    <div class="ev-calendar__head">
      <button class="btn-icon-sm ev-cal-nav" onclick="shiftEventCalendar(-1)" aria-label="Mois précédent">${icon("chevron-left", 16)}</button>
      <h3 class="ev-calendar__title">${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
      <button class="btn-icon-sm ev-cal-nav" onclick="shiftEventCalendar(1)" aria-label="Mois suivant">${icon("chevron-right", 16)}</button>
      ${eventsCalendarOffset !== 0 ? `<button class="btn-cancel ev-cal-today" onclick="resetEventCalendar()">Aujourd'hui</button>` : ""}
    </div>`;

  if (items.length === 0) {
    h += `<div class="empty" style="margin-top:12px">
      <div class="empty-state-icon">${icon("calendar", 36)}</div>
      Aucun événement ce mois-ci avec ces filtres.
    </div></div>`;
    return h;
  }

  h += renderEventCards(items, writable);
  return h + `</div>`;
}

// ─── Vue 3 : Liste « À venir » (30 prochains jours) ──
function renderEventUpcoming(writable) {
  const today = todayISO();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const endIso = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, "0")}-${String(in30.getDate()).padStart(2, "0")}`;

  const items = getFilteredEvents()
    .filter(e => e.date && e.date >= today && e.date <= endIso)
    .sort((a, b) => {
      const c = (a.date || "").localeCompare(b.date || "");
      if (c !== 0) return c;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });

  let h = `<div class="ev-upcoming">
    <div class="ev-upcoming__head">
      <h3 class="ev-calendar__title">${icon("clock", 16)} 30 prochains jours</h3>
      <span class="ev-upcoming__count">${items.length} événement${items.length === 1 ? "" : "s"}</span>
    </div>`;

  if (items.length === 0) {
    h += `<div class="empty" style="margin-top:12px">
      <div class="empty-state-icon">${icon("calendar", 36)}</div>
      Aucun événement à venir dans les 30 prochains jours.
    </div></div>`;
    return h;
  }

  h += renderEventCards(items, writable);
  return h + `</div>`;
}

// ─── Rendu : liste de cartes événements ───────────────
function renderEventCards(items, writable) {
  let h = `<div class="ev-card-list">`;
  items.forEach(e => {
    const typ = e.type || "interne";
    const status = e.status || "confirme";
    const isPast = e.date && e.date < todayISO();
    h += `<article class="ev-card ev-card--${typ} ${isPast ? "is-past" : ""} ${status === "annule" ? "is-cancelled" : ""}">
      <div class="ev-card__date">
        <div class="ev-card__date-day">${e.date ? isoToLocalDate(e.date).getDate() : "?"}</div>
        <div class="ev-card__date-mon">${e.date ? isoToLocalDate(e.date).toLocaleDateString("fr-CA", { month: "short" }).replace(".", "") : ""}</div>
        <div class="ev-card__date-rel">${formatRelativeDate(e.date)}</div>
      </div>
      <div class="ev-card__body">
        <div class="ev-card__head-row">
          <h4 class="ev-card__name">${esc(e.name || "?")}</h4>
          <div class="ev-card__pills">
            <span class="ev-type-pill ev-type-pill--${typ}">${icon(eventTypeIcon(typ), 11)} ${tEventTypeShort(typ)}</span>
            <span class="ev-status-pill ev-status-pill--${status}">${tEventStatus(status)}</span>
          </div>
        </div>
        <div class="ev-card__meta">
          ${e.time ? `<span class="ev-card__meta-item">${icon("clock", 12)} ${esc(e.time)}</span>` : ""}
          ${e.capacity ? `<span class="ev-card__meta-item">${icon("users", 12)} ${esc(String(e.capacity))} pers.</span>` : ""}
          ${e.contactName ? `<span class="ev-card__meta-item">${icon("user", 12)} ${esc(e.contactName)}</span>` : ""}
          ${e.contactPhone ? `<span class="ev-card__meta-item">${icon("phone", 12)} ${esc(e.contactPhone)}</span>` : ""}
          ${e.contactEmail ? `<span class="ev-card__meta-item">${icon("mail", 12)} ${esc(e.contactEmail)}</span>` : ""}
        </div>
        ${e.notes ? `<div class="ev-card__notes">${esc(e.notes)}</div>` : ""}
      </div>
      ${writable ? `<div class="ev-card__actions">
        <div class="menu-wrap">
          <button class="dots-btn" onclick="toggleDrop('ev${e.id}')" aria-label="Actions">${icon("more-vertical", 16)}</button>
          <div class="dropdown" id="drop-ev${e.id}">
            <button onclick="openEventModal('${e.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
            <button onclick="duplicateItem('events','${e.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
            <div class="sep"></div>
            <button class="text-danger" onclick="askDelete('events','${e.id}','${esc(e.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
          </div>
        </div>
      </div>` : ""}
    </article>`;
  });
  h += `</div>`;
  return h;
}

// ─── Modal ajout / édition ────────────────────────────
// presetDate : si fourni, pré-remplit le champ date (clic sur cellule du calendrier)
function openEventModal(id, presetDate) {
  const ev = id ? events.find(x => x.id === id) : null;
  const defDate = ev?.date || presetDate || todayISO();

  showModal(`<div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h3>${ev ? "Modifier l'événement" : "Nouvel événement"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>Nom <input id="ev-name" value="${esc(ev?.name || "")}" placeholder="ex: Anniversaire Mme Dupont, Soirée tapas..."/></label>

    <div class="form-row">
      <label>Date <input id="ev-date" type="date" value="${esc(defDate)}"/></label>
      <label>Heure (optionnel) <input id="ev-time" type="time" value="${esc(ev?.time || "")}"/></label>
    </div>

    <div class="form-row">
      <label>Type
        <select id="ev-type">
          ${EVENT_TYPES.map(typ => `<option value="${typ}" ${(ev?.type || "reservation") === typ ? "selected" : ""}>${tEventType(typ)}</option>`).join("")}
        </select>
      </label>
      <label>Statut
        <select id="ev-status">
          ${EVENT_STATUSES.map(s => `<option value="${s}" ${(ev?.status || "confirme") === s ? "selected" : ""}>${tEventStatus(s)}</option>`).join("")}
        </select>
      </label>
    </div>

    <label>Nombre de personnes (capacité) <input id="ev-capacity" type="number" min="0" step="1" value="${esc(ev?.capacity != null ? String(ev.capacity) : "")}" placeholder="ex: 25"/></label>

    <h4 style="font-family:var(--font-heading);font-size:15px;margin:14px 0 6px;letter-spacing:.04em;color:var(--text2)">Contact</h4>
    <label>Nom du contact <input id="ev-contact-name" value="${esc(ev?.contactName || "")}" placeholder="ex: Marie Tremblay"/></label>
    <div class="form-row">
      <label>Téléphone <input id="ev-contact-phone" type="tel" value="${esc(ev?.contactPhone || "")}" placeholder="514-555-1234"/></label>
      <label>Courriel <input id="ev-contact-email" type="email" value="${esc(ev?.contactEmail || "")}" placeholder="contact@exemple.ca"/></label>
    </div>

    <label>Notes <textarea id="ev-notes" style="height:80px" placeholder="Demandes particulières, menu, allergies, dépôt versé, etc.">${esc(ev?.notes || "")}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveEvent('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);

  setTimeout(() => {
    const el = document.getElementById("ev-name");
    if (el) { el.focus(); if (typeof el.select === "function") el.select(); }
  }, 50);
}

async function saveEvent(id) {
  const name = document.getElementById("ev-name").value.trim();
  if (!name) return toast("Veuillez saisir un nom.", "error");
  const date = document.getElementById("ev-date").value;
  if (!date) return toast("Veuillez choisir une date.", "error");
  const type = document.getElementById("ev-type").value;
  if (!EVENT_TYPES.includes(type)) return toast("Type invalide.", "error");
  const status = document.getElementById("ev-status").value;
  if (!EVENT_STATUSES.includes(status)) return toast("Statut invalide.", "error");

  const capacityRaw = document.getElementById("ev-capacity").value;
  const capacity = capacityRaw === "" ? null : Math.max(0, Math.floor(Number(capacityRaw) || 0));

  const data = {
    name,
    date,
    time: document.getElementById("ev-time").value || "",
    type,
    status,
    capacity,
    contactName:  document.getElementById("ev-contact-name").value.trim(),
    contactPhone: document.getElementById("ev-contact-phone").value.trim(),
    contactEmail: document.getElementById("ev-contact-email").value.trim(),
    notes:        document.getElementById("ev-notes").value.trim(),
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) {
      await db.collection("events").doc(id).update(data);
      await addLog(name, "Événement — modifié", `${tEventType(type)} · ${formatLongDate(date)}`);
      toast("Événement modifié.", "success");
    } else {
      const nid = genId();
      await db.collection("events").doc(nid).set({
        ...data,
        id: nid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await addLog(name, "Événement — ajouté", `${tEventType(type)} · ${formatLongDate(date)}`);
      toast("Événement ajouté.", "success");
    }
    closeModal();
  } catch (err) {
    console.error("saveEvent:", err);
    toast("Erreur sauvegarde : " + (err.message || err), "error");
  }
}
