import { NextResponse } from "next/server";
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, error: "Unable to check username." }, { status: 500 });
  }

  return NextResponse.json({ available: !data, username });
}

