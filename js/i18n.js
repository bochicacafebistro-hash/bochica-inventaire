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
  exp_profit:            { fr: "Profit",              es: "Ganancia" },
  exp_deficit:           { fr: "Déficit",             es: "Déficit" },
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
  shift_off:             { fr: "Congé",               es: "Libre" },

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
    "Congé": t("shift_off"),
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
