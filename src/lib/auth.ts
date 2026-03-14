import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireUser(redirectTo?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (redirectTo) {
      redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
    }
    redirect("/login");
  }

  return { user, supabase };
}
