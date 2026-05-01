import React from 'react';
import { useGraphStore } from '../store/graphStore';

interface ContextMenuProps {
  onMerge: () => void;
  onUndo: () => void;
}

export function ContextMenu({ onMerge, onUndo }: ContextMenuProps) {
  const { contextMenu, hideContextMenu, selectedNodeIds, selectedNode } = useGraphStore();

  if (!contextMenu) return null;

  const multiSelected = selectedNodeIds.size >= 2;
  const hasNode = !!contextMenu.nodeId || !!selectedNode;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={hideContextMenu} onContextMenu={e => { e.preventDefault(); hideContextMenu(); }} />
      <div
        className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        {hasNode && (
          <button
            onClick={() => { hideContextMenu(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
          >
            View details
          </button>
        )}
        {multiSelected && (
          <button
            onClick={() => { hideContextMenu(); onMerge(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-yellow-400 hover:bg-gray-800 transition-colors"
          >
            Merge {selectedNodeIds.size} nodes
          </button>
        )}
        <button
          onClick={() => { hideContextMenu(); onUndo(); }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Undo last operation
        </button>
      </div>
    </>
  );
}
