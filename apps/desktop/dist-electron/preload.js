"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('datanexus', {
    openProject: () => electron_1.ipcRenderer.invoke('open-project'),
    loadGraph: (projectPath) => electron_1.ipcRenderer.invoke('load-graph', projectPath),
    indexProject: (projectPath) => electron_1.ipcRenderer.invoke('index-project', projectPath),
    searchNodes: (projectPath, term) => electron_1.ipcRenderer.invoke('search-nodes', projectPath, term),
    clusterProject: (projectPath) => electron_1.ipcRenderer.invoke('cluster-project', projectPath),
    mergeNodes: (projectPath, nodeIds, newName, newType) => electron_1.ipcRenderer.invoke('merge-nodes', projectPath, nodeIds, newName, newType),
    undoOperation: (projectPath) => electron_1.ipcRenderer.invoke('undo-operation', projectPath),
    renameCommunity: (projectPath, communityId, label) => electron_1.ipcRenderer.invoke('rename-community', projectPath, communityId, label),
    loadCommunityLabels: (projectPath) => electron_1.ipcRenderer.invoke('load-community-labels', projectPath),
});
