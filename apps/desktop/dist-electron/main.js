"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const crypto_1 = __importDefault(require("crypto"));
const DATA_DIR = '.datanexus';
const BLACKLIST = new Set(['node_modules', '.git', 'dist', '.datanexus', 'build', '.next', '.cache']);
const isDev = process.env.NODE_ENV === 'development';
async function getCore() {
    return import('@datanexus/core');
}
async function getExtraction() {
    return import('@datanexus/extraction');
}
async function collectFiles(dir) {
    const results = [];
    try {
        const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (BLACKLIST.has(entry.name))
                continue;
            const full = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...(await collectFiles(full)));
            }
            else {
                results.push(full);
            }
        }
    }
    catch { }
    return results;
}
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); });
// IPC: pick a project directory
electron_1.ipcMain.handle('open-project', async () => {
    const result = await electron_1.dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
});
// IPC: load graph (read-only)
electron_1.ipcMain.handle('load-graph', async (_, projectPath) => {
    const dbPath = path_1.default.join(projectPath, DATA_DIR, 'graph.db');
    try {
        const { openDatabase, closeDatabase, queryNodes, getAllEdges, getStats } = await getCore();
        await openDatabase(dbPath);
        const stats = await getStats();
        const nodes = await queryNodes('', 20000);
        const edges = await getAllEdges();
        await closeDatabase();
        return { ok: true, nodes, edges, stats };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: index a project then return graph data
electron_1.ipcMain.handle('index-project', async (_, projectPath) => {
    const dataDir = path_1.default.join(projectPath, DATA_DIR);
    const dbPath = path_1.default.join(dataDir, 'graph.db');
    const fpPath = path_1.default.join(dataDir, 'fingerprints.json');
    try {
        const core = await getCore();
        const extraction = await getExtraction();
        const { openDatabase, closeDatabase, queryNodes, getAllEdges, getStats, loadFingerprints, saveFingerprints, diffFingerprints, persistPartialGraph } = core;
        const { createSkillRouter, codeSkill, docSkill } = extraction;
        await openDatabase(dbPath);
        const router = createSkillRouter();
        router.register(codeSkill);
        router.register(docSkill);
        const files = await collectFiles(projectPath);
        const routable = files.filter((f) => router.route(f) !== null);
        const store = await loadFingerprints(fpPath);
        const { changed, deleted } = await diffFingerprints(routable, store);
        for (const filePath of changed) {
            const skill = router.route(filePath);
            const content = await promises_1.default.readFile(filePath, 'utf-8').catch(() => '');
            const partial = await skill.extract({ filePath, content });
            await persistPartialGraph(filePath, partial);
            const stat = await promises_1.default.stat(filePath);
            store[filePath] = {
                hash: crypto_1.default.createHash('sha256').update(content).digest('hex'),
                mtime: stat.mtimeMs,
                size: stat.size,
            };
        }
        for (const f of deleted)
            delete store[f];
        await saveFingerprints(fpPath, store);
        const stats = await getStats();
        const nodes = await queryNodes('', 20000);
        const edges = await getAllEdges();
        await closeDatabase();
        return { ok: true, nodes, edges, stats, indexed: changed.length, deleted: deleted.length };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: search nodes
electron_1.ipcMain.handle('search-nodes', async (_, projectPath, term) => {
    const dbPath = path_1.default.join(projectPath, DATA_DIR, 'graph.db');
    try {
        const { openDatabase, closeDatabase, queryNodes } = await getCore();
        await openDatabase(dbPath);
        const nodes = await queryNodes(term, 200);
        await closeDatabase();
        return { ok: true, nodes };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: run Leiden clustering
electron_1.ipcMain.handle('cluster-project', async (_, projectPath) => {
    const dbPath = path_1.default.join(projectPath, DATA_DIR, 'graph.db');
    try {
        const { openDatabase, closeDatabase, clusterGraph, queryNodes, getAllEdges, getStats } = await getCore();
        await openDatabase(dbPath);
        const result = await clusterGraph({ resolution: 1.0 });
        const stats = await getStats();
        const nodes = await queryNodes('', 20000);
        const edges = await getAllEdges();
        await closeDatabase();
        return { ok: true, result, nodes, edges, stats };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: merge nodes
electron_1.ipcMain.handle('merge-nodes', async (_, projectPath, nodeIds, newName, newType) => {
    const dbPath = path_1.default.join(projectPath, DATA_DIR, 'graph.db');
    const dataDir = path_1.default.join(projectPath, DATA_DIR);
    try {
        const { openDatabase, closeDatabase, mergeNodes, queryNodes, getAllEdges, getStats } = await getCore();
        await openDatabase(dbPath);
        const merged = await mergeNodes(dataDir, {
            nodeIds,
            newNodeData: { name: newName, type: newType },
        });
        const stats = await getStats();
        const nodes = await queryNodes('', 20000);
        const edges = await getAllEdges();
        await closeDatabase();
        return { ok: true, merged, nodes, edges, stats };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: undo last operation
electron_1.ipcMain.handle('undo-operation', async (_, projectPath) => {
    const dbPath = path_1.default.join(projectPath, DATA_DIR, 'graph.db');
    const dataDir = path_1.default.join(projectPath, DATA_DIR);
    try {
        const { openDatabase, closeDatabase, undoLastOperation, queryNodes, getAllEdges, getStats } = await getCore();
        await openDatabase(dbPath);
        const message = await undoLastOperation(dataDir);
        const stats = await getStats();
        const nodes = await queryNodes('', 20000);
        const edges = await getAllEdges();
        await closeDatabase();
        return { ok: true, message, nodes, edges, stats };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: rename community
electron_1.ipcMain.handle('rename-community', async (_, projectPath, communityId, label) => {
    const dataDir = path_1.default.join(projectPath, DATA_DIR);
    try {
        const { saveCommunityLabel } = await getCore();
        await saveCommunityLabel(dataDir, communityId, label);
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
// IPC: load community labels
electron_1.ipcMain.handle('load-community-labels', async (_, projectPath) => {
    const dataDir = path_1.default.join(projectPath, DATA_DIR);
    try {
        const { loadCommunityLabels } = await getCore();
        const labels = await loadCommunityLabels(dataDir);
        return { ok: true, labels };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
});
