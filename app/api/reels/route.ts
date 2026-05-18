import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateReelSchema = z.object({
  source_url: z.string().url(),
  thumbnail_url: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  cuisine: z.string().nullable().optional(),
  meal_type: z.string().nullable().optional(),
  dietary_tags: z.array(z.string()).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  tried: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const cuisine = searchParams.get("cuisine");
  const meal_type = searchParams.get("meal_type");
  const dietary = searchParams.get("dietary");
  const tried = searchParams.get("tried");
  const sort = searchParams.get("sort") ?? "recent";

  let db = supabase
    .from("saved_reels")
    .select("*")
    .eq("user_id", user.id);

  if (q.trim()) {
    db = db.textSearch("search_vector", q, { type: "websearch" });
  }
  if (cuisine) db = db.eq("cuisine", cuisine);
  if (meal_type) db = db.eq("meal_type", meal_type);
  if (dietary) db = db.contains("dietary_tags", [dietary]);
  if (tried === "true") db = db.eq("tried", true);
  if (tried === "false") db = db.eq("tried", false);

  if (sort === "oldest") {
    db = db.order("created_at", { ascending: true });
  } else {
    db = db.order("created_at", { ascending: false });
  }

  const { data, error } = await db;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateReelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_reels")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
