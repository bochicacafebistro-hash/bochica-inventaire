// ═══════════════════════════════════════════════════════════════
// OPÉRATIONS — Tâches du jour + Ouverture / Fermeture
// ───────────────────────────────────────────────────────────────
// Deux fonctionnalités liées à l'exploitation quotidienne du resto :
//
//  1) TÂCHES DE LA JOURNÉE (collection /dailyTasks)
//     - Définies par l'admin (page « Tâches du jour », admin only).
//     - Deux types :
//         • "recurring" → réapparaît chaque jour ; le « complété » se
//           réinitialise automatiquement à minuit (basé sur lastCompletedDate).
//         • "once"      → tâche ponctuelle, faite une seule fois (done=true).
//     - Affichées (et cochables) par les employés sur la page Accueil.
//       Cocher = marquer complété pour AUJOURD'HUI (état partagé, pas par employé).
//
//  2) OUVERTURE / FERMETURE (doc /settings/openClose)
//     - Deux listes de RÉFÉRENCE (lecture seule pour tous) : opening[] + closing[].
//     - Définies par l'admin (bouton « Modifier les listes »).
//     - Page visible par employés + admin (le chef n'y a pas accès).
//
// ⚠ Aucune donnée financière ici — sûr pour le rôle employee.
// ═══════════════════════════════════════════════════════════════

// ── Helpers complétion ─────────────────────────────────────────
// Une tâche récurrente est « faite aujourd'hui » si lastCompletedDate == today.
// Une tâche ponctuelle est « faite » si done == true.
function isDailyTaskDoneToday(task, todayStr) {
  if (!task) return false;
  if (task.type === "once") return !!task.done;
  return task.lastCompletedDate === todayStr; // récurrente
}

// Faut-il afficher cette tâche sur l'accueil employé aujourd'hui ?
//   • récurrente : toujours.
//   • ponctuelle : tant qu'elle n'est pas faite, OU si elle a été faite
//     AUJOURD'HUI (on la garde barrée le reste de la journée puis elle
//     disparaît le lendemain pour ne pas encombrer).
function shouldShowDailyTaskToday(task, todayStr) {
  if (!task) return false;
  if (task.type === "once") return !task.done || task.doneDate === todayStr;
  return true;
}

// Tri d'affichage : récurrentes d'abord, puis ponctuelles ; sortOrder ensuite.
function sortedDailyTasks() {
  return (typeof dailyTasks !== "undefined" ? dailyTasks : []).slice().sort((a, b) => {
    const ta = a.type === "once" ? 1 : 0;
    const tb = b.type === "once" ? 1 : 0;
    if (ta !== tb) return ta - tb;
    return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
  });
}

// ── Occurrences (« plusieurs fois par jour », v3.48.0) ─────────
// Une tâche récurrente peut avoir PLUSIEURS heures (`times[]`), donc
// plusieurs passages cochables indépendamment dans la même journée
// (ex. nettoyer les salles de bain à 12:00, 17:00, 21:00).
//   • `times[]` présent (≥1) → système MULTI : complétion par index dans
//     `dayState = { date:"YYYY-MM-DD", done:{ "0":qui, "1":qui } }`, remis à
//     zéro chaque jour (on ignore dayState si la date n'est pas aujourd'hui).
//   • `times[]` absent/vide → système MONO legacy (champ `time` unique +
//     done/doneDate pour ponctuelle, lastCompletedDate pour récurrente).

// Liste des heures multi d'une tâche, ou null si mono-occurrence legacy.
function dailyTaskTimes(task) {
  const arr = Array.isArray(task && task.times) ? task.times.map(s => (s || "").trim()) : null;
  return (arr && arr.length) ? arr : null;
}

// Un passage MULTI (index idx) est-il fait aujourd'hui ?
function isOccDoneToday(task, idx, todayStr) {
  const ds = task && task.dayState;
  return !!(ds && ds.date === todayStr && ds.done && ds.done[idx]);
}

// Occurrences d'une tâche avec leur état du jour :
//   [{ idx, time, done, multi, count }]
function dailyTaskOccurrences(task, todayStr) {
  const times = dailyTaskTimes(task);
  if (times) {
    return times.map((tm, i) => ({
      idx: i, time: tm, done: isOccDoneToday(task, i, todayStr), multi: true, count: times.length
    }));
  }
  return [{ idx: 0, time: (task.time || "").trim(), done: isDailyTaskDoneToday(task, todayStr), multi: false, count: 1 }];
}

// Comparateur chronologique de deux « unités d'occurrence » {task, occ} :
// celles avec heure d'abord (heure croissante), puis sans heure ; départage
// récurrentes avant ponctuelles, puis sortOrder.
function compareOccUnits(a, b) {
  const ta = a.occ.time, tb = b.occ.time;
  if (ta && tb) { if (ta !== tb) return ta < tb ? -1 : 1; }
  else if (ta && !tb) return -1;
  else if (!ta && tb) return 1;
  const oa = a.task.type === "once" ? 1 : 0, ob = b.task.type === "once" ? 1 : 0;
  if (oa !== ob) return oa - ob;
  return (a.task.sortOrder ?? 999) - (b.task.sortOrder ?? 999);
}

// ── Toggle d'un passage MULTI (employé ou admin) ───────────────
async function toggleDailyOcc(id, idx) {
  const task = (typeof dailyTasks !== "undefined" ? dailyTasks : []).find(t => t.id === id);
  if (!task) return;
  const todayStr = dayKey(new Date());
  const who = (typeof loggedInUser !== "undefined" && loggedInUser?.name) ? loggedInUser.name : "";
  const ds = (task.dayState && task.dayState.date === todayStr) ? task.dayState : { date: todayStr, done: {} };
  const done = { ...(ds.done || {}) };
  if (done[idx]) delete done[idx];
  else done[idx] = who || true;
  try {
    await db.collection("dailyTasks").doc(id).update({
      dayState: { date: todayStr, done }, updatedAt: Date.now()
    });
  } catch (err) {
    console.error("toggleDailyOcc:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// BLOC « Tâches de la journée » — injecté dans l'accueil employé
// ───────────────────────────────────────────────────────────────
// Rendu d'un bloc compatible avec la grille .dash-today-widget__grid.
// Les items sont cochables (clic → toggleDailyTask).
// ═══════════════════════════════════════════════════════════════
// Catégorie d'affichage (v3.49.0) : "recurrent" (récurrentes / régulières) ou
// "idle" (temps mort — à faire quand c'est tranquille). Défaut : recurrent.
function taskBucket(task) {
  return (task && task.bucket === "idle") ? "idle" : "recurrent";
}

// Aplatit une liste de tâches en unités d'occurrence {task, occ} visibles
// aujourd'hui, triées dans l'ordre chronologique de la journée.
function buildTaskUnits(tasks, todayStr) {
  const units = [];
  (tasks || [])
    .filter(task => shouldShowDailyTaskToday(task, todayStr))
    .forEach(task => {
      dailyTaskOccurrences(task, todayStr).forEach(occ => units.push({ task, occ }));
    });
  units.sort(compareOccUnits);
  return units;
}

// Carte cochable d'une unité d'occurrence (partagée accueil + page dédiée).
function renderTaskUnitCard({ task, occ }) {
  const done = occ.done;
  const isOnce = task.type === "once";
  const note = (task.note || "").trim();
  const onclick = occ.multi ? `toggleDailyOcc('${task.id}',${occ.idx})` : `toggleDailyTask('${task.id}')`;
  return `<button class="daily-task-card ${done ? "is-done" : ""}" onclick="${onclick}" aria-pressed="${done}" title="${done ? t("ops_uncheck") : t("ops_mark_done")}">
    <div class="daily-task-card__main">
      <span class="daily-task-check">${done ? icon("check", 13) : ""}</span>
      <span class="daily-task-label">${esc(task.title || "—")}</span>
      ${occ.time ? `<span class="daily-task-time">${icon("clock", 11)} ${esc(occ.time)}</span>` : ""}
      ${occ.count > 1 ? `<span class="daily-task-tag daily-task-tag--occ">${occ.idx + 1}/${occ.count}</span>` : ""}
      ${isOnce ? `<span class="daily-task-tag daily-task-tag--once">1×</span>` : ""}
    </div>
    ${note ? `<div class="daily-task-note">${esc(note)}</div>` : ""}
  </button>`;
}

function renderDailyTasksBlock() {
  const todayStr = dayKey(new Date());
  // Aperçu accueil : toutes les tâches du jour (les 2 catégories), chronologique.
  const units = buildTaskUnits((typeof dailyTasks !== "undefined" ? dailyTasks : []), todayStr);
  const doneCount = units.filter(u => u.occ.done).length;

  return `<div class="dash-today-block">
    <div class="dash-today-block__title">${icon("clipboard", 12)} ${t("ops_daily_title")} (${doneCount}/${units.length})</div>
    <div class="dash-today-block__list">
      ${units.length === 0
        ? `<div class="dash-today-empty">${t("ops_no_tasks_today")}</div>`
        : units.map(renderTaskUnitCard).join("")
      }
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE DÉDIÉE EMPLOYÉ — « Tâches » (Récurrentes / Temps mort)
// ───────────────────────────────────────────────────────────────
// Deux sections distinctes, chacune triée chronologiquement. Visible
// employés + admin (aperçu). Mêmes cartes cochables que l'accueil.
// ═══════════════════════════════════════════════════════════════
function renderEmployeeTasks() {
  const todayStr = dayKey(new Date());
  const all = (typeof dailyTasks !== "undefined" ? dailyTasks : []);
  const section = (bucket, ic, title, emptyMsg) => {
    const units = buildTaskUnits(all.filter(tk => taskBucket(tk) === bucket), todayStr);
    const done = units.filter(u => u.occ.done).length;
    return `<div class="card emp-tasks-card emp-tasks-card--${bucket}">
      <h3 class="emp-tasks-title">${icon(ic, 16)} ${title}
        ${units.length ? `<span class="openclose-progress">${done}/${units.length}</span>` : ""}
      </h3>
      <div class="dash-today-block__list">
        ${units.length === 0
          ? `<div class="dash-today-empty">${emptyMsg}</div>`
          : units.map(renderTaskUnitCard).join("")}
      </div>
    </div>`;
  };
  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("clipboard", 20)} ${t("ops_daily_title")}</h2>
    </div>
    <div class="emp-tasks-grid">
      ${section("recurrent", "refresh", t("ops_sec_recurrent"), t("ops_no_recurrent_today"))}
      ${section("idle", "clock", t("ops_sec_idle"), t("ops_no_idle_today"))}
    </div>
    <p class="emp-schedule-note">${icon("info", 13)} ${t("ops_emp_tasks_note")}</p>
  </div>`;
}

// ── Toggle complétion d'une tâche (employé ou admin) ───────────
async function toggleDailyTask(id) {
  const task = (typeof dailyTasks !== "undefined" ? dailyTasks : []).find(t => t.id === id);
  if (!task) return;
  const todayStr = dayKey(new Date());
  const doneNow = isDailyTaskDoneToday(task, todayStr);
  const who = (typeof loggedInUser !== "undefined" && loggedInUser?.name) ? loggedInUser.name : "";
  try {
    let patch;
    if (task.type === "once") {
      patch = doneNow
        ? { done: false, doneAt: null, doneDate: null, doneBy: null, updatedAt: Date.now() }
        : { done: true, doneAt: Date.now(), doneDate: todayStr, doneBy: who, updatedAt: Date.now() };
    } else {
      // récurrente : on stocke / efface la date de complétion du jour
      patch = doneNow
        ? { lastCompletedDate: null, lastCompletedBy: null, updatedAt: Date.now() }
        : { lastCompletedDate: todayStr, lastCompletedBy: who, updatedAt: Date.now() };
    }
    await db.collection("dailyTasks").doc(id).update(patch);
  } catch (err) {
    console.error("toggleDailyTask:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// PAGE ADMIN — « Tâches du jour » (définition des tâches)
// ───────────────────────────────────────────────────────────────
// L'admin crée/modifie/supprime/réordonne les tâches récurrentes et
// ponctuelles. Affiche aussi l'état de complétion du jour à titre indicatif.
// ═══════════════════════════════════════════════════════════════
function renderDailyTasksAdmin() {
  const todayStr = dayKey(new Date());
  // Groupé par CATÉGORIE d'affichage (recurrent / temps mort), comme la page employé.
  const recurrentTasks = sortedDailyTasks().filter(t => taskBucket(t) === "recurrent");
  const idleTasks = sortedDailyTasks().filter(t => taskBucket(t) === "idle");

  const itemRow = (task) => {
    const note = (task.note || "").trim();
    const times = dailyTaskTimes(task);
    const occs = dailyTaskOccurrences(task, todayStr);
    const doneCnt = occs.filter(o => o.done).length;
    const allDone = doneCnt === occs.length;
    // Affichage des heures : multi = liste « 12:00 · 17:00 · 21:00 » + badge N×,
    // sinon l'heure unique éventuelle.
    const timesLabel = times
      ? times.filter(Boolean).map(esc).join(" · ")
      : (task.time || "").trim();
    return `<div class="ops-admin-item ${allDone ? "is-done-today" : ""}" draggable="true"
        ondragstart="dailyTaskDragStart(event,'${task.id}')" ondragend="dailyTaskDragEnd(event)">
      <span class="ops-admin-drag" title="${t("ops_drag_hint")}" aria-hidden="true">${icon("grip-vertical", 14)}</span>
      <span class="ops-admin-item__status ${allDone ? "is-done" : ""}" title="${allDone ? t("ops_done_today") : t("ops_not_done")}">
        ${times ? `<span class="ops-admin-item__count">${doneCnt}/${occs.length}</span>` : (allDone ? icon("check", 13) : "")}
      </span>
      <div class="ops-admin-item__body">
        <div class="ops-admin-item__title">
          ${esc(task.title || "—")}
          ${timesLabel ? `<span class="daily-task-time">${icon("clock", 11)} ${timesLabel}</span>` : ""}
          ${times && times.length > 1 ? `<span class="daily-task-tag daily-task-tag--occ">${times.length}×</span>` : ""}
        </div>
        ${note ? `<div class="ops-admin-item__note">${esc(note)}</div>` : ""}
      </div>
      <div class="ops-admin-item__actions">
        <button class="btn-icon-only" onclick="openDailyTaskModal('${task.id}')" title="${t("edit")}" aria-label="${t("edit")}">${icon("pencil", 15)}</button>
        <button class="btn-icon-only" onclick="duplicateDailyTask('${task.id}')" title="${t("duplicate")}" aria-label="${t("duplicate")}">${icon("copy", 15)}</button>
        <button class="btn-icon-only" onclick="deleteDailyTask('${task.id}')" title="${t("delete")}" aria-label="${t("delete")}">${icon("trash", 15)}</button>
      </div>
    </div>`;
  };

  // Une colonne = un bucket, zone de dépôt (drag & drop d'une carte vers l'autre).
  const column = (bucket, ic, title, tasks, emptyMsg) => `<div class="card ops-admin-card ops-admin-card--${bucket}"
      ondragover="dailyBucketDragOver(event)" ondragleave="dailyBucketDragLeave(event)" ondrop="dailyBucketDrop(event,'${bucket}')">
      <h3 class="ops-admin-section-title">${icon(ic, 15)} ${title} <span class="ops-admin-count">${tasks.length}</span></h3>
      <div class="ops-admin-list ops-admin-dropzone">
        ${tasks.length === 0
          ? `<div class="dash-today-empty">${emptyMsg}</div>`
          : tasks.map(itemRow).join("")}
      </div>
    </div>`;

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("clipboard", 20)} ${t("ops_admin_title")}</h2>
      <div class="toolbar-actions">
        <button class="btn btn-primary btn-sm" onclick="openDailyTaskModal(null)">${icon("plus", 14)} ${t("ops_new_task")}</button>
      </div>
    </div>

    <p class="ops-admin-intro">${icon("info", 13)} ${t("ops_admin_intro")}</p>
    <p class="ops-admin-intro">${icon("grip-vertical", 13)} ${t("ops_drag_hint")}</p>

    <div class="ops-admin-grid">
      ${column("recurrent", "refresh", t("ops_sec_recurrent"), recurrentTasks, t("ops_no_recurring"))}
      ${column("idle", "clock", t("ops_sec_idle"), idleTasks, t("ops_no_idle"))}
    </div>
  </div>`;
}

// ── Drag & drop : changer une tâche de catégorie (recurrent ↔ temps mort) ──
var _dailyDragId = null;
function dailyTaskDragStart(e, id) {
  _dailyDragId = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
  }
  const row = e.currentTarget; if (row && row.classList) row.classList.add("is-dragging");
}
function dailyTaskDragEnd(e) {
  _dailyDragId = null;
  const row = e.currentTarget; if (row && row.classList) row.classList.remove("is-dragging");
  document.querySelectorAll(".ops-admin-card.is-drop-target").forEach(el => el.classList.remove("is-drop-target"));
}
function dailyBucketDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const card = e.currentTarget; if (card && card.classList) card.classList.add("is-drop-target");
}
function dailyBucketDragLeave(e) {
  const card = e.currentTarget;
  // Ne retire la surbrillance que si on quitte vraiment la carte (pas un enfant).
  if (card && !card.contains(e.relatedTarget)) card.classList.remove("is-drop-target");
}
function dailyBucketDrop(e, bucket) {
  e.preventDefault();
  const card = e.currentTarget; if (card && card.classList) card.classList.remove("is-drop-target");
  let id = _dailyDragId;
  if (!id && e.dataTransfer) { try { id = e.dataTransfer.getData("text/plain"); } catch (_) {} }
  _dailyDragId = null;
  if (id) setDailyTaskBucket(id, bucket);
}

// Change la catégorie d'une tâche (no-op si déjà dans cette colonne).
async function setDailyTaskBucket(id, bucket) {
  const target = bucket === "idle" ? "idle" : "recurrent";
  const task = (typeof dailyTasks !== "undefined" ? dailyTasks : []).find(t => t.id === id);
  if (!task || taskBucket(task) === target) return;
  try {
    await db.collection("dailyTasks").doc(id).update({ bucket: target, updatedAt: Date.now() });
    toast(target === "idle" ? t("ops_moved_idle") : t("ops_moved_recurrent"), "success");
  } catch (err) {
    console.error("setDailyTaskBucket:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}

// ── Modal création / édition d'une tâche du jour ───────────────
function openDailyTaskModal(id) {
  const task = id ? (dailyTasks || []).find(t => t.id === id) : null;
  const bucket = taskBucket(task || {});
  const isOnce = task?.type === "once";
  // Pré-remplissage du champ heures : times[] si présent, sinon l'heure unique.
  const times = dailyTaskTimes(task || {});
  const timesVal = times ? times.filter(Boolean).join(", ") : (task?.time || "").trim();
  showModal(`<div class="modal">
    <div class="modal-header">
      <h3>${task ? t("ops_edit_task") : t("ops_new_task_modal")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <label>${t("ops_task_label")}
      <input id="dt-title" value="${esc(task?.title || "")}" placeholder="${t("ops_task_placeholder")}" autofocus/>
    </label>
    <div class="form-row">
      <label>${t("ops_bucket")}
        <select id="dt-bucket">
          <option value="recurrent" ${bucket === "recurrent" ? "selected" : ""}>${t("ops_bucket_recurrent")}</option>
          <option value="idle" ${bucket === "idle" ? "selected" : ""}>${t("ops_bucket_idle")}</option>
        </select>
      </label>
      <label>${t("ops_task_times")}
        <input id="dt-times" value="${esc(timesVal)}" placeholder="${esc(t("ops_task_times_ph"))}"/>
      </label>
    </div>
    <p class="ops-task-times-hint">${icon("info", 12)} ${t("ops_task_times_hint")}</p>
    <label class="ops-once-check">
      <input type="checkbox" id="dt-once" ${isOnce ? "checked" : ""}/>
      <span>${t("ops_once_checkbox")}</span>
    </label>
    <label>${t("ops_task_note")}
      <textarea id="dt-note" style="height:70px" placeholder="${t("ops_task_note_ph")}">${task?.note || ""}</textarea>
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveDailyTask('${id || ""}')">${icon("check", 14)} ${t("save")}</button>
    </div>
  </div>`);
}

// Parse le champ heures (séparé par virgules/espaces) → ["12:00","17:00", …].
// Normalise chaque jeton (accepte 1704, 17h04, 17 …) et ignore les invalides.
function parseDailyTimes(raw) {
  return (raw || "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
    .map(s => (typeof normalizeTimeInput === "function" ? normalizeTimeInput(s) : s))
    .filter(s => s && s !== null);
}

async function saveDailyTask(id) {
  const title = (document.getElementById("dt-title").value || "").trim();
  if (!title) return toast(t("ops_enter_title"), "error");
  const bucket = document.getElementById("dt-bucket").value === "idle" ? "idle" : "recurrent";
  const type = document.getElementById("dt-once").checked ? "once" : "recurring";
  const parsedTimes = parseDailyTimes(document.getElementById("dt-times").value);
  const note = (document.getElementById("dt-note").value || "").trim();
  // Modèle :
  //  • ponctuelle → toujours mono (1ʳᵉ heure éventuelle dans `time`, pas de times[]).
  //  • récurrente → times[] = toutes les heures (≥1 ⇒ multi-occurrences) ;
  //    `time` garde la 1ʳᵉ heure pour les lecteurs legacy.
  //  • bucket = catégorie d'affichage (recurrent / idle temps mort).
  const time = parsedTimes[0] || "";
  const fieldTimes = (type === "once") ? [] : parsedTimes;
  try {
    if (id) {
      const patch = { title, type, bucket, time, note, updatedAt: Date.now() };
      patch.times = (type === "once")
        ? firebase.firestore.FieldValue.delete()
        : fieldTimes;
      await db.collection("dailyTasks").doc(id).update(patch);
    } else {
      const nid = genId();
      const maxOrder = (dailyTasks || []).reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1);
      const doc = {
        id: nid, title, type, bucket, time, note,
        sortOrder: maxOrder + 1,
        done: false,
        lastCompletedDate: null,
        createdAt: Date.now(), updatedAt: Date.now()
      };
      if (type !== "once") doc.times = fieldTimes;
      await db.collection("dailyTasks").doc(nid).set(doc);
    }
    closeModal();
    toast(t("ops_task_saved"), "success");
  } catch (err) {
    console.error("saveDailyTask:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}

function deleteDailyTask(id) {
  const task = (dailyTasks || []).find(t => t.id === id);
  if (!task) return;
  openConfirm(t("ops_delete_task_title"), t("ops_delete_task_confirm", { name: esc(task.title || "") }), async () => {
    try {
      await db.collection("dailyTasks").doc(id).delete();
      toast(t("ops_task_deleted"), "success");
    } catch (err) {
      console.error("deleteDailyTask:", err);
      toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
    }
  }, true);
}

// ── Dupliquer une tâche du jour (admin) ────────────────────────
// Copie titre (+ « (Copie) »), type, heure(s) et note ; place la copie en fin
// de liste ; réinitialise tout l'état de complétion (done / dayState / …).
async function duplicateDailyTask(id) {
  const task = (dailyTasks || []).find(t => t.id === id);
  if (!task) return;
  try {
    const nid = genId();
    const maxOrder = (dailyTasks || []).reduce((m, x) => Math.max(m, x.sortOrder ?? 0), -1);
    const copy = {
      id: nid,
      title: (task.title || "") + " (Copie)",
      type: task.type === "once" ? "once" : "recurring",
      bucket: taskBucket(task),
      time: (task.time || "").trim(),
      note: task.note || "",
      sortOrder: maxOrder + 1,
      done: false,
      doneDate: null,
      doneBy: null,
      lastCompletedDate: null,
      lastCompletedBy: null,
      dayState: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    const times = dailyTaskTimes(task);
    if (times) copy.times = times.slice();
    await db.collection("dailyTasks").doc(nid).set(copy);
    toast(t("ops_task_duplicated"), "success");
  } catch (err) {
    console.error("duplicateDailyTask:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// PAGE — « Ouverture / Fermeture » (cases à cocher, reset quotidien)
// ───────────────────────────────────────────────────────────────
// Visible employés + admin. Deux gros boutons « Cuisine » / « Service »
// (bascule `_ocActiveSection`) en haut ; en dessous, les deux colonnes
// classiques Ouverture (ambré) / Fermeture (bleu) filtrées sur la section
// choisie — pour savoir qui fait quoi. Chaque item porte une `section`
// (cuisine | service) ; les items legacy sans section sont rattachés à
// « cuisine » par défaut. Les items sont COCHABLES par tous — l'état est
// stocké par jour (/dailyChecklistState/{YYYY-MM-DD}) donc il se
// réinitialise automatiquement chaque jour (nouveau doc = aucune case).
// L'admin définit les items via « Modifier les listes » (4 zones).
// ═══════════════════════════════════════════════════════════════

// ID stable dérivé d'un texte (pour les items legacy + clé de complétion).
function slugId(text) {
  let h = 0;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return "i" + (h >>> 0).toString(36);
}

// Abonnement au doc de complétion du JOUR courant (idempotent, géré par date).
function subscribeChecklistToday() {
  if (typeof db === "undefined") return;
  const today = dayKey(new Date());
  if (_checklistSubscribedDate === today && _checklistUnsub) return;
  if (_checklistUnsub) { _checklistUnsub(); _checklistUnsub = null; }
  _checklistSubscribedDate = today;
  _checklistUnsub = db.collection("dailyChecklistState").doc(today).onSnapshot(snap => {
    const d = snap.exists ? snap.data() : {};
    dailyChecklistToday = { date: today, opening: d.opening || {}, closing: d.closing || {} };
    if (activePage === "ouverture-fermeture") renderPage();
  }, err => {
    if (err && err.code !== "permission-denied") console.warn("listener dailyChecklistState:", err);
  });
}

function getOpenCloseLists() {
  const o = (typeof openCloseLists !== "undefined" && openCloseLists) ? openCloseLists : {};
  // Chaque item porte une `section` (cuisine | service). Les items legacy
  // sans section sont rattachés à « cuisine » par défaut (modifiable ensuite).
  const norm = (arr) => (Array.isArray(arr) ? arr : []).map(it => ({
    id: it.id,
    text: it.text,
    section: it.section === "service" ? "service" : "cuisine"
  }));
  return { opening: norm(o.opening), closing: norm(o.closing) };
}

function isChecklistItemDone(list, id) {
  const m = dailyChecklistToday && dailyChecklistToday[list];
  return !!(m && m[id]);
}

// Section active de la page (cuisine | service). Persistée en mémoire entre
// les rendus ; remise à « cuisine » au chargement du script.
var _ocActiveSection = (typeof _ocActiveSection !== "undefined" && _ocActiveSection) ? _ocActiveSection : "cuisine";

function setOcSection(section) {
  _ocActiveSection = (section === "service") ? "service" : "cuisine";
  if (typeof activePage !== "undefined" && activePage === "ouverture-fermeture") renderPage();
}

function renderOpenClose() {
  subscribeChecklistToday();
  const { opening, closing } = getOpenCloseLists();
  const active = (_ocActiveSection === "service") ? "service" : "cuisine";

  const bySection = (items, section) => items.filter(it => it.section === section);
  const doneCount = (items, list) => items.filter(it => isChecklistItemDone(list, it.id)).length;

  const checkList = (items, list, emptyMsg) => {
    if (items.length === 0) return `<div class="dash-today-empty">${emptyMsg}</div>`;
    return `<div class="openclose-list">${items.map(it => {
      const done = isChecklistItemDone(list, it.id);
      return `<button class="openclose-check ${done ? "is-done" : ""}" onclick="toggleChecklistItem('${list}','${it.id}')" aria-pressed="${done}" title="${done ? t("ops_uncheck") : t("ops_mark_done")}">
        <span class="openclose-check__box">${done ? icon("check", 13) : ""}</span>
        <span class="openclose-check__label">${esc(it.text)}</span>
      </button>`;
    }).join("")}</div>`;
  };

  // Compteur combiné (ouverture + fermeture) par section, pour les gros boutons.
  const secProgress = (section) => {
    const o = bySection(opening, section), c = bySection(closing, section);
    return { done: doneCount(o, "opening") + doneCount(c, "closing"), total: o.length + c.length };
  };
  const switchBtn = (section, ic, label) => {
    const p = secProgress(section);
    const isActive = active === section;
    return `<button class="oc-section-btn oc-section-btn--${section} ${isActive ? "is-active" : ""}" onclick="setOcSection('${section}')" aria-pressed="${isActive}" role="tab" aria-selected="${isActive}">
      <span class="oc-section-btn__ic">${icon(ic, 22)}</span>
      <span class="oc-section-btn__label">${label}</span>
      ${p.total ? `<span class="oc-section-btn__count">${p.done}/${p.total}</span>` : ""}
    </button>`;
  };

  const op = bySection(opening, active);
  const cl = bySection(closing, active);

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("clipboard", 20)} ${t("ops_openclose_title")}</h2>
      ${isAdmin ? `<div class="toolbar-actions">
        <button class="btn btn-primary btn-sm" onclick="openOpenCloseEditor()">${icon("pencil", 14)} ${t("ops_edit_lists")}</button>
      </div>` : ""}
    </div>

    <div class="oc-section-switch" role="tablist" aria-label="${t("ops_section_switch")}">
      ${switchBtn("cuisine", "utensils", t("ops_cuisine"))}
      ${switchBtn("service", "users", t("ops_service"))}
    </div>

    <div class="openclose-grid">
      <div class="card openclose-col openclose-col--open">
        <h3 class="openclose-col__title">${icon("sun", 16)} ${t("ops_opening")} ${op.length ? `<span class="openclose-progress">${doneCount(op, "opening")}/${op.length}</span>` : ""}</h3>
        ${checkList(op, "opening", t("ops_opening_empty"))}
      </div>
      <div class="card openclose-col openclose-col--close">
        <h3 class="openclose-col__title">${icon("moon", 16)} ${t("ops_closing")} ${cl.length ? `<span class="openclose-progress">${doneCount(cl, "closing")}/${cl.length}</span>` : ""}</h3>
        ${checkList(cl, "closing", t("ops_closing_empty"))}
      </div>
    </div>

    <p class="emp-schedule-note">${icon("info", 13)} ${t("ops_openclose_note")}</p>
  </div>`;
}

// ── Cocher / décocher un item (tous les rôles) — écrit dans le doc du jour ──
async function toggleChecklistItem(list, id) {
  if (list !== "opening" && list !== "closing") return;
  const today = dayKey(new Date());
  const done = isChecklistItemDone(list, id);
  try {
    const value = done ? firebase.firestore.FieldValue.delete() : true;
    await db.collection("dailyChecklistState").doc(today).set({
      date: today,
      [list]: { [id]: value },
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error("toggleChecklistItem:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}

// ── Éditeur admin des deux listes (une ligne = un item) ────────
function openOpenCloseEditor() {
  const { opening, closing } = getOpenCloseLists();
  const toText = (items, section) => items.filter(it => it.section === section).map(it => it.text).join("\n");
  showModal(`<div class="modal modal--wide">
    <div class="modal-header">
      <h3>${t("ops_edit_lists_title")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 12px;line-height:1.5">${t("ops_edit_lists_hint")}</p>
    <div class="openclose-edit-grid4">
      <label>${icon("sun", 14)} ${t("ops_opening")} · ${icon("utensils", 13)} ${t("ops_cuisine")}
        <textarea id="oc-opening-cuisine" style="height:170px;line-height:1.6" placeholder="${esc(t("ops_opening_cuisine_ph"))}">${toText(opening, "cuisine")}</textarea>
      </label>
      <label>${icon("sun", 14)} ${t("ops_opening")} · ${icon("users", 13)} ${t("ops_service")}
        <textarea id="oc-opening-service" style="height:170px;line-height:1.6" placeholder="${esc(t("ops_opening_service_ph"))}">${toText(opening, "service")}</textarea>
      </label>
      <label>${icon("moon", 14)} ${t("ops_closing")} · ${icon("utensils", 13)} ${t("ops_cuisine")}
        <textarea id="oc-closing-cuisine" style="height:170px;line-height:1.6" placeholder="${esc(t("ops_closing_cuisine_ph"))}">${toText(closing, "cuisine")}</textarea>
      </label>
      <label>${icon("moon", 14)} ${t("ops_closing")} · ${icon("users", 13)} ${t("ops_service")}
        <textarea id="oc-closing-service" style="height:170px;line-height:1.6" placeholder="${esc(t("ops_closing_service_ph"))}">${toText(closing, "service")}</textarea>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveOpenClose()">${icon("check", 14)} ${t("save")}</button>
    </div>
  </div>`);
}

async function saveOpenClose() {
  // Construit les items {id, text, section} en préservant l'id existant si le
  // texte est inchangé (pour ne pas perdre les cases déjà cochées aujourd'hui).
  // On préfère réutiliser un id de la même section, sinon n'importe lequel
  // (cas migration legacy), sans jamais réutiliser deux fois le même id.
  const val = (id) => (document.getElementById(id)?.value || "");
  const buildSection = (raw, section, existing, usedIds) =>
    raw.split("\n").map(s => s.trim()).filter(Boolean).map(text => {
      let m = (existing || []).find(it => it.section === section && it.text === text && !usedIds.has(it.id));
      if (!m) m = (existing || []).find(it => it.text === text && !usedIds.has(it.id));
      const id = m ? m.id : genId();
      if (m) usedIds.add(m.id);
      return { id, text, section };
    });
  const cur = getOpenCloseLists();
  const usedO = new Set();
  const opening = [
    ...buildSection(val("oc-opening-cuisine"), "cuisine", cur.opening, usedO),
    ...buildSection(val("oc-opening-service"), "service", cur.opening, usedO)
  ];
  const usedC = new Set();
  const closing = [
    ...buildSection(val("oc-closing-cuisine"), "cuisine", cur.closing, usedC),
    ...buildSection(val("oc-closing-service"), "service", cur.closing, usedC)
  ];
  try {
    await db.collection("settings").doc("openClose").set({
      opening, closing, updatedAt: Date.now()
    }, { merge: true });
    closeModal();
    toast(t("ops_lists_saved"), "success");
  } catch (err) {
    console.error("saveOpenClose:", err);
    toast(t("err_prefix") + " : " + (err.message || err.code || err), "error", 5000);
  }
}
