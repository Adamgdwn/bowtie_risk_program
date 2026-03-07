"use client";

import { useEffect, useMemo, useState } from "react";
import { Edge, Node } from "reactflow";
import { BowtieNodeData } from "@/lib/types/bowtie";
import { StepGuidance, WorkflowState } from "@/lib/types/workflow";

interface Props {
  projectId: string;
  projectMeta: {
    title: string;
    industry: string;
    topEvent: string;
    contextNotes: string | null;
  };
  nodes: Node<BowtieNodeData>[];
  edges: Edge[];
  initialState?: WorkflowState | null;
  currentTopEvent: string;
  onTopEventChange?: (title: string) => void;
  onGuidanceContextChange?: (payload: {
    stepId: number | null;
    stepTitle: string;
    guidance: StepGuidance | null;
    loading: boolean;
    error: string | null;
  }) => void;
}

const STEPS = [
  {
    id: 1,
    title: "Define Scope, Hazard, and Top Event",
    checklist: [
      "Set boundaries, assumptions, and interfaces.",
      "Define the hazard source of potential harm.",
      "Write one clear top-event statement (loss of control).",
    ],
    ideas:
      "Good pattern: Hazard = physical source; Top Event = moment control is lost. Keep top event to one sentence.",
  },
  {
    id: 2,
    title: "Identify Threats (Left Side)",
    checklist: [
      "List credible threat causes (technical, human, external, organizational).",
      "Use incident history / studies (HAZOP, FMEA, investigations).",
      "Phrase as cause + mechanism.",
    ],
    ideas:
      "Avoid vague threats. Use language like: 'corrosion leading to rupture' or 'mis-routing causing overpressure.'",
  },
  {
    id: 3,
    title: "Identify Consequences (Right Side)",
    checklist: [
      "List safety, environment, asset, service, financial, and reputation impacts.",
      "Phrase as direct outcomes from the top event.",
      "Exclude downstream chains better modeled as separate bowties.",
    ],
    ideas:
      "Include multiple impact classes, not only safety outcomes.",
  },
  {
    id: 4,
    title: "Map Preventive and Mitigative Barriers",
    checklist: [
      "Add preventive barriers between each threat and the top event.",
      "Add mitigative barriers between top event and each consequence.",
      "Use engineering/procedural/human/organizational controls.",
    ],
    ideas:
      "For each threat and consequence, ask 'what specifically prevents?' and 'what specifically limits impact after loss of control?'",
  },
  {
    id: 5,
    title: "Add Escalation Factors and Controls",
    checklist: [
      "For each critical barrier, identify what can degrade or defeat it.",
      "Add escalation controls addressing those factors.",
      "Link each factor to the barrier it affects.",
    ],
    ideas:
      "Common factors: poor training, maintenance backlog, staffing pressure, weather extremes.",
  },
  {
    id: 6,
    title: "Evaluate Barrier Effectiveness and Ownership",
    checklist: [
      "Classify barrier type and criticality.",
      "Assign owner for critical barriers.",
      "Define performance standards and verification methods.",
    ],
    ideas:
      "Strong barriers are specific, verifiable, and owned by a role.",
  },
  {
    id: 7,
    title: "Capture Actions and Risk Treatment",
    checklist: [
      "Create actions for missing or weak barriers and unmanaged escalation factors.",
      "Assign action owner and due date.",
      "Prioritize by risk reduction and feasibility.",
    ],
    ideas:
      "Turn gaps into tracked tasks, not just notes.",
  },
  {
    id: 8,
    title: "Run Structured Workshop + Quality Check",
    checklist: [
      "Use multidisciplinary review (operations, maintenance, safety, management).",
      "Challenge draft content from existing studies.",
      "Validate logical consistency and real-world operability.",
    ],
    ideas:
      "A strong workshop tests whether controls actually work in live operations.",
  },
];

export function WorkflowWorksheet({
  projectId,
  projectMeta,
  nodes,
  edges,
  initialState,
  currentTopEvent,
  onTopEventChange,
  onGuidanceContextChange,
}: Props) {
  const [state, setState] = useState<WorkflowState>(() => ({
    completed: initialState?.completed ?? {},
    notes: initialState?.notes ?? {},
    step1TopEvent: initialState?.step1TopEvent ?? currentTopEvent ?? projectMeta.topEvent ?? "",
    guidanceByStep: initialState?.guidanceByStep ?? {},
    lastActiveStepId: initialState?.lastActiveStepId ?? null,
  }));
  const [guidanceLoadingByStep, setGuidanceLoadingByStep] = useState<Record<string, boolean>>({});
  const [syncMessage, setSyncMessage] = useState("Synced");

  useEffect(() => {
    const normalizedIncoming = currentTopEvent ?? "";
    if ((state.step1TopEvent ?? "") === normalizedIncoming) {
      return;
    }
    setSyncMessage("Saving...");
    setState((prev) => ({
      ...prev,
      step1TopEvent: normalizedIncoming,
    }));
  }, [currentTopEvent, state.step1TopEvent]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/workflow`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (response.ok) {
          setSyncMessage("Synced");
        } else {
          setSyncMessage("Sync failed");
        }
      } catch {
        setSyncMessage("Sync failed");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [projectId, state]);

  useEffect(() => {
    if (!state.lastActiveStepId) return;
    const activeStep = STEPS.find((step) => step.id === state.lastActiveStepId);
    if (!activeStep) return;
    const guidance = state.guidanceByStep?.[String(activeStep.id)] ?? null;
    onGuidanceContextChange?.({
      stepId: activeStep.id,
      stepTitle: activeStep.title,
      guidance,
      loading: Boolean(guidanceLoadingByStep[String(activeStep.id)]),
      error: null,
    });
  }, [state.lastActiveStepId, state.guidanceByStep, guidanceLoadingByStep, onGuidanceContextChange]);

  const nodeCounts = useMemo(() => {
    const counts = {
      threat: 0,
      consequence: 0,
      preventive_barrier: 0,
      mitigative_barrier: 0,
      escalation_factor: 0,
      escalation_factor_control: 0,
    };
    for (const node of nodes) {
      const type = node.data.type;
      if (type in counts) {
        counts[type as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [nodes]);

  const completionPercent = Math.round(
    (Object.values(state.completed ?? {}).filter(Boolean).length / STEPS.length) * 100,
  );

  function graphSummary() {
    const topThreats = nodes
      .filter((node) => node.data.type === "threat")
      .map((node) => node.data.title)
      .filter(Boolean)
      .slice(0, 6);
    const topConsequences = nodes
      .filter((node) => node.data.type === "consequence")
      .map((node) => node.data.title)
      .filter(Boolean)
      .slice(0, 6);
    const preventiveBarriers = nodes
      .filter((node) => node.data.type === "preventive_barrier")
      .map((node) => node.data.title)
      .filter(Boolean)
      .slice(0, 6);
    const mitigativeBarriers = nodes
      .filter((node) => node.data.type === "mitigative_barrier")
      .map((node) => node.data.title)
      .filter(Boolean)
      .slice(0, 6);
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      topThreats,
      topConsequences,
      preventiveBarriers,
      mitigativeBarriers,
    };
  }

  async function requestGuidance(stepId: number, stepTitle: string, currentNotes: string) {
    const key = String(stepId);
    setGuidanceLoadingByStep((prev) => ({ ...prev, [key]: true }));
    onGuidanceContextChange?.({
      stepId,
      stepTitle,
      guidance: state.guidanceByStep?.[key] ?? null,
      loading: true,
      error: null,
    });

    try {
      const response = await fetch("/api/ai/workflow-guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          stepTitle,
          currentNotes,
          project: projectMeta,
          graphSummary: graphSummary(),
        }),
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as Partial<StepGuidance> & { error?: string }) : {};
      if (!response.ok || payload.error) {
        onGuidanceContextChange?.({
          stepId,
          stepTitle,
          guidance: state.guidanceByStep?.[key] ?? null,
          loading: false,
          error: payload.error ?? "Guidance request failed.",
        });
        return;
      }

      const guidance: StepGuidance = {
        headline: payload.headline ?? `Step ${stepId} Guidance`,
        discussionPrompts: payload.discussionPrompts ?? [],
        qualityChecks: payload.qualityChecks ?? [],
        nextActions: payload.nextActions ?? [],
        source: payload.source === "llm" ? "llm" : "fallback",
        generatedAt: new Date().toISOString(),
      };

      setSyncMessage("Saving...");
      setState((prev) => ({
        ...prev,
        guidanceByStep: { ...(prev.guidanceByStep ?? {}), [key]: guidance },
      }));

      onGuidanceContextChange?.({
        stepId,
        stepTitle,
        guidance,
        loading: false,
        error: null,
      });
    } catch {
      onGuidanceContextChange?.({
        stepId,
        stepTitle,
        guidance: state.guidanceByStep?.[key] ?? null,
        loading: false,
        error: "Guidance request failed.",
      });
    } finally {
      setGuidanceLoadingByStep((prev) => ({ ...prev, [key]: false }));
    }
  }

  function handleStepFocus(stepId: number, stepTitle: string) {
    const key = String(stepId);
    const existingGuidance = state.guidanceByStep?.[key] ?? null;
    const note = state.notes[key] ?? "";
    setSyncMessage("Saving...");
    setState((prev) => ({ ...prev, lastActiveStepId: stepId }));

    onGuidanceContextChange?.({
      stepId,
      stepTitle,
      guidance: existingGuidance,
      loading: Boolean(guidanceLoadingByStep[key]),
      error: null,
    });

    if (!existingGuidance && !guidanceLoadingByStep[key]) {
      void requestGuidance(stepId, stepTitle, note);
    }
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Bowtie Procedure Worksheet</h2>
        <p className="text-sm text-zinc-600">
          {projectMeta.title} | {projectMeta.industry} | Top Event:{" "}
          {state.step1TopEvent?.trim() || "Not set"}
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          Progress: <strong>{completionPercent}%</strong> ({Object.values(state.completed ?? {}).filter(Boolean).length}
          /{STEPS.length} steps)
        </p>
        <p className="mt-1 text-xs text-zinc-500">Worksheet sync: {syncMessage}</p>
        <div className="mt-3 grid gap-2 text-xs text-zinc-700 md:grid-cols-3">
          <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
            Threats: {nodeCounts.threat} | Preventive barriers: {nodeCounts.preventive_barrier}
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
            Consequences: {nodeCounts.consequence} | Mitigative barriers: {nodeCounts.mitigative_barrier}
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
            Escalation factors: {nodeCounts.escalation_factor} | Controls:{" "}
            {nodeCounts.escalation_factor_control}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Current connectors: {edges.length}</p>
      </section>

      <section className="mt-4 space-y-3">
        {STEPS.map((step) => (
          <article key={step.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Step {step.id}: {step.title}
                </h3>
                <p className="mt-1 text-xs text-zinc-600">{step.ideas}</p>
              </div>
              {step.id === 1 ? (
                <div className="mx-auto w-full max-w-sm rounded-lg border-2 border-[#1F2933] bg-[#F5F3F0] p-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#1F2933]">
                    Top Event Input
                  </label>
                  <input
                    value={state.step1TopEvent ?? ""}
                    onFocus={() => handleStepFocus(step.id, step.title)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSyncMessage("Saving...");
                      setState((prev) => ({
                        ...prev,
                        step1TopEvent: value,
                      }));
                      onTopEventChange?.(value);
                    }}
                    className="mt-1 w-full rounded border border-[#9CA3AF] bg-white px-2 py-1 text-sm text-[#1F2933]"
                    placeholder="Enter the single top event statement"
                  />
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(state.completed[String(step.id)])}
                  onChange={(event) => {
                    setSyncMessage("Saving...");
                    setState((prev) => ({
                      ...prev,
                      completed: { ...prev.completed, [String(step.id)]: event.target.checked },
                    }));
                  }}
                />
                Complete
              </label>
            </div>

            <div className="mt-2 space-y-1">
              {step.checklist.map((item) => (
                <p key={item} className="text-xs text-zinc-700">
                  - {item}
                </p>
              ))}
            </div>

            <label className="mt-3 block text-xs font-semibold text-zinc-700">Workshop Notes</label>
            <textarea
              value={state.notes[String(step.id)] ?? ""}
              onFocus={() => handleStepFocus(step.id, step.title)}
              onChange={(event) => {
                setSyncMessage("Saving...");
                setState((prev) => ({
                  ...prev,
                  notes: { ...prev.notes, [String(step.id)]: event.target.value },
                }));
              }}
              className="mt-1 h-20 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
              placeholder="Capture decisions, assumptions, and action items for this step."
            />
          </article>
        ))}
      </section>
    </div>
  );
}
