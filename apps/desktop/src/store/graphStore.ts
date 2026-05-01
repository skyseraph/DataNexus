import { create } from 'zustand';
import type { GraphNode } from '@datanexus/core';

export type NodeType = GraphNode['type'];

export const NODE_SIZES: Record<string, number> = {
  domain: 18, flow: 16, module: 14, file: 10,
  class: 12, document: 10, function: 6, section: 6,
  concept: 8, entity: 8,
};

export const NODE_COLORS: Record<string, string> = {
  file:     '#6366f1',
  function: '#22c55e',
  class:    '#f59e0b',
  module:   '#8b5cf6',
  document: '#3b82f6',
  section:  '#06b6d4',
  concept:  '#ec4899',
  entity:   '#f97316',
  domain:   '#ef4444',
  flow:     '#a855f7',
};

export const EDGE_COLORS: Record<string, string> = {
  imports: '#1d4ed8',
  contains: '#2d5a3d',
  calls: '#7c3aed',
  inherits: '#c2410c',
  implements: '#be185d',
  references: '#0e7490',
  related: '#6366f1',
  documents: '#3b82f6',
  defines: '#06b6d4',
  cites: '#8b5cf6',
  contradicts: '#ef4444',
  builds_on: '#f59e0b',
};

// Distinct colors for community visualization
const COMMUNITY_PALETTE = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6',
  '#06b6d4', '#a855f7', '#f97316', '#ef4444', '#84cc16',
  '#14b8a6', '#f43f5e', '#8b5cf6', '#0ea5e9', '#d97706',
];

export function communityColor(communityId: number): string {
  return COMMUNITY_PALETTE[communityId % COMMUNITY_PALETTE.length];
}

export const ALL_TYPES = Object.keys(NODE_COLORS) as NodeType[];

function getNeighborIds(nodeId: string | null, edges: any[]): Set<string> {
  if (!nodeId) return new Set();
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.sourceId === nodeId) ids.add(e.targetId);
    if (e.targetId === nodeId) ids.add(e.sourceId);
  }
  return ids;
}

interface GraphStore {
  projectPath: string | null;
  nodes: GraphNode[];
  edges: any[];
  stats: { nodes: number; edges: number; communities?: number };
  searchTerm: string;
  matchedIds: Set<string>;
  visibleTypes: Set<string>;
  visibleEdgeTypes: Set<string>;
  selectedNode: GraphNode | null;
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  neighborIds: Set<string>;
  focusNodeId: string | null;
  colorByCommunity: boolean;
  communityLabels: Record<number, string>;
  contextMenu: { x: number; y: number; nodeId?: string } | null;
  error: string | null;

  setProject: (path: string) => void;
  setNodes: (nodes: GraphNode[], stats: { nodes: number; edges: number; communities?: number }) => void;
  setEdges: (edges: any[]) => void;
  setSearch: (term: string) => void;
  toggleType: (type: string) => void;
  toggleEdgeType: (type: string) => void;
  selectNode: (node: GraphNode | null) => void;
  toggleNodeSelection: (nodeId: string) => void;
  clearSelection: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string) => void;
  clearFocus: () => void;
  setColorByCommunity: (val: boolean) => void;
  setCommunityLabels: (labels: Record<number, string>) => void;
  setCommunityLabel: (communityId: number, label: string) => void;
  showContextMenu: (x: number, y: number, nodeId?: string) => void;
  hideContextMenu: () => void;
  setError: (msg: string | null) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  projectPath: null,
  nodes: [],
  edges: [],
  stats: { nodes: 0, edges: 0 },
  searchTerm: '',
  matchedIds: new Set(),
  visibleTypes: new Set(ALL_TYPES),
  visibleEdgeTypes: new Set(Object.keys(EDGE_COLORS)),
  selectedNode: null,
  selectedNodeIds: new Set(),
  hoveredNodeId: null,
  neighborIds: new Set(),
  focusNodeId: null,
  colorByCommunity: false,
  communityLabels: {},
  contextMenu: null,
  error: null,

  setProject: (path) => set({ projectPath: path, error: null }),

  setNodes: (nodes, stats) => {
    const { searchTerm } = get();
    const matchedIds = searchTerm
      ? new Set(nodes.filter(n =>
          n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.summary?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map(n => n.id))
      : new Set<string>();
    set({ nodes, stats, matchedIds });
  },

  setEdges: (edges) => set({ edges }),

  setSearch: (term) => {
    const { nodes } = get();
    const matchedIds = term
      ? new Set(nodes.filter(n =>
          n.name.toLowerCase().includes(term.toLowerCase()) ||
          n.summary?.toLowerCase().includes(term.toLowerCase())
        ).map(n => n.id))
      : new Set<string>();
    set({ searchTerm: term, matchedIds });
  },

  toggleType: (type) => {
    const next = new Set(get().visibleTypes);
    next.has(type) ? next.delete(type) : next.add(type);
    set({ visibleTypes: next });
  },

  toggleEdgeType: (type) => {
    const next = new Set(get().visibleEdgeTypes);
    next.has(type) ? next.delete(type) : next.add(type);
    set({ visibleEdgeTypes: next });
  },

  selectNode: (node) => {
    const { edges } = get();
    const neighborIds = node ? getNeighborIds(node.id, edges) : new Set<string>();
    set({ selectedNode: node, neighborIds });
  },

  toggleNodeSelection: (nodeId) => {
    const next = new Set(get().selectedNodeIds);
    next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
    set({ selectedNodeIds: next });
  },

  clearSelection: () => set({ selectedNodeIds: new Set(), selectedNode: null, neighborIds: new Set() }),

  setHoveredNode: (nodeId) => {
    const { edges } = get();
    const neighborIds = nodeId ? getNeighborIds(nodeId, edges) : new Set<string>();
    set({ hoveredNodeId: nodeId, neighborIds });
  },

  focusNode: (nodeId) => set({ focusNodeId: nodeId }),

  clearFocus: () => set({ focusNodeId: null }),

  setColorByCommunity: (val) => set({ colorByCommunity: val }),

  setCommunityLabels: (labels) => set({ communityLabels: labels }),

  setCommunityLabel: (communityId, label) => {
    const next = { ...get().communityLabels, [communityId]: label };
    set({ communityLabels: next });
  },

  showContextMenu: (x, y, nodeId) => set({ contextMenu: { x, y, nodeId } }),

  hideContextMenu: () => set({ contextMenu: null }),

  setError: (msg) => set({ error: msg }),
}));
