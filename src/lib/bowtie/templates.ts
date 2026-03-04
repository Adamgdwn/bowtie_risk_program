import { Edge, Node } from "reactflow";
import { BowtieNodeData } from "@/lib/types/bowtie";

export interface BowtieTemplate {
  id: string;
  name: string;
  industry: string;
  description: string;
  nodes: Node<BowtieNodeData>[];
  edges: Edge[];
}

export const TEMPLATES: BowtieTemplate[] = [
  {
    id: "general-starter",
    name: "General Starter",
    industry: "General",
    description: "Minimal starter with top event and one placeholder on each side.",
    nodes: [
      {
        id: "top-event",
        type: "bowtieNode",
        position: { x: 500, y: 250 },
        data: { type: "top_event", title: "Top Event", typeLabel: "Top Event", context: "" },
      },
      {
        id: "threat-1",
        type: "bowtieNode",
        position: { x: 120, y: 170 },
        data: { type: "threat", title: "Threat", typeLabel: "Threat", cause: "" },
      },
      {
        id: "consequence-1",
        type: "bowtieNode",
        position: { x: 900, y: 170 },
        data: { type: "consequence", title: "Consequence", typeLabel: "Consequence", impact: "" },
      },
    ],
    edges: [
      { id: "e-threat-top", source: "threat-1", target: "top-event", type: "smoothstep" },
      { id: "e-top-cons", source: "top-event", target: "consequence-1", type: "smoothstep" },
    ],
  },
  {
    id: "oil-gas-starter",
    name: "Oil & Gas Starter",
    industry: "Oil & Gas",
    description: "Starter nodes for loss-of-containment bowtie setup.",
    nodes: [
      {
        id: "top-event-og",
        type: "bowtieNode",
        position: { x: 500, y: 250 },
        data: { type: "top_event", title: "Loss of containment", typeLabel: "Top Event" },
      },
      {
        id: "threat-og-1",
        type: "bowtieNode",
        position: { x: 120, y: 170 },
        data: { type: "threat", title: "Corrosion failure", typeLabel: "Threat" },
      },
      {
        id: "cons-og-1",
        type: "bowtieNode",
        position: { x: 900, y: 170 },
        data: {
          type: "consequence",
          title: "Fire or explosion",
          typeLabel: "Consequence",
          severity: "critical",
        },
      },
    ],
    edges: [
      { id: "e-og-1", source: "threat-og-1", target: "top-event-og", type: "smoothstep" },
      { id: "e-og-2", source: "top-event-og", target: "cons-og-1", type: "smoothstep" },
    ],
  },
];
