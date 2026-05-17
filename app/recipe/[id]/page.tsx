import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { RecipeDetailClient } from "./recipe-detail-client";

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { review?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: recipe } = await supabase
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

  if (!recipe) notFound();

  // Sort related data
  recipe.ingredients = recipe.ingredients.sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );
  recipe.steps = recipe.steps.sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );

  return (
    <RecipeDetailClient
      recipe={recipe}
      isReview={searchParams.review === "true"}
    />
  );
}
