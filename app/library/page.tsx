import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LibraryClient } from "./library-client";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: reels } = await supabase
    .from("saved_reels")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <LibraryClient initialReels={reels ?? []} />;
}
