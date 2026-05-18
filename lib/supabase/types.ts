export interface SavedReel {
  id: string;
  user_id: string;
  source_url: string;
  thumbnail_url: string | null;
  title: string;
  cuisine: string | null;
  meal_type: string | null;
  dietary_tags: string[];
  difficulty: "easy" | "medium" | "hard" | null;
  tried: boolean;
  notes: string | null;
  created_at: string;
}
