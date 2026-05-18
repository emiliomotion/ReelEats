"use client";

import { useState } from "react";
import { X, Loader2, Link2, ChefHat } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { SavedReel } from "@/lib/supabase/types";

const CUISINES = ["Italian", "Mexican", "Asian", "American", "Mediterranean", "Indian", "French", "Middle Eastern", "Greek", "Japanese", "Thai", "Other"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Drinks"];
const DIETARY_OPTIONS = ["Vegan", "Vegetarian", "Gluten-free", "Dairy-free", "Keto", "Nut-free"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

interface Props {
  onClose: () => void;
  onSave: (reel: SavedReel) => void;
  editing?: SavedReel | null;
}

export function AddReelModal({ onClose, onSave, editing }: Props) {
  const [url, setUrl] = useState(editing?.source_url ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(editing?.thumbnail_url ?? null);
  const [cuisine, setCuisine] = useState(editing?.cuisine ?? "");
  const [mealType, setMealType] = useState(editing?.meal_type ?? "");
  const [dietary, setDietary] = useState<string[]>(editing?.dietary_tags ?? []);
  const [difficulty, setDifficulty] = useState(editing?.difficulty ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [tried, setTried] = useState(editing?.tried ?? false);
  const [fetchingThumb, setFetchingThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState("");

  // Auto-fetch thumbnail when URL is pasted (new reels only)
  async function fetchThumbnail(rawUrl: string) {
    if (editing || !rawUrl.includes("instagram.com")) return;
    setFetchingThumb(true);
    try {
      const res = await fetch(`/api/oembed?url=${encodeURIComponent(rawUrl)}`);
      const data = await res.json();
      if (data.thumbnail_url) setThumbnailUrl(data.thumbnail_url);
      if (data.author_name && !title) setTitle(`Reel by @${data.author_name}`);
    } catch {
      // silently fail — thumbnail is optional
    } finally {
      setFetchingThumb(false);
    }
  }

  function handleUrlBlur() {
    if (url.trim()) fetchThumbnail(url.trim());
  }

  function toggleDietary(tag: string) {
    setDietary((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) { setUrlError("URL is required"); return; }
    if (!title.trim()) return;

    setSaving(true);
    try {
      const method = editing ? "PATCH" : "POST";
      const endpoint = editing ? `/api/reels/${editing.id}` : "/api/reels";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: url.trim(),
          thumbnail_url: thumbnailUrl,
          title: title.trim(),
          cuisine: cuisine || null,
          meal_type: mealType || null,
          dietary_tags: dietary,
          difficulty: (difficulty || null) as SavedReel["difficulty"],
          tried,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  const isValid = url.trim().length > 0 && title.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-lg bg-[var(--card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border)] shadow-2xl max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl">
            {editing ? "Edit reel" : "Save a reel"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          {/* URL + Thumbnail preview */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Instagram URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                <Input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
                  onBlur={handleUrlBlur}
                  placeholder="https://www.instagram.com/reel/…"
                  className="pl-9"
                  disabled={!!editing}
                />
              </div>
              {/* Thumbnail preview */}
              <div className={cn(
                "w-12 h-10 rounded-lg overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[var(--muted)] flex-none transition-all",
                fetchingThumb && "animate-pulse"
              )}>
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  fetchingThumb
                    ? <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
                    : <ChefHat className="w-4 h-4 text-[var(--muted-foreground)] opacity-40" />
                )}
              </div>
            </div>
            {urlError && <p className="text-xs text-[var(--destructive)] mt-1">{urlError}</p>}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Title <span className="text-[var(--muted-foreground)] font-normal">— what do you call it?</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. that crispy salmon thing"
              required
              autoFocus={!!editing}
            />
          </div>

          {/* Cuisine + Meal type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Cuisine</label>
              <div className="flex flex-wrap gap-1.5">
                {CUISINES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCuisine(cuisine === c ? "" : c)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                      cuisine === c
                        ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Meal type</label>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMealType(mealType === m ? "" : m)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                      mealType === m
                        ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dietary */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Dietary</label>
            <div className="flex flex-wrap gap-1.5">
              {DIETARY_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleDietary(tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                    dietary.includes(tag)
                      ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty + Tried row */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5">Difficulty</label>
              <div className="flex gap-1.5">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(difficulty === d ? "" : d)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors",
                      difficulty === d
                        ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-amber-700 dark:text-amber-400"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Tried it?</label>
              <button
                type="button"
                onClick={() => setTried(!tried)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                  tried
                    ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400"
                    : "border-[var(--border)] text-[var(--muted-foreground)]"
                )}
              >
                {tried ? "✓ Yes" : "Not yet"}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. needs more garlic, serve with rice…"
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
            />
          </div>

          {/* Save */}
          <Button type="submit" className="w-full" size="lg" disabled={!isValid || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {editing ? "Save changes" : "Save reel"}
          </Button>
        </form>
      </div>
    </div>
  );
}
