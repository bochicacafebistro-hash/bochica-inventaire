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

// ═══════════════════════════════════════════════════════════════
// BLOC « Tâches de la journée » — injecté dans l'accueil employé
// ───────────────────────────────────────────────────────────────
// Rendu d'un bloc compatible avec la grille .dash-today-widget__grid.
// Les items sont cochables (clic → toggleDailyTask).
// ═══════════════════════════════════════════════════════════════
function renderDailyTasksBlock() {
  const todayStr = dayKey(new Date());
  const list = sortedDailyTasks().filter(t => shouldShowDailyTaskToday(t, todayStr));
  const doneCount = list.filter(t => isDailyTaskDoneToday(t, todayStr)).length;

  return `<div class="dash-today-block">
    <div class="dash-today-block__title">${icon("clipboard", 12)} ${t("ops_daily_title")} (${doneCount}/${list.length})</div>
    <div class="dash-today-block__list">
      ${list.length === 0
        ? `<div class="dash-today-empty">${t("ops_no_tasks_today")}</div>`
        : list.map(task => {
            const done = isDailyTaskDoneToday(task, todayStr);
            const isOnce = task.type === "once";
            return `<button class="daily-task-item ${done ? "is-done" : ""}" onclick="toggleDailyTask('${task.id}')" aria-pressed="${done}" title="${done ? t("ops_uncheck") : t("ops_mark_done")}">
              <span class="daily-task-check">${done ? icon("check", 13) : ""}</span>
              <span class="daily-task-label">${esc(task.title || "—")}</span>
              ${isOnce ? `<span class="daily-task-tag daily-task-tag--once">1×</span>` : ""}
            </button>`;
          }).join("")
      }
    </div>
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
  const recurring = sortedDailyTasks().filter(t => t.type !== "once");
  const once = sortedDailyTasks().filter(t => t.type === "once");

  const itemRow = (task) => {
    const done = isDailyTaskDoneToday(task, todayStr);
    return `<div class="ops-admin-item ${done ? "is-done-today" : ""}">
      <span class="ops-admin-item__status ${done ? "is-done" : ""}" title="${done ? t("ops_done_today") : t("ops_not_done")}">
        ${done ? icon("check", 13) : ""}
      </span>
      <span class="ops-admin-item__title">${esc(task.title || "—")}</span>
      <div class="ops-admin-item__actions">
        <button class="btn-icon-only" onclick="openDailyTaskModal('${task.id}')" title="${t("edit")}" aria-label="${t("edit")}">${icon("pencil", 15)}</button>
        <button class="btn-icon-only" onclick="deleteDailyTask('${task.id}')" title="${t("delete")}" aria-label="${t("delete")}">${icon("trash", 15)}</button>
      </div>
    </div>`;
  };

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("clipboard", 20)} ${t("ops_admin_title")}</h2>
      <div class="toolbar-actions">
        <button class="btn btn-primary btn-sm" onclick="openDailyTaskModal(null)">${icon("plus", 14)} ${t("ops_new_task")}</button>
      </div>
    </div>

    <p class="ops-admin-intro">${icon("info", 13)} ${t("ops_admin_intro")}</p>

    <div class="card ops-admin-card">
      <h3 class="ops-admin-section-title">${icon("refresh", 15)} ${t("ops_recurring_title")} <span class="ops-admin-count">${recurring.length}</span></h3>
      <div class="ops-admin-list">
        ${recurring.length === 0
          ? `<div class="dash-today-empty">${t("ops_no_recurring")}</div>`
          : recurring.map(itemRow).join("")}
      </div>
    </div>

    <div class="card ops-admin-card">
      <h3 class="ops-admin-section-title">${icon("check", 15)} ${t("ops_once_title")} <span class="ops-admin-count">${once.length}</span></h3>
      <div class="ops-admin-list">
        ${once.length === 0
          ? `<div class="dash-today-empty">${t("ops_no_once")}</div>`
          : once.map(itemRow).join("")}
      </div>
    </div>
  </div>`;
}

// ── Modal création / édition d'une tâche du jour ───────────────
function openDailyTaskModal(id) {
  const task = id ? (dailyTasks || []).find(t => t.id === id) : null;
  const type = task?.type || "recurring";
  showModal(`<div class="modal">
    <div class="modal-header">
      <h3>${task ? t("ops_edit_task") : t("ops_new_task_modal")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <label>${t("ops_task_label")}
      <input id="dt-title" value="${esc(task?.title || "")}" placeholder="${t("ops_task_placeholder")}" autofocus/>
    </label>
    <label>${t("ops_type")}
      <select id="dt-type">
        <option value="recurring" ${type === "recurring" ? "selected" : ""}>${t("ops_type_recurring")}</option>
        <option value="once" ${type === "once" ? "selected" : ""}>${t("ops_type_once")}</option>
      </select>
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveDailyTask('${id || ""}')">${icon("check", 14)} ${t("save")}</button>
    </div>
  </div>`);
}

async function saveDailyTask(id) {
  const title = (document.getElementById("dt-title").value || "").trim();
  if (!title) return toast(t("ops_enter_title"), "error");
  const type = document.getElementById("dt-type").value === "once" ? "once" : "recurring";
  try {
    if (id) {
      await db.collection("dailyTasks").doc(id).update({ title, type, updatedAt: Date.now() });
    } else {
      const nid = genId();
      const maxOrder = (dailyTasks || []).reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1);
      await db.collection("dailyTasks").doc(nid).set({
        id: nid, title, type,
        sortOrder: maxOrder + 1,
        done: false,
        lastCompletedDate: null,
        createdAt: Date.now(), updatedAt: Date.now()
      });
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

// ═══════════════════════════════════════════════════════════════
// PAGE — « Ouverture / Fermeture » (listes de référence)
// ───────────────────────────────────────────────────────────────
// Visible employés + admin. Deux colonnes : à l'ouverture / à la
// fermeture. Lecture seule pour tous ; l'admin a un bouton pour éditer.
// ═══════════════════════════════════════════════════════════════
function getOpenCloseLists() {
  const o = (typeof openCloseLists !== "undefined" && openCloseLists) ? openCloseLists : {};
  return {
    opening: Array.isArray(o.opening) ? o.opening : [],
    closing: Array.isArray(o.closing) ? o.closing : []
  };
}

function renderOpenClose() {
  const { opening, closing } = getOpenCloseLists();

  const refList = (items, emptyMsg) => items.length === 0
    ? `<div class="dash-today-empty">${emptyMsg}</div>`
    : `<ol class="openclose-list">${items.map(it => `<li>${esc(it)}</li>`).join("")}</ol>`;

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("clipboard", 20)} ${t("ops_openclose_title")}</h2>
      ${isAdmin ? `<div class="toolbar-actions">
        <button class="btn btn-primary btn-sm" onclick="openOpenCloseEditor()">${icon("pencil", 14)} ${t("ops_edit_lists")}</button>
      </div>` : ""}
    </div>

    <div class="openclose-grid">
      <div class="card openclose-col openclose-col--open">
        <h3 class="openclose-col__title">${icon("sun", 16)} ${t("ops_opening")}</h3>
        ${refList(opening, t("ops_opening_empty"))}
      </div>
      <div class="card openclose-col openclose-col--close">
        <h3 class="openclose-col__title">${icon("moon", 16)} ${t("ops_closing")}</h3>
        ${refList(closing, t("ops_closing_empty"))}
      </div>
    </div>

    <p class="emp-schedule-note">${icon("info", 13)} ${t("ops_openclose_note")}</p>
  </div>`;
}

// ── Éditeur admin des deux listes (une ligne = un item) ────────
function openOpenCloseEditor() {
  const { opening, closing } = getOpenCloseLists();
  showModal(`<div class="modal modal--wide">
    <div class="modal-header">
      <h3>Modifier les listes d'ouverture / fermeture</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 12px;line-height:1.5">Une ligne = un élément de la liste. Les lignes vides sont ignorées.</p>
    <div class="openclose-edit-grid">
      <label>${icon("sun", 14)} À l'ouverture
        <textarea id="oc-opening" style="height:220px;line-height:1.6" placeholder="Allumer la friteuse&#10;Vérifier la caisse&#10;Sortir les chaises de terrasse">${opening.join("\n")}</textarea>
      </label>
      <label>${icon("moon", 14)} À la fermeture
        <textarea id="oc-closing" style="height:220px;line-height:1.6" placeholder="Fermer la caisse&#10;Nettoyer la plancha&#10;Sortir les poubelles">${closing.join("\n")}</textarea>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveOpenClose()">${icon("check", 14)} Enregistrer</button>
    </div>
  </div>`);
}

async function saveOpenClose() {
  const parse = (v) => (v || "").split("\n").map(s => s.trim()).filter(Boolean);
  const opening = parse(document.getElementById("oc-opening").value);
  const closing = parse(document.getElementById("oc-closing").value);
  try {
    await db.collection("settings").doc("openClose").set({
      opening, closing, updatedAt: Date.now()
    }, { merge: true });
    closeModal();
    toast("Listes enregistrées.", "success");
  } catch (err) {
    console.error("saveOpenClose:", err);
    toast("Erreur sauvegarde : " + (err.message || err.code || err), "error", 5000);
  }
}
