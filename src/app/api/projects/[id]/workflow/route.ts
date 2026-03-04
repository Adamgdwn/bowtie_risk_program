import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const stepGuidanceSchema = z.object({
  headline: z.string(),
  discussionPrompts: z.array(z.string()),
  qualityChecks: z.array(z.string()),
  nextActions: z.array(z.string()),
  source: z.enum(["llm", "fallback"]),
  generatedAt: z.string(),
});

const workflowSchema = z.object({
  completed: z.record(z.string(), z.boolean()),
  notes: z.record(z.string(), z.string()),
  guidanceByStep: z.record(z.string(), stepGuidanceSchema).optional(),
  lastActiveStepId: z.number().int().nullable().optional(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, supabase } = await requireUser();

  const { data, error } = await supabase
    .from("projects")
    .select("workflow_state")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({
    workflowState: data.workflow_state ?? { completed: {}, notes: {} },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, supabase } = await requireUser();

  const parsed = workflowSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("projects")
    .update({ workflow_state: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
