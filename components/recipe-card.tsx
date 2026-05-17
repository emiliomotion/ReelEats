"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Heart, ChefHat, Star } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn, formatTime } from "@/lib/utils";
import type { Recipe } from "@/lib/supabase/types";

interface RecipeCardProps {
  recipe: Recipe;
  onFavoriteToggle?: (id: string, favorited: boolean) => void;
  className?: string;
}

const difficultyColor = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
} as const;

export function RecipeCard({ recipe, onFavoriteToggle, className }: RecipeCardProps) {
  return (
    <Link href={`/recipe/${recipe.id}`} className={cn("group block", className)}>
      <article className="rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-md transition-all duration-200">
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--muted)]">
          {recipe.thumbnail_url ? (
            <Image
              src={recipe.thumbnail_url}
              alt={recipe.title}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)]">
              <ChefHat className="w-12 h-12 opacity-30" />
            </div>
          )}

          {/* Favorite button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onFavoriteToggle?.(recipe.id, !recipe.favorited);
            }}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Heart
              className={cn(
                "w-4 h-4 transition-colors",
                recipe.favorited
                  ? "fill-[var(--accent)] text-[var(--accent)]"
                  : "text-stone-500"
              )}
            />
          </button>

          {/* Tag chip */}
          {recipe.dietary_tags && recipe.dietary_tags.length > 0 && (
            <div className="absolute bottom-2.5 left-2.5">
              <Badge variant="secondary" className="bg-white/80 dark:bg-black/60 backdrop-blur-sm text-[var(--foreground)]">
                {recipe.dietary_tags[0]}
              </Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-display text-lg leading-snug mb-1 line-clamp-2 text-[var(--foreground)]">
            {recipe.title}
          </h3>

          {recipe.creator_handle && (
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              @{recipe.creator_handle}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
            {recipe.total_time_min && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(recipe.total_time_min)}
              </span>
            )}

            {recipe.difficulty && (
              <Badge variant={difficultyColor[recipe.difficulty]} className="text-xs">
                {recipe.difficulty}
              </Badge>
            )}

            {recipe.times_cooked > 0 && (
              <span className="flex items-center gap-1 ml-auto">
                <ChefHat className="w-3.5 h-3.5" />
                {recipe.times_cooked}×
              </span>
            )}

            {recipe.user_rating && (
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                {recipe.user_rating}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
