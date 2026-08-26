/* ═══════════════════════════════════════════════════════════════
   i18n.js — Système de traduction FR/ES pour Bochica Inventaire
   ═══════════════════════════════════════════════════════════════
   Usage : t('save')                  → "Enregistrer" ou "Guardar"
           t('items_count', { n: 5 }) → "5 produits"   ou "5 productos"
           setUILang('es')            → bascule l'interface en espagnol
   ═══════════════════════════════════════════════════════════════ */

const TRANSLATIONS = {
  // ── Sidebar / Navigation ──────────────────────────
  nav_inventaire:        { fr: "Inventaire",          es: "Inventario" },
  nav_my_tasks:          { fr: "Mes tâches",          es: "Mis tareas" },
  nav_to_order:          { fr: "À commander",         es: "Por pedir" },
  nav_history:           { fr: "Historique",          es: "Historial" },
  nav_tasks:             { fr: "Tâches",              es: "Tareas" },
  nav_employees:         { fr: "Employés & Horaires", es: "Empleados y Horarios" },
  nav_salaires:          { fr: "Salaires & Pourboires", es: "Salarios y Propinas" },
  nav_expenses:          { fr: "Dépenses",            es: "Gastos" },
  nav_menu:              { fr: "Menu",                es: "Menú" },
  nav_suppliers:         { fr: "Fournisseurs",        es: "Proveedores" },
  nav_section_inventory: { fr: "INVENTAIRE",          es: "INVENTARIO" },
  nav_section_dashboard: { fr: "TABLEAU DE BORD",     es: "PANEL" },
  nav_section_management:{ fr: "GESTION",             es: "GESTIÓN" },
  role_admin:            { fr: "Admin",               es: "Admin" },
  role_employee:         { fr: "Employé",             es: "Empleado" },

  // ── Topbar / Boutons globaux ──────────────────────
  toggle_dark:           { fr: "Mode sombre",         es: "Modo oscuro" },
  toggle_light:          { fr: "Mode clair",          es: "Modo claro" },
  logout:                { fr: "Déconnexion",         es: "Cerrar sesión" },
  open_close_menu:       { fr: "Ouvrir/fermer le menu", es: "Abrir/cerrar menú" },
  actions:               { fr: "Actions",             es: "Acciones" },
  close:                 { fr: "Fermer",              es: "Cerrar" },

  // ── Boutons généraux ──────────────────────────────
  cancel:                { fr: "Annuler",             es: "Cancelar" },
  save:                  { fr: "Enregistrer",         es: "Guardar" },
  confirm:               { fr: "Confirmer",           es: "Confirmar" },
  delete:                { fr: "Supprimer",           es: "Eliminar" },
  edit:                  { fr: "Modifier",            es: "Editar" },
  duplicate:             { fr: "Dupliquer",           es: "Duplicar" },
  add:                   { fr: "Ajouter",             es: "Agregar" },
  search:                { fr: "Rechercher...",       es: "Buscar..." },
  filter:                { fr: "Filtrer",             es: "Filtrar" },
  export:                { fr: "Exporter",            es: "Exportar" },
  print:                 { fr: "Imprimer",            es: "Imprimir" },
  yes:                   { fr: "Oui",                 es: "Sí" },
  no:                    { fr: "Non",                 es: "No" },
  none:                  { fr: "— Aucun —",           es: "— Ninguno —" },
  optional:              { fr: "(optionnel)",         es: "(opcional)" },

  // ── Login ─────────────────────────────────────────
  login_subtitle:        { fr: "Gestion interne",     es: "Gestión interna" },
  login_title:           { fr: "Connexion",           es: "Iniciar sesión" },
  login_pin_prompt:      { fr: "Entrez votre code PIN à 4 chiffres", es: "Ingresa tu código PIN de 4 dígitos" },
  login_clear:           { fr: "Effacer",             es: "Borrar" },
  login_keyboard_hint:   { fr: "💡 Vous pouvez aussi taper sur le clavier", es: "💡 También puedes usar el teclado" },
  login_wrong_pin:       { fr: "❌ Code PIN incorrect", es: "❌ Código PIN incorrecto" },
  login_pin_label:       { fr: "Saisie du code PIN",  es: "Ingreso del código PIN" },
  login_pin_dots_label:  { fr: "Chiffres saisis",     es: "Dígitos ingresados" },
  digit:                 { fr: "Chiffre",             es: "Dígito" },

  // ── Inventaire ────────────────────────────────────
  tbl_product:           { fr: "Produit",             es: "Producto" },
  tbl_minimum:           { fr: "Minimum",             es: "Mínimo" },
  tbl_status:            { fr: "Statut",              es: "Estado" },
  stock_products:        { fr: "Produits",            es: "Productos" },
  stock_to_order:        { fr: "À commander",         es: "Por pedir" },
  stock_low:             { fr: "Bientôt bas",         es: "Pronto bajo" },
  stock_in_stock:        { fr: "En stock",            es: "En stock" },
  stock_actual:          { fr: "Stock",               es: "Stock" },
  stock_actual_full:     { fr: "Stock actuel",        es: "Stock actual" },
  stock_new_qty:         { fr: "Nouvelle qté",        es: "Nueva cant." },
  stock_min:             { fr: "Min",                 es: "Mín" },
  stock_cmd:             { fr: "Cmd",                 es: "Pedido" },
  stock_save:            { fr: "Sauvegarder",         es: "Guardar" },
  status_commander:      { fr: "Commander",           es: "Pedir" },
  status_bientot_bas:    { fr: "Bientôt bas",         es: "Pronto bajo" },
  status_ok:             { fr: "OK",                  es: "OK" },
  add_product:           { fr: "Produit",             es: "Producto" },
  no_results:            { fr: "Aucun résultat",      es: "Sin resultados" },
  no_products_section:   { fr: "Aucun produit dans cette section.", es: "No hay productos en esta sección." },
  no_archived:           { fr: "Aucun produit archivé", es: "No hay productos archivados" },
  archived_count:        { fr: "{n} produit{s} archivé{s}", es: "{n} producto{s} archivado{s}" },
  view_active:           { fr: "Voir actifs",         es: "Ver activos" },
  view_archived:         { fr: "Voir archivés",       es: "Ver archivados" },
  manage_categories:     { fr: "Gérer les catégories", es: "Gestionar categorías" },
  filter_by_category:    { fr: "Filtrer par catégorie", es: "Filtrar por categoría" },
  all:                   { fr: "Toutes",              es: "Todas" },

  // ── Dropdown actions inventaire ───────────────────
  dropdown_edit:         { fr: "Modifier",            es: "Editar" },
  dropdown_note:         { fr: "Note",                es: "Nota" },
  dropdown_change_cat:   { fr: "Changer catégorie",   es: "Cambiar categoría" },
  dropdown_archive:      { fr: "Archiver",            es: "Archivar" },
  dropdown_restore:      { fr: "Restaurer",           es: "Restaurar" },

  // ── À commander (rapport) ─────────────────────────
  rapport_title:         { fr: "À commander",         es: "Por pedir" },
  rapport_subtitle:      { fr: "Produits sous le minimum ou à moins de 20% du seuil", es: "Productos bajo el mínimo o a menos del 20% del umbral" },
  rapport_all_ok:        { fr: "Tous les produits sont en quantité suffisante !", es: "¡Todos los productos están en cantidad suficiente!" },
  rapport_immediate:     { fr: "À commander immédiatement", es: "Pedir inmediatamente" },
  rapport_soon:          { fr: "Bientôt bas",         es: "Pronto bajo" },
  rapport_receive:       { fr: "Réceptionner la commande", es: "Recibir el pedido" },
  rapport_to_order_label:{ fr: "À commander",         es: "Por pedir" },
  rapport_units:         { fr: "unités",              es: "unidades" },

  // ── Historique ────────────────────────────────────
  history_title:         { fr: "Historique",          es: "Historial" },
  history_filter:        { fr: "Filtrer par produit...", es: "Filtrar por producto..." },
  history_empty:         { fr: "Aucune entrée.",      es: "Sin entradas." },

  // ── Tâches ────────────────────────────────────────
  tasks_title:           { fr: "Tâches",              es: "Tareas" },
  tasks_pending:         { fr: "{n} tâche{s} en attente", es: "{n} tarea{s} pendiente{s}" },
  task_add:              { fr: "Tâche",               es: "Tarea" },
  task_status_todo:      { fr: "À faire",             es: "Por hacer" },
  task_status_doing:     { fr: "En cours",            es: "En curso" },
  task_status_done:      { fr: "Complété",            es: "Completado" },
  task_modal_add:        { fr: "Ajouter une tâche",   es: "Agregar una tarea" },
  task_modal_edit:       { fr: "Modifier une tâche",  es: "Editar una tarea" },
  task_field_title:      { fr: "Titre",               es: "Título" },
  task_field_desc:       { fr: "Description",         es: "Descripción" },
  task_field_status:     { fr: "Statut",              es: "Estado" },
  task_field_priority:   { fr: "Priorité",            es: "Prioridad" },
  task_field_assign:     { fr: "Assignée à",          es: "Asignada a" },
  task_field_due:        { fr: "Date limite",         es: "Fecha límite" },
  task_prio_low:         { fr: "Basse",               es: "Baja" },
  task_prio_med:         { fr: "Moyenne",             es: "Media" },
  task_prio_high:        { fr: "Haute",               es: "Alta" },
  task_no_assignee:      { fr: "— Personne —",        es: "— Nadie —" },
  task_enter_title:      { fr: "Entrez un titre.",    es: "Ingresa un título." },

  // ── Dépenses & Revenus ────────────────────────────
  exp_title:             { fr: "Dépenses & Revenus",  es: "Gastos e Ingresos" },
  exp_period_week:       { fr: "Semaine",             es: "Semana" },
  exp_period_month:      { fr: "Mois",                es: "Mes" },
  exp_period_year:       { fr: "Année",               es: "Año" },
  exp_revenues:          { fr: "Revenus",             es: "Ingresos" },
  exp_expenses_pre_tax:  { fr: "Dépenses (avant taxes)", es: "Gastos (antes impuestos)" },
  exp_taxes:             { fr: "Taxes (TPS+TVQ)",     es: "Impuestos (TPS+TVQ)" },
  exp_profit:            { fr: "Profit (taxes incluses)",   es: "Ganancia (impuestos incluidos)" },
  exp_deficit:           { fr: "Déficit (taxes incluses)",  es: "Déficit (impuestos incluidos)" },
  exp_fixed:             { fr: "Frais fixes",         es: "Gastos fijos" },
  exp_variable:          { fr: "Frais variables",     es: "Gastos variables" },
  exp_add_revenue:       { fr: "Revenu",              es: "Ingreso" },
  exp_add_expense:       { fr: "Dépense",             es: "Gasto" },
  exp_categories:        { fr: "Catégories",          es: "Categorías" },
  exp_fixed_templates:   { fr: "Frais fixes",         es: "Gastos fijos" },
  exp_report:            { fr: "Rapport",             es: "Reporte" },
  exp_table_period:      { fr: "Période",             es: "Período" },
  exp_table_date:        { fr: "Date",                es: "Fecha" },
  exp_table_desc:        { fr: "Description",         es: "Descripción" },
  exp_table_supplier:    { fr: "Fournisseur",         es: "Proveedor" },
  exp_table_category:    { fr: "Catégorie",           es: "Categoría" },
  exp_table_amount:      { fr: "Montant",             es: "Monto" },
  exp_table_total:       { fr: "Total",               es: "Total" },
  exp_table_notes:       { fr: "Notes",               es: "Notas" },
  exp_field_amount_pre:  { fr: "Montant avant taxes ($)", es: "Monto antes de impuestos ($)" },
  exp_field_amount:      { fr: "Montant ($)",         es: "Monto ($)" },
  exp_field_tps:         { fr: "TPS (5%)",            es: "TPS (5%)" },
  exp_field_tvq:         { fr: "TVQ (9.975%)",        es: "TVQ (9.975%)" },
  exp_field_tps_recv:    { fr: "TPS perçue (5%)",     es: "TPS percibido (5%)" },
  exp_field_tvq_recv:    { fr: "TVQ perçue (9.975%)", es: "TVQ percibido (9.975%)" },
  exp_field_supplier:    { fr: "Fournisseur (optionnel)", es: "Proveedor (opcional)" },
  exp_field_supplier_hint: { fr: "Si le fournisseur n'existe pas, il sera créé automatiquement à l'enregistrement.", es: "Si el proveedor no existe, será creado automáticamente al guardar." },
  exp_field_supplier_ph: { fr: "Tapez un nom (création auto si nouveau)", es: "Escribe un nombre (creación auto si nuevo)" },
  exp_field_category:    { fr: "Catégorie",           es: "Categoría" },
  exp_field_type:        { fr: "Type de frais",       es: "Tipo de gasto" },
  exp_type_variable:     { fr: "Variable",            es: "Variable" },
  exp_type_fixed:        { fr: "Fixe",                es: "Fijo" },
  exp_total_with_tax:    { fr: "Total avec taxes",    es: "Total con impuestos" },
  exp_modal_add:         { fr: "Ajouter une dépense", es: "Agregar un gasto" },
  exp_modal_edit:        { fr: "Modifier une dépense", es: "Editar un gasto" },
  rev_modal_add:         { fr: "Ajouter un revenu",   es: "Agregar un ingreso" },
  rev_modal_edit:        { fr: "Modifier un revenu",  es: "Editar un ingreso" },
  rev_date_start:        { fr: "Date de début",       es: "Fecha de inicio" },
  rev_date_end:          { fr: "Date de fin",         es: "Fecha de fin" },
  rev_date_end_hint:     { fr: "Laissez la date de fin vide pour un revenu ponctuel. Sinon, le revenu couvrira toute la période (utile pour une semaine, un mois, etc.).", es: "Deja la fecha de fin vacía para un ingreso puntual. Si no, el ingreso cubrirá todo el período (útil para una semana, un mes, etc.)." },
  err_enter_desc:        { fr: "Entrez une description.", es: "Ingresa una descripción." },
  err_enter_amount:      { fr: "Entrez un montant.",  es: "Ingresa un monto." },
  err_enter_start_date:  { fr: "Entrez une date de début.", es: "Ingresa una fecha de inicio." },
  err_end_after_start:   { fr: "La date de fin doit être après la date de début.", es: "La fecha de fin debe ser posterior a la fecha de inicio." },

  // ── Charts ────────────────────────────────────────
  chart_combo_title:     { fr: "Revenus, Dépenses & Profit — 6 derniers mois", es: "Ingresos, Gastos y Ganancia — Últimos 6 meses" },
  chart_combo_sub:       { fr: "Survolez les barres pour voir les détails", es: "Pasa el cursor sobre las barras para ver los detalles" },
  chart_pie_title:       { fr: "Répartition des dépenses", es: "Distribución de gastos" },
  chart_pie_no_data:     { fr: "Aucune dépense pour cette période", es: "Ningún gasto para este período" },
  chart_categories:      { fr: "catégorie",           es: "categoría" },
  chart_categories_pl:   { fr: "catégories",          es: "categorías" },

  // ── Rapport personnalisé ──────────────────────────
  report_title:          { fr: "Rapport personnalisé", es: "Reporte personalizado" },
  report_intro:          { fr: "Choisissez la période et le contenu, puis exportez en Excel ou PDF.", es: "Elige el período y el contenido, luego exporta en Excel o PDF." },
  report_date_start:     { fr: "Date de début",       es: "Fecha de inicio" },
  report_date_end:       { fr: "Date de fin",         es: "Fecha de fin" },
  report_content:        { fr: "Contenu du rapport",  es: "Contenido del reporte" },
  report_include_rev:    { fr: "Inclure les revenus", es: "Incluir los ingresos" },
  report_include_exp:    { fr: "Inclure les dépenses", es: "Incluir los gastos" },
  report_export_excel:   { fr: "Exporter Excel",      es: "Exportar Excel" },
  report_export_pdf:     { fr: "Exporter PDF",        es: "Exportar PDF" },
  report_preview:        { fr: "Aperçu",              es: "Vista previa" },
  report_revenues_n:     { fr: "{n} revenu{s}",       es: "{n} ingreso{s}" },
  report_expenses_n:     { fr: "{n} dépense{s}",      es: "{n} gasto{s}" },
  report_invalid_period: { fr: "La date de fin doit être après la date de début.", es: "La fecha de fin debe ser posterior a la fecha de inicio." },
  report_choose_period:  { fr: "Choisissez une période valide.", es: "Elige un período válido." },
  report_select_one:     { fr: "Sélectionnez au moins une catégorie (revenus ou dépenses).", es: "Selecciona al menos una categoría (ingresos o gastos)." },
  report_lib_excel_err:  { fr: "La bibliothèque Excel n'est pas chargée. Vérifiez votre connexion internet et rechargez.", es: "La biblioteca Excel no está cargada. Verifica tu conexión a internet y recarga." },
  report_lib_pdf_err:    { fr: "La bibliothèque PDF n'est pas chargée. Vérifiez votre connexion internet et rechargez.", es: "La biblioteca PDF no está cargada. Verifica tu conexión a internet y recarga." },

  // ── Employés ──────────────────────────────────────
  emp_title:             { fr: "Employés",            es: "Empleados" },
  emp_add:               { fr: "Employé",             es: "Empleado" },
  emp_field_name:        { fr: "Nom",                 es: "Nombre" },
  emp_field_role:        { fr: "Rôle",                es: "Rol" },
  emp_field_phone:       { fr: "Téléphone",           es: "Teléfono" },
  emp_field_email:       { fr: "Courriel",            es: "Correo" },
  emp_field_pin:         { fr: "PIN",                 es: "PIN" },
  shift_morning:         { fr: "Matin",               es: "Mañana" },
  shift_evening:         { fr: "Soir",                es: "Tarde" },
  shift_day:             { fr: "Journée",             es: "Día" },
  shift_off:             { fr: "Libre",               es: "Libre" },
  shift_leave:           { fr: "Congé",               es: "Descanso" },

  // ── Salaires & Pourboires ────────────────────────
  pay_title:             { fr: "Salaires & Pourboires", es: "Salarios y Propinas" },
  pay_service_hours:     { fr: "Heures de service",     es: "Horas de servicio" },
  pay_service_hint:      { fr: "Fenêtre où les pourboires sont gagnés (avant/après n'entre pas dans le prorata)", es: "Ventana donde se ganan las propinas (antes/después no entra en el prorrateo)" },
  pay_total_tips:        { fr: "Pourboires de la semaine", es: "Propinas de la semana" },
  pay_total_received:    { fr: "Total reçu",            es: "Total recibido" },
  pay_pool_kitchen:      { fr: "Pool Cuisine",          es: "Pool Cocina" },
  pay_pool_service:      { fr: "Pool Service + Admin",  es: "Pool Servicio + Admin" },
  pay_eligible_hours:    { fr: "{n}h éligibles",        es: "{n}h elegibles" },
  pay_col_salary:        { fr: "Salaire",               es: "Salario" },
  pay_col_tip:           { fr: "Pourboire",             es: "Propina" },
  pay_col_total:         { fr: "Total",                 es: "Total" },
  pay_share_modal_title: { fr: "Répartition des pourboires", es: "Reparto de las propinas" },
  pay_share_intro:       { fr: "Les pourboires sont répartis en deux pools selon la section de l'employé. La somme doit faire 100%.", es: "Las propinas se reparten en dos pools según la sección del empleado. La suma debe ser 100%." },
  pay_reset_planned:     { fr: "Reprendre du planifié", es: "Tomar del planificado" },
  pay_reset_confirm_title: { fr: "Reprendre l'horaire planifié ?", es: "¿Tomar el horario planificado?" },
  pay_reset_confirm_msg: { fr: "Cela va remplacer toutes les heures réelles de cette semaine par les heures planifiées dans Employés & Horaires. Continuer ?", es: "Esto reemplazará todas las horas reales de esta semana por las horas planificadas en Empleados y Horarios. ¿Continuar?" },
  pay_legend:            { fr: "L'horaire affiché est indépendant de l'horaire planifié. Le badge ★ indique les heures éligibles aux pourboires (dans la fenêtre de service).", es: "El horario mostrado es independiente del horario planificado. La insignia ★ indica las horas elegibles para propinas (en la ventana de servicio)." },
  pay_no_employees:      { fr: "Aucun employé enregistré. Ajoutez-en un dans Employés & Horaires pour commencer.", es: "Ningún empleado registrado. Agrega uno en Empleados y Horarios para comenzar." },

  // ── Menu (items) ──────────────────────────────────
  menu_title:            { fr: "Menu",                es: "Menú" },
  menu_add:              { fr: "Item",                es: "Plato" },
  menu_available:        { fr: "Disponible",          es: "Disponible" },
  menu_unavailable:      { fr: "Indisponible",        es: "No disponible" },

  // ── Fournisseurs ──────────────────────────────────
  sup_title:             { fr: "Fournisseurs",        es: "Proveedores" },
  sup_add:               { fr: "Fournisseur",         es: "Proveedor" },
  sup_field_name:        { fr: "Nom",                 es: "Nombre" },
  sup_field_contact:     { fr: "Contact",             es: "Contacto" },
  sup_field_email:       { fr: "Courriel",            es: "Correo" },
  sup_field_notes:       { fr: "Notes",               es: "Notas" },
  sup_no_products:       { fr: "Aucun produit lié",   es: "Ningún producto vinculado" },

  // ── Sections par défaut (catégories d'inventaire) ─
  section_kitchen:       { fr: "Cuisine",             es: "Cocina" },
  section_packaging:     { fr: "Emballage",           es: "Embalaje" },
  section_bar:           { fr: "Bar",                 es: "Bar" },
  section_other:         { fr: "Autre",               es: "Otro" },
  section_service:       { fr: "Service",             es: "Servicio" },

  // ── Générique ─────────────────────────────────────
  err_prefix:            { fr: "Erreur",               es: "Error" },

  // ── Opérations : tâches du jour + ouverture/fermeture ──
  ops_daily_title:       { fr: "Tâches de la journée", es: "Tareas del día" },
  ops_no_tasks_today:    { fr: "Aucune tâche pour aujourd'hui ✨", es: "Ninguna tarea para hoy ✨" },
  ops_uncheck:           { fr: "Cliquer pour décocher", es: "Clic para desmarcar" },
  ops_mark_done:         { fr: "Marquer comme complété", es: "Marcar como completado" },
  ops_done_today:        { fr: "Complétée aujourd'hui", es: "Completada hoy" },
  ops_not_done:          { fr: "Pas encore complétée",  es: "Aún no completada" },
  ops_admin_title:       { fr: "Tâches du jour",        es: "Tareas del día" },
  ops_new_task:          { fr: "Nouvelle tâche",        es: "Nueva tarea" },
  ops_admin_intro:       { fr: "Ces tâches s'affichent sur l'accueil des employés, qui peuvent les cocher. Les <strong>récurrentes</strong> réapparaissent chaque jour (le coché se réinitialise à minuit). Les <strong>ponctuelles</strong> sont à faire une seule fois.", es: "Estas tareas aparecen en el inicio de los empleados, que pueden marcarlas. Las <strong>recurrentes</strong> reaparecen cada día (el marcado se reinicia a medianoche). Las <strong>puntuales</strong> se hacen una sola vez." },
  ops_recurring_title:   { fr: "Récurrentes (chaque jour)", es: "Recurrentes (cada día)" },
  ops_no_recurring:      { fr: "Aucune tâche récurrente. Clique « Nouvelle tâche ».", es: "Ninguna tarea recurrente. Haz clic en « Nueva tarea »." },
  ops_once_title:        { fr: "Ponctuelles (une seule fois)", es: "Puntuales (una sola vez)" },
  ops_no_once:           { fr: "Aucune tâche ponctuelle.", es: "Ninguna tarea puntual." },
  ops_edit_task:         { fr: "Modifier la tâche",     es: "Editar la tarea" },
  ops_new_task_modal:    { fr: "Nouvelle tâche du jour", es: "Nueva tarea del día" },
  ops_task_label:        { fr: "Intitulé de la tâche",  es: "Título de la tarea" },
  ops_task_placeholder:  { fr: "Ex. Vérifier les températures du frigo", es: "Ej. Verificar las temperaturas del refrigerador" },
  ops_task_time:         { fr: "Heure (optionnel)",   es: "Hora (opcional)" },
  ops_task_time_ph:      { fr: "ex. 15:00",            es: "ej. 15:00" },
  ops_task_times:        { fr: "Heure(s) (optionnel)", es: "Hora(s) (opcional)" },
  ops_task_times_ph:     { fr: "ex. 12:00, 17:00, 21:00", es: "ej. 12:00, 17:00, 21:00" },
  ops_task_times_hint:   { fr: "Une ou plusieurs heures séparées par des virgules. Laisse vide si aucune heure précise. <strong>Plusieurs heures = la tâche est à faire plusieurs fois par jour</strong> (un passage cochable par heure).", es: "Una o varias horas separadas por comas. Deja vacío si no hay hora precisa. <strong>Varias horas = la tarea se hace varias veces al día</strong> (un paso marcable por hora)." },
  ops_task_duplicated:   { fr: "Tâche dupliquée.",     es: "Tarea duplicada." },
  ops_bucket:            { fr: "Catégorie",            es: "Categoría" },
  ops_bucket_recurrent:  { fr: "Récurrente",           es: "Recurrente" },
  ops_bucket_idle:       { fr: "Temps mort",           es: "Tiempo muerto" },
  ops_once_checkbox:     { fr: "À faire une seule fois (disparaît une fois faite)", es: "Hacer una sola vez (desaparece al completarse)" },
  ops_sec_recurrent:     { fr: "Tâches récurrentes",   es: "Tareas recurrentes" },
  ops_sec_idle:          { fr: "Temps mort",           es: "Tiempo muerto" },
  ops_no_recurrent_today:{ fr: "Aucune tâche récurrente pour aujourd'hui ✨", es: "Ninguna tarea recurrente para hoy ✨" },
  ops_no_idle_today:     { fr: "Aucune tâche de temps mort ✨", es: "Ninguna tarea de tiempo muerto ✨" },
  ops_no_idle:           { fr: "Aucune tâche de temps mort. Clique « Nouvelle tâche ».", es: "Ninguna tarea de tiempo muerto. Haz clic en « Nueva tarea »." },
  ops_emp_tasks_note:    { fr: "Coche les tâches au fur et à mesure. La liste se réinitialise automatiquement chaque jour.", es: "Marca las tareas a medida que avanzas. La lista se reinicia automáticamente cada día." },
  ops_drag_hint:         { fr: "Glisse une tâche d'une colonne à l'autre pour changer sa catégorie.", es: "Arrastra una tarea de una columna a otra para cambiar su categoría." },
  ops_moved_recurrent:   { fr: "Déplacée vers Récurrentes.", es: "Movida a Recurrentes." },
  ops_moved_idle:        { fr: "Déplacée vers Temps mort.",  es: "Movida a Tiempo muerto." },
  ops_task_note:         { fr: "Détails / commentaire (optionnel)", es: "Detalles / comentario (opcional)" },
  ops_task_note_ph:      { fr: "Ex. Utiliser le produit désinfectant sous l'évier", es: "Ej. Usar el desinfectante bajo el fregadero" },
  ops_type:              { fr: "Type",                  es: "Tipo" },
  ops_type_recurring:    { fr: "Récurrente (chaque jour)", es: "Recurrente (cada día)" },
  ops_type_once:         { fr: "Ponctuelle (une seule fois)", es: "Puntual (una sola vez)" },
  ops_enter_title:       { fr: "Entre un intitulé de tâche.", es: "Ingresa un título de tarea." },
  ops_task_saved:        { fr: "Tâche enregistrée.",    es: "Tarea guardada." },
  ops_delete_task_title: { fr: "Supprimer la tâche",    es: "Eliminar la tarea" },
  ops_delete_task_confirm:{ fr: "Supprimer « {name} » ? Cette action est définitive.", es: "¿Eliminar « {name} »? Esta acción es definitiva." },
  ops_task_deleted:      { fr: "Tâche supprimée.",      es: "Tarea eliminada." },
  ops_openclose_title:   { fr: "Ouverture / Fermeture", es: "Apertura / Cierre" },
  ops_edit_lists:        { fr: "Modifier les listes",   es: "Editar las listas" },
  ops_opening:           { fr: "À l'ouverture",         es: "En la apertura" },
  ops_closing:           { fr: "À la fermeture",        es: "En el cierre" },
  ops_opening_empty:     { fr: "Liste d'ouverture non définie.", es: "Lista de apertura no definida." },
  ops_closing_empty:     { fr: "Liste de fermeture non définie.", es: "Lista de cierre no definida." },
  ops_openclose_note:    { fr: "Coche les éléments au fur et à mesure. La liste se réinitialise automatiquement chaque jour.", es: "Marca los elementos a medida que avanzas. La lista se reinicia automáticamente cada día." },
  ops_edit_lists_title:  { fr: "Modifier les listes d'ouverture / fermeture", es: "Editar las listas de apertura / cierre" },
  ops_edit_lists_hint:   { fr: "Une ligne = un élément de la liste. Les lignes vides sont ignorées.", es: "Una línea = un elemento de la lista. Las líneas vacías se ignoran." },
  ops_opening_ph:        { fr: "Allumer la friteuse\nVérifier la caisse\nSortir les chaises de terrasse", es: "Encender la freidora\nVerificar la caja\nSacar las sillas de la terraza" },
  ops_closing_ph:        { fr: "Fermer la caisse\nNettoyer la plancha\nSortir les poubelles", es: "Cerrar la caja\nLimpiar la plancha\nSacar la basura" },
  ops_lists_saved:       { fr: "Listes enregistrées.",  es: "Listas guardadas." },
  ops_cuisine:           { fr: "Cuisine", es: "Cocina" },
  ops_service:           { fr: "Service", es: "Servicio" },
  ops_section_switch:    { fr: "Choisir la section", es: "Elegir la sección" },
  ops_oc_cell_empty:     { fr: "Aucun élément.", es: "Ningún elemento." },
  ops_opening_cuisine_ph:{ fr: "Allumer la friteuse\nMonter la plancha en température\nSortir les bacs de prep", es: "Encender la freidora\nCalentar la plancha\nSacar los recipientes de prep" },
  ops_opening_service_ph:{ fr: "Vérifier la caisse\nDescendre les chaises\nMettre les tables", es: "Verificar la caja\nBajar las sillas\nPoner las mesas" },
  ops_closing_cuisine_ph:{ fr: "Nettoyer la plancha\nÉteindre les équipements\nRanger les bacs au frigo", es: "Limpiar la plancha\nApagar los equipos\nGuardar los recipientes en el refrigerador" },
  ops_closing_service_ph:{ fr: "Fermer la caisse\nSortir les poubelles\nLaver les tables", es: "Cerrar la caja\nSacar la basura\nLimpiar las mesas" },

  // ── Accueil & horaire employé ─────────────────────
  emp_welcome:           { fr: "Bienvenue chez Bochica", es: "Bienvenido a Bochica" },
  emp_in_service:        { fr: "En service aujourd'hui", es: "En servicio hoy" },
  emp_no_shift_today:    { fr: "Aucun shift planifié aujourd'hui", es: "Ningún turno planificado hoy" },
  emp_upcoming_events:   { fr: "Prochains événements",  es: "Próximos eventos" },
  emp_no_events_30:      { fr: "Aucun événement dans les 30 jours", es: "Ningún evento en los próximos 30 días" },
  emp_no_name:           { fr: "Sans nom",              es: "Sin nombre" },
  day_today_short:       { fr: "Auj.",                  es: "Hoy" },
  day_tomorrow_short:    { fr: "Demain",                es: "Mañana" },
  sched_week_title:      { fr: "Horaire de la semaine", es: "Horario de la semana" },
  sched_no_published:    { fr: "Aucun horaire publié pour le moment.", es: "Ningún horario publicado por ahora." },
  sched_week_num:        { fr: "Semaine {n}",           es: "Semana {n}" },
  sched_this_week:       { fr: "Cette semaine",         es: "Esta semana" },
  sched_prev_week:       { fr: "Semaine précédente",    es: "Semana anterior" },
  sched_next_week:       { fr: "Semaine suivante",      es: "Semana siguiente" },
  sched_col_employee:    { fr: "Employé",               es: "Empleado" },
  sched_persons:         { fr: "{n} pers",              es: "{n} pers" },
  sched_note:            { fr: "Horaire indicatif de la semaine. Pour toute question, voir un responsable.", es: "Horario indicativo de la semana. Para cualquier pregunta, consulta a un responsable." },

  // ── Pointage (kiosque PIN) ────────────────────────
  punch_title:           { fr: "Pointage",            es: "Fichaje" },
  punch_subtitle:        { fr: "Entrez votre PIN à 4 chiffres pour marquer votre entrée ou sortie", es: "Ingresa tu PIN de 4 dígitos para marcar tu entrada o salida" },
  punch_dots_aria:       { fr: "{n} chiffres saisis sur 4", es: "{n} dígitos ingresados de 4" },
  punch_keypad_aria:     { fr: "Clavier numérique",    es: "Teclado numérico" },
  punch_aria_clear:      { fr: "Effacer",              es: "Borrar" },
  punch_aria_validate:   { fr: "Valider",              es: "Validar" },
  punch_hint:            { fr: "L'admin configure ton PIN dans <strong>Employés &amp; Horaires</strong> → ta fiche.", es: "El admin configura tu PIN en <strong>Empleados y Horarios</strong> → tu ficha." },
  punch_no_today:        { fr: "Aucun pointage aujourd'hui", es: "Sin fichaje hoy" },
  punch_overnight_hint:  { fr: "Quart de nuit ouvert depuis hier — entrée à {t}. Appuie sur SORTIE pour le fermer.", es: "Turno nocturno abierto desde ayer — entrada a las {t}. Pulsa SALIDA para cerrarlo." },
  punch_entry:           { fr: "Entrée",               es: "Entrada" },
  punch_exit:            { fr: "Sortie",               es: "Salida" },
  punch_not_me:          { fr: "Pas moi",              es: "No soy yo" },
  punch_hello:           { fr: "Bonjour",              es: "Hola" },
  punch_in:              { fr: "ENTRÉE",               es: "ENTRADA" },
  punch_out:             { fr: "SORTIE",               es: "SALIDA" },
  punch_btn_in_title:    { fr: "Marquer ton heure d'entrée", es: "Marcar tu hora de entrada" },
  punch_btn_out_title:   { fr: "Marquer ton heure de sortie", es: "Marcar tu hora de salida" },
  punch_replace:         { fr: "(remplacer {t})",      es: "(reemplazar {t})" },
  punch_action_sub:      { fr: "Choisis ENTRÉE pour marquer ton début de quart, SORTIE pour marquer ta fin. Tu peux re-pointer si tu t'es trompé — la dernière saisie écrase la précédente.", es: "Elige ENTRADA para marcar el inicio de tu turno, SALIDA para marcar el final. Puedes volver a fichar si te equivocaste — el último registro reemplaza al anterior." },
  punch_recorded:        { fr: "ENREGISTRÉE",          es: "REGISTRADA" },
  punch_at:              { fr: "à {t}",                es: "a las {t}" },
  punch_wish_in:         { fr: "Bon shift !",          es: "¡Buen turno!" },
  punch_wish_out:        { fr: "Bonne soirée et merci !", es: "¡Buena noche y gracias!" },
  punch_next:            { fr: "Suivant",              es: "Siguiente" },
  punch_pin_unknown:     { fr: "PIN non reconnu",      es: "PIN no reconocido" },
  punch_pin_unknown_full:{ fr: "PIN non reconnu — vérifie avec l'admin.", es: "PIN no reconocido — verifica con el admin." },
  punch_enter_4:         { fr: "Saisis un PIN à 4 chiffres.", es: "Ingresa un PIN de 4 dígitos." },
  punch_err_internal:    { fr: "Erreur interne (dayKey). Avise l'admin.", es: "Error interno (dayKey). Avisa al admin." },
  punch_err_save:        { fr: "Erreur d'enregistrement. Réessaie ou avise l'admin.", es: "Error al guardar. Inténtalo de nuevo o avisa al admin." },
  punch_tz_label:        { fr: "jour système :",       es: "día del sistema:" },
  punch_tz_title:        { fr: "Fuseau horaire détecté + clé du jour utilisée par le système. Si la date affichée ne correspond pas à aujourd'hui réel, le pointage tombera sur le mauvais jour — préviens l'admin.", es: "Zona horaria detectada + clave del día usada por el sistema. Si la fecha mostrada no corresponde al día real de hoy, el fichaje caerá en el día equivocado — avisa al admin." },

  // ── Unités ────────────────────────────────────────
  unit_box:              { fr: "boîte",               es: "caja" },
  unit_unit:             { fr: "unité",               es: "unidad" },
  unit_units:            { fr: "unités",              es: "unidades" },
  unit_box_cap:          { fr: "Boîte",               es: "Caja" },
  unit_unit_cap:         { fr: "Unité",               es: "Unidad" },

  // ── Modal Produit ────────────────────────────────
  prod_modal_add:        { fr: "Ajouter un produit",  es: "Agregar un producto" },
  prod_modal_edit:       { fr: "Modifier un produit", es: "Editar un producto" },
  prod_field_name:       { fr: "Nom",                 es: "Nombre" },
  prod_field_section:    { fr: "Section",             es: "Sección" },
  prod_field_stock:      { fr: "Qté en inventaire",   es: "Cant. en inventario" },
  prod_field_minimum:    { fr: "Minimum requis",      es: "Mínimo requerido" },
  prod_field_order_unit: { fr: "Unité de commande",   es: "Unidad de pedido" },
  prod_field_units_box:  { fr: "Unités/boîte",        es: "Unidades/caja" },
  prod_field_qty_order:  { fr: "Qté à commander",     es: "Cant. a pedir" },
  prod_field_supplier:   { fr: "Fournisseur",         es: "Proveedor" },
  err_enter_name:        { fr: "Entrez un nom.",      es: "Ingresa un nombre." },

  // ── Note ─────────────────────────────────────────
  note_title:            { fr: "Note du produit",     es: "Nota del producto" },
  note_placeholder:      { fr: "Tapez votre note...", es: "Escribe tu nota..." },
  note_remove:           { fr: "Retirer la note",     es: "Quitar la nota" },

  // ── Catégories (modal) ───────────────────────────
  cat_modal_title:       { fr: "Gérer les catégories", es: "Gestionar categorías" },
  cat_add_placeholder:   { fr: "Nouvelle catégorie",  es: "Nueva categoría" },

  // ── Réception ────────────────────────────────────
  receive_title:         { fr: "Réceptionner la commande", es: "Recibir el pedido" },
  receive_qty_received:  { fr: "Qté reçue",           es: "Cant. recibida" },
  receive_qty_expected:  { fr: "Qté attendue",        es: "Cant. esperada" },
  receive_validate:      { fr: "Valider la réception", es: "Validar la recepción" },

  // ── Ingrédients (recettes) ────────────────────────
  nav_ingredients:       { fr: "Ingrédients",         es: "Ingredientes" },
  nav_recipes:           { fr: "Recettes",            es: "Recetas" },
  ing_title:             { fr: "Ingrédients",         es: "Ingredientes" },
  ing_subtitle:          { fr: "Items transformés utilisés dans les recettes du menu", es: "Items transformados usados en las recetas del menú" },
  ing_add:               { fr: "Ingrédient",          es: "Ingrediente" },
  ing_modal_add:         { fr: "Ajouter un ingrédient", es: "Agregar un ingrediente" },
  ing_modal_edit:        { fr: "Modifier un ingrédient", es: "Editar un ingrediente" },
  ing_field_name:        { fr: "Nom",                 es: "Nombre" },
  ing_field_unit:        { fr: "Unité",               es: "Unidad" },
  ing_field_unit_hint:   { fr: "Ex: unité, g, ml, portion, tranche", es: "Ej: unidad, g, ml, porción, rebanada" },
  ing_field_cost:        { fr: "Coût unitaire ($)",   es: "Costo unitario ($)" },
  ing_field_category:    { fr: "Catégorie",           es: "Categoría" },
  ing_field_notes:       { fr: "Notes (optionnel)",   es: "Notas (opcional)" },
  ing_cat_base:          { fr: "Base",                es: "Base" },
  ing_cat_protein:       { fr: "Protéine",            es: "Proteína" },
  ing_cat_garnish:       { fr: "Garniture",           es: "Guarnición" },
  ing_cat_sauce:         { fr: "Sauce",               es: "Salsa" },
  ing_cat_vegetable:     { fr: "Légume",              es: "Verdura" },
  ing_cat_drink:         { fr: "Boisson",             es: "Bebida" },
  ing_cat_dessert:       { fr: "Dessert",             es: "Postre" },
  ing_cat_other:         { fr: "Autre",               es: "Otro" },
  ing_no_ingredients:    { fr: "Aucun ingrédient. Ajoutez-en pour calculer le coût des recettes.", es: "Ningún ingrediente. Agregue para calcular el costo de las recetas." },
  ing_filter_all:        { fr: "Toutes",              es: "Todas" },

  // ── Recettes (livre de cuisine — pour préparation) ─
  rec_title:             { fr: "Livre de recettes",   es: "Libro de recetas" },
  rec_subtitle:          { fr: "Référence pour préparer les plats — accessible à tous", es: "Referencia para preparar los platos — accesible para todos" },
  rec_no_recipes:        { fr: "Aucune recette pour l'instant. Cliquez sur \"Recette\" pour commencer votre livre de cuisine.", es: "Ninguna receta por ahora. Haz clic en \"Receta\" para comenzar tu libro de cocina." },
  rec_add:               { fr: "Recette",             es: "Receta" },
  rec_modal_add:         { fr: "Ajouter une recette", es: "Agregar una receta" },
  rec_modal_edit:        { fr: "Modifier la recette", es: "Editar la receta" },
  rec_view:              { fr: "Voir la recette",     es: "Ver la receta" },
  rec_field_name:        { fr: "Nom du plat",         es: "Nombre del plato" },
  rec_field_desc:        { fr: "Description courte",  es: "Descripción corta" },
  rec_field_category:    { fr: "Catégorie",           es: "Categoría" },
  rec_field_servings:    { fr: "Portions",            es: "Porciones" },
  rec_field_prep_time:   { fr: "Temps de préparation (min)", es: "Tiempo de preparación (min)" },
  rec_field_cook_time:   { fr: "Temps de cuisson (min)", es: "Tiempo de cocción (min)" },
  rec_field_ingredients: { fr: "Ingrédients",         es: "Ingredientes" },
  rec_field_ingredients_hint: { fr: "Un ingrédient par ligne (ex: 200g de farine, 2 œufs, sel et poivre)", es: "Un ingrediente por línea (ej: 200g de harina, 2 huevos, sal y pimienta)" },
  rec_field_steps:       { fr: "Étapes de préparation", es: "Pasos de preparación" },
  rec_field_steps_hint:  { fr: "Numérotez ou décrivez chaque étape sur une ligne", es: "Numera o describe cada paso en una línea" },
  rec_field_tips:        { fr: "Conseils du chef (optionnel)", es: "Consejos del chef (opcional)" },
  rec_total_time:        { fr: "Temps total",         es: "Tiempo total" },
  rec_total_items:       { fr: "plats avec recette",  es: "platos con receta" },
  rec_minutes:           { fr: "min",                 es: "min" },
  rec_servings_label:    { fr: "portion",             es: "porción" },
  rec_servings_label_pl: { fr: "portions",            es: "porciones" },
  rec_filter_all:        { fr: "Toutes",              es: "Todas" },
  rec_cat_main:          { fr: "Plat principal",      es: "Plato principal" },
  rec_cat_starter:       { fr: "Entrée",              es: "Entrada" },
  rec_cat_dessert:       { fr: "Dessert",             es: "Postre" },
  rec_cat_drink:         { fr: "Boisson",             es: "Bebida" },
  rec_cat_sauce:         { fr: "Sauce",               es: "Salsa" },
  rec_cat_base:          { fr: "Préparation de base", es: "Preparación base" },
  rec_cat_other:         { fr: "Autre",               es: "Otro" },
  rec_no_steps:          { fr: "Aucune étape définie", es: "Ningún paso definido" },
  rec_no_ingredients:    { fr: "Aucun ingrédient",    es: "Ningún ingrediente" },
  rec_print:             { fr: "Imprimer",            es: "Imprimir" },

  // ── Menu : labels nouvelles cartes (food cost / marge) ─
  menu_food_cost:        { fr: "Coût",                es: "Costo" },
  menu_price:            { fr: "Prix",                es: "Precio" },
  menu_margin_label:     { fr: "Marge",               es: "Margen" },
  menu_no_composition:   { fr: "Aucune composition définie", es: "Sin composición definida" },
  menu_unavailable_short:{ fr: "Indispo.",            es: "No dispo." },

  // ── Composition modal Menu ────────────────────────
  menu_composition:      { fr: "Composition (recette)", es: "Composición (receta)" },
  menu_composition_hint: { fr: "Ajoutez les ingrédients pour calculer automatiquement le coût de revient.", es: "Agregue los ingredientes para calcular automáticamente el costo de receta." },
  menu_add_ingredient:   { fr: "Ajouter un ingrédient", es: "Agregar un ingrediente" },
  menu_no_ingredients:   { fr: "Aucun ingrédient ajouté", es: "Ningún ingrediente agregado" },
  menu_select_ingredient:{ fr: "Choisir un ingrédient", es: "Elegir un ingrediente" },
  menu_quantity:         { fr: "Qté",                 es: "Cant." },
  menu_food_cost_total:  { fr: "Coût total des ingrédients", es: "Costo total de los ingredientes" },
  menu_calculated_margin:{ fr: "Marge calculée",      es: "Margen calculado" },
  menu_field_price:      { fr: "Prix de vente ($)",   es: "Precio de venta ($)" },
  menu_field_name:       { fr: "Nom du plat",         es: "Nombre del plato" },
  menu_field_desc:       { fr: "Description",         es: "Descripción" },
  menu_field_category:   { fr: "Catégorie",           es: "Categoría" },
  menu_field_available:  { fr: "Disponible",          es: "Disponible" },
  menu_modal_add:        { fr: "Ajouter un plat",     es: "Agregar un plato" },
  menu_modal_edit:       { fr: "Modifier un plat",    es: "Editar un plato" },

  // ── Confirmations ─────────────────────────────────
  confirm_delete_title:  { fr: "Supprimer ?",         es: "¿Eliminar?" },
  confirm_delete_msg:    { fr: 'Voulez-vous vraiment supprimer "{name}" ? Cette action est irréversible.', es: '¿Realmente deseas eliminar "{name}"? Esta acción es irreversible.' },

  // ── Misc ──────────────────────────────────────────
  no_supplier:           { fr: "—",                   es: "—" },
  qty_remaining_ph:      { fr: "Qté restante",        es: "Cant. restante" },
  notes_field:           { fr: "Notes",               es: "Notas" },
  back_to_actives:       { fr: "Retour aux actifs",   es: "Volver a los activos" },
  language:              { fr: "Langue",              es: "Idioma" },
  edit:                  { fr: "Modifier",            es: "Editar" },

  // ── Menu : labels nouvelles cartes ─────────────────
  menu_food_cost:        { fr: "Coût",                es: "Costo" },
  menu_price:            { fr: "Prix",                es: "Precio" },
  menu_margin_label:     { fr: "Marge",               es: "Margen" },
  menu_no_composition:   { fr: "Aucune composition définie", es: "Sin composición definida" },
  menu_unavailable_short:{ fr: "Indispo.",            es: "No dispo." },

  // ── Dashboard exécutif ────────────────────────────
  nav_dashboard:         { fr: "Tableau de bord",     es: "Panel" },
  dash_title:            { fr: "Tableau de bord",     es: "Panel de control" },
  dash_welcome:          { fr: "Bonjour {name}, voici l'état de Bochica aujourd'hui.", es: "Hola {name}, aquí está el estado de Bochica hoy." },
  dash_profit_month:     { fr: "Profit du mois",      es: "Ganancia del mes" },
  dash_revenues_month:   { fr: "Revenus du mois",     es: "Ingresos del mes" },
  dash_expenses_month:   { fr: "Dépenses du mois",    es: "Gastos del mes" },
  dash_vs_last_month:    { fr: "vs mois dernier",     es: "vs mes pasado" },
  dash_vs_last_week:     { fr: "vs semaine dernière", es: "vs semana pasada" },
  dash_critical_stock:   { fr: "Stock critique",      es: "Stock crítico" },
  dash_no_critical:      { fr: "Aucun produit critique 🎉", es: "Ningún producto crítico 🎉" },
  dash_overdue_tasks:    { fr: "Tâches en retard",    es: "Tareas atrasadas" },
  dash_no_overdue:       { fr: "Aucune tâche en retard 👌", es: "Ninguna tarea atrasada 👌" },
  dash_top_expenses:     { fr: "Top dépenses du mois", es: "Principales gastos del mes" },
  dash_no_expenses:      { fr: "Aucune dépense ce mois", es: "Ningún gasto este mes" },
  dash_avg_margin:       { fr: "Marge menu moyenne",  es: "Margen menú promedio" },
  dash_view_all:         { fr: "Voir tout",           es: "Ver todo" },
  dash_view_more:        { fr: "Voir plus",           es: "Ver más" },
  dash_quick_actions:    { fr: "Actions rapides",     es: "Acciones rápidas" },
  dash_due_in:           { fr: "dans {n} jours",      es: "en {n} días" },
  dash_overdue:          { fr: "En retard",           es: "Atrasado" },
  dash_today:            { fr: "Aujourd'hui",         es: "Hoy" },
  dash_tomorrow:         { fr: "Demain",              es: "Mañana" },

  // ── TPS/TVQ ───────────────────────────────────────
  tax_card_title:        { fr: "Échéance TPS/TVQ",    es: "Vencimiento TPS/TVQ" },
  tax_quarter:           { fr: "Trimestre",           es: "Trimestre" },
  tax_due_date:          { fr: "À remettre avant le", es: "A pagar antes del" },
  tax_to_remit:          { fr: "À remettre",          es: "A pagar" },
  tax_collected:         { fr: "Perçue",              es: "Percibida" },
  tax_paid:              { fr: "Payée",               es: "Pagada" },
  tax_difference:        { fr: "Différence",          es: "Diferencia" },
  tax_mark_paid:         { fr: "Marquer comme remis", es: "Marcar como pagado" },
  tax_remitted:          { fr: "Remis le {date}",     es: "Pagado el {date}" },
  tax_no_data:           { fr: "Aucune donnée pour ce trimestre", es: "Sin datos para este trimestre" },
  tax_remittance_history:{ fr: "Historique des remises", es: "Historial de pagos" },
  tax_credit_to_recover: { fr: "Crédit à récupérer",  es: "Crédito a recuperar" },

  // ── Recherche globale ─────────────────────────────
  search_placeholder:    { fr: "Rechercher partout... (Cmd+K)", es: "Buscar en todas partes... (Cmd+K)" },
  search_no_results:     { fr: "Aucun résultat",      es: "Sin resultados" },
  search_keyboard_hint:  { fr: "↑↓ naviguer · ↵ ouvrir · Esc fermer", es: "↑↓ navegar · ↵ abrir · Esc cerrar" },
  search_section_products:    { fr: "Produits inventaire", es: "Productos inventario" },
  search_section_ingredients: { fr: "Ingrédients",    es: "Ingredientes" },
  search_section_recipes:     { fr: "Recettes",       es: "Recetas" },
  search_section_menu:        { fr: "Items du menu",  es: "Items del menú" },
  search_section_employees:   { fr: "Employés",       es: "Empleados" },
  search_section_suppliers:   { fr: "Fournisseurs",   es: "Proveedores" },
};

// ── Variable globale de la langue de l'interface ──
let uiLang = localStorage.getItem("bochica-ui-lang") || "fr";

/**
 * Retourne la traduction d'une clé. Substitue {n}, {name}, etc. via params.
 * Pluriels simples : si params.n est défini, {s} → "" si n<=1, "s" si n>1.
 */
function t(key, params = {}) {
  const entry = TRANSLATIONS[key];
  if (!entry) {
    console.warn(`t('${key}') : clé manquante`);
    return key;
  }
  let str = entry[uiLang] || entry.fr || key;
  // Pluriels {s}
  if (params.n !== undefined) {
    str = str.replace(/\{s\}/g, params.n > 1 ? "s" : "");
  }
  // Substitutions {var}
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return str;
}

/**
 * Bascule la langue de l'interface (FR/ES) et re-render.
 */
function setUILang(lang) {
  if (lang !== "fr" && lang !== "es") return;
  uiLang = lang;
  localStorage.setItem("bochica-ui-lang", lang);
  document.documentElement.lang = lang === "es" ? "es" : "fr-CA";
  // Re-render complet de l'interface
  if (typeof buildSidebar === "function") buildSidebar();
  if (typeof renderPage === "function") renderPage();
  // Si l'écran de login est affiché, le re-render
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen && loginScreen.style.display !== "none" && typeof showLogin === "function") {
    showLogin();
  }
}

function getUILang() { return uiLang; }

// Locale pour toLocaleDateString/toLocaleTimeString selon la langue UI.
function uiLocale() { return uiLang === "es" ? "es-ES" : "fr-CA"; }

// Nom court de jour localisé (0=Lun … 6=Dim, comme DAYS_FR).
const _DAYS_SHORT = {
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
};
function tDayShort(i) { return (_DAYS_SHORT[uiLang] || _DAYS_SHORT.fr)[i] || ""; }

// Traduit une section par défaut, garde les sections personnalisées intactes
function tSection(name) {
  const map = {
    "Toutes": t("all"),
    "Cuisine": t("section_kitchen"),
    "Emballage": t("section_packaging"),
    "Bar": t("section_bar"),
    "Autre": t("section_other"),
  };
  return map[name] || name;
}

// Traduit un type de quart de travail
function tShift(label) {
  const map = {
    "Matin": t("shift_morning"),
    "Soir": t("shift_evening"),
    "Journée": t("shift_day"),
    "Congé": t("shift_leave"),
  };
  return map[label] || label;
}

// Traduit un statut de tâche
function tTaskStatus(status) {
  const map = {
    "À faire": t("task_status_todo"),
    "En cours": t("task_status_doing"),
    "Complété": t("task_status_done"),
  };
  return map[status] || status;
}

// Traduit une priorité de tâche
function tPriority(prio) {
  const map = {
    "basse": t("task_prio_low"),
    "moyenne": t("task_prio_med"),
    "haute": t("task_prio_high"),
  };
  return map[prio] || prio;
}
