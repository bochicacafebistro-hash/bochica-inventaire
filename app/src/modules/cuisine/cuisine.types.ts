/** Collections `menu`, `ingredients`, `recipes` (format v1). */
export interface RecipeLine {
  ingredientId: string;
  qty: number;
}

export interface MenuItem {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  available?: boolean;
  recipe?: RecipeLine[];
}

export interface Ingredient {
  id: string;
  name?: string;
  unit?: string;
  costPerUnit?: number;
  category?: string;
  notes?: string;
}

export interface Recipe {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredients?: string; // markdown, une ligne par ingrédient
  steps?: string; // markdown
  tips?: string; // markdown
}
