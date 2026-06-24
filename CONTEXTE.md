# 📋 CONTEXTE — Projet Bochica Inventaire

> 📌 **Voir `TODO.md`** à la racine du repo pour la liste vivante des améliorations à venir (sécurité, food cost, vue mobile, tests, etc.).

> ⚠️ **Dernière mise à jour : 24 juin 2026 — v3.54.0** — **Salaires : montant des pourboires distribués par semaine (triplet avant / pourboires / après)**. Demande : on avait déjà « Sans pourb. » (avant) et « Avec pourb. » (après) mais pas le **montant des pourboires** lui-même de façon visible. (1) **Écran** (`pages-payroll.js`, boîte de totaux du panneau Salaires) : nouvelle ligne **« Pourboires + {montant} »** (vert) insérée **entre** « Sans pourb. » et « Avec pourb. », de sorte que **Sans pourb. + Pourboires = Avec pourb.** Le montant = `sumTips` (= somme des `tipShare` distribués = `sumTotal − sumGross`). CSS `.payroll-totals-final-row--tips` (vert clair/foncé selon thème). (2) **PDF 2 semaines** (`buildTwoWeekPayrollPDF`, fiche « Détail par semaine ») : la fiche passe de 2 à **3 lignes explicites** — *Avant pourb.* / *Pourboires +* (vert) / *Après pourb.* — `ficheH` 23→28 mm, ligne contextuelle (heures · ventes · % des ventes) déplacée en bas. Le **PDF 1 semaine** affichait déjà le KPI « Pourboires distribués », inchangé. **Sécurité** : aucun changement de données ni de règles Firestore (lecture seule des pourboires déjà chargés). Banc d'essai : `node --check` OK + vérif `avant + pourboires = après`. `CACHE_VERSION` → `v3.54.0`. — *Précédent :* **v3.53.0** — **Pointage : fix quart de nuit (passage de minuit) + réinitialisation d'une journée d'employé (Salaires)**. Deux demandes. (1) **Bug quart de nuit** (`pages-punch.js`) : un employé qui entre le soir (ex. 22:00) et **sort le lendemain matin** (ex. 00:56) voyait sa sortie tomber sur un **nouveau jour** (le lendemain n'a pas d'entrée → l'ancien code écrivait `actualShifts[lendemain].end`, une sortie orpheline) tandis que la veille restait avec une entrée sans sortie → heures éparpillées sur 2 jours, calcul faux. **Fix** : si un employé pointe **SORTIE** le matin **sans entrée aujourd'hui** ET qu'un quart est resté **ouvert la veille** (entrée présente, pas de sortie), on **ferme ce quart-là sur la VEILLE** (`_punchCloseOvernightShift`) — `hoursFromShift()` gère déjà le passage de minuit (22:00 → 00:56 = ~2h56 sur le même enregistrement). **Garde-fous** : on n'agit que tôt le matin (`PUNCH_OVERNIGHT_CUTOFF_HOUR = 10`) et si la durée reste plausible (`PUNCH_OVERNIGHT_MAX_HOURS = 12`), pour ne pas fermer par erreur un quart de **jour** oublié la veille. Lecture/écriture **directe** du doc `payroll/{weekId}` de la veille (`_punchFetchShiftForDate` + `_punchMondayOf`) → gère aussi le cas **dim→lun** où la veille est dans une **semaine ISO précédente**. L'écran employé affiche un **indice bleu** (`_punchYesterdayOpenShiftSync`, `punch_overnight_hint` FR/ES) : « Quart de nuit ouvert depuis hier — entrée à {t}. Appuie sur SORTIE pour le fermer. ». CSS `.punch-state-info--overnight`. (2) **Réinitialiser une journée** (`pages-payroll.js`) : dans le modal d'un jour de la page **Salaires & Pourboires**, le bouton d'effacement s'affiche désormais dès qu'il y a **une saisie quelconque** pour ce jour (`hasActualOverride`, et non plus seulement quand entrée **et** sortie sont présentes) — donc on peut nettoyer une **cellule partielle** (ex. une sortie de nuit tombée le mauvais jour). Renommé **« Réinitialiser la journée »** (`resetPayrollDay`) avec **confirmation** (récap entrée/sortie + date) ; efface toute la cellule via `clearActualShift` pour que l'employé **re-pointe** proprement. **Sécurité** : aucun changement de règles Firestore (écritures sur `actualShifts` de `/payroll`, déjà autorisées). Banc d'essai : `node --check` OK (pages-punch.js, pages-payroll.js, i18n.js) + 8/8 cas de décision quart de nuit + cas de passage de semaine validés. `CACHE_VERSION` → `v3.53.0`. — *Précédent :* **v3.52.1** — **Fix congés à la copie de semaine** : un jour de congé sur la semaine cible n'est plus écrasé par un quart copié (quart « fantôme »), et les jours de congé sont désormais exclus partout — totaux d'heures/coût à l'écran et exports **PNG** (équipe + admin) affichent « Congé » au lieu des heures copiées. Robuste aux données déjà corrompues. `CACHE_VERSION` → `v3.52.1`. — *Précédent :* **v3.52.0** — **Taux horaire daté : un changement de salaire s'applique à partir d'une date d'effet choisie (historique de taux)**. Un employé peut maintenant avoir un **historique de taux** : un nouveau taux entré avec une **date d'effet** ne s'applique qu'aux semaines **à partir de cette date** ; les semaines antérieures conservent l'ancien taux, et les calculs de paie/horaire utilisent le bon taux par jour (gère même une hausse en cours de semaine). **Modèle** : `/employeesComp/{empId}` gagne **`rateHistory[]`** = `[{ rate, from:"YYYY-MM-DD" }]` (paliers triés). `hourlyRate` reste écrit mais représente désormais le **taux en vigueur aujourd'hui** (dérivé de l'historique par `_applyEmployeeComp`, qui propage aussi `rateHistory` sur l'objet emp en mémoire). **Helpers** (`pages-hr.js`) : **`effectiveHourlyRate(emp, dateKey)`** (taux du palier le plus récent dont `from` ≤ date ; comparaison de chaînes `YYYY-MM-DD`), `normalizeRateHistory` (tri + fusion des doublons de date + suppression des paliers redondants), `todayKey`, `fmtDateLong`. **Éditeur employé** : à côté du taux, nouveau champ **« En vigueur à partir du »** (défaut = aujourd'hui) ; à la sauvegarde, `saveEmployee` **scelle l'ancien taux dans le passé** (`2000-01-01`) la 1re fois puis **upsert** le taux saisi à sa date d'effet. Un bloc **« Historique des taux »** (lecture seule, paliers à venir en bleu) avec ✕ pour retirer un palier (`removeRateHistoryEntry`). **Application du taux daté** (portée paie **+** horaires, comme demandé) : `renderSalaires` (calcul principal), `_computeWeekGrossWage` (verrouillage de semaine → dépense Salaires), les **2 builders PDF** de paie (1 sem + 2 sem), l'**horaire** (`renderEmployes`) et le **PNG admin** des horaires. Pour les salariés (montant fixe), le taux est celui du **début de semaine** ; pour les horaires, le coût est sommé **jour par jour** au taux effectif de chaque jour. Les vues sans contexte de semaine (team cards, Simulation, Dashboard, extras) utilisent `emp.hourlyRate` = taux courant. **Sécurité** : aucun changement de règles (`rateHistory` est un champ de `/employeesComp`, déjà admin only) — **pas besoin de republier `firestore.rules`**. CSS : `.rate-hist*`. Banc d'essai : `node --check` OK (pages-hr.js, pages-payroll.js, state.js) + scénario validé (sem 1 à 17 $, sem 2 à 18 $ → 510 $ / 540 $ ; hausse en milieu de semaine au prorata jour par jour). `CACHE_VERSION` → `v3.52.0`.
>
> ⚠️ **17 juin 2026 — v3.51.0** — **Soumissions : section « Location de salle » (options de salle choisissables, combinables avec un forfait)**. Une soumission peut maintenant proposer **plusieurs options de location de salle** (ex. *lundi 23 juin 200 $*, *mercredi 100 $*, *dimanche 1000 $*) ; le client en **choisit une** sur le PDF (même logique de choix que les options de forfait). **Modèle** : nouveau champ **`roomRentals[]`** sur les docs `/quotes`, chaque option = `{ id, date, startTime, endTime, description, price }` (le `price` est saisi **avant taxes**, comme les forfaits). Helpers (`pages-quotes.js`) : `getQuoteRooms`, `computeRoomTotal` (ajoute TPS 5 % + TVQ 9,975 %), `computeRoomRange`, `roomSummaryLabel`, `fmtDateShort`. **Éditeur** : nouvelle section « Location de salle » dans le modal de soumission (état `_editingRoomRentals` dans `state.js`) avec bouton **« Ajouter une option de salle »** ; chaque ligne a date / heure début / heure fin / description / prix + un total live « taxes incl. » (`refreshRoomRowTotal`). Fonctions `renderRoomRentalsForm`, `renderRoomRentalRow`, `syncEditingRoomsFromDOM`, `addRoomRental`, `removeRoomRental`. **Combinable + salle seule** : la salle s'ajoute par-dessus le(s) forfait(s) ; on peut aussi retirer **tous** les forfaits pour faire une soumission **location de salle seulement** (validation `saveQuote` assouplie : au moins un forfait **ou** une salle ; `removeQuoteOption` autorise 0 forfait s'il reste ≥1 salle ; champs legacy `packageId/...` neutres si aucun forfait). **PDF** (`generateQuotePDF`) : nouvelle section bandeau bleu **« LOCATION DE SALLE »** après les forfaits, une carte par option (date en gros, heures, description, prix taxes incluses à droite, détail Sous-total/TPS/TVQ/TOTAL) ; si ≥2 options, badge **« OPTION N »** + case à cocher **« Je choisis la salle du … »**. **Liste** : pill « Location de salle » (ou « N options de salle ») sur la carte ; le total en titre prend la fourchette des salles si la soumission n'a pas de forfait. **Sécurité** : aucun changement de règles Firestore (`roomRentals` est un champ des docs `/quotes`, déjà admin only) — **pas besoin de republier `firestore.rules`**. CSS : `.quote-room-block(__head/__badge/__total/__total-hint)`. Banc d'essai : `node --check` OK (pages-quotes.js + state.js) + calcul des totaux validé (200/100/1000 $ → 229,95 / 114,97 / 1149,75 $). `CACHE_VERSION` → `v3.51.0`.
>
> ⚠️ **17 juin 2026 — v3.50.1** — **Soumissions : PDF sur une seule page quand il n'y a qu'une seule option (fix 1ʳᵉ page presque vide)**. Bug : une soumission à **une seule option** générait quand même 2 pages, la 1ʳᵉ presque vide (en-tête + blocs Client/Événement seulement). Cause : dans `renderOption` (`pages-quotes.js`), l'estimation de hauteur `estHeight` réservait **toujours** la place du badge « OPTION » (8 mm) et de la case à cocher « Je choisis l'option » (12 mm) — deux éléments dessinés **uniquement en multi-options**. Ces 20 mm fantômes faisaient dépasser le seuil `H - FOOTER_RESERVE` et forçaient un saut de page avant même de dessiner l'unique carte de forfait. Corrigé : `estHeight = 60 + 6 + 46` (carte + marge + totaux) et on n'ajoute `+ 8 + 12` **que si `multi`**. Résultat : une soumission simple (1 forfait, avec ou sans dépôt) tient sur **1 page** ; le comportement multi-options et les sauts de page légitimes (bière, suppléments, notes longues) restent inchangés. Aucun changement de données ni de règles Firestore. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.50.1`.
>
> ⚠️ **13 juin 2026 — v3.50.0** — **Tâches du jour (admin) : 2 colonnes Récurrentes / Temps mort avec glisser-déposer**. La page admin `taches-jour` (`renderDailyTasksAdmin`) passe d'un empilement vertical à une **grille 2 colonnes** (`.ops-admin-grid`) : *Tâches récurrentes* (accent jaune) | *Temps mort* (accent violet), même disposition que la page employé. Chaque carte de tâche est **draggable** (poignée `grip-vertical`) et chaque colonne est une **zone de dépôt** — glisser une tâche d'une colonne à l'autre **change son `bucket`** via `setDailyTaskBucket` (no-op si déjà dans la colonne ; surbrillance `is-drop-target` au survol). Handlers : `dailyTaskDragStart/End`, `dailyBucketDragOver/Leave/Drop` (HTML5 DnD standard, comme l'inventaire/paie). **Rappel comportement** : les deux catégories sont des tâches **récurrentes** (type `recurring` par défaut, case « À faire une seule fois » décochée) → **se réinitialisent chaque jour** ; changer de colonne ne touche pas au `type`, donc le reset quotidien est conservé. **Sécurité** : aucune règle modifiée (`bucket` est écrit par l'admin). i18n : +`ops_drag_hint`, `ops_moved_recurrent/idle`. CSS : `.ops-admin-grid`, `.ops-admin-card--recurrent/--idle`, `.ops-admin-drag`, `.is-drop-target`. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.50.0`.
>
> ⚠️ **13 juin 2026 — v3.49.0** — **Tâches du jour : page dédiée employé (Récurrentes / Temps mort) + catégorie par tâche**. (1) **Nouvelle catégorie d'affichage** par tâche : champ **`bucket`** ∈ `recurrent` (récurrentes/régulières) | `idle` (**temps mort** — à faire quand c'est tranquille), défaut `recurrent` (`taskBucket()`). Choisie dans le modal admin via un **sélecteur Catégorie** ; l'ancien select « Type » (récurrente/ponctuelle) devient une **case à cocher « À faire une seule fois »** (toujours stockée dans `type` recurring/once, complétion inchangée). (2) **Page dédiée employé `mes-taches`** (`renderEmployeeTasks`, lien « Tâches » en haut de la sidebar employé) : **deux sections** — *Tâches récurrentes* (accent jaune) et *Temps mort* (accent violet) — chacune triée chronologiquement, mêmes cartes cochables (mono/ multi-occurrences). (3) L'**accueil employé garde un aperçu** (toutes les tâches, chronologique) — `renderDailyTasksBlock` réutilise les helpers factorisés `buildTaskUnits` + `renderTaskUnitCard`. (4) La **page admin `taches-jour`** est désormais groupée **par catégorie** (Récurrentes / Temps mort) au lieu de récurrente/ponctuelle ; `duplicateDailyTask` copie le `bucket`. **Câblage** : routage + breadcrumb sidebar, `employee.canAccess/canWrite += mes-taches`, listener `dailyTasks` re-render `mes-taches`. **Sécurité** : aucune règle modifiée (cocher passe toujours par les champs déjà autorisés, dont `dayState` v3.48.0). i18n : +`ops_bucket(_recurrent/_idle)`, `ops_once_checkbox`, `ops_sec_recurrent/idle`, empties + note. CSS : `.emp-tasks-grid/-card/-title`, `.ops-once-check`. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.49.0`.
>
> ⚠️ **13 juin 2026 — v3.48.0** — **Tâches du jour : plusieurs passages par jour (heures multiples) + tri chronologique côté employé + bouton Dupliquer**. Trois ajouts sur `pages-ops.js`. (1) **Plusieurs fois par jour** : une tâche récurrente peut avoir **plusieurs heures** via le nouveau champ **`times[]`** (ex. nettoyer les salles de bain à 12:00, 17:00, 21:00). Chaque heure = un **passage cochable indépendamment**. Complétion stockée dans **`dayState = { date:"YYYY-MM-DD", done:{ "0":qui, … } }`** (remis à zéro chaque jour : on ignore `dayState` si sa date ≠ aujourd'hui). Helpers : `dailyTaskTimes`, `isOccDoneToday`, `dailyTaskOccurrences`, `toggleDailyOcc`. **Rétrocompat** : sans `times[]` → ancien système mono (champ `time` + `done`/`doneDate` pour ponctuelle, `lastCompletedDate` pour récurrente). Les ponctuelles restent mono. (2) **Tri chronologique (accueil employé)** : `renderDailyTasksBlock` **aplatit** les tâches en unités d'occurrence et les trie par **heure croissante** (`compareOccUnits`) — celles sans heure à la fin ; un passage multi affiche un badge `idx/total`. (3) **Dupliquer** : bouton `copy` dans la liste admin → `duplicateDailyTask` (copie titre + « (Copie) », type, heure(s), note ; place en fin ; réinitialise toute la complétion). Modal : l'ancien `<input type=time>` unique devient un **champ texte multi-heures** (`dt-times`, séparées par virgules, `parseDailyTimes` + `normalizeTimeInput`). **Sécurité** : `dayState` ajouté à `_dailyTaskToggleOnly()` dans `firestore.rules` (sinon un employé ne peut pas cocher un passage). **⚠ Après déploiement : republier `firestore.rules`** (nouvelle clé tolérée `dayState`). i18n : +`ops_task_times(_ph/_hint)`, `ops_task_duplicated`, `duplicate` (FR/ES). CSS : `.daily-task-tag--occ`, `.ops-admin-item__count`, `.ops-task-times-hint`. Banc d'essai : `node --check` OK + logique d'occurrences/tri validée. `CACHE_VERSION` → `v3.48.0`.
>
> ⚠️ **13 juin 2026 — v3.47.2** — **Fix : la section (cuisine/service) des items Ouverture/Fermeture était perdue à la relecture**. Bug v3.47.0 : le listener Firestore de `settings/openClose` (`firebase-listeners.js`) normalisait chaque item en `{id, text}` **en jetant le champ `section`**. Résultat : on sauvegardait bien `section:"service"` (ex. liste de **fermeture service**), mais au snapshot suivant l'item revenait sans section → `getOpenCloseLists` le remettait à **« cuisine »** par défaut, donc il s'affichait du mauvais côté. Corrigé : le `norm` du listener **préserve `section`** (`service` sinon `cuisine` par défaut, y compris pour les chaînes legacy). Aucun changement de données ni de règles. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.47.2`.
>
> ⚠️ **13 juin 2026 — v3.47.1** — **Ouverture/Fermeture : bascule Cuisine / Service (2 gros boutons) au lieu de la grille 2×2**. Retour aux **deux colonnes colorées** classiques — Ouverture (ambré `--accent`) | Fermeture (bleu `#4a90e2`) — surmontées de **deux gros boutons « Cuisine » / « Service »** (`.oc-section-switch`) qui basculent la section affichée (état `_ocActiveSection` en mémoire, `setOcSection()` → `renderPage()`). Chaque bouton montre un **compteur combiné** `fait/total` (ouverture + fermeture) ; le bouton actif se colore (cuisine ambré / service bleu). Le modèle de données reste identique à v3.47.0 (champ `section` par item, legacy → cuisine). L'éditeur garde ses **4 zones de texte**. CSS : suppression de `.openclose-grid4`/`.openclose-cell*`, ajout de `.oc-section-switch`/`.oc-section-btn`. i18n : +`ops_section_switch`. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.47.1`.
>
> ⚠️ **13 juin 2026 — v3.47.0** — **Ouverture/Fermeture : séparation Cuisine / Service (grille 2×2)**. La page **Ouverture / Fermeture** (`pages-ops.js`) passe de 2 colonnes (Ouverture | Fermeture) à une **grille 4 cases** : colonnes **Cuisine / Service**, rangées **Ouverture / Fermeture** — pour voir d'un coup d'œil qui doit faire quoi. **Modèle** : chaque item de `settings/openClose.opening[]` et `.closing[]` porte maintenant un champ **`section`** (`cuisine` | `service`) en plus de `{id, text}`. Rétrocompat : les items legacy sans section sont rattachés à **« cuisine »** par défaut (`getOpenCloseLists` normalise). **Rendu** (`renderOpenClose`) : 4 cartes `.openclose-cell` (accent gauche ambré cuisine / bleu service, en-tête = section + moment + compteur `N/total`). **Éditeur** (`openOpenCloseEditor`) : 4 zones de texte (Ouverture·Cuisine, Ouverture·Service, Fermeture·Cuisine, Fermeture·Service). **Sauvegarde** (`saveOpenClose`) : reconstruit les items par section en **préservant les `id`** (même section d'abord, sinon n'importe quelle section pour la migration legacy, sans réutiliser un id deux fois) → **les cases déjà cochées du jour ne se perdent pas**. L'état de complétion (`/dailyChecklistState/{date}`) reste **inchangé** (clé = id d'item). **Sécurité** : aucun changement de règles Firestore (mêmes docs `settings/openClose` + `dailyChecklistState`). i18n : +7 clés FR/ES (`ops_cuisine`, `ops_service`, `ops_oc_cell_empty`, 4 placeholders par section). CSS : `.openclose-grid4`, `.openclose-edit-grid4`, `.openclose-cell(--cuisine/--service)`. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.47.0`.
>
> ⚠️ **9 juin 2026 — v3.46.0** — **Simulation paie : export PNG (version équipe sans $ + version admin complète)**. Deux nouveaux boutons dans la barre d'outils de l'éditeur de simulation (`renderSimulationEditorHTML`, pages-simulations.js), calqués sur les exports de la page Employés & Horaires (v3.25.0 / v3.32.0). (1) **« PNG équipe »** (`exportSimAsPNG`) : image de l'horaire proposé **sans aucune donnée financière** — uniquement noms, sections (couleur ambré cuisine / bleu service) et quarts (start → end, **quarts coupés** empilés). En-tête BOCHICA + tricolore + nom de la sim ; les employés sans aucun quart sur les jours ouverts sont exclus (pas de ligne « Congé Congé… »). (2) **« PNG admin »** (`exportSimAsPNGAdmin`) : version interne enrichie — **taux horaire** (+ FIXE pour salariés), **heures + coût par quart**, cellule totaux par employé (heures · salaire · pourboire · total), en-tête de jour avec **fenêtre de service** (🕐) + totaux jour (h · $), panneau **5 KPI** (heures, masse salariale, pourboires distribués, total à payer **avec écart $ vs réel**, ventes prévues au ratio courant), badge rouge **« INTERNE — Ne pas partager »**. Colonnes = **jours ouverts effectifs** (`simEffectiveOpenDays`, sans date car la sim est indépendante d'une semaine). Données tirées de `computeSimScenario(sim.simulation)` ; écart calculé vs `computeSimScenario(sim.baseline)`. Réutilise `_downloadCanvasPNG` (toBlob + objectURL, anti-blocage retéléchargement) et `html2canvas` déjà chargés. Helpers ajoutés : `_simSlug` (nom de fichier sans accents) et `_simSvcWindowLabel`. Noms de fichiers : `Bochica_SimPaie_<nom>_<date>.png` et `Bochica_SimPaieAdmin_<nom>_<date>.png`. **Sécurité** : aucun changement de règles (lecture seule des `payrollSimulations`, page déjà admin only). Banc d'essai : `node --check` OK + logique de filtrage des employés validée. `CACHE_VERSION` → `v3.46.0`.
>
> ⚠️ **9 juin 2026 — v3.45.3** — **Simulation : les 7 jours toujours affichés, jours fermés verrouillés**. La grille de la sim affiche désormais **les 7 jours de la semaine** en permanence (`--n-days:7`). Les **jours fermés** (hors `simEffectiveOpenDays`) apparaissent en colonne **grisée hachurée** avec un badge **« Fermé »** dans l'en-tête, et **chaque employé y est marqué « Congé »** dans une carte verrouillée (`.shift-card--closed`, icône `ban`) — **non cliquable, non cible de glisser-déposer** (ces cellules n'ont aucun handler d'édition/drop). Implémentation : `renderSimulationEditorHTML` itère sur `allIdx` (0–6) au lieu de `visibleIdx` pour l'en-tête, les lignes et le panneau totaux ; `isDayOpen(dow)` distingue ouvert/fermé ; `renderSimEmpRow` détecte un jour fermé via `row.daily[dow] === null` (computeSimScenario pousse `null` pour les jours non ouverts). `visibleIdx` reste utilisé pour les **totaux** (jours ouverts seulement), le compteur « Jours ouverts N/7 » et le **graphique de couverture**. Les cellules **vides d'un jour ouvert** sont renommées **« Libre »** (au lieu de « Congé ») pour les distinguer des jours fermés. CSS `.schedule-empgrid-day-head--closed`, `.schedule-empgrid-day-closed`, `.schedule-empgrid-cell--closed` (hachures), `.shift-card--closed`, `.schedule-totals-val--closed`. **Sécurité** : aucun changement de règles. `CACHE_VERSION` → `v3.45.3`.
>
> ⚠️ **9 juin 2026 — v3.45.2** — **Simulation : réordonner les employés (monter/descendre)**. Chaque ligne employé de la grille de la sim a maintenant deux flèches **▲/▼** (à gauche du nom) pour le monter ou le descendre. Nouvelle fonction `moveSimEmployee(simId, empId, dir)` qui permute l'employé dans `simulation.employees` et persiste (le listener re-render dans le nouvel ordre). `renderSimEmpRow` reçoit `totalRows` pour désactiver ▲ sur la 1ʳᵉ ligne et ▼ sur la dernière. CSS `.sim-emp-reorder` / `.sim-emp-move`. **Sécurité** : aucun changement de règles. `CACHE_VERSION` → `v3.45.2`.
>
> ⚠️ **9 juin 2026 — v3.45.1** — **Fix : un jour avec fenêtre de service s'affiche dans la grille de la sim**. Bug v3.45.0 : la grille (et le calcul) dépendaient uniquement de `openDays` ; donner une fenêtre de service à un jour (ex. lundi) ne le faisait pas apparaître si ce jour n'était pas déjà coché dans « Jours ouverts » (les sims existantes restaient bloquées). Nouveau helper **`simEffectiveOpenDays(scenario)`** = **union** de `openDays` et de tout jour ayant une fenêtre de service. Utilisé dans `computeSimScenario`, `renderSimulationEditorHTML`, le graphique de couverture et les deux modales. `updateSimServiceHours` ajoute déjà le jour à `openDays` ; en complément, **décocher** un jour dans « Jours ouverts » (`toggleSimOpenDay`) **retire aussi sa fenêtre de service** pour qu'il ne soit pas ré-affiché par l'union. `CACHE_VERSION` → `v3.45.1`.
>
> ⚠️ **9 juin 2026 — v3.45.0** — **Simulation paie : fenêtre d'ouverture en en-tête, quarts coupés (multi-quarts/jour) + bouton « Copier l'horaire »**. Trois améliorations sur la page **Simulation paie** (`pages-simulations.js` + `style.css`), **toutes confinées à la simulation** (aucun impact sur la vraie page Employés & Horaires). (1) **Fenêtre d'ouverture affichée dans la grille** : l'en-tête de chaque jour de la grille empgrid de la sim affiche désormais la **fenêtre de service** réglée (`serviceHours[dow]`, ex. « 🕐 12:00–21:00 ») sous le nom du jour. Les jours d'ouverture pilotaient déjà l'ajout/retrait des colonnes (`visibleIdx`) ; le compteur de personnes/jour lit maintenant le **tableau** de quarts. **Lien ouverture ↔ heures de service** : régler une fenêtre de service pour un jour dans `updateSimServiceHours` l'**ajoute automatiquement** à `openDays` (sinon le jour n'apparaissait pas dans la grille même avec des heures — la grille dépend de `openDays`, pas de `serviceHours`). CSS `.schedule-empgrid-day-svc`. (2) **Quarts coupés (shift coupé)** : `emp.shifts[dow]` accepte désormais **soit un objet `{start,end}`** (ancien format, rétrocompat lecture), **soit un tableau** de `{start,end}` — un employé peut donc avoir **plusieurs quarts dans la même journée** (ex. Lundi 12:00–14:00 **puis** 17:00–21:00). Nouveau helper **`simDayShifts(entry)`** normalise toujours vers un tableau. Touche : `computeSimScenario` (somme heures + heures éligibles pourboires sur tous les quarts du jour via `intersectShiftHours`), `renderSimEmpRow` (N cartes empilées + bouton **« + Quart »** pour ajouter un autre quart le même jour), `openSimShiftModal(simId,empId,dow,shiftIdx)` (ajout vs modif par index), `setSimDayShift`/`deleteSimDayShift`/`_writeSimEmpShifts` (mutations par index ; stockage **toujours en tableau**), drag&drop (déplace **un** quart précis qui **s'ajoute** aux quarts du jour cible au lieu d'écraser), graphique de couverture (`countSimCoverageAtHour` compte l'employé **une fois** s'il est présent dans l'un de ses quarts ; plage X élargie sur tous les quarts). CSS `.sim-cell-multi`, `.sim-add-shift-btn`. *(L'ancien `updateSimShift` à champ unique est remplacé.)* (3) **Bouton « Copier l'horaire »** dans la barre d'outils de l'éditeur de sim : remplace (avec confirmation) les **employés + quarts** de la simulation par l'**horaire planifié de la semaine en cours** (offset 0 — noms, taux, sections, quarts via `shiftsByDateToByDow`), en **conservant** les réglages de pourboires, de ratio salaires/ventes et de jours d'ouverture. Fonctions `copyCurrentWeekIntoSim`/`doCopyCurrentWeekIntoSim`. **Sécurité** : aucun changement de règles Firestore (tout reste dans le doc `/payrollSimulations`, admin only). Banc d'essai : `node --check` OK (3 fichiers) + 12/12 cas de logique des quarts coupés (heures, fenêtre de service, rétrocompat, quart à minuit, quart incomplet filtré). `CACHE_VERSION` → `v3.45.0`. *(Hors scope, comme convenu : les fenêtres de service restent une seule plage par jour, et la vraie page Horaire n'a pas les quarts coupés.)*
>
> ⚠️ **8 juin 2026 — v3.44.0** — **Option « Sans pourboire » configurable par employé**. Nouveau réglage **permanent** sur la fiche employé : un employé marqué « sans pourboire » est **exclu du partage** (reçoit 0 $ **et** ses heures ne diluent pas le pool de l'équipe) — utile pour un gérant/propriétaire qui ne touche pas aux pourboires. (1) **Fiche employé** (`openEmployeeModal`/`saveEmployee`, pages-hr.js) : nouvelle case **`e-no-tips`** sous la Section. Stocké dans le champ **`noTips`** (bool) de `/employees` — non sensible (pas de montant), donc reste avec `section` (pas besoin de `/employeesComp`). (2) **Calcul** (`getEffectiveTipGroup`, pages-payroll.js) : si `emp.noTips` et **aucune dérogation de semaine**, l'employé est traité comme **`excluded`** (même mécanique que l'option « Exclu » du select de semaine v3.18.0). **La dérogation de semaine garde la priorité** → on peut **réinclure ponctuellement** un employé « sans pourboire » en le mettant sur Cuisine/Service pour une semaine exceptionnelle, sans toucher à sa fiche. (3) **Visibilité** : le label « Auto » du select de la grille Salaires affiche « Auto (Sans pourboire) » pour ces employés ; badge rouge **« Sans pourboire »** (icône `ban`, nouvelle dans icons.js) sur la team card (Horaires) et dans la grille Salaires (si pas de dérogation). CSS `.no-tips-badge`. **Sécurité** : aucun changement de règles (`noTips` est un champ de `/employees`, déjà écriture admin). *(Hors scope : la page Simulation paie utilise ses propres copies d'employés et n'hérite pas encore de `noTips`.)* Banc d'essai : `node --check` OK sur les 3 fichiers JS. `CACHE_VERSION` → `v3.44.0`.
>
> ⚠️ **8 juin 2026 — v3.43.2** — **Horaires : retéléchargement des PNG sans recharger + ratio en liste déroulante (25-40 %)**. Deux corrections d'ergonomie sur la page Employés & Horaires (`pages-hr.js` + `style.css`). (1) **Bug : impossible de retélécharger un rapport PNG après modif sans recharger la page**. Cause : le téléchargement utilisait `canvas.toDataURL()` + `<a href="data:...">`. Chrome étouffe/bloque les téléchargements répétés de **grosses data-URI** jusqu'à une navigation → le 2e export ne partait plus tant qu'on n'avait pas rechargé. Corrigé : nouveau helper **`_downloadCanvasPNG(canvas, filename)`** qui passe par **`canvas.toBlob()` + `URL.createObjectURL()`** (révoqué après 2 s), non soumis à ce blocage. Les **deux** exports (PNG équipe + PNG admin) l'utilisent. Ajout aussi d'un **nettoyage défensif** : `document.getElementById(id)?.remove()` avant de recréer le conteneur off-screen, au cas où un `finally` n'aurait pas tourné. (2) **Ratio salaires/ventes : `<input number>` remplacé par un `<select>` 25 % → 40 %** (pas de 1 %), plus facile à régler au doigt qu'un champ à spinner. Options générées dans `renderEmployes` (`ratioOptions`) ; si la valeur enregistrée tombe hors plage (réglage antérieur), elle est ajoutée à la liste pour ne pas la perdre. Le `onchange` appelle toujours `updateSalesRatio`. CSS : `.schedule-ratio-pill__select` (chevron SVG accent, look identique au pill). *(`updateSalesRatioLive`, l'ancien `oninput`, n'est plus appelé — conservé sans effet.)* **Sécurité** : aucun changement de règles. Banc d'essai : `node --check` OK, aucune occurrence active de `toDataURL`/`salaryRatio`. `CACHE_VERSION` → `v3.43.2`.
>
> ⚠️ **8 juin 2026 — v3.43.1** — **Rapports PNG des Horaires : même ordre que l'affichage + fix ventes prévues**. Deux corrections sur les exports PNG de la page Employés & Horaires (`pages-hr.js`). (1) **Ordre des employés** : les deux exports (`exportScheduleAsPNG` équipe + `exportScheduleAsPNGAdmin`) construisaient leur liste avec `employees.filter(...)` (ordre brut du tableau), ignorant l'ordre **par semaine** (`weekOrder`), les **masqués** (`weekHidden`) et la gestion des **archivés** — d'où un ordre différent de la grille à l'écran. Désormais ils partent de **`visibleScheduleEmployees(weekDays, weekKey)`** (la même source que `renderEmployes`) puis excluent les employés sans aucun shift sur la semaine (comportement v3.32.0 conservé). Le PNG respecte donc l'ordre, les masqués et les archivés exactement comme l'affichage. (2) **Ventes prévues (bug)** : le PNG admin lisait `scheduleSettings.salaryRatio` — **champ inexistant** (le vrai champ écrit par le pill de ratio est `salesRatio`) → `Number(undefined)` = `NaN` → retombait **toujours** sur le défaut `0.30`, peu importe le ratio réglé. La page web utilise `salesRatio` (défaut `0.32`). Résultat : ventes prévues du PNG = `coût ÷ 0.30` au lieu de `coût ÷ ratio_réel`. Corrigé : le PNG lit maintenant `scheduleSettings.salesRatio || 0.32`, identique au web. Le compteur « N en congé toute la semaine » du PNG admin compare aussi désormais avec la liste visible de la semaine (et non `employees.length` brut). **Sécurité** : aucun changement de règles. Banc d'essai : `node --check` OK. `CACHE_VERSION` → `v3.43.1`.
>
> ⚠️ **8 juin 2026 — v3.43.0** — **Confidentialité des salaires : rémunération sortie de `/employees` vers `/employeesComp` (admin only)**. Problème réglé (TODO sécurité) : les vues employé n'affichaient jamais les montants, **mais** les champs `hourlyRate` / `isSalaried` / `fixedWeeklyHours` des docs `/employees` restaient **lisibles par tout compte connecté** (un employé pouvait les voir via la console du navigateur), car les règles Firestore protègent au niveau du **document**, pas du champ. **Solution** : nouvelle collection **`/employeesComp/{empId}`** (`{ hourlyRate, isSalaried, fixedWeeklyHours, updatedAt }`) en **lecture+écriture admin only** ; `/employees` ne contient plus la rémunération (mais garde nom, section, PIN, shifts, congés — lisible par tous). **Fusion transparente** : `_applyEmployeeComp()` (pages-hr.js) réinjecte la rémunération dans le tableau `employees` en mémoire **côté admin**, donc les **dizaines de lectures** existantes de `emp.hourlyRate` (Salaires, Horaires, Simulation, Dashboard) fonctionnent **sans aucune modification**. Pour un non-admin, le listener `/employeesComp` est refusé (permission-denied géré) → la rémunération reste absente. **Migration automatique** : `migrateEmployeeComp(rawEmps)` (admin, idempotent, anti-concurrence via `_compMigrationInFlight`) détecte les fiches `/employees` contenant encore la rémunération, la copie dans `/employeesComp` **puis la retire** de `/employees` (`FieldValue.delete()`). Se déclenche au snapshot `/employees` quand l'admin est connecté. **`saveEmployee`** écrit désormais le « public » dans `/employees` et la rémunération dans `/employeesComp` (séparément). **Listeners** : `/employees` appelle `_applyEmployeeComp` + `migrateEmployeeComp` ; nouveau listener `/employeesComp` admin-only tolérant. **Aucune** des dizaines de lectures de taux n'a eu besoin d'être touchée ; `duplicateItem` lit depuis Firestore (donc une copie d'employé n'a pas de rémunération → l'admin la ressaisit). **⚠ Après déploiement : (1) republier `firestore.rules`** (nouvelle collection `/employeesComp`) **puis (2) se connecter une fois en admin** pour déclencher la migration (tant que ce n'est pas fait, les anciens taux restent dans `/employees`). Banc d'essai : fusion + détection de migration + idempotence validées ; 4 fichiers compilent. `CACHE_VERSION` → `v3.43.0`. *(Code mort `applyPayrollConfigs`/seed qui écrivait la rémunération dans `/employees` n'est plus appelé ; la migration le rattraperait de toute façon.)*
>
> ⚠️ **8 juin 2026 — v3.42.0** — **Demandes de congé / vacances par les employés (nouvelle section)**. Nouveau fichier `js/pages-leave.js` (~430 lignes) + nouvelle collection Firestore **`leaveRequests`**. Nouveau fichier `js/pages-leave.js` (~430 lignes) + nouvelle collection Firestore **`leaveRequests`**. (1) **Page employé « Demande de congé »** (`demande-conge`, kiosque) : l'employé tape son **NIP** (même mécanisme que le pointage) pour s'identifier, choisit le **type** (les 4 : vacances/maladie/personnel/sans solde), puis un ou plusieurs jours sur un **calendrier mensuel** (multi-sélection), ou un **congé partiel** (entrer plus tard / finir plus tôt + heure, via le champ heure typable v3.40.0). **Règle des 2 semaines** : jour visé à **> 14 jours → approuvé automatiquement** (`status:"approved"`, `autoApproved:true`) ; jour à **≤ 14 jours → en attente** (`status:"pending"`) avec message « à faire approuver par ton superviseur ». Une bannière live indique le sort de la sélection. L'employé voit la liste de **ses demandes** avec statut. (2) **Affichage dans les horaires** : `getTimeOff()` (pages-hr.js) est **étendu** pour inclure les demandes **approuvées de journée complète** → un congé approuvé verrouille le jour et s'affiche « Vacances / Maladie / … » partout (Horaire, Salaires, Mon horaire) sans code en double (objet marqué `_fromRequest`, clic → page admin). Les **congés partiels approuvés** s'affichent comme **badge** sur la cellule d'horaire (`partialLeaveBadgeHTML`). (3) **Page admin « Demandes de congé »** (`demandes-conge`, sous RH & Horaires) : onglets par statut (En attente / Approuvées / Refusées / Toutes) avec compteurs, **Approuver / Refuser** pour les en attente, **Retirer** sinon. (4) **Notifications** : **pastille de compteur** (demandes en attente) dans la sidebar (item + section RH repliée) + **bandeau** sur le tableau de bord (`renderLeaveDashboardBanner`, admin only, clic → page). Temps réel via listener `leaveRequests`. **Modèle** : `{ empId, empName, type, kind:"full"|"partial", dates[], partial:{dk,mode,time}, status, autoApproved, reason, requestedAt, decidedAt, decidedBy }`. **Permissions** : `employee.canAccess/canWrite += demande-conge` ; `global_admin += demandes-conge`. **Sécurité** : nouvelles règles `/leaveRequests` — lecture tous authentifiés, **création** tous authentifiés (l'auto-approbation > 2 sem. est validée côté app, même modèle de confiance que le pointage par PIN), **update/delete admin only**. **⚠ Après déploiement : republier `firestore.rules` dans la console Firebase** (nouvelle collection `/leaveRequests`). CSS ~230 lignes (`.leave-cal`, `.leave-type-btn`, `.leave-banner`, `.leave-admin-card`, `.leave-dash-banner`, `.nav-badge`, `.shift-partial-badge`…). Banc d'essai : 7/7 cas de la règle des 2 semaines + scan congés approuvés/partiels validés ; les 7 fichiers JS compilent. `CACHE_VERSION` → `v3.42.0`. *(Page en français seulement pour l'instant, comme les autres pages admin récentes.)*
>
> ⚠️ **8 juin 2026 — v3.41.0** — **% de pourboires sur ventes + 2 totaux avant/après pourboire par semaine (Salaires)**. Ajouts demandés sur le rapport de paie, déclinés aux **3 vues**. (1) **% de pourboires sur ventes** = `totalTips ÷ weekSales` (pourboires entrés ÷ ventes réelles de la semaine, saisies dans Employés & Horaires). (2) **2 totaux par semaine** : **avant pourboire** = salaires bruts (`sumGross`, ce qui sort des poches), **après pourboire** = total versé à l'équipe (`sumTotal`, salaires + pourboires distribués). **Emplacements** : (a) **Page Salaires à l'écran** — les 2 totaux « Sans pourb. » / « Avec pourb. » existaient déjà (v3.34.0) ; ajout du **% des ventes en pourboires** (en accent) dans la ligne de résumé du panneau totaux. (b) **PDF 1 semaine** — nouveau **5ᵉ KPI « % pourb. / ventes »** (les KPI « Salaires bruts » / « Total à payer » couvrent déjà avant/après) ; grille KPI passée de 4 à 5 cartes. (c) **PDF 2 semaines** — la fiche **« Détail par semaine »** (une par semaine) est enrichie : libellés explicites **Avant pourb.** / **Après pourb.** (après en gras) + ligne contextuelle `heures · Ventes · Pourb · X % des ventes`. **Implémentation** : `_computePayrollWeekData` retourne désormais `weekSales` et `tipPctSales` par semaine ; `tipPctSales` calculé aussi dans le render écran et le PDF 1 sem. **Sécurité** : aucun changement de règles (lecture seule de `settings/schedule.actualSales` déjà chargé). `CACHE_VERSION` → `v3.41.0`.
>
> ⚠️ **8 juin 2026 — v3.40.0** — **Saisie d'heure typable au clavier (précise à la minute) + suggestions 15 min**. Les modals de quart utilisaient un `<select>` rigide (Salaires aux 15 min, Horaire/Simulation aux 30 min) — impossible d'entrer une heure exacte comme un punch réel à **17:04**. Remplacés par un **champ texte couplé à un `<datalist>`** : on peut **taper l'heure exacte au clavier** OU piger une valeur **aux 15 min** dans la liste déroulante. Helpers partagés dans `utils.js` : `TIME_OPTIONS_15` (96 valeurs 00:00→23:45), `timeDatalistHTML()`, `timeInputHTML(id, value)` (input texte + normalisation au blur), `normalizeTimeInput(raw)` (accepte `17:04`, `1704`, `17h04`, `17`→`17:00`, `13:3`→`13:03` ; retourne `""` si vide, `null` si invalide ; valide 0-23h / 0-59min). Appliqué aux **3 modals** : Salaires (`pages-payroll.js`), Horaire (`pages-hr.js`), Simulation (`pages-simulations.js`) — chacun normalise + valide à l'enregistrement (toast si format invalide). CSS `.time-input` / `.time-input-hint` (~30 lignes). **Sécurité** : aucun changement de règles (les heures restent des strings `HH:MM` dans les mêmes champs). Banc d'essai : 17/17 cas de normalisation passés. `CACHE_VERSION` → `v3.40.0`. *(Note : `buildPayrollTimeOptions`/`PAYROLL_TIME_OPTIONS_15` ne sont plus appelés ; `buildTimeOptions`/`SCHEDULE_TIME_OPTIONS` restent utilisés par les sélecteurs de fenêtre de service de la Simulation.)*
>
> ⚠️ **7 juin 2026 — v3.39.0** — **Bouton « Annuler » (undo) dans l'horaire + retrait du menu « Plus »**. (1) **Annuler** : nouvelle pile en mémoire (max **5** derniers changements) sur la page **Employés & Horaires**. Bouton **« Annuler (N) »** dans la barre d'outils (désactivé si rien à annuler) + raccourci **Ctrl/Cmd+Z** (ignoré dans les champs de saisie et quand une modale est ouverte). API : `_scheduleUndo[]`, `SCHEDULE_UNDO_MAX=5`, `pushScheduleUndo(label, restoreFn)`, `undoLastSchedule()`, helper `_restoreShiftFn`. Chaque action annulable capture l'état **avant** modification et enregistre une fonction de restauration. **Actions câblées** : ajout/modif/suppression de quart, **déplacement** de quart (drag&drop), **congé** (ajout plage / modif / retrait — restaure aussi les quarts retirés par le congé), **masquer/réafficher** un employé de la semaine, **réordonnancement** par semaine, **archivage** d'un employé. L'annulation est elle-même une écriture Firestore (pas de « refaire »). Validé par banc d'essai sur le vrai code (9/9 tests). (2) **Menu « Plus » retiré** de la barre d'outils Horaires : il ne contenait que des outils d'amorçage codés en dur (« Importer horaire type » qui **écrasait** l'horaire, « Appliquer salaires fixes ») — dangereux pour un resto en activité. Les fonctions `seedScheduleFromTemplate`/`applyPayrollConfigs` restent dans le code (non appelées). `CACHE_VERSION` → `v3.39.0`.
>
> ⚠️ **7 juin 2026 — v3.38.0** — **Ordre & retrait d'employés par semaine + archivage non destructif**. Trois besoins liés. (1) **Ordre par semaine (Horaires)** : le drag & drop des employés dans **Employés & Horaires** n'écrit plus le `sortOrder` **global** mais un ordre **propre à la semaine affichée**, stocké dans `settings/schedule.weekOrder[weekKey]` (`weekKey` = `dayKey` du lundi, comme `actualSales`). Réordonner une semaine n'affecte plus les autres. (La page **Salaires** avait déjà un ordre par semaine via `payroll/{weekId}.empOrder`.) (2) **Retrait par semaine (les deux pages)** : bouton **✕** sur chaque cellule employé → « retirer de cette semaine » (réversible, **non destructif** : les quarts/heures restent en mémoire). Stocké dans `settings/schedule.weekHidden[weekKey]` (Horaires) et `payroll/{weekId}.hiddenEmps` (Salaires). Un **bandeau « Masqués cette semaine »** liste les retirés avec un clic pour les réafficher. (3) **Suppression = archivage** : « Supprimer » un employé fait désormais un **soft-delete** (`employees[id].archived = true` + `archivedAt`) au lieu d'effacer la fiche. **L'historique est préservé** — un archivé reste visible dans les **semaines passées où il a travaillé** (Horaires : a un quart cette semaine ; Salaires : a des heures réelles cette semaine), avec un badge **« Archivé »**. Il est **exclu de toutes les vues courantes** (équipe active, pointage par PIN, vues employé, dashboard, simulations, recherche, ajout de quart/congé). Un **bandeau en bas de la page Équipe** liste les archivés avec un bouton **« Restaurer »**. **Helpers** (`pages-hr.js`) : `activeEmployees`, `empWorkedOnDays`, `scheduleWeekKey`, `visibleScheduleEmployees`, `getScheduleWeekOrder/Hidden`, `hide/unhideEmpFromScheduleWeek`, `askDeleteEmployee`, `restoreEmployee` ; (`pages-payroll.js`) `getPayrollHidden`, `hasActualThisPayrollWeek`, `hide/unhideEmpFromPayrollWeek`. **Icône** `eye-off` ajoutée. **CSS** `.emp-week-remove`, `.emp-archived-badge`, `.week-hidden-banner/-chip`, `.archived-emps-banner/-chip` (~120 lignes). **Sécurité** : aucun changement de règles (`archived`/`timeOff`/`weekOrder`/`weekHidden` sont des champs de docs déjà couverts — `/employees` admin, `/settings/schedule` et `/payroll` admin). **Pas besoin de republier `firestore.rules`.** `CACHE_VERSION` → `v3.38.0`.
>
> ⚠️ **7 juin 2026 — v3.37.0** — **Congés approuvés des employés (jours verrouillés)**. Nouveau concept distinct des cellules vides : un **congé approuvé** se stocke dans `employees[id].timeOff[dk] = { type, note, createdAt }` (`dk` = clé jour `YYYY-MM-DD`). (1) **Saisie** : bouton **« Ajouter un congé »** dans la barre d'outils Employés & Horaires → modal **plage de dates** (employé + du/au + type + note) qui marque tous les jours d'un coup ; ET raccourci **« Marquer en congé »** dans le modal de quart (un seul jour). Marquer un congé **retire automatiquement les quarts** déjà présents ces jours-là. (2) **Types** (`LEAVE_TYPES` dans `config.js`) : Vacances (teal), Maladie (ambre), Personnel (violet), Sans solde (gris) — couleur appliquée à la carte. (3) **Verrouillage** : un jour en congé affiche une carte pleine **« CONGÉ » + type**, n'est **pas une cible de drag & drop**, et `saveShiftFromModal`/`shiftCardDrop` refusent d'y assigner un quart (toast d'avertissement). (4) **Propagation partout** : Salaires & Pourboires (carte CONGÉ, pas d'alerte « pas pointé », pas d'auto-fill — sauf si l'employé a quand même pointé, alors ses heures réelles priment), vue employé **Mon horaire** (carte Congé lecture seule). (5) **Renommage** : les cellules **vides** (sans quart) s'appellent désormais **« Libre »** (au lieu de « Congé ») pour les distinguer du vrai congé. **Helpers** (`pages-hr.js`) : `getTimeOff`, `isTimeOff`, `leaveTypeMeta`, `leaveTypeLabel`, `buildLeaveTypeOptions`, `_dkRange`. **i18n** : `shift_off` → « Libre », nouveau `shift_leave` → « Congé »/« Descanso ». **CSS** : `.shift-card--leave` (~55 lignes). **Sécurité** : aucun changement de règles — `timeOff` est un champ de `/employees` (déjà écriture admin), donc **pas besoin de republier `firestore.rules`**. `CACHE_VERSION` → `v3.37.0`.
>
> ⚠️ **5 juin 2026 — v3.36.2** — **Checklists cochables, cartes de tâches, dashboard groupé + début de la traduction ES**. (1) **Ouverture/Fermeture** : les listes deviennent **cochables** (cases à cocher) avec **remise à zéro automatique chaque jour**. Items stockés en `{id, text}` dans `settings/openClose` ; l'état coché du jour est dans une nouvelle collection **`dailyChecklistState/{YYYY-MM-DD}`** (nouveau doc chaque jour = aucune case cochée). Tous les rôles peuvent cocher. Barre de progression `N/total` par liste. (2) **Tâches du jour** : chaque tâche peut avoir une **heure** (HH:MM) et un **commentaire/détails** ; affichées en **petites cartes** sur l'accueil employé (badge heure + note sous le titre). (3) **Dashboard admin** : le widget « En service aujourd'hui » est **groupé Cuisine/Service** avec le même visuel coloré que l'accueil employé. (4) **i18n** : début de la traduction espagnole réelle des pages **codées en dur** — **Pointage, Accueil employé, Mon horaire, Ouverture/Fermeture, Tâches du jour** entièrement branchées sur `t()` (+ ~90 nouvelles clés FR/ES, helpers `uiLocale()` et `tDayShort()`, dates localisées). Clé cassée `rec_total_items` corrigée. **Reste à traduire** (encore en français) : Salaires, Simulation, Employés (partiel), Événements, Soumissions, Factures, Rapports mensuels, Liste d'ingrédients. **Sécurité** : nouvelle règle `/dailyChecklistState` (lecture+écriture authentifié). `CACHE_VERSION` → `v3.36.2`. **⚠ Après déploiement : republier `firestore.rules`** (collections `/dailyTasks` + `/dailyChecklistState`).
>
> ⚠️ **5 juin 2026 — v3.36.1** — **Accueil employé : code couleur par section + couleurs d'événements**. (1) Bloc **« En service aujourd'hui »** désormais **regroupé par section** (Cuisine / Service / Autre) avec un séparateur coloré par groupe (ambré cuisine, bleu service, gris autre) + barre latérale colorée sur chaque ligne — on voit d'un coup d'œil qui est en cuisine vs en service. (2) Bloc **« Prochains événements »** : icône + barre latérale colorées **par type d'événement** (réservation bleu, karaoké violet, spectacle orange, hors-Bochica slate, férié rouge, interne vert), via le nouveau helper `empEventColor()` qui réutilise les variables CSS `--ev-*` de la page admin Événements. CSS : `.dash-sec-group`/`.dash-sec-divider`/`.dash-sec-dot` + `.dash-today-item--sec` (barre gauche). `CACHE_VERSION` → `v3.36.1`.
>
> ⚠️ **5 juin 2026 — v3.36.0** — **Tâches de la journée + page Ouverture/Fermeture**. Nouveau fichier `js/pages-ops.js` (~330 lignes). (1) **Accueil employé refondu** : retrait des blocs « Horaire de l'équipe (cette semaine) » (redondant avec la page Mon horaire) et « À réapprovisionner ». Nouveau bloc **« Tâches de la journée »** avec items **cochables** (clic → complété, état partagé pour toute l'équipe). (2) **Tâches définies en mode admin** (nouvelle page `taches-jour`, admin only, sous RH & Horaires) — deux types : **récurrentes** (réapparaissent chaque jour, le coché se réinitialise à minuit via `lastCompletedDate`) et **ponctuelles** (faites une seule fois, `done=true` ; affichées barrées le jour même puis masquées le lendemain via `doneDate`). (3) Nouvelle page **`ouverture-fermeture`** (employés + admin, PAS le chef) : deux **listes de référence en lecture seule** (À l'ouverture / À la fermeture), éditables par l'admin via « Modifier les listes » (textarea, 1 ligne = 1 item). **Modèle Firestore** : collection `dailyTasks` (`{id, title, type:"recurring"|"once", sortOrder, done, doneDate, doneBy, lastCompletedDate, lastCompletedBy}`) + doc `settings/openClose` (`{opening[], closing[]}`). **Sécurité** : règle `/dailyTasks` — lecture tous authentifiés, create/delete/édition du contenu = admin only, les non-admin peuvent UNIQUEMENT changer les champs de complétion (`_dailyTaskToggleOnly()` via `affectedKeys().hasOnly(...)`). `settings/openClose` couvert par la règle `/settings/{doc=**}` existante. **Permissions** : `employee.canAccess` += `ouverture-fermeture` ; `global_admin` += `taches-jour` + `ouverture-fermeture`. **Listeners** : `dailyTasks` (render accueil/taches-jour), `settings/openClose` (render ouverture-fermeture). `sw.js` : `pages-ops.js` ajouté à l'app shell, `CACHE_VERSION` → `v3.36.0`. **⚠ Après déploiement : publier `firestore.rules` dans la Console Firebase** (nouvelle collection `/dailyTasks`). Nouveau fichier `js/pages-ops.js` (~330 lignes). (1) **Accueil employé refondu** : retrait des blocs « Horaire de l'équipe (cette semaine) » (redondant avec la page Mon horaire) et « À réapprovisionner ». Nouveau bloc **« Tâches de la journée »** avec items **cochables** (clic → complété, état partagé pour toute l'équipe). (2) **Tâches définies en mode admin** (nouvelle page `taches-jour`, admin only, sous RH & Horaires) — deux types : **récurrentes** (réapparaissent chaque jour, le coché se réinitialise à minuit via `lastCompletedDate`) et **ponctuelles** (faites une seule fois, `done=true` ; affichées barrées le jour même puis masquées le lendemain via `doneDate`). (3) Nouvelle page **`ouverture-fermeture`** (employés + admin, PAS le chef) : deux **listes de référence en lecture seule** (À l'ouverture / À la fermeture), éditables par l'admin via « Modifier les listes » (textarea, 1 ligne = 1 item). **Modèle Firestore** : collection `dailyTasks` (`{id, title, type:"recurring"|"once", sortOrder, done, doneDate, doneBy, lastCompletedDate, lastCompletedBy}`) + doc `settings/openClose` (`{opening[], closing[]}`). **Sécurité** : règle `/dailyTasks` — lecture tous authentifiés, create/delete/édition du contenu = admin only, les non-admin peuvent UNIQUEMENT changer les champs de complétion (`_dailyTaskToggleOnly()` via `affectedKeys().hasOnly(...)`). `settings/openClose` couvert par la règle `/settings/{doc=**}` existante. **Permissions** : `employee.canAccess` += `ouverture-fermeture` ; `global_admin` += `taches-jour` + `ouverture-fermeture`. **Listeners** : `dailyTasks` (render accueil/taches-jour), `settings/openClose` (render ouverture-fermeture). `sw.js` : `pages-ops.js` ajouté à l'app shell, `CACHE_VERSION` → `v3.36.0`. **⚠ Après déploiement : publier `firestore.rules` dans la Console Firebase** (nouvelle collection `/dailyTasks`).
>
> ⚠️ **4 juin 2026 — v3.35.0** — **Deux nouvelles vues pour le rôle Employé (sans aucune donnée financière)**. Nouveau fichier `js/pages-employee.js` (~330 lignes). (1) **Accueil employé** (page `accueil`) : tableau de bord de la journée avec 4 blocs — « En service aujourd'hui » (équipe en shift + heures, pastille de section), « Prochains événements » (30 j, icône de type + capacité, sans contacts clients), « Horaire de l'équipe (cette semaine) » (bande de 7 jours avec compteur de personnes + bouton vers l'horaire complet), « À réapprovisionner » (produits rouge/jaune, statut Vide/Bas). (2) **Mon horaire** (page `mon-horaire`) : grille empgrid **en lecture seule** employés × jours pour la semaine en cours, navigation de semaine (←/→), plages entrée→sortie et cartes « Congé ». **Le nombre d'heures travaillées n'est PAS affiché** (ni durée par shift, ni colonne total « Heures ») — uniquement les plages horaires. **Aucun taux horaire, coût, salaire, ratio ni montant $** rendu dans ces deux pages (vérifié par test anti-fuite). **Permissions** (`config.js`) : `employee.canAccess` = `["accueil", "mon-horaire", "inventaire", "pointage"]` ; la page d'accueil au login reste **Pointage** (tablette kiosque inchangée). **Navigation** : 2 liens directs en haut de la sidebar, visibles uniquement pour le rôle employee (filtrés par `canAccess` pour admin/chef). **Listeners** : `employees`/`events`/`settings.schedule` re-rendent aussi `accueil`/`mon-horaire` (temps réel). **Sécurité** : aucune modif des règles Firestore (lecture de `employees`/`events`/`products` déjà ouverte à tout user authentifié) ; les champs de taux restent lisibles côté BD comme avant — seules les **vues** masquent les montants. CSS ~60 lignes (`.emp-dash-hello`, `.emp-week-strip`, `.shift-card--readonly`, colonne « aujourd'hui »). `sw.js` : `pages-employee.js` + `pages-invoices.js` (oubli antérieur) ajoutés à l'app shell, `CACHE_VERSION` → `v3.35.0`.
>
> ⚠️ **31 mai 2026 — v3.34.0** — **Salaires : totaux semaine éclatés en « Sans » / « Avec » pourboires**. La cellule totaux à droite du panneau (sous la grille empgrid) affichait un seul montant `sumTotal` (salaires + pourboires). Maintenant 2 lignes empilées : **« Sans pourb. »** (= `sumGross`, salaires bruts seulement — ce qui sort des poches de l'admin via la dépense « Salaires sem. N ») et **« Avec pourb. »** (= `sumTotal`, en plus gros avec font Bebas Neue, séparée par une fine bordure ambrée — total reçu par l'équipe en incluant les tips distribués). Le sous-texte italique à gauche du panneau retire la mention `Salaires X · Pourboires Y` (qui devient redondante) et garde juste `Pourboires distribués Y` pour le contexte. Tooltips au hover sur chaque ligne pour expliquer la nuance. Pas de changement aux calculs ni au PDF (qui distingue déjà `Total à payer` / `Salaires bruts` / `Pourboires distribués` dans ses KPI v3.16.0).
>
> ⚠️ **31 mai 2026 — v3.33.0** — **Nouveau module Factures (admin only, sous Finances)**. Permet de créer des factures clients pour événements/services/locations avec lignes libres + génération PDF en quelques secondes. Nouveau fichier `js/pages-invoices.js` (~700 lignes). **Modèle Firestore** : collection `invoices` avec `invoiceNumber` (auto-incrément format `FAC-2026-001` par année), `clientName`/`clientCompany`/`clientPhone`/`clientEmail`/`clientAddress`, `invoiceDate` + `dueDate` (échéance +30 j par défaut), `lines[]` (`{ id, description, quantity, unitPrice }`), `tpsRate` (5% par défaut, modifiable par facture), `tvqRate` (9.975% par défaut, modifiable), `notes`, `status` (`brouillon`/`envoyee`/`payee`/`annulee`), `paidAt` (timestamp), `paidRevenueId` (id du doc `/revenues` créé auto). **Liste** : 4 KPI en haut (Total facturé · Encaissé · En attente · Brouillons), onglets de filtre par statut avec compteurs, recherche par n°/client/entreprise, cartes avec barre latérale colorée par statut (gris brouillon / bleu envoyée / vert payée / rouge annulée), tag rouge « En retard » si envoyée et dueDate passée. **Modal d'édition** : sections Client / Dates+statut / Lignes (ajout-suppression dynamique avec recalcul des totaux en temps réel) / Taxes modifiables / Notes. **Génération PDF jsPDF Letter** : en-tête BOCHICA + tricolore + bloc Client + bloc Détails + tableau lignes (zébré, multi-pages auto) + totaux avec total final sur bandeau jaune + footer. Nom de fichier : `Bochica_Facture_FAC-2026-NNN_Client.pdf`. **Lien revenus** : marquer une facture « Payée » crée automatiquement une entrée dans `/revenues` (description « Facture FAC-... — Client », montants ventilés sub/TPS/TVQ, lien via `paidRevenueId`). Reculer le statut hors « payée » supprime le revenu lié. Supprimer une facture payée supprime aussi le revenu lié (confirmation explicite). **Sidebar** : « Factures » sous Finances (entre Dépenses et TPS/TVQ). **Sécurité** : règles Firestore admin only sur `/invoices`. Permissions ajoutées dans `ROLE_PERMISSIONS.global_admin`.
>
> ⚠️ **31 mai 2026 — v3.32.0** — **Employés & Horaires : filtre auto + nouveau rapport PNG admin**. Deux changements liés aux exports : (1) Le **« PNG pour équipe »** (existant v3.25.0) **exclut désormais les employés qui n'ont aucun shift sur la semaine visible** — quand quelqu'un est en vacances/congé toute la semaine, plus de ligne « Congé Congé Congé… » qui pollue le PNG partagé. Si tous les employés sont sans shift, toast « Aucun employé n'a de shift cette semaine » au lieu d'un PNG vide. (2) **Nouveau bouton « PNG admin » (admin only)** à côté du PNG équipe — version interne enrichie : taux horaire (incluant FIXE pour les salariés) dans la cellule employé, coût $ sous chaque shift, cellule totaux par employé (heures + salaire en couleur de section), header de jour avec totaux du jour (heures + coût), grand bandeau de 4 KPI en bas (heures totales, masse salariale, ventes prévues au ratio courant, ventes réelles avec ratio réel calculé), petit hint « N employés en congé toute la semaine non affichés » si applicable, badge rouge **« INTERNE — NE PAS PARTAGER »** en haut pour éviter qu'il finisse dans le groupe SMS de l'équipe. Nom de fichier : `Bochica_HoraireAdmin_SemNN_YYYY-MM-DD.png`. Largeur 1400 px (vs 1200 px pour le PNG équipe) pour accommoder la colonne totaux.
>
> ⚠️ **31 mai 2026 — v3.31.0** — **Salaires : bouton « Marquer absent » pour confirmer un no-show**. Avant : « Supprimer » dans le modal effaçait la cellule mais l'auto-fill (v3.29.0) la re-remplissait au prochain render — impossible de dire définitivement « cet employé n'est pas venu ». Solution : nouveau flag `markedAbsent: true` + `markedAbsentAt: timestamp` stocké dans `actualShifts[empId][dk]` (sans start ni end). L'auto-fill skip ces cellules. La card devient **grise-rouge dashed avec tag « ABSENT » + icône `user-x`** (distincte du Congé bleuté qui veut dire « pas encore pointé »). Aucune heure n'est comptée → 0 salaire + 0 pourboire pour ce jour. Dans le modal d'édition, **bouton rouge « Marquer absent »** à gauche (toujours dispo) ; si la cellule est déjà absente, ce bouton devient « Retirer absent » (bleu) qui efface complètement la cellule. Bandeau d'état contextuel dans le modal indique « Employé absent » ou « Heures auto-remplies » selon le cas. `updateActualShift` efface aussi `markedAbsent` à chaque saisie manuelle (si l'employé est finalement venu, l'admin saisit des heures et le statut absent saute). Nouveau bouton « Effacer » distinct (poubelle) pour les shifts avec heures saisies — différent de « Marquer absent ». Ajout des icônes `user-x` et `undo` à icons.js.
>
> ⚠️ **31 mai 2026 — v3.30.0** — **Employés & Horaires : drag & drop des employés pour réordonner**. Les handlers `empRowDragStart/Over/Leave/Drop` existaient (héritage de l'ancienne table HTML) mais n'étaient plus branchés depuis la refonte empgrid v3.24.1 — on ne pouvait plus changer l'ordre d'affichage des employés. Rebranchement complet : nouveau **drag handle ⋮⋮** (`grip-vertical`) à gauche du nom dans chaque cellule employé, visible au hover (`opacity .4 → 1`), curseur grab/grabbing. Les sélecteurs JS passent de `tr[data-emp-id="..."]` à `[data-emp-id="..."]` pour fonctionner avec la grille `.schedule-empgrid-row` (display:contents). Indicateur visuel ambré (`var(--accent)`) au-dessus ou en-dessous de la cellule employé sticky pour montrer où la rangée sera insérée. Persistance : batch update Firestore des champs `employees[id].sortOrder` (0, 1, 2…) — le listener Firestore re-trie automatiquement au snapshot suivant. Toast « Ordre des employés mis à jour » à la fin. Utile pour mettre un nouvel employé en haut de la liste sans devoir le supprimer/recréer.
>
> ⚠️ **31 mai 2026 — v3.29.1** — **Salaires : extension de l'auto-fill aux absences de pointage**. La v3.29.0 ne traitait que les sorties oubliées (entrée pointée sans sortie). La v3.29.1 ajoute le 2ème cas : **employé planifié qui n'a NI entrée NI sortie pointée**. 1 h après l'heure de fin prévue, le système auto-remplit `start = planned.start` + `end = planned.end` avec les flags `autoFilled: true` + `autoFilledNoStart: true`. La carte passe en orange avec le tag distinct **« PRÉSENCE ? »** (au lieu de « À VALIDER ») et une bordure gauche plus marquée en orange-rouge (`#c2410c`) pour signaler que ce cas est plus important à vérifier — l'employé est peut-être en no-show, à supprimer plutôt que valider. Dans le bandeau d'alertes en haut, **deux groupes séparés** : « Présence à vérifier — aucun pointage » (icône `alert`, fond rougeâtre) au-dessus, et « Sortie auto-remplie à valider » (icône `refresh`, fond orange) en-dessous. Toast contextuel qui combine les deux compteurs (« 2 sorties oubliées + 1 présence non pointée — auto-rempli depuis l'horaire »). `updateActualShift` efface aussi `autoFilledNoStart` à chaque édition manuelle. Le tag « PRÉSENCE ? » disparaît dès que l'admin clique sur la cellule et enregistre — soit en confirmant les heures, soit en corrigeant, soit en supprimant le shift via le modal.
>
> ⚠️ **31 mai 2026 — v3.29.0** — **Salaires : auto-remplissage des sorties oubliées (à valider)**. Quand un employé pointe son entrée mais oublie sa sortie, et qu'on est au moins **1 h après son heure de sortie prévue à l'horaire**, le système remplit automatiquement la sortie avec l'heure planifiée. La carte du jour passe en **orange ambré avec un tag « À VALIDER »** dans la grille Salaires, et une nouvelle ligne « Sortie auto-remplie à valider » apparaît dans le bandeau d'alertes en haut (séparée des « Sorties manquantes » classiques pour les cas sans horaire). Le flag `autoFilled: true` + `autoFilledAt: timestamp` est stocké dans `actualShifts[empId][dk]` et **disparaît automatiquement dès que l'admin édite la cellule via le modal** (validation par action — `updateActualShift` efface le flag à chaque écriture manuelle). Idem si l'employé pointe sa vraie sortie ensuite via la page Pointage (qui passe par `updateActualShift`). Cas où l'auto-fill ne fait rien : semaine verrouillée, pas de shift planifié (extras → restent en « En cours »), shift déjà complet, ou délai < 1 h. Garde-fou anti-boucle : `_autoFillScanInFlight` + le shift n'est plus « partiel » après auto-fill donc converge en 1 itération. Déclenché en fire-and-forget au render de la page Salaires (n'impacte pas la perception de vitesse). Toast jaune en bas pour signaler les N sorties auto-remplies.
>
> ⚠️ **29 mai 2026 — v3.28.0** — **Mode aperçu rôle pour l'admin (voir comme chef/employé)**. Nouveau pill dans la sidebar (visible uniquement pour le vrai admin) avec un select à 3 options : `Admin (réel)` / `Chef` / `Employé`. Sélectionner Chef ou Employé bascule toute l'app en mode aperçu — sidebar filtrée selon le rôle, pages cachées, boutons admin invisibles. Bandeau sticky jaune en haut « Aperçu actif — tu vois l'app comme un Employé » avec bouton « Sortir de l'aperçu ». Pas besoin de se déconnecter/reconnecter pour valider ce que voit chaque rôle. Sécurité préservée : les règles Firestore continuent à vérifier le vrai token Firebase Auth, donc même en aperçu un admin ne peut pas faire de modifs interdites côté serveur.
>
> ⚠️ **29 mai 2026 — v3.27.2** — **Délimitation visuelle des employés dans la colonne totaux**. Retour utilisateur : « les cartes dans totaux sont toutes blanches, on ne sait pas où ça finit ». Solution : barre colorée de 3 px en haut de chaque cellule totaux selon la section (ambré cuisine, bleu service, rouge exclu, gris autre) qui marque clairement où commence chaque employé. Aussi appliquée à la sim. Gap entre lignes rendu plus marqué (0.18 alpha au lieu de 0.10) pour mieux délimiter les lignes partout.
>
> ⚠️ **29 mai 2026 — v3.27.1** — **Fix bug : les employés en cours de service apparaissaient comme « Congé »**. Quand un employé pointait son entrée le matin sans avoir encore pointé sa sortie, le nouveau render v3.27.0 le traitait comme un congé (la cellule cherchait `start && end`). Fix : nouveau cas « partiel » qui détecte `start sans end` (ou inverse) et affiche une card spéciale « 09:00 → en cours » avec point vert pulsant et tag « En cours ». L'admin voit immédiatement qui travaille et clique pour saisir la sortie.
>
> ⚠️ **29 mai 2026 — v3.27.0** — **Salaires & Pourboires : refonte en empgrid avec cartes shift**. La table « ledger pro » (v3.23.0) est remplacée par la même grille **employés × jours avec cartes** que Horaires et Simulation. Cellule employé éditable avec drag handle + nom + badge EXTRA + select section override + taux + trash pour les extras. Cards shift compactes avec heures pointées + pourboire du jour en vert. Cartes « Congé » pour les jours sans pointage (avec hint « 09:00 → 17:00 · Pas pointé » si l'horaire était planifié). Modal `openPayrollShiftModal` pour éditer (selects 15 min + supprimer). Drag & drop des cards entre jours. Cellule totaux multi-lignes Hrs (réel/planif) / Écart / Sal / Pourb / Total. Panneau totaux résumé dessous.
>
> ⚠️ **29 mai 2026 — v3.26.0** — **Simulation paie : refonte en empgrid (même look que Horaires)**. La table sim utilise désormais la même grille **employés × jours avec cartes shift** que la page Employés & Horaires. Cellule employé éditable (nom + taux + section + badge FICTIF), cartes shift compactes avec drag & drop entre jours, carte « Congé » pour les jours libres, totaux multi-lignes à droite (Hrs / Sal / Pourb / Total + bouton supprimer en hover). Modal `openSimShiftModal` pour ajouter/modifier/supprimer un shift. Panneau totaux dessous avec mêmes colonnes alignées (Heures, Coût, Ventes prévues).
>
> ⚠️ **29 mai 2026 — v3.25.0** — **Horaires : carte « Congé » + export PNG public pour les employés**. (1) Les cellules vides affichent désormais une mini-carte « Congé » (dashed, gris discret) au lieu du bouton + isolé. Toute la cellule est cliquable pour ouvrir le modal d'ajout — l'effet hover passe le dashed en solid jaune. (2) Nouveau bouton « PNG pour équipe » dans la toolbar qui télécharge une image PNG de l'horaire de la semaine — **sans aucune donnée financière** (taux horaires, coûts, totaux $ retirés). En-tête Bochica + tricolore + entrées/sorties uniquement. Idéal pour partager via SMS ou affichage en cuisine sans révéler les salaires. Utilise html2canvas via CDN.
>
> ⚠️ **29 mai 2026 — v3.24.2** — **Horaires : alignement parfait du panneau totaux avec la grille du haut**. Bug visuel après la v3.24.1 : le panneau totaux (Heures/Coût/Ventes prévues/Réelles/Écart) ne s'alignait pas avec les colonnes de la grille empgrid (130px+1fr+90px vs 160px+minmax(110px,1fr)+96px). Fix : panneau totaux utilise exactement les mêmes grid-template-columns que la grille du haut, même padding, même background:var(--border), même border-radius. La rangée day-name redondante en bas (qui dupliquait les labels du header) est retirée. Les colonnes-jour s'alignent maintenant verticalement au pixel près.
>
> ⚠️ **29 mai 2026 — v3.24.1** — **Horaires : grille employés × jours (hybride tableau + cartes)**. Retour d'utilisateur après la v3.24.0 : « je veux garder ce design mais plus style tableau avec la liste de tous les employés dans une colonne à gauche ». Refonte : la vue calendrier par colonnes-jour est remplacée par une **grille tableau** avec employés en lignes à gauche (sticky, avec border-color section), 7 colonnes-jour au centre (chaque cellule = shift card compact OU bouton + Add discret), colonne totaux à droite. Garde la modal d'édition, le drag & drop entre cellules, et la palette de couleurs sections (ambré cuisine / bleu service). Plus efficace pour voir « toute l'équipe » d'un coup et identifier rapidement les jours faibles d'un employé.
>
> ⚠️ **29 mai 2026 — v3.24.0** — **Employés & Horaires : refonte en vue calendrier hebdomadaire**. La grille employés × jours est remplacée par une **grille de colonnes-jour**. Chaque jour devient une colonne avec ses cartes shift triées par heure de début (couleur de la barre latérale selon section : ambré cuisine / bleu service). Header de colonne avec compteurs « X pers · Yh ». Bouton « + Ajouter » en bas pour créer un shift. Clic sur une carte → modal d'édition. Glisser une carte vers un autre jour → déplace le shift (avec confirmation si la cible a déjà un shift de cet employé). Panneau totaux compact sous le calendrier (heures, coût, ventes prévues, ventes réelles, écart) avec labels jour en bas. Garde le coverage chart et les team cards inchangés. Maquettes proposées dans le chat, option B sélectionnée.
>
> ⚠️ **29 mai 2026 — v3.23.0** — **Salaires & Pourboires : refonte visuelle « ledger pro »**. L'alternance jaune Bochica / bleu Colombie vive est retirée — le tableau passe à un style **tableur comptable sobre** : zébré gris très léger (1 ligne sur 2), pourboires en vert subtil, employés sans pointage en gris pâle (faded), bordures fines neutres, header gris uniforme, total à payer en bold sans fond accent. Le select de section devient text-only en mode « Auto », ne se colore que quand un override est actif. Scope strict à `.payroll-table` — la page Employés & Horaires garde son alternance colorée. Maquettes proposées dans le chat, option 3 sélectionnée par l'utilisateur.
>
> ⚠️ **29 mai 2026 — v3.22.0** — **Salaires : protection du bouton « Annuler mes saisies »**. Avant : un seul clic de confirmation pouvait effacer toutes les heures pointées de la semaine — risque d'accident. Maintenant : modale dédiée avec champ texte où l'admin doit taper exactement **EFFACER** pour activer le bouton de suppression. Bouton désactivé sinon. Bordure et fond rouge dans le bandeau d'avertissement. Le bouton final affiche aussi le numéro de la semaine concernée (« Effacer la semaine 22 ») pour éviter d'effacer la mauvaise.
>
> ⚠️ **29 mai 2026 — v3.21.0** — **Salaires : PDF bi-mensuel (2 semaines) + retrait label « (saisie libre) »**. Nouveau bouton « PDF 2 sem » dans la toolbar qui génère un rapport combinant la semaine courante + la précédente — adapté à une paie aux 2 semaines, plus besoin de produire 2 rapports séparés. KPI sur 2 sem, sous-totaux par sem, tableau récap par employé (1 ligne avec colonnes S1/S2/Total pour heures, salaire, pourboires). Bouton « Exporter PDF » renommé « PDF 1 sem » pour la clarté. Par ailleurs, le suffixe « (saisie libre) » qui apparaissait dans les dropdowns d'heures (pour les valeurs hors grille 15 min comme les punchs à la minute) est retiré — la valeur exacte reste affichée sans le label parasite.
>
> ⚠️ **29 mai 2026 — v3.20.0** — **Pointage : compaction 12 pouces + 2 boutons toujours visibles + badge timezone**. La page débordait sur écran 12" (clavier coupé). Toutes les tailles réduites (keypad 96→64 px, titre 42→26 px, horloge 32→22 px, bouton min-height 200→130 px). L'écran employé affiche désormais **2 boutons côte à côte** (ENTRÉE vert + SORTIE bleu) toujours présents, avec une barre d'info au-dessus indiquant ce qui a déjà été pointé aujourd'hui. Badge timezone visible sous l'horloge (`Fuseau · jour système : 2026-05-29`) pour validation rapide. Action `override-sortie` retirée (devenue inutile avec les 2 boutons).
>
> ⚠️ **26 mai 2026 — v3.19.0** — **Salaires : bannière d'alertes intelligentes**. Nouveau bloc en haut du tableau qui détecte automatiquement 3 types d'anomalies : (1) entrée pointée mais pas sortie sur un jour passé, (2) shift de plus de 14 h (oubli probable de pointer sortie), (3) employé planifié mais aucun pointage sur un jour passé. Affichage groupé par type avec compteurs (warnings ambrés / info bleus), disparaît automatiquement dès qu'on corrige la saisie. Skip si la semaine est verrouillée. Évite que des erreurs silencieuses passent sous le radar avant le verrouillage de la paie.
>
> ⚠️ **26 mai 2026 — v3.18.0** — **Salaires : override de section par employé par semaine**. Le badge fixe « 25% Cuisine » ou « 75% Service » à côté de chaque nom devient un **select avec 4 options** : Auto (par défaut, suit la fiche employé) / Cuisine / Service / Exclu du pool. Utile quand un serveur fait une semaine en cuisine ou inversement, ou pour exclure un gérant ponctuellement. Stocké dans `payroll/{weekId}.sectionOverrides{}` — n'affecte que la semaine courante, ne touche pas à la fiche permanente. Indicateur visuel : bordure pointillée jaune + font-weight 800 quand un override est actif. Les employés "excluded" reçoivent 0 pourboire et leurs heures ne comptent plus dans le pool de la semaine.
>
> ⚠️ **26 mai 2026 — v3.17.3** — **Fix critique pointage : dayKey UTC → local + retrait auto-import planifié**. Bug racine identifié : `dayKey()` utilisait `toISOString()` qui retourne en UTC. Pour Québec (EDT/EST), un punch fait à 21h le soir basculait dans le jour SUIVANT en UTC → le système réaffichait ENTRÉE et les heures se mélangeaient entre mercredi/jeudi. Fix : `dayKey()` utilise désormais `getFullYear/Month/Date` (heure locale). Par ailleurs, le tableau Salaires & Pourboires n'importe plus l'horaire planifié dans les cellules — les inputs restent vides jusqu'à ce qu'un pointage ou une saisie manuelle les remplisse. Le planifié reste visible en petit hint gris sous chaque cellule vide pour repérer les oublis de pointage (avec fond bleuté `is-scheduled-empty`). Sanity check ajouté dans `punchDoAction` pour bloquer tout punch hors du jour local courant.
>
> ⚠️ **26 mai 2026 — v3.17.2** — **Page d'accueil du rôle Employé = Pointage**. `homePage` du rôle `employee` passé de `inventaire` à `pointage` dans `config.js`. Au login (et au clic sur le logo Bochica), la tablette permanente s'ouvre maintenant directement sur le clavier de pointage — prête à recevoir un PIN sans aucun clic intermédiaire. L'employé garde toujours accès à Inventaire via la sidebar s'il veut le consulter.
>
> ⚠️ **26 mai 2026 — v3.17.1** — **Pointage : fix auto-retour au keypad après un punch**. Bug : après avoir cliqué ENTRÉE/SORTIE, l'écran de confirmation restait bloqué et il fallait cliquer un bouton manuellement pour revenir au PIN. Cause : `renderPunch()` faisait `clearTimeout(_punchAutoResetTimer)` au début de chaque render, ce qui tuait le timer juste après qu'on l'ait armé. Fix : retrait du clearTimeout dans renderPunch (il reste dans punchReset/punchBackToKeypad pour les vrais cas d'annulation), et le setTimeout est désormais placé APRÈS renderPage(). Délai aussi raccourci de 3,5 s → 1,8 s pour fluidifier les changements d'employé pendant un rush. Le bouton « Toucher pour continuer » est renommé « Suivant → » (ne sert plus qu'à zapper l'attente).
>
> ⚠️ **26 mai 2026 — v3.17.0** — **Pointage : nouvelle page kiosque pour entrée/sortie par PIN**. Nouveau module `pages-punch.js` (~330 lignes) + section CSS dédiée. Chaque employé tape son PIN (déjà configuré dans sa fiche), le système l'identifie, affiche un seul gros bouton **ENTRÉE** ou **SORTIE** détecté automatiquement selon ce qui a déjà été pointé aujourd'hui. Les punches écrivent directement dans `payroll/{weekId}.actualShifts` → le tableau de Salaires & Pourboires se remplit tout seul. Règles Firestore élargies : tout utilisateur authentifié peut écrire sur `actualShifts` uniquement (verrouillage, pourboires et autres champs restent admin only). UI tactile (clavier 96×96 px, gros boutons), live clock, écran de confirmation post-punch, retour auto au PIN après 3 s. **Important** : après déploiement, publier `firestore.rules` mis à jour dans la Console Firebase.
>
> ⚠️ **26 mai 2026 — v3.16.3** — **Typo unifiée Horaires + Salaires + Simulation**. La refonte typo de la v3.16.2 (Inter Bold 16-18 px, tabular-nums, verts/rouges saturés) est maintenant étendue à toutes les tables `.schedule-table` — donc aussi à la page Employés & Horaires et à la page Simulation paie. Sélecteurs réorganisés en 3 sections : SHARED (`.schedule-table`), PAYROLL-ONLY (`.payroll-tip-amount` etc.), DARK MODE.
>
> ⚠️ **26 mai 2026 — v3.16.2** — **Tableau Salaires : typo plus grosse + verts/rouges plus vifs**. Refonte de la typo des chiffres : Inter Bold au lieu de Bebas Neue (plus classique et lisible que la police condensée), tailles bumpées (heures/salaire/écart/pourboire 14→16 px, Total à payer 14→18 px, fond accent du total renforcé). Verts saturés (#1f7a1f light / #7fd86b dark) et rouges (#b32820 / #ff7a72) qui ressortent enfin sur les lignes jaunes et bleues alternées. Hauteur de ligne ajustée 36→40 px pour accommoder la nouvelle typo. `font-variant-numeric:tabular-nums` partout pour aligner les chiffres en colonne.
>
> ⚠️ **26 mai 2026 — v3.16.1** — **Tableau Salaires : alternance jaune/bleu comme Horaires**. Chaque ligne employé reçoit maintenant `--emp-rgb` jaune Bochica (lignes paires) ou bleu Colombie (lignes impaires), exactement comme la page Employés & Horaires. Les anciens fonds bleu pâle (auto-importé) et jaune (modifié) ont été retirés (conflit visuel avec l'alternance) — la signalétique « cellule modifiée » passe désormais uniquement par la barre ambrée à gauche. Légende mise à jour.
>
> ⚠️ **26 mai 2026 — v3.16.0** — **Salaires : export PDF + fix bug entrée/sortie qui s'effacent**. Nouveau bouton « Exporter PDF » dans la toolbar — génère un rapport landscape Letter complet (en-tête Bochica, KPI, pourboires par jour, tableau détaillé heures entrée/sortie + salaires + pourboires + totaux, récap par employé avec bonus $/h, multi-pages auto, footer). Bug critique corrigé : quand on modifiait une heure d'entrée, l'heure de sortie s'effaçait (et inverse) parce que le 1er override n'écrivait qu'un seul champ → `getActualShift` voyait alors un override partiel sans tomber sur le planifié pour le champ absent. Fix : `updateActualShift` lit maintenant la valeur courante visible avant d'écrire et pousse toujours start+end ensemble.
>
> ⚠️ **26 mai 2026 — v3.15.3** — **Page Salaires plus large + lignes compactées**. Nouveau modifier CSS `.page.page--wide` (max-width:none) appliqué au wrapper de la page Salaires — le tableau utilise toute la largeur disponible au lieu d'être bridé à 1200 px. Hauteur de ligne réduite de 42 px → 36 px (32 px en mobile) spécifiquement pour `.payroll-table` (le planning Employés & Horaires garde ses 42 px). Plus de respiration horizontale, moins de scroll vertical.
>
> ⚠️ **26 mai 2026 — v3.15.2** — **Multiplicateur de pourboire retiré**. Le pill `100%` à côté de chaque employé (introduit en v3.15.0) faisait du bruit visuel sans réelle utilité — retrait complet de la feature : pill, input, helpers JS, action Firestore, CSS. Le calcul des pourboires revient au prorata simple des heures éligibles. Les autres nouveautés de v3.15.0 (employés extras + drag & drop) restent en place.
>
> ⚠️ **26 mai 2026 — v3.15.1** — **Récap pourboires : bonus $/h par employé**. Dans la section « Pourboires de la semaine par employé » (fiche de chaque employé), un nouveau pill jaune accent affiche `+ X,XX $/h` — le bonus moyen par heure travaillée que représente le pourboire. Petite ligne sous le pill : « Effectif : Y,YY $/h (base Z,ZZ) » pour visualiser le taux horaire complet (contractuel + bonus pourboire).
>
> ⚠️ **26 mai 2026 — v3.15.0** — **Salaires & Pourboires : extras + multiplicateur + ordre manuel**. Trois nouveautés majeures dans la page Salaires : (1) bouton **« + Ajouter un extra »** pour créer un employé ponctuel attaché à la semaine seulement (badge EXTRA + bouton retrait), sans toucher à la liste principale Employés. (2) **Multiplicateur de pourboire par employé** — pill éditable en % à côté du nom (100% par défaut, 0% = exclu du pool, 150% = part et demie). Le prorata des heures est pondéré, code couleur sémantique (gris défaut / rouge exclu / ambré réduit / vert majoré). (3) **Drag & drop des lignes** via handle ⋮⋮ à gauche — l'ordre est sauvé pour la semaine seulement (n'affecte pas Employés & Horaires).
>
> ⚠️ **26 mai 2026 — v3.14.2** — **Salaires & Pourboires : heures éditables via dropdown 15 min**. Les `<input type="time">` natifs étaient quasi inutilisables sur certains navigateurs (impossible d'ouvrir le picker une fois les spinners cachés). Remplacés par un `<select>` aux **15 min** (00:00 → 23:45, 96 crans) — cohérent avec la grille Employés & Horaires (qui reste aux 30 min). Les anciennes saisies à la minute près sont préservées via une option « (saisie libre) » insérée en tête.
>
> ⚠️ **17 mai 2026 — v3.14.0** — **Soumissions multi-options** : on peut maintenant proposer plusieurs forfaits dans une même soumission. Le client coche son option préférée sur le PDF. Chaque option a ses propres add-ons (bière, suppléments/rabais, dépôt) — le nombre de personnes reste commun. Le PDF passe automatiquement à une nouvelle page si une option ne tient pas, ajoute un bandeau d'intro « N options proposées » et une case à cocher par option. La liste affiche un badge « N options de forfait » et une fourchette de totaux (ex. 595 $ – 750 $). Rétrocompat complète avec les soumissions à un seul forfait.
>
> ⚠️ **13 mai 2026 — v3.13.8** — itérations sur les **Rapports mensuels** (16 mois pré-parsés, comparatif YoY visible par défaut avec valeurs absolues comparées, période personnalisée), **frais fixes** qui se reportent automatiquement chaque mois (rattrapage des mois manqués), **événements semaine** dans le dashboard, **tri par fournisseur** sur page À commander, typo horaire **Inter** plus lisible, page **Historique retirée**.
>
> ⚠️ **13 mai 2026 — v3.13.0** — nouvelle page **Rapports mensuels** (admin only, sous Finances). Importe et visualise les PDFs Cluster mensuels : ventes totales, par canal, par mode de paiement, top catégories, top produits, heures, corrections — tout en graphiques comparatifs avec sélecteur de période (3/6/12 mois/tout) et tableau récapitulatif mois par mois. 8 rapports pré-parsés inclus en seed.
>
> ⚠️ **12 mai 2026 — v3.12.0** — gros chantier UI/UX en 3 volets :
> 1. **Simulation paie** (v3.10.0–3.10.6) : nouvelle page admin pour scénarios RH hypothétiques (baseline figé + version modifiable, ajout/retrait employés, comparaison côte à côte $ et %, tableau avec tfoot Heures/jour/Mt/jour/Ventes prévues, graphique de couverture).
> 2. **Sidebar en accordéons** (v3.11.0) : 6 sections par domaine (Inventaire, RH, Cuisine, Finances, Clients, Fournisseurs), Dashboard hors accordéon en haut, section active auto-ouverte, promotion d'item unique en lien direct.
> 3. **UI Polish** (v3.12.0) : micro-interactions (skeleton loaders, hover cards renforcé, `animateNumber()`, `flashSaveSuccess()`), 10 empty states illustrés SVG inline (`renderEmptyState()`), widget « Aujourd'hui » du dashboard (employés en shift + événements + tâches dues + ratio salaires/ventes) et sparklines 30 jours dans les KPI cards.
>
> Voir le **CHANGELOG** plus bas pour le détail complet, et **`TODO.md`** pour les chantiers à venir (sécurité prioritaire, food cost auto, photos menu, bottom nav mobile, etc.).

## 🏠 Description
Application web de **gestion interne** pour le restaurant colombien Bochica.
- Hébergement : **Vercel** via **GitHub** (100% web, aucune installation locale)
- Base de données : **Firebase Firestore** (temps réel)
- **Installable comme PWA** sur mobile et desktop (Add to Home Screen)
- Pas de SEO — outil interne (`<meta name="robots" content="noindex, nofollow">`)

## 🔗 Liens
- GitHub : https://github.com/bochicacafebistro-hash/bochica-inventaire
- Vercel : https://bochica-inventaire.vercel.app

## 🔑 Authentification (Firebase Auth)

Migration v3.0.0 — voir `FIREBASE_AUTH_SETUP.md` pour la procédure de migration initiale.

### Comptes
| Username | Email interne | Rôle | Accès |
|---|---|---|---|
| **Bochica** | bochica@bochica.app | `global_admin` | Tout |
| **Chef** | chef@bochica.app | `chef` | Inventaire, Menu, Ingrédients, Recettes, Liste d'ingrédients, Événements |
| **Employe** | employe@bochica.app | `employee` | Inventaire uniquement |

### Sécurité
- **Firebase Authentication** (backend Google) gère les mots de passe : bcrypt-hashés côté serveur, rate-limiting, tokens JWT signés
- Le rôle est stocké dans **Firestore `/users/{uid}.role`** — vérifié côté serveur via les règles Firestore
- **Session persistante** via `firebase.auth.Auth.Persistence.LOCAL` — restauration automatique au rechargement
- L'utilisateur tape un **username simple** (Bochica) qui est traduit en email interne (bochica@bochica.app) via `AUTH_USER_EMAILS` dans `config.js`
- **Les règles Firestore** (`firestore.rules` à la racine du repo) protègent l'accès à la BD : vérifient `request.auth != null` + le rôle de l'utilisateur pour chaque collection

## 🗂️ Structure des fichiers
```
bochica-inventaire/
├── index.html              ← HTML squelette (CSS externalisé)
├── manifest.json           ← Configuration PWA
├── sw.js                   ← Service Worker (cache offline)
├── favicon.ico
├── CONTEXTE.md             ← ce fichier
├── TODO.md                 ← Liste vivante des améliorations à venir (sécurité, food cost, etc.)
├── README.md
├── firestore.rules         ← Règles Firestore (à publier dans la console Firebase)
├── FIREBASE_AUTH_SETUP.md  ← Procédure migration vers Firebase Auth
├── css/
│   └── style.css           ← Design system complet (2400+ lignes)
├── js/
│   ├── config.js           ← Config Firebase + AUTH_USER_EMAILS + ROLE_PERMISSIONS
│   ├── state.js            ← Variables globales (products, allSections, etc.)
│   ├── icons.js            ← Bibliothèque d'icônes Lucide SVG inline
│   ├── i18n.js             ← Traductions FR/ES
│   ├── utils.js            ← Utils, markdown parser, toolbar, duplicateItem, dropdowns, toast()
│   ├── inventaire.js       ← Page inventaire, stock, drag & drop produits
│   ├── modals-produits.js  ← Modals produit, note, catégorie (drag & drop), réception
│   ├── pages-secondaires.js ← Pages À commander (tri section/fournisseur), tâches (Kanban), + renderHistorique() en mort code
│   ├── pages-hr.js         ← Employés, horaires, coverage chart, salaires fixes
│   ├── pages-payroll.js    ← Salaires & Pourboires (heures réelles, fenêtre service, prorata)
│   ├── pages-simulations.js ← Simulation paie (scénarios RH hypothétiques, comparaison côte à côte)
│   ├── pages-finance.js    ← Dépenses, revenus, catégories, frais fixes, rapports, charts dépenses
│   ├── pages-kitchen.js    ← Menu, fournisseurs, ingrédients, recettes
│   ├── pages-shopping.js   ← Liste d'ingrédients (commandes par fournisseur)
│   ├── pages-events.js     ← Événements / calendrier (réservations, soirées, etc.)
│   ├── pages-quotes.js     ← Soumissions (devis clients + génération PDF jsPDF)
│   ├── pages-dashboard.js  ← Dashboard, taxes, helpers taxes, autoApplyFixedExpenses
│   ├── pages-employee.js   ← Vues rôle Employé : accueil (tableau de bord) + mon-horaire (lecture seule, sans $)
│   ├── pages-ops.js        ← Opérations : tâches du jour (accueil + admin) + page Ouverture/Fermeture
│   ├── pages-rapports.js   ← Rapports mensuels (visualisations multi-mois depuis PDFs Cluster)
│   ├── monthly-reports-seed.js ← Données seed des rapports (8 mois pré-parsés, ~63 KB)
│   ├── sidebar.js          ← Navigation, sidebar, renderPage(), goHome()
│   ├── auth.js             ← Firebase Auth, login/logout, session, rôles
│   └── firebase-listeners.js ← Listeners Firestore temps réel
└── images/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

## ⚠️ Ordre des scripts dans index.html (critique !)
```html
<script src="js/config.js"></script>
<script src="js/state.js"></script>
<script src="js/icons.js"></script>
<script src="js/i18n.js"></script>
<script src="js/utils.js"></script>
<script src="js/inventaire.js"></script>
<script src="js/modals-produits.js"></script>
<script src="js/pages-secondaires.js"></script>
<script src="js/pages-hr.js"></script>
<script src="js/pages-payroll.js"></script>
<script src="js/pages-simulations.js"></script>
<script src="js/pages-finance.js"></script>
<script src="js/pages-kitchen.js"></script>
<script src="js/pages-shopping.js"></script>
<script src="js/pages-events.js"></script>
<script src="js/pages-quotes.js"></script>
<script src="js/pages-dashboard.js"></script>
<script src="js/pages-employee.js"></script>
<script src="js/pages-ops.js"></script>
<script src="js/sidebar.js"></script>
<script src="js/auth.js"></script>
<script src="js/firebase-listeners.js"></script>
```

## 🔥 Firebase
- **Projet** : bochica-inventaire
- **Collections Firestore** :
  - `products` — inventaire (name, currentStock, minimum, section, supplierId, orderQty, orderUnit, unitsPerBox, sortOrder, archived, note)
  - `suppliers` — fournisseurs (name, contact, email, notes)
  - `employees` — employés (name, role, phone, email, pin, shifts, sortOrder) + **`noTips`** (bool, v3.44.0 — exclu permanent du partage des pourboires ; branché dans `getEffectiveTipGroup`, surclassable par une dérogation de semaine) + **`timeOff`** (v3.37.0) : map `{ dk: { type, note, createdAt } }` des congés approuvés (`type` ∈ `vacances`/`maladie`/`personnel`/`sans_solde`). Un jour présent dans `timeOff` est verrouillé : aucun quart possible (horaire + salaires), affiché « Congé » partout. + **`archived`** (bool, v3.38.0) + **`archivedAt`** : suppression douce. Un archivé est exclu des vues courantes mais **conservé** ; il reste affiché dans les semaines passées où il a travaillé (Horaires : a un quart ; Salaires : a des heures réelles). Restaurable via le bandeau « archivés ». Écriture admin (champ de la fiche employé). **Rémunération** dans `/employeesComp/{empId}` (admin only, v3.43.0) : `{ hourlyRate, isSalaried, fixedWeeklyHours }` + **`rateHistory[]`** (v3.52.0 — `[{ rate, from:"YYYY-MM-DD" }]`, paliers de taux datés ; `hourlyRate` = taux en vigueur aujourd'hui dérivé de l'historique). Taux effectif à une date via `effectiveHourlyRate(emp, dateKey)`.
  - `settings/schedule` — paramètres horaire (admin) : `salesRatio`, `actualSales{dk}`, `openDays[]` + **`weekOrder{weekKey:[empId]}`** et **`weekHidden{weekKey:[empId]}`** (v3.38.0) : ordre d'affichage et employés masqués **par semaine** (`weekKey` = `dayKey` du lundi). N'affectent que la semaine concernée.
  - `tasks` — tâches (title, description, status, priority, assignee, dueDate)
  - `dailyTasks` — **tâches du jour** (v3.36.0) affichées sur l'accueil employé, cochables :
    - Champs : `id`, `title`, `type` (∈ `recurring`/`once` — comportement de reset), **`bucket`** (v3.49.0 — catégorie d'affichage ∈ `recurrent`/`idle` (temps mort), défaut `recurrent`), `time` (HH:MM, optionnel, heure unique legacy), **`times[]`** (v3.48.0 — heures multiples HH:MM ⇒ **plusieurs passages/jour** ; présent ⇒ système multi), `note`, `sortOrder`, `done` (ponctuelle), `doneDate` (YYYY-MM-DD, ponctuelle), `doneBy`, `lastCompletedDate` (YYYY-MM-DD, récurrente mono), `lastCompletedBy`, **`dayState`** (v3.48.0 — `{ date:"YYYY-MM-DD", done:{ idx:qui } }` pour la complétion par passage des tâches multi, remis à zéro chaque jour), `createdAt`, `updatedAt`
    - Accès : lecture tous authentifiés ; create/delete/édition contenu = admin ; non-admin peut seulement basculer les champs de complétion
  - `menu` — items du menu (name, description, price, category, available, recipe[])
  - `ingredients` — ingrédients pour food cost (name, costPerUnit, unit, category)
  - `recipes` — livre de cuisine (name, description, category, servings, prepTime, cookTime, ingredients, steps, tips — **markdown**)
  - `shoppingList` — **liste d'ingrédients** pour commandes/approvisionnement (séparée de `ingredients`) :
    - Champs : `id`, `name`, `supplier` (∈ `costco`/`viandex`/`gordon`), `category` (∈ `proteine`/`legume`/`laitier`/`epicerie`/`autre`), `notes`, `createdAt`, `updatedAt`
    - Accès : admin + chef
  - `events` — **événements / calendrier** (réservations, karaoké, spectacles, hors-site, fériés, internes) :
    - Champs : `id`, `name`, `date` (ISO YYYY-MM-DD), `time` (HH:MM, optionnel), `type` (∈ `reservation`/`karaoke`/`spectacle`/`hors_bochica`/`ferie`/`interne`), `status` (∈ `confirme`/`attente`/`annule`), `capacity`, `contactName`, `contactPhone`, `contactEmail`, `notes`, `createdAt`, `updatedAt`
    - Accès : admin + chef
  - `quotes` — **soumissions** (devis pour clients) — admin uniquement :
    - Champs communs : `id`, `quoteNumber` (YYYY-NNN), `clientName`, `clientCompany`, `clientPhone`, `clientEmail`, `eventDate`, `eventTime`, `eventVenue` (∈ `bochica`/`client`/`autre`), `eventAddress`, `guestCount` (commun à toutes les options), `validUntil`, `notes`, `status` (∈ `brouillon`/`envoyee`/`acceptee`/`refusee`/`expiree`), `createdAt`, `updatedAt`, `createdBy`
    - **`packageOptions[]`** (v3.14.0) — liste des options de forfait proposées au client. Chaque option : `{ id (local), packageId, packageSnapshot (copie figée), beerAddon, customLines[] ({description, amount}), depositAmount, depositPaid }`. Le client coche celle qu'il choisit sur le PDF.
    - **`roomRentals[]`** (v3.51.0) — options de **location de salle** choisissables par le client (combinables avec les forfaits, ou seules). Chaque option : `{ id, date (ISO), startTime (HH:MM), endTime (HH:MM), description, price }` où **`price` est avant taxes** (TPS+TVQ ajoutées au calcul/PDF). Lecture via `getQuoteRooms(qt)` (toujours un array) ; totaux via `computeRoomTotal` / `computeRoomRange`. Une soumission valide doit avoir **au moins un forfait OU une salle**.
    - **Champs legacy** (rétrocompat) : `packageId`, `packageSnapshot`, `beerAddon`, `customLines[]`, `depositAmount`, `depositPaid` — toujours écrits à plat à partir de la PREMIÈRE option pour que les anciens lecteurs continuent de fonctionner (valeurs neutres si la soumission n'a **que** des salles). La lecture passe par `getQuoteOptions(qt)` qui retourne TOUJOURS un array (nouveau format prioritaire, fallback sur le legacy).
  - `quoteTemplates` — **forfaits par défaut** (base des soumissions) — admin écriture, admin+chef lecture :
    - Champs : `id`, `name`, `label`, `pricePerPerson`, `accentColor` (∈ `yellow`/`red`/`blue`/`green`), `entree`, `plat`, `boisson`, `beerPrice`, `sortOrder`
    - Seed automatique au 1er lancement (Essentiel 22$ + Gourmand 27$) via `DEFAULT_QUOTE_TEMPLATES` dans `config.js`
  - `payrollSimulations` — **scénarios paie hypothétiques** (admin seulement) :
    - Champs : `id`, `name`, `description`, `baseWeekRef` (ex: `2026-W19`), `createdAt`, `updatedAt`, `createdBy`
    - `baseline` : SNAPSHOT FIGÉ au moment de la création (référence "réel" pour comparaison)
    - `simulation` : COPIE MODIFIABLE — l'utilisateur édite seulement celle-ci
    - Structure commune (`baseline` et `simulation`) : `{ employees[], serviceHours, tipShares, totalTips, openDays }`
    - `employees[]` = `[{ id, name, section, hourlyRate, isSalaried, fixedWeeklyHours, role, isFictional, shifts }]`
    - **shifts indexés par jour de semaine (0=Lun..6=Dim)** plutôt que par date — la sim est indépendante d'une semaine particulière
    - `isFictional: true` pour les employés ajoutés dans la simulation (futures embauches)
  - `payroll` — paie hebdomadaire (un doc par semaine ISO `YYYY-Www`) :
    - `weekId`, `weekStart`, `totalTips`, `serviceHours` `{dk: {start,end}}`, `actualShifts` `{empId: {dk: {start,end}}}`, `notes`, `createdAt`/`updatedAt`
    - `manualEmployees[]` (extras de la semaine), `empOrder[]` (ordre d'affichage par semaine), `sectionOverrides{empId}` (dérogation pool de pourboires), **`hiddenEmps[]`** (v3.38.0 — employés retirés de cette semaine de paie, réversible), `locked` (verrouillage)
    - Indépendant des shifts planifiés dans `employees[id].shifts` — permet de saisir l'horaire **réel** sans toucher au planning
  - `settings/payroll` — `tipShares: { cuisine, service }` (par défaut 0.25 / 0.75) + `defaultServiceHours` par jour de semaine
  - `settings/openClose` — **listes de référence ouverture/fermeture** (v3.36.0) : `opening[]` + `closing[]`, lecture authentifiée, écriture admin+chef. Chaque item = `{ id, text, section }` où **`section`** ∈ `cuisine`/`service` (v3.47.0 — affichage en grille 2×2 « qui fait quoi » ; items legacy sans section = `cuisine` par défaut)
  - `expenses` — dépenses (description, supplier, amount, tps, tvq, date, category, type, notes, isFixedAuto)
  - `revenues` — revenus (description, amount, tps, tvq, date, notes)
  - `expenseCategories` — catégories personnalisées de dépenses (name, type)
  - `fixedExpenseTemplates` — modèles frais fixes auto (supplier, category, amount, tps, tvq)
  - `logs` — historique des actions
  - `settings/sections` — catégories d'inventaire :
    - **Nouveau champ `all`** (array) : liste unifiée ordonnée (par défaut + personnalisées), modifiable entièrement
    - **Champ `custom`** (array) : préservé pour rétrocompatibilité avec anciens clients
    - Fallback : si `all` absent → `[...DEFAULT_SECTIONS, ...custom]`

## 🎨 Design System Bochica (aligné sur le site web — palette Crème Papier)

### Palette
- **Accent principal** : jaune impact `--accent: #F7B32C` (CTA, prix, actif)
- **Accent hover** : ambre `--accent-hover: #E09E1E`
- **Accent soft** : crème-jaune tint `--accent-soft: #fef2d4`
- **Accent warm** : jaune brûlé `--accent-warm: #8a6a1a` (petits eyebrows)
- **Accent text** : noir chaud `--accent-text: #0e0d0c` (contraste AA sur jaune)
- **Accent RGB** : `--accent-rgb: 247,179,44` (pour `rgba()` dans shadows/focus)
- **Fonds clair** : crème papier `--bg: #f5f1e8`, `--surface: #ffffff`, `--surface2: #ede3d2`, `--surface3: #e5d9c4`
- **Texte** : noir chaud `--text: #0e0d0c`, `--text2: rgba(14,13,12,.72)`, `--text3: rgba(14,13,12,.5)`
- **Tricolore Colombie** : jaune `#F7B32C`, bleu `#4a90e2`, rouge `#e74c3c`
- **États stock** : rouge `#d9534f`, jaune-ambré `#b45309` (distinct de l'accent vif), vert `#7dbf66`
- **Bordures** : `rgba(14,13,12,.1)` (subtile) / `rgba(14,13,12,.25)` (marquée)
- **Sidebar** : toujours sombre (`--header-from: #0a0907` → `--header-to: #14110f`) avec texte `--on-dark: #f5f1e8`

### Dark mode adapté on-brand
- Fonds : `#14110f`, `#1c1815` (chaleureux, pas gris bleuté)
- Accent : jaune `#F7B32C` (identique au clair — le jaune reste visible sur fond sombre)
- Accent hover dark : jaune clairci `#ffc94a`

### Typographie (aligné site web)
- **Display / titres** : `Bebas Neue` — h1-h6, stats numériques, prix, logo, topbar
- **Corps** : `Inter` (300-800) — UI, formulaires, body, boutons
- **Mono** : `JetBrains Mono` (400, 500, 600) — kickers techniques, tags, classe `.kicker`
- **`font-synthesis: none`** sur body — évite les faux bold/italic sur Bebas qui n'a qu'un poids
- **Tailles fixes des titres** (Bebas étant condensé, on majore ~25% pour équilibrer) :
  - `h1` : 48px · `h2` : 38px · `h3` : 28px · `h4` : 22px · `h5` : 18px · `h6` : 15px (uppercase + letter-spacing)
  - `.topbar-title` : 26px
  - `.recipe-view__title` : 42px
- **Échelle générale** (pour UI et body) : `--fs-xs` (11) → `--fs-sm` (13) → `--fs-base` (14) → `--fs-md` (16) → `--fs-lg` (18) → `--fs-xl` (22) → `--fs-2xl` (28) → `--fs-3xl` (36)

### Espacement
Échelle 4/8 : `--sp-1` (4) → `--sp-2` (8) → `--sp-3` (12) → `--sp-4` (16) → `--sp-5` (20) → `--sp-6` (24) → `--sp-7` (32) → `--sp-8` (48)

### Border-radius
`--radius-sm` (4) → `--radius-md` (8) → `--radius-lg` (12) → `--radius-xl` (16) → `--radius-pill` (20) → `--radius-full` (50%)

### Ombres et transitions
- `--shadow-sm/md/lg/modal`
- Ombres accent : `rgba(var(--accent-rgb), …)` — dynamiques (jaune en clair ET en dark)
- `--transition-fast/base`

## 📱 PWA (Progressive Web App)

### Installation
- **iOS Safari** : Bouton Partager → "Sur l'écran d'accueil"
- **Android Chrome** : Bandeau auto "Ajouter à l'écran d'accueil" ou menu ⋮ → "Installer"
- **Desktop Chrome/Edge** : Icône d'installation dans la barre d'adresse

### Configuration (`manifest.json`)
- `name` : "Bochica — Gestion"
- `short_name` : "Bochica"
- `display` : "standalone" (sans barre d'adresse)
- `theme_color` : `#F7B32C` (jaune impact)
- `background_color` : `#f5f1e8` (crème papier)
- **Shortcuts** : raccourcis vers Inventaire, Tâches, Dépenses

### Service Worker (`sw.js`)
- **Stratégie cache** : cache-first pour app shell (HTML, CSS, JS, fonts)
- **Stratégie réseau** : network-only pour Firebase (données toujours fraîches)
- **App shell** : inclut `icons.js` et `i18n.js` (ajoutés au cache)
- **Mise à jour** : incrémenter `CACHE_VERSION` dans sw.js après un déploiement majeur
- **Version actuelle** : `v1.4.0`

## ✅ Fonctionnalités

### 📦 Inventaire
- Stats desktop : total produits, à commander, bientôt bas, en stock (4 cartes en haut)
- Stock, statuts (rouge/jaune/vert), drag & drop pour réordonner, archivage, notes
- **Gestion avancée des catégories** (via engrenage ⚙️) :
  - Liste unifiée : toutes les catégories (par défaut + personnalisées) sont modifiables, supprimables, réordonnables
  - Le champ « Nouvelle catégorie » est **en haut** de la modale
  - **Drag & drop** (grip `⋮⋮`) pour réordonner
  - Renommer → **batch update Firestore** : tous les produits sont automatiquement mis à jour
  - Supprimer → les produits sont déplacés vers « Autre » (ou la première catégorie restante)
  - Compteur de produits par catégorie + badge « défaut »
- **Onglets catégories** : scroll horizontal avec fondu aux extrémités + bouton `⌄` « Voir toutes » (wrap multi-lignes)
- **Recherche fluide** : focus restauré après chaque frappe (plus de bug de saisie mot par mot)
- Vue tableau desktop, vue cartes mobile

### 📋 À commander / Tâches
- **Page À commander** : liste des produits en statut rouge/jaune avec sélecteur de tri (📁 Par section · 🏪 Par fournisseur). Mode fournisseur : groupes par nom alphabétique avec compteurs immédiats/bientôt et téléphone du fournisseur à côté du titre. Items orphelins regroupés sous « — Sans fournisseur — ». PDF imprimable suit le tri actif.
- **Kanban Tâches** : 3 colonnes (À faire / En cours / Complété) avec drag & drop.
- **Log d'actions** : la collection `/logs` continue d'enregistrer les actions (création/modif/suppression). Pas de page UI pour les consulter — l'admin peut accéder via la console Firebase si besoin.

### 👥 Employés & Horaires (refonte empgrid v3.24.1 + cartes Congé v3.25.0)
- **Vue grille employés × jours** : `.schedule-empgrid` avec employés en lignes (sticky, border-color section), 7 colonnes-jour au centre, colonne totaux à droite. Pas de tableau HTML — pure CSS Grid avec `display:contents` sur les rangées.
- Chaque cellule-jour contient soit une **card shift** (start → end + heures + coût), soit une **carte « Congé »** dashed (cliquable pour ajouter). Couleur de la barre latérale selon section (ambré cuisine / bleu service / gris autre).
- **Clic sur une card → modal d'édition** `openShiftModal` (employé fixe, selects 30 min, bouton supprimer). **Clic sur Congé → modal de création**.
- **Drag & drop** d'une card vers un autre jour pour le même employé → déplace le shift (confirmation si la cible a déjà un shift).
- **Header de colonne** : compteur `X pers · Yh` pour voir la couverture du jour en un coup d'œil.
- **Cellule totaux** (droite) : heures de la semaine + total à payer par employé.
- **Panneau totaux** sous la grille avec **mêmes grid-template-columns** pour alignement parfait : 5 lignes (Heures · Coût · Ventes prévues · Ventes réelles (inputs) · Écart vert/rouge).
- **Bouton « PNG pour équipe »** dans la toolbar (v3.25.0) : télécharge une image PNG de l'horaire pour partage (sans données financières). Utilise html2canvas via CDN.
- **Bouton « Copier → S+1 »** : duplique vers la semaine suivante. **Modal « Jours ouverts »** pour configurer les jours d'ouverture.
- Section employé (cuisine / service / autre) — utilisée pour le pool de pourboires et la couleur des cards.
- Taux horaire + option salarié (heures fixes hebdomadaires) configurés dans la fiche employé.
- Toujours présent : **coverage chart** (Chart.js, 7 lignes superposées par jour), **team cards** (fiches employés en bas).

### 💵 Salaires & Pourboires (refonte empgrid v3.27.0)
- **Même grille empgrid** que Horaires (employés × jours avec cards shift), adaptée à la paie.
- **Cellule employé éditable** : drag handle ⋮⋮ (réordonnement des employés) + nom + badge **EXTRA** pour les manuels + bouton trash + **select section override** (Auto / Cuisine / Service / Excluded — change la part de pourboire pour la semaine sans toucher à la fiche permanente) + taux horaire affiché.
- **Cards shift** : `start → end` + meta avec heures + pourboire du jour en vert (prorata).
- **Card « Congé »** pour jours sans pointage — affiche le **planifié** « 09:00 → 17:00 · Pas pointé » si l'horaire était prévu (fond bleuté), ou « Congé · + Saisir » sinon.
- **Card « En cours »** (v3.27.1) : pour les shifts partiels (entrée pointée mais pas sortie), card spéciale avec « 09:00 → en cours », tag « EN COURS » et point vert pulsant. Évite la confusion avec un congé.
- **Cellule totaux** (droite) multi-lignes Hrs (réel/planif) · Écart vert/rouge · Sal · Pourb vert · **Total**. Barre colorée 3 px en haut selon section pour délimitation claire (v3.27.2).
- **Modal d'édition** `openPayrollShiftModal` (selects 15 min, Supprimer/Enregistrer).
- **Drag & drop** des cards entre jours pour le même employé.
- **Bandeau d'alertes intelligentes** (v3.19.0) en haut : détection auto des sorties manquantes / shifts > 14h / planifiés sans pointage.
- **Bouton « Annuler mes saisies »** protégé par confirmation à taper « EFFACER » (v3.22.0).
- **2 boutons PDF** dans la toolbar : « PDF 1 sem » (semaine courante) et « PDF 2 sem » (paie aux 2 semaines).
- **Pourboires saisis par jour** dans une grille séparée — total semaine auto-calculé.
- **Répartition pourboires** : Cuisine 25% / Service+Admin 75% par défaut, modifiables. Calcul prorata des heures éligibles dans la fenêtre de service.
- **Heures de service** configurables globalement (settings/payroll.defaultServiceHours).
- **Verrouillage de semaine** : transforme le brut en dépense « Salaires sem. N » dans Dépenses & Revenus.

### 📈 Simulation paie (refonte empgrid v3.26.0)
- **Même grille empgrid** que Horaires/Salaires, adaptée à la sim (indexée par dow 0-6 et non par dk).
- **Cellule employé éditable** avec inputs inline (nom + taux + section + badge FICTIF si applicable) + bouton trash au hover.
- Cards shift compactes + cards Congé + drag & drop entre jours.
- **Modal** `openSimShiftModal(simId, empId, dow)` pour éditer.
- **Cellule totaux** multi-lignes Hrs · Sal · Pourb · Total + bouton supprimer.
- **4 KPI en haut** : Heures totales, Masse salariale, Pourboires distribués, Total à payer (avec écart $/%).
- **Paramètres globaux** : pourboires totaux + parts cuisine/service + ratio salaires/ventes + jours ouverts.
- **Code couleur sémantique** : coûts qui montent = rouge, baissent = vert ; pourboires/heures qui montent = vert.
- **Comparaison côte à côte** en bas : tableau Réel | Simulation | Écart $ avec % par employé + TOTAL.
- **Coverage chart** propre à la sim (par section, configurable).
- **Persistance** : Firestore `payrollSimulations`, plusieurs scénarios sauvegardés simultanément. Aucun impact sur les vrais employés/horaires/paie.

### ⏱️ Pointage (kiosque PIN — v3.17.0+)
- **Page kiosque** accessible aux 3 rôles (typiquement la tablette à l'entrée reste loggée en « Employe »).
- L'employé tape son **PIN à 4 chiffres** (configuré dans sa fiche), le système l'identifie.
- **2 boutons toujours visibles** ENTRÉE (vert) + SORTIE (bleu) côte à côte avec heure actuelle. Barre d'info au-dessus indique ce qui a déjà été pointé aujourd'hui.
- **Auto-retour au keypad** 1,8 s après confirmation du punch (fluide pour les changements d'employé pendant un rush).
- **Live clock** + date + **badge timezone visible** (« America/Toronto · jour système : 2026-05-29 ») pour valider d'un coup d'œil que le bon fuseau est utilisé.
- **Optim 12 pouces** : keypad 64×64 px, titres 26 px, tout tient dans 700 px de hauteur viewport.
- **Page d'accueil du rôle Employé = Pointage** (v3.17.2) — la tablette s'ouvre directement sur le clavier au login.
- **Données écrites dans `payroll/{weekId}.actualShifts`** → alimente automatiquement le tableau Salaires & Pourboires. L'admin peut toujours corriger une heure à postériori.
- **Règles Firestore** élargies pour permettre aux non-admins d'écrire **uniquement** sur `actualShifts` (verrouillage et autres champs restent admin only).

### 👁 Mode aperçu rôle (admin → chef/employé — v3.28.0)
- **Pill dans la sidebar** (visible uniquement pour le vrai admin) avec select « Admin (réel) / Chef / Employé ».
- Sélectionner Chef ou Employé bascule toute l'app en mode aperçu — sidebar filtrée, pages cachées, boutons admin invisibles.
- **Bandeau sticky jaune** en haut « Aperçu actif — tu vois l'app comme un Employé » avec bouton « Sortir de l'aperçu ».
- Implémentation : écrasement temporaire de `userRole`/`isAdmin` (sauvés dans `_realUserRole`/`_realIsAdmin`) — pas de refactor des 38 références existantes.
- **Sécurité préservée** : les règles Firestore vérifient toujours le vrai token Firebase Auth côté serveur.
- Reset automatique au logout.

### 💰 Dépenses & Revenus
- Calcul TPS/TVQ auto, catégories personnalisables
- **Frais fixes auto-rattrapés** : `autoApplyFixedExpenses()` génère les expenses à partir des `fixedExpenseTemplates` au login de l'admin. **Rattrape automatiquement les mois manqués** (max 12 mois rétro) — si l'admin ne se connecte pas pendant un mois, les frais fixes seront créés au prochain login. Garde-fou anti-doublons (vérifie si au moins une expense `isFixedAuto` existe pour chaque mois).
- Stats : revenus, dépenses, taxes, profit/déficit
- Graphiques : barres 6 mois (revenus/dépenses/profit) + doughnut par catégorie

### 📈 Rapports mensuels (admin only, sous Finances)
- Page d'agrégation et de visualisation des rapports POS Cluster (PDFs mensuels parsés en JSON).
- **Collection Firestore** `monthlyReports` (id = `YYYY-MM`), admin only, peuplée via bouton « Importer seed » depuis `monthly-reports-seed.js` (16 mois inclus actuellement).
- **Données par mois** : sommaire global (reçus, clients, ventes, TPS/TVQ, total), 7 canaux de vente (tables/comptoir/emporter/livraison/etc.), modes de paiement avec pourboires, top catégories, top 50 articles, heures travaillées, corrections par raison, rabais par type.
- **Sélecteur de période** : 3 / 6 / 12 mois / Tout / **Personnalisé** (deux date pickers `type="month"` avec min/max bornés).
- **Comparatif vs année précédente (YoY)** : toggle pill jaune (actif par défaut). Barres côte à côte vert pâle (A-1) + vert plein (année courante) avec labels dynamiques. Tableau récap avec 2 colonnes ambrées `Total A-1` et `Δ YoY`. KPI agrégés avec **delta % + valeurs absolues comparées** (« 137 366 $ vs 112 250 $ A-1 »).
- **6 KPI agrégés** en haut : ventes totales, reçus, clients, reçu moyen, pourboires, heures.
- **5 visualisations** : combo barres+lignes ventes/pourboires, barres empilées par canal, barres groupées modes de paiement, doughnut top catégories, tableau top 15 produits + tableau récap mois par mois.
- **Stratégie de parsing** : `parse_reports.py` préfère `Rapportdevente*.pdf` (vrais totaux resto) sur `Rapportutilisateur*.pdf` (ventes d'un seul user) si les deux existent pour la même période.

### 🍽️ Menu / 🏪 Fournisseurs
- Items par catégorie avec toggle disponible
- Fiches fournisseurs avec produits liés

### 🧂 Ingrédients (food cost)
- Séparés des produits d'inventaire
- Coût par unité utilisé pour calculer le food cost des items du menu

### 🧾 Soumissions (devis avec génération PDF)
- Page **Soumissions** (admin seulement) sous Événements
- **CRUD complet** : créer, modifier, dupliquer, supprimer une soumission
- **Numérotation auto** : format `YYYY-NNN` (ex. `2026-001`) calculé à partir des soumissions existantes
- **Champs client** : nom, entreprise, téléphone, courriel
- **Champs événement** : date, heure, lieu (Bochica / chez le client / autre), adresse, nombre de personnes
- **Multi-options de forfait (v3.14.0)** : on peut proposer **plusieurs options** dans une même soumission. Le client choisit celle qui lui convient. Bouton « + Ajouter une option de forfait », chaque option a un badge OPTION A/B/C... et un bouton de retrait. Le nombre de personnes est commun à toutes les options (cas le plus courant : « 25 pers, vous préférez le forfait à 22$ ou à 27$ ? »).
- **Choix de forfait par option** : cartes radio interactives (couleur d'accent visible) → sélection d'un des forfaits configurés
- **Add-on bière (par option)** : toggle qui remplace la boisson par une bière. Prix surchargeable par option (rabais éventuel).
- **Lignes personnalisées (par option)** : ajout dynamique de suppléments (ex. « Décor 100$ ») ou rabais (montants négatifs). Chaque option a son propre set de lignes.
- **Dépôt (par option)** : montant exigé + case « déjà versé », solde calculé automatiquement par option
- **Date de validité** : par défaut +30 jours, affichée sur le PDF
- **5 statuts** : Brouillon · Envoyée · Acceptée · Refusée · Expirée — changement rapide via dropdown ⋯
- **Snapshot du forfait par option** : copie figée des données du forfait au moment de la création (les PDF anciens restent corrects même si on modifie un template par la suite)
- **Liste des soumissions** : badge « N options de forfait » au lieu du nom unique quand multi. Total affiché en fourchette « 595 $ – 750 $ » si plusieurs options.
- **Génération PDF (jsPDF)** : design fidèle à `Menu_Forfaits.pdf` :
  - Logo BOCHICA + sous-titre « Restaurant Colombien » + tricolore jaune/bleu/rouge
  - Titre « Soumission » + numéro centré
  - Bloc Client + Bloc Événement (2 colonnes, fond crème)
  - **Bandeau d'intro multi-options (v3.14.0)** si N > 1 : « N options proposées — choisissez celle qui vous convient »
  - **Une section par option** : badge OPTION A/B/C + carte forfait avec barre latérale colorée (selon `accentColor`), prix en rouge, séparateur pointillé, bullets bleus pour Entrée / Plat / Boisson, bière en jaune si activée, suppléments, totaux par option (sous-total → TPS → TVQ → TOTAL OPTION A), dépôt si présent
  - **Case à cocher « Je choisis l'OPTION X — Nom »** sous chaque option en mode multi
  - **Multi-pages auto (v3.14.0)** : si une option ne tient pas sur la page courante, passe automatiquement à une nouvelle page avec en-tête compact (BOCHICA · n° soumission · client) + ligne accent. Numérotation « Page N / Total » en bas si > 1 page.
  - Notes + footer « Soumission valide jusqu'au … » + bloc QR code menu
  - Nom de fichier : `Bochica_Soumission_{numéro}_{client}.pdf`
- **Forfaits éditables** : modale « Gérer les forfaits » accessible via toolbar
  - Modifier nom, étiquette, prix/personne, couleur d'accent (jaune/rouge/bleu/vert), contenu (entrée/plat/boisson), prix bière
  - Ajouter de nouveaux forfaits (illimité)
  - Supprimer un forfait (avertissement si des soumissions l'utilisent)
- **Seed automatique** : au premier lancement, 2 forfaits par défaut sont créés (L'Essentiel 22$ avec accent jaune, Le Gourmand 27$ avec accent rouge) — calqués sur le PDF original

### 📅 Événements (calendrier)
- Page **Événements** sous Liste d'ingrédients
- **3 vues** : Calendrier mensuel (grille 7×6), Ce mois-ci (liste), À venir (30 jours)
- **6 types** (couleurs distinctes + icônes dédiées) : Réservation privée (bleu, `users`), Soirée karaoké (violet, `mic`), Soirée spectacle (orange, `music`), Événement hors Bochica (slate, `map-pin`), Journée fériée (rouge, `flag`), Événement interne (vert, `briefcase`)
- **3 statuts** : Confirmé, En attente, Annulé (annulé = barré dans le calendrier)
- Champs par événement : nom, date, heure optionnelle, type, statut, nombre de personnes (capacité), contact (nom + tél + courriel), notes
- **Calendrier mensuel** : navigation mois précédent/suivant, bouton « Aujourd'hui » pour revenir, highlight du jour courant (badge jaune), clic sur une case vide pour créer un événement à cette date, clic sur une pill pour l'éditer, max 3 événements visibles par case + indicateur « +N autres », légende couleurs en bas
- **Filtre par type** (tous / réservation / spéciale / férié / interne) avec compteurs
- **Recherche texte** (nom, contact, notes) avec focus préservé
- **Affichage relatif** : « Aujourd'hui », « Demain », « Dans 3 jours », « Il y a 2 jours »
- **Widget dashboard** : « Prochains événements » (5 max, dans les 60 jours, hors annulés)
- Duplication via dropdown ⋯
- Accès : admin + chef

### 🛒 Liste d'ingrédients (commandes / approvisionnement)
- Section **distincte** des Ingrédients (food cost) — orientée liste de courses
- Champs par item : nom, fournisseur, catégorie, notes
- **3 fournisseurs fixes** : Costco (bleu), Viandex (rouge), Gordon (vert)
- **5 catégories** : Protéine, Légume, Produit laitier, Épicerie, Autre
- **Onglets de filtrage** par fournisseur (avec compteurs)
- **Recherche texte** (nom + notes) avec focus préservé entre les frappes
- **Tri** : par fournisseur (groupé en sections colorées) ou par nom (A→Z)
- Couleurs vives par fournisseur — sections desktop séparées par bandeau coloré
- Vue mobile : cartes avec bord coloré gauche selon fournisseur
- Duplication via dropdown ⋯
- Accès : admin + chef

### 📖 Recettes (livre de cuisine)
- Recettes complètes avec ingrédients, étapes, conseils
- **Éditeur markdown** intégré avec toolbar (gras, italique, barré, listes à puces, numérotées)
- Raccourcis clavier : **Ctrl/⌘+B** (gras), **Ctrl/⌘+I** (italique)
- Parser markdown sécurisé (pas d'XSS — échappement HTML puis injection de tags contrôlés)
- Rétrocompat auto : les vieilles recettes en texte brut s'affichent comme listes
- Impression : header jaune avec texte noir (contraste AA)

### 🔁 Duplication universelle
- Option **Dupliquer** dans tous les dropdowns ⋯ : produits, recettes, menu, fournisseurs, ingrédients, employés, dépenses, revenus, tâches
- Ajoute « (Copie) » au nom, génère un nouvel ID, réinitialise `createdAt`/`updatedAt`
- Ajustements par collection : `products` → sortOrder à la fin, stock 0, désarchivé · `menu` → disponible par défaut
- Logue l'action dans l'historique

### 🌙 Général
- **Logo BOCHICA cliquable** (sidebar) → ramène au dashboard (admin) ou inventaire (employé). 36px, sans les barres tricolore
- **Dropdowns ⋯** : ferment au clic extérieur + Escape (avant, ils restaient ouverts)
- Dark mode (toggle, localStorage)
- Mobile responsive
- Session persistante
- PWA installable
- Recherche globale Cmd/Ctrl+K
- Bilingue FR/ES (toggle sidebar)

## 📝 Markdown dans les recettes

### Syntaxe supportée
- `**gras**` → **gras**
- `*italique*` → *italique*
- `~~barré~~` → ~~barré~~
- `- puce` (ou `* `, `• `) au début de ligne → liste à puces
- `1. étape` au début de ligne → liste numérotée (le numéro réel est automatique)
- Ligne vide → nouveau paragraphe

### Fonctions clés (dans `utils.js`)
- `renderMarkdown(text)` — parser sécurisé : échappe le HTML puis injecte nos tags contrôlés
- `autoMarkdownList(text, type)` — rétrocompat : préfixe les lignes d'un texte legacy sans markers
- `mdToolbar(textareaId)` — génère la toolbar HTML
- `mdWrap(id, before, after)` — enveloppe la sélection (gras, italique, barré)
- `mdPrefixLines(id, prefix)` — préfixe les lignes (toggle — supprime si déjà présent)
- `mdAttachShortcuts(textareaId)` — attache Ctrl/Cmd+B et +I

## ♿ Accessibilité

- **`<html lang="fr-CA">`** au lieu de `fr` (cohérence régionale)
- **Landmarks ARIA** : `<aside>` sidebar, `<main>`, `<header>` topbar, `<nav>` sidebar-nav
- **PIN-pad accessible** : `aria-label` sur chaque bouton, `role="alert"` sur l'erreur, `aria-live` sur affichage chiffres saisis
- **Navigation clavier** : Tab partout + chiffres/Backspace/Escape sur PIN
- **Focus visible** : outline 2px jaune (`var(--accent)`) global via `:focus-visible`
- **Dropdowns** : Escape pour fermer, clic extérieur pour fermer
- **Logo sidebar** : `aria-label="Retour au tableau de bord"` + focus visible
- **Modale catégories** : drag avec `aria-label="Glisser pour réordonner"` sur le handle
- **Toolbar markdown** : `role="toolbar"` + `aria-label` sur chaque bouton
- **`prefers-reduced-motion`** respecté
- **Contraste AA** : accent jaune avec texte noir (pas texte blanc sur jaune)
- **Topbar** : `aria-live="polite"` sur badge alerte

## 🔧 Constantes importantes (config.js)
- `ADMIN_PIN` = "0000"
- `EMPLOYEE_PIN` = "1111"
- `TPS_RATE` = 0.05
- `TVQ_RATE` = 0.09975
- `DEFAULT_SECTIONS` = ["Cuisine", "Emballage", "Bar", "Autre"] (servent de fallback + de référence pour le badge « défaut »)
- `SHIFT_TYPES` = Matin (#3b82f6), Soir (#8b5cf6), Journée (#22c55e), Congé (#94a3b8)
- `TASK_COLS` = ["À faire", "En cours", "Complété"]
- `MENU_CATS` = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"]
- `EXPENSE_CATS` = tableau objets `{ name, type }` fixe/variable

## 🚧 Contraintes importantes
- Aucune installation locale — tout via GitHub.com + Vercel
- **Vanilla JS uniquement** — pas de React, pas de build
- **CSS externalisé** dans `css/style.css` (utiliser les tokens, ne pas hardcoder les couleurs)
- Pour les couleurs dans les `style="..."` inline JS : utiliser `var(--token)` plutôt que `#hex`
- Chaque fichier JS = une section de l'app
- L'ordre des scripts dans index.html est critique (icons.js et i18n.js avant utils.js)
- **Bumper `CACHE_VERSION`** dans `sw.js` après un déploiement pour forcer la mise à jour chez les utilisateurs PWA
- Pour déboguer : F12 → Console → messages en rouge

## 📝 CHANGELOG

### 22 juin 2026 — Fix : congés respectés à la copie de semaine + PNG + totaux (v3.52.1) 🏖️🐞

**Bug** — En copiant l'horaire d'une semaine sur une autre, si un employé était en congé sur la semaine cible, le quart de la semaine source était quand même écrit dans `emp.shifts` sur le jour de congé (quart « fantôme »). Conséquences :
- l'export **PNG** (équipe et admin) affichait les heures copiées au lieu de « Congé » (un employé en congé toute la semaine pouvait même réapparaître dans l'image) ;
- les **totaux** d'heures et de coût à l'écran comptaient ces heures fantômes alors que la cellule affichait « Congé ».

La grille à l'écran affichait correctement « Congé » car le rendu de cellule vérifie `getTimeOff` en premier — mais les chemins de lecture des shifts (copie, totaux, PNG) ne le faisaient pas, d'où l'incohérence.

**Correctifs** (`pages-hr.js`)
- `duplicateScheduleToNextWeek` : un jour de congé sur la semaine **cible** est verrouillé — aucun quart n'y est copié, et tout résidu y est effacé.
- `renderHoraires` (empRows) : un jour de congé compte 0 h et 0 $ dans les totaux (cohérent avec l'affichage « Congé »).
- `exportScheduleAsPNG` + `exportScheduleAsPNGAdmin` : helper `shiftOnDay()` qui renvoie `null` sur un jour de congé → filtre des employés et rendu des cellules basés dessus. Affiche « Congé » et exclut les heures fantômes.

Robuste aux données déjà corrompues : même un quart fantôme déjà présent dans `emp.shifts` est désormais ignoré partout. Validé par test : totaux 13 h / 260 $ au lieu de 21 h / 420 $ sur un cas avec congé. `CACHE_VERSION` → `v3.52.1`.

### 29 mai 2026 — Mode aperçu rôle pour l'admin (v3.28.0) 👁️🎭

Permet à l'admin de prévisualiser l'app comme si elle/il était chef ou employee, sans changer de compte. Utile pour valider rapidement ce que voit chaque rôle après une modification de permissions ou de page.

**Mécanisme**
- Plutôt que refactorer les **38 occurrences** de `userRole === "X"` / `isAdmin` dispersées dans 12 fichiers (canAccess, render functions, etc.), on **écrase temporairement** `userRole` et `isAdmin` avec le rôle prévisualisé. Le vrai rôle est sauvé dans `_realUserRole` / `_realIsAdmin`. Le flag `_previewActive` indique l'état.
- Toutes les vérifications existantes continuent de fonctionner sans modification — elles lisent le `userRole` modifié.
- **Sécurité préservée** : les règles Firestore continuent à vérifier le **vrai token Firebase Auth** côté serveur. L'admin en aperçu employé ne peut pas faire de modifs interdites — l'UI cache juste les boutons admin pour cohérence visuelle.

**API JS**
- `enterPreviewMode(role)` — `role` ∈ `["chef", "employee"]`. Sauve `userRole`/`isAdmin`, les écrase, navigue vers la home du rôle prévisualisé.
- `exitPreviewMode()` — restaure les vraies valeurs.
- `onPreviewRoleChange(value)` — handler du select dans la sidebar : `""` → exit, sinon enter.

**UI**
- **Pill dans la sidebar** (au-dessus de dark/lang/logout) avec label « Aperçu : » + select à 3 options. Visible uniquement pour le vrai admin (le check utilise `_realUserRole` ou `userRole` selon l'état).
- **Bandeau sticky** en haut (au-dessus de la topbar) avec icône 👁, message « Aperçu actif — tu vois l'app comme un **Employé** », bouton jaune « Sortir de l'aperçu ». Animation slideIn 0.25s.
- Le pill se colore (border + box-shadow accent) quand l'aperçu est actif pour signaler l'état dans la sidebar.

**Reset au logout**
- `auth.js` (onAuthStateChanged) : reset `_realUserRole = null`, `_realIsAdmin = false`, `_previewActive = false` avant de clear `userRole`. Évite que l'état traîne entre deux sessions.

**Implémentation**
- **JS** : `state.js` (+3 variables), `utils.js` (+3 fonctions ~50 lignes), `sidebar.js` (visibility du pill + bandeau), `auth.js` (reset au logout).
- **HTML** (`index.html`) : `<div id="preview-role-pill">` dans la sidebar, `<div id="preview-banner">` avant la topbar.
- **CSS (~75 lignes)** : `.preview-role-pill` (avec état `.is-active`), `.preview-banner` (sticky, gradient ambré, animation), dark mode adapté.

**CACHE_VERSION** → `v3.28.0`

### 29 mai 2026 — Délimitation visuelle des employés dans totaux (v3.27.2) 🎨📐

Retour utilisateur après v3.27.1 : « les cartes dans totaux, celle à la fin de chaque employé, vue que toutes les cartes sont blanches, on ne sait pas exactement où ça finit ».

**Solution**
- **Barre colorée de 3 px** ajoutée en haut de chaque cellule `.payroll-empgrid-total` selon la section de l'employé :
  - `is-kitchen` → ambré (#BA7517)
  - `is-service` → bleu (#378ADD)
  - `is-excluded` → rouge (#A32D2D)
  - `is-other` → gris (#888780)
- La cellule employé à gauche avait déjà un border-left de la même couleur — maintenant les deux extrémités de chaque ligne sont délimitées par la couleur de la section. Tu vois immédiatement « cette ligne va de la barre ambrée à gauche à la barre ambrée à droite ».
- Même traitement appliqué à `.sim-empgrid-total` pour la cohérence avec la page Simulation.

**Renforcement du séparateur horizontal**
- Background du grid parent (qui apparaît dans le gap entre lignes) passé de `rgba(14,13,12, 0.10)` (var(--border)) à `rgba(14,13,12, 0.18)` pour mieux délimiter les lignes globalement.
- Dark mode : `rgba(245,241,232, 0.18)` au lieu de 0.10.

**Implémentation**
- JS : ajout de `groupClass` (`is-kitchen`/`is-service`/`is-excluded`) sur la cellule `.payroll-empgrid-total` (déjà présent sur `.payroll-empgrid-emp`).
- CSS (~25 lignes) : border-top 3px avec couleur dynamique selon `.is-*`, override background du grid parent pour gap plus visible, suppression du border-top sur le header pour éviter l'effet double bordure.

**CACHE_VERSION** → `v3.27.2`

### 29 mai 2026 — Fix : employés en cours invisibles dans Salaires (v3.27.1) 🐞🟢

Bug rapporté par l'utilisateur : « il y a du monde qui ont fait le pointage ce matin pourquoi je ne les vois pas? ».

**Cause** : la refonte v3.27.0 utilisait `filled = startVal && endVal` pour décider quel type de card afficher. Pour les employés ayant pointé leur **entrée mais pas leur sortie** (= en cours de service), `endVal` était vide donc `filled = false` → fallait dans le bloc « Congé ». Les employés en cours apparaissaient comme « Congé · + Saisir », totalement invisibles dans la vue Salaires.

**Fix v3.27.1**
- Nouveau cas intermédiaire `partial = (startVal && !endVal) || (!startVal && endVal)` détecté avant la branche « Congé »
- Affiche une carte **`.shift-card--partial`** distincte :
  - Fond bleu plus marqué + bordure solid bleue
  - Texte : « 09:00 → en cours » (ou « ? → 17:30 » dans le cas inverse rare)
  - Tag « EN COURS » mono dans la meta
  - **Point vert pulsant** en haut-droite (animation 1.6s, respecte `prefers-reduced-motion`)
- Cliquer la card ouvre `openPayrollShiftModal` pré-rempli pour saisir la sortie

**Impact** : les employés au travail sont maintenant visibles avec un signal clair (point pulsant + tag), évitant la confusion avec ceux qui n'ont pas pointé du tout.

**CACHE_VERSION** → `v3.27.1`

### 29 mai 2026 — Salaires & Pourboires : refonte en empgrid (v3.27.0) 💰📅

Demande utilisateur : « J'aimerais aussi avoir un visuel semblable pour la section salaire et pourboires, je le trouve plus beau comme ça ». Le style « ledger pro » (v3.23.0) est remplacé par la même grille empgrid que Horaires (v3.24.1) et Simulation (v3.26.0).

**Structure**
- **Grille principale** : `200px (employé) + N × minmax(110px, 1fr) (jours) + 140px (totaux)` avec `gap:1px` qui dessine les séparations grises
- **Header** : « Employé · Section » + labels jours avec compteur `X pers · service HH–HH` + « Totaux »
- **Cellule employé éditable** :
  - Drag handle ⋮⋮ (réordonnement des employés) + nom + badge **EXTRA** + bouton trash (extras non-locked)
  - Select **section override** (Auto / Cuisine / Service / Excluded) avec couleur sémantique
  - Taux horaire à droite (« 22,00 $/h » ou « 22,00 $/h · FIXE »)
- **Cellules-jour** :
  - **Card shift** si pointé : start → end + meta (heures + pourboire vert si applicable)
  - **Card « Congé »** sinon — affiche le planifié (« 09:00 → 17:00 ») + « Pas pointé » si l'horaire était prévu, sinon « Congé · + Saisir »
  - Barre ambrée 3px à gauche si shift modifié (`is-modified`)
  - Fond bleuté très léger si l'employé était prévu mais n'a pas pointé (`is-scheduled-empty`)
- **Cellule totaux** (140px) multi-lignes :
  - Hrs : 15.5h<small>/15h</small>
  - Écart : +0.5h (vert) / -2h (rouge) / =
  - Sal : 387,50 $
  - Pourb : 80,35 $ (vert)
  - **Total : 467,85 $** (bold)

**Modal d'édition** : `openPayrollShiftModal(empId, dk)` avec employé + date longue + rappel du planifié, 2 selects 15 min, boutons Supprimer + Enregistrer. Désactivée si semaine verrouillée.

**Drag & drop des cards** : handlers `payrollShiftDragStart/Over/Leave/End/Drop` (séparés des `payrollRowDrag*` qui gèrent le réordonnement vertical des employés). Permet de déplacer un shift d'un jour à l'autre pour le **même employé**. Confirmation si la cible a déjà un shift.

**Panneau totaux dessous** : ligne résumée (« N employés · Xh pointées / Yh planifiées · Écart +1.5h · Salaires 3 250 $ · Pourboires 280 $ ») + grande cellule Total à droite. Mêmes grid-template-columns que la grille principale pour alignement parfait.

**Implémentation**
- **JS** (`pages-payroll.js`) : `renderSalaires` — section « tableau heures réelles » remplacée (~150 lignes → ~140 lignes). Ajout de `openPayrollShiftModal`, `savePayrollShiftFromModal`, `deletePayrollShift`, et 5 handlers drag & drop (~120 lignes total).
- **CSS (~140 lignes)** : `.schedule-empgrid.payroll-empgrid` override grid-template-columns, `.payroll-empgrid-emp` (avec drag handle + section select), `.payroll-empgrid-total` (multi-lignes Hrs/Écart/Sal/Pourb/Total), `.shift-card-tip` (vert), états `is-modified` (barre ambrée) + `is-scheduled-empty` (fond bleuté), `is-no-hours` (opacity 0.65).

**CACHE_VERSION** → `v3.27.0`

### 29 mai 2026 — Simulation paie : refonte en empgrid (v3.26.0) 🧮📅

Demande utilisateur : « rappelles toi de ramener cet tableau pour la section simulation de paie ». Application du même style empgrid (employés × jours avec cartes shift) que la page Employés & Horaires.

**Avant** : `schedule-table sim-table` (HTML `<table>`) avec dropdowns `<select class="schedule-time">` pour entrée/sortie de chaque jour, alternance jaune/bleu vive sur les lignes.

**Après** : `.schedule-empgrid.sim-empgrid` (CSS Grid) :
- **Cellule employé** (220px) : champs éditables conservés (nom + taux + section), badge FICTIF si applicable. Fond ambré léger pour les employés fictionnels.
- **Cellules-jour** (N × minmax(110px, 1fr)) : shift card compact avec horaires + heures + coût, ou carte « Congé » dashed pour les jours libres. Drag & drop entre jours pour déplacer un shift (du même employé).
- **Cellule totaux** (130px) : multi-lignes Hrs / Sal / Pourb (vert) / Total (bold) avec bouton supprimer rouge qui apparaît au hover.

**Modal d'édition** : `openSimShiftModal(simId, empId, dow)` avec employé + jour fixes, 2 selects heures (30 min), boutons Supprimer + Enregistrer. Save appelle `updateSimShift` deux fois (start + end).

**Drag & drop sim-spécifique** : handlers `simShiftCardDragStart/Over/Leave/End/Drop` avec dow (0-6) au lieu de dk (date). Force `targetEmpId === sourceEmpId` (déplacement uniquement du même employé vers un autre jour). Confirmation si la cible a déjà un shift.

**Panneau totaux** : `.schedule-totals-panel.sim-totals-panel` avec **mêmes grid-template-columns** que la grille du haut (220 + N + 130) pour alignement parfait. 3 lignes : Heures / Coût / Ventes prévues. Pas de Ventes réelles ni Écart (la sim est théorique).

**Implémentation**
- **JS** (`pages-simulations.js`) : `renderSimulationEditorHTML` — section table remplacée (~50 lignes → ~70 lignes plus claires). `renderSimEmpRow` refactoré complètement (de `<tr>` à `<div class="schedule-empgrid-row">`). Ajout de `openSimShiftModal`, `saveSimShiftFromModal`, `deleteSimShift`, et 4 handlers drag & drop (~130 lignes total à la fin du fichier).
- **CSS (~150 lignes)** : `.schedule-empgrid.sim-empgrid` override grid-template-columns (220px + N + 130px), `.sim-empgrid-emp` (inputs éditables avec hover/focus), `.sim-empgrid-total` (multi-lignes), `.sim-empgrid-remove` (visible au hover row), `.is-fictional` (gradient ambré). Mobile breakpoint 900px.

**CACHE_VERSION** → `v3.26.0`

### 29 mai 2026 — Horaires : carte « Congé » + export PNG public (v3.25.0) 🏖️📸

Deux ajouts demandés en parallèle pour la page Employés & Horaires.

**1. Carte « Congé » dans les cellules vides**
- Avant : cellules vides montraient juste un bouton + circulaire au centre (visuellement vides).
- Après : mini-carte `.shift-card--off` avec label « CONGÉ » en uppercase + sous-label « + Ajouter » discret. Style **dashed** (border + barre latérale gauche) pour signaler l'état non-travaillé.
- Toute la carte est cliquable → ouvre le modal d'ajout de shift pour cet employé/jour.
- Au hover : dashed → solid, accent jaune. Sous-label « + Ajouter » s'affiche en pleine opacité.
- Garde la fonctionnalité drop target (recevoir un shift glissé depuis une autre cellule).

**2. Export PNG « pour équipe »**
- Nouveau bouton **« PNG pour équipe »** dans la toolbar (entre « Copier → S+1 » et le pill ratio).
- Génère une image PNG (résolution 2× pour rendu Retina) de l'horaire de la semaine courante, à partager via SMS / affichage cuisine.
- **Sans aucune donnée financière** : taux horaires, coûts par jour, totaux $, ratio, ventes prévues/réelles, écart — tout est retiré du rendu d'export.
- Contenu : en-tête BOCHICA + tricolore + titre « Horaire — Semaine N · dates », puis grille employés × jours avec **uniquement** : nom employé, section (Cuisine/Service/Autre), heures entrée → sortie ou label « Congé » pour les jours non-travaillés. Footer avec date de génération.
- Style minimaliste hardcodé inline (indépendant du theme CSS principal) pour un rendu stable et prévisible. Couleurs Bochica conservées (ambré cuisine, bleu service, crème fond).

**Implémentation**
- **`exportScheduleAsPNG()`** (~110 lignes dans `pages-hr.js`) : construit un container hors-écran avec le DOM clean, attend 100 ms pour les polices, capture avec html2canvas (scale 2, backgroundColor crème, logging off), convertit en data URL, télécharge via lien temporaire. Toast de feedback + nettoyage du DOM en finally.
- **html2canvas chargé via CDN** (`cdn.jsdelivr.net/npm/html2canvas@1.4.1`) dans `index.html` avec defer. ~50 ko. Vérification `typeof window.html2canvas === "function"` avant usage.
- **CSS (~45 lignes)** : `.shift-card--off` (dashed border, flex column, hover state), `.shift-off-label` (uppercase 11px), `.shift-off-add` (9px, opacity 0.7 → 1).

**CACHE_VERSION** → `v3.25.0`

### 29 mai 2026 — Horaires : alignement panneau totaux ↔ grille (v3.24.2) 📐

Bug visuel signalé par l'utilisateur après la v3.24.1 : « le tableau en haut n'est pas bien aligné avec celui en bas ». Capture d'écran montrant que la grille empgrid (avec employés à gauche + jours + totaux) ne s'alignait pas verticalement avec le panneau totaux en dessous.

**Cause**
- Empgrid utilisait `grid-template-columns: 160px repeat(N, minmax(110px, 1fr)) 96px`
- Totals utilisait `grid-template-columns: 130px repeat(N, 1fr) 90px`
- Le `.card` parent du totals ajoutait padding `var(--sp-3) var(--sp-4)` qui décalait encore
- Mobile media query avait aussi des largeurs différentes

**Fix**
- **`.schedule-totals-panel`** : `padding:0 !important`, mêmes `background:var(--border)`, `border:0.5px solid var(--border)`, `border-radius:var(--radius-md)` que `.schedule-empgrid` (override `.card` aggressif)
- **`.schedule-totals-grid`** : `grid-template-columns:160px repeat(var(--n-days, 5), minmax(110px, 1fr)) 96px` (match strict)
- **`.schedule-totals-label/.schedule-totals-val`** : `background:var(--surface2)/var(--surface)`, `padding:8px 10px` (match avec empgrid)
- **`gap:1px`** au lieu de `gap:4px 8px` pour utiliser le même mécanisme de séparation par background du parent
- **Ligne `day-row` retirée** : redondante, les labels jours sont déjà dans le header de l'empgrid au-dessus

**CACHE_VERSION** → `v3.24.2`

### 29 mai 2026 — Horaires : grille employés × jours (hybride tableau + cartes) (v3.24.1) 📊🗓️

Suite à un retour utilisateur après la v3.24.0 (« je veux garder cet design, mais plus style tableau avec la liste de tous les employés dans une colonne à gauche »), retour à un format tableau classique mais en gardant le nouveau **style de cartes shift** au lieu des dropdowns inline.

**Structure**
- **CSS Grid** : `160px (employé) + N × minmax(110px, 1fr) (jours) + 96px (totaux)`, avec `gap:1px` qui crée les lignes de séparation grises subtiles
- **Header** (1 ligne) : « Employé » à gauche · labels jours au centre avec compteurs `X pers · Yh` · « Total » à droite
- **Body** (N lignes) : pour chaque employé, une ligne complète
  - **Cellule employé** (gauche) : nom (bold 13px) + section (uppercase 10px) + taux horaire. Barre latérale 3px colorée selon section.
  - **Cellules jour** : soit une `shift-card--compact` (avec horaires + heures + coût), soit un bouton `+ Add` mini circulaire (24×24, dashed, opacité 0.5 par défaut, plein opacité au hover)
  - **Cellule totaux** (droite) : heures de la semaine + total à payer

**Card compact (nouveau)**
- Plus petite que la card de la v3.24.0 (qui était dans une colonne large)
- Pas d'avatar ni de nom (déjà sur la ligne employé)
- Juste : `09:00 → 16:00` en bold + meta `5h · 125 $` en bas
- Fond légèrement teinté selon section (ambré 6% / bleu 5%)

**Interaction conservée**
- Clic sur card → modal édition (`openShiftModal`)
- Clic sur `+ Add` → modal création avec employé pré-sélectionné
- Drag d'une card vers une autre cellule (même employé, jour différent) → déplace le shift
- Confirmation si la cible a déjà un shift

**Implémentation**
- **JS** : `renderEmployes()` — bloc « grille calendrier » remplacé par le nouveau bloc « grille empgrid ». L'itération principale passe de « par jour, listant les shifts » à « par employé, listant ses jours » (ce qui était la structure d'origine).
- **CSS (~140 lignes)** : `.schedule-empgrid` (grid layout), `.schedule-empgrid-emp` (cellule gauche sticky avec border-left section), `.schedule-empgrid-cell` (cellule jour avec drop handlers), `.schedule-empgrid-cell--empty` (avec `.shift-add-mini` 24×24), `.shift-card--compact` (variante plus petite de la card pour cellule de grille), `.schedule-empgrid-total` (cellule droite). `display:contents` sur `.schedule-empgrid-row` pour que les enfants s'insèrent directement dans la grille parente.

**CACHE_VERSION** → `v3.24.1`

### 29 mai 2026 — Horaires : refonte en vue calendrier hebdomadaire (v3.24.0) 📅🗓️

Suite à un retour utilisateur (« je le trouve laid et trop chargé aussi »), 3 maquettes ont été proposées dans le chat. L'**option B « calendrier semaine »** a été sélectionnée — paradigme « par jour » au lieu de « par employé ».

**Avant (v3.13.5 → v3.23.x)** : table HTML avec employés en lignes, jours en colonnes (×2 sous-colonnes Entrée/Sortie). Tous les shifts étaient visibles en grille dense avec alternance jaune/bleu vive sur les lignes. Édition inline par dropdown 30 min.

**Après (v3.24.0)** : grille CSS avec **une colonne par jour ouvert**, chaque colonne contenant des cartes shift triées par heure de début.

**Structure d'une colonne-jour** :
- **Header** : nom du jour + date + compteurs (« 4 pers · 22h »)
- **Cards shift** : avatar initiales + nom employé + « start → end » + meta (heures + coût)
- Barre latérale colorée selon section (`is-kitchen` ambré, `is-service` bleu, `is-other` gris)
- Hover state + drag handle (toute la carte est draggable)
- **Bouton « + Ajouter »** en bas (dashed → solid au hover) pour créer un nouveau shift

**Interaction**
- **Clic sur une carte** → ouvre la modal d'édition `openShiftModal(empId, dk)` avec employé fixe, heures éditables, bouton supprimer rouge
- **Clic sur « + Ajouter »** → modal en mode création avec select employé (filtré pour exclure ceux ayant déjà un shift ce jour-là)
- **Drag d'une carte vers un autre jour** → handlers `shiftCardDragStart/Over/Drop` qui font le diff Firestore (delete sur ancien jour, write sur nouveau). Confirmation si la cible a déjà un shift de cet employé.
- L'ancien drag & drop de réordonnement d'employés est retiré (sans objet en vue par jour)

**Modal d'édition de shift (nouveau)**
- `openShiftModal(empId, dk)` — header avec date longue en français (« mardi 27 mai »), choix employé (select ou input disabled si édition), 2 selects heures (30 min, partagés avec l'ancienne grille)
- `saveShiftFromModal(dk)` — écrit dans `employees.{id}.shifts.{dk}` via `set merge`
- `deleteShift(empId, dk)` — utilise `FieldValue.delete()` pour retirer la clé

**Panneau totaux compact (nouveau)**
- Sous le calendrier : un seul `.card` avec une grille de 5 lignes × N+2 colonnes (label + jours + total semaine) :
  - Heures · Coût · Ventes prévues · Ventes réelles (inputs) · Écart
- Ligne dates en bas (sous le grid) pour rappel des jours
- Format tabular-nums partout, bg accentué sur les totaux semaine
- Conserve toute la logique métier de l'ancien tfoot (ratio salaires/ventes, ventes réelles éditables, écart coloré vert/rouge)

**Conservé** : `schedule-header` (nav semaine, ratio pill, boutons), coverage chart Chart.js, team cards en bas, toute la logique de calcul

**Implémentation**
- **JS (`pages-hr.js`)** : `renderEmployes()` refactor du bloc table principal seulement (~210 lignes remplacées par ~110 lignes plus claires). Ajout de ~180 lignes pour `openShiftModal` + `saveShiftFromModal` + `deleteShift` + 4 handlers drag & drop (`shiftCardDragStart/Over/Leave/End/Drop`) + 2 variables d'état locales (`_shiftDragEmpId`, `_shiftDragFromDay`).
- **CSS (~280 lignes)** : `.schedule-week-cal` (grid `--n-days` dynamique), `.schedule-day-col` (avec state `.is-drop-target`), `.schedule-day-col-head` (compteurs), `.shift-card` (avec variantes section + état `.is-dragging`), `.shift-card-avatar` (initiales 18×18), `.shift-add-btn` (dashed → solid hover), `.schedule-totals-panel` (grid label+jours+total). Dark mode + responsive (2 cols sur 900px, 1 col sur 600px).

**CACHE_VERSION** → `v3.24.0`

### 29 mai 2026 — Salaires : refonte ledger pro (v3.23.0) 📋🎨

Suite à un retour utilisateur (« Je n'aime pas tant le visuel de ce tableau »), 3 maquettes ont été proposées dans le chat. L'utilisateur a choisi l'**option 3 « tableur comptable sobre »**.

**Avant (v3.16.1 → v3.22.x)** : alternance bicolore vive jaune Bochica + bleu Colombie sur les lignes via CSS variable `--emp-rgb` inline. Couleurs intenses (opacité 0.45 puis 0.60 au hover), section badge coloré, total à payer avec fond accent jaune. Visuellement chargé sur 15+ lignes.

**Après (v3.23.0)** : style ledger comptable sobre :
- **Zébré gris très léger** (1 ligne sur 2, opacité 0.025 light / 0.04 dark) — pure CSS via `.payroll-table tbody tr.is-even td`, plus de CSS variable inline
- **Lignes blanches/neutres** pour les autres — hover gris léger
- **Pourboires en vert subtil** (#1f7a1f light / #7fd86b dark, déjà en place depuis v3.16.2)
- **Total à payer** : font-weight 900, taille 17px, plus de fond accent jaune (juste les chiffres bold)
- **Employés sans pointage** (`is-no-hours` class quand `totalHours === 0`) : opacité 0.55 sur toute la ligne, nom en gris secondaire. Hover restaure l'opacité pour permettre l'édition.
- **Select section override** : devient text-only en mode « Auto » (transparent, gris discret). Ne s'affiche en couleur que quand un override est actif (= dérogation à signaler).
- **Bordures fines** entre lignes (0.5px subtle), pas de séparateurs verticaux entre cellules
- **Header** : gris uniforme, font-weight 500, uppercase 10px tracking 0.06em
- **Tfoot** : fond légèrement plus marqué + border-top 1px pour fermer visuellement la table
- **Ligne extra (EXTRA)** : juste un gradient ambré très léger sur la cellule employé (au lieu d'un fond plein)

**Implémentation**
- JS (`renderSalaires`) : retrait de `style="--emp-rgb:...;--emp-color:..."` du `<tr>` (la CSS variable n'est plus utilisée pour le payroll). Ajout d'une classe `is-no-hours` quand l'employé n'a pointé aucune heure.
- CSS (~90 nouvelles lignes) : tout scopé à `.payroll-table` avec `!important` pour battre les règles globales `.schedule-emp-row .schedule-td--*` qui s'appliquent encore à la page Horaires. La page Employés & Horaires reste **inchangée visuellement** (toujours alternance jaune/bleu vive).

**CACHE_VERSION** → `v3.23.0`

### 29 mai 2026 — Salaires : protection du bouton « Annuler mes saisies » (v3.22.0) 🛡️🗑️

Suite à un retour utilisateur (« Le bouton Annuler mes heures saisies peut être dangereux »). Refonte de la confirmation pour ajouter une friction suffisante avant l'action destructive.

**Avant** : `openConfirm()` standard avec deux boutons « Annuler / Continuer ». Un clic accidentel sur Continuer effaçait tout — y compris les pointages des employés.

**Après** : modale custom avec :
- **Titre rouge** « ⚠ Effacer toutes les saisies — Semaine N » (affiche le numéro de semaine pour éviter la confusion)
- **Bandeau d'avertissement rouge** avec mention « Action irréversible » + détail de ce qui sera effacé (« X cellules d'heures pointées/saisies + Y jours de pourboires »)
- **Input texte** où l'admin doit taper exactement **EFFACER** (insensible à la casse, validé via `toUpperCase()`)
- **Bouton de confirmation** désactivé tant que la phrase n'est pas correcte, devient rouge actif sinon
- Label du bouton : « 🗑 Effacer la semaine N » (rappel du numéro de semaine)
- `autocapitalize="characters"` sur l'input pour faciliter sur mobile/tablette

**Implémentation**
- Remplacement de `openConfirm` par `showModal` dans `resetActualFromPlanned()`.
- Validation côté client uniquement (`oninput` qui toggle `disabled` du bouton).
- Pattern utilisé par GitHub/Vercel pour les actions destructives. Pas de mot de passe à gérer ni à partager.

**Détail bonus** : `doResetActualFromPlanned()` toast simplifié (avant : « heures repartent du planifié » — obsolète depuis v3.17.3 où l'auto-import a été retiré).

**CACHE_VERSION** → `v3.22.0`

### 29 mai 2026 — Salaires : PDF bi-mensuel + fix « (saisie libre) » (v3.21.0) 📅📄

**Rapport PDF couvrant 2 semaines de paie**
- Nouveau bouton **« PDF 2 sem »** dans la toolbar (à côté de « PDF 1 sem », anciennement « Exporter PDF »).
- Génère un rapport agrégé sur la **semaine courante + la semaine précédente** — pratique quand on paie aux 2 semaines, plus besoin de produire 2 rapports séparés.
- Contenu du PDF (landscape Letter, multi-pages auto) :
  - **En-tête** : « Rapport de paie — 2 semaines (S19 + S20) · date début → date fin »
  - **4 KPI combinés** : Total à payer, Salaires bruts, Pourboires, Heures totales (sommés sur 2 sem)
  - **Sous-totaux par semaine** : 2 mini cards avec dates + heures + salaires + pourboires + total par semaine
  - **Tableau récap par employé** : 1 ligne avec colonnes Employé · Section · Hrs S1 · Hrs S2 · Hrs Total · Sal S1 · Sal S2 · Pourb S1 · Pourb S2 · Total à payer (2 sem)
  - **Badge EXTRA** conservé pour les employés ad-hoc
  - **Ligne totaux** en bas avec sommes par semaine et combinées
  - **Footer** « Période de paie 2 semaines · Page X/Y »
- Nom de fichier : `Bochica_Paie2Sem_S{N1}-{N2}_{date}.pdf`

**Nouveau helper réutilisable `_computePayrollWeekData(offset)`**
- ~110 lignes, encapsule toute la logique de calcul d'une semaine de paie : fetch Firestore (ou cache local), agrégation des heures, application des overrides de section, calcul des pourboires prorata, sommes globales.
- Optimisation : si l'offset demandé correspond à la semaine actuellement subscribed, utilise `payrollWeekData` directement (évite un appel réseau).
- Retourne un objet riche `{ weekStart, weekEnd, weekNum, weekLabel, startLabel, endLabel, empRows, sums, tipsByDay, totalTips, ... }`.
- Permet à `generateBiWeeklyPDF` de récupérer 2 semaines en parallèle et de les agréger via une Map (union des employés par ID, ordre = semaine la plus récente).

**Fix label « (saisie libre) »**
- Avant, les dropdowns d'heures du tableau Salaires affichaient `09:32 (saisie libre)` quand un punch tombait à la minute près (hors grille 15 min). Surchargeait visuellement le tableau (largeur de cellule pour 50% des cellules avec punchs réels).
- Après : juste `09:32`. La valeur exacte reste sélectionnée et préservée à la sauvegarde, sans le label parasite.
- Une seule ligne modifiée dans `buildPayrollTimeOptions()`.

**Renommage cosmétique**
- Bouton « Exporter PDF » → « **PDF 1 sem** » pour distinguer clairement des deux options de rapport.

**CACHE_VERSION** → `v3.21.0`

### 29 mai 2026 — Pointage : compaction 12 pouces + 2 boutons + badge TZ (v3.20.0) 📐🎯🌐

Suite à un retour utilisateur (« actuellement ça s'affiche comme ça et ça coupe » avec capture montrant le clavier numérique débordant hors écran sur 12 pouces).

**Compaction visuelle pour écrans 12 pouces**
Toutes les dimensions de la page Pointage réduites pour tenir confortablement dans un viewport ~1280×800 sans scroll :
- `.punch-key` : 96×96 → **64×64 px** (gap 14 → 8, font-size 34 → 24)
- `.punch-title` : 42 → **26 px**
- `.punch-clock` : 32 → **22 px**
- `.punch-date` : 14 → **12 px**
- `.punch-subtitle` : 15 → **12 px**
- `.punch-pin-dot` : 22 → **18 px**
- `.punch-greeting-name` : 48 → **36 px**
- `.punch-main-btn` min-height : 200 → **130 px**, label 32 → 24 px, time 22 → 18 px
- `.punch-confirmed-name` : 54 → **42 px**, time 32 → 26 px
- `.punch-screen` max-width : 520 → **780 px** (pour accommoder 2 boutons côte à côte)
- Padding de page réduit (`var(--sp-4)` → `var(--sp-2)`)

**Deux boutons ENTRÉE + SORTIE toujours visibles**
L'auto-détection unique remplacée par les **2 boutons côte à côte** :
- **ENTRÉE** (gradient vert) → écrit `start`
- **SORTIE** (gradient bleu) → écrit `end`
- Si l'action écraserait une valeur existante, indication `(remplacer 09:00)` sous le label + tooltip explicite
- Bouton flex `1 1 280px` avec max-width 340 → s'aligne côte à côte sur tout écran ≥ 700 px, stack vertical sinon
- Nouvelle barre d'info `.punch-state-info` au-dessus des boutons : affiche ce qui a déjà été pointé (« Entrée : 09:00 · Sortie : 17:30 ») ou « Aucun pointage aujourd'hui » si rien
- Action obsolète `override-sortie` retirée du code (devenue inutile)

**Badge timezone visible pour validation**
Petit pill mono sous la date : `America/Toronto · jour système : 2026-05-29` (timezone détecté par `Intl.DateTimeFormat().resolvedOptions().timeZone` + `dayKey(new Date())`). Si jamais la date affichée ne correspond pas au jour réel local, on sait immédiatement qu'il y a un problème de fuseau au niveau OS, navigateur ou code. Tooltip explicatif au survol.

**CSS (~80 lignes modifiées + ~60 ajoutées)** : nouvelle classe `.punch-tz-badge`, `.punch-state-info` (avec variantes `--empty` + items `--entree`/`--sortie`), `.punch-buttons-row` (flex layout pour 2 boutons), `.punch-main-btn-state` (sous-label de remplacement), `.punch-main-btn.is-disabled`. Toutes les tailles existantes ajustées en place.

**CACHE_VERSION** → `v3.20.0`

### 26 mai 2026 — Salaires : bannière d'alertes intelligentes (v3.19.0) 🚨🔍

Nouveau bloc qui apparaît en haut du tableau Salaires & Pourboires (entre la card ratio et la card pourboires) quand le système détecte des anomalies sur les heures pointées. Évite que des oublis silencieux ne se rendent jusqu'au verrouillage de la paie.

**3 types d'alertes détectées**
1. **Sortie manquante** (warning ambré) : entrée pointée mais pas sortie sur un jour PASSÉ. Aujourd'hui n'est jamais flaggué (l'employé peut encore être en service).
2. **Shift suspicieusement long** (warning ambré) : shift > 14 h — probable oubli de pointer sortie ou erreur de saisie.
3. **Planifié sans pointage** (info bleu) : employé prévu à l'horaire mais aucun pointage sur un jour passé — no-show ou oubli de pointer entrée.

**Comportement**
- **Skip si semaine verrouillée** — les anomalies passées ont déjà été traitées au moment du verrou, inutile d'alerter à nouveau.
- **Auto-disparition** : dès que l'admin corrige la saisie (ajoute la sortie manquante, ou met l'employé absent), l'alerte disparaît à la prochaine re-render.
- **Groupes** : les alertes sont regroupées par type avec un compteur (ex. « Sortie manquante (3) »).
- **Aucun risque de faux positifs** : aujourd'hui ni le futur ne sont flaggués pour les manques de pointage.

**Implémentation**
- Helper `detectPayrollAnomalies(empRows, isLocked)` retourne un array d'alertes `{type, severity, empId, empName, dk, dayLabel, message}`. ~50 lignes, parcourt empRows × weekDays une fois.
- Helper `_formatAlertDayLabel(dk)` : formate "2026-05-26" → "Mar 26/5" (court, lisible).
- Calculé dans `renderSalaires()` après `empRows`, juste avant le HTML.
- Bannière `.payroll-alerts-card` avec barre latérale ambrée (warnings) ou bleue (info only), header avec icône + titre + compteurs (« 3 à vérifier · 1 à titre informatif »), liste groupée par type, footer explicatif.

**CSS (~120 lignes)** : `.payroll-alerts-card` (avec variantes `.has-warnings`/`.has-info-only`), `.payroll-alerts-head`, `.payroll-alerts-title` (Bebas 22px), `.payroll-alerts-list`, `.payroll-alerts-group-head` (label section), `.payroll-alert` (item) avec variantes `.payroll-alert--warning`/`.payroll-alert--info`, `.payroll-alert-day` (mono compact), `.payroll-alert-emp` (Inter bold), `.payroll-alert-msg`. Dark mode + mobile (stack vertical des items).

**CACHE_VERSION** → `v3.19.0`

### 26 mai 2026 — Salaires : override section par employé par semaine (v3.18.0) 🍳🛎️⛔

Nouvelle fonctionnalité demandée pour gérer les cas où un employé change de section ponctuellement (ex. un serveur qui fait une semaine en cuisine, ou un gérant qui ne touche pas aux pourboires cette semaine).

**Nouveau dans le tableau Salaires & Pourboires**
- Le badge fixe `25% Cuisine` / `75% Service` à côté de chaque nom devient un **select compact à 4 options** :
  - **Auto** (défaut) → suit la section configurée dans la fiche employé. Affiche entre parenthèses la section auto-détectée.
  - **🍳 Cuisine (25%)** → cet employé compte dans le pool cuisine cette semaine, même si sa fiche dit "service".
  - **🛎 Service (75%)** → l'inverse.
  - **⛔ Exclu du pool** → ne reçoit aucun pourboire cette semaine ET ses heures ne comptent plus dans le pool (utile pour un gérant ou un cas particulier).
- **Indicateur visuel d'override actif** : bordure dashed jaune + font-weight 800 + tooltip « ⚠ Section dérogée pour cette semaine ».
- Couleur de fond du select selon le groupe effectif : jaune (cuisine), bleu (service), rouge avec texte barré (excluded).
- Disabled quand la semaine est verrouillée.

**Stockage Firestore**
- Nouveau champ `payroll/{weekId}.sectionOverrides{empId: "cuisine"|"service"|"excluded"}`.
- Absence de clé = pas d'override (= "auto"). Garde le doc propre.
- Quand l'admin remet à "Auto", la clé est `FieldValue.delete()`.

**Logique de calcul (`renderSalaires`)**
- Nouveau helper `getEffectiveTipGroup(emp)` qui résout : override de semaine s'il existe, sinon `tipGroupOf(emp)` (fallback sur la fiche).
- Helpers `getSectionOverride(empId)` et `hasSectionOverride(empId)` pour l'UI.
- Dans `dailyCalc` : on skip les employés `"excluded"` (leurs heures ne sont pas dans le pool).
- Dans `empRows.map` : `group = getEffectiveTipGroup(emp)`. Si excluded → `dayTip = 0` partout.
- `groupOverride` (valeur null ou string) ajouté à `row` pour l'UI.

**Cohérence avec les autres features**
- `doRemoveManualEmployee` nettoie aussi le `sectionOverrides[id]` quand on retire un extra (en plus de actualShifts, empOrder, tipMultipliers).
- L'admin reste le seul à pouvoir modifier les overrides (couvert par la règle Firestore `allow write: if isAdmin()` existante — le punch kiosque ne peut écrire que sur `actualShifts`).

**CSS (~80 lignes)** : nouvelle classe `.payroll-section-select` (compact, font-body, chevron SVG inline en background-image, max-width 130px) avec variantes `.is-kitchen`/`.is-service`/`.is-excluded` et modificateur `.is-overridden`. Dark mode adapté.

**CACHE_VERSION** → `v3.18.0`

### 26 mai 2026 — Fix critique pointage : timezone + auto-import (v3.17.3) 🐞🌍

Suite à 3 bugs critiques signalés par l'utilisateur sur le pointage : (1) le bouton ENTRÉE réapparaissait le soir alors que la personne avait déjà pointé le matin, (2) conflit visuel entre l'horaire planifié auto-importé et les heures pointées, (3) punchs mélangés entre mercredi et jeudi.

**Bug racine identifié : `dayKey()` utilisait UTC au lieu de local**
- Avant : `function dayKey(date) { return date.toISOString().slice(0, 10); }`
- Pour Québec (EDT, UTC-4) : un punch à 21h00 local → 01h00 UTC du JOUR SUIVANT → `dayKey` retournait la date de demain.
- Conséquences observées :
  - Entrée à 9h sur "2026-05-26" (correct, 9h EDT = 13h UTC, même jour)
  - Sortie à 21h enregistrée sur "2026-05-27" (incorrect, 21h EDT = 01h UTC du J+1)
  - Le système ne trouvait plus l'entrée du jour → réaffichait le bouton ENTRÉE
  - Les heures se promenaient entre 2 jours dans le tableau de paie
- Fix : nouvelle implémentation utilisant les getters locaux du Date :
  ```js
  function dayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  ```
- Audit : 35 usages de `dayKey()` dans 3 fichiers. Seul `pages-punch.js` utilisait `dayKey(new Date())` (instant courant). Les autres appels passent des Date construites via `getWeekStart() + offset` (minuit local) — donc le passage en local time ne change rien pour eux.

**Suppression de l'auto-import de l'horaire planifié dans Salaires**
- Avant : `getActualShift()` faisait fallback sur `emp.shifts[dk]` si pas d'override → les cellules pré-affichaient l'heure planifiée → conflit avec les vraies heures pointées et risque de saisir le planifié par erreur comme heure pointée.
- Après : `getActualShift()` retourne `null` si pas d'override explicite. Le tableau reste vide jusqu'à ce qu'un pointage ou une saisie manuelle ne le remplisse.
- L'info du planifié reste accessible :
  - **Sous chaque cellule vide** : petit hint mono gris `.payroll-planned-hint` indiquant l'heure prévue (ex. « 13:00 ») — pour repérer rapidement qui devait travailler mais n'a pas encore pointé. N'écrase plus l'input.
  - **Fond bleuté `.payroll-td-cell.is-scheduled-empty`** : signal visuel pour les cellules d'employés prévus mais non pointés.
  - **Colonne « Réel / Planif »** : conserve la comparaison côte à côte (heures pointées vs heures prévues).
- Bannière d'info en haut du tableau réécrite pour expliquer le nouveau comportement.

**Garde-fou explicite dans `punchDoAction()`**
- Avant le write Firestore, on recalcule le `dayKey` au tout dernier moment + sanity check qu'il correspond bien au jour local courant. Si jamais quelqu'un casse `dayKey` à l'avenir, on bloque le punch et on logge une erreur explicite plutôt que de stocker silencieusement sur le mauvais jour.

**Notes pour l'utilisateur**
- Les heures déjà mal enregistrées par le bug UTC (ex. punchs du mercredi soir stockés sur jeudi) **restent sur leur mauvais jour dans Firestore**. Pour nettoyer une semaine en cours, deux options :
  - Cliquer sur chaque cellule incorrecte et sélectionner « — » dans le dropdown pour la vider
  - Cliquer sur « Annuler mes saisies » dans la toolbar (efface toute la semaine — y compris les jours déjà corrects)
- Les nouvelles cellules à partir de maintenant seront correctes.

**CACHE_VERSION** → `v3.17.3`

### 26 mai 2026 — Page d'accueil employé = Pointage (v3.17.2) 🏠⏱️
- `ROLE_PERMISSIONS.employee.homePage` passé de `"inventaire"` à `"pointage"` dans `config.js`.
- Effet : au login du compte « Employe » (typiquement sur la tablette permanente à l'entrée), la page de pointage s'ouvre tout de suite — prête à recevoir un PIN sans aucun clic intermédiaire. Un clic sur le logo Bochica en haut à gauche ramène aussi à `pointage` pour ce rôle.
- L'item « Inventaire » reste dans la sidebar (l'employé y a toujours accès s'il veut consulter ou mettre à jour le stock).
- Aucun changement pour les autres rôles : admin garde `dashboard` comme accueil, chef garde `inventaire`.
- **CACHE_VERSION** → `v3.17.2`

### 26 mai 2026 — Pointage : fix auto-retour au keypad (v3.17.1) 🐞↩️
- **Bug critique** : après avoir cliqué ENTRÉE ou SORTIE, l'écran de confirmation restait affiché indéfiniment. L'employé suivant devait cliquer manuellement « Toucher pour continuer ». Le `setTimeout` d'auto-retour était bien armé mais immédiatement détruit par `renderPunch()` qui faisait `clearTimeout(_punchAutoResetTimer)` au début de chaque render.
- **Fix** :
  1. Retrait du `clearTimeout` dans `renderPunch()` — le nettoyage du timer reste dans `punchReset()` et `punchBackToKeypad()` pour les cas d'annulation explicite.
  2. Le `setTimeout` est désormais placé **après** `renderPage()` dans `punchDoAction()`, `punchKeyOk()` (cas PIN invalide) et `catch (err)` — pour qu'aucun re-render imprévu ne le tue.
- **Délais raccourcis** pour fluidifier les changements d'employé pendant un rush :
  - Confirmation post-punch : 3,5 s → **1,8 s**
  - Erreur PIN invalide : 3 s → **2,2 s**
  - Erreur réseau : 4 s → **2,5 s**
- Bouton « Toucher pour continuer » renommé en **« Suivant → »** (avec icône arrow-right) — il ne sert plus qu'à zapper l'attente.
- **CACHE_VERSION** → `v3.17.1`

### 26 mai 2026 — Pointage : kiosque PIN entrée/sortie (v3.17.0) ⏱️🔢

Nouveau module pour permettre aux employés de pointer leurs entrées et sorties via une page kiosque (typiquement sur tablette permanente à l'entrée du resto). Les heures pointées alimentent **automatiquement** le tableau de Salaires & Pourboires de la semaine en cours.

**Nouveau fichier `js/pages-punch.js`** (~330 lignes)
- État local : `_punchState` (keypad / employee / confirmed / error), `_punchPin`, `_punchEmployee`, `_punchAction`, `_punchActionTime`
- 4 sous-écrans :
  - **Keypad** : titre + dots PIN (4) + clavier numérique 3×4 (1-9, clear, 0, OK) + hint
  - **Employee** : nom de l'employé + section + UN gros bouton ENTRÉE ou SORTIE selon état du jour + sous-texte explicatif
  - **Confirmed** : ✓ + nom + heure + souhait (« Bon shift ! » ou « Bonne soirée ! ») — auto-reset 3,5 s
  - **Error** : message + bouton réessayer — auto-reset 3 s
- Détection auto de l'action via `_punchGetTodayShift()` :
  - Pas d'entrée aujourd'hui → bouton **ENTRÉE** (vert)
  - Entrée mais pas de sortie → bouton **SORTIE** (bleu)
  - Les deux pointés → bouton **METTRE À JOUR LA SORTIE** (ambré, écrase la sortie existante)
- Auto-valide quand on tape le 4e chiffre (UX kiosque, moins de gestes)
- **Clavier physique** supporté : digits, Backspace (effacer), Enter (valider), Escape (reset)
- **Live clock** : horloge HH:MM:SS actualisée chaque seconde via `setInterval`, sans re-render complet (juste `textContent` sur l'élément `#punch-live-clock`)
- Punch écrit directement via `updateActualShift()` de `pages-payroll.js` — réutilise la logique read-then-write qui ne risque pas d'effacer une heure existante

**Routing et permissions (`config.js` + `sidebar.js`)**
- `pointage` ajouté à `ROLE_PERMISSIONS.canAccess/canWrite` pour **les 3 rôles** (global_admin, chef, employee)
- Item « Pointage » (icône `clock`) ajouté en bas de la sidebar, visible par tous
- Entrée dans `pageMeta` + case dans le routing de `renderPage()`
- `initPunchKeypad()` appelé après render pour démarrer l'horloge live + brancher le keyboard listener

**Fiche employé**
- Le hint du champ PIN dans `openEmployeeModal()` est mis à jour pour refléter le nouvel usage : « PIN utilisé sur la page **Pointage** pour marquer entrées et sorties. Doit être unique entre les employés. Sans PIN, l'employé ne pourra pas pointer (mais l'admin pourra toujours saisir ses heures manuellement dans Salaires & Pourboires) ».
- La logique de validation/unicité existante (4 chiffres + check de collision) reste inchangée.

**Règles Firestore (`firestore.rules`)** — **À PUBLIER MANUELLEMENT dans la Console Firebase**
- `/payroll/{doc=**}` élargi pour permettre aux non-admins de pointer :
  - `allow read` → tout user authentifié (pour détecter l'état du jour)
  - `allow create` → tout user authentifié si le doc contient SEULEMENT `actualShifts` + meta (`weekId`, `weekStart`, `updatedAt`)
  - `allow update` → tout user authentifié si l'update ne touche que ces mêmes 4 clés (vérifié via `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`)
  - `allow delete` → admin only
  - Admin garde l'accès complet (`allow write: if isAdmin()`)
- Deux helpers internes : `_payrollPunchCreateOnly()` et `_payrollPunchUpdateOnly()`

**Stockage** — les punches alimentent `payroll/{weekId}.actualShifts[empId][dk]` (même structure que les saisies manuelles dans Salaires). Le tableau de Salaires & Pourboires se remplit donc tout seul, semaine par semaine. L'admin peut toujours corriger une heure à postériori dans Salaires (l'override prend priorité sur le planifié, le pointage est traité comme un override comme un autre).

**Sécurité pratique** — la tablette doit être loggée une fois (admin/chef/employee, peu importe). Les employés ensuite tapent juste leur PIN — la session reste persistante grâce à Firebase Auth `LOCAL`. Le PIN est le seul facteur d'identification au moment du punch, donc à protéger comme tel.

**CSS (~270 lignes)** : `.page--punch` (variante pleine largeur centrée), `.punch-clock`, `.punch-pin-dots`, `.punch-keypad` (grid 3×4 de 96×96 px), `.punch-key` (avec variantes `--clear`, `--ok`, état `disabled`), `.punch-greeting-name` (Bebas 48px), `.punch-main-btn` (200×420 px, gradient selon action `is-entree`/`is-sortie`/`is-override`), `.punch-confirmed-screen` (animation `punchConfirmedIn`), `.punch-error-screen`. Dark mode + mobile (keypad 80×80, boutons réduits).

**Icône** `log-in` ajoutée à `icons.js` (symétrique de `log-out`).

**CACHE_VERSION** → `v3.17.0` (minor — feature significative) + `pages-punch.js` ajouté à l'APP_SHELL du service worker.

### 26 mai 2026 — Typo unifiée Horaires + Salaires + Simulation (v3.16.3) 🔢🟰
Suite à un retour utilisateur (« je veux que le tableau des horaires ressemble plus à celui de pourboires »), la refonte typo de la v3.16.2 (scopée à `.payroll-table`) a été promue à toutes les tables `.schedule-table` — donc Employés & Horaires, Salaires & Pourboires ET Simulation paie partagent maintenant la même grammaire visuelle.

**Sélecteurs réorganisés en 3 sections :**
1. **SHARED** (`.schedule-table .schedule-td--summary`, `.schedule-td--total`, `.schedule-tfoot-row td`, `.schedule-tfoot-val`, `.schedule-tfoot-row--gap .is-positive/.is-negative`) — Inter Bold 16-18 px, tabular-nums, fond accent renforcé sur le Total, verts/rouges saturés.
2. **PAYROLL-ONLY** (`.payroll-tip-amount`, `.payroll-gap-cell`, `.payroll-hours-actual`, etc.) — classes qui n'existent qu'en Salaires, gardent leur scope sans préfixe `.payroll-table`.
3. **DARK MODE** — verts/rouges éclaircis pour rester contrastés sur fond sombre.

**Impact** : la page Employés & Horaires affiche maintenant ses Heures / Taux / Total avec la même typo plus large et plus lisible. La ligne Écart du tfoot bascule en vert vif (#1f7a1f) ou rouge vif (#b32820) — le KPI ressort enfin. La page Simulation paie hérite aussi automatiquement.

Aucun changement de structure HTML — pure refonte CSS qui élargit la portée des règles v3.16.2.

**CACHE_VERSION** → `v3.16.3`

### 26 mai 2026 — Salaires : typo plus grosse et verts/rouges vifs (v3.16.2) 🔢🎨
Suite à un retour utilisateur (« je ne vois pas assez bien les couleurs vertes, ça ressort pas assez, je veux une autre typo plus classique et plus gros »), refonte complète de la typographie et des couleurs sémantiques dans le tableau de paie.

**Typographie — passage de Bebas Neue à Inter Bold**
- Bebas Neue est une police condensée et stylisée, mauvaise pour la lisibilité des chiffres financiers à petite taille. Remplacée par **Inter** (`var(--font-body)`) avec `font-variant-numeric:tabular-nums` pour des chiffres alignés en colonne.
- **Tailles bumpées** :
  - `.payroll-hours-actual` : 14 → **16 px** + `font-weight:800`
  - `.payroll-hours-planned` : 10 → **12 px** (le « / 14.5h » de référence)
  - `.payroll-gap-cell` : 14 → **16 px** + `font-weight:800`
  - `.payroll-tip-amount` : 14 → **16 px** + `font-weight:800`
  - `.schedule-td--summary` (salaire) : 14 → **16 px** + `font-weight:800`
  - `.schedule-td--total` (Total à payer) : 14 → **18 px** + `font-weight:900` — la colonne la plus visible, pour fermer la ligne avec impact
  - `.payroll-time-select` : 13 → **13 px** mais en Inter Bold (avant : mono)
  - tfoot (totaux semaine) : 16-18 px partout

**Couleurs sémantiques saturées**
- **Vert positif** (écart ▲, OK, pourboires) : `#1f7a1f` (light) / `#7fd86b` (dark) — au lieu du `#7dbf66` pâle qui se confondait avec le fond.
- **Rouge négatif** (écart ▼) : `#b32820` (light) / `#ff7a72` (dark).
- Toutes les règles utilisent `!important` pour gagner contre les anciennes règles plus génériques.
- Total à payer : fond accent jaune renforcé (`rgba(var(--accent-rgb), .25)`) pour bien démarquer la dernière colonne.

**Hauteur de ligne**
- 36 → **40 px** pour donner de l'air à la nouvelle typo (Inter 16-18 px est plus haut que Bebas condensé 14 px).
- Mobile (≤900 px) : 32 → 36 px.

Pas de changement de structure HTML, juste un nouveau bloc CSS scopé `.payroll-table .…` qui override les styles existants. La table Employés & Horaires reste identique (typo Bebas + 42 px de hauteur).

**CACHE_VERSION** → `v3.16.2`

### 26 mai 2026 — Tableau Salaires : alternance jaune/bleu (v3.16.1) 🟡🔵
- Le tableau de **Salaires & Pourboires** reprend désormais l'alternance bicolore du tableau **Employés & Horaires** (jaune Bochica `247,179,44` sur les lignes paires, bleu Colombie `74,144,226` sur les impaires). Chaque employé est visuellement distinct, plus facile à suivre horizontalement quand on a 15-20 lignes.
- Implémentation : `renderSalaires()` ajoute maintenant l'index de ligne à `empRows.map((row, rowIdx) => …)`, calcule `empRgb` selon `rowIdx % 2`, et expose `--emp-rgb` + `--emp-color` en `style` inline sur chaque `<tr>`. Les règles CSS `.schedule-emp-row .schedule-td--*` existantes (partagées avec Horaires) prennent ensuite le relais pour teinter le fond.
- **Conflits visuels nettoyés** :
  - Fond `is-modified` (ambré clair) retiré — le marqueur passe désormais uniquement par la **barre ambrée 3 px à gauche** de la cellule (déjà présente). Bien lisible sur jaune comme sur bleu.
  - Fond `is-auto` (bleu pâle = auto-importé du planifié) retiré — il faisait doublon avec le bleu de l'alternance. Les cellules sans override sont la majorité, donc l'absence de marqueur supplémentaire est cohérente avec le défaut.
- **Légende mise à jour** sous le tableau : « Lignes jaunes / bleues = un employé par ligne · Barre ambrée à gauche = cellule modifiée · ★ = heures éligibles aux pourboires ».
- Aucun impact sur le PDF (qui a déjà sa propre logique d'alternance plus discrète).
- **CACHE_VERSION** → `v3.16.1`

### 26 mai 2026 — Export PDF du rapport de paie + fix bug entrée/sortie (v3.16.0) 📄🐞

**Export PDF complet de la semaine de paie**
- Nouveau bouton **« Exporter PDF »** dans la toolbar de la page Salaires & Pourboires (icône `download`).
- Nouvelle fonction `generatePayrollPDF()` dans `pages-payroll.js` (~280 lignes) :
  - **Format** : landscape Letter (279,4 × 215,9 mm), marges 12 mm.
  - **En-tête 1ère page** : logo « BOCHICA » 22 pt + « Restaurant Colombien » + tricolore jaune/bleu/rouge centré + titre « Rapport de paie — Semaine N » + dates.
  - **En-tête compact pages suivantes** : `BOCHICA · Rapport de paie sem. N` + dates à droite + ligne accent jaune.
  - **4 KPI cards en haut** : Total à payer, Salaires bruts, Pourboires distribués, Heures totales — barre latérale de couleur (jaune/bleu/vert/noir).
  - **Grille pourboires par jour** : 7 cases avec date + montant + pools cuisine/service.
  - **Tableau principal** : Employé (nom + section + taux) | 7 jours × (entrée/sortie) | Hrs | Salaire | Pourb. | Total. Lignes alternées (zébré), fond ambré clair. Bordures sobres. Saut de page automatique via `ensureSpace()` + redessin de l'en-tête de table sur chaque nouvelle page.
  - **Ligne totaux** sous le tableau (fond accentué).
  - **Récap par employé** en grille 4 colonnes : cartes avec barre latérale cuisine (jaune) / service (bleu), nom, groupe, montant pourboire en vert, pill `+ X,XX $/h` jaune + ligne « Effectif : Y,YY $/h (base Z,ZZ) ».
  - **Footer** sur toutes les pages : `Généré le ... · Bochica Café Bistro` + `Page N / Total`.
  - **Nom de fichier** : `Bochica_Paie_Sem{N}_{YYYY-MM-DD}.pdf` (date du lundi).
- Helper interne `_truncatePdf(doc, text, maxW)` : tronque un texte avec ellipsis pour qu'il tienne dans une largeur donnée (binary search sur la longueur).
- Bouton désactivé si aucun employé n'est inclus dans la semaine.

**Fix critique : modifier une heure effaçait l'autre**
- Symptôme : modifier l'entrée d'un employé effaçait sa sortie (et inversement). Perte de données silencieuse.
- Cause : `updateActualShift` n'écrivait que le champ modifié (ex. `{ start: "10:00" }`). Quand l'employé n'avait pas encore d'override (heures auto-importées du planifié), le 1er write créait un override partiel : `actualShifts.emp.dk = { start: "10:00" }` — sans `end`. À la prochaine lecture, `getActualShift` détectait un override (truthy) et le retournait tel quel — il ne tombait plus sur le fallback du planifié. La cellule `end` apparaissait alors vide.
- Solution : `updateActualShift` lit maintenant le shift courant **visible** (via `getActualShift`, qui inclut le fallback planifié) avant l'écriture, et pousse toujours `{ start, end }` ensemble. Le champ non modifié reflète ce que l'utilisateur voyait à l'écran au moment de l'édition.
- Commentaire détaillé ajouté au-dessus de la fonction pour documenter le piège.
- **CACHE_VERSION** → `v3.16.0` (minor bump — PDF est une feature significative + fix critique)

### 26 mai 2026 — Page Salaires plus large + lignes compactées (v3.15.3) 📏
- **Nouveau modifier CSS `.page.page--wide`** (`max-width:none`) — appliqué au wrapper de la page Salaires. Le tableau utilise désormais toute la largeur disponible au-delà de 1200 px (le `width:100%` de `.schedule-table` étire alors proportionnellement les colonnes via `table-layout:fixed`). Padding légèrement ajusté : `var(--sp-5) var(--sp-6)`.
- **Hauteur de ligne** : de 42 px → **36 px** pour `.payroll-table .schedule-emp-row` (32 px sous 900 px). Le pill multiplicateur ayant été retiré en v3.15.2, la cellule employé tient facilement sans déborder. Cellule employé : padding vertical baissé à 3 px.
- **Note importante** : la table Employés & Horaires (`.schedule-table` sans `.payroll-table`) garde ses 42 px → aucun impact croisé entre les deux pages.
- Padding des cellules `entry`/`exit` baissé de `2px` à `1px` vertical, et `summary` de `4px` à `3px` pour gagner ~10 px par ligne au total.
- **CACHE_VERSION** → `v3.15.3`

### 26 mai 2026 — Retrait du multiplicateur de pourboire (v3.15.2) ↩️
- Le **pill `%` à côté de chaque employé** (introduit en v3.15.0) faisait apparaître « 100% » sur toutes les lignes, créant du bruit visuel sans cas d'usage concret au quotidien. Retrait complet à la demande utilisateur.
- **Code retiré** :
  - `getTipMultiplier()` helper
  - `updateTipMultiplier()` action Firestore
  - Variables `multiplier` / `multPct` / `multCls` / `multTitle` dans le rendu de chaque ligne
  - Bloc `<span class="payroll-multiplier-wrap">…</span>` dans la cellule employé
  - CSS `.payroll-multiplier-wrap` (4 variantes is-default/is-excluded/is-reduced/is-boosted), `.payroll-multiplier-input`, `.payroll-multiplier-suffix` + dark mode
- **Calcul revenu au prorata simple** : `dailyCalc` reprend `totalKitchenHrsDay`/`totalServiceHrsDay` (heures brutes), et le `dayTip` de chaque employé = `(tipHours / groupTotalHrs) * groupPool`.
- **Données BD préservées** : le champ `tipMultipliers{}` dans `payroll/{weekId}` n'est plus lu mais reste en BD pour les semaines déjà éditées. Il est simplement ignoré. `doRemoveManualEmployee()` continue à nettoyer la clé par défense au cas où un extra avait été configuré avant le retrait.
- **Conservées de v3.15.0** : ajout d'extras (employés ad-hoc), drag & drop pour réordonner. Ces deux features restent en place et utilisables.
- **CACHE_VERSION** → `v3.15.2`

### 26 mai 2026 — Récap pourboires : bonus $/h par employé (v3.15.1) 💵⏱️
- Dans la carte **« Pourboires de la semaine par employé »**, chaque fiche employé affiche maintenant deux infos supplémentaires sous le montant total :
  - **Pill jaune accent `+ X,XX $/h`** — bonus moyen par heure travaillée. Calcul : `tipShare / totalHours`. Répond à la question « ce pourboire représente combien de plus par heure de travail ? ».
  - **Petite ligne « Effectif : Y,YY $/h (base Z,ZZ) »** — taux horaire effectif (taux contractuel + bonus pourboire). Permet de comparer la rémunération réelle entre cuisine (sans/peu de pourboire) et service (avec).
- Affichés uniquement quand `tipPerHour > 0` (pas de pill orphelin si l'employé n'a pas eu de pourboire).
- Tooltips détaillés au survol pour expliquer la méthode de calcul.
- CSS : 3 nouvelles classes — `.payroll-recap-emp-boost` (pill, ses sous-éléments `__plus`/`__amount`/`__unit`), `.payroll-recap-emp-effective` + `.payroll-recap-emp-effective__base`. Dark mode adapté.
- **CACHE_VERSION** → `v3.15.1`

### 26 mai 2026 — Salaires : extras + multiplicateur + ordre manuel (v3.15.0) 👥🎯✋
Trois fonctionnalités significatives ajoutées à la page **Salaires & Pourboires**, toutes scopées à la semaine courante (zéro impact sur la liste principale Employés ou le planning Horaires).

**1. Employés extras (ad-hoc) — bouton « + Ajouter un extra »**
- Modale d'ajout : nom + section (cuisine/service/autre) + taux horaire.
- Stockés dans `payroll/{weekId}.manualEmployees[]` — array d'objets `{ id (préfixé `manual_`), name, section, hourlyRate, role: "Extra", isSalaried: false, shifts: {}, createdAt }`.
- Visibles dans le tableau avec un badge **EXTRA** (pill ambré à côté du nom) et un mini-bouton trash pour les retirer.
- Heures saisies dans les cellules normales (réutilise `actualShifts[id][dk]` et `updateActualShift`) — aucune logique séparée.
- Inclus dans le calcul de salaires bruts (`_computeWeekGrossWage`) et donc dans la dépense Salaires créée au verrouillage.
- Helper `getManualEmployees()` lit le champ, `isManualEmployee(emp)` teste si une ligne est un extra.
- Confirmation à la suppression : retire l'employé + ses heures + son multiplicateur + son entrée dans empOrder.

**2. Multiplicateur de pourboire par employé**
- Pill éditable en `%` à côté du badge cuisine/service. Range 0–500 par cran de 5.
- **100% par défaut** (stocké comme suppression de clé pour garder le doc Firestore propre).
- **0%** = employé exclu du pool (utile pour un gérant qui ne touche pas aux pourboires).
- **150%** = part et demie (utile pour une heure de fermeture intense, ou pour un chef rang).
- Pondération appliquée dans `dailyCalc` : `weightedHrs = tipHrs * multiplier`. Le pool est divisé par `totalKitchenWeightedDay`/`totalServiceWeightedDay` au lieu des heures brutes. Garantit que la somme distribuée reste égale au pool.
- Stocké dans `payroll/{weekId}.tipMultipliers{}` (objet `{ [empId]: ratio }`, ratio 1.0 absent du doc par défaut).
- **Code couleur sémantique** du pill : gris (défaut 100%), rouge (exclu 0%), ambré (réduit < 100%), vert (majoré > 100%). Tooltip explicatif au survol.
- Helper `getTipMultiplier(empId)` retourne `1.0` si absent, sinon le ratio (avec garde-fou `Math.max(0, …)`).
- Action `updateTipMultiplier(empId, pctValue)` convertit % → ratio et écrit (ou supprime la clé si valeur = 1.0).

**3. Drag & drop pour réordonner les employés**
- Handle ⋮⋮ (grip-vertical, 14px) à gauche de chaque ligne, masqué quand la semaine est verrouillée.
- API HTML5 native (calquée sur `empRowDrag*` de `pages-hr.js`) — variable locale `_payrollDragId` pour ne pas entrer en conflit avec celle des Horaires.
- Insertion before/after détectée selon la position du curseur dans la cellule cible (moitié haute/basse).
- Indicateurs visuels réutilisés : `.schedule-row--dragging` (opacité 40%) + `.schedule-row--drop-before/after` (barre jaune accent au-dessus/en-dessous) — déjà définis dans `style.css`.
- L'ordre est sauvé dans `payroll/{weekId}.empOrder[]` (array d'IDs réels + manuels), **spécifique à la semaine** — n'affecte pas `employees.sortOrder` ni la page Employés & Horaires.
- `getAllPayrollEmployees()` applique `empOrder[]` au tri ; les employés/extras ajoutés après coup vont à la fin (tri stable).

**Détails techniques**
- Nouveau modèle de données `payroll/{weekId}` :
  - `manualEmployees[]` — array d'extras
  - `tipMultipliers{}` — objet sparse, clé absente = ratio 1.0
  - `empOrder[]` — array d'IDs (réels + manuels)
- `_computeWeekGrossWage()` étendu pour inclure `getManualEmployees()` dans le calcul des salaires bruts.
- `renderSalaires()` utilise désormais `getAllPayrollEmployees()` au lieu de `employees` direct.
- Empty state amélioré : si pas d'employés réels NI d'extras, on propose les deux actions (Employés & Horaires ou « + Ajouter un extra »).
- Tous les nouveaux contrôles (multiplicateur input, drag handle, bouton supprimer) sont **désactivés quand la semaine est verrouillée**.
- CSS : ~170 nouvelles lignes — `.payroll-emp-cell`, `.payroll-drag-handle`, `.payroll-manual-badge`, `.payroll-manual-del`, `.payroll-multiplier-wrap` (4 variantes is-default/is-excluded/is-reduced/is-boosted), `.payroll-multiplier-input`, `.payroll-multiplier-suffix`, `.schedule-emp-row.is-manual-emp`. Dark mode adapté pour chaque variante.
- **CACHE_VERSION** → `v3.15.0` (minor bump — feature significative)

### 26 mai 2026 — Salaires : dropdown 15 min sur les heures réelles (v3.14.2) ⏱️
- **Problème utilisateur** : sur la page **Salaires & Pourboires**, les cellules heures (entrée/sortie) étaient un `<input type="time">` natif. Sur certains navigateurs (notamment desktop sans chevron + spinners cachés), le picker était quasi inutilisable → impossible de modifier l'heure sans passer par la saisie clavier exacte du format `HH:MM`.
- **Solution** : remplacement par un **`<select>` avec options aux 15 min** (96 crans entre 00:00 et 23:45). Cohérent avec la grille Employés & Horaires qui utilise déjà des `<select>` (mais aux 30 min — la paie justifie une granularité plus fine).
- **Nouveau dans `pages-payroll.js`** :
  - Constante `PAYROLL_TIME_OPTIONS_15` (96 valeurs).
  - Helper `buildPayrollTimeOptions(selectedValue)` qui génère le `<option>—</option>` + tous les crans, et **préserve** une valeur héritée hors quadrillage (ex. ancien `13:17` saisi via l'input time) en l'insérant en tête avec la mention « (saisie libre) » pour ne perdre aucune donnée historique.
- **Rendu** : `<select class="payroll-time-select">` à la place de `<input type="time" class="payroll-time-input">` dans les deux cellules entrée/sortie de chaque jour.
- **CSS** : nouvelle classe `.payroll-time-select` calquée sur `.payroll-time-input` (compact, font mono 13 px, fond transparent → surface au hover, accent jaune au focus). Chevron SVG inline injecté en `background-image` (noir clair / crème dark), `text-align-last:center` pour centrer la valeur sélectionnée. Règle « semaine verrouillée » étendue au nouveau select.
- **Rétrocompat totale** : l'ancien `.payroll-time-input` reste défini en CSS (au cas où une autre page l'utiliserait) ; les anciennes saisies à la minute près restent visibles et modifiables.
- **CACHE_VERSION** → `v3.14.2`

### 17 mai 2026 — Soumissions multi-options (v3.14.0) 🧾📋
- **Nouveau modèle de données** : chaque soumission a maintenant un array `packageOptions[]` au lieu d'un forfait unique. Chaque option contient `{ id, packageId, packageSnapshot, beerAddon, customLines[], depositAmount, depositPaid }`.
- **Rétrocompat complète** : nouveau helper `getQuoteOptions(qt)` qui normalise toujours en array — soit `packageOptions[]` si présent, soit reconstruit une option unique à partir des anciens champs à plat. Les soumissions existantes en BD continuent de fonctionner sans migration.
- **Champs legacy écrits en parallèle** : à chaque save, les champs `packageId`/`packageSnapshot`/`beerAddon`/`customLines`/`depositAmount`/`depositPaid` sont copiés à plat depuis la 1ère option pour que tout vieux lecteur affiche encore quelque chose de cohérent.
- **Formulaire refondu** : bloc « Options de forfait » avec bouton « + Ajouter une option de forfait ». Chaque option = bloc badge `Option A/B/C...` + choix de forfait (radios) + add-on bière (avec prix surchargeable) + suppléments/rabais propres à l'option + dépôt propre à l'option. Bouton trash pour retirer une option (minimum 1).
- **État du formulaire en mémoire** : nouveau global `_editingQuoteOptions` dans `state.js` — permet d'ajouter/retirer des options dynamiquement sans perdre la saisie. Helper `syncEditingOptionsFromDOM()` re-lit toujours le DOM avant un re-render.
- **Le nombre de personnes (`guestCount`) reste commun** à toutes les options (cas le plus courant : « 25 pers, vous préférez Essentiel ou Gourmand ? »).
- **Calcul** : `computeQuoteOptionTotal(opt, guestCount)` calcule les totaux par option. `computeQuoteRange(qt)` retourne `{ min, max, count }` pour l'affichage en fourchette dans la liste.
- **Liste des soumissions** : badge « N options de forfait » (au lieu du nom unique) quand multi. Total affiché en fourchette « 595 $ – 750 $ » quand min ≠ max.
- **PDF refondu multi-pages** :
  - Bandeau d'intro accent jaune « N options proposées — choisissez celle qui vous convient » + sous-texte « Cochez l'option retenue dans la case en bas de chaque carte »
  - Une section par option : badge OPTION A/B/C + trait coloré + carte forfait + bière (si activée) + suppléments + totaux complets (sous-total → TPS → TVQ → TOTAL OPTION A) + dépôt + case à cocher « Je choisis l'OPTION X — Nom »
  - **Saut de page intelligent** : helper `ensureSpace(needed)` qui passe à une nouvelle page si l'option ne tient pas (estimation de hauteur par option avec custom lines + bière + dépôt)
  - **En-tête compact** sur les pages suivantes : BOCHICA + n° soumission + nom client + ligne accent jaune
  - **Numérotation « Page N / Total »** en bas si > 1 page
  - Footer (QR code menu + mentions légales) toujours sur la dernière page
- **CSS** : nouvelle classe `.quote-option-block` avec badge `.quote-option-block__badge`, sous-sections `.quote-option-subsection`, bouton d'ajout `.quote-add-option-btn` (dashed border qui devient solide au hover), `.quote-card__meta-item--multi` (pill ambré pour le badge multi-options dans la liste), `.quote-card__total-range` (taille réduite pour la fourchette).
- **CACHE_VERSION** bumpé à `v3.14.0` (minor — feature significative)

### 13 mai 2026 — Frais fixes auto-rattrapage (v3.13.8) 🔁💰
- **`autoApplyFixedExpenses()`** modifiée pour rattraper automatiquement les mois manqués (avant : ne traitait que le mois courant — si l'admin ne se connectait pas au début d'un mois, les frais fixes étaient perdus).
- **Logique** : trouve le mois le plus ancien où on a des expenses `isFixedAuto`, boucle entre ce mois et le mois courant, crée les expenses manquantes pour chaque template avec `date = 1er du mois`.
- **Garde-fou 12 mois** : pas de rattrapage rétroactif au-delà d'1 an.
- **Toast de feedback** si rattrapage > 1 mois (« Frais fixes appliqués : N entrées sur M mois »).
- **Helpers** ajoutés : `monthKeyFromDate(d)` + `monthsBetween(start, end, maxBack)`.
- **CACHE_VERSION** → `v3.13.8`

### 13 mai 2026 — Événements de la semaine au dashboard (v3.13.7) 📅
- **Bloc « Événements »** du widget Aujourd'hui élargi de 1 jour → 7 jours (lundi → dimanche en cours).
- Titre actualisé : « Événements cette semaine (N) ».
- Tri par date puis heure. Chaque ligne affiche un **pill de jour court** : `Auj.` (en fond jaune accent), `Demain`, ou `Lun 12` / `Mer 14`, etc.
- **Highlight visuel** des events d'aujourd'hui : fond ambré + bordure jaune.
- Limite 6 items affichés directement, surplus avec « + N autres… ».
- **CACHE_VERSION** → `v3.13.7`

### 13 mai 2026 — Tri rapport + retrait Historique + typo horaire (v3.13.5–3.13.6) 🗂️🔤
- **Page À commander** : nouveau sélecteur de tri à 2 onglets `📁 Par section` / `🏪 Par fournisseur`. État `rapportSortMode` dans `state.js`. Pour le mode fournisseur, chaque groupe affiche : nom + nombre d'items + badges « X immédiats / X bientôt » + téléphone du fournisseur. Items sans fournisseur regroupés sous « — Sans fournisseur — » à la fin. Le PDF imprimable suit aussi le tri actif.
- **Page Historique retirée** : item enlevé de la sidebar, du routing et des permissions admin. La fonction `renderHistorique()` reste en mort code, et le listener `/logs` continue d'écrire les actions.
- **Typo du tableau horaire employés** : remplacement de **Bebas Neue** (condensée, peu lisible en petit) et **JetBrains Mono** par **Inter** (`var(--font-body)`) avec `font-variant-numeric: tabular-nums` pour préserver l'alignement vertical des chiffres. Touché : `.schedule-emp-name`, `.schedule-time`, `.schedule-td--summary`, `.schedule-tfoot-row td`, `.schedule-tfoot-row--gap .schedule-tfoot-val`.
- **CACHE_VERSION** → `v3.13.5` puis `v3.13.6`

### 13 mai 2026 — KPI Rapports : valeurs comparées en chiffres absolus (v3.13.4) 💯
- `reportsKpi(...)` accepte maintenant un 6e paramètre `yoyValueStr` (string déjà formatée).
- Quand YoY actif, chaque KPI affiche en plus du delta % le **comparatif chiffré** : `137 366 $ vs 112 250 $` avec un badge ambré `A-1`.
- Pour chaque KPI, format adapté : `fmtMoney()` pour les $ / `toLocaleString("fr-CA")` pour les compteurs / `fmtHours()` pour les heures.
- Nouveau CSS `.reports-kpi-yoy` + `.reports-kpi-yoy__pct` + `.reports-kpi-yoy__compare` + `.reports-kpi-yoy__year`.
- **CACHE_VERSION** → `v3.13.4`

### 13 mai 2026 — YoY visible par défaut + bons chiffres 2025 (v3.13.2–3.13.3) 📊✅
- **YoY activé par défaut** (`reportsCompareYoY = true` au lieu de `false`).
- **Barres côte à côte** dans le graphique de ventes : vert pâle pour l'année précédente, vert plein pour l'année courante. Labels dynamiques (« Ventes 2025 », « Ventes 2026 »).
- **Toggle YoY restylé** : pill arrondie avec bordure 2px épaisse, effet hover lift+shadow, fond jaune accent quand actif.
- **Seed corrigé pour 2025** : les 8 PDFs `Rapportutilisateur*` pour jan-août 2025 (ventes du Manager seulement, sous-évalués) remplacés par les `Rapportdevente*` (vrais totaux du resto, jusqu'à 4× plus élevés). Script `parse_reports.py` étendu pour préférer `Rapportdevente*` quand les deux types existent pour la même période.
- **CACHE_VERSION** → `v3.13.2` puis `v3.13.3`

### 13 mai 2026 — Rapports : YoY + période personnalisée + 16 mois (v3.13.1) 📈📆
- **Comparatif vs année précédente (YoY)** :
  - Toggle « Vs année précédente » ajouté dans la barre de contrôles
  - Quand activé, **chaque mois affiché** est mis en parallèle avec le même mois de l'année N-1
  - **Graphique de ventes** : 2e jeu de barres pour Ventes A-1 (opacité 33% + pointillé) + 2e ligne pour Pourboires A-1
  - **KPI agrégés** : chaque KPI affiche le delta % vs même période A-1 (vert ▲ / rouge ▼ / —)
  - **Tableau récap** : 2 nouvelles colonnes (Total A-1, Δ YoY) avec fond ambré pour les démarquer
  - Helper `getReportForPrevYear(period)` + `pctDelta(curr, prev)` + `fmtPctDelta()` réutilisables
- **Période personnalisée** :
  - Nouvelle option « Personnalisé » dans les tabs (3/6/12/Tout/**Personnalisé**)
  - Quand active, 2 inputs `type="month"` apparaissent (Début → Fin) avec min/max bornés sur les mois disponibles
  - Filtrage : tous les rapports entre `start` et `end` inclus
  - Auto-swap si `start > end` (intuitif)
- **Données seed étendues à 16 mois** : `2025-01` → `2026-04` (parsing automatique des 8 nouveaux PDFs jan-août 2025 reçus). Le YoY fonctionne maintenant pour jan→avril 2026 vs jan→avril 2025.
- **CACHE_VERSION** → `v3.13.1`

### 13 mai 2026 — Page Rapports mensuels (v3.13.0) 📊📈
- **Nouvelle page « Rapports mensuels »** sous Finances dans la sidebar (admin seulement)
- **Nouvelle collection Firestore** `monthlyReports` (id = `YYYY-MM`) avec règles admin only
- **Source des données** : PDFs Cluster mensuels (rapport util. Manager) parsés via script Python (`parse_reports.py` avec pypdf + regex). 8 mois pré-parsés inclus dans le seed (`monthly-reports-seed.js`, ~63 KB).
- **Données extraites par mois** :
  - Sommaire global : reçus, clients, articles vendus, reçu moy., ventes nettes, TPS, TVQ, total, non-taxable
  - 7 canaux de vente : tables, comptoir, emporter, ramassage, E-L. livraison/ramassage/comptoir
  - Modes de paiement (INT/MAS/VIS/COM/UBE/CRE/AME/GIF/CAS/CAR/DOO) avec qté, montant, pourboires, total
  - Top 20 catégories (qté + total $)
  - Top 50 articles (qté + total $)
  - Total heures travaillées
  - Corrections par raison (training mode, over punch, customer disatisfaction, etc.)
  - Rabais par type
- **Visualisations** dans `js/pages-rapports.js` (~530 lignes) :
  - Sélecteur de période : 3 / 6 / 12 mois / Tout (`reportsViewPeriod` dans state.js)
  - 6 KPI agrégés en haut : ventes totales, reçus, clients, reçu moyen, pourboires, heures
  - Graphique 1 (combo) : Évolution des ventes (barres) + Pourboires (ligne) par mois
  - Graphique 2 : Ventes par canal (barres empilées)
  - Graphique 3 : Modes de paiement (barres groupées par mois)
  - Graphique 4 : Top catégories agrégées sur la période (doughnut)
  - Tableau top 15 produits agrégés (qté + ventes cumulées)
  - Tableau récapitulatif mois par mois avec écart % vs mois précédent
- **Import seed** : bouton « Importer seed » dans la toolbar → modale liste les 8 mois → batch write Firestore
- **Routing & permissions** : `"rapports"` ajouté à `global_admin.canAccess/canWrite` dans config.js + mapping dans `PAGE_TO_SECTION` (section finance) + `pageMeta`
- **CACHE_VERSION** bumpé à `v3.13.0` (minor bump — nouvelle feature complète)

### 12 mai 2026 — UI Polish : micro-interactions + empty states + dashboard (v3.12.0) ✨📊🎨
**3 chantiers UX/UI livrés en parallèle :**

**🎬 Micro-interactions**
- **Skeleton loaders** : classes `.skeleton`, `.skeleton-line`, `.skeleton-block`, `.skeleton-avatar`, `.skeleton-card` avec animation shimmer 1.4s. Respect `prefers-reduced-motion`.
- **Hover cards plus marqué** : `.card:hover` → bordure accent + double shadow (4px naturel + 1px ring accent). Désactivable via `.card.no-hover`.
- **`animateNumber(el, from, to, duration, formatter)`** dans utils.js : anime un compteur avec easeOutCubic, respecte `prefers-reduced-motion`, accepte un formatter (ex: `fmtMoney`).
- **`flashSaveSuccess(btn, duration)`** : feedback ✓ vert sur le bouton save avant fermeture modale. CSS `.btn.is-saved` avec animation `save-success-pulse`.

**🖼️ Empty states illustrés**
- **10 illustrations SVG inline** dans `EMPTY_ILLUSTRATIONS` (utils.js) : inventaire (boîte), taches (liste à cocher), employes (silhouettes), soumissions (reçu $), menu (assiette), recettes (livre ouvert), shopping (sac), evenements (calendrier étoile), depenses (wallet), fournisseurs (storefront), default (point d'interrogation).
- **`renderEmptyState({ kind, title, subtitle, cta, hint })`** : helper qui rend une card illustrée avec titre + sous-titre + CTA en pill jaune + hint en uppercase mono.
- **5 pages utilisent maintenant le nouvel empty state** : Employés (`pages-hr.js`), Tâches (`pages-secondaires.js`), Soumissions (`pages-quotes.js`), Événements (`pages-events.js`), Simulations (`pages-simulations.js`).
- CSS `.empty-illustrated` avec border dashed, fond surface, padding généreux, illustration 160×140px.

**📊 Dashboard**
- **Widget « Aujourd'hui »** au-dessus des KPI cards : grosse date du jour + ratio salaires/ventes en cours (avec code couleur < 32% vert, 32-40% jaune, > 40% rouge) + grille 3 colonnes : Employés en shift aujourd'hui (avec pill couleur cuisine/service), Événements du jour, Tâches dues aujourd'hui.
- **Sparklines dans les KPI cards** : mini-courbe Chart.js sur 30 jours en arrière-plan de chaque card (Revenus vert, Dépenses rouge, Profit jaune). Hauteur 48px, opacité 35%, sous le contenu (z-index).
- Nouvelles fonctions dans `pages-dashboard.js` : `renderDashTodayWidget(now, todayStr)`, `getWeekStartForDashboard(d)`, `buildSpark30d(items, now)`, `initDashSparklines()`.
- **`dashStatCard`** étendue pour accepter `sparkData` et `sparkId`.
- **Init des sparklines** déclenché par `sidebar.js` après le render du dashboard (50ms `setTimeout`).
- **Couleurs des cards** changées de `var(--status-X)` aux valeurs hexa directes (#7dbf66, #d9534f, #F7B32C) pour que Chart.js puisse les utiliser dans les sparklines.

**CACHE_VERSION** bumpé à `v3.12.0` (minor — chantier UI significatif).

### 12 mai 2026 — Sidebar en accordéons par domaine (v3.11.0) 🗂️📂
- **Refonte complète de la sidebar** : les 16 items autrefois listés à plat sont regroupés en **6 sections accordéon par domaine fonctionnel** :
  - 📊 **Dashboard** (lien direct, toujours visible en haut)
  - 📦 **Inventaire** : Inventaire · À commander · Liste d'ingrédients <small>(Historique retiré dans v3.13.6)</small>
  - 👥 **RH & Horaires** : Employés · Salaires · Simulation paie · Tâches
  - 🍽️ **Cuisine** : Menu · Ingrédients · Recettes
  - 💰 **Finances** : Dépenses · TPS/TVQ
  - 📅 **Clients & Événements** : Événements · Soumissions
  - 🏪 **Fournisseurs** (lien direct, hors accordéon)
- **Comportement** :
  - Au login et après chaque `navTo()`, la section contenant la page active est **automatiquement ouverte** (mapping `PAGE_TO_SECTION`)
  - Les autres sections restent fermées (état initial épuré)
  - Clic sur un header de section pour ouvrir/fermer
  - Reset des sections ouvertes au logout (chaque login repart propre)
- **Promotion d'item unique** : si une section ne contient qu'un seul item après filtrage par permission (ex: chef qui n'a accès qu'à Événements dans Clients), elle est automatiquement promue en lien direct (pas d'accordéon inutile)
- **Indicateur visuel "page active dans section fermée"** : le header de section prend une teinte jaune discrète quand la page active est cachée à l'intérieur, pour ne pas perdre l'utilisateur
- **Chevron animé** : `▶` qui pivote de 90° à l'ouverture
- **Animation max-height** pour le pliage (transition fluide)
- **Nouveau dans `state.js`** : `let expandedNavSections = new Set();` (reset au logout)
- **Nouveau dans `sidebar.js`** : `getNavStructure()`, `PAGE_TO_SECTION`, `autoExpandSectionFor(page)`, `toggleNavSection(id)`
- **CACHE_VERSION** bumpé à `v3.11.0` (nouvelle minor — refonte UI significative)

### 12 mai 2026 — Sim : Graphique de couverture (v3.10.6) 📈📊
- **Nouveau graphique de couverture dans la simulation** : carte « Couverture — employés sur le plancher » placée après les boutons d'action, identique visuellement à celui de la page Employés & Horaires (barres Chart.js, un dataset par jour ouvert, hauteur 280px).
- **Filtre par section** : 4 onglets (Tous / Service / Cuisine / Autre) avec compteur d'employés par section.
- **Adapté à la structure de la sim** : nouveau helper `countSimCoverageAtHour(simEmployees, dow, H, sectionFilter)` qui prend les shifts indexés par dow (0..6) au lieu de par date.
- **Variables d'état locales** dans `pages-simulations.js` :
  - `_simCoverageChartInstance` : référence à l'instance Chart.js pour destruction propre avant ré-init
  - `_simCoverageSection` : filtre actif (par défaut `"all"`)
- **`initSimCoverageChart()`** appelé automatiquement après chaque render de l'éditeur (dans `renderSimulationEditor()` ET dans le routing `sidebar.js`) → le graphique se met à jour live à chaque modification d'horaire dans la sim.
- **Couleurs cohérentes** avec le graphique de l'horaire : Lun violet, Mar teal, Mer bleu, Jeu rouge, Ven jaune, Sam vert, Dim orange.
- **CACHE_VERSION** bumpé à `v3.10.6`

### 12 mai 2026 — Sim : Mt/jour + Ventes prévues + Ratio salaires (v3.10.5) 💰📊
- **Nouveau tfoot dans le tableau de simulation** (3 lignes, comme dans Employés & Horaires) :
  - **Heures / jour** : total des heures travaillées chaque jour ouvert
  - **Mt / jour** : coût salarial brut par jour (salariés au prorata du nb de jours ouverts, horaires × taux pour les autres)
  - **Ventes prévues** : Mt/jour ÷ ratio salaires/ventes — sert à projeter les ventes nécessaires pour respecter le ratio cible
- **Nouveau paramètre dans « Paramètres globaux »** : champ `Ratio salaires / ventes (%)` (défaut 32%, modifiable) avec hint « Base : X% · Cible <32% ». Stocké dans `simulation.salesRatio` + `baseline.salesRatio` (snapshot du `scheduleSettings.salesRatio` lors de la création).
- **`computeSimScenario`** étendu pour retourner `dayTotalsHours[7]` et `dayTotalsCost[7]` (indexés 0=Lun..6=Dim, 0 pour jours non ouverts). Logique salariés alignée avec `pages-hr.js` (coût hebdo fixe réparti sur les jours ouverts).
- **`createSimFromPlanned`** snapshoote maintenant aussi `salesRatio` dans le baseline.
- Nouvelle fonction `updateSimSalesRatio(simId, percentStr)`.
- **CACHE_VERSION** bumpé à `v3.10.5`

### 12 mai 2026 — Hauteur uniforme taux/section (v3.10.4) 📏
- **Sim** : `height:24px` + `box-sizing:border-box` + `line-height:1` forcés sur `.sim-rate-input` ET `.sim-section-select` pour qu'ils s'alignent parfaitement côte à côte (avant : hauteur dépendait du browser/UA-styles).
- **CACHE_VERSION** bumpé à `v3.10.4`

### 12 mai 2026 — Cellule employé sim ultra-compacte (v3.10.3) 📏
- **Page Simulation paie — cellule employé compactée drastiquement** :
  - Retrait de l'icône `$` et du label `$/h` (info implicite — pas besoin de la rappeler)
  - Retrait des "mini-fields" englobants (`.sim-mini-field`) avec leur padding et bordure interne
  - Remplacé par : input taux direct (`.sim-rate-input`) + select section direct (`.sim-section-select`), sans wrapper
  - Largeur colonne emp : **220px → 160px** (gain de 60px de largeur pour les colonnes jours)
  - min-height ligne : 48px → 44px
  - Spinners natifs cachés sur l'input taux (`-webkit-appearance:none`)
  - Chevron du select customisé en SVG inline pour gagner ~10px (vs chevron natif)
  - Min-width table : 1100px → 1000px
- **CACHE_VERSION** bumpé à `v3.10.3`

### 12 mai 2026 — Refonte UI Salaires & Simulation (v3.10.2) 🎨🔧
- **Page Salaires & Pourboires** :
  - **Retrait des badges « Auto-importé »** dans chaque cellule (bruit visuel énorme). L'info reste accessible via le tooltip de la cellule + le fond bleuté discret.
  - **Inputs `type="time"` compactés** : retrait de l'icône native d'horloge Webkit (`::-webkit-calendar-picker-indicator { display:none }`), retrait des spinners, police 13px mono, centré, padding 3px×2px. Largeur min réduite à 54px.
  - **Cellule « Réel / Planif » sur une ligne** : `12.5h / 14h` au lieu d'empilé. Police 14px pour le réel, 10px mono pour le planifié.
  - **Bug visuel « +H » corrigé** : quand l'écart est zéro, on affiche `=` (vert) ou `—` au lieu d'un `+H` orphelin.
  - **Badges cuisine/service** plus discrets (9px, padding 1×5).
  - **Pourboire du jour** rendu discret (9px mono, sans fond) — l'info reste lisible sans dominer la cellule.
  - **Largeur min table** = 1100px → scroll horizontal propre au lieu de chevauchement.
- **Page Simulation paie** :
  - **KPI tuiles** : valeur descendue de 28px à 22px pour respiration.
  - **Cellule employé** compactée : nom 14px, taux+section mini-fields 10-11px avec padding 2×5.
  - **Hauteur de ligne** auto avec min-height 48px (au lieu de fixe 42px) pour accueillir nom + champs.
  - **Largeur min table** = 1100px.
  - **Toast d'erreur clair** si les règles Firestore `/payrollSimulations` ne sont pas publiées (`permission-denied` → message « ⚠ Règles Firestore manquantes… ») : aide l'admin à diagnostiquer le bug « sim disparaît au reload ».
- **CACHE_VERSION** bumpé à `v3.10.2`

### 12 mai 2026 — Fix race condition au démarrage + tableaux compacts (v3.10.1) 🐞🔠
- **Fix bug critique** : à l'ouverture de l'app, les données n'apparaissaient pas tant qu'on ne rechargeait pas la page manuellement. Cause : les listeners Firestore avec filtre `if (isLoggedIn && activePage === "X")` ne déclenchaient pas de render si leur snapshot arrivait APRÈS `applyLogin` et que la page active (souvent `dashboard`) ne matchait pas le filtre. Beaucoup de listeners (`expenses`, `revenues`, `tasks`, `menuItems`, `fixedExpenseTemplates`) étaient concernés.
- **Solution** : nouveau helper `shouldRender(collKey, ...activePages)` qui retourne toujours `true` au PREMIER snap de chaque collection (peu importe la page), puis applique le filtre habituel pour les snaps suivants. Ajout d'un Set global `_firstSnapshots` dans `state.js`, reset au logout dans `auth.js`.
- **Filtres `activePage` élargis** au passage : `employees` re-render aussi sur `salaires`/`simulations`/`dashboard` ; `expenses`/`revenues` re-render aussi sur `dashboard`/`taxes` ; `tasks`/`menuItems` re-render aussi sur `dashboard`.
- **Tableau Horaire + Simulation rendus plus compacts** :
  - Police descendue de `var(--fs-lg)` (18px) à `var(--fs-base)` (14px) sur : nom employé, heures (Entr/Sort), résumés (Heures/Taux/Total), tfoot (Heures/jour, Mt/jour, Ventes…)
  - Ligne Écart KPI : 20px → 16px (`var(--fs-md)`) pour rester légèrement plus gros que le reste
  - Hauteur de ligne 54px → 42px pour suivre la nouvelle taille
  - Mobile (≤900px) : hauteur 48px → 38px, polices `fs-md` → `fs-sm` (13px)
  - Sim : `.sim-input-name` 16px → 14px pour cohérence
- **CACHE_VERSION** bumpé à `v3.10.1`

### 12 mai 2026 — Simulation paie (v3.10.0) 📈🧮
- **Nouvelle page Simulation paie** sous Salaires & Pourboires (admin seulement)
- **Modèle de données** : nouvelle collection Firestore `payrollSimulations` avec `baseline` (snapshot figé du planifié) + `simulation` (copie modifiable)
- **Nouveau fichier** `js/pages-simulations.js` (~600 lignes) avec :
  - `renderSimulations()` : liste des scénarios sauvegardés (cartes avec comparaison rapide réel/sim + écart $)
  - `renderSimulationEditorHTML()` : éditeur complet d'une simulation (KPI + paramètres globaux + tableau employés + comparaison)
  - `computeSimScenario()` : calculs de salaires + pourboires (réutilise `hoursFromShift`, `intersectShiftHours`)
  - `createSimFromPlanned()` : snapshot depuis horaire planifié courant — conversion shifts par date → par index de jour de semaine (0=Lun..6=Dim)
  - CRUD complet : créer, modifier, dupliquer, réinitialiser au baseline, supprimer
  - Ajout/retrait d'employés fictifs (badge FICTIF / RETIRÉ / AJOUTÉ)
  - Édition de nom, taux, section, heures par jour, pourboires, parts cuisine/service, heures de service, jours ouverts
- **Sidebar** : nouvelle entrée « Simulation paie » sous Salaires (icône `trending-up`)
- **Permissions** : `simulations` ajouté à `ROLE_PERMISSIONS.global_admin.canAccess/canWrite`
- **Firestore rules** : règle `/payrollSimulations/{doc=**}` admin only (contient données financières + identité employés)
- **Listener Firestore** dans `firebase-listeners.js` avec préservation du focus dans l'éditeur (sinon perte de saisie après chaque update)
- **Reset automatique** de `_editingSimId` dans `navTo()` → clic sidebar « Simulation paie » = retour à la liste
- **CSS** : ~350 lignes (cartes de simulation, KPI tuiles, tableau côte à côte avec colonnes teintées, badges FICTIF/RETIRÉ/AJOUTÉ, dark mode adapté, responsive 900px / 640px)
- **Code couleur sémantique** : coûts qui montent = rouge, qui baissent = vert ; heures et pourboires qui montent = vert
- **Persistance multi-scénarios** : plusieurs simulations peuvent coexister, chacune avec son baseline figé
- **Indépendance temporelle** : shifts stockés par jour de semaine (0..6), pas par date → la sim n'est pas attachée à une semaine particulière
- **CACHE_VERSION** bumpé à `v3.10.0` + `pages-simulations.js` ajouté à l'app shell du SW

### 11 mai 2026 — Tableau uniforme + taille 18px (v3.9.3) 📐
- **Toutes les lignes employés à la MÊME HAUTEUR** : `height: 54px` sur `.schedule-emp-row` + `.schedule-emp-row td` (peu importe le contenu)
- **Toutes les colonnes d'heures (entrée/sortie) à la MÊME LARGEUR** : `width: 64px` strict
- **`table-layout: fixed`** activé sur la table → les largeurs déclarées sont respectées strictement (avant : auto-resize selon contenu)
- **Tailles descendues à `var(--fs-lg)` = 18px** uniformément (nom employé, heures, summary, total, footer)
- Largeurs ajustées :
  - Colonne employé : 170 → **150 px**
  - Colonnes entrée/sortie : 64 px (uniforme)
  - Colonnes summary : 80 → **70 px**
  - Min-width select heure : 72 → **60 px**
  - Table min-width : 980 → **920 px**
- Mobile : tout à `var(--fs-md)` (16px), height 48px, colonnes entrée/sortie 58px, employé 130px
- Bumper `CACHE_VERSION` à `v3.9.3`

### 11 mai 2026 — Tailles redescendues à 22px (28px coupait les heures) (v3.9.2) 📐
- 28px était trop gros : les heures « HH:MM » étaient coupées en « 11:0 » dans les cellules entrée/sortie
- **Tout redescendu à `var(--fs-xl)` (22px)** uniformément :
  - Nom employé, heures entrée/sortie (selects), Heures/Taux/Total, totaux footer — toutes au même format **22px**
- Largeurs ajustées en conséquence :
  - Colonne employé : 200 → **170 px**
  - Min-width select heure : 80 → **72 px** (juste assez pour « 22:00 » à 22px mono)
  - Largeur colonne summary : 96 → **80 px**
  - Table min-width : 1100 → **980 px**
- Mobile : tout à `var(--fs-lg)` (18px) avec colonnes proportionnellement réduites
- Bumper `CACHE_VERSION` à `v3.9.2`

### 11 mai 2026 — Cellule employé simplifiée + tout à 28px (v3.9.1) 🔠
- **Cellule employé simplifiée** dans la grille horaire :
  - Avant : grip + nom + pill section (Cuisine/Service/Autre) + rôle
  - **Après : grip + nom seulement** — interface plus épurée et plus lisible
  - (les sections + rôles restent éditables via la modale Fiche employé, juste pas affichés dans le tableau)
- **TOUS les chiffres et le nom de l'employé au même format** que la cellule Total : **`var(--fs-2xl)` = 28px**
  - `.schedule-emp-name` : `fs-lg` (18) → **`fs-2xl` (28)** + `font-weight: 700`
  - `.schedule-time` : `fs-lg` (18) → **`fs-2xl` (28)**, min-width 66 → 80px
  - `.schedule-td--summary` (Heures/Taux/Total) : déjà à 28px
  - `.schedule-td--total` : déjà à 28px
  - `.schedule-tfoot-val` : `fs-xl` (22) → **`fs-2xl` (28)**
  - `.schedule-tfoot-row td` : `fs-xl` (22) → **`fs-2xl` (28)**
- **Grip drag&drop** : icône passée de 14px → 16px pour rester proportionné
- **Largeur table min** : 920 → **1100 px** (la colonne employé est à 200px minimum)
- **Mobile** : tout à `var(--fs-xl)` (22px) — taille moyenne pour rester lisible sur petit écran sans casser le scroll horizontal. Table min-width 820 → 980 px
- Bumper `CACHE_VERSION` à `v3.9.1`

### 11 mai 2026 — Padding réduit + chiffres encore plus gros (v3.9.0) 📏
- **Padding aggressivement réduit** dans les cases d'heures pour libérer l'espace :
  - `.schedule-table td/th` : `6px 4px` → **`3px 4px`** (vertical divisé par 2)
  - `.schedule-td--cell` : `2px` → **`1px`**
  - `.schedule-time` (select) : `6px 2px` → **`1px 1px`** + `line-height:1.1` pour rendu compact
- **`.schedule-time` agrandi** : `fs-md` (16px) → **`fs-lg` (18px)**
- Mobile : `.schedule-time` aussi mis à `fs-md` (16px) avec mêmes paddings réduits
- Bumper `CACHE_VERSION` à `v3.9.0`

### 11 mai 2026 — Numéros encore plus gros (v3.8.9) 🔢
- Chaque taille du tableau Employés montée d'un cran supplémentaire :
  - `.schedule-time` (heures entrée/sortie) : `fs-base` (14px) → **`fs-md` (16px)**
  - `.schedule-td--summary` (Heures / Taux / Total) : `fs-xl` (22px) → **`fs-2xl` (28px)**
  - `.schedule-td--total` : `fs-xl` (22px) → **`fs-2xl` (28px)**
  - `.schedule-tfoot-val` (totaux par jour) : `fs-lg` (18px) → **`fs-xl` (22px)**
  - `.schedule-tfoot-row td` (label de ligne foot) : `fs-lg` (18px) → **`fs-xl` (22px)**
- Largeurs ajustées : colonne summary 84 → **96 px**, min-width des selects time 60 → **66 px**
- Mobile : pareil, un cran de plus partout — table min-width 780 → 820 px
- Bumper `CACHE_VERSION` à `v3.8.9`

### 11 mai 2026 — 2 couleurs vives qui contrastent (v3.8.8) 🟡🔵
- **Retour à 2 couleurs distinctes** au lieu de 2 tons d'une même couleur :
  - Lignes paires (0, 2, 4...) → **jaune Bochica** `#F7B32C` (`247,179,44`)
  - Lignes impaires (1, 3, 5...) → **bleu Colombie** `#4a90e2` (`74,144,226`)
- **Opacités vives** (0.45 base, 0.65 total) pour que les couleurs ressortent bien sans masquer le texte
- **Hover** : 0.60 / 0.80 — la ligne survolée s'illumine clairement
- **Uniformité par ligne maintenue** : toutes les cellules d'une même ligne ont exactement la même couleur, peu importe si remplie ou vide
- **CSS simplifié** : les sélecteurs `.is-odd` / `.is-even` sont retirés (la couleur RGB est injectée directement par le JS via `--emp-rgb`)
- Bumper `CACHE_VERSION` à `v3.8.8`

### 11 mai 2026 — Jaune plus vif, alternance plus marquée (v3.8.7) 🟨
- Opacités du zébré employés **rehaussées** pour mieux voir la différence entre les 2 tons :
  - Ton foncé : 0.22 → **0.38**
  - Ton clair : 0.08 → **0.15**
  - Cellule total (foncé) : 0.35 → **0.55**
  - Cellule total (clair) : 0.20 → **0.32**
  - Hover foncé : 0.35 → **0.52**
  - Hover clair : 0.18 → **0.28**
- Dark mode ajusté proportionnellement (0.40 / 0.18 / 0.58 / 0.35)
- Bumper `CACHE_VERSION` à `v3.8.7`

### 11 mai 2026 — Zébré jaune Bochica uniforme (v3.8.6) 🟡
- **Couleur** : retour au **jaune Bochica `247,179,44`** (l'accent de marque) au lieu du gris
- **Uniformité par ligne** : toutes les cellules d'une même ligne ont maintenant la **même opacité** — peu importe si la cellule contient des heures (`.is-filled`) ou non
  - Avant : la cellule remplie était plus foncée que la vide → effet "tache" sur la ligne
  - Après : ligne entière du même ton → effet zébré franc et lisible
- **2 tons d'opacité** :
  - Ligne impaire (`.is-odd`) — ton foncé : opacité 0.22
  - Ligne paire (`.is-even`) — ton clair : opacité 0.08
- **Cellule TOTAL** (la dernière colonne) : légèrement plus marquée (0.35 / 0.20) pour rester un point d'ancrage visuel
- **Hover** : ligne entière s'illumine en même couleur (0.35 / 0.18) — pas de variation par cellule
- **Dark mode** : opacités calibrées (0.25 / 0.10) — le jaune accent reste visible sur fond sombre
- Bumper `CACHE_VERSION` à `v3.8.6`

### 11 mai 2026 — Zébré 1 couleur 2 tons + chiffres plus gros (v3.8.5) ⚫⚪
- **Tableau Employés & Horaires** : passage à un **vrai zébré** sur une seule couleur (gris noir chaud `14,13,12`) avec deux opacités différentes :
  - Lignes impaires (`.is-odd`) — ton plus foncé : opacités 0.06 / 0.10 / 0.14 / 0.18 (cellule / emp+summary / total / filled)
  - Lignes paires (`.is-even`) — ton plus clair : opacités 0.02 / 0.04 / 0.08 / 0.12
  - Plus de couleur de marque par ligne — sobre et professionnel
- **Hover** : utilise maintenant l'accent jaune Bochica (`rgba(var(--accent-rgb), .14)` → `.25` selon cellule) pour bien signaler la ligne survolée sans rendre le tableau bruyant
- **Bande latérale colorée à gauche retirée** (`border-left-color: transparent !important`) — l'identification par employé se fait uniquement par leur nom maintenant
- **Chiffres plus gros et plus foncés** dans tout le tableau :
  - `.schedule-time` (heures entrée/sortie) : `var(--fs-sm)` → `var(--fs-base)` (13 → 14px), `font-weight: 700`, font-family JetBrains Mono pour meilleure lisibilité numérique
  - `.schedule-td--summary` (Heures / Taux / Total) : `var(--fs-lg)` → `var(--fs-xl)` (18 → 22px), `font-weight: 700`, largeur 78 → 84px
  - `.schedule-td--total` (cellule total payé) : `font-weight: 600` → `800` (extra-bold), couleur noir chaud au lieu de jaune pour meilleur contraste
  - `.schedule-tfoot-val` (totaux par jour en bas) : `var(--fs-md)` → `var(--fs-lg)` (16 → 18px), `font-weight: 700`
- **Mobile** : tailles ajustées en proportion (`fs-md` → `fs-lg` pour summary, ajout de `font-weight: 700` sur `.schedule-time` et `.schedule-tfoot-val`)
- **Dark mode** : opacités calibrées avec `245,241,232` (crème) à la place de `14,13,12` (noir) pour le bon contraste sur fond sombre
- JS : nouvelle class `is-odd` / `is-even` injectée sur `<tr>` selon `rowIdx % 2`
- Bumper `CACHE_VERSION` à `v3.8.5`

### 11 mai 2026 — Palette Employés simplifiée (v3.8.4) 🎨
- **Tableau Employés & Horaires** : palette `EMP_RGB` réduite de **8 couleurs → 2 couleurs** en alternance
  - Avant : bleu, jaune, rouge, vert, violet, orange, teal, rose (cyclées sur `sortOrder`)
  - Après : **jaune Bochica `247,179,44`** + **bleu Colombie `74,144,226`** alternés par `rowIdx % 2`
- Effet zébré sobre, cohérent avec la marque (les 2 couleurs principales du design system)
- Alternance basée sur la position visible (rowIdx) plutôt que sur `sortOrder` → reste cohérente après réordonnement drag & drop
- Aucun changement CSS requis : les rules `.schedule-emp-row .schedule-td--*` utilisent déjà `rgba(var(--emp-rgb), ...)` avec opacités calibrées qui fonctionnent avec les nouvelles couleurs
- Le graphique de couverture horaire (`DAY_COLORS`) garde ses 7 couleurs distinctes — nécessaires pour distinguer les courbes des 7 jours superposés
- Bumper `CACHE_VERSION` à `v3.8.4`

### 11 mai 2026 — QR code vers le menu en ligne (v3.8.3) 📱
- Nouveau bloc dans le footer du PDF de soumission :
  - **QR code 26×26 mm à gauche** pointant vers `https://bochicacafebistro.ca/`
  - Titre **« Consultez notre menu en ligne »**
  - Sous-titre **« Scannez ce code QR avec votre téléphone ou visitez : »**
  - URL en **jaune/accent** cliquable (textWithLink jsPDF)
  - Note **« Découvrez tous nos plats colombiens authentiques. »**
  - Ligne séparatrice avant les mentions légales (pourboire / taxes / validité)
- Nouvelle lib externe : **`qrcode-generator@1.4.4`** chargée via CDN dans `index.html` (defer)
- Nouveau helper **`drawQRCode(doc, text, x, y, sizeMm)`** dans `pages-quotes.js` :
  - QR vectoriel — chaque module dessiné comme un petit rectangle noir via `doc.rect()`
  - Rendu parfait à l'impression (pas de raster, pas de pixellisation)
  - Fallback gracieux : si la lib n'est pas chargée, le PDF est généré sans QR mais le reste fonctionne
  - Fond blanc derrière le QR pour assurer la lisibilité sur le fond crème
- Bumper `CACHE_VERSION` à `v3.8.3`

### 11 mai 2026 — Fix PDF : totaux + apostrophes + mention pourboire (v3.8.2) 🔧
- **Validation `guestCount ≥ 1`** ajoutée à `saveQuote()` — empêche de sauver une soumission avec 0 personnes (qui donnait des totaux à 0,00 $ dans le PDF). Champ rendu `required` dans le formulaire.
- **Bug `\'essentiel` corrigé** : `esc()` de utils.js utilise `\\\'` pour échapper l'apostrophe (correct pour les onclick mais visible dans les inputs HTML). Solution locale à `pages-quotes.js` :
  - Nouveau helper **`attrEsc(s)`** : échappement HTML correct avec `&#39;` pour les apostrophes — utilisé pour TOUS les `value="..."` et `placeholder="..."` des modales soumission/forfaits
  - Nouveau helper **`pdfStr(s)`** : retire `\'` → `'` et `&quot;` → `"` — appliqué :
    - à toutes les valeurs lues du formulaire dans `saveQuote()` et `saveTemplate()` (nettoyage avant sauvegarde → BD propre)
    - à tous les textes affichés dans `generateQuotePDF()` (forfait, client, événement, custom lines, notes)
    - aux libellés des cartes de soumission dans la liste
  - Les valeurs en BD sont progressivement nettoyées à chaque sauvegarde
- **Mention pourboire/service** ajoutée au footer PDF :
  - Ligne **rouge en gras** : « Le service (pourboire) n'est pas inclus dans les montants ci-dessus. »
  - Suivie de la mention des taxes (TPS 5 % + TVQ 9,975 %) et de la date de validité
- Bumper `CACHE_VERSION` à `v3.8.2`

### 11 mai 2026 — Fix bière + prix éditable par soumission (v3.8.1) 🍺
- **Bug PDF corrigé** : l'emoji 🍺 s'affichait comme « Ø<ßz » dans le PDF (jsPDF helvetica ne supporte pas l'Unicode > Latin-1). Remplacé par un cercle décoratif dessiné + texte ASCII pur
- **Wording corrigé** : « Ajout d'une bière » → « **Boisson remplacée par une bière** » (c'est une substitution, pas un ajout au menu existant)
- **Prix bière éditable par soumission** : nouveau champ « Prix de la bière par personne » dans le formulaire de soumission, sous la case à cocher
  - Pré-rempli automatiquement avec le `beerPrice` du forfait sélectionné
  - Se met à jour quand on change de forfait (sauf si l'utilisateur l'a modifié manuellement — détecté via `data-touched`)
  - Permet d'offrir un rabais ponctuel (ex. 5,00 $ au lieu de 7,00 $)
  - Stocké dans `packageSnapshot.beerPrice` pour conservation historique
- Modale **Gérer les forfaits** : label précisé « Prix par défaut bière de substitution » + texte d'aide
- CSS : nouveau bloc `.quote-beer-block` enveloppant le toggle + champ prix avec hint italique

### 11 mai 2026 — Soumissions + génération PDF (v3.8.0) 🧾📄
- Nouvelle page **Soumissions** (admin seulement) avec CRUD complet sur les devis clients
- Nouveau module `js/pages-quotes.js` (~570 lignes) :
  - `renderQuotes()` — liste des soumissions avec onglets statut + recherche
  - `renderQuoteCards()` — cartes avec n° soumission, total, client, événement, actions
  - `openQuoteModal()` / `saveQuote()` — formulaire complet (client / événement / forfait radio / lignes custom / dépôt / validité / statut)
  - `openQuoteTemplatesModal()` — gestion des forfaits éditables (ajouter / modifier / supprimer)
  - `generateQuotePDF()` — génération PDF jsPDF style Bochica (~200 lignes de dessin)
  - `computeQuoteTotal()` — calcul sous-total + TPS + TVQ + dépôt + solde
  - `generateQuoteNumber()` — numérotation auto YYYY-NNN
  - Helpers : `tQuoteStatus()`, `tQuoteVenue()`, `quoteAccentHex()`, `seedQuoteTemplates()`
- **Nouvelle collection `quotes`** (admin only) + **`quoteTemplates`** (admin write + chef read)
- **Seed automatique** : `DEFAULT_QUOTE_TEMPLATES` dans `config.js` → 2 forfaits créés au 1er lancement (L'Essentiel 22$ jaune, Le Gourmand 27$ rouge, bière +7$) — calqués sur `Menu_Forfaits.pdf`
- **Snapshot du forfait** : chaque soumission enregistre une copie figée du forfait → modifier un template ne casse pas les anciennes soumissions/PDF
- **Génération PDF (jsPDF)** : reproduction fidèle du style Menu_Forfaits.pdf
  - Logo BOCHICA + sous-titre + tricolore jaune/bleu/rouge centré
  - Titre Soumission + n°
  - 2 blocs info (Client + Événement) côte à côte sur fond crème
  - Carte forfait avec barre latérale colorée selon `accentColor`, prix par personne en rouge, séparateur pointillé, bullets bleus
  - Section bière en jaune si activée
  - Lignes custom (rabais en vert)
  - Calcul détaillé sous-total → taxes → total → dépôt → solde
  - Footer « Soumission valide jusqu'au … »
- **5 statuts** : brouillon (gris) · envoyée (bleu) · acceptée (vert) · refusée (rouge, atténué) · expirée (ambre, atténué)
- **Numérotation YYYY-NNN** calculée à partir des soumissions existantes de l'année
- **Lignes personnalisées dynamiques** : ajout/retrait à la volée, support montants négatifs (rabais)
- **Règles Firestore** : `match /quotes/{doc=**}` admin only, `match /quoteTemplates/{doc=**}` admin write + chef read
- **Permissions** : ajout de `"soumissions"` à `ROLE_PERMISSIONS.global_admin` seulement
- **Sidebar** : nouvel item « Soumissions » sous Événements (icône `receipt`)
- **Duplication** intégrée à `DUPLICATE_CONFIG` (collection `quotes`)
- **CSS** : ~360 lignes ajoutées (`.quote-tabs`, `.quote-card`, `.quote-status-pill--{status}`, `.quote-package-card--{color}`, `.quote-tpl-editor`, etc.) — dark mode adapté, responsive mobile
- Bumper `CACHE_VERSION` à `v3.8.0` + ajout de `pages-quotes.js` à l'app shell

### 11 mai 2026 — Types d'événements étendus (v3.7.1) 🎤🎵
- **`EVENT_TYPES` passe de 4 à 6 valeurs** : `reservation`, `karaoke`, `spectacle`, `hors_bochica`, `ferie`, `interne`
- Ancien type `special` retiré (rétrocompat conservée dans `tEventType`, `tEventTypeShort`, `eventTypeIcon` et le CSS au cas où des événements en base utilisent encore ce slug)
- **3 nouvelles icônes** ajoutées à `icons.js` : `mic` (karaoké), `music` (spectacle), `map-pin` (hors Bochica)
- **3 nouveaux tokens CSS** : `--ev-karaoke` (#a855f7 violet), `--ev-spectacle` (#f97316 orange), `--ev-hors-bochica` (#64748b slate) avec variantes `*-soft` et adaptations dark mode
- Variantes ajoutées partout : `.ev-cal-pill--{karaoke,spectacle,hors_bochica}`, `.ev-type-pill--{...}`, `.ev-type-tab--{...}.is-active`, `.ev-card--{...}`, `.ev-legend-dot--{...}`
- Légende du calendrier mise à jour avec les 6 types
- `renderEvents()` : comptes par type calculés dynamiquement via `EVENT_TYPES.forEach` (plus de hardcoding)
- Bumper `CACHE_VERSION` à `v3.7.1`

### 11 mai 2026 — Événements / Calendrier (v3.7.0) 📅
- Nouvelle page **Événements** sous Liste d'ingrédients (admin + chef)
- Nouveau module `js/pages-events.js` (~470 lignes) :
  - `renderEvents()` — switcher de vue (calendrier / mois / à venir) + filtre type + recherche
  - `renderEventCalendar()` — grille 7×6 cases (42), navigation mois prev/next, click case vide → créer événement à cette date, max 3 pills par case + « +N autres », jour courant en pill jaune
  - `renderEventMonthList()` — liste chronologique des événements du mois (filtré)
  - `renderEventUpcoming()` — liste chronologique des 30 prochains jours
  - `openEventModal()` / `saveEvent()` — CRUD complet avec validation type/statut
  - Helpers : `todayISO()`, `isoToLocalDate()`, `daysBetween()`, `formatRelativeDate()`, `formatLongDate()`, `tEventType()`, `tEventTypeShort()`, `tEventStatus()`, `eventTypeIcon()`
- **Nouvelle collection Firestore `events`** : `id`, `name`, `date`, `time`, `type` (4 valeurs fixes), `status` (3 valeurs fixes), `capacity`, `contactName`, `contactPhone`, `contactEmail`, `notes`, `createdAt`, `updatedAt`
- **4 types fixes** (couleurs vives) : reservation (#4a90e2 bleu), special (#F7B32C jaune accent), ferie (#e74c3c rouge), interne (#7dbf66 vert)
- **3 statuts** : confirme (vert), attente (jaune ambré, italique), annule (rouge, barré)
- **Widget dashboard** : `renderDashUpcomingEvents()` affiche les 5 prochains événements à venir (60 jours, hors annulés) avec pill type + date relative
- **Règle Firestore** : `match /events/{doc=**}` lecture authentifiée + écriture admin/chef
- **Permissions** : ajout de `"evenements"` à `ROLE_PERMISSIONS.global_admin` et `.chef`
- **Sidebar** : nouvel item « Événements » sous Liste d'ingrédients (icône `calendar`)
- **Duplication** intégrée à `DUPLICATE_CONFIG` (collection `events`)
- **CSS** : ~460 lignes ajoutées (`.ev-calendar`, `.ev-calendar__grid`, `.ev-cal-pill--{type}`, `.ev-card`, `.ev-type-pill--{type}`, `.ev-status-pill--{status}`, `.ev-views`, `.ev-type-tabs`, etc.) — couleurs vives par type, dark mode adapté, responsive mobile (cases compactes, heure cachée sur mobile)
- Tokens CSS dédiés : `--ev-reservation`, `--ev-special`, `--ev-ferie`, `--ev-interne` (+ variantes `*-soft`)
- Bumper `CACHE_VERSION` à `v3.7.0` + ajout de `pages-events.js` à l'app shell

### 4 mai 2026 — Liste d'ingrédients (v3.6.0) 🛒
- Nouvelle page **Liste d'ingrédients** sous Recettes (admin + chef)
- Nouveau module `js/pages-shopping.js` (~300 lignes) :
  - `renderShoppingList()` — vue avec onglets fournisseurs, recherche texte, tri (fournisseur/nom), groupement automatique par fournisseur en mode tri
  - `openShoppingModal()` / `saveShoppingItem()` — CRUD complet
  - Helpers `tShoppingSupplier()` / `tShoppingCategory()` pour libellés FR
- **Nouvelle collection Firestore `shoppingList`** : items avec `name`, `supplier` (3 valeurs fixes), `category` (5 valeurs fixes), `notes`, `createdAt`, `updatedAt`
- **3 fournisseurs fixes** : Costco (#4a90e2 bleu), Viandex (#e74c3c rouge), Gordon (#7dbf66 vert)
- **5 catégories** : Protéine, Légume, Produit laitier, Épicerie, Autre
- **Filtres** :
  - Onglets fournisseurs (Tous + 3 fournisseurs) avec compteurs et couleur active vive
  - Recherche texte (nom + notes) avec focus préservé entre frappes
  - Sélecteur de tri : par fournisseur (groupé en sections) ou par nom A→Z
- **Vue desktop** : tableau avec bande colorée gauche selon fournisseur ; sections séparées par titre coloré quand groupé
- **Vue mobile** : cartes avec bord coloré gauche, pills fournisseur+catégorie, notes en italique
- **Duplication** intégrée à `DUPLICATE_CONFIG` (collection `shoppingList`)
- **Règle Firestore** : `match /shoppingList/{doc=**}` lecture authentifiée + écriture admin/chef
- **Permissions** : ajout de `"shopping"` à `ROLE_PERMISSIONS.global_admin` et `.chef`
- **Sidebar** : nouvel item « Liste d'ingrédients » sous Recettes (icône `cart`)
- **CSS** : ~300 lignes ajoutées (`.shopping-tabs`, `.shopping-pill--{costco,viandex,gordon}`, `.shopping-cat-pill--{cat}`, `.shopping-section`, `.shopping-row-mobile`, etc.) — couleurs vives propres à chaque fournisseur, dark mode adapté
- Bumper `CACHE_VERSION` à `v3.6.0` + ajout de `pages-shopping.js` à l'app shell

### 3 mai 2026 — Salaires & Pourboires v2 (v3.4.1) 💵
- **Inputs `<input type="time">`** à la place des selects 30 min : saisie précise à la minute près (ex. 13h17)
- **Pourboires par jour** : grille de 7 inputs (un par jour ouvert) au lieu d'un seul total ; le total semaine se calcule automatiquement (`tipsByDay: {dk: amount}` dans Firestore)
- **Comparaison planifié vs réel** :
  - Colonne « Réel / Planifié » dans le résumé de chaque ligne (ex. `25h / 23h`)
  - Nouvelle colonne « Écart » avec couleur (vert/rouge) et flèche ▲/▼
  - Hint planifié `📅 P:13:00→22:00` affiché sous l'input quand pas encore de saisie réelle
  - Indicateur visuel (cellule ambrée + barre latérale jaune) quand l'heure réelle diffère du planifié
- **Heures de service** déplacées en config globale (settings/payroll.defaultServiceHours par jour de semaine 0-6) :
  - Modifiables n'importe quand via la nouvelle modale « Heures de service »
  - S'appliquent automatiquement à toutes les semaines (passées et futures)
  - Affichées en sous-titre dans l'entête de chaque colonne jour
- **Bouton « Copier → S{n+1} »** : nouvelle action `duplicatePayrollToNextWeek()` qui copie actualShifts + tipsByDay vers la semaine suivante (remappage des clés de date), avec confirmation si la cible contient déjà des données
- Suppression de la carte « Heures de service » de la page principale (remplacée par la modale)
- Suppression du champ unique `totalTips` (remplacé par `tipsByDay` ; rétrocompat pour anciennes semaines)
- Bumper `CACHE_VERSION` à `v3.4.1`

### 3 mai 2026 — Salaires & Pourboires (v3.4.0) 💵
- Nouvelle page **Salaires & Pourboires** sous Employés & Horaires (admin seul)
- Nouveau module `js/pages-payroll.js` (~470 lignes) :
  - `renderSalaires()` — vue hebdomadaire avec sélecteur de semaine, fenêtre de service, total pourboires, pools cuisine/service, tableau heures réelles + salaires + pourboires
  - Helper `intersectShiftHours(shift, window)` — calcule l'intersection entre un shift et la fenêtre de service du jour (gère les chevauchements de minuit)
  - `getActualShift(empId, dk)` — fallback automatique sur l'horaire planifié si pas encore de saisie réelle
  - `subscribePayrollWeek()` — listener Firestore dynamique abonné/désabonné à chaque changement de semaine
- **Nouvelle collection Firestore `payroll`** : un doc par semaine ISO (`YYYY-Www`) avec `totalTips`, `serviceHours`, `actualShifts` (séparés des shifts planifiés)
- **Nouveaux settings `settings/payroll`** : `tipShares` (cuisine 25% / service 75% par défaut) + `defaultServiceHours`
- **Règles Firestore** : `match /payroll/{doc=**}` admin only
- Calcul automatique :
  - Salaire = heures réelles × taux (ou heures fixes × taux pour les salariés)
  - Pool cuisine = `totalTips × 0.25` réparti au prorata des heures de service des employés cuisine
  - Pool service = `totalTips × 0.75` réparti au prorata des heures de service des employés service+other
  - Badge ★ visible sur les cellules où la fenêtre de service ne couvre pas tout le shift
- Modale « Répartition » pour ajuster les % cuisine/service (validation : somme = 100%)
- Bouton « Reprendre du planifié » : initialise les heures réelles avec l'horaire planifié de la semaine
- Bumper `CACHE_VERSION` à `v3.4.0` + ajout de `pages-payroll.js` à l'app shell

### 24 avril 2026 — Cohérence design + fix bugs (v3.2.1 → v3.3.0) 🎨
- **2 bugs pré-existants corrigés** (v3.2.1) :
  - `autoApplyFixedExpenses` : `t.xxx` → `tpl.xxx` (les frais fixes mensuels s'appliquent maintenant correctement)
  - `openFixedTemplatesModal` : même fix sur la boucle `.map(tpl => …)`
- **Phase 2 du plan d'audit — migration inline styles** (v3.3.0) :
  - 25 nouvelles classes CSS utilitaires : `.text-muted`, `.text-secondary`, `.text-accent`, `.text-danger`, `.text-warning`, `.text-success`, `.text-left/center/right`, `.flex-1`, `.flex-row/col/center/between`, `.items-start/center`, `.gap-1..4`, `.mt-1..4`, `.mb-1..4`, `.fs-xs..lg`, `.font-*`, `.fw-*`, `.w-full`, `.empty-state-icon`, `.item-meta`
  - 6 nouvelles classes spécifiques : `.stats-grid`, `.stat-card` (+ variantes `--red/yellow/green`), `.month-picker`, `.month-picker__btn`, `.month-picker__label`
  - **67 inline styles migrés** vers des classes (282 → 215 restants)
  - Les 215 restants contiennent des valeurs dynamiques (couleurs interpolées, displays toggle, dimensions très spécifiques) — conservés en inline intentionnellement
  - Stats cards inventaire refactorées complètement
  - Sélecteur mois/année des dépenses refactor en `.month-picker`
  - Empty states unifiés via `.empty-state-icon`

### 24 avril 2026 — Refactor code (v3.2.0) 🧱
- **Découpage de `pages-admin.js`** (3570 lignes) en 4 modules par domaine métier :
  - `pages-hr.js` (1018 L) : Employés, Horaires, Coverage chart, imports, salaires fixes
  - `pages-finance.js` (1138 L) : Dépenses, Revenus, Catégories, Frais fixes, Rapports, Charts dépenses
  - `pages-kitchen.js` (737 L) : Menu, Fournisseurs, Ingrédients, Recettes
  - `pages-dashboard.js` (516 L) : Dashboard, Taxes, helpers taxes, autoApplyFixedExpenses
- **Suppression** de `renderMenuAnalysisLEGACY` (~183 lignes de code mort)
- Pas de changement fonctionnel, uniquement réorganisation
- 2 bugs pré-existants détectés (non corrigés, à traiter séparément) :
  - Dans `autoApplyFixedExpenses` : référence `t.supplier` au lieu de `tpl.supplier`
  - Dans `openFixedTemplatesModal` : même confusion `t` (i18n) vs `tpl` (variable)

### 24 avril 2026 — Système de toasts (v3.1.0) 💬
- Nouvelle fonction globale `toast(message, type, duration)` dans `utils.js`
- 35+ appels `alert()` natifs remplacés par des toasts (success/error/warning/info)
- Nouveau conteneur `#toasts` dans `index.html`, styles `.toast*` dans `style.css`
- Animation slide-in/out, auto-dismiss, accessible (`aria-live`, `role="alert"`)
- Position bottom-right desktop, top-full mobile

### 24 avril 2026 — Migration Firebase Auth + règles Firestore (v3.0.0) 🔐
- **Retrait du système SHA-256 côté client** (AUTH_ACCOUNTS, AUTH_SALT, hashPassword, verifyLogin supprimés)
- **Firebase Authentication** (Email/Password provider) pour la gestion des identifiants
- Nouveau mapping `AUTH_USER_EMAILS` dans `config.js` : username → email interne
- **Rôle lu depuis `/users/{uid}.role`** après login (vérifiable côté serveur)
- Nouveau fichier **`firestore.rules`** : protection complète par rôle (global_admin / chef / employee)
- Nouveau fichier **`FIREBASE_AUTH_SETUP.md`** : procédure migration initiale
- `auth.js` refondu : `initAuth()` + `onAuthStateChanged` remplacent `restoreSession()`
- `logout()` utilise `firebase.auth().signOut()`
- Messages d'erreur Firebase mappés en français (user-friendly)
- Anciennes sessions localStorage automatiquement nettoyées au chargement
- SDK `firebase-auth-compat.js` ajouté dans `index.html`

### 23 avril 2026 — Séance d'améliorations (v1.2.0 → v1.4.0)
- **v1.4.0 — Duplication universelle + fermeture dropdowns**
  - Option « Dupliquer » ajoutée dans 11 dropdowns (produits desktop/mobile, recettes, menu, fournisseurs, ingrédients desktop/mobile, employés, dépenses, revenus, tâches)
  - Fonction générique `duplicateItem(collection, id, nameField)` — ajoute « (Copie) », réinitialise timestamps, ajustements par collection
  - Dropdowns ⋯ ferment au clic extérieur + touche Escape (bug corrigé)
  - Nouvelle icône `copy`
- **v1.3.1 — Logo cliquable**
  - Le « BOCHICA » en haut à gauche devient un bouton qui ramène au dashboard (admin) ou inventaire (employé)
  - Logo agrandi : 18px → 36px
  - Suppression des 3 barres tricolore (jaune/bleu/rouge) sous le logo
- **v1.3.0 — Titres agrandis + éditeur markdown recettes**
  - Tailles de titres majorées de ~25% (Bebas étant condensé paraissait trop petit) : h1 48px, h2 38px, h3 28px, topbar 26px, recipe-view title 42px
  - **Éditeur markdown** pour ingrédients, étapes, conseils de recettes : toolbar (gras, italique, barré, listes puces/numérotées) + raccourcis Ctrl/⌘+B et +I
  - Parser markdown sécurisé (anti-XSS) avec rétrocompat auto pour anciennes recettes
  - Nouvelles icônes : bold, italic, list, list-ordered, strikethrough
- **v1.2.1 — Drag & drop catégories**
  - Remplacement des flèches ↑↓ par du drag & drop HTML5 natif
  - Handle `⋮⋮` (grip-vertical) + barre d'insertion jaune lumineuse au-dessus/en-dessous selon la position
  - Champ d'ajout déplacé en haut de la modale
- **v1.2.0 — Alignement design avec le site web (palette Crème Papier)**
  - Palette complètement refondue : bordeaux → jaune impact `#F7B32C`, crème `#f5f1e8`, texte noir chaud `#0e0d0c`
  - Typographie : Fraunces → Bebas Neue pour tous les titres
  - Nouvelle police mono : JetBrains Mono (classe `.kicker`)
  - Login screen : gradient noir → ambre, logo Bebas Neue 52px
  - Graphiques : profit line en jaune, palette doughnut revue
  - PWA : `theme_color` → jaune, `background_color` → crème
  - Ombres dynamiques via `rgba(var(--accent-rgb),...)`
  - `font-synthesis: none` globalement (évite faux bold/italic sur Bebas)
- **v1.1.1 — Recherche corrigée**
  - Bug du champ recherche qui ne prenait qu'un caractère à la fois → focus restauré après chaque renderPage via `requestAnimationFrame`
- **v1.1.0 — Gestion complète des catégories + onglets**
  - Modale « Gérer les catégories » refondue : toutes les catégories (défaut + custom) modifiables, supprimables, réordonnables
  - Schéma Firestore `settings/sections` étendu avec champ `all` (liste unifiée) + rétrocompat avec `custom`
  - Renommage → batch update de tous les produits concernés
  - Suppression → migration auto des produits vers « Autre »
  - Bouton « Voir toutes » sur la barre d'onglets (mode wrap multi-lignes)
  - Fondu aux extrémités du scroll horizontal (indicateur visuel)
  - Ajout de `icons.js` et `i18n.js` dans l'APP_SHELL du service worker

### 18 avril 2026 — Refactoring design + PWA (v1.0.0)
- Design system unifié avec le site web (première version bordeaux + Fraunces)
- CSS externalisé dans `css/style.css` (700+ lignes structurées avec tokens)
- Dark mode on-brand (chaleureux, pas gris bleuté)
- 80 couleurs hardcodées migrées vers tokens CSS dans les modules JS
- PWA installable : manifest.json + sw.js + icônes 192/512
- Login refait avec couleurs Bochica
- Accessibilité : PIN-pad ARIA, landmarks, focus visible, prefers-reduced-motion
- Animations modale : fadeIn + slideUp

## 📝 Reste à faire
- [ ] Optimiser `icon-maskable-512.png` (actuellement copie de icon-512.png — devrait avoir un padding pour la "safe zone" Android)
- [ ] Tester l'installation PWA sur iOS et Android
- [ ] Ajouter une page « À propos » / « Versions » pour suivre les mises à jour
- [ ] Considérer un mode hors ligne avec indication visuelle (badge « offline »)
- [ ] Notifications push (anniversaires employés, frais fixes du mois, etc.)
- [ ] Drag & drop tactile (mobile) pour les catégories — actuellement desktop-only (HTML5 native drag)
- [ ] Migration optionnelle des anciennes recettes (ajout auto des `- ` en base) au lieu du fallback à l'affichage
