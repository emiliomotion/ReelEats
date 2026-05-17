import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShoppingListClient } from "./shopping-list-client";

export default async function ShoppingListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("*, shopping_list_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, ingredients(id, item, quantity, unit, descriptor)")
    .eq("user_id", user.id)
    .eq("is_recipe", true)
    .order("created_at", { ascending: false });

  return (
    <ShoppingListClient
      initialList={list}
      recipes={recipes ?? []}
    />
  );
}
