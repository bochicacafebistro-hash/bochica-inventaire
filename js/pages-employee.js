// ═══════════════════════════════════════════════════════════════
// PAGES EMPLOYÉ — Vues allégées pour le rôle « employee »
// ───────────────────────────────────────────────────────────────
// Deux pages pensées pour l'équipe, SANS aucune donnée financière
// (taux horaires, coûts, salaires, ratios, totaux $). Elles lisent
// les mêmes collections Firestore (employees, events, products) que
// les pages admin, mais n'affichent jamais les champs sensibles.
//
//   - accueil      → renderEmployeeDashboard()  : tableau de bord du jour
//   - mon-horaire  → renderEmployeeSchedule()   : horaire de la semaine (lecture seule)
//
// ⚠️ IMPORTANT : ne JAMAIS rendre emp.hourlyRate, emp.fixedWeeklyHours,
// les coûts, ratios ou montants $ ici. Les heures (durée des shifts)
// ne sont pas considérées comme sensibles et restent affichées.
// ═══════════════════════════════════════════════════════════════

// Offset de semaine propre à la page employé (0 = semaine en cours).
// Indépendant de scheduleWeekOffset (page admin) pour éviter les effets
// de bord entre les deux vues.
let empSchedWeekOffset = 0;

// Couleur de la pastille de section (réutilise la convention du dashboard admin)
function empSectionColor(sec) {
  return sec === "cuisine" ? "#7dbf66" : sec === "service" ? "#4a90e2" : "#94a3b8";
}
function empSectionLabel(sec) {
  return sec === "cuisine" ? "Cuisine" : sec === "service" ? "Service" : "Autre";
}

// ═══════════════════════════════════════════════════════════════
// TABLEAU DE BORD EMPLOYÉ — accueil
// ───────────────────────────────────────────────────────────────
// 3 blocs : En service aujourd'hui · Prochains événements ·
// Tâches de la journée (cochables, défini dans pages-ops.js).
// (v3.36.0 : retrait des blocs « Horaire de l'équipe » et
//  « À réapprovisionner » à la demande — l'horaire a déjà sa page.)
// ═══════════════════════════════════════════════════════════════
function renderEmployeeDashboard() {
  const now = new Date();
  const todayStr = dayKey(now); // YYYY-MM-DD en heure locale
  const dayName = now.toLocaleDateString("fr-CA", { weekday: "long" });
  const dateLong = now.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  const dayDisplay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

  // ── Bloc 1 : employés en service aujourd'hui ──────────────────
  const empList = (typeof employees !== "undefined" ? employees : []);
  const shiftsToday = empList
    .map(emp => {
      const s = (emp.shifts || {})[todayStr];
      if (!s || !s.start) return null;
      return { name: emp.name || "—", start: s.start, end: s.end || "", section: emp.section || "service" };
    })
    .filter(Boolean)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

  // ── Bloc 2 : prochains événements (aujourd'hui → +30 j, non annulés) ──
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  const in30Str = dayKey(in30);
  const upcomingEvents = (typeof events !== "undefined" ? events : [])
    .filter(e => e.date && e.date >= todayStr && e.date <= in30Str && e.status !== "annule")
    .sort((a, b) => {
      const c = (a.date || "").localeCompare(b.date || "");
      if (c !== 0) return c;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    })
    .slice(0, 6);

  // ── Bloc 3 : tâches de la journée → délégué à renderDailyTasksBlock()
  //    (défini dans pages-ops.js). Remplace l'ancien aperçu d'horaire +
  //    la liste « à réapprovisionner » retirés en v3.36.0.

  // Label jour court relatif pour les événements
  const eventDayLabel = (dateStr) => {
    if (dateStr === todayStr) return "Auj.";
    const ed = new Date(dateStr + "T00:00:00");
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === dayKey(tomorrow)) return "Demain";
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return `${days[ed.getDay()]} ${ed.getDate()}`;
  };

  return `<div class="page">
    <div class="dash-today-widget">
      <div class="dash-today-widget__head">
        <div>
          <h2 class="dash-today-widget__date">${dayDisplay}<small>${dateLong}</small></h2>
        </div>
        <div class="emp-dash-hello">
          ${icon("utensils", 18)} <span>Bienvenue chez Bochica</span>
        </div>
      </div>

      <div class="dash-today-widget__grid">
        <!-- Bloc 1 : En service aujourd'hui -->
        <div class="dash-today-block">
          <div class="dash-today-block__title">${icon("users", 12)} En service aujourd'hui (${shiftsToday.length})</div>
          <div class="dash-today-block__list">
            ${shiftsToday.length === 0
              ? `<div class="dash-today-empty">Aucun shift planifié aujourd'hui</div>`
              : shiftsToday.slice(0, 8).map(s => `<div class="dash-today-item">
                  <span style="width:6px;height:6px;border-radius:50%;background:${empSectionColor(s.section)};flex-shrink:0"></span>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.name)}</span>
                  <span class="dash-today-item__time">${s.start}${s.end ? "–" + s.end : ""}</span>
                </div>`).join("")
                + (shiftsToday.length > 8 ? `<div class="dash-today-empty">+ ${shiftsToday.length - 8} autres</div>` : "")
            }
          </div>
        </div>

        <!-- Bloc 2 : Prochains événements -->
        <div class="dash-today-block">
          <div class="dash-today-block__title">${icon("calendar", 12)} Prochains événements (${upcomingEvents.length})</div>
          <div class="dash-today-block__list">
            ${upcomingEvents.length === 0
              ? `<div class="dash-today-empty">Aucun événement dans les 30 jours</div>`
              : upcomingEvents.map(e => {
                  const isToday = e.date === todayStr;
                  const cap = Number(e.capacity) > 0 ? `${e.capacity} pers` : "";
                  return `<div class="dash-today-item ${isToday ? "is-today" : ""}">
                    <span class="dash-today-item__day">${eventDayLabel(e.date)}</span>
                    <span style="display:inline-flex;align-items:center;color:${empSectionColor("")}">${icon(eventTypeIcon(e.type), 12)}</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(e.name || "Sans nom")}</span>
                    ${cap ? `<span class="dash-today-item__time">${cap}</span>` : (e.time ? `<span class="dash-today-item__time">${e.time}</span>` : "")}
                  </div>`;
                }).join("")
            }
          </div>
        </div>

        <!-- Bloc 3 : Tâches de la journée (cochables) -->
        ${typeof renderDailyTasksBlock === "function" ? renderDailyTasksBlock() : ""}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// HORAIRE EMPLOYÉ — mon-horaire (lecture seule, aucun $)
// ───────────────────────────────────────────────────────────────
// Grille employés × jours réutilisant le look empgrid, mais sans
// taux, sans coûts, sans totaux $. Affiche les heures entrée→sortie
// et la durée (heures), plus « Congé » pour les jours sans shift.
// Navigation de semaine en lecture seule (défaut = semaine en cours).
// ═══════════════════════════════════════════════════════════════
function changeEmpSchedWeek(delta) {
  empSchedWeekOffset += delta;
  if (typeof renderPage === "function") renderPage();
}
function resetEmpSchedWeek() {
  empSchedWeekOffset = 0;
  if (typeof renderPage === "function") renderPage();
}

function renderEmployeeSchedule() {
  const weekStart = getWeekStart(empSchedWeekOffset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekNum = getISOWeek(weekDaysAll[3]); // jeudi = référence semaine ISO
  const weekLabel = `${weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })} – ${weekDaysAll[6].toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;
  const todayStr = dayKey(new Date());

  // Jours ouverts (mêmes réglages que la page admin, fallback = tous)
  const openDays = (typeof scheduleSettings !== "undefined" && Array.isArray(scheduleSettings.openDays))
    ? scheduleSettings.openDays : [0, 1, 2, 3, 4, 5, 6];
  const visibleIdx = [0, 1, 2, 3, 4, 5, 6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);
  const nCols = visibleIdx.length;

  const empList = (typeof employees !== "undefined" ? employees : []);

  // Pré-calcul : lignes employés avec leurs shifts du jour.
  // (On n'affiche PAS le nombre d'heures travaillées — seulement les
  //  plages entrée→sortie, qui constituent l'horaire lui-même.)
  const empRows = empList.map(emp => {
    const shifts = emp.shifts || {};
    const daily = weekDays.map(d => ({ shift: shifts[dayKey(d)] }));
    return { emp, daily };
  });

  // Compteur de personnes par jour (pour le header)
  const dayCounts = weekDays.map((d, k) =>
    empRows.filter(r => r.daily[k]?.shift?.start && r.daily[k]?.shift?.end).length
  );

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("clock", 20)} Horaire de la semaine</h2>
    </div>

    ${empList.length === 0
      ? `<div class="empty"><div class="empty-state-icon">${icon("clock", 36)}</div>Aucun horaire publié pour le moment.</div>`
      : `
      <!-- Sélecteur de semaine (lecture seule) -->
      <div class="schedule-header">
        <div class="schedule-nav">
          <button class="btn-icon-only" onclick="changeEmpSchedWeek(-1)" aria-label="Semaine précédente" title="Semaine précédente">${icon("chevron-left", 16)}</button>
          <div class="schedule-week-label">
            <div class="schedule-week-num">Semaine ${weekNum}</div>
            <div class="schedule-week-dates">${weekLabel}</div>
            ${empSchedWeekOffset !== 0 ? `<button class="schedule-today-btn" onclick="resetEmpSchedWeek()">Cette semaine</button>` : `<div class="schedule-today-tag">Cette semaine</div>`}
          </div>
          <button class="btn-icon-only" onclick="changeEmpSchedWeek(1)" aria-label="Semaine suivante" title="Semaine suivante">${icon("chevron-right", 16)}</button>
        </div>
      </div>

      <!-- Grille employés × jours (lecture seule, sans donnée financière) -->
      <div class="schedule-empgrid emp-schedule-empgrid" style="--n-days:${nCols};">
        <div class="schedule-empgrid-header">
          <div class="schedule-empgrid-emp-head">Employé</div>
          ${weekDays.map((d, k) => {
            const dowIdx = visibleIdx[k];
            const isToday = dayKey(d) === todayStr;
            return `<div class="schedule-empgrid-day-head ${isToday ? "is-today" : ""}">
              <div class="schedule-empgrid-day-name">${DAYS_FR[dowIdx]}</div>
              <div class="schedule-empgrid-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
              <div class="schedule-empgrid-day-count">${dayCounts[k]} pers</div>
            </div>`;
          }).join("")}
        </div>

        ${empRows.map(row => {
          const emp = row.emp;
          const sec = (emp.section || "service");
          const secCls = sec === "cuisine" ? "is-kitchen" : sec === "service" ? "is-service" : "is-other";
          return `<div class="schedule-empgrid-row">
            <div class="schedule-empgrid-emp ${secCls}">
              <div class="schedule-empgrid-emp-row">
                <div class="schedule-empgrid-emp-name">${esc(emp.name || "—")}</div>
              </div>
              <div class="schedule-empgrid-emp-meta">
                <span class="schedule-empgrid-emp-section">${empSectionLabel(sec)}</span>
              </div>
            </div>
            ${row.daily.map((d, k) => {
              const isToday = dayKey(weekDays[k]) === todayStr;
              const s = d.shift;
              const hasShift = s && s.start && s.end;
              if (!hasShift) {
                return `<div class="schedule-empgrid-cell schedule-empgrid-cell--empty ${isToday ? "is-today-col" : ""}">
                  <div class="shift-card shift-card--off shift-card--readonly">
                    <div class="shift-off-label">Congé</div>
                  </div>
                </div>`;
              }
              return `<div class="schedule-empgrid-cell ${isToday ? "is-today-col" : ""}">
                <div class="shift-card shift-card--compact shift-card--readonly ${secCls}">
                  <div class="shift-card-time">${s.start} → ${s.end}</div>
                </div>
              </div>`;
            }).join("")}
          </div>`;
        }).join("")}
      </div>

      <p class="emp-schedule-note">${icon("info", 13)} Horaire indicatif de la semaine. Pour toute question, voir un responsable.</p>
      `
    }
  </div>`;
}
