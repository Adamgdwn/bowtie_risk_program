"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edge, Node } from "reactflow";
import { BowtieNodeData, NodeType } from "@/lib/types/bowtie";

interface Suggestion {
  id: string;
  label: string;
  description: string;
  nodeType?: NodeType;
}

interface Props {
  selectedNode: Node<BowtieNodeData> | null;
  projectMeta: {
    title: string;
    industry: string;
    topEvent: string;
    contextNotes: string | null;
  };
  contextGraph: {
    nodes: Node<BowtieNodeData>[];
    edges: Edge[];
  };
  onUpdateNode: (nodeId: string, patch: Partial<BowtieNodeData>) => void;
  onInsertSuggestions: (action: string, suggestions: Suggestion[]) => void;
}

const NODE_TYPE_HELP: Record<NodeType, { summary: string; example: string }> = {
  top_event: {
    summary: "State the exact moment control is lost, not the cause or the final impact.",
    example: 'Example: "Sensitive data is exposed through an AI workflow."',
  },
  threat: {
    summary: "Name a credible cause that could trigger the top event.",
    example: 'Example: "Prompt injection bypasses content restrictions."',
  },
  preventive_barrier: {
    summary: "Describe what stops the threat from reaching the top event.",
    example: 'Example: "Prompt and output policy gateway blocks unsafe requests."',
  },
  consequence: {
    summary: "Describe a direct outcome if the top event happens.",
    example: 'Example: "Customer PII is exposed outside approved recipients."',
  },
  mitigative_barrier: {
    summary: "Describe what limits harm after the top event has already occurred.",
    example: 'Example: "Automated token revocation contains further access."',
  },
  escalation_factor: {
    summary: "Name what could weaken or defeat a barrier when it is needed.",
    example: 'Example: "After-hours staffing gap delays containment."',
  },
  escalation_factor_control: {
    summary: "Describe the control that keeps the escalation factor from undermining the barrier.",
    example: 'Example: "24/7 on-call roster covers the response gap."',
  },
};

export function InspectorPanel({
  selectedNode,
  projectMeta,
  contextGraph,
  onUpdateNode,
  onInsertSuggestions,
}: Props) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState("");

  useEffect(() => {
    if (!selectedNode) return;
    const frame = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedNode]);

  const actions = useMemo(() => {
    if (!selectedNode) return [];
    const type = selectedNode.data?.type;
    if (type === "top_event") {
      return ["Suggest threats", "Suggest consequences", "Suggest next logical nodes", "Improve wording"];
    }
    if (type === "threat") {
      return ["Suggest threats", "Suggest next logical nodes", "Improve wording"];
    }
    if (type === "consequence") {
      return ["Suggest consequences", "Suggest next logical nodes", "Improve wording"];
    }
    if (type === "preventive_barrier" || type === "mitigative_barrier") {
      return [
        type === "preventive_barrier" ? "Suggest preventive barriers" : "Suggest mitigative barriers",
        "Suggest next logical nodes",
        "Improve barrier quality",
        "Suggest performance standard",
      ];
    }
    if (type === "escalation_factor") {
      return ["Suggest escalation factors", "Suggest next logical nodes", "Improve wording"];
    }
    if (type === "escalation_factor_control") {
      return ["Suggest escalation factor controls", "Suggest next logical nodes", "Improve wording"];
    }
    return ["Suggest improvements"];
  }, [selectedNode]);

  async function runSuggestion(action: string) {
    if (!selectedNode) return;
    setLoading(true);
    setLastAction(action);
    try {
      const response = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedNode,
          project: projectMeta,
          contextGraph: {
            nodes: contextGraph.nodes.map((node) => ({
              id: node.id,
              data: {
                type: node.data.type,
                title: node.data.title,
              },
            })),
            edges: contextGraph.edges.map((edge) => ({
              source: edge.source,
              target: edge.target,
            })),
          },
        }),
      });
      const text = await response.text();
      const result = text ? (JSON.parse(text) as { suggestions?: Suggestion[]; message?: string }) : {};
      setSuggestions(result.suggestions ?? []);
      setSelected({});
      setHint(result.message ?? (response.ok ? "" : "Suggestion request failed."));
    } catch {
      setHint("Suggestion request failed.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function applySuggestions() {
    const chosen = suggestions.filter((item) => selected[item.id]);
    onInsertSuggestions(lastAction, chosen);
  }

  if (!selectedNode) {
    return (
      <aside className="w-80 border-l border-[#9CA3AF] bg-[#E5E7EB] p-4 text-sm text-[#1F2933]/70">
        <p>Select a block to edit details and run AI suggestion actions.</p>
        <p className="mt-2 text-xs">
          New users usually start by renaming the starter threat and consequence placeholders with specific wording.
        </p>
      </aside>
    );
  }

  const nodeHelp = NODE_TYPE_HELP[selectedNode.data.type];

  return (
    <aside className="w-80 border-l border-[#9CA3AF] bg-[#E5E7EB] p-4">
      <h3 className="text-sm font-semibold text-[#1F2933]">Inspector</h3>
      <p className="text-xs text-[#1F2933]/65">{selectedNode.data?.typeLabel}</p>

      <div className="mt-3 rounded border border-[#9CA3AF] bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#325D88]">What Belongs Here</p>
        <p className="mt-1 text-xs text-[#1F2933]">{nodeHelp.summary}</p>
        <p className="mt-2 text-[11px] text-[#1F2933]/70">{nodeHelp.example}</p>
      </div>

      <label className="mt-3 block text-xs font-semibold text-[#1F2933]">Title</label>
      <input
        ref={titleInputRef}
        value={selectedNode.data?.title ?? ""}
        onChange={(event) => onUpdateNode(selectedNode.id, { title: event.target.value })}
        className="mt-1 w-full rounded border border-[#9CA3AF] bg-white px-2 py-1 text-sm"
      />

      <label className="mt-3 block text-xs font-semibold text-[#1F2933]">Description</label>
      <textarea
        value={selectedNode.data?.description ?? ""}
        onChange={(event) => onUpdateNode(selectedNode.id, { description: event.target.value })}
        className="mt-1 h-20 w-full rounded border border-[#9CA3AF] bg-white px-2 py-1 text-sm"
      />

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[#1F2933]">AI Actions</h4>
        <p className="mt-1 text-[11px] text-[#1F2933]/70">
          Best after the title is specific enough that a teammate would understand it without extra context.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => runSuggestion(action)}
              className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs text-[#1F2933]"
              disabled={loading}
            >
              {loading && lastAction === action ? "Thinking..." : action}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-3 rounded border border-[#9CA3AF] bg-[#F5F3F0] p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-16" aria-hidden>
              <div className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-400 animate-pulse" />
              <div className="absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-indigo-400 animate-pulse" />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#325D88] animate-ping" />
              <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-[#325D88]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1F2933]">AI is building suggestions</p>
              <p className="text-[11px] text-[#325D88]">Running: {lastAction}</p>
            </div>
          </div>
        </div>
      ) : null}

      {hint ? <p className="mt-3 text-xs text-[#D4A547]">{hint}</p> : null}
      {suggestions.length > 0 ? (
        <div className="mt-3 space-y-2 rounded border border-[#9CA3AF] bg-white p-2">
          <p className="text-xs font-semibold text-[#1F2933]">Preview suggestions</p>
          {suggestions.map((item) => (
            <label key={item.id} className="flex gap-2 text-xs text-[#1F2933]">
              <input
                type="checkbox"
                checked={Boolean(selected[item.id])}
                onChange={(event) =>
                  setSelected((prev) => ({ ...prev, [item.id]: event.target.checked }))
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
          <button
            className="mt-2 rounded bg-[#325D88] px-3 py-1 text-xs font-semibold text-white"
            onClick={applySuggestions}
          >
            Insert Selected
          </button>
        </div>
      ) : null}
    </aside>
  );
}
