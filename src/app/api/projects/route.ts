import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/bowtie/templates";
import { v4 as uuid } from "uuid";

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

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const { data: settings } = await supabase
    .from("user_settings")
    .select("plan_tier")
    .eq("user_id", user.id)
    .single();

  const isFree = !settings || settings.plan_tier === "free";
  if (isFree && (count ?? 0) >= 2) {
    return NextResponse.json(
      { error: "Free tier allows two active projects. Upgrade to create more." },
      { status: 403 },
    );
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      title: payload.title,
      industry: payload.industry,
      top_event: payload.topEvent,
      context_notes: payload.contextNotes ?? null,
    })
    .select("*")
    .single();

  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? "Failed to create project." }, { status: 500 });
  }

  const template = TEMPLATES.find((item) => item.id === payload.templateId) ?? TEMPLATES[0];
  const nodeIdMap: Record<string, string> = {};
  for (const node of template.nodes) {
    nodeIdMap[node.id] = uuid();
  }

  const nodesPayload = template.nodes.map((node) => {
    const mappedId = nodeIdMap[node.id];
    const isTopEvent = node.data.type === "top_event";
    return {
      id: mappedId,
      project_id: project.id,
      type: node.data.type,
      title: isTopEvent ? payload.topEvent : node.data.title,
      description: node.data.description ?? "",
      position_x: node.position.x,
      position_y: node.position.y,
      data: {
        ...node.data,
        title: isTopEvent ? payload.topEvent : node.data.title,
        context: isTopEvent ? payload.contextNotes ?? "" : node.data.context ?? "",
      },
    };
  });

  const edgesPayload = template.edges.map((edge) => ({
    id: uuid(),
    project_id: project.id,
    source_node_id: nodeIdMap[edge.source],
    target_node_id: nodeIdMap[edge.target],
    type: edge.type ?? "smoothstep",
    data: edge.data ?? {},
  }));

  const { error: nodeError } = await supabase.from("nodes").insert(nodesPayload);
  if (nodeError) {
    return NextResponse.json({ error: nodeError.message }, { status: 500 });
  }

  if (edgesPayload.length > 0) {
    const { error: edgeError } = await supabase.from("edges").insert(edgesPayload);
    if (edgeError) {
      return NextResponse.json({ error: edgeError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ project });
}
