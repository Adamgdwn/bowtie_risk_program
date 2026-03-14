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
type GraphNodeSummary = {
  id: string;
  type: NodeType;
  title: string;
};
type BranchContext = {
  selectedNode: GraphNodeSummary;
  incoming: GraphNodeSummary[];
  outgoing: GraphNodeSummary[];
  incomingByType: Partial<Record<NodeType, string[]>>;
  outgoingByType: Partial<Record<NodeType, string[]>>;
  branchInstruction: string;
};

export type ByokProvider = "openai" | "openrouter" | "anthropic" | "gemini";
export type ByokProviderPreference = "auto" | ByokProvider;

function normalizeSuggestionLabel(label?: string | null) {
  return label?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function toTitleCaseLabel(type: NodeType) {
  return type.replaceAll("_", " ");
}

function buildTitlesByType(nodes: GraphNodeSummary[]) {
  return nodes.reduce<Partial<Record<NodeType, string[]>>>((acc, node) => {
    const current = acc[node.type] ?? [];
    if (!current.includes(node.title)) {
      current.push(node.title);
      acc[node.type] = current;
    }
    return acc;
  }, {});
}

function getExistingLabelsByType(input: SuggestionsInput) {
  const existingByType: Partial<Record<NodeType, string[]>> = {};
  for (const node of input.contextGraph?.nodes ?? []) {
    const normalized = normalizeSuggestionLabel(node.data.title);
    if (!normalized) continue;
    const list = existingByType[node.data.type] ?? [];
    if (!list.includes(normalized)) {
      list.push(normalized);
      existingByType[node.data.type] = list;
    }
  }
  return existingByType;
}

function getBranchContext(input: SuggestionsInput): BranchContext {
  const selectedId = input.selectedNode.id;
  const nodeMap = new Map<string, GraphNodeSummary>(
    (input.contextGraph?.nodes ?? []).map((node) => [
      node.id,
      {
        id: node.id,
        type: node.data.type,
        title: node.data.title?.trim() || toTitleCaseLabel(node.data.type),
      },
    ]),
  );

  const fallbackSelected: GraphNodeSummary = {
    id: input.selectedNode.id,
    type: input.selectedNode.data.type,
    title: input.selectedNode.data.title?.trim() || toTitleCaseLabel(input.selectedNode.data.type),
  };
  const selectedNode = nodeMap.get(selectedId) ?? fallbackSelected;

  const incoming: GraphNodeSummary[] = [];
  const outgoing: GraphNodeSummary[] = [];

  for (const edge of input.contextGraph?.edges ?? []) {
    if (edge.target === selectedId) {
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode) incoming.push(sourceNode);
    }
    if (edge.source === selectedId) {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode) outgoing.push(targetNode);
    }
  }

  const incomingByType = buildTitlesByType(incoming);
  const outgoingByType = buildTitlesByType(outgoing);

  let branchInstruction = `Keep suggestions anchored to "${selectedNode.title}" and its immediate bowtie branch.`;
  switch (selectedNode.type) {
    case "top_event":
      branchInstruction =
        `Use "${selectedNode.title}" as the central loss-of-control event. Suggest causes or direct outcomes that are not already shown on either side.`;
      break;
    case "threat":
      branchInstruction =
        `Treat "${selectedNode.title}" as a specific cause of the top event. Suggestions must prevent or clarify this threat branch, not the whole bowtie generically.`;
      break;
    case "preventive_barrier":
      branchInstruction =
        `Treat "${selectedNode.title}" as a preventive barrier on a single threat branch. Suggestions must strengthen this barrier or address what could degrade it.`;
      break;
    case "consequence":
      branchInstruction =
        `Treat "${selectedNode.title}" as a direct consequence of the top event. Suggestions must mitigate or clarify this consequence branch specifically.`;
      break;
    case "mitigative_barrier":
      branchInstruction =
        `Treat "${selectedNode.title}" as a mitigative barrier on a consequence branch. Suggestions must strengthen post-event response for this branch or address what could degrade it.`;
      break;
    case "escalation_factor":
      branchInstruction =
        `Treat "${selectedNode.title}" as something that weakens a barrier. Suggestions must stay focused on this degradation path and how it is controlled.`;
      break;
    case "escalation_factor_control":
      branchInstruction =
        `Treat "${selectedNode.title}" as the control that protects a barrier from degradation. Suggestions must stay focused on this escalation-control logic.`;
      break;
  }

  return {
    selectedNode,
    incoming,
    outgoing,
    incomingByType,
    outgoingByType,
    branchInstruction,
  };
}

function dedupeSuggestions(
  suggestions: SuggestionItem[],
  input: SuggestionsInput,
  suggestedTypes: NodeType[],
) {
  const existingByType = getExistingLabelsByType(input);
  const seen = new Set<string>();

  return suggestions.filter((item, index) => {
    const nodeType = item.nodeType ?? suggestedTypes[index % suggestedTypes.length] ?? suggestedTypes[0];
    const normalized = normalizeSuggestionLabel(item.label);
    if (!normalized) return false;

    const existingForType = new Set(existingByType[nodeType] ?? []);
    if (existingForType.has(normalized)) {
      return false;
    }

    const key = `${nodeType}:${normalized}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getNextLogicalNodeTypes(selectedType: NodeType): NodeType[] {
  switch (selectedType) {
    case "top_event":
      return ["threat", "consequence"];
    case "threat":
      return ["preventive_barrier"];
    case "preventive_barrier":
      return ["escalation_factor"];
    case "consequence":
      return ["mitigative_barrier"];
    case "mitigative_barrier":
      return ["consequence", "escalation_factor"];
    case "escalation_factor":
      return ["escalation_factor_control"];
    case "escalation_factor_control":
      return ["escalation_factor"];
    default:
      return ["preventive_barrier"];
  }
}

function inferNodeTypesFromAction(action: string, selectedType: NodeType): NodeType[] {
  const normalized = action.toLowerCase();
  if (normalized.includes("next logical")) return getNextLogicalNodeTypes(selectedType);
  if (normalized.includes("escalation factor control")) return ["escalation_factor_control"];
  if (normalized.includes("threat")) return ["threat"];
  if (normalized.includes("consequence")) return ["consequence"];
  if (normalized.includes("preventive")) return ["preventive_barrier"];
  if (normalized.includes("mitigative")) return ["mitigative_barrier"];
  if (normalized.includes("escalation factor")) return ["escalation_factor"];
  if (normalized.includes("starter barriers")) {
    return [selectedType === "top_event" ? "preventive_barrier" : "mitigative_barrier"];
  }
  if (normalized.includes("top event")) return ["top_event"];
  return ["preventive_barrier"];
}

function fallbackLabelForType(
  nodeType: NodeType,
  input: SuggestionsInput,
  branchContext: BranchContext,
  variantIndex: number,
): string {
  const selectedTitle = branchContext.selectedNode.title;
  const downstreamConsequence = branchContext.outgoingByType.consequence?.[0];
  const upstreamThreat = branchContext.incomingByType.threat?.[0];
  const connectedBarrier =
    branchContext.incomingByType.preventive_barrier?.[0] ??
    branchContext.outgoingByType.preventive_barrier?.[0] ??
    branchContext.incomingByType.mitigative_barrier?.[0] ??
    branchContext.outgoingByType.mitigative_barrier?.[0];
  switch (nodeType) {
    case "threat":
      return [
        `${input.project.industry} process deviation around ${selectedTitle}`,
        `Human error contributing to ${input.project.topEvent}`,
        `External dependency failure affecting ${input.project.topEvent}`,
      ][variantIndex % 3];
    case "preventive_barrier":
      return [
        `Preventive control for ${selectedTitle}`,
        `Verification step that stops ${selectedTitle}`,
        `${input.project.industry} operating guardrail`,
      ][variantIndex % 3];
    case "consequence":
      return [
        `Operational impact after ${input.project.topEvent}`,
        `Safety or stakeholder harm from ${selectedTitle}`,
        `Regulatory or financial consequence of ${input.project.topEvent}`,
      ][variantIndex % 3];
    case "mitigative_barrier":
      return [
        `Containment response for ${selectedTitle}`,
        `Escalation and recovery control for ${downstreamConsequence ?? input.project.topEvent}`,
        `Incident response barrier for ${input.project.industry}`,
      ][variantIndex % 3];
    case "escalation_factor":
      return [
        `Condition that weakens ${connectedBarrier ?? selectedTitle}`,
        `Staffing or maintenance issue affecting ${connectedBarrier ?? selectedTitle}`,
        `Change pressure undermining ${connectedBarrier ?? selectedTitle}`,
      ][variantIndex % 3];
    case "escalation_factor_control":
      return [
        `Control that protects ${selectedTitle}`,
        `Verification step that keeps ${connectedBarrier ?? selectedTitle} effective`,
        `Oversight measure supporting ${upstreamThreat ?? selectedTitle}`,
      ][variantIndex % 3];
    case "top_event":
      return [
        `Loss of control involving ${input.project.industry} operations`,
        `Critical event centered on ${selectedTitle}`,
        `Top event phrasing for ${input.project.title}`,
      ][variantIndex % 3];
    default:
      return `${input.project.industry} risk item`;
  }
}

function fallbackSuggestions(input: SuggestionsInput): SuggestionItem[] {
  const suggestedTypes = inferNodeTypesFromAction(input.action, input.selectedNode.data.type);
  const branchContext = getBranchContext(input);
  const rawSuggestions = Array.from({ length: 8 }, (_, index) => {
    const nodeType = suggestedTypes[index % suggestedTypes.length] ?? "preventive_barrier";
    return {
      id: `s-${index + 1}`,
      label: fallbackLabelForType(nodeType, input, branchContext, index),
      description: `Suggested for ${input.action} in ${input.project.industry}.`,
      nodeType,
    };
  });
  return dedupeSuggestions(rawSuggestions, input, suggestedTypes).slice(0, 5);
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

function buildPromptPayload(input: SuggestionsInput, suggestedTypes: NodeType[]) {
  const existingLabelsByType = getExistingLabelsByType(input);
  const branchContext = getBranchContext(input);
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
    suggestedNodeTypes: suggestedTypes,
    existingNodeLabelsByType: existingLabelsByType,
    branchContext: {
      selectedNode: branchContext.selectedNode,
      incoming: branchContext.incoming,
      outgoing: branchContext.outgoing,
      incomingByType: branchContext.incomingByType,
      outgoingByType: branchContext.outgoingByType,
      instruction: branchContext.branchInstruction,
    },
    project: input.project,
    selectedNode: input.selectedNode,
    graphSummary,
    rules: [
      "Output JSON only.",
      "Return 5 suggestions when possible.",
      "Each suggestion label must be concise and actionable.",
      "Descriptions should mention why the suggestion fits this top event and industry.",
      "If the task asks for next logical nodes, only suggest node types that would connect directly to the selected node in a bowtie.",
      "Do not repeat or closely paraphrase existing node titles already present in the graph for the same node type.",
      "Use the selected branch context, including immediate upstream and downstream connected nodes, to keep suggestions branch-specific.",
    ],
    outputSchema: {
      suggestions: [{ label: "string", description: "string", nodeType: "node_type" }],
    },
    validNodeTypes: suggestedTypes,
  };
}

async function getOpenAiSuggestions(
  input: SuggestionsInput,
  apiKey: string,
): Promise<ProviderResult> {
  const selectedType = input.selectedNode.data.type;
  const suggestedTypes = inferNodeTypesFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedTypes);

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
    const deduped = dedupeSuggestions(
      parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedTypes[index % suggestedTypes.length] ?? suggestedTypes[0],
      })),
      input,
      suggestedTypes,
    );
    if (deduped.length === 0) {
      return { suggestions: null, error: "Provider suggestions were duplicates of the current graph." };
    }
    return {
      suggestions: deduped.slice(0, 5),
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
  const suggestedTypes = inferNodeTypesFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedTypes);

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
    const deduped = dedupeSuggestions(
      parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedTypes[index % suggestedTypes.length] ?? suggestedTypes[0],
      })),
      input,
      suggestedTypes,
    );
    if (deduped.length === 0) {
      return { suggestions: null, error: "Provider suggestions were duplicates of the current graph." };
    }
    return {
      suggestions: deduped.slice(0, 5),
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
  const suggestedTypes = inferNodeTypesFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedTypes);

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
    const deduped = dedupeSuggestions(
      parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedTypes[index % suggestedTypes.length] ?? suggestedTypes[0],
      })),
      input,
      suggestedTypes,
    );
    if (deduped.length === 0) {
      return { suggestions: null, error: "Provider suggestions were duplicates of the current graph." };
    }
    return {
      suggestions: deduped.slice(0, 5),
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
  const suggestedTypes = inferNodeTypesFromAction(input.action, selectedType);
  const prompt = buildPromptPayload(input, suggestedTypes);
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
    const deduped = dedupeSuggestions(
      parsedList.data.map((item, index) => ({
        id: `s-${index + 1}`,
        label: item.label,
        description: item.description,
        nodeType: item.nodeType ?? suggestedTypes[index % suggestedTypes.length] ?? suggestedTypes[0],
      })),
      input,
      suggestedTypes,
    );
    if (deduped.length === 0) {
      return { suggestions: null, error: "Provider suggestions were duplicates of the current graph." };
    }
    return {
      suggestions: deduped.slice(0, 5),
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
