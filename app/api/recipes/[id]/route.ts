import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateSchema = z.object({
  title: z.string().optional(),
  summary: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  dietary_tags: z.array(z.string()).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  total_time_min: z.number().int().nullable().optional(),
  active_time_min: z.number().int().nullable().optional(),
  servings: z.number().int().nullable().optional(),
  favorited: z.boolean().optional(),
  user_rating: z.number().int().min(1).max(5).nullable().optional(),
  ingredients: z.array(z.object({
    id: z.string().uuid().optional(),
    position: z.number().int(),
    item: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    descriptor: z.string().nullable(),
    was_vague: z.boolean(),
    notes: z.array(z.string()),
    confidence: z.number(),
  })).optional(),
  steps: z.array(z.object({
    id: z.string().uuid().optional(),
    position: z.number().int(),
    instruction: z.string(),
    duration_sec: z.number().int().nullable(),
    approximate: z.boolean(),
    temperature: z.string().nullable(),
    confidence: z.number(),
  })).optional(),
  user_corrections: z.any().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recipes")
    .select(`
      *,
      ingredients (id, item, quantity, unit, descriptor, was_vague, notes, confidence, position),
      steps (id, position, instruction, duration_sec, approximate, temperature, confidence),
      equipment (id, item)
    `)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ingredients, steps, user_corrections, ...recipeFields } = parsed.data;

  // Verify ownership
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Update recipe fields
  if (Object.keys(recipeFields).length > 0) {
    const { error } = await supabase
      .from("recipes")
      .update(recipeFields)
      .eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Replace ingredients if provided
  if (ingredients !== undefined) {
    await supabase.from("ingredients").delete().eq("recipe_id", params.id);
    if (ingredients.length > 0) {
      await supabase.from("ingredients").insert(
        ingredients.map((ing) => ({ ...ing, recipe_id: params.id }))
      );
    }
  }

  // Replace steps if provided
  if (steps !== undefined) {
    await supabase.from("steps").delete().eq("recipe_id", params.id);
    if (steps.length > 0) {
      await supabase.from("steps").insert(
        steps.map((step) => ({ ...step, recipe_id: params.id }))
      );
    }
  }

  // Save user corrections diff
  if (user_corrections !== undefined) {
    await supabase
      .from("raw_inputs")
      .update({ user_corrections })
      .eq("recipe_id", params.id);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
