import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CookLogSchema = z.object({
  recipe_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CookLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { recipe_id, rating, notes } = parsed.data;

  const { error: logError } = await supabase.from("cook_logs").insert({
    recipe_id,
    user_id: user.id,
    rating: rating ?? null,
    notes: notes ?? null,
  });

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // Atomically increment times_cooked
  await supabase.rpc("increment_times_cooked", { recipe_id });

  // Update user_rating if provided
  if (rating) {
    await supabase
      .from("recipes")
      .update({ user_rating: rating })
      .eq("id", recipe_id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
