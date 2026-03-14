"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  OnSelectionChangeParams,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { v4 as uuid } from "uuid";
import { jsPDF } from "jspdf";
import BowtieNode from "@/components/editor/BowtieNode";
import { InspectorPanel } from "@/components/editor/InspectorPanel";
import { WorkflowWorksheet } from "@/components/editor/WorkflowWorksheet";
import { validateBowtie } from "@/lib/bowtie/validation";
import { NODE_TYPE_META } from "@/lib/constants";
import { BowtieNodeData, NodeType } from "@/lib/types/bowtie";
import { StepGuidance, WorkflowState } from "@/lib/types/workflow";

interface QuickAddOption {
  type: NodeType;
  label: string;
}

interface EditorSnapshot {
  nodes: Node<BowtieNodeData>[];
  edges: Edge[];
}

interface ClipboardSnapshot {
  nodes: Node<BowtieNodeData>[];
  edges: Edge[];
}

interface ToastMessage {
  id: string;
  text: string;
}

type ExportFormat = "png" | "pdf";
type ExportScope = "canvas" | "worksheet" | "both";
type ExportSize = "small" | "medium" | "large";
type EditorViewMode = "canvas" | "worksheet";
type ConnectorStyle = "rounded" | "angled";

interface GuidedStep {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  preferredView: EditorViewMode;
}

interface GuidedCounts {
  hasTopEvent: boolean;
  threats: number;
  consequences: number;
  preventiveBarriers: number;
  mitigativeBarriers: number;
  escalationFactors: number;
  escalationFactorControls: number;
}

interface Props {
  projectId: string;
  projectMeta: {
    title: string;
    industry: string;
    topEvent: string;
    contextNotes: string | null;
  };
  initialNodes: Node<BowtieNodeData>[];
  initialEdges: Edge[];
  initialWorkflowState?: WorkflowState | null;
  readOnly?: boolean;
}

const nodeTypes = { bowtieNode: BowtieNode };
const LANE_START_X = 0;
const LANE_BASE_START_Y = -120;
const LANE_BASE_HEIGHT = 2200;
const DEFAULT_NODE_WIDTH = 208;
const BARRIER_NODE_WIDTH = 156;
const BARRIER_COLUMNS = 3;
const BARRIER_COLUMN_GAP = 18;
const BARRIER_LANE_PADDING = 28;
const BARRIER_LANE_WIDTH =
  BARRIER_LANE_PADDING * 2 +
  BARRIER_COLUMNS * BARRIER_NODE_WIDTH +
  (BARRIER_COLUMNS - 1) * BARRIER_COLUMN_GAP;
const LANE_WIDTHS = [250, BARRIER_LANE_WIDTH, 250, BARRIER_LANE_WIDTH, 250] as const;
const LANE_STARTS = LANE_WIDTHS.reduce<number[]>((starts, width, index) => {
  if (index === 0) {
    starts.push(LANE_START_X);
    return starts;
  }
  starts.push(starts[index - 1] + LANE_WIDTHS[index - 1]);
  return starts;
}, []);
const LANE_LABEL_HEIGHT = 48;
const BARRIER_ROW_GAP = 128;
const BRANCH_CLEARANCE = 42;
const POSITION_PUSH_STEP = 28;
const MAX_POSITION_ATTEMPTS = 48;
const NODE_FOOTPRINTS: Record<NodeType, { width: number; height: number }> = {
  top_event: { width: DEFAULT_NODE_WIDTH, height: 116 },
  threat: { width: DEFAULT_NODE_WIDTH, height: 116 },
  preventive_barrier: { width: BARRIER_NODE_WIDTH, height: 84 },
  consequence: { width: DEFAULT_NODE_WIDTH, height: 116 },
  mitigative_barrier: { width: BARRIER_NODE_WIDTH, height: 84 },
  escalation_factor: { width: BARRIER_NODE_WIDTH, height: 84 },
  escalation_factor_control: { width: BARRIER_NODE_WIDTH, height: 84 },
};
const LANE_TOP_PADDING = 220;
const LANE_BOTTOM_PADDING = 320;
const DEFAULT_VIEWPORT = { x: -120, y: 80, zoom: 0.62 };
const EXPORT_PIXEL_RATIO: Record<ExportSize, number> = {
  small: 1.4,
  medium: 2,
  large: 2.8,
};
const PDF_FORMAT_BY_SIZE: Record<ExportSize, "a4" | "a3" | "a2"> = {
  small: "a4",
  medium: "a3",
  large: "a2",
};
const GENERIC_NODE_TITLES: Record<NodeType, string[]> = {
  top_event: ["top event"],
  threat: ["threat"],
  preventive_barrier: ["preventive barrier"],
  consequence: ["consequence"],
  mitigative_barrier: ["mitigative barrier"],
  escalation_factor: ["escalation factor"],
  escalation_factor_control: ["escalation factor control"],
};

const LANE_META: Array<{ label: string; className: string }> = [
  { label: "Threats", className: "border-r border-[#9CA3AF]/70 bg-[#f0f3f6]" },
  { label: "Preventive Barriers", className: "border-r border-[#D4A547]/40 bg-[#fcf7ea]" },
  { label: "Top Event", className: "border-r border-[#9CA3AF]/70 bg-[#f6f4ef]" },
  { label: "Mitigative Barriers", className: "border-r border-[#325D88]/35 bg-[#eef3f8]" },
  { label: "Consequences", className: "bg-[#f1f4f8]" },
];

interface LayoutData extends Partial<BowtieNodeData> {
  barrierIndex?: number;
}

function laneStartForIndex(index: number) {
  return LANE_STARTS[index] ?? LANE_START_X;
}

function gridSlotForBarrier(index: number) {
  const safeIndex = Math.max(0, index);
  return {
    column: safeIndex % BARRIER_COLUMNS,
    row: Math.floor(safeIndex / BARRIER_COLUMNS),
  };
}

function barrierLaneX(lane: "preventive" | "mitigative", index: number) {
  const laneIndex = lane === "preventive" ? 1 : 3;
  const { column } = gridSlotForBarrier(index);
  return laneStartForIndex(laneIndex) + BARRIER_LANE_PADDING + column * (BARRIER_NODE_WIDTH + BARRIER_COLUMN_GAP);
}

function barrierRowOffset(index: number) {
  return gridSlotForBarrier(index).row * BARRIER_ROW_GAP;
}

function laneXForType(type: NodeType, layoutData: LayoutData = {}) {
  const lane = NODE_TYPE_META[type].lane;
  if (type === "preventive_barrier") {
    return barrierLaneX("preventive", layoutData.barrierIndex ?? 0);
  }
  if (type === "mitigative_barrier") {
    return barrierLaneX("mitigative", layoutData.chainIndex ?? 0);
  }
  if (type === "escalation_factor" || type === "escalation_factor_control") {
    if (typeof layoutData.supportAnchorX === "number") {
      return layoutData.supportAnchorX;
    }
    return barrierLaneX(layoutData.supportLane ?? "preventive", 0);
  }
  const laneIndex =
    lane === "left"
      ? 0
      : lane === "center-left"
        ? 1
        : lane === "center"
          ? 2
          : lane === "center-right"
            ? 3
            : 4;
  const width = NODE_FOOTPRINTS[type].width;
  return laneStartForIndex(laneIndex) + (LANE_WIDTHS[laneIndex] - width) / 2;
}

function supportLaneForNode(
  node: Node<BowtieNodeData> | null | undefined,
  _mitigativeColumns = 1,
): "preventive" | "mitigative" {
  void _mitigativeColumns;
  if (!node) return "preventive";
  if (node.data.type === "mitigative_barrier") return "mitigative";
  if (node.data.type === "preventive_barrier") return "preventive";
  if (node.data.supportLane) return node.data.supportLane;
  if (node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control") {
    const mitigativeLaneStart = laneStartForIndex(3);
    const consequenceLaneStart = laneStartForIndex(4);
    return node.position.x >= mitigativeLaneStart && node.position.x < consequenceLaneStart ? "mitigative" : "preventive";
  }
  return "preventive";
}

function laneXForNode(type: NodeType, data?: LayoutData, _mitigativeColumns = 1) {
  void _mitigativeColumns;
  return laneXForType(type, data ?? {});
}

function boxesOverlap(
  candidate: { x: number; y: number; type: NodeType },
  other: Node<BowtieNodeData>,
) {
  const candidateFootprint = NODE_FOOTPRINTS[candidate.type];
  const otherFootprint = NODE_FOOTPRINTS[other.data.type];

  return (
    candidate.x < other.position.x + otherFootprint.width + 18 &&
    candidate.x + candidateFootprint.width > other.position.x - 18 &&
    candidate.y < other.position.y + otherFootprint.height + 22 &&
    candidate.y + candidateFootprint.height > other.position.y - 22
  );
}

function findNonOverlappingPosition(
  candidate: { x: number; y: number; type: NodeType },
  existingNodes: Node<BowtieNodeData>[],
) {
  let next = { x: candidate.x, y: candidate.y };

  for (let attempt = 0; attempt < MAX_POSITION_ATTEMPTS; attempt += 1) {
    const hasOverlap = existingNodes.some((node) =>
      boxesOverlap({ x: next.x, y: next.y, type: candidate.type }, node),
    );
    if (!hasOverlap) {
      return next;
    }
    next = { ...next, y: next.y + POSITION_PUSH_STEP };
  }

  return next;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stripPersistedUiState(data: BowtieNodeData): BowtieNodeData {
  return {
    ...data,
    collapsedLeft: undefined,
    collapsedRight: undefined,
  };
}

function normalizeTitle(title?: string | null) {
  return title?.trim().toLowerCase() ?? "";
}

function isMeaningfulNodeTitle(type: NodeType, title?: string | null) {
  const normalized = normalizeTitle(title);
  if (!normalized || normalized === "untitled") {
    return false;
  }
  return !GENERIC_NODE_TITLES[type].includes(normalized);
}

function getGuidedCounts(nodes: Node<BowtieNodeData>[]): GuidedCounts {
  return nodes.reduce<GuidedCounts>(
    (counts, node) => {
      if (!isMeaningfulNodeTitle(node.data.type, node.data.title)) {
        return counts;
      }

      switch (node.data.type) {
        case "top_event":
          counts.hasTopEvent = true;
          return counts;
        case "threat":
          counts.threats += 1;
          return counts;
        case "consequence":
          counts.consequences += 1;
          return counts;
        case "preventive_barrier":
          counts.preventiveBarriers += 1;
          return counts;
        case "mitigative_barrier":
          counts.mitigativeBarriers += 1;
          return counts;
        case "escalation_factor":
          counts.escalationFactors += 1;
          return counts;
        case "escalation_factor_control":
          counts.escalationFactorControls += 1;
          return counts;
        default:
          return counts;
      }
    },
    {
      hasTopEvent: false,
      threats: 0,
      consequences: 0,
      preventiveBarriers: 0,
      mitigativeBarriers: 0,
      escalationFactors: 0,
      escalationFactorControls: 0,
    },
  );
}

function getGuidedSteps(counts: GuidedCounts): GuidedStep[] {
  return [
    {
      id: "top_event",
      title: "Define a clear top event",
      detail: counts.hasTopEvent
        ? "Your top event is named. Keep it focused on the loss-of-control moment."
        : "Use the worksheet to phrase the top event in one specific sentence.",
      done: counts.hasTopEvent,
      preferredView: "worksheet",
    },
    {
      id: "threats",
      title: "Name at least two credible threats",
      detail: `${counts.threats}/2 named threats. Rename the starter placeholder, then add more causes on the left side.`,
      done: counts.threats >= 2,
      preferredView: "canvas",
    },
    {
      id: "consequences",
      title: "Name at least two consequences",
      detail: `${counts.consequences}/2 named consequences. Capture direct outcomes on the right side.`,
      done: counts.consequences >= 2,
      preferredView: "canvas",
    },
    {
      id: "barriers",
      title: "Add barriers on both sides",
      detail: `${counts.preventiveBarriers} preventive and ${counts.mitigativeBarriers} mitigative barriers named so far.`,
      done: counts.preventiveBarriers >= 1 && counts.mitigativeBarriers >= 1,
      preferredView: "canvas",
    },
    {
      id: "escalation",
      title: "Add one escalation factor and one control",
      detail: `${counts.escalationFactors} factors and ${counts.escalationFactorControls} controls named so far.`,
      done: counts.escalationFactors >= 1 && counts.escalationFactorControls >= 1,
      preferredView: "canvas",
    },
  ];
}

function shouldOpenInWorksheet(nodes: Node<BowtieNodeData>[]) {
  const nodeTypeCounts = nodes.reduce<Record<NodeType, number>>(
    (counts, node) => {
      counts[node.data.type] += 1;
      return counts;
    },
    {
      top_event: 0,
      threat: 0,
      preventive_barrier: 0,
      consequence: 0,
      mitigative_barrier: 0,
      escalation_factor: 0,
      escalation_factor_control: 0,
    },
  );

  return (
    nodes.length <= 3 &&
    nodeTypeCounts.top_event === 1 &&
    nodeTypeCounts.threat <= 1 &&
    nodeTypeCounts.consequence <= 1 &&
    nodeTypeCounts.preventive_barrier === 0 &&
    nodeTypeCounts.mitigative_barrier === 0 &&
    nodeTypeCounts.escalation_factor === 0 &&
    nodeTypeCounts.escalation_factor_control === 0
  );
}

function findNearestNodeByType(
  nodes: Node<BowtieNodeData>[],
  type: NodeType,
  y: number,
): Node<BowtieNodeData> | null {
  const matches = nodes.filter((node) => node.data.type === type);
  if (matches.length === 0) return null;
  return matches.reduce((closest, candidate) =>
    Math.abs(candidate.position.y - y) < Math.abs(closest.position.y - y) ? candidate : closest,
  );
}

function computePreventiveBarrierIndexById(
  nodes: Node<BowtieNodeData>[],
  edges: Edge[],
): {
  indexByNodeId: Record<string, number>;
  threatIdByNodeId: Record<string, string>;
  barrierIdsByThreatId: Record<string, string[]>;
} {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const barrierIdsByThreatId: Record<string, string[]> = {};
  const threatIdByNodeId: Record<string, string> = {};

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode?.data.type !== "threat" || targetNode?.data.type !== "preventive_barrier") {
      continue;
    }
    barrierIdsByThreatId[sourceNode.id] = [...(barrierIdsByThreatId[sourceNode.id] ?? []), targetNode.id];
    threatIdByNodeId[targetNode.id] = sourceNode.id;
  }

  const indexByNodeId: Record<string, number> = {};
  Object.entries(barrierIdsByThreatId).forEach(([threatId, barrierIds]) => {
    const ordered = [...barrierIds].sort((leftId, rightId) => {
      const leftNode = nodeMap.get(leftId);
      const rightNode = nodeMap.get(rightId);
      if (!leftNode || !rightNode) return 0;
      return leftNode.position.y - rightNode.position.y || leftNode.position.x - rightNode.position.x;
    });

    barrierIdsByThreatId[threatId] = ordered;
    ordered.forEach((nodeId, index) => {
      indexByNodeId[nodeId] = index;
    });
  });

  return { indexByNodeId, threatIdByNodeId, barrierIdsByThreatId };
}

function computeMitigativeChainIndexById(
  nodes: Node<BowtieNodeData>[],
  edges: Edge[],
): {
  indexByNodeId: Record<string, number>;
  consequenceIdByNodeId: Record<string, string>;
  chainNodeIdsByConsequenceId: Record<string, string[]>;
  maxDepth: number;
} {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const indexByNodeId: Record<string, number> = {};
  const consequenceIdByNodeId: Record<string, string> = {};
  const chainNodeIdsByConsequenceId: Record<string, string[]> = {};
  let maxDepth = 1;

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode?.data.type !== "mitigative_barrier" || targetNode?.data.type !== "consequence") {
      continue;
    }
    chainNodeIdsByConsequenceId[targetNode.id] = [...(chainNodeIdsByConsequenceId[targetNode.id] ?? []), sourceNode.id];
    consequenceIdByNodeId[sourceNode.id] = targetNode.id;
  }

  Object.entries(chainNodeIdsByConsequenceId).forEach(([consequenceId, barrierIds]) => {
    const ordered = [...barrierIds].sort((leftId, rightId) => {
      const leftNode = nodeMap.get(leftId);
      const rightNode = nodeMap.get(rightId);
      if (!leftNode || !rightNode) return 0;
      return leftNode.position.y - rightNode.position.y || leftNode.position.x - rightNode.position.x;
    });

    chainNodeIdsByConsequenceId[consequenceId] = ordered;
    if (ordered.length > maxDepth) {
      maxDepth = ordered.length;
    }
    ordered.forEach((nodeId, index) => {
      indexByNodeId[nodeId] = index;
      consequenceIdByNodeId[nodeId] = consequenceId;
    });
  });

  if (maxDepth > BARRIER_COLUMNS) {
    maxDepth = BARRIER_COLUMNS;
  }

  return { indexByNodeId, consequenceIdByNodeId, chainNodeIdsByConsequenceId, maxDepth };
}

function computeSupportAnchorXById(nodes: Node<BowtieNodeData>[], edges: Edge[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    const existing = outgoing.get(edge.source) ?? [];
    existing.push(edge.target);
    outgoing.set(edge.source, existing);
  }

  const cache = new Map<string, number | undefined>();

  function resolveAnchor(nodeId: string, visited = new Set<string>()): number | undefined {
    if (cache.has(nodeId)) {
      return cache.get(nodeId);
    }
    if (visited.has(nodeId)) {
      return undefined;
    }

    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    let anchorX: number | undefined;

    if (node?.data.type === "preventive_barrier" || node?.data.type === "mitigative_barrier") {
      anchorX = node.position.x;
    } else {
      for (const targetId of outgoing.get(nodeId) ?? []) {
        const resolved = resolveAnchor(targetId, new Set(visited));
        if (typeof resolved === "number") {
          anchorX = resolved;
          break;
        }
      }
    }

    if (typeof anchorX !== "number" && typeof node?.data.supportAnchorX === "number") {
      anchorX = node.data.supportAnchorX;
    }

    cache.set(nodeId, anchorX);
    return anchorX;
  }

  return nodes.reduce<Record<string, number>>((acc, node) => {
    if (node.data.type !== "escalation_factor" && node.data.type !== "escalation_factor_control") {
      return acc;
    }
    const anchorX = resolveAnchor(node.id);
    if (typeof anchorX === "number") {
      acc[node.id] = anchorX;
    }
    return acc;
  }, {});
}

function computePackedBranchY(
  branchNodes: Node<BowtieNodeData>[],
  rowCountByNodeId: Record<string, number>,
  barrierType: "preventive_barrier" | "mitigative_barrier",
) {
  const packedYByNodeId: Record<string, number> = {};
  const ordered = [...branchNodes].sort(
    (left, right) => left.position.y - right.position.y || left.position.x - right.position.x,
  );

  let nextMinY: number | null = null;
  for (const node of ordered) {
    const rows = Math.max(1, rowCountByNodeId[node.id] ?? 1);
    const targetY: number = nextMinY === null ? node.position.y : Math.max(node.position.y, nextMinY);
    packedYByNodeId[node.id] = targetY;

    const branchBottom =
      targetY +
      Math.max(NODE_FOOTPRINTS[node.data.type].height, NODE_FOOTPRINTS[barrierType].height) +
      (rows - 1) * BARRIER_ROW_GAP;
    nextMinY = branchBottom + BRANCH_CLEARANCE;
  }

  return packedYByNodeId;
}

function quickAddOptionsFor(type: NodeType, side: "left" | "right"): QuickAddOption[] {
  if (type === "threat" && side === "right") {
    return [{ type: "preventive_barrier", label: "Preventive Barrier" }];
  }
  if (type === "preventive_barrier" && side === "left") {
    return [
      { type: "threat", label: "Threat" },
      { type: "preventive_barrier", label: "Barrier" },
    ];
  }
  if (type === "top_event" && side === "left") {
    return [{ type: "threat", label: "Threat" }];
  }
  if (type === "top_event" && side === "right") {
    return [{ type: "consequence", label: "Consequence" }];
  }
  if (type === "mitigative_barrier" && side === "right") {
    return [
      { type: "consequence", label: "Consequence" },
      { type: "mitigative_barrier", label: "Barrier" },
    ];
  }
  if (type === "consequence" && side === "left") {
    return [{ type: "mitigative_barrier", label: "Mitigative Barrier" }];
  }
  if (type === "preventive_barrier" && side === "right") {
    return [
      { type: "preventive_barrier", label: "Barrier" },
      { type: "escalation_factor", label: "Escalation Factor" },
    ];
  }
  if (type === "mitigative_barrier" && side === "left") {
    return [
      { type: "mitigative_barrier", label: "Barrier" },
      { type: "escalation_factor", label: "Escalation Factor" },
    ];
  }
  if (type === "escalation_factor" && side === "right") {
    return [{ type: "escalation_factor_control", label: "Escalation Factor Control" }];
  }
  return [];
}

function isEscalationEdge(
  sourceType: NodeType,
  targetType: NodeType,
) {
  return (
    sourceType === "escalation_factor" ||
    sourceType === "escalation_factor_control" ||
    targetType === "escalation_factor"
  );
}

function buildEdge(
  sourceNode: Node<BowtieNodeData>,
  targetNode: Node<BowtieNodeData>,
): Edge {
  return {
    id: uuid(),
    source: sourceNode.id,
    target: targetNode.id,
    type: "smoothstep",
    ...(isEscalationEdge(sourceNode.data.type, targetNode.data.type)
      ? { style: { stroke: "#a855f7", strokeDasharray: "6 4" } }
      : {}),
  };
}

function isLogicalConnectionAllowed(sourceType: NodeType, targetType: NodeType) {
  if (sourceType === "threat" && targetType === "preventive_barrier") return true;
  if (sourceType === "threat" && targetType === "top_event") return true;
  if (sourceType === "preventive_barrier" && targetType === "top_event") return true;
  if (sourceType === "top_event" && targetType === "consequence") return true;
  if (sourceType === "top_event" && targetType === "mitigative_barrier") return true;
  if (sourceType === "mitigative_barrier" && targetType === "consequence") return true;
  if (sourceType === "escalation_factor" && (targetType === "preventive_barrier" || targetType === "mitigative_barrier")) {
    return true;
  }
  if (sourceType === "escalation_factor_control" && targetType === "escalation_factor") return true;
  return false;
}

function getConnectorDisplayConfig(connectorStyle: ConnectorStyle) {
  if (connectorStyle === "angled") {
    return { type: "step" as const, pathOptions: { offset: 14 } };
  }

  return { type: "smoothstep" as const, pathOptions: { borderRadius: 18, offset: 28 } };
}

function getEdgeForPair(
  selected: NodeType,
  created: NodeType,
  newNodeId: string,
  selectedIdValue: string,
): Edge {
  const escalationStyle = { stroke: "#a855f7", strokeDasharray: "6 4" };
  if (created === "threat") {
    return { id: uuid(), source: newNodeId, target: selectedIdValue, type: "smoothstep" };
  }
  if (created === "preventive_barrier") {
    if (selected === "threat") {
      return { id: uuid(), source: selectedIdValue, target: newNodeId, type: "smoothstep" };
    }
    return { id: uuid(), source: newNodeId, target: selectedIdValue, type: "smoothstep" };
  }
  if (created === "consequence") {
    return { id: uuid(), source: selectedIdValue, target: newNodeId, type: "smoothstep" };
  }
  if (created === "mitigative_barrier") {
    if (selected === "consequence") {
      return { id: uuid(), source: newNodeId, target: selectedIdValue, type: "smoothstep" };
    }
    return { id: uuid(), source: selectedIdValue, target: newNodeId, type: "smoothstep" };
  }
  if (created === "escalation_factor" || created === "escalation_factor_control") {
    return {
      id: uuid(),
      source: newNodeId,
      target: selectedIdValue,
      type: "smoothstep",
      style: escalationStyle,
    };
  }
  return { id: uuid(), source: newNodeId, target: selectedIdValue, type: "smoothstep" };
}

export function BowtieEditor({
  projectId,
  projectMeta,
  initialNodes,
  initialEdges,
  initialWorkflowState,
  readOnly = false,
}: Props) {
  const initialViewMode = readOnly ? "canvas" : shouldOpenInWorksheet(initialNodes) ? "worksheet" : "canvas";
  const [nodes, setNodes, rawOnNodesChange] = useNodesState(
    initialNodes.map((node) => ({
      ...node,
      data: stripPersistedUiState(node.data),
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<EditorViewMode>(initialViewMode);
  const [connectorStyle, setConnectorStyle] = useState<ConnectorStyle>("rounded");
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [worksheetStepTitle, setWorksheetStepTitle] = useState("Select a worksheet step");
  const [worksheetGuidance, setWorksheetGuidance] = useState<StepGuidance | null>(
    initialWorkflowState?.lastActiveStepId
      ? initialWorkflowState.guidanceByStep?.[String(initialWorkflowState.lastActiveStepId)] ?? null
      : null,
  );
  const [worksheetGuidanceLoading, setWorksheetGuidanceLoading] = useState(false);
  const [worksheetGuidanceError, setWorksheetGuidanceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportScope, setExportScope] = useState<ExportScope>("canvas");
  const [exportSize, setExportSize] = useState<ExportSize>("medium");
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [starterGuideDismissed, setStarterGuideDismissed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const autosaveRef = useRef<number | undefined>(undefined);
  const didHydrateTopEventRef = useRef(false);
  const isApplyingHistoryRef = useRef(false);
  const historyRef = useRef<{
    past: EditorSnapshot[];
    future: EditorSnapshot[];
    lastHash: string;
  }>({
    past: [
      cloneSnapshot({
        nodes: initialNodes.map((node) => ({ ...node, data: stripPersistedUiState(node.data) })),
        edges: initialEdges,
      }),
    ],
    future: [],
    lastHash: JSON.stringify({
      nodes: initialNodes.map((node) => ({ ...node, data: stripPersistedUiState(node.data) })),
      edges: initialEdges,
    }),
  });
  const clipboardRef = useRef<ClipboardSnapshot | null>(null);
  const pasteCountRef = useRef(0);

  const selectedNode = useMemo<Node<BowtieNodeData> | null>(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId],
  );
  const worksheetTopEvent = useMemo(
    () => nodes.find((node) => node.data.type === "top_event")?.data.title ?? "",
    [nodes],
  );
  const guidedCounts = useMemo(() => getGuidedCounts(nodes), [nodes]);
  const guidedSteps = useMemo(() => getGuidedSteps(guidedCounts), [guidedCounts]);
  const recommendedStep = useMemo(
    () => guidedSteps.find((step) => !step.done) ?? null,
    [guidedSteps],
  );
  const guidedCompletionCount = guidedSteps.filter((step) => step.done).length;
  const {
    indexByNodeId: preventiveBarrierIndexByNodeId,
    barrierIdsByThreatId,
  } = useMemo(() => computePreventiveBarrierIndexById(nodes, edges), [nodes, edges]);
  const {
    indexByNodeId: mitigativeChainIndexByNodeId,
    chainNodeIdsByConsequenceId,
    maxDepth: mitigativeChainDepth,
  } = useMemo(
    () => computeMitigativeChainIndexById(nodes, edges),
    [nodes, edges],
  );
  const supportAnchorXByNodeId = useMemo(() => computeSupportAnchorXById(nodes, edges), [nodes, edges]);
  const preventiveRowsByThreatId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(barrierIdsByThreatId).map(([threatId, barrierIds]) => [
          threatId,
          Math.max(1, Math.ceil(barrierIds.length / BARRIER_COLUMNS)),
        ]),
      ) as Record<string, number>,
    [barrierIdsByThreatId],
  );
  const mitigativeRowsByConsequenceId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(chainNodeIdsByConsequenceId).map(([consequenceId, chainNodeIds]) => [
          consequenceId,
          Math.max(1, Math.ceil(chainNodeIds.length / BARRIER_COLUMNS)),
        ]),
      ) as Record<string, number>,
    [chainNodeIdsByConsequenceId],
  );
  const packedThreatYByNodeId = useMemo(
    () =>
      computePackedBranchY(
        nodes.filter((node) => node.data.type === "threat"),
        preventiveRowsByThreatId,
        "preventive_barrier",
      ),
    [nodes, preventiveRowsByThreatId],
  );
  const packedConsequenceYByNodeId = useMemo(
    () =>
      computePackedBranchY(
        nodes.filter((node) => node.data.type === "consequence"),
        mitigativeRowsByConsequenceId,
        "mitigative_barrier",
      ),
    [nodes, mitigativeRowsByConsequenceId],
  );
  const mitigativeColumns = Math.max(1, mitigativeChainDepth);
  const laneWidths = LANE_WIDTHS;
  const totalLaneWidth = useMemo(() => laneWidths.reduce((sum, width) => sum + width, 0), [laneWidths]);
  const { laneTop, laneHeight } = useMemo(() => {
    if (nodes.length === 0) {
      return { laneTop: LANE_BASE_START_Y, laneHeight: LANE_BASE_HEIGHT };
    }

    const minY = Math.min(...nodes.map((node) => node.position.y)) - LANE_TOP_PADDING;
    const maxBottom = Math.max(
      ...nodes.map((node) => node.position.y + NODE_FOOTPRINTS[node.data.type].height),
    ) + LANE_BOTTOM_PADDING;
    const top = Math.min(LANE_BASE_START_Y, Math.floor(minY));
    const bottom = Math.max(LANE_BASE_START_Y + LANE_BASE_HEIGHT, Math.ceil(maxBottom));
    return { laneTop: top, laneHeight: bottom - top };
  }, [nodes]);
  const viewportStorageKey = useMemo(() => `bowtie:viewport:${projectId}`, [projectId]);
  const connectorStyleStorageKey = useMemo(() => `bowtie:connector-style:${projectId}`, [projectId]);
  const canUndo = historyTick >= 0 && historyRef.current.past.length > 1;
  const canRedo = historyTick >= 0 && historyRef.current.future.length > 0;
  const laneNodeCounts = useMemo(
    () => ({
      threats: nodes.filter((node) => node.data.type === "threat").length,
      preventiveBarriers: nodes.filter((node) => node.data.type === "preventive_barrier").length,
      topEvent: nodes.filter((node) => node.data.type === "top_event").length,
      mitigativeBarriers: nodes.filter((node) => node.data.type === "mitigative_barrier").length,
      consequences: nodes.filter((node) => node.data.type === "consequence").length,
    }),
    [nodes],
  );
  const showStarterGuide = !readOnly && !starterGuideDismissed && guidedCompletionCount < guidedSteps.length;

  const pushToast = useCallback((text: string) => {
    const id = uuid();
    setToasts((existing) => [...existing, { id, text }]);
    window.setTimeout(() => {
      setToasts((existing) => existing.filter((toast) => toast.id !== id));
    }, 2400);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedConnectorStyle = window.localStorage.getItem(connectorStyleStorageKey);
    if (storedConnectorStyle === "rounded" || storedConnectorStyle === "angled") {
      setConnectorStyle(storedConnectorStyle);
    }
  }, [connectorStyleStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(connectorStyleStorageKey, connectorStyle);
  }, [connectorStyle, connectorStyleStorageKey]);
  const onWorksheetTopEventChange = useCallback(
    (title: string) => {
      const normalized = title.trim();
      if (!normalized) {
        setNodes((existing) => existing.filter((node) => node.data.type !== "top_event"));
        setEdges((existing) =>
          existing.filter((edge) => {
            const sourceNode = nodes.find((node) => node.id === edge.source);
            const targetNode = nodes.find((node) => node.id === edge.target);
            return sourceNode?.data.type !== "top_event" && targetNode?.data.type !== "top_event";
          }),
        );
        setSelectedId((current) => {
          const selectedNode = nodes.find((node) => node.id === current);
          return selectedNode?.data.type === "top_event" ? null : current;
        });
        return;
      }
      setNodes((existing) => {
        const topEventNodes = existing.filter((node) => node.data.type === "top_event");
        if (topEventNodes.length === 0) {
          const referenceNodes = existing.filter((node) => node.data.type !== "top_event");
          const avgY =
            referenceNodes.length > 0
              ? referenceNodes.reduce((sum, node) => sum + node.position.y, 0) / referenceNodes.length
              : 360;
          const clampedY = Math.max(160, Math.min(avgY, 1400));
          return [
            ...existing,
            {
              id: uuid(),
              type: "bowtieNode",
              position: {
                x: laneXForNode("top_event", {}, mitigativeColumns),
                y: clampedY,
              },
              data: {
                type: "top_event",
                typeLabel: NODE_TYPE_META.top_event.label,
                title: normalized,
                description: "",
              },
            },
          ];
        }
        return existing.map((node) =>
          node.data.type === "top_event"
            ? { ...node, data: { ...node.data, title: normalized } }
            : node,
        );
      });
    },
    [mitigativeColumns, nodes, setEdges, setNodes],
  );
  useEffect(() => {
    setNodes((existing) => {
      let changed = false;
      const targetX = laneXForNode("top_event", {}, mitigativeColumns);
      const next = existing.map((node) => {
        if (node.data.type !== "top_event") return node;
        if (Math.abs(node.position.x - targetX) < 0.5) return node;
        changed = true;
        return {
          ...node,
          position: {
            ...node.position,
            x: targetX,
          },
        };
      });
      return changed ? next : existing;
    });
  }, [mitigativeColumns, setNodes]);
  useEffect(() => {
    setNodes((existing) => {
      let changed = false;
      const next = existing.map((node) => {
        if (node.data.type === "threat") {
          const targetY = packedThreatYByNodeId[node.id];
          if (typeof targetY === "number" && Math.abs(node.position.y - targetY) >= 0.5) {
            changed = true;
            return { ...node, position: { ...node.position, y: targetY } };
          }
        }
        if (node.data.type === "consequence") {
          const targetY = packedConsequenceYByNodeId[node.id];
          if (typeof targetY === "number" && Math.abs(node.position.y - targetY) >= 0.5) {
            changed = true;
            return { ...node, position: { ...node.position, y: targetY } };
          }
        }
        return node;
      });
      return changed ? next : existing;
    });
  }, [packedConsequenceYByNodeId, packedThreatYByNodeId, setNodes]);
  const initializeViewport = useCallback(
    (instance: ReactFlowInstance) => {
      reactFlowRef.current = instance;
      let targetViewport = DEFAULT_VIEWPORT;
      if (typeof window !== "undefined" && nodes.length > 0) {
        const raw = window.localStorage.getItem(viewportStorageKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { x?: number; y?: number; zoom?: number };
            if (
              typeof parsed?.x === "number" &&
              typeof parsed?.y === "number" &&
              typeof parsed?.zoom === "number"
            ) {
              targetViewport = { x: parsed.x, y: parsed.y, zoom: parsed.zoom };
            }
          } catch {
            // Ignore malformed stored viewport.
          }
        }
      }

      instance.setViewport(targetViewport, { duration: 0 });
      setViewport(targetViewport);
    },
    [nodes.length, viewportStorageKey],
  );

  const fitToDiagram = useCallback(() => {
    reactFlowRef.current?.fitView({ padding: 0.16, duration: 320, includeHiddenNodes: false });
  }, []);

  const centerTopEvent = useCallback(() => {
    const topEventNode = nodes.find((node) => node.data.type === "top_event");
    if (!topEventNode || !reactFlowRef.current) {
      return;
    }
    const footprint = NODE_FOOTPRINTS.top_event;
    reactFlowRef.current.setCenter(
      topEventNode.position.x + footprint.width / 2,
      topEventNode.position.y + footprint.height / 2,
      { zoom: 0.9, duration: 320 },
    );
  }, [nodes]);

  const warnings = useMemo(
    () => validateBowtie(nodes, edges).map((item) => item.message),
    [nodes, edges],
  );

  const saveCanvas = useCallback(async (options?: { silent?: boolean }) => {
    if (readOnly) {
      return;
    }
    setSaving(true);
    const nodesForSave = nodes.map((node) => ({
      ...node,
      data: stripPersistedUiState(node.data),
    }));
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: nodesForSave, edges }),
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(viewportStorageKey, JSON.stringify(viewport));
    }
    setLastSavedAt(Date.now());
    if (!options?.silent) {
      pushToast("Canvas saved.");
    }
    setSaving(false);
  }, [edges, nodes, projectId, pushToast, readOnly, viewport, viewportStorageKey]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      void saveCanvas({ silent: true });
    }, 1200);
    return () => window.clearTimeout(autosaveRef.current);
  }, [edges, nodes, readOnly, saveCanvas]);

  useEffect(() => {
    const hash = JSON.stringify({ nodes, edges });
    const history = historyRef.current;

    if (isApplyingHistoryRef.current) {
      history.lastHash = hash;
      isApplyingHistoryRef.current = false;
      return;
    }

    if (hash === history.lastHash) {
      return;
    }

    history.past.push(cloneSnapshot({ nodes, edges }));
    if (history.past.length > 100) {
      history.past.shift();
    }
    history.future = [];
    history.lastHash = hash;
    setHistoryTick((tick) => tick + 1);
  }, [nodes, edges]);

  useEffect(() => {
    if (didHydrateTopEventRef.current) return;
    didHydrateTopEventRef.current = true;

    const existingTopEvent = nodes.some((node) => node.data.type === "top_event");
    if (existingTopEvent) return;

    const fallbackTitle = initialWorkflowState?.step1TopEvent?.trim();
    if (!fallbackTitle) return;

    setNodes((existing) => {
      if (existing.some((node) => node.data.type === "top_event")) {
        return existing;
      }
      return [
        ...existing,
        {
          id: uuid(),
          type: "bowtieNode",
          position: {
            x: laneXForNode("top_event", {}, mitigativeColumns),
            y: 260,
          },
          data: {
            type: "top_event",
            typeLabel: NODE_TYPE_META.top_event.label,
            title: fallbackTitle,
            description: "",
          },
        },
      ];
    });
  }, [initialWorkflowState?.step1TopEvent, mitigativeColumns, nodes, setNodes]);

  const onConnect = useCallback(
    (connection: Edge | Connection) =>
      setEdges((existing) => addEdge({ ...connection, type: "smoothstep" }, existing)),
    [setEdges],
  );

  const onNodesChangeLocked = useCallback(
    (changes: Parameters<typeof rawOnNodesChange>[0]) => {
      const locked = changes.map((change) => {
        if (change.type !== "position" || !change.position) {
          return change;
        }
        const currentNode = nodes.find((node) => node.id === change.id);
        if (!currentNode) {
          return change;
        }
        return {
          ...change,
          position: {
            x: laneXForNode(
              currentNode.data.type,
              {
                ...currentNode.data,
                barrierIndex:
                  currentNode.data.type === "preventive_barrier"
                    ? preventiveBarrierIndexByNodeId[currentNode.id]
                    : undefined,
                chainIndex:
                  currentNode.data.type === "mitigative_barrier"
                    ? (mitigativeChainIndexByNodeId[currentNode.id] ?? currentNode.data.chainIndex)
                    : currentNode.data.chainIndex,
                supportAnchorX:
                  currentNode.data.type === "escalation_factor" ||
                  currentNode.data.type === "escalation_factor_control"
                    ? (supportAnchorXByNodeId[currentNode.id] ?? currentNode.data.supportAnchorX)
                    : currentNode.data.supportAnchorX,
              },
              mitigativeColumns,
            ),
            y: change.position.y,
          },
        };
      });
      rawOnNodesChange(locked);
    },
    [
      mitigativeChainIndexByNodeId,
      mitigativeColumns,
      nodes,
      preventiveBarrierIndexByNodeId,
      rawOnNodesChange,
      supportAnchorXByNodeId,
    ],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const nodeIds = (params.nodes ?? []).map((node) => node.id);
    const edgeIds = (params.edges ?? []).map((edge) => edge.id);
    setSelectedNodeIds(nodeIds);
    setSelectedEdgeIds(edgeIds);
    setSelectedId(nodeIds[0] ?? null);
  }, []);

  useEffect(() => {
    setNodes((existing) => {
      let changed = false;
      const next = existing.map((node) => {
        const barrierIndex =
          node.data.type === "preventive_barrier"
            ? preventiveBarrierIndexByNodeId[node.id]
            : undefined;
        const chainIndex =
          node.data.type === "mitigative_barrier"
            ? (mitigativeChainIndexByNodeId[node.id] ?? node.data.chainIndex)
            : node.data.chainIndex;
        const supportLane =
          node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control"
            ? supportLaneForNode(node, mitigativeColumns)
            : node.data.supportLane;
        const supportAnchorX =
          node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control"
            ? (supportAnchorXByNodeId[node.id] ?? node.data.supportAnchorX)
            : node.data.supportAnchorX;
        const x = laneXForNode(
          node.data.type,
          { ...node.data, barrierIndex, chainIndex, supportLane, supportAnchorX },
          mitigativeColumns,
        );
        if (
          Math.abs(node.position.x - x) < 0.5 &&
          chainIndex === node.data.chainIndex &&
          supportAnchorX === node.data.supportAnchorX
        ) {
          return node;
        }
        changed = true;
        return {
          ...node,
          position: { ...node.position, x },
          data: { ...node.data, chainIndex, supportLane, supportAnchorX },
        };
      });
      return changed ? next : existing;
    });
  }, [
    mitigativeChainIndexByNodeId,
    mitigativeColumns,
    preventiveBarrierIndexByNodeId,
    setNodes,
    supportAnchorXByNodeId,
  ]);

  const collectCascadeDeleteNodeIds = useCallback((
    rootIds: string[],
    graphNodes: Node<BowtieNodeData>[] = nodes,
    graphEdges: Edge[] = edges,
  ) => {
    const nodeMap = new Map(graphNodes.map((node) => [node.id, node]));
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();

    for (const edge of graphEdges) {
      incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    }

    const ownedChildren = (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return [];

      if (node.data.type === "top_event") {
        return Array.from(new Set([...(incoming.get(nodeId) ?? []), ...(outgoing.get(nodeId) ?? [])]));
      }
      if (node.data.type === "threat") {
        return (outgoing.get(nodeId) ?? []).filter(
          (childId) => nodeMap.get(childId)?.data.type === "preventive_barrier",
        );
      }
      if (node.data.type === "consequence") {
        return (incoming.get(nodeId) ?? []).filter(
          (childId) => nodeMap.get(childId)?.data.type === "mitigative_barrier",
        );
      }
      if (node.data.type === "preventive_barrier" || node.data.type === "mitigative_barrier") {
        return (incoming.get(nodeId) ?? []).filter(
          (childId) => nodeMap.get(childId)?.data.type === "escalation_factor",
        );
      }
      if (node.data.type === "escalation_factor") {
        return (incoming.get(nodeId) ?? []).filter(
          (childId) => nodeMap.get(childId)?.data.type === "escalation_factor_control",
        );
      }

      return [];
    };

    const deleted = new Set<string>();
    const stack = [...rootIds];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || deleted.has(currentId)) continue;
      deleted.add(currentId);
      for (const childId of ownedChildren(currentId)) {
        if (!deleted.has(childId)) {
          stack.push(childId);
        }
      }
    }

    return deleted;
  }, [edges, nodes]);

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      return;
    }

    const selectedNodeSet = new Set(selectedNodeIds);
    const deletedNodeIds = collectCascadeDeleteNodeIds(selectedNodeIds);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const reconnectEdges: Edge[] = [];
    const reconnectKeys = new Set<string>();

    for (const rootId of selectedNodeIds) {
      const rootNode = nodeMap.get(rootId);
      if (!rootNode) continue;

      const survivingIncoming = edges.filter(
        (edge) =>
          edge.target === rootId &&
          !deletedNodeIds.has(edge.source),
      );
      const survivingOutgoing = edges.filter(
        (edge) =>
          edge.source === rootId &&
          !deletedNodeIds.has(edge.target),
      );

      for (const incomingEdge of survivingIncoming) {
        const sourceNode = nodeMap.get(incomingEdge.source);
        if (!sourceNode) continue;
        for (const outgoingEdge of survivingOutgoing) {
          const targetNode = nodeMap.get(outgoingEdge.target);
          if (!targetNode) continue;
          if (!isLogicalConnectionAllowed(sourceNode.data.type, targetNode.data.type)) {
            continue;
          }
          const key = `${sourceNode.id}:${targetNode.id}`;
          if (reconnectKeys.has(key)) continue;
          const alreadyExists = edges.some(
            (edge) =>
              edge.source === sourceNode.id &&
              edge.target === targetNode.id &&
              !selectedEdgeIds.includes(edge.id),
          );
          if (alreadyExists) continue;
          reconnectKeys.add(key);
          reconnectEdges.push(buildEdge(sourceNode, targetNode));
        }
      }
    }

    if (selectedNodeIds.length > 0 && typeof window !== "undefined") {
      const dependentCount = Math.max(0, deletedNodeIds.size - selectedNodeSet.size);
      const reconnectCount = reconnectEdges.length;
      const confirmation = window.confirm(
        `Delete ${deletedNodeIds.size} node${deletedNodeIds.size === 1 ? "" : "s"}${
          dependentCount > 0 ? ` including ${dependentCount} dependent child node${dependentCount === 1 ? "" : "s"}` : ""
        }?${reconnectCount > 0 ? ` ${reconnectCount} connector${reconnectCount === 1 ? "" : "s"} will be re-linked.` : ""}`,
      );
      if (!confirmation) {
        return;
      }
    }

    const nextNodes = nodes.filter((node) => !deletedNodeIds.has(node.id));
    const nextEdges = [
      ...edges.filter(
        (edge) =>
          !selectedEdgeIds.includes(edge.id) &&
          !deletedNodeIds.has(edge.source) &&
          !deletedNodeIds.has(edge.target),
      ),
      ...reconnectEdges,
    ];

    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedId(null);
    pushToast(
      `Deleted ${deletedNodeIds.size} node${deletedNodeIds.size === 1 ? "" : "s"}${reconnectEdges.length > 0 ? " and re-linked the path." : "."}`,
    );
  }, [collectCascadeDeleteNodeIds, edges, nodes, pushToast, selectedEdgeIds, selectedNodeIds, setEdges, setNodes]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.past.length <= 1) {
      return;
    }

    const current = history.past.pop();
    const previous = history.past[history.past.length - 1];
    if (!current || !previous) {
      return;
    }

    history.future.push(cloneSnapshot(current));
    isApplyingHistoryRef.current = true;
    setNodes(cloneSnapshot(previous.nodes));
    setEdges(cloneSnapshot(previous.edges));
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedId(null);
    setHistoryTick((tick) => tick + 1);
  }, [setEdges, setNodes]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) {
      return;
    }

    history.past.push(cloneSnapshot(next));
    isApplyingHistoryRef.current = true;
    setNodes(cloneSnapshot(next.nodes));
    setEdges(cloneSnapshot(next.edges));
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedId(null);
    setHistoryTick((tick) => tick + 1);
  }, [setEdges, setNodes]);

  const copySelection = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      return false;
    }

    const selectedNodeSet = new Set(selectedNodeIds);
    const copiedNodes = nodes.filter((node) => selectedNodeSet.has(node.id));
    if (copiedNodes.length === 0) {
      return false;
    }

    const copiedEdges = edges.filter(
      (edge) =>
        selectedEdgeIds.includes(edge.id) ||
        (selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target)),
    );

    clipboardRef.current = {
      nodes: cloneSnapshot(copiedNodes),
      edges: cloneSnapshot(copiedEdges),
    };
    pasteCountRef.current = 0;
    return true;
  }, [selectedEdgeIds, selectedNodeIds, nodes, edges]);

  const pasteSelection = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.nodes.length === 0) {
      return;
    }

    const offset = 80 * (pasteCountRef.current + 1);
    const idMap: Record<string, string> = {};
    for (const node of clipboard.nodes) {
      idMap[node.id] = uuid();
    }

    const pastedNodes: Node<BowtieNodeData>[] = clipboard.nodes.map((node) => ({
      ...cloneSnapshot(node),
      id: idMap[node.id],
      position: {
        x: laneXForNode(
          node.data.type,
          {
            ...node.data,
            chainIndex:
              node.data.type === "mitigative_barrier"
                ? (mitigativeChainIndexByNodeId[node.id] ?? node.data.chainIndex)
                : node.data.chainIndex,
          },
          mitigativeColumns,
        ),
        y: node.position.y + offset,
      },
    }));

    const pastedEdges: Edge[] = clipboard.edges
      .filter((edge) => idMap[edge.source] && idMap[edge.target])
      .map((edge) => ({
        ...cloneSnapshot(edge),
        id: uuid(),
        source: idMap[edge.source],
        target: idMap[edge.target],
      }));

    setNodes((existing) => [...existing, ...pastedNodes]);
    setEdges((existing) => [...existing, ...pastedEdges]);
    setSelectedNodeIds(pastedNodes.map((node) => node.id));
    setSelectedEdgeIds(pastedEdges.map((edge) => edge.id));
    setSelectedId(pastedNodes[0]?.id ?? null);
    pasteCountRef.current += 1;
    pushToast(`Pasted ${pastedNodes.length} node${pastedNodes.length === 1 ? "" : "s"}.`);
  }, [mitigativeChainIndexByNodeId, mitigativeColumns, pushToast, setEdges, setNodes]);

  const cutSelection = useCallback(() => {
    const didCopy = copySelection();
    if (didCopy) {
      deleteSelected();
    }
  }, [copySelection, deleteSelected]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext =
        tag === "input" ||
        tag === "textarea" ||
        Boolean(target?.getAttribute("contenteditable"));

      if (isTypingContext) {
        return;
      }

      const withModifier = event.ctrlKey || event.metaKey;
      if (withModifier) {
        const key = event.key.toLowerCase();
        if (key === "c") {
          event.preventDefault();
          copySelection();
          return;
        }
        if (key === "x") {
          event.preventDefault();
          cutSelection();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          pasteSelection();
          return;
        }
        if (key === "z" && event.shiftKey) {
          event.preventDefault();
          redo();
          return;
        }
        if (key === "z") {
          event.preventDefault();
          undo();
          return;
        }
        if (key === "y") {
          event.preventDefault();
          redo();
          return;
        }
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelection, cutSelection, deleteSelected, pasteSelection, readOnly, redo, undo]);

  function addNode(type: NodeType) {
    if (readOnly) {
      return;
    }
    const meta = NODE_TYPE_META[type];
    const nodeId = uuid();
    const supportLane = supportLaneForNode(selectedNode, mitigativeColumns);
    const supportAnchorX =
      type === "escalation_factor" || type === "escalation_factor_control"
        ? selectedNode?.position.x
        : undefined;
    const sameTypeNodes = nodes.filter((node) => node.data.type === type);
    const nearestThreat = findNearestNodeByType(nodes, "threat", selectedNode?.position.y ?? 260);
    const nearestConsequence = findNearestNodeByType(nodes, "consequence", selectedNode?.position.y ?? 260);
    let barrierIndex: number | undefined;
    let chainIndex: number | undefined;
    let nextBaseY =
      type === "top_event"
        ? 260
        : sameTypeNodes.length > 0
          ? Math.max(...sameTypeNodes.map((node) => node.position.y)) + BARRIER_ROW_GAP
          : 140;

    if (type === "preventive_barrier") {
      const threatNode =
        selectedNode?.data.type === "threat"
          ? selectedNode
          : selectedNode?.data.type === "preventive_barrier"
            ? findConnectedNode(selectedNode.id, "incoming", "threat")
            : nearestThreat;
      if (threatNode) {
        barrierIndex = edges.filter(
          (edge) =>
            edge.source === threatNode.id &&
            nodes.find((node) => node.id === edge.target)?.data.type === "preventive_barrier",
        ).length;
        nextBaseY = threatNode.position.y + barrierRowOffset(barrierIndex);
      }
    }

    if (type === "mitigative_barrier") {
      const consequenceNode =
        selectedNode?.data.type === "consequence"
          ? selectedNode
          : selectedNode?.data.type === "mitigative_barrier"
            ? findConnectedNode(selectedNode.id, "outgoing", "consequence")
            : nearestConsequence;
      if (consequenceNode) {
        chainIndex = edges.filter(
          (edge) =>
            edge.target === consequenceNode.id &&
            nodes.find((node) => node.id === edge.source)?.data.type === "mitigative_barrier",
        ).length;
        nextBaseY = consequenceNode.position.y + barrierRowOffset(chainIndex);
      }
    }

    const basePosition = {
      x: laneXForNode(type, { supportLane, supportAnchorX, barrierIndex, chainIndex }, mitigativeColumns),
      y: nextBaseY,
    };
    const position = findNonOverlappingPosition({ ...basePosition, type }, nodes);

    setNodes((existing) => [
      ...existing,
      {
        id: nodeId,
        type: "bowtieNode",
        position,
        data: {
          type,
          typeLabel: meta.label,
          title: meta.label,
          description: "",
          supportLane:
            type === "escalation_factor" || type === "escalation_factor_control"
              ? supportLane
              : undefined,
          supportAnchorX,
          chainIndex,
        },
      },
    ]);
    setSelectedId(nodeId);
    setSelectedNodeIds([nodeId]);
    setSelectedEdgeIds([]);
    pushToast(`${meta.label} added.`);
  }

  function onUpdateNode(nodeId: string, patch: Partial<BowtieNodeData>) {
    if (readOnly) {
      return;
    }
    setNodes((existing) =>
      existing.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  }

  function inferTypeFromAction(action: string, selectedType: NodeType): NodeType {
    const normalized = action.toLowerCase();
    if (normalized.includes("next logical")) {
      if (selectedType === "top_event") return "threat";
      if (selectedType === "threat") return "preventive_barrier";
      if (selectedType === "preventive_barrier") return "escalation_factor";
      if (selectedType === "consequence") return "mitigative_barrier";
      if (selectedType === "mitigative_barrier") return "consequence";
      if (selectedType === "escalation_factor") return "escalation_factor_control";
      return "escalation_factor";
    }
    if (normalized.includes("escalation factor control")) return "escalation_factor_control";
    if (normalized.includes("threat")) return "threat";
    if (normalized.includes("consequence")) return "consequence";
    if (normalized.includes("preventive")) return "preventive_barrier";
    if (normalized.includes("mitigative")) return "mitigative_barrier";
    if (normalized.includes("escalation factor")) return "escalation_factor";
    if (normalized.includes("starter barriers")) {
      return selectedType === "top_event" ? "preventive_barrier" : "mitigative_barrier";
    }
    return "preventive_barrier";
  }

  const findConnectedNode = useCallback((
    nodeId: string,
    direction: "incoming" | "outgoing",
    type: NodeType,
    graphNodes: Node<BowtieNodeData>[] = nodes,
    graphEdges: Edge[] = edges,
  ): Node<BowtieNodeData> | null => {
    const matchingEdge =
      direction === "incoming"
        ? graphEdges.find(
            (edge) => edge.target === nodeId && graphNodes.find((node) => node.id === edge.source)?.data.type === type,
          )
        : graphEdges.find(
            (edge) => edge.source === nodeId && graphNodes.find((node) => node.id === edge.target)?.data.type === type,
          );

    if (!matchingEdge) return null;
    const connectedId = direction === "incoming" ? matchingEdge.source : matchingEdge.target;
    return graphNodes.find((node) => node.id === connectedId) ?? null;
  }, [edges, nodes]);

  const buildSuggestedInsertion = useCallback((
    parent: Node<BowtieNodeData>,
    childType: NodeType,
    title: string,
    index: number,
    graphNodes: Node<BowtieNodeData>[] = nodes,
    graphEdges: Edge[] = edges,
  ) => {
    const supportLane =
      childType === "escalation_factor" || childType === "escalation_factor_control"
        ? supportLaneForNode(parent, mitigativeColumns)
        : undefined;
    const supportAnchorX =
      childType === "escalation_factor" || childType === "escalation_factor_control"
        ? parent.position.x
        : undefined;
    let chainIndex: number | undefined =
      childType === "mitigative_barrier"
        ? (mitigativeChainIndexByNodeId[parent.id] ?? parent.data.chainIndex)
        : undefined;

    let x = laneXForNode(childType, { supportLane, supportAnchorX, chainIndex }, mitigativeColumns);
    let y = (parent.position?.y ?? 220) + 80 + index * 95;
    const childId = uuid();
    const nextEdges: Edge[] = [];
    const edgesToRemove = new Set<string>();

    if (childType === "threat") {
      const topEvent = findNearestNodeByType(graphNodes, "top_event", parent.position.y);
      if (topEvent) {
        nextEdges.push({ id: uuid(), source: childId, target: topEvent.id, type: "smoothstep" });
      }
      if (parent.data.type === "preventive_barrier") {
        y = parent.position.y + index * 90;
      }
    } else if (childType === "consequence" && parent.data.type === "consequence") {
      const topEvent = findNearestNodeByType(graphNodes, "top_event", parent.position.y);
      if (topEvent) {
        nextEdges.push({ id: uuid(), source: topEvent.id, target: childId, type: "smoothstep" });
      }
    } else if (childType === "preventive_barrier") {
      const threatNode =
        parent.data.type === "threat"
          ? parent
          : findConnectedNode(parent.id, "incoming", "threat", graphNodes, graphEdges) ??
            findNearestNodeByType(graphNodes, "threat", parent.position.y);
      const topEvent =
        parent.data.type === "threat"
          ? findNearestNodeByType(graphNodes, "top_event", parent.position.y)
          : findConnectedNode(parent.id, "outgoing", "top_event", graphNodes, graphEdges) ??
            findNearestNodeByType(graphNodes, "top_event", parent.position.y);

      if (threatNode) {
        const branchBarrierCount = graphEdges.filter(
          (edge) =>
            edge.source === threatNode.id &&
            graphNodes.find((node) => node.id === edge.target)?.data.type === "preventive_barrier",
        ).length;
        x = laneXForNode("preventive_barrier", { barrierIndex: branchBarrierCount }, mitigativeColumns);
        y = threatNode.position.y + barrierRowOffset(branchBarrierCount);
        nextEdges.push({ id: uuid(), source: threatNode.id, target: childId, type: "smoothstep" });
      }
      if (topEvent) {
        nextEdges.push({ id: uuid(), source: childId, target: topEvent.id, type: "smoothstep" });
        if (parent.data.type === "threat") {
          graphEdges
            .filter((edge) => edge.source === parent.id && edge.target === topEvent.id)
            .forEach((edge) => edgesToRemove.add(edge.id));
        }
      }
    } else if (childType === "mitigative_barrier") {
      const consequenceNode =
        parent.data.type === "consequence"
          ? parent
          : findConnectedNode(parent.id, "outgoing", "consequence", graphNodes, graphEdges) ??
            findNearestNodeByType(graphNodes, "consequence", parent.position.y);
      const topEvent =
        findConnectedNode(parent.id, "incoming", "top_event", graphNodes, graphEdges) ??
        findNearestNodeByType(graphNodes, "top_event", parent.position.y);

      if (consequenceNode) {
        const branchBarrierCount = graphEdges.filter(
          (edge) =>
            edge.target === consequenceNode.id &&
            graphNodes.find((node) => node.id === edge.source)?.data.type === "mitigative_barrier",
        ).length;
        chainIndex = branchBarrierCount;
        x = laneXForNode("mitigative_barrier", { chainIndex }, mitigativeColumns);
        y = consequenceNode.position.y + barrierRowOffset(chainIndex);
      }

      if (topEvent) {
        nextEdges.push({ id: uuid(), source: topEvent.id, target: childId, type: "smoothstep" });
        if (parent.data.type === "consequence" && chainIndex === 0) {
          graphEdges
            .filter((edge) => edge.source === topEvent.id && edge.target === parent.id)
            .forEach((edge) => edgesToRemove.add(edge.id));
        }
      }
      if (consequenceNode) {
        nextEdges.push({ id: uuid(), source: childId, target: consequenceNode.id, type: "smoothstep" });
      }
    } else if (childType === "escalation_factor" || childType === "escalation_factor_control") {
      nextEdges.push(getEdgeForPair(parent.data.type, childType, childId, parent.id));
    } else {
      nextEdges.push(getEdgeForPair(parent.data.type, childType, childId, parent.id));
    }

    const nextPosition = findNonOverlappingPosition({ x, y, type: childType }, graphNodes);
    x = nextPosition.x;
    y = nextPosition.y;

    const newNode: Node<BowtieNodeData> = {
      id: childId,
      type: "bowtieNode",
      position: { x, y },
      data: {
        type: childType,
        typeLabel: NODE_TYPE_META[childType].label,
        title,
        description: "",
        supportLane,
        supportAnchorX,
        chainIndex,
      },
    };

    return { newNode, nextEdges, edgesToRemove };
  }, [edges, findConnectedNode, mitigativeChainIndexByNodeId, mitigativeColumns, nodes]);

  function onInsertSuggestions(
    action: string,
    items: { label: string; nodeType?: NodeType }[],
  ) {
    if (readOnly) return;
    if (!selectedNode || items.length === 0) return;
    const selectedType = selectedNode.data.type;
    const fallbackType = inferTypeFromAction(action, selectedType);
    const existingNodeKeys = new Set(
      nodes.map((node) => `${node.data.type}:${node.data.title.trim().toLowerCase().replace(/\s+/g, " ")}`),
    );

    const filteredItems = items.filter((item) => {
      const nodeType = item.nodeType ?? fallbackType;
      const normalizedTitle = item.label.trim().toLowerCase().replace(/\s+/g, " ");
      if (!normalizedTitle) return false;
      const key = `${nodeType}:${normalizedTitle}`;
      if (existingNodeKeys.has(key)) {
        return false;
      }
      existingNodeKeys.add(key);
      return true;
    });

    if (filteredItems.length === 0) {
      return;
    }

    let draftNodes = [...nodes];
    let draftEdges = [...edges];
    filteredItems.forEach((item, index) => {
      const nodeType = item.nodeType ?? fallbackType;
      const insertion = buildSuggestedInsertion(selectedNode, nodeType, item.label, index, draftNodes, draftEdges);
      draftNodes = [...draftNodes, insertion.newNode];
      const keptEdges =
        insertion.edgesToRemove.size > 0
          ? draftEdges.filter((edge) => !insertion.edgesToRemove.has(edge.id))
          : draftEdges;
      draftEdges = [...keptEdges, ...insertion.nextEdges];
    });

    setNodes(draftNodes);
    setEdges(draftEdges);
    const insertedIds = draftNodes
      .slice(nodes.length)
      .map((node) => node.id);
    setSelectedNodeIds(insertedIds);
    setSelectedId(insertedIds[0] ?? null);
    setSelectedEdgeIds([]);
    pushToast(`Inserted ${insertedIds.length} suggestion${insertedIds.length === 1 ? "" : "s"}.`);
  }

  const quickAddNode = useCallback((parentId: string, side: "left" | "right", childType: NodeType) => {
    if (readOnly) return;
    const parent = nodes.find((node) => node.id === parentId);
    if (!parent) return;
    if (parent.data.type === "threat" && side === "left") return;
    if (parent.data.type === "consequence" && side === "right") return;
    const insertion = buildSuggestedInsertion(
      parent,
      childType,
      NODE_TYPE_META[childType].label,
      0,
      nodes,
      edges,
    );

    setNodes((existing) => [...existing, insertion.newNode]);
    setEdges((existing) => {
      const kept =
        insertion.edgesToRemove.size > 0
          ? existing.filter((edge) => !insertion.edgesToRemove.has(edge.id))
          : existing;
      return [...kept, ...insertion.nextEdges];
    });
    setSelectedId(insertion.newNode.id);
    setSelectedNodeIds([insertion.newNode.id]);
    setSelectedEdgeIds([]);
    pushToast(`${NODE_TYPE_META[childType].label} added.`);
  }, [buildSuggestedInsertion, edges, nodes, pushToast, readOnly, setEdges, setNodes]);

  const toggleCollapse = useCallback((nodeId: string, side: "left" | "right") => {
    if (readOnly) return;
    setNodes((existing) =>
      existing.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            collapsedLeft: side === "left" ? !node.data.collapsedLeft : node.data.collapsedLeft,
            collapsedRight:
              side === "right" ? !node.data.collapsedRight : node.data.collapsedRight,
          },
        };
      }),
    );
  }, [readOnly, setNodes]);

  const hiddenNodeIds = useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const neighbors = new Map<string, string[]>();
    for (const node of nodes) {
      neighbors.set(node.id, []);
    }
    for (const edge of edges) {
      if (!neighbors.has(edge.source) || !neighbors.has(edge.target)) continue;
      neighbors.get(edge.source)!.push(edge.target);
      neighbors.get(edge.target)!.push(edge.source);
    }

    const hidden = new Set<string>();
    for (const node of nodes) {
      for (const side of ["left", "right"] as const) {
        const collapsed = side === "left" ? node.data.collapsedLeft : node.data.collapsedRight;
        if (!collapsed) continue;

        const rootX = node.position.x;
        const stack = [...(neighbors.get(node.id) ?? [])];
        const visited = new Set<string>([node.id]);

        while (stack.length > 0) {
          const currentId = stack.pop()!;
          if (visited.has(currentId)) continue;
          visited.add(currentId);

          const currentNode = nodeMap.get(currentId);
          if (!currentNode) continue;
          const isOnSide =
            side === "left"
              ? currentNode.position.x < rootX - 10
              : currentNode.position.x > rootX + 10;

          if (!isOnSide) continue;
          if (currentNode.data.type === "top_event") continue;
          hidden.add(currentId);

          for (const next of neighbors.get(currentId) ?? []) {
            if (!visited.has(next)) {
              stack.push(next);
            }
          }
        }
      }
    }
    return hidden;
  }, [nodes, edges]);

  const viewNodes = useMemo(() => {
    const hasNodeOnSide = (nodeId: string, side: "left" | "right") => {
      const root = nodes.find((node) => node.id === nodeId);
      if (!root) return false;
      const rootX = root.position.x;
      return edges.some((edge) => {
        if (edge.source !== nodeId && edge.target !== nodeId) return false;
        const otherId = edge.source === nodeId ? edge.target : edge.source;
        const other = nodes.find((node) => node.id === otherId);
        if (!other) return false;
        return side === "left" ? other.position.x < rootX - 10 : other.position.x > rootX + 10;
      });
    };

    return nodes.map((node) => ({
      ...node,
      hidden: hiddenNodeIds.has(node.id),
      data: {
        ...node.data,
        supportLane:
          node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control"
            ? supportLaneForNode(node, mitigativeColumns)
            : node.data.supportLane,
        chainIndex:
          node.data.type === "mitigative_barrier"
            ? (mitigativeChainIndexByNodeId[node.id] ?? node.data.chainIndex)
            : node.data.chainIndex,
        quickAddLeft: readOnly ? [] : quickAddOptionsFor(node.data.type, "left"),
        quickAddRight: readOnly ? [] : quickAddOptionsFor(node.data.type, "right"),
        canCollapseLeft: readOnly ? false : hasNodeOnSide(node.id, "left"),
        canCollapseRight: readOnly ? false : hasNodeOnSide(node.id, "right"),
        onQuickAdd: readOnly ? undefined : quickAddNode,
        onToggleCollapse: readOnly ? undefined : toggleCollapse,
      },
    }));
  }, [
    nodes,
    edges,
    hiddenNodeIds,
    mitigativeChainIndexByNodeId,
    mitigativeColumns,
    quickAddNode,
    readOnly,
    toggleCollapse,
  ]);

  const viewEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        ...getConnectorDisplayConfig(connectorStyle),
        hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
      })),
    [connectorStyle, edges, hiddenNodeIds],
  );

  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function waitForViewRender() {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.setTimeout(resolve, 90);
        });
      });
    });
  }

  function getImageDimensions(dataUrl: string) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.width, height: image.height });
      image.onerror = () => reject(new Error("Unable to read image dimensions."));
      image.src = dataUrl;
    });
  }

  function getExportBaseName() {
    return projectMeta.title.replace(/\s+/g, "_").toLowerCase();
  }

  async function captureScopeViews(
    scope: ExportScope,
    size: ExportSize,
  ): Promise<Array<{ mode: "canvas" | "worksheet"; dataUrl: string }>> {
    const targets: Array<"canvas" | "worksheet"> =
      scope === "both" ? ["canvas", "worksheet"] : [scope];
    const originalMode = viewMode;
    let currentMode = originalMode;
    const captures: Array<{ mode: "canvas" | "worksheet"; dataUrl: string }> = [];

    for (const target of targets) {
      if (currentMode !== target) {
        setViewMode(target);
        currentMode = target;
      }
      await waitForViewRender();
      if (!canvasRef.current) continue;
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: EXPORT_PIXEL_RATIO[size],
      });
      captures.push({ mode: target, dataUrl });
    }

    if (currentMode !== originalMode) {
      setViewMode(originalMode);
      await waitForViewRender();
    }

    return captures;
  }

  async function runExport() {
    setExporting(true);
    setExportMessage(null);
    try {
      const captures = await captureScopeViews(exportScope, exportSize);
      if (captures.length === 0) {
        setExportMessage("Nothing to export yet.");
        return;
      }

      const baseName = getExportBaseName();
      if (exportFormat === "png") {
        if (captures.length === 1) {
          downloadDataUrl(captures[0].dataUrl, `${baseName}_${captures[0].mode}.png`);
        } else {
          for (const capture of captures) {
            downloadDataUrl(capture.dataUrl, `${baseName}_${capture.mode}.png`);
          }
        }
        setExportMessage("PNG export complete.");
        return;
      }

      const first = captures[0];
      const firstDimensions = await getImageDimensions(first.dataUrl);
      const firstOrientation = firstDimensions.width >= firstDimensions.height ? "landscape" : "portrait";
      const doc = new jsPDF({
        unit: "pt",
        orientation: firstOrientation,
        format: PDF_FORMAT_BY_SIZE[exportSize],
      });
      const pageFormat = PDF_FORMAT_BY_SIZE[exportSize];

      captures.forEach((capture, index) => {
        const imageProps = doc.getImageProperties(capture.dataUrl);
        const orientation = imageProps.width > imageProps.height ? "landscape" : "portrait";
        if (index > 0) {
          doc.addPage(pageFormat, orientation);
        }
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 24;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const ratio = Math.min(maxWidth / imageProps.width, maxHeight / imageProps.height);
        const width = imageProps.width * ratio;
        const height = imageProps.height * ratio;
        const x = (pageWidth - width) / 2;
        const y = (pageHeight - height) / 2;
        doc.addImage(capture.dataUrl, "PNG", x, y, width, height);
      });

      doc.save(`${baseName}_${exportScope}.pdf`);
      setExportMessage("PDF export complete.");
    } catch {
      setExportMessage("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectMeta.title.replace(/\s+/g, "_").toLowerCase()}_bowtie.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          setSelectedId(parsed.nodes[0]?.id ?? null);
          setSelectedNodeIds(parsed.nodes[0]?.id ? [parsed.nodes[0].id] : []);
          setSelectedEdgeIds([]);
          pushToast("Canvas imported.");
        }
      } catch {
        // Ignore invalid JSON uploads in MVP.
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full flex-col">
      {!readOnly ? (
        showStarterGuide ? (
          <div className="border-b border-[#9CA3AF] bg-white px-4 py-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,0.85fr)_minmax(420px,1.2fr)_minmax(520px,1.3fr)]">
              <div className="rounded border border-[#9CA3AF]/70 bg-[#F7F8FA] px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#325D88]">Starter Guide</p>
                  <span className="rounded-full border border-[#9CA3AF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1F2933]/75">
                    {guidedCompletionCount}/{guidedSteps.length}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-[#1F2933]">Build the core bowtie in a clean, recommended sequence.</p>
                <p className="mt-1 text-xs leading-5 text-[#1F2933]/70">
                  Complete the essentials first, then move into richer ownership, notes, and export detail.
                </p>
              </div>
              {recommendedStep ? (
                <div className="rounded border border-[#D4A547]/60 bg-[#f8f1df] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a5b10]">
                        Recommended Next Action
                      </p>
                      <p className="mt-2 text-[1.05rem] font-semibold leading-6 text-[#1F2933]">{recommendedStep.title}</p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#1F2933]/75">{recommendedStep.detail}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {viewMode !== recommendedStep.preferredView ? (
                        <button
                          onClick={() => setViewMode(recommendedStep.preferredView)}
                          className="rounded bg-[#325D88] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white"
                        >
                          {recommendedStep.preferredView === "worksheet" ? "Open Guided Worksheet" : "Open Canvas"}
                        </button>
                      ) : (
                        <span className="rounded bg-[#e8eef7] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#325D88]">
                          Right Workspace
                        </span>
                      )}
                      <button
                        onClick={() => setStarterGuideDismissed(true)}
                        className="rounded border border-[#9CA3AF] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#1F2933]/70"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded border border-[#9CA3AF]/70 bg-[#F7F8FA] px-4 py-3" />
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                {guidedSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`rounded border border-[#9CA3AF]/70 bg-[#F5F3F0] px-3 py-3 ${
                      guidedSteps.length % 2 === 1 && index === guidedSteps.length - 1 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <div className="flex h-full items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1F2933]/45">
                          Step {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-[#1F2933]">{step.title}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          step.done ? "bg-[#d8eadf] text-[#235f34]" : "bg-[#e2e8f0] text-[#475569]"
                        }`}
                      >
                        {step.done ? "Done" : "Next"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-[#9CA3AF] bg-white px-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#325D88]">Core Structure Ready</p>
                <p className="mt-1 text-xs text-[#1F2933]/75">
                  Your bowtie has the main structure in place. Use the worksheet to add notes and ownership details,
                  or stay on the canvas to refine barriers and export.
                </p>
              </div>
              <button
                onClick={() => setStarterGuideDismissed(false)}
                className="rounded border border-[#9CA3AF] px-3 py-2 text-xs font-semibold text-[#1F2933]/70"
              >
                Show Guide
              </button>
            </div>
          </div>
        )
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="w-64 border-r border-[#9CA3AF] bg-[#E5E7EB] p-3">
        {readOnly ? (
          <div className="space-y-4">
            <div className="rounded border border-[#9CA3AF] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#325D88]">Example canvas</p>
              <h3 className="mt-1 text-sm font-semibold text-[#1F2933]">{projectMeta.title}</h3>
              <p className="mt-2 text-xs text-[#1F2933]/75">
                {projectMeta.industry} scenario with a complete bowtie layout. Pan and zoom the canvas to inspect
                how threats, barriers, escalation factors, and consequences connect.
              </p>
            </div>
            <div className="rounded border border-[#9CA3AF] bg-white p-3 text-xs text-[#1F2933]/80">
              <p className="font-semibold text-[#1F2933]">Top event</p>
              <p className="mt-1">{projectMeta.topEvent}</p>
              <p className="mt-3">
                Nodes: <strong>{nodes.length}</strong>
              </p>
              <p className="mt-1">
                Connectors: <strong>{edges.length}</strong>
              </p>
              <p className="mt-3">
                This view is read-only. Create an account to build and save your own bowties.
              </p>
            </div>
            <Link
              href="/login?mode=signup"
              className="block rounded bg-[#325D88] px-3 py-2 text-center text-xs font-semibold text-white"
            >
              Create Your Own
            </Link>
            <Link
              href="/examples"
              className="block rounded border border-[#9CA3AF] bg-white px-3 py-2 text-center text-xs font-semibold text-[#1F2933]"
            >
              All Examples
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded border border-[#9CA3AF] bg-white p-1">
              <button
                onClick={() => setViewMode("canvas")}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  viewMode === "canvas" ? "bg-[#325D88] text-white" : "text-[#1F2933]"
                }`}
              >
                Canvas
              </button>
              <button
                onClick={() => setViewMode("worksheet")}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  viewMode === "worksheet" ? "bg-[#325D88] text-white" : "text-[#1F2933]"
                }`}
              >
                Worksheet
              </button>
            </div>

            <div className="mb-3 rounded border border-[#9CA3AF] bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F2933]/75">Canvas Tools</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs font-semibold text-[#1F2933] disabled:opacity-50"
                >
                  Undo
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs font-semibold text-[#1F2933] disabled:opacity-50"
                >
                  Redo
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={fitToDiagram}
                  className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs font-semibold text-[#1F2933]"
                >
                  Fit Diagram
                </button>
                <button
                  onClick={centerTopEvent}
                  className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs font-semibold text-[#1F2933]"
                >
                  Center Top Event
                </button>
              </div>
              <select
                value={connectorStyle}
                onChange={(event) => setConnectorStyle(event.target.value as ConnectorStyle)}
                className="mt-2 w-full rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs text-[#1F2933]"
              >
                <option value="rounded">Connectors: Rounded</option>
                <option value="angled">Connectors: Hard Angles</option>
              </select>
              <p className="mt-2 text-[11px] text-[#1F2933]/65">
                Shortcuts: `Ctrl/Cmd+Z` undo, `Shift+Ctrl/Cmd+Z` redo, `Delete` remove, `Ctrl/Cmd+V` paste.
              </p>
            </div>

            <h3 className="text-sm font-semibold text-[#1F2933]">Palette</h3>
            <div className="mt-2 grid gap-2">
              {Object.entries(NODE_TYPE_META).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => addNode(type as keyof typeof NODE_TYPE_META)}
                  className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-left text-xs text-[#1F2933]"
                >
                  + {meta.label}
                </button>
              ))}
            </div>

            <h4 className="mt-4 text-xs font-semibold uppercase text-[#1F2933]/70">Quick Add</h4>
            <div className="mt-1 space-y-1">
              <button className="w-full rounded bg-[#f6dfdd] px-2 py-1 text-xs text-[#1F2933]" onClick={() => addNode("threat")}>
                + Threat
              </button>
              <button className="w-full rounded bg-[#dce6f1] px-2 py-1 text-xs text-[#1F2933]" onClick={() => addNode("consequence")}>
                + Consequence
              </button>
              <button
                className="w-full rounded bg-[#f4e7ca] px-2 py-1 text-xs text-[#1F2933]"
                onClick={() => addNode("preventive_barrier")}
              >
                + Barrier
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <button onClick={() => void saveCanvas()} className="w-full rounded bg-[#325D88] px-2 py-1 text-xs text-white">
                {saving ? "Saving..." : "Save Now"}
              </button>
              <p className="text-[11px] text-[#1F2933]/65">
                {saving
                  ? "Saving changes..."
                  : lastSavedAt
                    ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : "Changes autosave after a short pause."}
              </p>
              <button
                onClick={deleteSelected}
                disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0}
                className="w-full rounded border border-[#C7514A] bg-[#f9eceb] px-2 py-1 text-xs text-[#C7514A] disabled:opacity-50"
              >
                Delete Selected
              </button>
              <div className="rounded border border-[#9CA3AF] bg-white p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1F2933]/75">
                  Export Builder
                </p>
                <div className="mt-2 grid gap-1">
                  <select
                    value={exportFormat}
                    onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                    className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs text-[#1F2933]"
                  >
                    <option value="png">Format: PNG</option>
                    <option value="pdf">Format: PDF</option>
                  </select>
                  <select
                    value={exportScope}
                    onChange={(event) => setExportScope(event.target.value as ExportScope)}
                    className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs text-[#1F2933]"
                  >
                    <option value="canvas">Scope: Canvas</option>
                    <option value="worksheet">Scope: Worksheet</option>
                    <option value="both">Scope: Both</option>
                  </select>
                  <select
                    value={exportSize}
                    onChange={(event) => setExportSize(event.target.value as ExportSize)}
                    className="rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs text-[#1F2933]"
                  >
                    <option value="small">Size: Small</option>
                    <option value="medium">Size: Medium</option>
                    <option value="large">Size: Large</option>
                  </select>
                  <button
                    onClick={() => void runExport()}
                    disabled={exporting}
                    className="rounded border border-[#9CA3AF] bg-[#325D88] px-2 py-1 text-xs font-semibold text-white disabled:opacity-70"
                  >
                    {exporting ? "Exporting..." : "Run Export"}
                  </button>
                  {exportMessage ? <p className="text-[11px] text-[#1F2933]/70">{exportMessage}</p> : null}
                </div>
              </div>
              <button onClick={exportJson} className="w-full rounded border border-[#9CA3AF] bg-white px-2 py-1 text-xs text-[#1F2933]">
                Export JSON
              </button>
              <label className="block cursor-pointer rounded border border-[#9CA3AF] bg-white px-2 py-1 text-center text-xs text-[#1F2933]">
                Import JSON
                <input type="file" accept="application/json" onChange={importJson} className="hidden" />
              </label>
            </div>

            {warnings.length > 0 ? (
              <div className="mt-4 rounded border border-[#D4A547] bg-[#f8f1df] p-2 text-xs text-[#1F2933]">
                <p className="font-semibold">Soft warnings</p>
                <ul className="mt-1 list-disc pl-4">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
        </div>

        <div className="relative min-w-0 flex-1" ref={canvasRef}>
          {readOnly || viewMode === "canvas" ? (
            <>
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div
                  className="absolute"
                  style={{
                    left: LANE_START_X,
                    top: laneTop,
                    width: totalLaneWidth,
                    height: laneHeight,
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <div className="absolute inset-0 flex">
                    {LANE_META.map((lane, index) => (
                      <div
                        key={lane.label}
                        className={`h-full ${lane.className}`}
                        style={{ width: laneWidths[index] }}
                      />
                    ))}
                  </div>
                  <div
                    className="absolute left-0 top-0 flex w-full border-b border-zinc-300/70 bg-white/90"
                    style={{ height: LANE_LABEL_HEIGHT }}
                  >
                    {LANE_META.map((lane, index) => (
                      <div
                        key={`${lane.label}-label`}
                        className="flex items-center justify-center px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1F2933]"
                        style={{ width: laneWidths[index] }}
                      >
                        {index === 0
                          ? `${lane.label} (${laneNodeCounts.threats})`
                          : index === 1
                            ? `${lane.label} (${laneNodeCounts.preventiveBarriers})`
                            : index === 2
                              ? `${lane.label} (${laneNodeCounts.topEvent})`
                              : index === 3
                                ? `${lane.label} (${laneNodeCounts.mitigativeBarriers})`
                                : `${lane.label} (${laneNodeCounts.consequences})`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <ReactFlow
                className="relative z-10"
                nodes={viewNodes}
                edges={viewEdges}
                nodeTypes={nodeTypes}
                onNodesChange={readOnly ? undefined : onNodesChangeLocked}
                onEdgesChange={readOnly ? undefined : onEdgesChange}
                onConnect={readOnly ? undefined : onConnect}
                onSelectionChange={readOnly ? undefined : onSelectionChange}
                onNodeClick={readOnly ? undefined : (_, node) => setSelectedId(node.id)}
                onPaneClick={readOnly ? undefined : () => setSelectedId(null)}
                onMove={(_, nextViewport) => setViewport(nextViewport)}
                onInit={(instance: ReactFlowInstance) => initializeViewport(instance)}
                snapToGrid
                snapGrid={[12, 12]}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable={!readOnly}
                panOnDrag
                deleteKeyCode={null}
              >
                <Background gap={12} size={1} />
                <MiniMap />
                <Controls />
              </ReactFlow>
            </>
          ) : (
            <WorkflowWorksheet
              projectId={projectId}
              projectMeta={projectMeta}
              nodes={nodes}
              edges={edges}
              initialState={initialWorkflowState}
              currentTopEvent={worksheetTopEvent}
              onTopEventChange={onWorksheetTopEventChange}
              onGuidanceContextChange={(payload) => {
                setWorksheetStepTitle(payload.stepTitle || "Select a worksheet step");
                setWorksheetGuidance(payload.guidance);
                setWorksheetGuidanceLoading(payload.loading);
                setWorksheetGuidanceError(payload.error);
              }}
            />
          )}
        </div>
        {readOnly ? null : viewMode === "canvas" ? (
          <InspectorPanel
            key={selectedId ?? "none"}
            selectedNode={selectedNode}
            projectMeta={projectMeta}
            contextGraph={{ nodes, edges }}
            onUpdateNode={onUpdateNode}
            onInsertSuggestions={onInsertSuggestions}
          />
        ) : (
          <aside className="w-80 border-l border-[#9CA3AF] bg-[#E5E7EB] p-4 text-sm text-[#1F2933]">
            <h3 className="font-semibold text-[#1F2933]">Worksheet Guidance</h3>
            <p className="mt-1 text-xs font-semibold text-[#1F2933]">{worksheetStepTitle}</p>
            {worksheetGuidanceLoading ? (
              <p className="mt-3 text-xs text-[#1F2933]/70">Generating LLM facilitation prompts...</p>
            ) : null}
            {worksheetGuidanceError ? (
              <p className="mt-3 text-xs text-[#C7514A]">{worksheetGuidanceError}</p>
            ) : null}
            {worksheetGuidance ? (
              <div className="mt-3 space-y-3">
                <div className="rounded border border-[#9CA3AF] bg-white p-2">
                  <p className="text-xs font-semibold text-[#1F2933]">{worksheetGuidance.headline}</p>
                  <p className="mt-1 text-[11px] text-[#1F2933]/65">
                    Source: {worksheetGuidance.source.toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1F2933]">Discussion Prompts</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#1F2933]">
                    {worksheetGuidance.discussionPrompts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1F2933]">Quality Checks</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#1F2933]">
                    {worksheetGuidance.qualityChecks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1F2933]">Suggested Next Actions</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#1F2933]">
                    {worksheetGuidance.nextActions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#1F2933]/70">
                Click into a step&apos;s notes box to generate interactive LLM workshop guidance.
              </p>
            )}
          </aside>
        )}
      </div>

      {toasts.length > 0 ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-40 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-lg border border-[#9CA3AF] bg-white/95 px-3 py-2 text-xs font-semibold text-[#1F2933] shadow-lg backdrop-blur"
            >
              {toast.text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
