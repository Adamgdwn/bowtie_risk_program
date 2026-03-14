"use client";

import { useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<"left" | "right" | null>(null);
  const meta = NODE_TYPE_META[data.type ?? "threat"];
  const leftOptions = data.quickAddLeft ?? [];
  const rightOptions = data.quickAddRight ?? [];
  const isEscalation =
    data.type === "escalation_factor" || data.type === "escalation_factor_control";
  const isBarrier =
    data.type === "preventive_barrier" || data.type === "mitigative_barrier";
  const isBarrierShell = isBarrier || isEscalation;
  const supportLabel =
    data.supportLane === "mitigative" ? "Mitigative Support" : "Preventive Support";
  const shellTint =
    data.type === "preventive_barrier"
      ? "#fff8e8"
      : data.type === "mitigative_barrier"
        ? "#ecfeff"
        : data.type === "escalation_factor"
          ? "#fff8e8"
          : "#f0fdf4";
  const shellLabel = isEscalation ? supportLabel : meta.label;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function onAdd(side: "left" | "right", type: NodeType) {
    setOpenMenu(null);
    data.onQuickAdd?.(id, side, type);
  }

  function onToggle(side: "left" | "right") {
    data.onToggleCollapse?.(id, side);
  }

  function onOpenMenu(side: "left" | "right") {
    if ((side === "left" ? leftOptions : rightOptions).length === 0) {
      return;
    }
    setOpenMenu((current) => (current === side ? null : side));
  }

  function renderQuickAdd(side: "left" | "right", options: QuickAddOption[], canCollapse?: boolean) {
    if (options.length === 0) {
      return null;
    }

    const isLeft = side === "left";
    const menuOpen = openMenu === side;

    return (
      <div className={`absolute ${isLeft ? "-left-10" : "-right-10"} top-1/2 z-20 -translate-y-1/2`}>
        <div className="relative flex flex-col items-center gap-1">
          <button
            type="button"
            className="h-7 w-7 rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 shadow-sm"
            title={`Add ${options.length > 1 ? "node" : options[0].label} on ${side}`}
            onClick={() => onOpenMenu(side)}
          >
            +
          </button>
          {canCollapse ? (
            <button
              type="button"
              className="h-5 w-5 rounded-full border border-zinc-300 bg-white text-[10px] font-bold text-zinc-700 shadow-sm"
              title={
                side === "left"
                  ? data.collapsedLeft
                    ? "Expand left branch"
                    : "Collapse left branch"
                  : data.collapsedRight
                    ? "Expand right branch"
                    : "Collapse right branch"
              }
              onClick={() => onToggle(side)}
            >
              {(side === "left" ? data.collapsedLeft : data.collapsedRight) ? "+" : "-"}
            </button>
          ) : null}
          {menuOpen ? (
            <div
              className={`absolute top-1/2 w-40 -translate-y-1/2 rounded-xl border border-[#d9dde3] bg-white/95 p-1 shadow-xl backdrop-blur ${
                isLeft ? "right-10" : "left-10"
              }`}
            >
              {options.map((option) => (
                <button
                  key={`${side}-${option.type}-${option.label}`}
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-[#f5f3ee]"
                  onClick={() => onAdd(side, option.type)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {renderQuickAdd("left", leftOptions, data.canCollapseLeft)}
      {renderQuickAdd("right", rightOptions, data.canCollapseRight)}

      <div
        className={`relative ${
          isBarrierShell
            ? "w-[156px] min-w-[156px] max-w-[156px] rounded-[20px] px-4 pb-3 pt-4"
            : "w-52 min-w-52 max-w-52 rounded-lg p-3"
        } border-2 bg-white shadow-sm`}
        style={{
          borderColor: meta.color,
          backgroundColor: isBarrierShell ? shellTint : undefined,
          boxShadow: selected ? `0 0 0 3px ${meta.color}33` : undefined,
        }}
      >
        {isBarrierShell ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[-10px] h-5 w-11 -translate-x-1/2 rounded-[10px] border border-zinc-400 bg-gradient-to-b from-white via-zinc-100 to-zinc-500 shadow-sm"
          />
        ) : null}
        {isBarrierShell ? (
          <>
            <div
              className="pointer-events-none absolute bottom-3 left-2 top-3 w-[4px] rounded-full opacity-90"
              style={{ backgroundColor: meta.color }}
            />
            <div
              className="pointer-events-none absolute bottom-3 right-2 top-3 w-[4px] rounded-full opacity-90"
              style={{ backgroundColor: meta.color }}
            />
          </>
        ) : null}
        <div
          className={`relative font-semibold uppercase tracking-[0.16em] text-zinc-500 ${
            isBarrierShell ? "text-center text-[9px]" : "text-xs"
          }`}
        >
          {isBarrierShell ? shellLabel : meta.label}
        </div>
        <div
          className={`relative mt-2 break-words whitespace-normal font-semibold text-zinc-900 ${
            isBarrierShell ? "text-center text-[13px] leading-[1.12]" : "text-sm leading-tight"
          }`}
        >
          {data.title || "Untitled"}
        </div>
        {data.description && !isBarrierShell ? (
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
