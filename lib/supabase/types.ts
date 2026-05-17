export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  creator_handle: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  cuisine: string | null;
  dietary_tags: string[] | null;
  difficulty: "easy" | "medium" | "hard" | null;
  total_time_min: number | null;
  active_time_min: number | null;
  servings: number | null;
  is_recipe: boolean;
  low_audio_signal: boolean;
  favorited: boolean;
  times_cooked: number;
  user_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  recipe_id: string;
  position: number;
  item: string;
  quantity: number | null;
  unit: string | null;
  descriptor: string | null;
  was_vague: boolean;
  notes: string[] | null;
  confidence: number;
}

export interface Step {
  id: string;
  recipe_id: string;
  position: number;
  instruction: string;
  duration_sec: number | null;
  approximate: boolean;
  temperature: string | null;
  confidence: number;
}

export interface Equipment {
  id: string;
  recipe_id: string;
  item: string;
}

export interface CookLog {
  id: string;
  recipe_id: string;
  user_id: string;
  cooked_at: string;
  rating: number | null;
  notes: string | null;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  source_recipe_id: string | null;
}

export type RecipeWithDetails = Recipe & {
  ingredients: Ingredient[];
  steps: Step[];
  equipment: Equipment[];
};
