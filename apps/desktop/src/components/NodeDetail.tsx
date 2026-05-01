import React, { useMemo } from 'react';
import { useGraphStore, NODE_COLORS, EDGE_COLORS } from '../store/graphStore';

export function NodeDetail() {
  const { selectedNode, communityLabels, edges, nodes, selectNode, focusNode } = useGraphStore();

  const connections = useMemo(() => {
    if (!selectedNode) return { outgoing: [], incoming: [] };
    const out: any[] = [];
    const inc: any[] = [];
    for (const e of edges) {
      if (e.sourceId === selectedNode.id) {
        const target = nodes.find(n => n.id === e.targetId);
        if (target) out.push({ edge: e, node: target, direction: 'out' });
      }
      if (e.targetId === selectedNode.id) {
        const source = nodes.find(n => n.id === e.sourceId);
        if (source) inc.push({ edge: e, node: source, direction: 'in' });
      }
    }
    return { outgoing: out, incoming: inc };
  }, [selectedNode, edges, nodes]);

  if (!selectedNode) return null;

  const color = NODE_COLORS[selectedNode.type] ?? '#6b7280';
  const loc = selectedNode.startLine ? `:${selectedNode.startLine}` : '';
  const communityLabel = selectedNode.community !== undefined && selectedNode.community >= 0
    ? communityLabels[selectedNode.community] ?? `Community ${selectedNode.community}`
    : 'none';

  const handleFocus = () => {
    if (selectedNode) {
      focusNode(selectedNode.id);
    }
  };

  const handleClose = () => {
    selectNode(null);
  };

  const handleConnectionClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      selectNode(node);
      focusNode(nodeId);
    }
  };

  const allConnections = [...connections.outgoing, ...connections.incoming];

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-gray-400 text-xs px-1.5 py-0.5 rounded bg-gray-800">{selectedNode.type}</span>
          <span className="text-gray-100 font-medium text-sm flex-1 truncate">{selectedNode.name}</span>
        </div>
        <p className="text-gray-500 text-xs truncate">{selectedNode.filePath}{loc}</p>
        <div className="flex gap-3 mt-2 text-xs">
          <span className="text-gray-600">confidence: <span className="text-gray-400">{selectedNode.confidence}</span></span>
          <span className="text-gray-600">community: <span className="text-gray-400">{communityLabel}</span></span>
        </div>
      </div>

      {/* Summary */}
      {selectedNode.summary && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Summary</p>
          <p className="text-xs text-gray-300 leading-relaxed">{selectedNode.summary}</p>
        </div>
      )}

      {/* Connections */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
          Connections ({allConnections.length})
        </p>
        {allConnections.length === 0 ? (
          <p className="text-xs text-gray-600">No connections</p>
        ) : (
          <div className="flex flex-col gap-1">
            {connections.outgoing.map((conn, i) => (
              <button
                key={`out-${i}`}
                onClick={() => handleConnectionClick(conn.node.id)}
                className="flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-gray-800 transition-colors group"
              >
                <span className="text-gray-600 text-xs shrink-0">→</span>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: EDGE_COLORS[conn.edge.type] ?? '#6b7280' }}
                />
                <span className="text-gray-500 text-xs shrink-0">{conn.edge.type}</span>
                <span className="text-gray-300 text-xs truncate flex-1 group-hover:text-white">{conn.node.name}</span>
              </button>
            ))}
            {connections.incoming.map((conn, i) => (
              <button
                key={`in-${i}`}
                onClick={() => handleConnectionClick(conn.node.id)}
                className="flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-gray-800 transition-colors group"
              >
                <span className="text-gray-600 text-xs shrink-0">←</span>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: EDGE_COLORS[conn.edge.type] ?? '#6b7280' }}
                />
                <span className="text-gray-500 text-xs shrink-0">{conn.edge.type}</span>
                <span className="text-gray-300 text-xs truncate flex-1 group-hover:text-white">{conn.node.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
        <button
          onClick={handleFocus}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Focus
        </button>
        <button
          onClick={handleClose}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
