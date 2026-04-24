// ═══════════════════════════════════════════════════════════════
// CUISINE — Menu, Fournisseurs, Ingrédients, Recettes
// (Extrait de l'ancien pages-admin.js)
// ═══════════════════════════════════════════════════════════════

function renderMenu() {
  const cats = ["Toutes", ...MENU_CATS];
  const filtered = menuItems.filter(m => activeMenuCat === "Toutes" || m.category === activeMenuCat);
  const available = menuItems.filter(m => m.available !== false).length;
  return `<div class="page">
    <div class="toolbar">
      <div><h2 style="font-size:18px">${t("menu_title")}</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">${available} item${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}</p></div>
      <button class="btn btn-primary" onclick="openMenuModal()">${icon("plus", 16)} ${t("menu_add")}</button>
    </div>
    <div class="sec-tabs">${cats.map(c => `<button class="sec-btn ${activeMenuCat === c ? "active" : ""}" onclick="setMenuCat('${c}')">${c}</button>`).join("")}</div>
    ${filtered.length === 0
      ? `<div class="empty"><div class="empty-state-icon">${icon("utensils", 36)}</div>Aucun item dans cette catégorie.</div>`
      : `<div class="recipes-grid">${filtered.map(m => {
          const fc = computeRecipeFoodCost(m.recipe || []);
          const hasRec = Array.isArray(m.recipe) && m.recipe.length > 0;
          const margin = (m.price || 0) - fc;
          const marginPct = (m.price || 0) > 0 ? (margin / m.price) * 100 : 0;
          let cardClass = "recipe-card--no-recipe";
          if (hasRec && m.price > 0) {
            if (marginPct >= 70) cardClass = "recipe-card--good";
            else if (marginPct >= 50) cardClass = "recipe-card--ok";
            else cardClass = "recipe-card--bad";
          }
          if (m.available === false) cardClass += " recipe-card--unavailable";
          // Liste compacte des ingrédients (max 4 affichés)
          const ingList = (m.recipe || []).map(r => {
            const ing = ingredients.find(i => i.id === r.ingredientId);
            return ing ? `${r.qty} ${ing.unit} <strong>${esc(ing.name)}</strong>` : null;
          }).filter(Boolean);
          const visibleIng = ingList.slice(0, 4);
          const extraCount = ingList.length - visibleIng.length;

          return `<div class="recipe-card ${cardClass}">
            <div class="recipe-card__head">
              <div class="flex-1">
                <h3 class="recipe-card__name">${m.name || "?"}</h3>
                <div class="recipe-card__cat">
                  ${m.category || ""}
                  ${m.available === false ? ` · <span class="text-warning">${t("menu_unavailable_short")}</span>` : ""}
                </div>
              </div>
              <div class="menu-wrap">
                <button class="dots-btn" onclick="toggleDrop('mn${m.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
                <div class="dropdown" id="drop-mn${m.id}">
                  <button onclick="openMenuModal('${m.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
                  <button onclick="duplicateItem('menu','${m.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
                  <button onclick="toggleMenuAvailable('${m.id}',${m.available !== false});closeAllDrops()">${icon(m.available === false ? "check" : "x", 14)} ${m.available === false ? t("menu_available") : t("menu_unavailable")}</button>
                  <div class="sep"></div>
                  <button class="text-danger" onclick="askDelete('menu','${m.id}','${esc(m.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
                </div>
              </div>
            </div>

            ${m.description ? `<div class="recipe-card__desc">${esc(m.description)}</div>` : ""}

            <div class="recipe-card__metrics">
              <div class="recipe-card__metric">
                <div class="recipe-card__metric-label">${t("menu_food_cost")}</div>
                <div class="recipe-card__metric-value text-secondary">${hasRec ? fmtMoney(fc) : "—"}</div>
              </div>
              <div class="recipe-card__metric">
                <div class="recipe-card__metric-label">${t("menu_price")}</div>
                <div class="recipe-card__metric-value">${m.price > 0 ? fmtMoney(m.price) : "—"}</div>
              </div>
              <div class="recipe-card__metric">
                <div class="recipe-card__metric-label">${t("menu_margin_label")}</div>
                <div class="recipe-card__margin-pct">${hasRec && m.price > 0 ? marginPct.toFixed(0) + "%" : "—"}</div>
              </div>
            </div>

            ${hasRec ? `
              <div class="recipe-card__ingredients">
                ${visibleIng.join(" · ")}${extraCount > 0 ? ` <span class="text-muted">+${extraCount}</span>` : ""}
              </div>
            ` : `
              <div class="recipe-card__no-recipe">
                ${icon("plus", 14)} ${t("menu_no_composition")}
              </div>
            `}
          </div>`;
        }).join("")}</div>`}
  </div>`;
}

async function toggleMenuAvailable(id, current) {
  await db.collection("menu").doc(id).update({ available: !current });
}

// ── Modal Item Menu (avec composition / recette) ──
let menuRecipeRows = []; // état temporaire pour la composition en cours d'édition

function openMenuModal(id) {
  const m = id ? menuItems.find(x => x.id === id) : null;
  // Initialiser la composition (recipe) depuis l'item ou vide
  menuRecipeRows = (m?.recipe && Array.isArray(m.recipe)) ? [...m.recipe] : [];

  showModal(`<div class="modal" style="max-width:580px">
    <div class="modal-header">
      <h3>${m ? t("menu_modal_edit") : t("menu_modal_add")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>${t("menu_field_name")}<input id="mn-name" value="${esc(m?.name || "")}"/></label>
    <label>${t("menu_field_desc")}<textarea id="mn-desc" style="height:60px">${m?.description || ""}</textarea></label>
    <div class="form-row">
      <label>${t("menu_field_price")}<input id="mn-price" type="number" step="0.01" value="${m?.price || ""}" oninput="updateRecipeSummary()"/></label>
      <label>${t("menu_field_category")}<select id="mn-cat">${MENU_CATS.map(c => `<option value="${c}" ${(m?.category || "Plats principaux") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    </div>

    <!-- ═══ COMPOSITION (recette) ═══ -->
    <div style="margin-top:14px">
      <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="icon-inline">${icon("utensils", 14)} ${t("menu_composition")}</span>
        <button type="button" class="btn-icon-only" onclick="addRecipeRow()" aria-label="${t("menu_add_ingredient")}" style="width:32px;height:32px">${icon("plus", 14)}</button>
      </label>
      <small class="field-hint" style="margin-bottom:8px;display:block">${t("menu_composition_hint")}</small>

      <div class="composition-box" id="composition-box">
        <div id="composition-rows"></div>
        <div id="composition-totals"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveMenuItem('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);

  // Render initial des lignes de composition
  renderCompositionRows();
}

// Génère le HTML des lignes de composition
function renderCompositionRows() {
  const container = document.getElementById("composition-rows");
  if (!container) return;

  if (ingredients.length === 0) {
    container.innerHTML = `<div class="composition-empty">${t("ing_no_ingredients")}</div>`;
    updateRecipeSummary();
    return;
  }

  if (menuRecipeRows.length === 0) {
    container.innerHTML = `<div class="composition-empty">${t("menu_no_ingredients")}</div>`;
    updateRecipeSummary();
    return;
  }

  container.innerHTML = menuRecipeRows.map((row, idx) => {
    const ing = ingredients.find(i => i.id === row.ingredientId);
    const cost = ing ? Number(ing.costPerUnit || 0) * Number(row.qty || 0) : 0;
    return `<div class="composition-row" data-idx="${idx}">
      <select onchange="updateRecipeRow(${idx}, 'ingredientId', this.value)" aria-label="${t("menu_select_ingredient")}">
        <option value="">${t("menu_select_ingredient")}</option>
        ${ingredients.map(i => `<option value="${i.id}" ${i.id === row.ingredientId ? "selected" : ""}>${esc(i.name)} (${fmtMoney(i.costPerUnit || 0)}/${i.unit || "—"})</option>`).join("")}
      </select>
      <input type="number" step="0.01" min="0" placeholder="${t("menu_quantity")}" value="${row.qty || ""}" oninput="updateRecipeRow(${idx}, 'qty', this.value)" aria-label="${t("menu_quantity")}"/>
      <span class="composition-cost">${fmtMoney(cost)}</span>
      <button type="button" class="composition-remove" onclick="removeRecipeRow(${idx})" aria-label="${t("delete")}">${icon("trash", 16)}</button>
    </div>`;
  }).join("");

  updateRecipeSummary();
}

function addRecipeRow() {
  menuRecipeRows.push({ ingredientId: "", qty: 1 });
  renderCompositionRows();
}

function updateRecipeRow(idx, field, value) {
  if (!menuRecipeRows[idx]) return;
  if (field === "qty") menuRecipeRows[idx][field] = Number(value) || 0;
  else menuRecipeRows[idx][field] = value;
  // Update juste la ligne et le sommaire (pas tout le rendu pour préserver focus)
  const row = document.querySelector(`.composition-row[data-idx="${idx}"]`);
  if (row && field === "ingredientId") {
    // Re-render complet pour mettre à jour le coût affiché
    renderCompositionRows();
  } else if (row) {
    const costSpan = row.querySelector(".composition-cost");
    const ing = ingredients.find(i => i.id === menuRecipeRows[idx].ingredientId);
    const cost = ing ? Number(ing.costPerUnit || 0) * Number(menuRecipeRows[idx].qty || 0) : 0;
    if (costSpan) costSpan.textContent = fmtMoney(cost);
    updateRecipeSummary();
  }
}

function removeRecipeRow(idx) {
  menuRecipeRows.splice(idx, 1);
  renderCompositionRows();
}

// Met à jour le résumé : food cost total + marge calculée
function updateRecipeSummary() {
  const totals = document.getElementById("composition-totals");
  if (!totals) return;

  const foodCost = computeRecipeFoodCost(menuRecipeRows);
  const priceEl = document.getElementById("mn-price");
  const price = priceEl ? Number(priceEl.value) || 0 : 0;
  const margin = price - foodCost;
  const marginPct = price > 0 ? (margin / price) * 100 : 0;

  let marginClass = "composition-margin--bad";
  if (marginPct >= 70) marginClass = "composition-margin--good";
  else if (marginPct >= 50) marginClass = "composition-margin--ok";

  totals.innerHTML = `
    <div class="composition-summary">
      <span class="composition-summary__label">${t("menu_food_cost_total")}</span>
      <span class="composition-summary__value">${fmtMoney(foodCost)}</span>
    </div>
    ${price > 0 && foodCost > 0 ? `
      <div class="composition-margin ${marginClass}">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${t("menu_calculated_margin")}</span>
        <span style="font-family:var(--font-heading);font-weight:700;font-size:16px;font-style:italic">${fmtMoney(margin)} (${marginPct.toFixed(1)}%)</span>
      </div>
    ` : ""}
  `;
}

// Calcule le food cost total d'une recette (array d'objets {ingredientId, qty})
function computeRecipeFoodCost(recipe) {
  if (!Array.isArray(recipe)) return 0;
  return recipe.reduce((total, row) => {
    const ing = ingredients.find(i => i.id === row.ingredientId);
    if (!ing) return total;
    return total + (Number(ing.costPerUnit || 0) * Number(row.qty || 0));
  }, 0);
}

async function saveMenuItem(id) {
  const name = document.getElementById("mn-name").value.trim();
  if (!name) return toast(t("err_enter_name"), "error");
  // Filtrer les lignes vides (pas d'ingrédient sélectionné)
  const cleanRecipe = menuRecipeRows.filter(r => r.ingredientId && Number(r.qty) > 0);
  const data = {
    name,
    description: document.getElementById("mn-desc").value,
    price: Number(document.getElementById("mn-price").value) || 0,
    category: document.getElementById("mn-cat").value,
    available: true,
    recipe: cleanRecipe
  };
  if (id) await db.collection("menu").doc(id).update(data);
  else { const nid = genId(); await db.collection("menu").doc(nid).set({ ...data, id: nid }); }
  menuRecipeRows = []; // Reset
  closeModal();
}


function renderFournisseurs() {
  const activeProducts = products.filter(p => !p.archived);
  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">${t("sup_title")}</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openSupplierModal()">${icon("plus", 16)} ${t("sup_add")}</button>` : ""}
    </div>
    ${suppliers.length === 0
      ? `<div class="empty"><div style="font-size:40px;margin-bottom:8px">🏪</div>Aucun fournisseur.</div>`
      : `<div class="supplier-grid">${suppliers.map(s => {
          const linked = activeProducts.filter(p => p.supplierId === s.id);
          return `<div class="supplier-card">
            <div style="display:flex;justify-content:space-between">
              <div>
                <div style="font-weight:700;font-size:16px">🏪 ${s.name || ""}</div>
                ${s.contact ? `<div style="color:var(--text2);font-size:13px;margin-top:4px">${icon("phone", 12)} ${s.contact}</div>` : ""}
                ${s.email ? `<div style="color:var(--text2);font-size:13px">✉️ ${s.email}</div>` : ""}
                ${s.notes ? `<div style="color:var(--text3);font-size:12px;margin-top:6px;font-style:italic">${s.notes}</div>` : ""}
              </div>
              ${isAdmin ? `<div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('sup${s.id}')">${icon("more-vertical", 16)}</button>
                <div class="dropdown" id="drop-sup${s.id}">
                  <button onclick="openSupplierModal('${s.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
                  <button onclick="duplicateItem('suppliers','${s.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
                  <div class="sep"></div>
                  <button class="text-danger" onclick="askDelete('suppliers','${s.id}','${esc(s.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
                </div></div>` : ""}
            </div>
            ${linked.length ? `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px;font-weight:600">PRODUITS LIÉS</div>
              ${linked.map(p => `<span class="tag">${p.name}</span>`).join("")}
            </div>` : ""}
          </div>`;
        }).join("")}</div>`}
  </div>`;
}

function openSupplierModal(id) {
  const s = id ? suppliers.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${s ? "Modifier" : "Ajouter"} un fournisseur</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <label>Nom<input id="s-name" value="${esc(s?.name || "")}"/></label>
    <label>Téléphone<input id="s-contact" value="${esc(s?.contact || "")}"/></label>
    <label>Courriel<input id="s-email" value="${esc(s?.email || "")}"/></label>
    <label>${t("exp_table_notes")}<textarea id="s-notes" style="height:70px">${s?.notes || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveSupplier('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveSupplier(id) {
  const name = document.getElementById("s-name").value.trim();
  if (!name) return toast("Entrez un nom.", "error");
  const data = {
    name,
    contact: document.getElementById("s-contact").value,
    email: document.getElementById("s-email").value,
    notes: document.getElementById("s-notes").value
  };
  if (id) await db.collection("suppliers").doc(id).update({ ...data });
  else { const nid = genId(); await db.collection("suppliers").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ═══════════════════════════════════════════════════════════════
// RAPPORT PERSONNALISÉ — Export Excel et PDF
// ═══════════════════════════════════════════════════════════════

function tIngCat(key) {
  const map = {
    base: t("ing_cat_base"),
    protein: t("ing_cat_protein"),
    garnish: t("ing_cat_garnish"),
    sauce: t("ing_cat_sauce"),
    vegetable: t("ing_cat_vegetable"),
    drink: t("ing_cat_drink"),
    dessert: t("ing_cat_dessert"),
    other: t("ing_cat_other"),
  };
  return map[key] || key;
}

function setIngredientCat(cat) {
  activeIngredientCat = cat;
  renderPage();
}

function renderIngredients() {
  const isMobile = window.innerWidth <= 640;
  const totalIngredients = ingredients.length;
  const avgCost = totalIngredients > 0
    ? ingredients.reduce((s, i) => s + Number(i.costPerUnit || 0), 0) / totalIngredients
    : 0;

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${t("ing_title")}</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("ing_subtitle")}</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openIngredientModal()">${icon("plus", 16)} ${t("ing_add")}</button>` : ""}
    </div>`;

  if (totalIngredients > 0) {
    h += `<div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-num" style="color:var(--accent)">${totalIngredients}</div>
        <div class="stat-label">${icon("tag", 14)} ${t("ing_title")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:var(--text);font-size:20px">${fmtMoney(avgCost)}</div>
        <div class="stat-label">${icon("dollar-sign", 14)} ${t("ing_field_cost")}</div>
      </div>
    </div>`;
  }

  if (totalIngredients === 0) {
    h += `<div class="empty">
      <div class="empty-state-icon">${icon("utensils", 48)}</div>
      ${t("ing_no_ingredients")}
    </div>`;
    return h + `</div>`;
  }

  // Liste groupée par catégorie (ordre prédéfini)
  // Catégories ordonnées : Base, Protéine, Garniture, Sauce, Légume, Boisson, Dessert, Autre
  INGREDIENT_CATEGORIES.forEach(cat => {
    const items = ingredients.filter(i => i.category === cat)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (items.length === 0) return;

    h += `<section class="ing-section">
      <h3 class="ing-section__title">
        <span class="ing-section__title-icon">${icon("folder", 14)}</span>
        ${tIngCat(cat)}
        <span class="ing-section__count">${items.length}</span>
      </h3>`;

    if (isMobile) {
      // Mobile : liste compacte une ligne par item
      h += `<div class="ing-list-mobile">`;
      items.forEach(ing => {
        h += `<div class="ing-row-mobile">
          <div class="ing-row-mobile__main">
            <div class="ing-row-mobile__name">${esc(ing.name || "?")}</div>
            ${ing.notes ? `<div class="ing-row-mobile__notes">${esc(ing.notes)}</div>` : ""}
          </div>
          <div class="ing-row-mobile__price">
            ${fmtMoney(ing.costPerUnit || 0)}
            <small>/ ${esc(ing.unit || "—")}</small>
          </div>
          ${isAdmin ? `<div class="menu-wrap">
            <button class="dots-btn" onclick="toggleDrop('ing${ing.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-ing${ing.id}">
              <button onclick="openIngredientModal('${ing.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
              <button onclick="duplicateItem('ingredients','${ing.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
              <div class="sep"></div>
              <button class="text-danger" onclick="askDelete('ingredients','${ing.id}','${esc(ing.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
            </div>
          </div>` : ""}
        </div>`;
      });
      h += `</div>`;
    } else {
      // Desktop : tableau
      h += `<div class="table-wrap" style="margin-bottom:24px">
        <table>
          <thead><tr>
            <th>${t("ing_field_name")}</th>
            <th style="width:80px">${t("ing_field_unit")}</th>
            <th style="width:120px;text-align:right">${t("ing_field_cost")}</th>
            <th style="width:200px;color:var(--text3)">${t("ing_field_notes")}</th>
            ${isAdmin ? `<th style="width:50px"></th>` : ""}
          </tr></thead>
          <tbody>`;
      items.forEach(ing => {
        h += `<tr>
          <td><strong>${esc(ing.name || "?")}</strong></td>
          <td class="text-secondary">${esc(ing.unit || "—")}</td>
          <td style="text-align:right;font-family:var(--font-heading);font-weight:700;font-style:italic;color:var(--accent)">${fmtMoney(ing.costPerUnit || 0)}</td>
          <td style="color:var(--text3);font-size:12px;font-style:italic">${esc(ing.notes || "")}</td>
          ${isAdmin ? `<td><div class="menu-wrap">
            <button class="dots-btn" onclick="toggleDrop('ing${ing.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-ing${ing.id}">
              <button onclick="openIngredientModal('${ing.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
              <button onclick="duplicateItem('ingredients','${ing.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
              <div class="sep"></div>
              <button class="text-danger" onclick="askDelete('ingredients','${ing.id}','${esc(ing.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
            </div>
          </div></td>` : ""}
        </tr>`;
      });
      h += `</tbody></table></div>`;
    }
    h += `</section>`;
  });

  return h + `</div>`;
}

// ── Modal Ingrédient (ajout / édition) ─────────────
function openIngredientModal(id) {
  const ing = id ? ingredients.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header">
      <h3>${ing ? t("ing_modal_edit") : t("ing_modal_add")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>${t("ing_field_name")}<input id="ing-name" value="${esc(ing?.name || "")}"/></label>

    <div class="form-row">
      <label>${t("ing_field_unit")}
        <input id="ing-unit" value="${esc(ing?.unit || "unité")}"/>
        <small class="field-hint">${t("ing_field_unit_hint")}</small>
      </label>
      <label>${t("ing_field_cost")}
        <input id="ing-cost" type="number" step="0.01" min="0" value="${ing?.costPerUnit || ""}"/>
      </label>
    </div>

    <label>${t("ing_field_category")}
      <select id="ing-cat">
        ${INGREDIENT_CATEGORIES.map(c => `<option value="${c}" ${(ing?.category || "other") === c ? "selected" : ""}>${tIngCat(c)}</option>`).join("")}
      </select>
    </label>

    <label>${t("ing_field_notes")}<textarea id="ing-notes" style="height:60px">${ing?.notes || ""}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveIngredient('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveIngredient(id) {
  const name = document.getElementById("ing-name").value.trim();
  if (!name) return toast(t("err_enter_name"), "error");
  const cost = Number(document.getElementById("ing-cost").value) || 0;
  const data = {
    name,
    unit: document.getElementById("ing-unit").value.trim() || "unité",
    costPerUnit: cost,
    category: document.getElementById("ing-cat").value,
    notes: document.getElementById("ing-notes").value.trim()
  };
  if (id) await db.collection("ingredients").doc(id).update(data);
  else { const nid = genId(); await db.collection("ingredients").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ═══════════════════════════════════════════════════════════════
// PAGE RECETTES — Livre de cuisine pour préparation des plats
// (Indépendante du menu, accessible aux admins ET employés)
// ═══════════════════════════════════════════════════════════════

const RECIPE_CATEGORIES = ["main", "starter", "dessert", "drink", "sauce", "base", "other"];

function tRecipeCat(cat) {
  const map = {
    main: t("rec_cat_main"),
    starter: t("rec_cat_starter"),
    dessert: t("rec_cat_dessert"),
    drink: t("rec_cat_drink"),
    sauce: t("rec_cat_sauce"),
    base: t("rec_cat_base"),
    other: t("rec_cat_other"),
  };
  return map[cat] || cat;
}

function setRecipeFilter(f) { recipeFilter = f; renderPage(); }

function renderRecettes() {
  // Filtrage par catégorie
  let filtered = recipeFilter === "all"
    ? recipes
    : recipes.filter(r => r.category === recipeFilter);

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${t("rec_title")}</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("rec_subtitle")}</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openRecipeModal()">${icon("plus", 16)} ${t("rec_add")}</button>` : ""}
    </div>`;

  // Filtres par catégorie (seulement si recettes existent)
  if (recipes.length > 0) {
    h += `<div class="section-tabs section-tabs--scroll" role="tablist" aria-label="${t("filter_by_category")}">
      <button class="sec-btn ${recipeFilter === "all" ? "active" : ""}" onclick="setRecipeFilter('all')">${t("rec_filter_all")}<span class="badge-count">${recipes.length}</span></button>
      ${RECIPE_CATEGORIES.map(cat => {
        const cnt = recipes.filter(r => r.category === cat).length;
        if (cnt === 0) return "";
        return `<button class="sec-btn ${recipeFilter === cat ? "active" : ""}" onclick="setRecipeFilter('${cat}')">${tRecipeCat(cat)}<span class="badge-count">${cnt}</span></button>`;
      }).join("")}
    </div>`;
  }

  if (filtered.length === 0) {
    h += `<div class="empty">
      <div class="empty-state-icon">${icon("file-text", 48)}</div>
      ${t("rec_no_recipes")}
    </div>`;
  } else {
    h += `<div class="recipes-grid">`;
    filtered.forEach(r => {
      const totalTime = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);
      const ingCount = (r.ingredients || "").trim().split(/\n/).filter(l => l.trim()).length;

      h += `<div class="recipe-book-card" onclick="openRecipeViewModal('${r.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openRecipeViewModal('${r.id}')}">
        <div class="recipe-book-card__head">
          <div class="flex-1">
            <h3 class="recipe-book-card__name">${esc(r.name || "?")}</h3>
            ${r.category ? `<div class="recipe-book-card__cat">${tRecipeCat(r.category)}</div>` : ""}
          </div>
          ${isAdmin ? `<div class="menu-wrap" onclick="event.stopPropagation()">
            <button class="dots-btn" onclick="toggleDrop('rec${r.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-rec${r.id}">
              <button onclick="openRecipeModal('${r.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
              <button onclick="duplicateItem('recipes','${r.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
              <div class="sep"></div>
              <button class="text-danger" onclick="askDelete('recipes','${r.id}','${esc(r.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
            </div>
          </div>` : ""}
        </div>

        ${r.description ? `<div class="recipe-book-card__desc">${esc(r.description)}</div>` : ""}

        <div class="recipe-book-card__meta">
          ${totalTime > 0 ? `<span class="icon-inline">${icon("clock", 13)} ${totalTime} ${t("rec_minutes")}</span>` : ""}
          ${r.servings ? `<span class="icon-inline">${icon("users", 13)} ${r.servings} ${r.servings > 1 ? t("rec_servings_label_pl") : t("rec_servings_label")}</span>` : ""}
          ${ingCount > 0 ? `<span class="icon-inline">${icon("tag", 13)} ${ingCount} ${ingCount > 1 ? t("chart_categories_pl") : t("chart_categories")}</span>` : ""}
        </div>
      </div>`;
    });
    h += `</div>`;
  }

  return h + `</div>`;
}

// ── Modal Visualisation Recette (lecture seule, pour cuisinier) ──
function openRecipeViewModal(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  const totalTime = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);

  showModal(`<div class="modal" style="max-width:640px;padding:0">
    <div class="recipe-view__header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div class="flex-1">
          <h2 class="recipe-view__title">${esc(r.name || "?")}</h2>
          ${r.description ? `<p class="recipe-view__desc">${esc(r.description)}</p>` : ""}
          ${r.category ? `<span class="recipe-view__cat">${tRecipeCat(r.category)}</span>` : ""}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon-only" onclick="window.print()" aria-label="${t("rec_print")}" title="${t("rec_print")}">${icon("printer", 16)}</button>
          ${isAdmin ? `<button class="btn-icon-only" onclick="closeModal();openRecipeModal('${r.id}')" aria-label="${t("dropdown_edit")}" title="${t("dropdown_edit")}">${icon("pencil", 16)}</button>` : ""}
          <button class="btn-icon-only" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 16)}</button>
        </div>
      </div>

      <div class="recipe-view__meta">
        ${r.servings ? `<div class="recipe-view__meta-item">${icon("users", 18)}<div><div class="recipe-view__meta-label">${t("rec_field_servings")}</div><div class="recipe-view__meta-value">${r.servings}</div></div></div>` : ""}
        ${r.prepTime ? `<div class="recipe-view__meta-item">${icon("clock", 18)}<div><div class="recipe-view__meta-label">${t("rec_field_prep_time")}</div><div class="recipe-view__meta-value">${r.prepTime} ${t("rec_minutes")}</div></div></div>` : ""}
        ${r.cookTime ? `<div class="recipe-view__meta-item">${icon("utensils", 18)}<div><div class="recipe-view__meta-label">${t("rec_field_cook_time")}</div><div class="recipe-view__meta-value">${r.cookTime} ${t("rec_minutes")}</div></div></div>` : ""}
        ${totalTime > 0 ? `<div class="recipe-view__meta-item">${icon("trending-up", 18)}<div><div class="recipe-view__meta-label">${t("rec_total_time")}</div><div class="recipe-view__meta-value"><strong>${totalTime} ${t("rec_minutes")}</strong></div></div></div>` : ""}
      </div>
    </div>

    <div class="recipe-view__body">
      <section class="recipe-view__section">
        <h3 class="recipe-view__section-title">${icon("tag", 16)} ${t("rec_field_ingredients")}</h3>
        <div class="recipe-view__ingredients md-content">
          ${r.ingredients ? renderMarkdown(autoMarkdownList(r.ingredients, "bullet")) : `<div class="md-empty">${t("rec_no_ingredients")}</div>`}
        </div>
      </section>

      <section class="recipe-view__section">
        <h3 class="recipe-view__section-title">${icon("file-text", 16)} ${t("rec_field_steps")}</h3>
        <div class="recipe-view__steps md-content">
          ${r.steps ? renderMarkdown(autoMarkdownList(r.steps, "numbered")) : `<div class="md-empty">${t("rec_no_steps")}</div>`}
        </div>
      </section>

      ${r.tips ? `<section class="recipe-view__tips">
        <h3 class="recipe-view__section-title">${icon("lightbulb", 16)} ${t("rec_field_tips")}</h3>
        <div class="md-content">${renderMarkdown(r.tips)}</div>
      </section>` : ""}
    </div>
  </div>`);
}

// ── Modal Édition Recette (admin) ──
function openRecipeModal(id) {
  const r = id ? recipes.find(x => x.id === id) : null;
  showModal(`<div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h3>${r ? t("rec_modal_edit") : t("rec_modal_add")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>${t("rec_field_name")}<input id="rec-name" value="${esc(r?.name || "")}"/></label>
    <label>${t("rec_field_desc")}<textarea id="rec-desc" style="height:50px">${esc(r?.description || "")}</textarea></label>

    <div class="form-row">
      <label>${t("rec_field_category")}
        <select id="rec-cat">
          ${RECIPE_CATEGORIES.map(c => `<option value="${c}" ${(r?.category || "main") === c ? "selected" : ""}>${tRecipeCat(c)}</option>`).join("")}
        </select>
      </label>
      <label>${t("rec_field_servings")}<input id="rec-servings" type="number" min="1" value="${r?.servings || 1}"/></label>
    </div>

    <div class="form-row">
      <label>${t("rec_field_prep_time")}<input id="rec-prep" type="number" min="0" value="${r?.prepTime || ""}"/></label>
      <label>${t("rec_field_cook_time")}<input id="rec-cook" type="number" min="0" value="${r?.cookTime || ""}"/></label>
    </div>

    <label>${t("rec_field_ingredients")}
      ${mdToolbar("rec-ingredients")}
      <textarea id="rec-ingredients" class="md-input" style="height:140px;font-family:var(--font-body)">${esc(r?.ingredients || "")}</textarea>
      <small class="field-hint">${t("rec_field_ingredients_hint")} · Formatage : <strong>**gras**</strong>, <em>*italique*</em>, - puces, 1. numéro</small>
    </label>

    <label>${t("rec_field_steps")}
      ${mdToolbar("rec-steps")}
      <textarea id="rec-steps" class="md-input" style="height:200px;font-family:var(--font-body)">${esc(r?.steps || "")}</textarea>
      <small class="field-hint">${t("rec_field_steps_hint")} · Formatage : <strong>**gras**</strong>, <em>*italique*</em>, 1. numéros</small>
    </label>

    <label>${t("rec_field_tips")}
      ${mdToolbar("rec-tips")}
      <textarea id="rec-tips" class="md-input" style="height:100px">${esc(r?.tips || "")}</textarea>
    </label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveRecipe('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
  // Raccourcis clavier Ctrl/Cmd+B et Ctrl/Cmd+I sur les textareas markdown
  setTimeout(() => {
    mdAttachShortcuts("rec-ingredients");
    mdAttachShortcuts("rec-steps");
    mdAttachShortcuts("rec-tips");
  }, 50);
}

async function saveRecipe(id) {
  const name = document.getElementById("rec-name").value.trim();
  if (!name) return toast(t("err_enter_name"), "error");
  const data = {
    name,
    description: document.getElementById("rec-desc").value.trim(),
    category: document.getElementById("rec-cat").value,
    servings: Number(document.getElementById("rec-servings").value) || 1,
    prepTime: Number(document.getElementById("rec-prep").value) || 0,
    cookTime: Number(document.getElementById("rec-cook").value) || 0,
    ingredients: document.getElementById("rec-ingredients").value,
    steps: document.getElementById("rec-steps").value,
    tips: document.getElementById("rec-tips").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (id) await db.collection("recipes").doc(id).update(data);
  else { const nid = genId(); await db.collection("recipes").doc(nid).set({ ...data, id: nid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  closeModal();
}

// ═══════════════════════════════════════════════════════════════
// LEGACY : ancienne page Recettes (analyse rentabilité du menu)
// Renommée en renderMenuAnalysis - non utilisée pour l'instant
// ═══════════════════════════════════════════════════════════════
