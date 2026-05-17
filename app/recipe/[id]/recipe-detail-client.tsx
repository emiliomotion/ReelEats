"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Clock, Users, ChefHat, Heart,
  ExternalLink, PlayCircle, Minus, Plus, Loader2,
  Check, AlertTriangle, Edit2, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime, scaleQuantity } from "@/lib/utils";
import type { RecipeWithDetails, Ingredient, Step } from "@/lib/supabase/types";

interface Props {
  recipe: RecipeWithDetails;
  isReview: boolean;
}

function formatQuantity(qty: number | null, unit: string | null): string {
  if (qty === null) return "";
  const str = qty % 1 === 0 ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${str} ${unit}` : str;
}

export function RecipeDetailClient({ recipe: initialRecipe, isReview }: Props) {
  const router = useRouter();
  const [recipe, setRecipe] = useState(initialRecipe);
  const [servings, setServings] = useState(recipe.servings ?? 2);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(isReview);

  const scale = servings / (recipe.servings ?? servings);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.title,
          summary: recipe.summary,
          cuisine: recipe.cuisine,
          dietary_tags: recipe.dietary_tags,
          difficulty: recipe.difficulty,
          total_time_min: recipe.total_time_min,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }),
      });
      if (res.ok) {
        setEditMode(false);
        if (isReview) router.replace(`/recipe/${recipe.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this recipe?")) return;
    await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    router.push("/library");
  };

  const handleFavoriteToggle = async () => {
    const next = !recipe.favorited;
    setRecipe((r) => ({ ...r, favorited: next }));
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited: next }),
    });
  };

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Review banner */}
      {isReview && editMode && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Review your recipe. Fields highlighted in yellow had low confidence.
              </p>
            </div>
            <div className="flex gap-2 flex-none">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-[var(--destructive)]"
              >
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save recipe
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <Link
            href="/library"
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Library
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={handleFavoriteToggle} className="p-2">
              <Heart
                className={cn(
                  "w-5 h-5 transition-colors",
                  recipe.favorited
                    ? "fill-[var(--accent)] text-[var(--accent)]"
                    : "text-[var(--muted-foreground)]"
                )}
              />
            </button>
            {!isReview && (
              <button onClick={() => setEditMode(!editMode)} className="p-2">
                <Edit2
                  className={cn(
                    "w-4 h-4",
                    editMode ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"
                  )}
                />
              </button>
            )}
            <button onClick={handleDelete} className="p-2">
              <Trash2 className="w-4 h-4 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden aspect-video bg-[var(--muted)] mb-6 mt-2">
          {recipe.thumbnail_url ? (
            <Image
              src={recipe.thumbnail_url}
              alt={recipe.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ChefHat className="w-16 h-16 text-[var(--muted-foreground)] opacity-30" />
            </div>
          )}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Instagram
            </a>
          )}
        </div>

        {/* Title */}
        {editMode ? (
          <input
            value={recipe.title}
            onChange={(e) => setRecipe((r) => ({ ...r, title: e.target.value }))}
            className="font-display text-3xl w-full bg-transparent border-b-2 border-[var(--accent)] outline-none pb-1 mb-2"
          />
        ) : (
          <h1 className="font-display text-3xl sm:text-4xl mb-2">{recipe.title}</h1>
        )}

        {recipe.creator_handle && (
          <p className="text-[var(--muted-foreground)] text-sm mb-3">
            by @{recipe.creator_handle}
          </p>
        )}

        {recipe.summary && (
          <p className="text-[var(--muted-foreground)] text-base mb-4 leading-relaxed">
            {recipe.summary}
          </p>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {recipe.total_time_min && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(recipe.total_time_min)}
            </Badge>
          )}
          {recipe.difficulty && (
            <Badge variant={recipe.difficulty === "easy" ? "success" : recipe.difficulty === "medium" ? "warning" : "destructive"}>
              {recipe.difficulty}
            </Badge>
          )}
          {recipe.cuisine && <Badge variant="outline">{recipe.cuisine}</Badge>}
          {recipe.dietary_tags?.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
          {recipe.low_audio_signal && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              Visual-only
            </Badge>
          )}
        </div>

        {/* Cook Mode CTA */}
        <Link href={`/recipe/${recipe.id}/cook`}>
          <Button size="xl" className="w-full sm:w-auto mb-8 gap-2">
            <PlayCircle className="w-5 h-5" />
            Start Cooking
          </Button>
        </Link>

        {/* Content grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-12">
          {/* Ingredients */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl">Ingredients</h2>
              {/* Servings scaler */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  className="w-7 h-7 rounded-lg bg-[var(--muted)] flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-medium w-10 text-center">
                  <Users className="w-3.5 h-3.5 inline mr-0.5" />
                  {servings}
                </span>
                <button
                  onClick={() => setServings(servings + 1)}
                  className="w-7 h-7 rounded-lg bg-[var(--muted)] flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <ul className="space-y-2.5">
              {recipe.ingredients.map((ing) => (
                <IngredientRow
                  key={ing.id}
                  ingredient={ing}
                  scale={scale}
                  checked={checkedIngredients.has(ing.id)}
                  onCheck={() => toggleIngredient(ing.id)}
                  editMode={editMode}
                  onUpdate={(updated) =>
                    setRecipe((r) => ({
                      ...r,
                      ingredients: r.ingredients.map((i) =>
                        i.id === updated.id ? updated : i
                      ),
                    }))
                  }
                />
              ))}
            </ul>

            {recipe.equipment.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                  Equipment
                </h3>
                <ul className="space-y-1">
                  {recipe.equipment.map((eq) => (
                    <li key={eq.id} className="text-sm flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--accent)] flex-none" />
                      {eq.item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Steps */}
          <section>
            <h2 className="font-display text-xl mb-4">Steps</h2>
            <ol className="space-y-4">
              {recipe.steps.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  number={i + 1}
                  editMode={editMode}
                  onUpdate={(updated) =>
                    setRecipe((r) => ({
                      ...r,
                      steps: r.steps.map((s) => (s.id === updated.id ? updated : s)),
                    }))
                  }
                />
              ))}
            </ol>
          </section>
        </div>

        {/* Save changes button (edit mode, non-review) */}
        {editMode && !isReview && (
          <div className="mt-8 pt-6 border-t border-[var(--border)] flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save changes
            </Button>
            <Button variant="outline" onClick={() => setEditMode(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function IngredientRow({
  ingredient,
  scale,
  checked,
  onCheck,
  editMode,
  onUpdate,
}: {
  ingredient: Ingredient;
  scale: number;
  checked: boolean;
  onCheck: () => void;
  editMode: boolean;
  onUpdate: (ing: Ingredient) => void;
}) {
  const scaledQty = scaleQuantity(ingredient.quantity, 1, scale);
  const isLowConfidence = ingredient.confidence < 0.7;

  if (editMode) {
    return (
      <li className={cn(
        "flex items-start gap-2 p-2 rounded-xl",
        isLowConfidence && "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
      )}>
        {isLowConfidence && (
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-none mt-1" />
        )}
        <div className="flex-1 grid grid-cols-3 gap-1 text-sm">
          <input
            value={ingredient.item}
            onChange={(e) => onUpdate({ ...ingredient, item: e.target.value })}
            className="bg-transparent border-b border-[var(--border)] outline-none pb-0.5"
            placeholder="ingredient"
          />
          <input
            value={ingredient.quantity ?? ""}
            onChange={(e) =>
              onUpdate({ ...ingredient, quantity: e.target.value ? parseFloat(e.target.value) : null })
            }
            className="bg-transparent border-b border-[var(--border)] outline-none pb-0.5"
            placeholder="qty"
            type="number"
            step="any"
          />
          <input
            value={ingredient.unit ?? ingredient.descriptor ?? ""}
            onChange={(e) => onUpdate({ ...ingredient, unit: e.target.value || null })}
            className="bg-transparent border-b border-[var(--border)] outline-none pb-0.5"
            placeholder="unit"
          />
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex items-start gap-3 p-2 rounded-xl cursor-pointer hover:bg-[var(--muted)] transition-colors",
        checked && "opacity-50"
      )}
      onClick={onCheck}
    >
      <div
        className={cn(
          "w-4 h-4 rounded-full border-2 flex-none mt-0.5 transition-colors",
          checked ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"
        )}
      />
      <div className="flex-1 text-sm">
        <span className={cn("font-medium", checked && "line-through")}>
          {ingredient.item}
        </span>
        {(scaledQty !== null || ingredient.descriptor) && (
          <span className="text-[var(--muted-foreground)]">
            {" — "}
            {scaledQty !== null
              ? formatQuantity(scaledQty, ingredient.unit)
              : ingredient.descriptor}
            {ingredient.was_vague && (
              <span className="ml-1 text-xs text-amber-500">✏️</span>
            )}
          </span>
        )}
        {ingredient.notes && ingredient.notes.length > 0 && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {ingredient.notes.join(" • ")}
          </p>
        )}
      </div>
      {isLowConfidence && !checked && (
        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-none mt-1.5" title="Low confidence" />
      )}
    </li>
  );
}

function StepRow({
  step,
  number,
  editMode,
  onUpdate,
}: {
  step: Step;
  number: number;
  editMode: boolean;
  onUpdate: (step: Step) => void;
}) {
  const isLowConfidence = step.confidence < 0.7;

  if (editMode) {
    return (
      <li className={cn(
        "flex gap-3 p-3 rounded-xl",
        isLowConfidence && "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
      )}>
        <span className="font-display text-2xl text-[var(--muted-foreground)] flex-none w-7">
          {number}
        </span>
        <textarea
          value={step.instruction}
          onChange={(e) => onUpdate({ ...step, instruction: e.target.value })}
          className="flex-1 bg-transparent border-b border-[var(--border)] outline-none text-sm resize-none leading-relaxed"
          rows={3}
        />
      </li>
    );
  }

  return (
    <li className="flex gap-3">
      <span className="font-display text-2xl text-[var(--muted-foreground)] flex-none w-7 leading-tight">
        {number}
      </span>
      <div className="flex-1 pt-0.5">
        <p className="text-sm leading-relaxed">{step.instruction}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {step.duration_sec && (
            <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full">
              ⏱ {step.approximate && "~"}{formatQuantity(step.duration_sec / 60, null)} min
            </span>
          )}
          {step.temperature && (
            <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full">
              🌡 {step.temperature}
            </span>
          )}
          {isLowConfidence && (
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" title="Low confidence" />
          )}
        </div>
      </div>
    </li>
  );
}
