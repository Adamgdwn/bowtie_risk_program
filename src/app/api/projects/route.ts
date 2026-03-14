import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/bowtie/templates";
import { createProjectWithGraph, ensureProjectCreationAllowed } from "@/lib/projects/create-project";

const createProjectSchema = z.object({
  title: z.string().min(1),
  industry: z.string().min(1),
  topEvent: z.string().min(1),
  contextNotes: z.string().optional(),
  templateId: z.string().optional(),
});

export async function GET() {
  const { user, supabase } = await requireUser();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const { user, supabase } = await requireUser();
  const parsed = createProjectSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const projectLimitError = await ensureProjectCreationAllowed(supabase, user.id);
  if (projectLimitError) {
    return NextResponse.json(
      { error: projectLimitError },
      { status: 403 },
    );
  }

  const template = TEMPLATES.find((item) => item.id === payload.templateId) ?? TEMPLATES[0];
  const { error, project } = await createProjectWithGraph(supabase, user.id, {
    title: payload.title,
    industry: payload.industry,
    topEvent: payload.topEvent,
    contextNotes: payload.contextNotes ?? null,
    nodes: template.nodes,
    edges: template.edges,
  });
  if (error || !project) {
    return NextResponse.json({ error: error ?? "Failed to create project." }, { status: 500 });
  }

  return NextResponse.json({ project });
}
