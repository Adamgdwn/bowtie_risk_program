import type { Edge, Node } from "reactflow";
import { NODE_TYPE_META } from "@/lib/constants";
import { BowtieNodeData } from "@/lib/types/bowtie";

const X = {
  threat: 21,
  preventive: 271,
  topEvent: 521,
  mitigative: 771,
  consequence: 1021,
} as const;

function node(
  id: string,
  type: BowtieNodeData["type"],
  x: number,
  y: number,
  data: Omit<BowtieNodeData, "type" | "typeLabel">,
): Node<BowtieNodeData> {
  return {
    id,
    type: "bowtieNode",
    position: { x, y },
    data: {
      type,
      typeLabel: NODE_TYPE_META[type].label,
      ...data,
    },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  style?: Edge["style"],
): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style,
  };
}

const ESCALATION_EDGE_STYLE = { stroke: "#a855f7", strokeDasharray: "6 4" };

export const EXAMPLE_PROJECT_META = {
  title: "Example Bowtie: AI Data Breach",
  industry: "IT/Cloud",
  topEvent: "Sensitive data is exposed through an AI-assisted workflow",
  contextNotes:
    "Public demo scenario covering customer support copilots, retrieval pipelines, and incident response controls.",
};

export const EXAMPLE_PROJECT_NODES: Node<BowtieNodeData>[] = [
  node("top-event", "top_event", X.topEvent, 320, {
    title: "Sensitive data is exposed through an AI-assisted workflow",
    description: "Confidential customer or employee information leaves approved boundaries through model use.",
    context: "Enterprise AI copilots connected to internal knowledge bases and outbound collaboration tools.",
  }),
  node("threat-prompt-injection", "threat", X.threat, 120, {
    title: "Prompt injection in a customer support copilot",
    description: "A malicious prompt causes the assistant to ignore guardrails and reveal restricted records.",
    cause: "Untrusted external user input",
    source: "Customer-facing AI channel",
  }),
  node("threat-excessive-access", "threat", X.threat, 320, {
    title: "Excessive retrieval permissions in the AI data layer",
    description: "The model can access repositories that were never approved for the use case.",
    cause: "Over-broad service account scope",
    source: "Internal vector store and file connectors",
  }),
  node("threat-public-share", "threat", X.threat, 520, {
    title: "Model output is copied into a public share",
    description: "Sensitive generated content is posted to an exposed collaboration space.",
    cause: "Manual handling error after generation",
    source: "Shared documents and messaging tools",
  }),
  node("barrier-policy-gateway", "preventive_barrier", X.preventive, 120, {
    title: "Prompt and output policy gateway",
    description: "Screens prompts and responses for jailbreak patterns, secrets, and prohibited disclosures.",
    barrierType: "engineering",
    owner: "AI Platform Team",
    performanceStandard: "All external prompts and responses pass real-time policy checks before release.",
    verificationMethod: "Weekly adversarial prompt tests with blocked-output review.",
    frequency: "Weekly",
  }),
  node("barrier-least-privilege", "preventive_barrier", X.preventive, 320, {
    title: "Least-privilege retrieval and connector allowlists",
    description: "Limits the model to approved data domains, schemas, and document collections.",
    barrierType: "engineering",
    owner: "Identity and Access Management",
    performanceStandard: "Service accounts are scoped to approved data sets only.",
    verificationMethod: "Monthly entitlement review and connector diff check.",
    frequency: "Monthly",
  }),
  node("barrier-dlp-review", "preventive_barrier", X.preventive, 520, {
    title: "DLP review before sharing AI outputs",
    description: "Requires automated classification and user confirmation before publishing generated content.",
    barrierType: "procedural",
    owner: "Business Operations",
    performanceStandard: "Restricted outputs cannot be shared without classification review.",
    verificationMethod: "Quarterly audit of sampled shares and DLP alerts.",
    frequency: "Quarterly",
  }),
  node("factor-filter-disabled", "escalation_factor", X.preventive, 410, {
    title: "Guardrail tuning is disabled during an urgent release",
    description: "An emergency deployment bypasses prompt-policy checks.",
    factor: "Change pressure weakens the preventive barrier.",
    supportLane: "preventive",
    supportAnchorX: X.preventive,
  }),
  node("control-change-gate", "escalation_factor_control", X.preventive, 620, {
    title: "Production policy changes require security approval",
    description: "Any reduction in model safety checks requires a documented exception and approver.",
    control: "Formal change gate for policy engine updates",
    supportLane: "preventive",
    supportAnchorX: X.preventive,
  }),
  node("barrier-token-revocation", "mitigative_barrier", X.mitigative, 220, {
    title: "Automated session kill and token revocation",
    description: "Cuts active sessions, blocks outbound connectors, and revokes compromised tokens immediately.",
    barrierType: "engineering",
    owner: "Security Operations",
    performanceStandard: "Containment actions start within five minutes of confirmed exposure.",
    verificationMethod: "Monthly playbook simulation and alert timing review.",
    frequency: "Monthly",
    chainIndex: 0,
  }),
  node("barrier-incident-playbook", "mitigative_barrier", X.mitigative, 470, {
    title: "Privacy breach notification and legal response playbook",
    description: "Coordinates impact assessment, regulator notification, and customer communications.",
    barrierType: "procedural",
    owner: "Privacy Office",
    performanceStandard: "Reportability decision and executive briefing completed within 24 hours.",
    verificationMethod: "Quarterly tabletop and after-action review.",
    frequency: "Quarterly",
    chainIndex: 0,
  }),
  node("consequence-pii", "consequence", X.consequence, 220, {
    title: "Customer PII is exposed outside approved recipients",
    description: "Names, contact information, or support history are disclosed to unauthorized parties.",
    impact: "Privacy harm, contract breach, and customer trust erosion.",
    severity: "high",
  }),
  node("consequence-reportable", "consequence", X.consequence, 470, {
    title: "Regulator-reportable AI privacy incident",
    description: "The organization must investigate, notify, and defend the incident to regulators.",
    impact: "Regulatory scrutiny, legal cost, and board escalation.",
    severity: "critical",
  }),
  node("factor-after-hours", "escalation_factor", X.mitigative, 90, {
    title: "No incident lead is available after hours",
    description: "Containment and notification steps stall because ownership is unclear overnight.",
    factor: "Staffing gap weakens mitigative response.",
    supportLane: "mitigative",
    supportAnchorX: X.mitigative,
  }),
  node("control-on-call-roster", "escalation_factor_control", X.mitigative, 130, {
    title: "24/7 cyber and privacy on-call roster",
    description: "Named responders and backups are drilled against the AI breach playbook.",
    control: "On-call coverage with quarterly response exercises",
    supportLane: "mitigative",
    supportAnchorX: X.mitigative,
  }),
];

export const EXAMPLE_PROJECT_EDGES: Edge[] = [
  edge("e1", "threat-prompt-injection", "barrier-policy-gateway"),
  edge("e2", "barrier-policy-gateway", "top-event"),
  edge("e3", "threat-excessive-access", "barrier-least-privilege"),
  edge("e4", "barrier-least-privilege", "top-event"),
  edge("e5", "threat-public-share", "barrier-dlp-review"),
  edge("e6", "barrier-dlp-review", "top-event"),
  edge("e7", "top-event", "barrier-token-revocation"),
  edge("e8", "barrier-token-revocation", "consequence-pii"),
  edge("e9", "top-event", "barrier-incident-playbook"),
  edge("e10", "barrier-incident-playbook", "consequence-reportable"),
  edge("e11", "factor-filter-disabled", "barrier-least-privilege", ESCALATION_EDGE_STYLE),
  edge("e12", "control-change-gate", "factor-filter-disabled", ESCALATION_EDGE_STYLE),
  edge("e13", "factor-after-hours", "barrier-token-revocation", ESCALATION_EDGE_STYLE),
  edge("e14", "control-on-call-roster", "factor-after-hours", ESCALATION_EDGE_STYLE),
];
