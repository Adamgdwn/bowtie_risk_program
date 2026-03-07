"use client";

import { useState } from "react";

interface Props {
  initialSettings: {
    plan_tier: "free" | "pro" | "team";
    selected_model: string;
    has_encrypted_api_key: boolean;
    byok_provider: "auto" | "openai" | "openrouter" | "anthropic" | "gemini";
  };
}

export function SettingsForm({ initialSettings }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [planTier, setPlanTier] = useState(initialSettings.plan_tier);
  const [selectedModel, setSelectedModel] = useState(initialSettings.selected_model ?? "byok");
  const [byokProvider, setByokProvider] = useState(initialSettings.byok_provider ?? "auto");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          planTier,
          selectedModel,
          byokProvider,
        }),
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as { error?: string }) : {};
      setMessage(response.ok ? "Saved." : payload.error ?? "Failed to save settings.");
      if (response.ok) {
        setApiKey("");
      }
    } catch {
      setMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="brand-card rounded-xl p-4">
        <h2 className="brand-heading text-sm font-semibold">AI Provider API Key (BYOK)</h2>
        <p className="brand-text-muted mt-1 text-sm">
          Stored encrypted server-side. Keys are never logged.
          {initialSettings.has_encrypted_api_key ? " Existing key on file." : " No key saved yet."}
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Enter or rotate API key"
          className="mt-2 w-full rounded border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
        />
        <label className="mt-3 block text-xs font-semibold text-[#1F2933]">BYOK Provider</label>
        <select
          value={byokProvider}
          onChange={(event) =>
            setByokProvider(
              event.target.value as "auto" | "openai" | "openrouter" | "anthropic" | "gemini",
            )
          }
          className="mt-1 w-full rounded border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
        >
          <option value="auto">Auto-detect from key</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      <div className="brand-card rounded-xl p-4">
        <h2 className="brand-heading text-sm font-semibold">Plan + LLM Mode</h2>
        <p className="brand-text-muted mt-1 text-sm">
          Team tier managed model is currently a backend placeholder contract.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            value={planTier}
            onChange={(event) => setPlanTier(event.target.value as "free" | "pro" | "team")}
            className="rounded border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
          >
            <option value="free">Free (2 projects, BYOK)</option>
            <option value="pro">Pro $10 (unlimited, BYOK)</option>
            <option value="team">Team $30 (unlimited, managed model)</option>
          </select>

          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="rounded border border-[#9CA3AF] bg-white px-3 py-2 text-sm"
          >
            <option value="byok">Bring your own key</option>
            <option value="managed-gpt">Managed GPT (placeholder)</option>
            <option value="managed-claude">Managed Claude (placeholder)</option>
            <option value="managed-gemini">Managed Gemini (placeholder)</option>
          </select>
        </div>
      </div>

      <button
        className="brand-btn-primary rounded px-4 py-2 text-sm font-semibold disabled:opacity-60"
        onClick={saveSettings}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
      {message ? <p className="text-sm text-[#325D88]">{message}</p> : null}
    </div>
  );
}
