import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const DATA_DIR = '.datanexus';
const BLACKLIST = new Set(['node_modules', '.git', 'dist', '.datanexus', 'build', '.next', '.cache']);
const isDev = process.env.NODE_ENV === 'development';

async function getCore() {
  return import('@datanexus/core' as string);
}

async function getExtraction() {
  return import('@datanexus/extraction' as string);
}

async function collectFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (BLACKLIST.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await collectFiles(full)));
      } else {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// IPC: pick a project directory
ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: load graph (read-only)
ipcMain.handle('load-graph', async (_, projectPath: string) => {
  const dbPath = path.join(projectPath, DATA_DIR, 'graph.db');
  try {
    const { openDatabase, closeDatabase, queryNodes, getAllEdges, getStats } = await getCore();
    await openDatabase(dbPath);
    const stats = await getStats();
    const nodes = await queryNodes('', 20000);
    const edges = await getAllEdges();
    await closeDatabase();
    return { ok: true, nodes, edges, stats };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: index a project then return graph data
ipcMain.handle('index-project', async (_, projectPath: string) => {
  const dataDir = path.join(projectPath, DATA_DIR);
  const dbPath = path.join(dataDir, 'graph.db');
  const fpPath = path.join(dataDir, 'fingerprints.json');
  try {
    const core = await getCore();
    const extraction = await getExtraction();
    const { openDatabase, closeDatabase, queryNodes, getAllEdges, getStats,
            loadFingerprints, saveFingerprints, diffFingerprints, persistPartialGraph } = core;
    const { createSkillRouter, codeSkill, docSkill } = extraction;

    await openDatabase(dbPath);

    const router = createSkillRouter();
    router.register(codeSkill);
    router.register(docSkill);

    const files = await collectFiles(projectPath);
    const routable = files.filter((f: string) => router.route(f) !== null);
    const store = await loadFingerprints(fpPath);
    const { changed, deleted } = await diffFingerprints(routable, store);

    for (const filePath of changed) {
      const skill = router.route(filePath)!;
      const content = await fs.readFile(filePath, 'utf-8').catch(() => '');
      const partial = await skill.extract({ filePath, content });
      await persistPartialGraph(filePath, partial);
      const stat = await fs.stat(filePath);
      store[filePath] = {
        hash: crypto.createHash('sha256').update(content).digest('hex'),
        mtime: stat.mtimeMs,
        size: stat.size,
      };
    }
    for (const f of deleted) delete store[f];
    await saveFingerprints(fpPath, store);

    const stats = await getStats();
    const nodes = await queryNodes('', 20000);
    const edges = await getAllEdges();
    await closeDatabase();

    return { ok: true, nodes, edges, stats, indexed: changed.length, deleted: deleted.length };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: search nodes
ipcMain.handle('search-nodes', async (_, projectPath: string, term: string) => {
  const dbPath = path.join(projectPath, DATA_DIR, 'graph.db');
  try {
    const { openDatabase, closeDatabase, queryNodes } = await getCore();
    await openDatabase(dbPath);
    const nodes = await queryNodes(term, 200);
    await closeDatabase();
    return { ok: true, nodes };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: run Leiden clustering
ipcMain.handle('cluster-project', async (_, projectPath: string) => {
  const dbPath = path.join(projectPath, DATA_DIR, 'graph.db');
  try {
    const { openDatabase, closeDatabase, clusterGraph, queryNodes, getAllEdges, getStats } = await getCore();
    await openDatabase(dbPath);
    const result = await clusterGraph({ resolution: 1.0 });
    const stats = await getStats();
    const nodes = await queryNodes('', 20000);
    const edges = await getAllEdges();
    await closeDatabase();
    return { ok: true, result, nodes, edges, stats };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: merge nodes
ipcMain.handle('merge-nodes', async (_, projectPath: string, nodeIds: string[], newName: string, newType: string) => {
  const dbPath = path.join(projectPath, DATA_DIR, 'graph.db');
  const dataDir = path.join(projectPath, DATA_DIR);
  try {
    const { openDatabase, closeDatabase, mergeNodes, queryNodes, getAllEdges, getStats } = await getCore();
    await openDatabase(dbPath);
    const merged = await mergeNodes(dataDir, {
      nodeIds,
      newNodeData: { name: newName, type: newType as any },
    });
    const stats = await getStats();
    const nodes = await queryNodes('', 20000);
    const edges = await getAllEdges();
    await closeDatabase();
    return { ok: true, merged, nodes, edges, stats };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: undo last operation
ipcMain.handle('undo-operation', async (_, projectPath: string) => {
  const dbPath = path.join(projectPath, DATA_DIR, 'graph.db');
  const dataDir = path.join(projectPath, DATA_DIR);
  try {
    const { openDatabase, closeDatabase, undoLastOperation, queryNodes, getAllEdges, getStats } = await getCore();
    await openDatabase(dbPath);
    const message = await undoLastOperation(dataDir);
    const stats = await getStats();
    const nodes = await queryNodes('', 20000);
    const edges = await getAllEdges();
    await closeDatabase();
    return { ok: true, message, nodes, edges, stats };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: rename community
ipcMain.handle('rename-community', async (_, projectPath: string, communityId: number, label: string) => {
  const dataDir = path.join(projectPath, DATA_DIR);
  try {
    const { saveCommunityLabel } = await getCore();
    await saveCommunityLabel(dataDir, communityId, label);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC: load community labels
ipcMain.handle('load-community-labels', async (_, projectPath: string) => {
  const dataDir = path.join(projectPath, DATA_DIR);
  try {
    const { loadCommunityLabels } = await getCore();
    const labels = await loadCommunityLabels(dataDir);
    return { ok: true, labels };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});
