"use client";

import { useState } from "react";
import { ExternalLink, Check, ChefHat, Trash2, Pencil } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import type { SavedReel } from "@/lib/supabase/types";

interface ReelCardProps {
  reel: SavedReel;
  onTriedToggle: (id: string, tried: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (reel: SavedReel) => void;
}

const CUISINE_COLORS: Record<string, string> = {
  italian: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  mexican: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  asian: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  american: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mediterranean: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  indian: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function ReelCard({ reel, onTriedToggle, onDelete, onEdit }: ReelCardProps) {
  const [showActions, setShowActions] = useState(false);
  const cuisineColor = reel.cuisine
    ? CUISINE_COLORS[reel.cuisine.toLowerCase()] ?? "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
    : null;

  return (
    <article
      className="group relative rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-md transition-all duration-200"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] sm:aspect-[4/3] overflow-hidden bg-[var(--muted)]">
        {reel.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reel.thumbnail_url}
            alt={reel.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ChefHat className="w-10 h-10 text-[var(--muted-foreground)] opacity-25" />
          </div>
        )}

        {/* Tried badge */}
        {reel.tried && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full shadow-sm">
            <Check className="w-3 h-3" />
            Made it
          </div>
        )}

        {/* Action buttons (show on hover / always on mobile) */}
        <div className={cn(
          "absolute top-2 right-2 flex gap-1.5 transition-opacity duration-150",
          showActions ? "opacity-100" : "opacity-0 sm:opacity-0 opacity-100"
        )}>
          <button
            onClick={() => onEdit(reel)}
            className="w-7 h-7 rounded-lg bg-white/85 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-white dark:hover:bg-black/80 transition-colors shadow-sm"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
          </button>
          <button
            onClick={() => onDelete(reel.id)}
            className="w-7 h-7 rounded-lg bg-white/85 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shadow-sm"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300 hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-display text-base leading-snug mb-2 line-clamp-2">
          {reel.title}
        </h3>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reel.cuisine && (
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cuisineColor)}>
              {reel.cuisine}
            </span>
          )}
          {reel.meal_type && (
            <Badge variant="secondary" className="text-xs">
              {reel.meal_type}
            </Badge>
          )}
          {reel.dietary_tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
          {reel.difficulty && (
            <Badge
              variant={reel.difficulty === "easy" ? "success" : reel.difficulty === "medium" ? "warning" : "destructive"}
              className="text-xs"
            >
              {reel.difficulty}
            </Badge>
          )}
        </div>

        {/* Footer: tried toggle + open link */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onTriedToggle(reel.id, !reel.tried)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl border transition-colors",
              reel.tried
                ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
            )}
          >
            <Check className={cn("w-3 h-3", reel.tried && "text-green-600")} />
            {reel.tried ? "Made it" : "Mark made"}
          </button>

          <a
            href={reel.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open reel
          </a>
        </div>
      </div>
    </article>
  );
}
