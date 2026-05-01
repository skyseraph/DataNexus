import React, { useCallback, useState, useEffect } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { SearchBar } from './components/SearchBar';
import { NodeFilter } from './components/NodeFilter';
import { NodeDetail } from './components/NodeDetail';
import { ContextMenu } from './components/ContextMenu';
import { useGraphStore } from './store/graphStore';

declare global {
  interface Window {
    datanexus: {
      openProject: () => Promise<string | null>;
      loadGraph: (path: string) => Promise<{ ok: boolean; nodes: any[]; edges: any[]; stats: any; error?: string }>;
      indexProject: (path: string) => Promise<{ ok: boolean; nodes: any[]; edges: any[]; stats: any; indexed: number; deleted: number; error?: string }>;
      searchNodes: (path: string, term: string) => Promise<{ ok: boolean; nodes: any[]; error?: string }>;
      clusterProject: (path: string) => Promise<{ ok: boolean; result: any; nodes: any[]; edges: any[]; stats: any; error?: string }>;
      mergeNodes: (path: string, nodeIds: string[], newName: string, newType: string) => Promise<{ ok: boolean; merged: any; nodes: any[]; edges: any[]; stats: any; error?: string }>;
      undoOperation: (path: string) => Promise<{ ok: boolean; message: string; nodes: any[]; edges: any[]; stats: any; error?: string }>;
      renameCommunity: (path: string, communityId: number, label: string) => Promise<{ ok: boolean; error?: string }>;
      loadCommunityLabels: (path: string) => Promise<{ ok: boolean; labels: Record<number, string>; error?: string }>;
    };
  }
}

export default function App() {
  const {
    projectPath, stats, error, nodes,
    setProject, setNodes, setEdges, setError,
    selectedNodeIds, clearSelection,
    colorByCommunity, setColorByCommunity,
    setCommunityLabels,
  } = useGraphStore();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');

  useEffect(() => {
    if (projectPath) {
      window.datanexus.loadCommunityLabels(projectPath).then(res => {
        if (res.ok) setCommunityLabels(res.labels);
      });
    }
  }, [projectPath, setCommunityLabels]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectPath]);

  const loadGraph = useCallback(async (p: string) => {
    setLoadingMsg('Loading graph...');
    setLoading(true);
    setError(null);
    const result = await window.datanexus.loadGraph(p);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to load graph');
      return false;
    }
    setNodes(result.nodes, result.stats);
    setEdges(result.edges);
    return true;
  }, [setNodes, setEdges, setError]);

  const handleOpen = useCallback(async () => {
    const p = await window.datanexus.openProject();
    if (!p) return;
    setProject(p);
    await loadGraph(p);
  }, [setProject, loadGraph]);

  const handleIndex = useCallback(async () => {
    if (!projectPath) return;
    setLoadingMsg('Indexing project...');
    setLoading(true);
    setError(null);
    const result = await window.datanexus.indexProject(projectPath);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Index failed');
      return;
    }
    setNodes(result.nodes, result.stats);
    setEdges(result.edges);
  }, [projectPath, setNodes, setEdges, setError]);

  const handleCluster = useCallback(async () => {
    if (!projectPath) return;
    setLoadingMsg('Clustering...');
    setLoading(true);
    setError(null);
    const result = await window.datanexus.clusterProject(projectPath);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Clustering failed');
      return;
    }
    setNodes(result.nodes, result.stats);
    setEdges(result.edges);
    setColorByCommunity(true);
  }, [projectPath, setNodes, setEdges, setError, setColorByCommunity]);

  const handleMerge = useCallback(async () => {
    if (selectedNodeIds.size < 2 || !mergeName.trim() || !projectPath) return;
    setError(null);
    const firstNode = nodes.find(n => n.id === [...selectedNodeIds][0]);
    const newType = firstNode?.type ?? 'function';
    const result = await window.datanexus.mergeNodes(
      projectPath,
      [...selectedNodeIds],
      mergeName.trim(),
      newType
    );
    if (!result.ok) {
      setError(result.error ?? 'Merge failed');
    } else {
      setNodes(result.nodes, result.stats);
      setEdges(result.edges);
    }
    clearSelection();
    setMergeModalOpen(false);
    setMergeName('');
  }, [selectedNodeIds, mergeName, projectPath, nodes, setNodes, setEdges, setError, clearSelection]);

  const handleUndo = useCallback(async () => {
    if (!projectPath) return;
    setError(null);
    const result = await window.datanexus.undoOperation(projectPath);
    if (!result.ok) {
      setError(result.error ?? 'Undo failed');
    } else {
      setNodes(result.nodes, result.stats);
      setEdges(result.edges);
      if (result.message === 'Nothing to undo.') {
        setError('Nothing to undo');
      }
    }
  }, [projectPath, setNodes, setEdges, setError]);

  const isEmpty = projectPath && stats.nodes === 0 && !loading;
  const selectedCount = selectedNodeIds.size;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-200">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950">
        <span className="text-sm font-semibold text-indigo-400 tracking-wide">DataNexus</span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {projectPath && (
            <span className="text-xs text-gray-500 truncate max-w-xs">{projectPath}</span>
          )}
          {stats.nodes > 0 && (
            <span className="text-xs text-gray-600">
              {stats.nodes} nodes · {stats.edges} edges
              {(stats as any).communities > 0 ? ` · ${(stats as any).communities} communities` : ''}
            </span>
          )}
          {stats.nodes > 0 && (
            <button
              onClick={() => setColorByCommunity(!colorByCommunity)}
              className={`text-xs px-2 py-1 rounded transition-colors ${colorByCommunity ? 'bg-indigo-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              title="Toggle community coloring"
            >
              Communities
            </button>
          )}
          {selectedCount >= 2 && (
            <button
              onClick={() => setMergeModalOpen(true)}
              className="text-xs px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white transition-colors"
            >
              Merge {selectedCount} nodes
            </button>
          )}
          {selectedCount > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Clear selection
            </button>
          )}
          {projectPath && (
            <>
              <button
                onClick={handleCluster}
                disabled={loading || stats.nodes === 0}
                className="text-xs px-3 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors disabled:opacity-40"
              >
                {loading && loadingMsg === 'Clustering...' ? 'Clustering...' : 'Cluster'}
              </button>
              <button
                onClick={handleIndex}
                disabled={loading}
                className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-40"
              >
                {loading && loadingMsg !== 'Clustering...' ? loadingMsg : 'Re-index'}
              </button>
            </>
          )}
          <button
            onClick={handleOpen}
            disabled={loading}
            className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
          >
            Open Project
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-950 border-b border-red-800 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Shift-click hint when some nodes selected */}
      {selectedCount > 0 && (
        <div className="px-4 py-1 bg-yellow-950 border-b border-yellow-800 text-yellow-300 text-xs">
          {selectedCount} node{selectedCount > 1 ? 's' : ''} selected (Shift+click to add/remove)
          {selectedCount >= 2 ? ' — click "Merge" to combine into one node' : ''}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 flex flex-col border-r border-gray-800 bg-gray-950 overflow-y-auto shrink-0">
          <SearchBar />
          <NodeFilter />
        </div>

        {/* Main canvas + detail */}
        <div className="flex flex-1 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              <div className="text-center">
                <div className="mb-2 text-indigo-400 animate-pulse">{loadingMsg}</div>
              </div>
            </div>
          ) : projectPath && stats.nodes > 0 ? (
            <div className="flex-1 overflow-hidden">
              <GraphCanvas />
            </div>
          ) : isEmpty ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-gray-500 text-sm">No index found for this project.</p>
                <button
                  onClick={handleIndex}
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
                >
                  Index Now
                </button>
                <p className="text-gray-600 text-xs">or run: <code className="font-mono text-gray-400">datanexus index &lt;path&gt;</code></p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Open a project to get started.
            </div>
          )}
          <NodeDetail />
        </div>
      </div>

      {/* Context menu */}
      <ContextMenu onMerge={() => setMergeModalOpen(true)} onUndo={handleUndo} />

      {/* Merge dialog */}
      {mergeModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Merge {selectedCount} nodes</h3>
            <p className="text-xs text-gray-400 mb-3">
              Selected: {[...selectedNodeIds].map(id => {
                const n = nodes.find(x => x.id === id);
                return n?.name ?? id;
              }).join(', ')}
            </p>
            <input
              type="text"
              value={mergeName}
              onChange={e => setMergeName(e.target.value)}
              placeholder="New node name"
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-sm mb-4 focus:outline-none focus:border-indigo-500"
              onKeyDown={e => e.key === 'Enter' && handleMerge()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setMergeModalOpen(false); setMergeName(''); }}
                className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={!mergeName.trim()}
                className="text-xs px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white transition-colors disabled:opacity-40"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
