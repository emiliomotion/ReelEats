import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const cuisine = searchParams.get("cuisine");
  const dietary = searchParams.get("dietary");
  const maxTime = searchParams.get("maxTime");
  const difficulty = searchParams.get("difficulty");
  const favorited = searchParams.get("favorited");
  const sort = searchParams.get("sort") ?? "recent";

  let db = supabase
    .from("recipes")
    .select(`
      *,
      ingredients (id, item, quantity, unit, descriptor, was_vague, notes, confidence, position),
      steps (id, position, instruction, duration_sec, approximate, temperature, confidence),
      equipment (id, item)
    `)
    .eq("user_id", user.id)
    .eq("is_recipe", true);

  if (query) {
    db = db.textSearch("search_vector", query, { type: "websearch" });
  }

  if (cuisine) db = db.eq("cuisine", cuisine);
  if (dietary) db = db.contains("dietary_tags", [dietary]);
  if (maxTime) db = db.lte("total_time_min", parseInt(maxTime));
  if (difficulty) db = db.eq("difficulty", difficulty);
  if (favorited === "true") db = db.eq("favorited", true);

  switch (sort) {
    case "most_cooked":
      db = db.order("times_cooked", { ascending: false });
      break;
    case "top_rated":
      db = db.order("user_rating", { ascending: false, nullsFirst: false });
      break;
    default:
      db = db.order("created_at", { ascending: false });
  }

  const { data, error } = await db;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
