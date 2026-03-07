import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();
  let data:
    | {
        plan_tier?: "free" | "pro" | "team";
        selected_model?: string;
        has_encrypted_api_key?: boolean;
        byok_provider?: "auto" | "openai" | "openrouter" | "anthropic" | "gemini";
      }
    | null = null;

  const withProvider = await supabase
    .from("user_settings")
    .select("plan_tier, selected_model, has_encrypted_api_key, byok_provider")
    .eq("user_id", user.id)
    .single();

  if (withProvider.error) {
    const fallback = await supabase
      .from("user_settings")
      .select("plan_tier, selected_model, has_encrypted_api_key")
      .eq("user_id", user.id)
      .single();
    data = fallback.data
      ? {
          ...fallback.data,
          byok_provider: "auto",
        }
      : null;
  } else {
    data = withProvider.data;
  }

  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="brand-heading mb-3 text-xl font-semibold">Settings</h1>
      <SettingsForm
        initialSettings={{
          plan_tier: data?.plan_tier ?? "free",
          selected_model: data?.selected_model ?? "byok",
          has_encrypted_api_key: data?.has_encrypted_api_key ?? false,
          byok_provider: data?.byok_provider ?? "auto",
        }}
      />
    </main>
  );
}
