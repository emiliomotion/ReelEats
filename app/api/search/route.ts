import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json([]);
  }

  // Parse natural language filters from query
  const timeMatch = q.match(/under\s+(\d+)\s*min/i);
  const maxTime = timeMatch ? parseInt(timeMatch[1]) : null;

  // Strip time filter from text query
  const textQuery = q.replace(/under\s+\d+\s*min/gi, "").trim();

  // Search recipes by full-text
  let db = supabase
    .from("recipes")
    .select("id, title, summary, cuisine, dietary_tags, total_time_min, thumbnail_url, creator_handle, difficulty, times_cooked, user_rating")
    .eq("user_id", user.id)
    .eq("is_recipe", true);

  if (textQuery) {
    db = db.textSearch("search_vector", textQuery, { type: "websearch" });
  }

  if (maxTime) {
    db = db.lte("total_time_min", maxTime);
  }

  db = db.order("created_at", { ascending: false }).limit(50);

  const { data: recipes, error } = await db;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also search by ingredient if no recipes found from title search
  if (!recipes || recipes.length === 0) {
    const { data: ingredientMatches } = await supabase
      .from("ingredients")
      .select("recipe_id, item")
      .ilike("item", `%${textQuery}%`)
      .limit(20);

    if (ingredientMatches && ingredientMatches.length > 0) {
      const recipeIds = Array.from(new Set(ingredientMatches.map((i) => i.recipe_id)));
      const { data: matchedRecipes } = await supabase
        .from("recipes")
        .select("id, title, summary, cuisine, dietary_tags, total_time_min, thumbnail_url, creator_handle, difficulty, times_cooked, user_rating")
        .in("id", recipeIds)
        .eq("user_id", user.id);

      return NextResponse.json(matchedRecipes ?? []);
    }
  }

  return NextResponse.json(recipes ?? []);
}
