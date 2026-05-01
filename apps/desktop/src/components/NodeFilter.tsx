import React, { useState } from 'react';
import { useGraphStore, NODE_COLORS, EDGE_COLORS, ALL_TYPES } from '../store/graphStore';

export function NodeFilter() {
  const { visibleTypes, toggleType, visibleEdgeTypes, toggleEdgeType, nodes, edges, stats, communityLabels, projectPath } = useGraphStore();
  const [editingCommunity, setEditingCommunity] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const countByType = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of nodes) m[n.type] = (m[n.type] ?? 0) + 1;
    return m;
  }, [nodes]);

  const communities = React.useMemo(() => {
    const m: Record<number, number> = {};
    for (const n of nodes) {
      if (n.community !== undefined && n.community >= 0) {
        m[n.community] = (m[n.community] ?? 0) + 1;
      }
    }
    return Object.entries(m)
      .map(([id, size]) => ({ id: Number(id), size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
  }, [nodes]);

  const handleSaveLabel = async (communityId: number) => {
    if (!projectPath || !editLabel.trim()) return;
    const result = await window.datanexus.renameCommunity(projectPath, communityId, editLabel.trim());
    if (result.ok) {
      useGraphStore.getState().setCommunityLabel(communityId, editLabel.trim());
    }
    setEditingCommunity(null);
    setEditLabel('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3 py-2 border-b border-gray-800">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Node types</p>
        <div className="flex flex-col gap-1">
          {ALL_TYPES.map(type => {
            const count = countByType[type] ?? 0;
            if (count === 0) return null;
            return (
              <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleTypes.has(type)}
                  onChange={() => toggleType(type)}
                  className="accent-indigo-500"
                />
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: NODE_COLORS[type] }}
                />
                <span className="text-xs text-gray-300 flex-1">{type}</span>
                <span className="text-xs text-gray-600">{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      {(stats as any).communities > 0 && (
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Communities</p>
          <div className="flex flex-col gap-1">
            {communities.map(({ id, size }) => {
              const label = communityLabels[id] ?? `Community ${id}`;
              const isEditing = editingCommunity === id;
              return (
                <div key={id} className="flex items-center gap-2 text-xs">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveLabel(id);
                          if (e.key === 'Escape') { setEditingCommunity(null); setEditLabel(''); }
                        }}
                        onBlur={() => handleSaveLabel(id)}
                        className="flex-1 px-1 py-0.5 bg-gray-800 border border-gray-600 text-white rounded text-xs"
                        autoFocus
                      />
                    </>
                  ) : (
                    <>
                      <span
                        className="flex-1 text-gray-300 truncate cursor-pointer hover:text-white"
                        onDoubleClick={() => { setEditingCommunity(id); setEditLabel(label); }}
                        title="Double-click to rename"
                      >
                        {label}
                      </span>
                      <span className="text-gray-600">{size}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.edges > 0 && (
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Edge types</p>
          <div className="flex flex-col gap-1">
            {Object.entries(EDGE_COLORS).map(([type, color]) => {
              const count = edges.filter((e: any) => e.type === type).length;
              if (count === 0) return null;
              return (
                <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibleEdgeTypes.has(type)}
                    onChange={() => toggleEdgeType(type)}
                    className="accent-indigo-500"
                  />
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-gray-300 flex-1">{type}</span>
                  <span className="text-xs text-gray-600">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
