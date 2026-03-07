import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "Use 3-24 chars: lowercase letters, numbers, underscore.");

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = z.object({ username: z.string() }).safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ available: false, error: "Username is required." }, { status: 400 });
  }

  const candidateResult = usernameSchema.safeParse(parsed.data.username);
  if (!candidateResult.success) {
    return NextResponse.json(
      { available: false, error: candidateResult.error.issues[0]?.message ?? "Invalid username." },
      { status: 400 },
    );
  }

  const username = candidateResult.data;
  let data: { user_id: string } | null = null;
  let error: { message: string } | null = null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const response = await admin
      .from("user_settings")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    data = response.data;
    error = response.error ? { message: response.error.message } : null;
  } else {
    const supabase = await createClient();
    const response = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    data = response.data;
    error = response.error ? { message: response.error.message } : null;
  }

  if (error) {
    return NextResponse.json({ available: false, error: "Unable to check username." }, { status: 500 });
  }

  return NextResponse.json({ available: !data, username });
}
