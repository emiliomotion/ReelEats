"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// Simple keyword-based category classifier
function categorize(item: string): string {
  const i = item.toLowerCase();
  if (/\b(onion|garlic|tomato|pepper|zucchini|carrot|celery|lettuce|spinach|kale|mushroom|potato|sweet potato|corn|broccoli|cauliflower|cucumber|apple|lemon|lime|orange|banana|berry|herb|parsley|basil|cilantro|thyme|rosemary|mint|ginger|avocado)\b/.test(i)) return "produce";
  if (/\b(milk|butter|cream|cheese|yogurt|egg|sour cream|heavy cream|parmesan|mozzarella|feta|cheddar|ricotta)\b/.test(i)) return "dairy";
  if (/\b(chicken|beef|pork|salmon|tuna|shrimp|turkey|lamb|bacon|sausage|fish|steak|ground)\b/.test(i)) return "meat & seafood";
  if (/\b(flour|sugar|salt|pepper|oil|olive oil|vinegar|soy sauce|pasta|rice|bread|oat|baking soda|baking powder|cornstarch|honey|maple syrup|canned|tomato paste|broth|stock|bean|lentil|chickpea|coconut milk|vanilla|cocoa|chocolate|coffee)\b/.test(i)) return "pantry";
  if (/\b(frozen|ice cream)\b/.test(i)) return "frozen";
  return "other";
}

interface ShoppingListItem {
  id: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  source_recipe_id: string | null;
}

interface RecipeIngredient {
  id: string;
  item: string;
  quantity: number | null;
  unit: string | null;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialList: Record<string, any> | null;
  recipes: Array<{ id: string; title: string; ingredients: RecipeIngredient[] }>;
}

export function ShoppingListClient({ initialList, recipes }: Props) {
  const [items, setItems] = useState<ShoppingListItem[]>(
    initialList?.shopping_list_items?.sort((a: ShoppingListItem, b: ShoppingListItem) =>
      (a.category ?? "").localeCompare(b.category ?? "")
    ) ?? []
  );
  const [listId, setListId] = useState<string | null>(initialList?.id ?? null);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());

  async function ensureList(): Promise<string> {
    if (listId) return listId;
    const supabase = createClient();
    const { data } = await supabase
      .from("shopping_lists")
      .insert({ name: "Shopping List" })
      .select()
      .single();
    setListId(data.id);
    return data.id;
  }

  async function addRecipesToList() {
    if (selectedRecipes.size === 0) return;

    const supabase = createClient();
    const id = await ensureList();

    // Consolidate ingredients across selected recipes
    const combined = new Map<string, { quantity: number | null; unit: string | null; source_recipe_id: string }>();

    for (const recipeId of Array.from(selectedRecipes)) {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) continue;

      for (const ing of recipe.ingredients) {
        const key = `${ing.item}::${ing.unit ?? ""}`;
        if (combined.has(key)) {
          const existing = combined.get(key)!;
          if (existing.quantity !== null && ing.quantity !== null) {
            existing.quantity += ing.quantity;
          }
        } else {
          combined.set(key, {
            quantity: ing.quantity,
            unit: ing.unit,
            source_recipe_id: recipeId,
          });
        }
      }
    }

    const newItems = Array.from(combined.entries()).map(([key, val]) => ({
      shopping_list_id: id,
      item: key.split("::")[0],
      quantity: val.quantity,
      unit: val.unit,
      category: categorize(key.split("::")[0]),
      checked: false,
      source_recipe_id: val.source_recipe_id,
    }));

    const { data: inserted } = await supabase
      .from("shopping_list_items")
      .insert(newItems)
      .select();

    setItems((prev) => [...prev, ...(inserted ?? [])].sort((a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "")
    ));
    setSelectedRecipes(new Set());
  }

  async function toggleItem(id: string, checked: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked } : i)));
    const supabase = createClient();
    await supabase.from("shopping_list_items").update({ checked }).eq("id", id);
  }

  async function clearChecked() {
    const checkedIds = items.filter((i) => i.checked).map((i) => i.id);
    if (checkedIds.length === 0) return;
    setItems((prev) => prev.filter((i) => !i.checked));
    const supabase = createClient();
    await supabase.from("shopping_list_items").delete().in("id", checkedIds);
  }

  const byCategory = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const cat = item.category ?? "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [items]);

  const checkedCount = items.filter((i) => i.checked).length;

  const CATEGORY_ORDER = ["produce", "dairy", "meat & seafood", "pantry", "frozen", "other"];
  const sortedCategories = Array.from(byCategory.keys()).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/library" className="p-2 -ml-2 hover:bg-[var(--muted)] rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-xl flex-1">Shopping List</h1>
          {checkedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChecked} className="gap-1.5 text-[var(--muted-foreground)]">
              <Trash2 className="w-3.5 h-3.5" />
              Clear checked ({checkedCount})
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Add from recipes */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
          <h2 className="font-medium mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add from recipes
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => {
                  setSelectedRecipes((prev) => {
                    const next = new Set(prev);
                    if (next.has(recipe.id)) next.delete(recipe.id);
                    else next.add(recipe.id);
                    return next;
                  });
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors",
                  selectedRecipes.has(recipe.id)
                    ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {recipe.title}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            disabled={selectedRecipes.size === 0}
            onClick={addRecipesToList}
            className="gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Add {selectedRecipes.size > 0 ? `${selectedRecipes.size} recipe${selectedRecipes.size !== 1 ? "s" : ""}` : "recipes"}
          </Button>
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-3 opacity-30" />
            <p className="text-[var(--muted-foreground)]">Your list is empty.</p>
          </div>
        ) : (
          sortedCategories.map((category) => (
            <section key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 capitalize">
                {category}
              </h3>
              <ul className="space-y-1.5">
                {byCategory.get(category)!.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors",
                      item.checked && "opacity-50"
                    )}
                    onClick={() => toggleItem(item.id, !item.checked)}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-none transition-colors",
                        item.checked
                          ? "bg-[var(--accent)] border-[var(--accent)]"
                          : "border-[var(--border)]"
                      )}
                    >
                      {item.checked && <Check className="w-3 h-3 text-stone-900" />}
                    </div>
                    <div className="flex-1">
                      <span className={cn("text-sm font-medium", item.checked && "line-through")}>
                        {item.item}
                      </span>
                      {(item.quantity || item.unit) && (
                        <span className="text-xs text-[var(--muted-foreground)] ml-1.5">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
