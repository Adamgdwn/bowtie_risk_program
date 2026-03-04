import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { encryptText } from "@/lib/security";
import { ByokProviderPreference } from "@/lib/ai/suggestions";

const updateSchema = z.object({
  apiKey: z.string().optional(),
  selectedModel: z.string().optional(),
  planTier: z.enum(["free", "pro", "team"]).optional(),
  byokProvider: z
    .enum(["auto", "openai", "openrouter", "anthropic", "gemini"])
    .optional(),
});

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const queryWithProvider = await supabase
      .from("user_settings")
      .select("plan_tier, selected_model, has_encrypted_api_key, byok_provider")
      .eq("user_id", user.id)
      .single();

    if (!queryWithProvider.error) {
      const data = queryWithProvider.data;
      return NextResponse.json({
        settings: data ?? {
          plan_tier: "free",
          selected_model: "byok",
          has_encrypted_api_key: false,
          byok_provider: "auto",
        },
      });
    }

    if (queryWithProvider.error.code !== "PGRST116") {
      const fallback = await supabase
        .from("user_settings")
        .select("plan_tier, selected_model, has_encrypted_api_key")
        .eq("user_id", user.id)
        .single();
      if (fallback.error && fallback.error.code !== "PGRST116") {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
      return NextResponse.json({
        settings: fallback.data ?? {
          plan_tier: "free",
          selected_model: "byok",
          has_encrypted_api_key: false,
          byok_provider: "auto",
        },
      });
    }

    return NextResponse.json({
      settings: {
        plan_tier: "free",
        selected_model: "byok",
        has_encrypted_api_key: false,
        byok_provider: "auto",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const parsed = updateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const { data: existing } = await supabase
      .from("user_settings")
      .select("has_encrypted_api_key")
      .eq("user_id", user.id)
      .single();

    const updatePayload: {
      user_id: string;
      encrypted_api_key?: string;
      has_encrypted_api_key: boolean;
      selected_model: string;
      plan_tier: "free" | "pro" | "team";
      byok_provider?: ByokProviderPreference;
    } = {
      user_id: user.id,
      has_encrypted_api_key: existing?.has_encrypted_api_key ?? false,
      selected_model: payload.selectedModel ?? "byok",
      plan_tier: payload.planTier ?? "free",
      byok_provider: payload.byokProvider ?? "auto",
    };

    if (payload.apiKey) {
      updatePayload.encrypted_api_key = encryptText(payload.apiKey);
      updatePayload.has_encrypted_api_key = true;
    }

    const primaryWrite = await supabase
      .from("user_settings")
      .upsert(updatePayload, { onConflict: "user_id" });

    if (primaryWrite.error) {
      const fallbackPayload = {
        user_id: updatePayload.user_id,
        encrypted_api_key: updatePayload.encrypted_api_key,
        has_encrypted_api_key: updatePayload.has_encrypted_api_key,
        selected_model: updatePayload.selected_model,
        plan_tier: updatePayload.plan_tier,
      };
      const fallbackWrite = await supabase
        .from("user_settings")
        .upsert(fallbackPayload, { onConflict: "user_id" });
      if (fallbackWrite.error) {
        return NextResponse.json({ error: fallbackWrite.error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        message:
          "Saved. BYOK provider preference needs schema migration to persist.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while saving settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
