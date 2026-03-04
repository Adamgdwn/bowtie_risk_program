export type NodeType =
  | "top_event"
  | "threat"
  | "preventive_barrier"
  | "consequence"
  | "mitigative_barrier"
  | "escalation_factor"
  | "escalation_factor_control";

export type Severity = "low" | "medium" | "high" | "critical";

export interface BowtieProject {
  id: string;
  title: string;
  industry: string;
  topEvent: string;
  contextNotes: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BowtieNodeData {
  type: NodeType;
  title: string;
  description?: string;
  collapsedLeft?: boolean;
  collapsedRight?: boolean;
  tags?: string[];
  typeLabel: string;
  context?: string;
  cause?: string;
  source?: string;
  impact?: string;
  severity?: Severity;
  barrierType?: "engineering" | "procedural" | "human" | "other";
  owner?: string;
  performanceStandard?: string;
  verificationMethod?: string;
  frequency?: string;
  factor?: string;
  control?: string;
}

export interface StoredNodeRow {
  id: string;
  project_id: string;
  type: NodeType;
  title: string;
  description: string;
  position_x: number;
  position_y: number;
  data: BowtieNodeData;
}

export interface StoredEdgeRow {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  data: Record<string, unknown>;
}
