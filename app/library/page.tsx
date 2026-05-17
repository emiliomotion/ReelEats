import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LibraryClient } from "./library-client";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const { data: recipes } = await supabase
    .from("recipes")
    .select(`
      id, title, summary, creator_handle, thumbnail_url, cuisine, dietary_tags,
      difficulty, total_time_min, active_time_min, servings, favorited,
      times_cooked, user_rating, is_recipe, low_audio_signal, created_at, updated_at,
      user_id, source_url
    `)
    .eq("user_id", user.id)
    .eq("is_recipe", true)
    .order("created_at", { ascending: false });

  return <LibraryClient initialRecipes={recipes ?? []} />;
}
