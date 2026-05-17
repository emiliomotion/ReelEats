import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { CookModeClient } from "../../../../components/cook-mode/cook-mode-client";

export default async function CookModePage({
  params,
}: {
  params: { id: string };
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

  recipe.steps = recipe.steps.sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );

  return <CookModeClient recipe={recipe} />;
}
