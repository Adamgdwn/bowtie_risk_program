import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { decryptText } from "@/lib/security";
import { ByokProviderPreference, getSuggestions } from "@/lib/ai/suggestions";

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const body = await request.json();

    let settings:
      | {
          encrypted_api_key: string | null;
          selected_model: string | null;
          byok_provider: ByokProviderPreference | null;
        }
      | null = null;

    const primary = await supabase
      .from("user_settings")
      .select("encrypted_api_key, selected_model, byok_provider")
      .eq("user_id", user.id)
      .single();

    if (primary.error) {
      const fallback = await supabase
        .from("user_settings")
        .select("encrypted_api_key, selected_model")
        .eq("user_id", user.id)
        .single();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      settings = {
        encrypted_api_key: fallback.data?.encrypted_api_key ?? null,
        selected_model: fallback.data?.selected_model ?? "byok",
        byok_provider: "auto",
      };
    } else {
      settings = {
        encrypted_api_key: primary.data?.encrypted_api_key ?? null,
        selected_model: primary.data?.selected_model ?? "byok",
        byok_provider: (primary.data?.byok_provider as ByokProviderPreference | null) ?? "auto",
      };
    }

    let apiKey: string | null = null;
    if (settings?.encrypted_api_key) {
      try {
        apiKey = decryptText(settings.encrypted_api_key);
      } catch {
        apiKey = null;
      }
    }

    const result = await getSuggestions(
      body,
      apiKey,
      settings?.selected_model ?? "byok",
      settings?.byok_provider ?? "auto",
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected AI suggestions error.";
    return NextResponse.json({ suggestions: [], message }, { status: 500 });
  }
}
