"use client";

import { Handle, NodeProps, Position } from "reactflow";
import { NODE_TYPE_META } from "@/lib/constants";
import { BowtieNodeData, NodeType } from "@/lib/types/bowtie";

interface QuickAddOption {
  type: NodeType;
  label: string;
}

interface BowtieNodeUiData extends BowtieNodeData {
  quickAddLeft?: QuickAddOption[];
  quickAddRight?: QuickAddOption[];
  canCollapseLeft?: boolean;
  canCollapseRight?: boolean;
  onQuickAdd?: (nodeId: string, side: "left" | "right", type: NodeType) => void;
  onToggleCollapse?: (nodeId: string, side: "left" | "right") => void;
}

export default function BowtieNode({ id, data, selected }: NodeProps<BowtieNodeUiData>) {
  const meta = NODE_TYPE_META[data.type ?? "threat"];
  const leftOptions = data.quickAddLeft ?? [];
  const rightOptions = data.quickAddRight ?? [];
  const isEscalation =
    data.type === "escalation_factor" || data.type === "escalation_factor_control";
  const supportLabel =
    data.supportLane === "mitigative" ? "Mitigative Support" : "Preventive Support";
  const supportAccent = data.supportLane === "mitigative" ? "#0ea5e9" : "#f59e0b";
  const supportBg = data.supportLane === "mitigative" ? "#f0f9ff" : "#fffbeb";

  function onAdd(side: "left" | "right", type: NodeType) {
    data.onQuickAdd?.(id, side, type);
  }

  function onToggle(side: "left" | "right") {
    data.onToggleCollapse?.(id, side);
  }

  return (
    <div className="relative">
      {leftOptions.length > 0 ? (
        <div className="absolute -left-8 top-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className="h-6 w-6 rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 shadow-sm"
              title={`Add ${leftOptions[0].label} on left`}
              onClick={() => onAdd("left", leftOptions[0].type)}
            >
              +
            </button>
            {data.canCollapseLeft ? (
              <button
                type="button"
                className="h-5 w-5 rounded-full border border-zinc-300 bg-white text-[10px] font-bold text-zinc-700 shadow-sm"
                title={data.collapsedLeft ? "Expand left branch" : "Collapse left branch"}
                onClick={() => onToggle("left")}
              >
                {data.collapsedLeft ? "+" : "-"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {rightOptions.length > 0 ? (
        <div className="absolute -right-8 top-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className="h-6 w-6 rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 shadow-sm"
              title={`Add ${rightOptions[0].label} on right`}
              onClick={() => onAdd("right", rightOptions[0].type)}
            >
              +
            </button>
            {data.canCollapseRight ? (
              <button
                type="button"
                className="h-5 w-5 rounded-full border border-zinc-300 bg-white text-[10px] font-bold text-zinc-700 shadow-sm"
                title={data.collapsedRight ? "Expand right branch" : "Collapse right branch"}
                onClick={() => onToggle("right")}
              >
                {data.collapsedRight ? "+" : "-"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="w-52 min-w-52 max-w-52 rounded-lg border-2 bg-white p-3 shadow-sm"
        style={{
          borderColor: meta.color,
          backgroundColor: isEscalation ? supportBg : undefined,
          borderLeftColor: isEscalation ? supportAccent : meta.color,
          borderLeftWidth: isEscalation ? 6 : 2,
          boxShadow: selected ? `0 0 0 3px ${meta.color}33` : undefined,
        }}
      >
        {isEscalation ? (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            {supportLabel}
          </div>
        ) : null}
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{meta.label}</div>
        <div className="mt-1 break-words whitespace-normal text-sm font-semibold leading-tight text-zinc-900">
          {data.title || "Untitled"}
        </div>
        {data.description ? (
          <div className="mt-1 break-words whitespace-pre-wrap text-xs leading-snug text-zinc-600">
            {data.description}
          </div>
        ) : null}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
