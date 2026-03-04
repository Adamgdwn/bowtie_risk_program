import { NodeType } from "@/lib/types/bowtie";

export const INDUSTRY_OPTIONS = [
  "General",
  "Oil & Gas",
  "Mining",
  "Construction",
  "Manufacturing",
  "Healthcare",
  "IT/Cloud",
];

export const NODE_TYPE_META: Record<
  NodeType,
  { label: string; color: string; lane: "left" | "center-left" | "center" | "center-right" | "right" | "support" }
> = {
  top_event: { label: "Top Event", color: "#f97316", lane: "center" },
  threat: { label: "Threat", color: "#ef4444", lane: "left" },
  preventive_barrier: { label: "Preventive Barrier", color: "#f59e0b", lane: "center-left" },
  consequence: { label: "Consequence", color: "#6366f1", lane: "right" },
  mitigative_barrier: { label: "Mitigative Barrier", color: "#06b6d4", lane: "center-right" },
  escalation_factor: { label: "Escalation Factor", color: "#d946ef", lane: "support" },
  escalation_factor_control: { label: "Escalation Factor Control", color: "#10b981", lane: "support" },
};

export const PLAN_LIMITS = {
  free: 2,
  pro: Number.POSITIVE_INFINITY,
  team: Number.POSITIVE_INFINITY,
} as const;

export const APP_NAME = "Bowtie Risk Builder";
