"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, UtensilsCrossed,
  Clock, ChefHat, Heart, Shuffle, LogOut, Moon, Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "@/components/recipe-card";
import { IngestModal } from "./ingest-modal";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  initialRecipes: Recipe[];
}

type SortOption = "recent" | "most_cooked" | "top_rated" | "random";

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
const TIME_OPTIONS = [
  { label: "Under 15m", value: 15 },
  { label: "Under 30m", value: 30 },
  { label: "Under 1h", value: 60 },
];
const DIETARY_OPTIONS = ["vegan", "vegetarian", "gluten-free", "dairy-free", "keto"];

export function LibraryClient({ initialRecipes }: Props) {
  const router = useRouter();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [searchQuery, setSearchQuery] = useState("");
  const [showIngest, setShowIngest] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [filterCuisine, setFilterCuisine] = useState<string | null>(null);
  const [filterDietary, setFilterDietary] = useState<string | null>(null);
  const [filterMaxTime, setFilterMaxTime] = useState<number | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signin");
  };

  const handleFavoriteToggle = useCallback(async (id: string, favorited: boolean) => {
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, favorited } : r))
    );
    const supabase = createClient();
    await supabase.from("recipes").update({ favorited }).eq("id", id);
  }, []);

  const handleIngestComplete = (recipeId: string) => {
    setShowIngest(false);
    router.push(`/recipe/${recipeId}?review=true`);
  };

  const cuisines = useMemo(() => {
    const set = new Set(recipes.map((r) => r.cuisine).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    let filtered = [...recipes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.summary?.toLowerCase().includes(q) ||
          r.creator_handle?.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q)
      );
    }

    if (filterCuisine) filtered = filtered.filter((r) => r.cuisine === filterCuisine);
    if (filterDietary)
      filtered = filtered.filter((r) => r.dietary_tags?.includes(filterDietary));
    if (filterMaxTime)
      filtered = filtered.filter(
        (r) => r.total_time_min != null && r.total_time_min <= filterMaxTime
      );
    if (filterDifficulty) filtered = filtered.filter((r) => r.difficulty === filterDifficulty);
    if (showFavorites) filtered = filtered.filter((r) => r.favorited);

    switch (sortBy) {
      case "most_cooked":
        filtered.sort((a, b) => (b.times_cooked ?? 0) - (a.times_cooked ?? 0));
        break;
      case "top_rated":
        filtered.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
        break;
      case "random":
        filtered.sort(() => Math.random() - 0.5);
        break;
      default:
        filtered.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return filtered;
  }, [
    recipes, searchQuery, filterCuisine, filterDietary,
    filterMaxTime, filterDifficulty, showFavorites, sortBy,
  ]);

  const hasActiveFilters =
    filterCuisine || filterDietary || filterMaxTime || filterDifficulty || showFavorites;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-none">
            <UtensilsCrossed className="w-5 h-5 text-[var(--accent)]" />
            <span className="font-display font-semibold hidden sm:block">ReelEats</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes, ingredients…"
              className="pl-9 h-9 bg-[var(--muted)] border-transparent"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              className="w-8 h-8"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="w-8 h-8"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowIngest(true)}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Reel</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filter rail */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {/* Sort */}
          <div className="flex items-center gap-1 border border-[var(--border)] rounded-xl p-1 flex-none">
            {(["recent", "most_cooked", "top_rated"] as SortOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  sortBy === opt
                    ? "bg-[var(--accent)] text-stone-900"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {opt === "recent" ? "Recent" : opt === "most_cooked" ? "Most cooked" : "Top rated"}
              </button>
            ))}
            <button
              onClick={() => setSortBy("random")}
              className={cn(
                "px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                sortBy === "random"
                  ? "bg-[var(--accent)] text-stone-900"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
              title="Surprise me"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-[var(--border)] flex-none" />

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-none",
              showFavorites
                ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-amber-700 dark:text-amber-400"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", showFavorites && "fill-[var(--accent)] text-[var(--accent)]")} />
            Favorites
          </button>

          {/* Time filters */}
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterMaxTime(filterMaxTime === opt.value ? null : opt.value)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-none",
                filterMaxTime === opt.value
                  ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-amber-700 dark:text-amber-400"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Clock className="w-3 h-3" />
              {opt.label}
            </button>
          ))}

          {/* Difficulty */}
          {DIFFICULTY_OPTIONS.map((diff) => (
            <button
              key={diff}
              onClick={() => setFilterDifficulty(filterDifficulty === diff ? null : diff)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-none capitalize",
                filterDifficulty === diff
                  ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-amber-700 dark:text-amber-400"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {diff}
            </button>
          ))}

          {/* Cuisine */}
          {cuisines.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => setFilterCuisine(filterCuisine === cuisine ? null : cuisine)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-none",
                filterCuisine === cuisine
                  ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-amber-700 dark:text-amber-400"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {cuisine}
            </button>
          ))}

          {/* Dietary */}
          {DIETARY_OPTIONS.map((diet) => (
            <button
              key={diet}
              onClick={() => setFilterDietary(filterDietary === diet ? null : diet)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-none",
                filterDietary === diet
                  ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-amber-700 dark:text-amber-400"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {diet}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterCuisine(null);
                setFilterDietary(null);
                setFilterMaxTime(null);
                setFilterDifficulty(null);
                setShowFavorites(false);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-950/30 flex-none"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Count */}
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          {filteredRecipes.length} recipe{filteredRecipes.length !== 1 && "s"}
          {hasActiveFilters && " matching filters"}
        </p>

        {/* Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mb-4">
              <ChefHat className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h2 className="font-display text-2xl mb-2">Your library is empty</h2>
            <p className="text-[var(--muted-foreground)] mb-6 max-w-xs">
              Paste an Instagram reel URL to turn it into a clean, cookable recipe.
            </p>
            <Button onClick={() => setShowIngest(true)} size="lg">
              <Plus className="w-4 h-4" />
              Add your first reel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-[var(--muted-foreground)]">
              No recipes match your filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterCuisine(null);
                setFilterDietary(null);
                setFilterMaxTime(null);
                setFilterDifficulty(null);
                setShowFavorites(false);
              }}
              className="mt-2 text-[var(--accent)] text-sm hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {showIngest && (
        <IngestModal
          onClose={() => setShowIngest(false)}
          onComplete={handleIngestComplete}
        />
      )}
    </div>
  );
}
