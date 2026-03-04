import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbEdgesToFlow, dbNodesToFlow } from "@/lib/bowtie/mapper";
import { BowtieEditor } from "@/components/editor/BowtieEditor";
import { WorkflowState } from "@/lib/types/workflow";

export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!project) {
    notFound();
  }

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    supabase.from("nodes").select("*").eq("project_id", id),
    supabase.from("edges").select("*").eq("project_id", id),
  ]);

  const workflow = (project.workflow_state ?? {}) as WorkflowState;

  return (
    <main>
      <BowtieEditor
        projectId={id}
        projectMeta={{
          title: project.title,
          industry: project.industry,
          topEvent: project.top_event,
          contextNotes: project.context_notes,
        }}
        initialNodes={dbNodesToFlow(nodes ?? [])}
        initialEdges={dbEdgesToFlow(edges ?? [])}
        initialWorkflowState={{
          completed: workflow.completed ?? {},
          notes: workflow.notes ?? {},
          guidanceByStep: workflow.guidanceByStep ?? {},
          lastActiveStepId: workflow.lastActiveStepId ?? null,
        }}
      />
    </main>
  );
}
