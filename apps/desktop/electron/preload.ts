import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('datanexus', {
  openProject: () => ipcRenderer.invoke('open-project'),
  loadGraph: (projectPath: string) => ipcRenderer.invoke('load-graph', projectPath),
  indexProject: (projectPath: string) => ipcRenderer.invoke('index-project', projectPath),
  searchNodes: (projectPath: string, term: string) =>
    ipcRenderer.invoke('search-nodes', projectPath, term),
  clusterProject: (projectPath: string) =>
    ipcRenderer.invoke('cluster-project', projectPath),
  mergeNodes: (projectPath: string, nodeIds: string[], newName: string, newType: string) =>
    ipcRenderer.invoke('merge-nodes', projectPath, nodeIds, newName, newType),
  undoOperation: (projectPath: string) =>
    ipcRenderer.invoke('undo-operation', projectPath),
  renameCommunity: (projectPath: string, communityId: number, label: string) =>
    ipcRenderer.invoke('rename-community', projectPath, communityId, label),
  loadCommunityLabels: (projectPath: string) =>
    ipcRenderer.invoke('load-community-labels', projectPath),
});
