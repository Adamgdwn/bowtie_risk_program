import { Edge, Node } from "reactflow";
import { BowtieNodeData, StoredEdgeRow, StoredNodeRow } from "@/lib/types/bowtie";

export function dbNodesToFlow(nodes: StoredNodeRow[]): Node<BowtieNodeData>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "bowtieNode",
    position: { x: node.position_x, y: node.position_y },
    data: node.data,
  }));
}

export function dbEdgesToFlow(edges: StoredEdgeRow[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    type: edge.type ?? "smoothstep",
    data: edge.data ?? {},
  }));
}
