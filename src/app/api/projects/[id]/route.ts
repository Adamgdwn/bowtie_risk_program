import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
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

const nodeDataSchema = z.object({
  type: nodeTypeSchema,
  title: z.string(),
  typeLabel: z.string(),
  description: z.string().optional(),
  collapsedLeft: z.boolean().optional(),
  collapsedRight: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  context: z.string().optional(),
  cause: z.string().optional(),
  source: z.string().optional(),
  impact: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  barrierType: z.enum(["engineering", "procedural", "human", "other"]).optional(),
  owner: z.string().optional(),
  performanceStandard: z.string().optional(),
  verificationMethod: z.string().optional(),
  frequency: z.string().optional(),
  factor: z.string().optional(),
  control: z.string().optional(),
});

const saveCanvasSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: nodeDataSchema,
      type: z.string().optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      type: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, supabase } = await requireUser();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const [{ data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
    supabase.from("nodes").select("*").eq("project_id", id),
    supabase.from("edges").select("*").eq("project_id", id),
  ]);

  if (nodesError || edgesError) {
    return NextResponse.json({ error: nodesError?.message ?? edgesError?.message }, { status: 500 });
  }

  return NextResponse.json({ project, nodes, edges });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, supabase } = await requireUser();
  const parsed = saveCanvasSchema.safeParse(await request.json());

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

  const nodesPayload = parsed.data.nodes.map((node) => ({
    id: node.id,
    project_id: id,
    type: (node.data?.type as NodeType) ?? "threat",
    title: node.data?.title ?? "Untitled",
    description: node.data?.description ?? "",
    position_x: node.position?.x ?? 0,
    position_y: node.position?.y ?? 0,
    data: node.data,
  }));

  const edgesPayload = parsed.data.edges.map((edge) => ({
    id: edge.id,
    project_id: id,
    source_node_id: edge.source,
    target_node_id: edge.target,
    type: edge.type ?? "smoothstep",
    data: edge.data ?? {},
  }));

  const latestTopEvent =
    parsed.data.nodes.find((node) => node.data?.type === "top_event")?.data?.title?.trim() ?? "";

  const { error: deleteNodesError } = await supabase.from("nodes").delete().eq("project_id", id);
  if (deleteNodesError) {
    return NextResponse.json({ error: deleteNodesError.message }, { status: 500 });
  }

  const { error: deleteEdgesError } = await supabase.from("edges").delete().eq("project_id", id);
  if (deleteEdgesError) {
    return NextResponse.json({ error: deleteEdgesError.message }, { status: 500 });
  }

  if (nodesPayload.length > 0) {
    const { error: upsertNodesError } = await supabase.from("nodes").insert(nodesPayload);
    if (upsertNodesError) {
      return NextResponse.json({ error: upsertNodesError.message }, { status: 500 });
    }
  }

  if (edgesPayload.length > 0) {
    const { error: upsertEdgesError } = await supabase.from("edges").insert(edgesPayload);
    if (upsertEdgesError) {
      return NextResponse.json({ error: upsertEdgesError.message }, { status: 500 });
    }
  }

  await supabase
    .from("projects")
    .update({
      top_event: latestTopEvent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
