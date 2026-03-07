"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type ExportFormat = "png" | "pdf";
type ExportScope = "canvas" | "worksheet" | "both";
type ExportSize = "small" | "medium" | "large";

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
}

const nodeTypes = { bowtieNode: BowtieNode };
const LANE_WIDTH = 250;
const LANE_START_X = 0;
const LANE_START_Y = -120;
const LANE_HEIGHT = 2200;
const DEFAULT_NODE_WIDTH = 208;
const DEFAULT_VIEWPORT = { x: 0, y: 80, zoom: 0.72 };
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

const LANE_META: Array<{ label: string; className: string }> = [
  { label: "Threats", className: "border-r border-[#9CA3AF]/70 bg-[#f0f3f6]" },
  { label: "Preventive Barriers", className: "border-r border-[#D4A547]/40 bg-[#fcf7ea]" },
  { label: "Top Event", className: "border-r border-[#9CA3AF]/70 bg-[#f6f4ef]" },
  { label: "Mitigative Barriers", className: "border-r border-[#325D88]/35 bg-[#eef3f8]" },
  { label: "Consequences", className: "bg-[#f1f4f8]" },
];

function laneXForType(type: NodeType, mitigativeColumns = 1) {
  const lane = NODE_TYPE_META[type].lane;
  const laneIndex =
    lane === "left"
      ? 0
      : lane === "center-left"
        ? 1
        : lane === "center"
          ? 2
          : lane === "center-right"
            ? 3
            : 4 + (mitigativeColumns - 1);
  return LANE_START_X + laneIndex * LANE_WIDTH + (LANE_WIDTH - DEFAULT_NODE_WIDTH) / 2;
}

function supportLaneForNode(
  node: Node<BowtieNodeData> | null | undefined,
  mitigativeColumns = 1,
): "preventive" | "mitigative" {
  if (!node) return "preventive";
  if (node.data.type === "mitigative_barrier") return "mitigative";
  if (node.data.type === "preventive_barrier") return "preventive";
  if (node.data.supportLane) return node.data.supportLane;
  if (node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control") {
    const laneThreeX = LANE_START_X + 3 * LANE_WIDTH;
    const mitigativeEdgeX = laneThreeX + mitigativeColumns * LANE_WIDTH;
    return node.position.x >= laneThreeX && node.position.x < mitigativeEdgeX ? "mitigative" : "preventive";
  }
  return "preventive";
}

function laneXForNode(type: NodeType, data?: Partial<BowtieNodeData>, mitigativeColumns = 1) {
  if (type === "escalation_factor" || type === "escalation_factor_control") {
    if (typeof data?.supportAnchorX === "number") {
      return data.supportAnchorX;
    }
    const supportLane = data?.supportLane ?? "preventive";
    const laneIndex = supportLane === "mitigative" ? 3 : 1;
    return LANE_START_X + laneIndex * LANE_WIDTH + (LANE_WIDTH - DEFAULT_NODE_WIDTH) / 2;
  }
  if (type === "mitigative_barrier" && typeof data?.chainIndex === "number") {
    const clampedIndex = Math.max(0, Math.min(data.chainIndex, mitigativeColumns - 1));
    return LANE_START_X + (3 + clampedIndex) * LANE_WIDTH + (LANE_WIDTH - DEFAULT_NODE_WIDTH) / 2;
  }
  return laneXForType(type, mitigativeColumns);
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

function getMitigativeChainForConsequence(
  nodes: Node<BowtieNodeData>[],
  edges: Edge[],
  consequenceId: string,
): string[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.target) ?? [];
    list.push(edge);
    incoming.set(edge.target, list);
  }

  const chainFromConsequence: string[] = [];
  let cursor = consequenceId;
  const visited = new Set<string>();
  while (true) {
    const nextEdge = (incoming.get(cursor) ?? []).find((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      return sourceNode?.data.type === "mitigative_barrier";
    });
    if (!nextEdge) break;
    if (visited.has(nextEdge.source)) break;
    visited.add(nextEdge.source);
    chainFromConsequence.push(nextEdge.source);
    cursor = nextEdge.source;
  }

  return chainFromConsequence.reverse();
}

function computeMitigativeChainIndexById(
  nodes: Node<BowtieNodeData>[],
  edges: Edge[],
): { indexByNodeId: Record<string, number>; maxDepth: number } {
  const indexByNodeId: Record<string, number> = {};
  let maxDepth = 1;
  const consequences = nodes.filter((node) => node.data.type === "consequence");
  for (const consequence of consequences) {
    const chain = getMitigativeChainForConsequence(nodes, edges, consequence.id);
    if (chain.length > maxDepth) {
      maxDepth = chain.length;
    }
    chain.forEach((nodeId, index) => {
      indexByNodeId[nodeId] = index;
    });
  }
  return { indexByNodeId, maxDepth };
}

function quickAddOptionsFor(type: NodeType, side: "left" | "right"): QuickAddOption[] {
  if (type === "threat" && side === "right") {
    return [{ type: "preventive_barrier", label: "Preventive Barrier" }];
  }
  if (type === "preventive_barrier" && side === "left") {
    return [{ type: "threat", label: "Threat" }];
  }
  if (type === "top_event" && side === "left") {
    return [{ type: "threat", label: "Threat" }];
  }
  if (type === "top_event" && side === "right") {
    return [{ type: "consequence", label: "Consequence" }];
  }
  if (type === "mitigative_barrier" && side === "right") {
    return [{ type: "consequence", label: "Consequence" }];
  }
  if (type === "consequence" && side === "left") {
    return [{ type: "mitigative_barrier", label: "Mitigative Barrier" }];
  }
  if (type === "preventive_barrier" && side === "right") {
    return [{ type: "escalation_factor", label: "Escalation Factor" }];
  }
  if (type === "mitigative_barrier" && side === "left") {
    return [{ type: "escalation_factor", label: "Escalation Factor" }];
  }
  if (type === "escalation_factor" && side === "right") {
    return [{ type: "escalation_factor_control", label: "Escalation Factor Control" }];
  }
  return [];
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
}: Props) {
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
  const [viewMode, setViewMode] = useState<"canvas" | "worksheet">("canvas");
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
  const canvasRef = useRef<HTMLDivElement>(null);
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
  const { indexByNodeId: mitigativeChainIndexByNodeId, maxDepth: mitigativeChainDepth } = useMemo(
    () => computeMitigativeChainIndexById(nodes, edges),
    [nodes, edges],
  );
  const mitigativeColumns = Math.max(1, mitigativeChainDepth);
  const laneWidths = useMemo(
    () => [LANE_WIDTH, LANE_WIDTH, LANE_WIDTH, LANE_WIDTH * mitigativeColumns, LANE_WIDTH],
    [mitigativeColumns],
  );
  const totalLaneWidth = useMemo(() => laneWidths.reduce((sum, width) => sum + width, 0), [laneWidths]);
  const viewportStorageKey = useMemo(() => `bowtie:viewport:${projectId}`, [projectId]);
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
  const initializeViewport = useCallback(
    (instance: ReactFlowInstance) => {
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

  const warnings = useMemo(
    () => validateBowtie(nodes, edges).map((item) => item.message),
    [nodes, edges],
  );

  const saveCanvas = useCallback(async () => {
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
    setSaving(false);
  }, [projectId, nodes, edges, viewportStorageKey, viewport]);

  useEffect(() => {
    window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      void saveCanvas();
    }, 1200);
    return () => window.clearTimeout(autosaveRef.current);
  }, [nodes, edges, saveCanvas]);

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
    (connection: Edge | Connection) => setEdges((existing) => addEdge({ ...connection, type: "smoothstep" }, existing)),
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
                chainIndex:
                  currentNode.data.type === "mitigative_barrier"
                    ? (mitigativeChainIndexByNodeId[currentNode.id] ?? currentNode.data.chainIndex)
                    : currentNode.data.chainIndex,
              },
              mitigativeColumns,
            ),
            y: change.position.y,
          },
        };
      });
      rawOnNodesChange(locked);
    },
    [mitigativeChainIndexByNodeId, mitigativeColumns, nodes, rawOnNodesChange],
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
        const chainIndex =
          node.data.type === "mitigative_barrier"
            ? (mitigativeChainIndexByNodeId[node.id] ?? node.data.chainIndex)
            : node.data.chainIndex;
        const supportLane =
          node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control"
            ? supportLaneForNode(node, mitigativeColumns)
            : node.data.supportLane;
        const x = laneXForNode(
          node.data.type,
          { ...node.data, chainIndex, supportLane },
          mitigativeColumns,
        );
        if (Math.abs(node.position.x - x) < 0.5 && chainIndex === node.data.chainIndex) {
          return node;
        }
        changed = true;
        return {
          ...node,
          position: { ...node.position, x },
          data: { ...node.data, chainIndex, supportLane },
        };
      });
      return changed ? next : existing;
    });
  }, [mitigativeChainIndexByNodeId, mitigativeColumns, setNodes]);

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      return;
    }
    setEdges((existing) =>
      existing.filter(
        (edge) =>
          !selectedEdgeIds.includes(edge.id) &&
          !selectedNodeIds.includes(edge.source) &&
          !selectedNodeIds.includes(edge.target),
      ),
    );
    setNodes((existing) => existing.filter((node) => !selectedNodeIds.includes(node.id)));
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedId(null);
  }, [selectedNodeIds, selectedEdgeIds, setEdges, setNodes]);

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
  }, [mitigativeChainIndexByNodeId, mitigativeColumns, setEdges, setNodes]);

  const cutSelection = useCallback(() => {
    const didCopy = copySelection();
    if (didCopy) {
      deleteSelected();
    }
  }, [copySelection, deleteSelected]);

  useEffect(() => {
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
  }, [copySelection, cutSelection, pasteSelection, undo, redo, deleteSelected]);

  function addNode(type: NodeType) {
    const meta = NODE_TYPE_META[type];
    const supportLane = supportLaneForNode(selectedNode, mitigativeColumns);
    setNodes((existing) => [
      ...existing,
      {
        id: uuid(),
        type: "bowtieNode",
        position: {
          x: laneXForNode(type, { supportLane }, mitigativeColumns),
          y: 100 + (existing.length % 8) * 70,
        },
        data: {
          type,
          typeLabel: meta.label,
          title: meta.label,
          description: "",
          supportLane:
            type === "escalation_factor" || type === "escalation_factor_control"
              ? supportLane
              : undefined,
        },
      },
    ]);
  }

  function onUpdateNode(nodeId: string, patch: Partial<BowtieNodeData>) {
    setNodes((existing) =>
      existing.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  }

  function inferTypeFromAction(action: string, selectedType: NodeType): NodeType {
    const normalized = action.toLowerCase();
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

  function onInsertSuggestions(
    action: string,
    items: { label: string; nodeType?: NodeType }[],
  ) {
    if (!selectedNode || items.length === 0) return;
    const selectedType = selectedNode.data.type;
    const fallbackType = inferTypeFromAction(action, selectedType);
    const selectedSupportLane = supportLaneForNode(selectedNode, mitigativeColumns);

    const newNodes: Node<BowtieNodeData>[] = items.map((item, index) => {
      const nodeType = item.nodeType ?? fallbackType;
      const supportLane =
        nodeType === "escalation_factor" || nodeType === "escalation_factor_control"
          ? selectedSupportLane
          : undefined;
      const supportAnchorX =
        nodeType === "escalation_factor" || nodeType === "escalation_factor_control"
          ? selectedNode.position.x
          : undefined;
      return {
      id: uuid(),
      type: "bowtieNode",
      position: {
        x: laneXForNode(nodeType, { supportLane, supportAnchorX }, mitigativeColumns),
        y: (selectedNode.position?.y ?? 220) + 80 + index * 95,
      },
      data: {
        type: nodeType,
        typeLabel: NODE_TYPE_META[nodeType].label,
        title: item.label,
        description: "",
        supportLane,
        supportAnchorX,
        chainIndex:
          nodeType === "mitigative_barrier"
            ? (mitigativeChainIndexByNodeId[selectedNode.id] ?? selectedNode.data.chainIndex)
            : undefined,
      },
      };
    });

    const newEdges: Edge[] = newNodes.map((node) =>
      getEdgeForPair(selectedType, node.data.type, node.id, selectedNode.id),
    );

    setNodes((existing) => [...existing, ...newNodes]);
    setEdges((existing) => [...existing, ...newEdges]);
  }

  const quickAddNode = useCallback((parentId: string, side: "left" | "right", childType: NodeType) => {
    const parent = nodes.find((node) => node.id === parentId);
    if (!parent) return;
    if (parent.data.type === "threat" && side === "left") return;
    if (parent.data.type === "consequence" && side === "right") return;

    const siblingsSameType = nodes.filter(
      (node) =>
        node.data.type === childType &&
        Math.abs(node.position.y - parent.position.y) < 240 &&
        (side === "left" ? node.position.x < parent.position.x : node.position.x > parent.position.x),
    ).length;

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
        ? mitigativeChainIndexByNodeId[parent.id] ?? parent.data.chainIndex
        : undefined;

    let x = laneXForNode(childType, { supportLane, supportAnchorX, chainIndex }, mitigativeColumns);
    let y = parent.position.y + (siblingsSameType + 1) * 90;

    const childId = uuid();
    const nextEdges: Edge[] = [];
    const edgesToRemove = new Set<string>();

    if (childType === "mitigative_barrier" && parent.data.type === "consequence" && side === "left") {
      const topEvent = findNearestNodeByType(nodes, "top_event", parent.position.y);
      const chain = getMitigativeChainForConsequence(nodes, edges, parent.id);
      chainIndex = chain.length;
      y = parent.position.y;
      x = laneXForNode("mitigative_barrier", { chainIndex }, Math.max(mitigativeColumns, chain.length + 1));

      const lastInChainId = chain.length > 0 ? chain[chain.length - 1] : topEvent?.id;
      if (lastInChainId) {
        edges
          .filter((edge) => edge.source === lastInChainId && edge.target === parent.id)
          .forEach((edge) => edgesToRemove.add(edge.id));
        nextEdges.push({ id: uuid(), source: lastInChainId, target: childId, type: "smoothstep" });
      }
      nextEdges.push({ id: uuid(), source: childId, target: parent.id, type: "smoothstep" });
    } else if (childType === "preventive_barrier" && parent.data.type === "threat" && side === "right") {
      const topEvent = findNearestNodeByType(nodes, "top_event", parent.position.y);
      nextEdges.push({ id: uuid(), source: parent.id, target: childId, type: "smoothstep" });
      if (topEvent) {
        nextEdges.push({ id: uuid(), source: childId, target: topEvent.id, type: "smoothstep" });
        edges
          .filter((edge) => edge.source === parent.id && edge.target === topEvent.id)
          .forEach((edge) => edgesToRemove.add(edge.id));
      }
    } else {
      nextEdges.push(getEdgeForPair(parent.data.type, childType, childId, parentId));
    }

    const newNode: Node<BowtieNodeData> = {
      id: childId,
      type: "bowtieNode",
      position: { x, y },
      data: {
        type: childType,
        typeLabel: NODE_TYPE_META[childType].label,
        title: NODE_TYPE_META[childType].label,
        description: "",
        supportLane,
        supportAnchorX,
        chainIndex,
      },
    };

    setNodes((existing) => [...existing, newNode]);
    setEdges((existing) => {
      const kept = edgesToRemove.size > 0 ? existing.filter((edge) => !edgesToRemove.has(edge.id)) : existing;
      return [...kept, ...nextEdges];
    });
  }, [edges, mitigativeChainIndexByNodeId, mitigativeColumns, nodes, setEdges, setNodes]);

  const toggleCollapse = useCallback((nodeId: string, side: "left" | "right") => {
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
  }, [setNodes]);

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
        quickAddLeft: quickAddOptionsFor(node.data.type, "left"),
        quickAddRight: quickAddOptionsFor(node.data.type, "right"),
        canCollapseLeft: hasNodeOnSide(node.id, "left"),
        canCollapseRight: hasNodeOnSide(node.id, "right"),
        onQuickAdd: quickAddNode,
        onToggleCollapse: toggleCollapse,
      },
    }));
  }, [
    nodes,
    edges,
    hiddenNodeIds,
    mitigativeChainIndexByNodeId,
    mitigativeColumns,
    quickAddNode,
    toggleCollapse,
  ]);

  const viewEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
      })),
    [edges, hiddenNodeIds],
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
        }
      } catch {
        // Ignore invalid JSON uploads in MVP.
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      <div className="w-64 border-r border-[#9CA3AF] bg-[#E5E7EB] p-3">
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
          <button onClick={saveCanvas} className="w-full rounded bg-[#325D88] px-2 py-1 text-xs text-white">
            {saving ? "Saving..." : "Save Now"}
          </button>
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
      </div>

      <div className="relative flex-1" ref={canvasRef}>
        {viewMode === "canvas" ? (
          <>
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div
                className="absolute"
                style={{
                  left: LANE_START_X,
                  top: LANE_START_Y,
                  width: totalLaneWidth,
                  height: LANE_HEIGHT,
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
                <div className="absolute left-0 top-0 flex h-12 w-full border-b border-zinc-300/70 bg-white/90">
                  {LANE_META.map((lane, index) => (
                    <div
                      key={`${lane.label}-label`}
                      className="flex items-center justify-center px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1F2933]"
                      style={{ width: laneWidths[index] }}
                    >
                      {lane.label}
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
              onNodesChange={onNodesChangeLocked}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              onMove={(_, nextViewport) => setViewport(nextViewport)}
              onInit={(instance: ReactFlowInstance) => initializeViewport(instance)}
              snapToGrid
              snapGrid={[12, 12]}
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

      {viewMode === "canvas" ? (
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
  );
}
