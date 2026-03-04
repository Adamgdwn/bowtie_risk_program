import { z } from "zod";

const inputSchema = z.object({
  stepId: z.number().int().min(1).max(8),
  stepTitle: z.string(),
  currentNotes: z.string().optional(),
  project: z.object({
    title: z.string(),
    industry: z.string(),
    topEvent: z.string(),
    contextNotes: z.string().nullable().optional(),
  }),
  graphSummary: z.object({
    nodeCount: z.number(),
    edgeCount: z.number(),
    topThreats: z.array(z.string()),
    topConsequences: z.array(z.string()),
    preventiveBarriers: z.array(z.string()),
    mitigativeBarriers: z.array(z.string()),
  }),
});

const outputSchema = z.object({
  headline: z.string(),
  discussionPrompts: z.array(z.string()).min(3).max(8),
  qualityChecks: z.array(z.string()).min(3).max(8),
  nextActions: z.array(z.string()).min(2).max(6),
});

type Input = z.infer<typeof inputSchema>;

function fallbackGuidance(input: Input) {
  return {
    headline: `Step ${input.stepId}: ${input.stepTitle}`,
    discussionPrompts: [
      `Given top event "${input.project.topEvent}", what is the exact decision we need to make in this step?`,
      `What evidence from incidents or operations supports our assumptions in ${input.project.industry}?`,
      `Which missing information could change this step's conclusions?`,
    ],
    qualityChecks: [
      "Statements are specific and testable, not generic.",
      "Items align directly to the top event and not unrelated downstream chains.",
      "Each critical point has a clear owner/accountability role.",
    ],
    nextActions: [
      "Capture one concrete decision and one assumption in notes.",
      "Assign owner and due date for any unresolved gap.",
    ],
    source: "fallback" as const,
  };
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

export async function generateWorkflowGuidance(rawInput: unknown, apiKey: string | null) {
  const input = inputSchema.parse(rawInput);
  if (!apiKey) {
    return fallbackGuidance(input);
  }

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
          name: "workflow_guidance",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              discussionPrompts: { type: "array", items: { type: "string" } },
              qualityChecks: { type: "array", items: { type: "string" } },
              nextActions: { type: "array", items: { type: "string" } },
            },
            required: ["headline", "discussionPrompts", "qualityChecks", "nextActions"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a Bowtie workshop facilitator. Give practical, specific, audit-ready facilitation guidance for the active workflow step.",
        },
        {
          role: "user",
          content: JSON.stringify({
            ...input,
            instructions: [
              "Use the project/graph context and current note text.",
              "Ask precise questions that help the user write high-quality worksheet notes.",
              "Avoid generic advice.",
            ],
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return fallbackGuidance(input);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  if (!raw) {
    return fallbackGuidance(input);
  }

  try {
    const parsed = outputSchema.parse(JSON.parse(extractJsonObject(raw)));
    return {
      ...parsed,
      source: "llm" as const,
    };
  } catch {
    return fallbackGuidance(input);
  }
}
