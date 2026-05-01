import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceCenter, forceX, forceY } from 'd3-force';
import type { GraphNode } from '@datanexus/core';
import { useGraphStore, NODE_COLORS, NODE_SIZES, EDGE_COLORS, communityColor } from '../store/graphStore';
import { CustomNode } from './CustomNode';

function getLayoutParams(nodeCount: number) {
  if (nodeCount > 5000) return { charge: -80, linkDist: 40, iterations: 100, collide: 8 };
  if (nodeCount > 1000) return { charge: -150, linkDist: 60, iterations: 200, collide: 12 };
  if (nodeCount > 200)  return { charge: -300, linkDist: 80, iterations: 300, collide: 20 };
  return { charge: -500, linkDist: 120, iterations: 300, collide: 25 };
}

function getSizeScale(nodeCount: number) {
  if (nodeCount > 5000) return 0.6;
  if (nodeCount > 1000) return 0.8;
  return 1;
}

// 拓扑计算：仅在图结构变化时重算（昂贵）
function useForceLayout(
  nodes: GraphNode[],
  edges: any[],
  colorByCommunity: boolean
): Map<string, { x: number; y: number }> {
  return useMemo(() => {
    if (nodes.length === 0) return new Map();

    const params = getLayoutParams(nodes.length);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const d3Nodes = nodes.map(n => ({ id: n.id, community: n.community } as any));
    const d3Links = edges
      .filter(e => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId))
      .map(e => ({ source: e.sourceId, target: e.targetId }));

    const sim = forceSimulation(d3Nodes)
      .force('charge', forceManyBody().strength(params.charge))
      .force('link', forceLink(d3Links).id((d: any) => d.id).distance(params.linkDist))
      .force('collide', forceCollide(params.collide))
      .force('center', forceCenter(0, 0));

    if (colorByCommunity) {
      const communities = new Set(nodes.map(n => n.community).filter(c => c !== undefined && c >= 0));
      const centers = new Map<number, { x: number; y: number }>();
      const radius = Math.max(400, Math.sqrt(nodes.length) * 15);
      [...communities].forEach((c, i) => {
        const angle = (i / communities.size) * 2 * Math.PI;
        centers.set(c!, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      });
      sim.force('x', forceX((d: any) => {
        const c = d.community;
        return c !== undefined && c >= 0 ? centers.get(c)?.x ?? 0 : 0;
      }).strength(0.1));
      sim.force('y', forceY((d: any) => {
        const c = d.community;
        return c !== undefined && c >= 0 ? centers.get(c)?.y ?? 0 : 0;
      }).strength(0.1));
    }

    sim.tick(params.iterations);
    sim.stop();

    return new Map(d3Nodes.map((n: any) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
  }, [nodes, edges, colorByCommunity]);
}

// 视觉状态：快速更新样式（便宜）
function toRFNodes(
  nodes: GraphNode[],
  positions: Map<string, { x: number; y: number }>,
  visibleTypes: Set<string>,
  colorByCommunity: boolean,
  sizeScale: number
): Node[] {
  return nodes
    .filter(n => visibleTypes.has(n.type))
    .map(n => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      const color = colorByCommunity && n.community !== undefined && n.community >= 0
        ? communityColor(n.community)
        : (NODE_COLORS[n.type] ?? '#6b7280');
      const baseSize = (NODE_SIZES[n.type] ?? 8) * sizeScale;
      return {
        id: n.id,
        type: 'custom',
        data: { label: n.name, node: n },
        position: pos,
        style: {
          width: baseSize,
          height: baseSize,
        },
      };
    });
}

function toRFEdges(
  graphEdges: any[],
  visibleNodeIds: Set<string>,
  visibleEdgeTypes: Set<string>,
  selectedNodeId: string | null,
  hoveredNodeId: string | null,
  neighborIds: Set<string>,
  searchTerm: string,
  matchedIds: Set<string>
): Edge[] {
  const activeNodeId = selectedNodeId ?? hoveredNodeId;
  const hasActive = !!activeNodeId || searchTerm.length > 0;

  return graphEdges
    .filter(e => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId) && visibleEdgeTypes.has(e.type))
    .map(e => {
      const isConnected = activeNodeId && (e.sourceId === activeNodeId || e.targetId === activeNodeId);
      const isSearchEdge = searchTerm.length > 0 && matchedIds.has(e.sourceId) && matchedIds.has(e.targetId);
      const isDimmed = hasActive && !isConnected && !isSearchEdge;

      return {
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        style: {
          stroke: isSearchEdge ? '#06b6d4' : (EDGE_COLORS[e.type] ?? '#6b7280'),
          strokeWidth: isConnected ? 2.5 : isDimmed ? 0.5 : 1.5,
          opacity: isConnected ? 0.8 : isDimmed ? 0.08 : 0.6,
        },
        type: 'smoothstep',
        animated: isConnected,
      };
    });
}

const nodeTypes = { custom: CustomNode };

function GraphCanvasInner() {
  const {
    nodes: graphNodes, edges: graphEdges, matchedIds, visibleTypes, visibleEdgeTypes, searchTerm,
    selectNode, selectedNode, selectedNodeIds, toggleNodeSelection, colorByCommunity,
    hoveredNodeId, neighborIds, setHoveredNode, focusNodeId, clearFocus,
    showContextMenu,
  } = useGraphStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const prevFocusRef = useRef<string | null>(null);

  const positions = useForceLayout(graphNodes, graphEdges, colorByCommunity);
  const sizeScale = useMemo(() => getSizeScale(graphNodes.length), [graphNodes.length]);

  // 拓扑变化 → 重建节点位置
  useEffect(() => {
    const rfNodes = toRFNodes(graphNodes, positions, visibleTypes, colorByCommunity, sizeScale);
    setNodes(rfNodes);
  }, [graphNodes, positions, visibleTypes, colorByCommunity, sizeScale, setNodes]);

  // 视觉状态变化 → 更新边样式
  useEffect(() => {
    const visibleIds = new Set(nodes.map(n => n.id));
    setEdges(toRFEdges(
      graphEdges, visibleIds, visibleEdgeTypes,
      selectedNode?.id ?? null, hoveredNodeId, neighborIds,
      searchTerm, matchedIds
    ));
  }, [graphEdges, nodes, visibleEdgeTypes, selectedNode, hoveredNodeId, neighborIds, searchTerm, matchedIds, setEdges]);

  // focusNode → 相机动画聚焦
  useEffect(() => {
    if (focusNodeId && focusNodeId !== prevFocusRef.current) {
      prevFocusRef.current = focusNodeId;
      const targetNode = nodes.find(n => n.id === focusNodeId);
      if (targetNode) {
        fitView({ nodes: [targetNode], duration: 400, padding: 0.3, maxZoom: 1.5 });
      }
      clearFocus();
    }
  }, [focusNodeId, nodes, fitView, clearFocus]);

  // 搜索匹配 → 自动聚焦到匹配节点
  useEffect(() => {
    if (searchTerm.length > 0 && matchedIds.size > 0 && matchedIds.size <= 50) {
      const matchedNodes = nodes.filter(n => matchedIds.has(n.id));
      if (matchedNodes.length > 0) {
        fitView({ nodes: matchedNodes, duration: 400, padding: 0.3, maxZoom: 1.2 });
      }
    }
  }, [searchTerm, matchedIds, nodes, fitView]);

  const onNodeClick: NodeMouseHandler = useCallback((evt, node) => {
    const gn = (node.data as any).node as GraphNode;
    if (evt.shiftKey) {
      toggleNodeSelection(node.id);
    } else {
      selectNode(gn);
    }
  }, [selectNode, toggleNodeSelection]);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_evt, node) => {
    setHoveredNode(node.id);
  }, [setHoveredNode]);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const onNodeContextMenu: NodeMouseHandler = useCallback((evt, node) => {
    evt.preventDefault();
    showContextMenu(evt.clientX, evt.clientY, node.id);
  }, [showContextMenu]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onNodeContextMenu={onNodeContextMenu}
      onPaneClick={onPaneClick}
      fitView
      minZoom={0.02}
      maxZoom={2}
      nodesDraggable
      style={{ background: '#0a0a0a' }}
    >
      <Background color="#1f2937" gap={24} />
      <Controls style={{ background: '#111827', border: '1px solid #374151' }} />
      <MiniMap
        nodeColor={n => {
          const node = (n.data as any)?.node as GraphNode | undefined;
          if (!node) return '#6b7280';
          if (colorByCommunity && node.community !== undefined && node.community >= 0) {
            return communityColor(node.community);
          }
          return NODE_COLORS[node.type] ?? '#6b7280';
        }}
        style={{ background: '#111827' }}
      />
    </ReactFlow>
  );
}

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}