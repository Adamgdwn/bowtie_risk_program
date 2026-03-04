import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { decryptText } from "@/lib/security";
import { generateWorkflowGuidance } from "@/lib/ai/workflow-guidance";

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const body = await request.json();

    const { data: settings } = await supabase
      .from("user_settings")
      .select("encrypted_api_key, selected_model")
      .eq("user_id", user.id)
      .single();

    let apiKey: string | null = null;
    if (settings?.encrypted_api_key) {
      try {
        apiKey = decryptText(settings.encrypted_api_key);
      } catch {
        apiKey = null;
      }
    }

    const guidance = await generateWorkflowGuidance(body, apiKey);
    return NextResponse.json(guidance);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected worksheet guidance error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
