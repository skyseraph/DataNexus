import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGraphStore, NODE_COLORS } from '../store/graphStore';

export function SearchBar() {
  const { searchTerm, setSearch, matchedIds, nodes, selectNode, focusNode } = useGraphStore();
  const [inputValue, setInputValue] = useState(searchTerm);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((value: string) => {
    setInputValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 150);
  }, [setSearch]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const matchedNodes = useMemo(() => {
    if (!searchTerm) return [];
    return nodes.filter(n => matchedIds.has(n.id)).slice(0, 20);
  }, [searchTerm, matchedIds, nodes]);

  const handleSelect = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      selectNode(node);
      focusNode(nodeId);
    }
    setShowDropdown(false);
  }, [nodes, selectNode, focusNode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && matchedNodes.length > 0) {
      handleSelect(matchedNodes[0].id);
    }
    if (e.key === 'Escape') {
      setInputValue('');
      setSearch('');
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  }, [matchedNodes, handleSelect, setSearch]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => { handleChange(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search nodes..."
          className="flex-1 bg-transparent text-gray-200 text-sm outline-none placeholder-gray-600"
        />
        {searchTerm.length > 0 && (
          <span className="text-xs text-gray-500 shrink-0">{matchedIds.size}</span>
        )}
        {inputValue.length > 0 && (
          <button
            onClick={() => { setInputValue(''); setSearch(''); setShowDropdown(false); }}
            className="text-gray-500 hover:text-gray-300 text-xs"
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && matchedNodes.length > 0 && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
          <div className="absolute left-0 right-0 top-full z-40 bg-gray-900 border border-gray-700 rounded-b-lg shadow-xl max-h-64 overflow-y-auto">
            {matchedNodes.map(node => {
              const color = NODE_COLORS[node.type] ?? '#6b7280';
              const loc = node.startLine ? `:${node.startLine}` : '';
              return (
                <button
                  key={node.id}
                  onClick={() => handleSelect(node.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors flex items-center gap-2 border-b border-gray-800 last:border-0"
                >
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-gray-300 flex-1 truncate">{node.name}</span>
                  <span className="text-xs text-gray-600 shrink-0">{node.type}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
