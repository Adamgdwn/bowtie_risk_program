import { z } from "zod";
import { NodeType } from "@/lib/types/bowtie";

const nodeTypeSchema = z.enum([
  "top_event",
  "threat",
  "preventive_barrier",
  "consequence",
  "mitigative_barrier",
  "escalation_factor",
  "escalation_factor_control",
]);

const suggestionSchema = z.object({
  label: z.string(),
  description: z.string().default(""),
  nodeType: nodeTypeSchema.optional(),
});

const inputSchema = z.object({
  action: z.string(),
  selectedNode: z.object({
    id: z.string(),
    data: z.object({
      type: nodeTypeSchema,
      title: z.string().optional(),
      description: z.string().optional(),
      typeLabel: z.string().optional(),
    }),
  }),
  project: z.object({
    title: z.string(),
    industry: z.string(),
    topEvent: z.string(),
    contextNotes: z.string().nullable().optional(),
  }),
  contextGraph: z
    .object({
      nodes: z.array(
        z.object({
          id: z.string(),
          data: z.object({
            type: nodeTypeSchema,
            title: z.string().optional(),
          }),
        }),
      ),
      edges: z.array(
        z.object({
          source: z.string(),
          target: z.string(),
        }),
      ),
    })
    .optional(),
});

type SuggestionsInput = z.infer<typeof inputSchema>;
type SuggestionItem = {
  id: string;
  label: string;
  description: string;
  nodeType?: NodeType;
};
type ProviderResult = {
  suggestions: SuggestionItem[] | null;
  error?: string;
};

export type ByokProvider = "openai" | "openrouter" | "anthropic" | "gemini";
export type ByokProviderPreference = "auto" | ByokProvider;

function inferNodeTypeFromAction(action: string, selectedType: NodeType): NodeType {
  const normalized = action.toLowerCase();
  if (normalized.includes("threat")) return "threat";
  if (normalized.includes("consequence")) return "consequence";
  if (normalized.includes("preventive")) return "preventive_barrier";
  if (normalized.includes("mitigative")) return "mitigative_barrier";
  if (normalized.includes("escalation factor")) return "escalation_factor";
  if (normalized.includes("starter barriers")) {
    return selectedType === "top_event" ? "preventive_barrier" : "mitigative_barrier";
  }
  return "preventive_barrier";
}

function fallbackSuggestions(input: SuggestionsInput): SuggestionItem[] {
  const suggestedType = inferNodeTypeFromAction(input.action, input.selectedNode.data.type);
  const base = [
    `${input.project.industry} operational upset`,
    `${input.project.industry} equipment failure`,
    `Human factors under ${input.project.topEvent}`,
  ];
  return base.map((value, index) => ({
    id: `s-${index + 1}`,
    label: value,
    description: `Suggested for ${input.action}`,
    nodeType: suggestedType,
  }));
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return text.slice(first, last + 1);
  }
  return text.trim();
}

function detectProvider(
  apiKey: string,
  preferredProvider: ByokProviderPreference = "auto",
): ByokProvider {
  if (preferredProvider !== "auto") {
    return preferredProvider;
  }
  const forced = (process.env.BYOK_PROVIDER || "").toLowerCase();
  if (forced === "openai" || forced === "openrouter" || forced === "anthropic" || forced === "gemini") {
    return forced;
  }
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("AIza")) return "gemini";
  return "openai";
}

function detectProviderFromKey(apiKey: string): ByokProvider {
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("AIza")) return "gemini";
  return "openai";
}

async function readProviderError(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  try {
    const text = await response.text();
    if (!text) return fallback;
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof json.error === "string") return json.error;
      if (json.error && typeof json.error === "object" && json.error.message) {
        return json.error.message;
      }
      if (json.message) return json.message;
    } catch {
      return text.slice(0, 220);
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function buildPromptPayload(input: SuggestionsInput, suggestedType: NodeType) {
  const graphSummary = {
    nodeCount: input.contextGraph?.nodes.length ?? 0,
    edgeCount: input.contextGraph?.edges.length ?? 0,
    nodes: (input.contextGraph?.nodes ?? []).slice(0, 30).map((node) => ({
      id: node.id,
      type: node.data.type,
      title: node.data.title ?? "",
    })),
  };
  return {
    task: input.action,
    suggestedNodeType: suggestedType,
    project: input.project,
    selectedNode: input.selectedNode,
    graphSummary,
    rules: [
      "Output JSON only.",
      "Return 5 suggestions when possible.",
      "Each suggestion label must be concise and actionable.",
      "Descriptions should mention why the suggestion fits this top event and industry.",
    ],
    outputSchema: {
      suggestions: [{ label: "string", description: "string", nodeType: "node_type" }],
    },
    validNodeTypes: [
      "threat",
      "preventive_barrier",
      "consequence",
      "mitigative_barrier",
      "escalation_factor",
      "escalation_factor_control",
    ],
  };
}

async function getOpenAiSuggestions(
  input: SuggestionsInput,
  apiKey: string,
): Promise<ProviderResult> {
  const selectedType = input.selectedNode.data.type;
  const suggestedType = inferNodeTypeFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedType);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bowtie_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    description: { type: "string" },
                    nodeType: {
                      type: "string",
                      enum: [
                        "threat",
                        "preventive_barrier",
                        "consequence",
                        "mitigative_barrier",
                        "escalation_factor",
                        "escalation_factor_control",
                      ],
                    },
                  },
                  required: ["label", "description", "nodeType"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a Bowtie Method risk specialist. Produce practical, specific suggestions for the requested node type using best-practice hazard and barrier language. Avoid generic filler.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
    }),
  });

  if (!response.ok) {
    return { suggestions: null, error: await readProviderError(response) };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  if (!raw) {
    return { suggestions: null, error: "Provider returned empty content." };
  }

  try {
    const parsedJson = JSON.parse(extractJsonObject(raw)) as { suggestions?: unknown[] };
    const parsedList = z.array(suggestionSchema).safeParse(parsedJson.suggestions ?? []);
    if (!parsedList.success || parsedList.data.length === 0) {
      return { suggestions: null, error: "No valid suggestions in provider response." };
    }
    return {
      suggestions: parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedType,
      })),
    };
  } catch {
    return { suggestions: null, error: "Failed to parse provider JSON output." };
  }
}

async function getOpenRouterSuggestions(
  input: SuggestionsInput,
  apiKey: string,
): Promise<ProviderResult> {
  const selectedType = input.selectedNode.data.type;
  const suggestedType = inferNodeTypeFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedType);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a Bowtie Method risk specialist. Produce practical, specific suggestions for the requested node type using best-practice hazard and barrier language. Avoid generic filler.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
    }),
  });

  if (!response.ok) return { suggestions: null, error: await readProviderError(response) };
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  if (!raw) return { suggestions: null, error: "Provider returned empty content." };
  try {
    const parsedJson = JSON.parse(extractJsonObject(raw)) as { suggestions?: unknown[] };
    const parsedList = z.array(suggestionSchema).safeParse(parsedJson.suggestions ?? []);
    if (!parsedList.success || parsedList.data.length === 0) {
      return { suggestions: null, error: "No valid suggestions in provider response." };
    }
    return {
      suggestions: parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedType,
      })),
    };
  } catch {
    return { suggestions: null, error: "Failed to parse provider JSON output." };
  }
}

async function getAnthropicSuggestions(
  input: SuggestionsInput,
  apiKey: string,
): Promise<ProviderResult> {
  const selectedType = input.selectedNode.data.type;
  const suggestedType = inferNodeTypeFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedType);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 900,
      temperature: 0.3,
      system:
        "You are a Bowtie Method risk specialist. Produce practical, specific suggestions for the requested node type using best-practice hazard and barrier language. Avoid generic filler. Return JSON only.",
      messages: [{ role: "user", content: JSON.stringify(prompt) }],
    }),
  });

  if (!response.ok) return { suggestions: null, error: await readProviderError(response) };
  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const raw = payload.content?.find((item) => item.type === "text")?.text ?? "";
  if (!raw) return { suggestions: null, error: "Provider returned empty content." };
  try {
    const parsedJson = JSON.parse(extractJsonObject(raw)) as { suggestions?: unknown[] };
    const parsedList = z.array(suggestionSchema).safeParse(parsedJson.suggestions ?? []);
    if (!parsedList.success || parsedList.data.length === 0) {
      return { suggestions: null, error: "No valid suggestions in provider response." };
    }
    return {
      suggestions: parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedType,
      })),
    };
  } catch {
    return { suggestions: null, error: "Failed to parse provider JSON output." };
  }
}

async function getGeminiSuggestions(
  input: SuggestionsInput,
  apiKey: string,
): Promise<ProviderResult> {
  const selectedType = input.selectedNode.data.type;
  const suggestedType = inferNodeTypeFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedType);
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.3,
        },
        contents: [
          {
            parts: [
              {
                text:
                  "You are a Bowtie Method risk specialist. Return JSON only with suggestions that are specific and practical.",
              },
              { text: JSON.stringify(prompt) },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) return { suggestions: null, error: await readProviderError(response) };
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const raw = payload.candidates?.[0]?.content?.parts?.map((item) => item.text ?? "").join("\n") ?? "";
  if (!raw) return { suggestions: null, error: "Provider returned empty content." };
  try {
    const parsedJson = JSON.parse(extractJsonObject(raw)) as { suggestions?: unknown[] };
    const parsedList = z.array(suggestionSchema).safeParse(parsedJson.suggestions ?? []);
    if (!parsedList.success || parsedList.data.length === 0) {
      return { suggestions: null, error: "No valid suggestions in provider response." };
    }
    return {
      suggestions: parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedType,
      })),
    };
  } catch {
    return { suggestions: null, error: "Failed to parse provider JSON output." };
  }
}

export async function getSuggestions(
  rawInput: unknown,
  apiKey: string | null,
  selectedModel: string | null,
  preferredProvider: ByokProviderPreference = "auto",
) {
  const parsed = inputSchema.parse(rawInput);

  // MVP placeholder for managed top-tier models.
  // Production setup: route requests through your backend model gateway,
  // enforce per-plan allowlist, and track usage for billing.
  if (selectedModel && selectedModel !== "byok") {
    return {
      mode: "managed-placeholder",
      suggestions: fallbackSuggestions(parsed),
      message:
        "Managed model mode is configured as placeholder. Connect your model gateway in app/api/ai/suggestions.",
    };
  }

  if (!apiKey) {
    return {
      mode: "fallback",
      suggestions: fallbackSuggestions(parsed),
      message: "No API key configured. Showing deterministic local suggestions.",
    };
  }

  const provider = detectProvider(apiKey, preferredProvider);
  const keyProvider = detectProviderFromKey(apiKey);
  const providersToTry: ByokProvider[] =
    provider === keyProvider ? [provider] : [provider, keyProvider];

  let providerSuggestions: SuggestionItem[] | null = null;
  let lastError = "";
  let successfulProvider: ByokProvider | null = null;

  for (const candidate of providersToTry) {
    let result: ProviderResult = { suggestions: null, error: "Unknown provider." };
    if (candidate === "openai") {
      result = await getOpenAiSuggestions(parsed, apiKey);
    } else if (candidate === "openrouter") {
      result = await getOpenRouterSuggestions(parsed, apiKey);
    } else if (candidate === "anthropic") {
      result = await getAnthropicSuggestions(parsed, apiKey);
    } else if (candidate === "gemini") {
      result = await getGeminiSuggestions(parsed, apiKey);
    }

    if (result.suggestions && result.suggestions.length > 0) {
      providerSuggestions = result.suggestions;
      successfulProvider = candidate;
      break;
    }
    lastError = result.error ?? lastError;
  }

  if (providerSuggestions && providerSuggestions.length > 0) {
    return {
      mode: `byok-${successfulProvider ?? provider}`,
      suggestions: providerSuggestions,
      message: `Generated with your BYOK provider (${successfulProvider ?? provider}).`,
    };
  }

  return {
    mode: "byok-fallback",
    suggestions: fallbackSuggestions(parsed),
    message: `BYOK call failed. Showing fallback suggestions. ${lastError || "Verify provider/key/model configuration."}`,
  };
}
