import { Edge, Node } from "reactflow";

export interface ValidationWarning {
  code: string;
  message: string;
}

export function validateBowtie(nodes: Node[], edges: Edge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const threatNodes = nodes.filter((node) => node.data?.type === "threat");
  const consequenceNodes = nodes.filter((node) => node.data?.type === "consequence");

  if (threatNodes.length === 0) {
    warnings.push({
      code: "NO_THREATS",
      message: "Add at least one Threat to improve bowtie completeness.",
    });
  }

  if (consequenceNodes.length === 0) {
    warnings.push({
      code: "NO_CONSEQUENCES",
      message: "Add at least one Consequence to complete right-hand bowtie logic.",
    });
  }

  for (const edge of edges) {
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);
    if (source?.data?.type === "threat" && target?.data?.type === "consequence") {
      warnings.push({
        code: "THREAT_TO_CONSEQUENCE_DIRECT",
        message: "Threat should route through Top Event, not directly to Consequence.",
      });
    }
  }

  for (const node of nodes) {
    if (
      node.data?.type === "preventive_barrier" ||
      node.data?.type === "mitigative_barrier"
    ) {
      if (!node.data.owner || !node.data.performanceStandard) {
        warnings.push({
          code: "BARRIER_QUALITY",
          message: `Barrier "${node.data.title}" should include owner and performance standard.`,
        });
      }
    }

    const connected = edges.some((edge) => edge.source === node.id || edge.target === node.id);
    if (
      (node.data?.type === "preventive_barrier" || node.data?.type === "mitigative_barrier") &&
      !connected
    ) {
      warnings.push({
        code: "UNCONNECTED_BARRIER",
        message: `Barrier "${node.data.title}" is unconnected.`,
      });
    }
  }

  return warnings;
}
