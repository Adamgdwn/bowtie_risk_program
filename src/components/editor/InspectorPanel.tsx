"use client";

import { useMemo, useState } from "react";
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

export function InspectorPanel({
  selectedNode,
  projectMeta,
  contextGraph,
  onUpdateNode,
  onInsertSuggestions,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState("");

  const actions = useMemo(() => {
    if (!selectedNode) return [];
    const type = selectedNode.data?.type;
    if (type === "top_event") {
      return ["Suggest threats", "Suggest consequences", "Suggest starter barriers"];
    }
    if (type === "threat") {
      return ["Suggest preventive barriers", "Improve wording"];
    }
    if (type === "consequence") {
      return ["Suggest mitigative barriers", "Suggest escalation factors"];
    }
    if (type === "preventive_barrier" || type === "mitigative_barrier") {
      return ["Improve barrier quality", "Suggest performance standard"];
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
      <aside className="w-80 border-l border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Select a block to edit details and run AI suggestion actions.
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Inspector</h3>
      <p className="text-xs text-zinc-500">{selectedNode.data?.typeLabel}</p>

      <label className="mt-3 block text-xs font-semibold text-zinc-700">Title</label>
      <input
        value={selectedNode.data?.title ?? ""}
        onChange={(event) => onUpdateNode(selectedNode.id, { title: event.target.value })}
        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
      />

      <label className="mt-3 block text-xs font-semibold text-zinc-700">Description</label>
      <textarea
        value={selectedNode.data?.description ?? ""}
        onChange={(event) => onUpdateNode(selectedNode.id, { description: event.target.value })}
        className="mt-1 h-20 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
      />

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">AI Actions</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => runSuggestion(action)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
              disabled={loading}
            >
              {loading && lastAction === action ? "Thinking..." : action}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-3 rounded border border-cyan-200 bg-cyan-50/70 p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-16" aria-hidden>
              <div className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-400 animate-pulse" />
              <div className="absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-indigo-400 animate-pulse" />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600 animate-ping" />
              <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-cyan-900">AI is building suggestions</p>
              <p className="text-[11px] text-cyan-800">Running: {lastAction}</p>
            </div>
          </div>
        </div>
      ) : null}

      {hint ? <p className="mt-3 text-xs text-amber-700">{hint}</p> : null}
      {suggestions.length > 0 ? (
        <div className="mt-3 space-y-2 rounded border border-zinc-200 bg-white p-2">
          <p className="text-xs font-semibold text-zinc-700">Preview suggestions</p>
          {suggestions.map((item) => (
            <label key={item.id} className="flex gap-2 text-xs text-zinc-700">
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
            className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
            onClick={applySuggestions}
          >
            Insert Selected
          </button>
        </div>
      ) : null}
    </aside>
  );
}
