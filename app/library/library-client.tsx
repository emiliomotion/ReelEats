"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, UtensilsCrossed, Moon, Sun, LogOut, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReelCard } from "@/components/reel-card";
import { AddReelModal } from "@/components/add-reel-modal";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { SavedReel } from "@/lib/supabase/types";

interface Props {
  initialReels: SavedReel[];
}

const DIETARY_OPTIONS = ["Vegan", "Vegetarian", "Gluten-free", "Dairy-free", "Keto", "Nut-free"];

export function LibraryClient({ initialReels }: Props) {
  const router = useRouter();
  const [reels, setReels] = useState<SavedReel[]>(initialReels);
  const [showAdd, setShowAdd] = useState(false);
  const [editingReel, setEditingReel] = useState<SavedReel | null>(null);
  const [search, setSearch] = useState("");
  const [filterCuisine, setFilterCuisine] = useState<string | null>(null);
  const [filterMealType, setFilterMealType] = useState<string | null>(null);
  const [filterDietary, setFilterDietary] = useState<string | null>(null);
  const [filterTried, setFilterTried] = useState<boolean | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signin");
  }

  function handleSaved(reel: SavedReel) {
    if (editingReel) {
      setReels((prev) => prev.map((r) => r.id === reel.id ? reel : r));
      setEditingReel(null);
    } else {
      setReels((prev) => [reel, ...prev]);
      setShowAdd(false);
    }
  }

  async function handleTriedToggle(id: string, tried: boolean) {
    setReels((prev) => prev.map((r) => r.id === id ? { ...r, tried } : r));
    await fetch(`/api/reels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tried }),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this reel?")) return;
    setReels((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reels/${id}`, { method: "DELETE" });
  }

  function handleEdit(reel: SavedReel) {
    setEditingReel(reel);
  }

  function clearFilters() {
    setFilterCuisine(null);
    setFilterMealType(null);
    setFilterDietary(null);
    setFilterTried(null);
    setSearch("");
  }

  const hasActiveFilters = filterCuisine || filterMealType || filterDietary || filterTried !== null || search.trim();

  const filtered = useMemo(() => {
    let result = [...reels];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q) ||
          r.meal_type?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
      );
    }
    if (filterCuisine) result = result.filter((r) => r.cuisine === filterCuisine);
    if (filterMealType) result = result.filter((r) => r.meal_type === filterMealType);
    if (filterDietary) result = result.filter((r) => r.dietary_tags.includes(filterDietary));
    if (filterTried !== null) result = result.filter((r) => r.tried === filterTried);
    return result;
  }, [reels, search, filterCuisine, filterMealType, filterDietary, filterTried]);

  // Collect cuisines/meal types that actually exist in saved reels
  const existingCuisines = useMemo(() =>
    Array.from(new Set(reels.map((r) => r.cuisine).filter(Boolean) as string[])),
    [reels]
  );
  const existingMealTypes = useMemo(() =>
    Array.from(new Set(reels.map((r) => r.meal_type).filter(Boolean) as string[])),
    [reels]
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-none">
            <UtensilsCrossed className="w-5 h-5 text-[var(--accent)]" />
            <span className="font-display font-semibold hidden sm:block">ReelVault</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your reels…"
              className="pl-9 h-9 bg-[var(--muted)] border-transparent"
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-xl transition-colors",
                showFilters || hasActiveFilters
                  ? "text-[var(--accent)] bg-[var(--accent)]/10"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button onClick={toggleDark} className="p-2 rounded-xl hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={handleSignOut} className="p-2 rounded-xl hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
            <Button size="sm" className="gap-1.5 ml-1" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Save reel</span>
            </Button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-3">
            <div className="max-w-6xl mx-auto space-y-3">
              {/* Tried filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--muted-foreground)] font-medium w-16 flex-none">Status</span>
                {[
                  { label: "All", value: null },
                  { label: "Not tried", value: false },
                  { label: "Made it", value: true },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setFilterTried(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                      filterTried === opt.value
                        ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Cuisine filter */}
              {existingCuisines.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--muted-foreground)] font-medium w-16 flex-none">Cuisine</span>
                  {existingCuisines.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFilterCuisine(filterCuisine === c ? null : c)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                        filterCuisine === c
                          ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {/* Meal type filter */}
              {existingMealTypes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--muted-foreground)] font-medium w-16 flex-none">Meal</span>
                  {existingMealTypes.map((m) => (
                    <button
                      key={m}
                      onClick={() => setFilterMealType(filterMealType === m ? null : m)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                        filterMealType === m
                          ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Dietary filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--muted-foreground)] font-medium w-16 flex-none">Dietary</span>
                {DIETARY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setFilterDietary(filterDietary === d ? null : d)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                      filterDietary === d
                        ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-[var(--destructive)] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            {filtered.length} reel{filtered.length !== 1 && "s"}
            {hasActiveFilters && " matching filters"}
          </p>
        </div>

        {reels.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mb-4">
              <UtensilsCrossed className="w-8 h-8 text-[var(--muted-foreground)] opacity-40" />
            </div>
            <h2 className="font-display text-2xl mb-2">No reels saved yet</h2>
            <p className="text-[var(--muted-foreground)] mb-6 max-w-xs text-sm">
              Paste an Instagram link, add a few tags, and it lives here. Filter later to find what you want to cook.
            </p>
            <Button onClick={() => setShowAdd(true)} size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              Save your first reel
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          /* No results */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-[var(--muted-foreground)] mb-2">Nothing matches those filters.</p>
            <button onClick={clearFilters} className="text-[var(--accent)] text-sm hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          /* Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filtered.map((reel) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                onTriedToggle={handleTriedToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add modal */}
      {showAdd && (
        <AddReelModal
          onClose={() => setShowAdd(false)}
          onSave={handleSaved}
        />
      )}

      {/* Edit modal */}
      {editingReel && (
        <AddReelModal
          editing={editingReel}
          onClose={() => setEditingReel(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
