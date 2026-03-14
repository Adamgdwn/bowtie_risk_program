import type { Edge, Node } from "reactflow";
import type { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import type { BowtieNodeData } from "@/lib/types/bowtie";

type GraphSeed = {
  title: string;
  industry: string;
  topEvent: string;
  contextNotes?: string | null;
  nodes: Node<BowtieNodeData>[];
  edges: Edge[];
};

export async function ensureProjectCreationAllowed(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  const { data: settings } = await supabase
    .from("user_settings")
    .select("plan_tier")
    .eq("user_id", userId)
    .single();

  const isFree = !settings || settings.plan_tier === "free";
  if (isFree && (count ?? 0) >= 2) {
    return "Free tier allows two active projects. Upgrade to create more.";
  }

  return null;
}

export async function createProjectWithGraph(supabase: SupabaseClient, userId: string, seed: GraphSeed) {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      title: seed.title,
      industry: seed.industry,
      top_event: seed.topEvent,
      context_notes: seed.contextNotes ?? null,
    })
    .select("*")
    .single();

  if (error || !project) {
    return { error: error?.message ?? "Failed to create project.", project: null };
  }

  const nodeIdMap: Record<string, string> = {};
  for (const node of seed.nodes) {
    nodeIdMap[node.id] = uuid();
  }

  const nodesPayload = seed.nodes.map((node) => {
    const mappedId = nodeIdMap[node.id];
    const isTopEvent = node.data.type === "top_event";
    return {
      id: mappedId,
      project_id: project.id,
      type: node.data.type,
      title: isTopEvent ? seed.topEvent : node.data.title,
      description: node.data.description ?? "",
      position_x: node.position.x,
      position_y: node.position.y,
      data: {
        ...node.data,
        title: isTopEvent ? seed.topEvent : node.data.title,
        context: isTopEvent ? seed.contextNotes ?? "" : node.data.context ?? "",
      },
    };
  });

  const edgesPayload = seed.edges.map((edge) => ({
    id: uuid(),
    project_id: project.id,
    source_node_id: nodeIdMap[edge.source],
    target_node_id: nodeIdMap[edge.target],
    type: edge.type ?? "smoothstep",
    data: edge.data ?? {},
  }));

  const { error: nodeError } = await supabase.from("nodes").insert(nodesPayload);
  if (nodeError) {
    return { error: nodeError.message, project: null };
  }

  if (edgesPayload.length > 0) {
    const { error: edgeError } = await supabase.from("edges").insert(edgesPayload);
    if (edgeError) {
      return { error: edgeError.message, project: null };
    }
  }

  return { error: null, project };
}
