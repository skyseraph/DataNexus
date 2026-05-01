import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GraphNode } from '@datanexus/core';
import { useGraphStore, NODE_COLORS, NODE_SIZES, communityColor } from '../store/graphStore';

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export const CustomNode = memo(({ data, id }: NodeProps) => {
  const node = (data as any).node as GraphNode;
  const [hovered, setHovered] = useState(false);

  const {
    selectedNode, selectedNodeIds, hoveredNodeId, neighborIds,
    searchTerm, matchedIds, colorByCommunity,
  } = useGraphStore();

  const activeNodeId = selectedNode?.id ?? hoveredNodeId;
  const hasActive = !!activeNodeId || searchTerm.length > 0;
  const isSelected = selectedNodeIds.has(id) || selectedNode?.id === id;
  const isNeighbor = neighborIds.has(id);
  const isSearchMatch = searchTerm.length > 0 && matchedIds.has(id);
  const isDimmed = hasActive && !isSelected && !isNeighbor && !isSearchMatch;

  const color = colorByCommunity && node.community !== undefined && node.community >= 0
    ? communityColor(node.community)
    : (NODE_COLORS[node.type] ?? '#6b7280');

  const baseSize = NODE_SIZES[node.type] ?? 8;
  const sizeScale = isDimmed ? 0.6 : isSelected ? 1.4 : 1;
  const size = Math.round(baseSize * sizeScale);

  const loc = node.startLine ? `:${node.startLine}` : '';

  return (
    <div
      className="relative flex items-center gap-1.5"
      style={{ opacity: isDimmed ? 0.2 : 1, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />

      <div
        className={`rounded-full shrink-0 ${isSelected ? 'node-glow' : ''} ${isSearchMatch && !isSelected ? 'node-pulse' : ''}`}
        style={{
          width: size,
          height: size,
          background: color,
          border: isSelected ? '2px solid white' : isSearchMatch ? `2px solid #06b6d4` : 'none',
          boxShadow: isSelected ? `0 0 8px ${color}` : 'none',
          transition: 'width 0.15s, height 0.15s, opacity 0.15s',
        }}
      />

      {!isDimmed && (
        <span
          className="text-gray-300 whitespace-nowrap pointer-events-none"
          style={{ fontSize: 10, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {truncate(node.name, 20)}
        </span>
      )}

      {hovered && (
        <div
          className="absolute left-0 bottom-full mb-1 z-50 px-2 py-1.5 rounded-md border pointer-events-none"
          style={{ background: '#12121c', borderColor: color, minWidth: 160, maxWidth: 280 }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: color }} />
            <span className="text-xs font-medium text-gray-100">{truncate(node.name, 30)}</span>
          </div>
          <div className="text-gray-500" style={{ fontSize: 9 }}>[{node.type}]</div>
          <div className="text-gray-400 truncate" style={{ fontSize: 9 }}>{node.filePath}{loc}</div>
          {node.summary && (
            <div className="text-gray-500 mt-1 line-clamp-2" style={{ fontSize: 9 }}>{node.summary}</div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  );
});
