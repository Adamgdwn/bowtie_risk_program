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
const LANE_COUNT = 5;
const LANE_START_X = 0;
const LANE_START_Y = -120;
const LANE_HEIGHT = 2200;
const DEFAULT_NODE_WIDTH = 208;

const LANE_META: Array<{ label: string; className: string }> = [
  { label: "Threats", className: "border-r border-cyan-200/70 bg-cyan-100/30" },
  { label: "Preventive Barriers", className: "border-r border-amber-200/70 bg-amber-100/25" },
  { label: "Top Event", className: "border-r border-orange-200/70 bg-orange-100/25" },
  { label: "Mitigative Barriers", className: "border-r border-sky-200/70 bg-sky-100/25" },
  { label: "Consequences", className: "bg-indigo-100/25" },
];

function laneXForType(type: NodeType) {
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
            : 4;
  return LANE_START_X + laneIndex * LANE_WIDTH + (LANE_WIDTH - DEFAULT_NODE_WIDTH) / 2;
}

function supportLaneForNode(node: Node<BowtieNodeData> | null | undefined): "preventive" | "mitigative" {
  if (!node) return "preventive";
  if (node.data.type === "mitigative_barrier") return "mitigative";
  if (node.data.type === "preventive_barrier") return "preventive";
  if (node.data.supportLane) return node.data.supportLane;
  if (node.data.type === "escalation_factor" || node.data.type === "escalation_factor_control") {
    const laneThreeX = LANE_START_X + 3 * LANE_WIDTH;
    return node.position.x >= laneThreeX ? "mitigative" : "preventive";
  }
  return "preventive";
}

function laneXForNode(type: NodeType, data?: Partial<BowtieNodeData>) {
  if (type === "escalation_factor" || type === "escalation_factor_control") {
    const supportLane = data?.supportLane ?? "preventive";
    const laneIndex = supportLane === "mitigative" ? 3 : 1;
    return LANE_START_X + laneIndex * LANE_WIDTH + (LANE_WIDTH - DEFAULT_NODE_WIDTH) / 2;
  }
  return laneXForType(type);
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  const [nodes, setNodes, rawOnNodesChange] = useNodesState(initialNodes);
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const autosaveRef = useRef<number | undefined>(undefined);
  const isApplyingHistoryRef = useRef(false);
  const historyRef = useRef<{
    past: EditorSnapshot[];
    future: EditorSnapshot[];
    lastHash: string;
  }>({
    past: [cloneSnapshot({ nodes: initialNodes, edges: initialEdges })],
    future: [],
    lastHash: JSON.stringify({ nodes: initialNodes, edges: initialEdges }),
  });
  const clipboardRef = useRef<ClipboardSnapshot | null>(null);
  const pasteCountRef = useRef(0);

  const selectedNode = useMemo<Node<BowtieNodeData> | null>(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const warnings = useMemo(
    () => validateBowtie(nodes, edges).map((item) => item.message),
    [nodes, edges],
  );

  const saveCanvas = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes, edges }),
    });
    setSaving(false);
  }, [projectId, nodes, edges]);

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
            x: laneXForNode(currentNode.data.type, currentNode.data),
            y: change.position.y,
          },
        };
      });
      rawOnNodesChange(locked);
    },
    [nodes, rawOnNodesChange],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const nodeIds = (params.nodes ?? []).map((node) => node.id);
    const edgeIds = (params.edges ?? []).map((edge) => edge.id);
    setSelectedNodeIds(nodeIds);
    setSelectedEdgeIds(edgeIds);
    setSelectedId(nodeIds[0] ?? null);
  }, []);

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
        x: laneXForNode(node.data.type, node.data),
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
  }, [setEdges, setNodes]);

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
    const supportLane = supportLaneForNode(selectedNode);
    setNodes((existing) => [
      ...existing,
      {
        id: uuid(),
        type: "bowtieNode",
        position: {
          x: laneXForNode(type, { supportLane }),
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
    const selectedSupportLane = supportLaneForNode(selectedNode);

    const newNodes: Node<BowtieNodeData>[] = items.map((item, index) => {
      const nodeType = item.nodeType ?? fallbackType;
      const supportLane =
        nodeType === "escalation_factor" || nodeType === "escalation_factor_control"
          ? selectedSupportLane
          : undefined;
      return {
      id: uuid(),
      type: "bowtieNode",
      position: {
        x: laneXForNode(nodeType, { supportLane }),
        y: (selectedNode.position?.y ?? 220) + 80 + index * 95,
      },
      data: {
        type: nodeType,
        typeLabel: NODE_TYPE_META[nodeType].label,
        title: item.label,
        description: "",
        supportLane,
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
        ? supportLaneForNode(parent)
        : undefined;

    const x = laneXForNode(childType, { supportLane });
    const y = parent.position.y + (siblingsSameType + 1) * 90;

    const childId = uuid();
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
      },
    };

    const nextEdges: Edge[] = [];
    const edgesToRemove = new Set<string>();

    if (childType === "mitigative_barrier" && parent.data.type === "consequence" && side === "left") {
      const topEvent = findNearestNodeByType(nodes, "top_event", parent.position.y);
      if (topEvent) {
        nextEdges.push({ id: uuid(), source: topEvent.id, target: childId, type: "smoothstep" });
        edges
          .filter((edge) => edge.source === topEvent.id && edge.target === parent.id)
          .forEach((edge) => edgesToRemove.add(edge.id));
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

    setNodes((existing) => [...existing, newNode]);
    setEdges((existing) => {
      const kept = edgesToRemove.size > 0 ? existing.filter((edge) => !edgesToRemove.has(edge.id)) : existing;
      return [...kept, ...nextEdges];
    });
  }, [edges, nodes, setEdges, setNodes]);

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
            ? supportLaneForNode(node)
            : node.data.supportLane,
        quickAddLeft: quickAddOptionsFor(node.data.type, "left"),
        quickAddRight: quickAddOptionsFor(node.data.type, "right"),
        canCollapseLeft: hasNodeOnSide(node.id, "left"),
        canCollapseRight: hasNodeOnSide(node.id, "right"),
        onQuickAdd: quickAddNode,
        onToggleCollapse: toggleCollapse,
      },
    }));
  }, [nodes, edges, hiddenNodeIds, quickAddNode, toggleCollapse]);

  const viewEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
      })),
    [edges, hiddenNodeIds],
  );

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

  async function exportPng() {
    if (!canvasRef.current) return;
    const png = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = png;
    a.download = `${projectMeta.title.replace(/\s+/g, "_").toLowerCase()}_bowtie.png`;
    a.click();
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
      <div className="w-64 border-r border-zinc-200 bg-zinc-50 p-3">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded border border-zinc-300 bg-white p-1">
          <button
            onClick={() => setViewMode("canvas")}
            className={`rounded px-2 py-1 text-xs font-semibold ${
              viewMode === "canvas" ? "bg-zinc-900 text-white" : "text-zinc-700"
            }`}
          >
            Canvas
          </button>
          <button
            onClick={() => setViewMode("worksheet")}
            className={`rounded px-2 py-1 text-xs font-semibold ${
              viewMode === "worksheet" ? "bg-zinc-900 text-white" : "text-zinc-700"
            }`}
          >
            Worksheet
          </button>
        </div>

        <h3 className="text-sm font-semibold text-zinc-900">Palette</h3>
        <div className="mt-2 grid gap-2">
          {Object.entries(NODE_TYPE_META).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => addNode(type as keyof typeof NODE_TYPE_META)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-left text-xs"
            >
              + {meta.label}
            </button>
          ))}
        </div>

        <h4 className="mt-4 text-xs font-semibold uppercase text-zinc-600">Quick Add</h4>
        <div className="mt-1 space-y-1">
          <button className="w-full rounded bg-red-100 px-2 py-1 text-xs" onClick={() => addNode("threat")}>
            + Threat
          </button>
          <button className="w-full rounded bg-indigo-100 px-2 py-1 text-xs" onClick={() => addNode("consequence")}>
            + Consequence
          </button>
          <button
            className="w-full rounded bg-amber-100 px-2 py-1 text-xs"
            onClick={() => addNode("preventive_barrier")}
          >
            + Barrier
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button onClick={saveCanvas} className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-white">
            {saving ? "Saving..." : "Save Now"}
          </button>
          <button
            onClick={deleteSelected}
            disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0}
            className="w-full rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
          >
            Delete Selected
          </button>
          <button onClick={exportPng} className="w-full rounded border border-zinc-300 px-2 py-1 text-xs">
            Export PNG
          </button>
          <button onClick={exportJson} className="w-full rounded border border-zinc-300 px-2 py-1 text-xs">
            Export JSON
          </button>
          <label className="block cursor-pointer rounded border border-zinc-300 px-2 py-1 text-center text-xs">
            Import JSON
            <input type="file" accept="application/json" onChange={importJson} className="hidden" />
          </label>
        </div>

        {warnings.length > 0 ? (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
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
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              <div
                className="absolute"
                style={{
                  left: LANE_START_X,
                  top: LANE_START_Y,
                  width: LANE_WIDTH * LANE_COUNT,
                  height: LANE_HEIGHT,
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                  transformOrigin: "top left",
                }}
              >
                <div className="absolute inset-0 flex">
                  {LANE_META.map((lane) => (
                    <div key={lane.label} className={`h-full w-[250px] ${lane.className}`} />
                  ))}
                </div>
                <div className="absolute left-0 top-0 flex h-12 w-full border-b border-zinc-300/70 bg-white/90">
                  {LANE_META.map((lane) => (
                    <div
                      key={`${lane.label}-label`}
                      className="flex w-[250px] items-center justify-center px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-700"
                    >
                      {lane.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <ReactFlow
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
              onInit={(instance: ReactFlowInstance) => setViewport(instance.getViewport())}
              fitView
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
        <aside className="w-80 border-l border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <h3 className="font-semibold text-zinc-900">Worksheet Guidance</h3>
          <p className="mt-1 text-xs font-semibold text-zinc-700">{worksheetStepTitle}</p>
          {worksheetGuidanceLoading ? (
            <p className="mt-3 text-xs text-zinc-600">Generating LLM facilitation prompts...</p>
          ) : null}
          {worksheetGuidanceError ? (
            <p className="mt-3 text-xs text-red-700">{worksheetGuidanceError}</p>
          ) : null}
          {worksheetGuidance ? (
            <div className="mt-3 space-y-3">
              <div className="rounded border border-zinc-200 bg-white p-2">
                <p className="text-xs font-semibold text-zinc-900">{worksheetGuidance.headline}</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Source: {worksheetGuidance.source.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800">Discussion Prompts</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-zinc-700">
                  {worksheetGuidance.discussionPrompts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800">Quality Checks</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-zinc-700">
                  {worksheetGuidance.qualityChecks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800">Suggested Next Actions</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-zinc-700">
                  {worksheetGuidance.nextActions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-600">
              Click into a step&apos;s notes box to generate interactive LLM workshop guidance.
            </p>
          )}
        </aside>
      )}
    </div>
  );
}
