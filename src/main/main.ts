import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import sqlite3 from 'sqlite3';
import { spawn } from 'child_process';

const IS_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const BACKEND_PORT = IS_DEV ? '5437' : '5337';
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const DB_DIR = path.join(os.homedir(), '.npcsh', 'scherzo', 'data');
const DB_PATH = path.join(DB_DIR, 'repertoire.db');

function initDb(): sqlite3.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new sqlite3.Database(DB_PATH);
  db.run(`CREATE TABLE IF NOT EXISTS repertoire (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, composer TEXT, album TEXT,
    audio_path TEXT, source_url TEXT, source_type TEXT,
    duration_sec REAL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS repertoire_sheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repertoire_id INTEGER NOT NULL,
    name TEXT, musicxml TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repertoire_id) REFERENCES repertoire(id) ON DELETE CASCADE
  )`);
  return db;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  if (IS_DEV) { win.loadURL('http://localhost:5173'); win.webContents.openDevTools(); }
  else { win.loadFile(path.join(__dirname, '../dist/index.html')); }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const db = initDb();
const dbQuery = (sql: string, params: any[] = []): Promise<any[]> => new Promise((res, rej) => {
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows));
});
const dbRun = (sql: string, params: any[] = []): Promise<any> => new Promise((res, rej) => {
  db.run(sql, params, function(err) { err ? rej(err) : res({ id: this.lastID, changes: this.changes }); });
});

function resolveHelperScript(scriptName: string): string | null {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'resources', scriptName),
    path.join(process.resourcesPath || '', scriptName),
    path.join(app.getAppPath(), 'resources', scriptName),
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

function shellOutHelper(pythonPath: string, scriptName: string, payload: any): Promise<any> {
  return new Promise((resolve) => {
    const scriptPath = resolveHelperScript(scriptName);
    if (!scriptPath) {
      resolve({ success: false, error: `${scriptName} not found in resources` });
      return;
    }
    const proc = spawn(pythonPath, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', (err) => resolve({ success: false, error: `Failed to spawn ${pythonPath}: ${err.message}` }));
    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        resolve({ success: false, error: stderr || `${scriptName} exited with code ${code}` });
        return;
      }
      try {
        const last = stdout.trim().split('\n').pop() || '';
        resolve(JSON.parse(last));
      } catch (err) {
        resolve({ success: false, error: `Could not parse helper output: ${(err as Error).message}. stderr: ${stderr}` });
      }
    });
    try {
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    } catch (err) {
      resolve({ success: false, error: `Failed to write to helper stdin: ${(err as Error).message}` });
    }
  });
}

function getPythonPath(): string | null {
  const candidates = [
    path.join(os.homedir(), '.npcsh', 'venv', 'bin', 'python3'),
    path.join(os.homedir(), '.npcsh', 'venv', 'Scripts', 'python.exe'),
    path.join(os.homedir(), '.venv', 'bin', 'python3'),
    path.join(os.homedir(), '.venv', 'Scripts', 'python.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const which = require('child_process').execSync('which python3 || which python', { encoding: 'utf8' }).trim();
    if (which) return which;
  } catch {}
  return null;
}

// File-system IPC
ipcMain.handle('readDirectory', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name, path: path.join(dirPath, e.name), isDirectory: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).size : 0,
      modified: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).mtime.toISOString() : '',
    }));
  } catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('ensureDirectory', async (_, dirPath: string) => {
  try { await fs.promises.mkdir(dirPath, { recursive: true }); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('getHomeDir', async () => os.homedir());
ipcMain.handle('show-open-dialog', async (_, options) => {
  const win = BrowserWindow.getFocusedWindow(); if (!win) return { canceled: true };
  return dialog.showOpenDialog(win, options);
});
ipcMain.handle('show-save-dialog', async (_, options) => {
  const win = BrowserWindow.getFocusedWindow(); if (!win) return { canceled: true };
  return dialog.showSaveDialog(win, options);
});
ipcMain.handle('read-file-content', async (_, filePath: string) => {
  try { const content = await fs.promises.readFile(filePath, 'utf-8'); return { content }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-content', async (_, filePath: string, content: string) => {
  try { await fs.promises.writeFile(filePath, content, 'utf-8'); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});

// Repertoire IPC
ipcMain.handle('repertoire:list', async () => dbQuery('SELECT id, title, composer, album, audio_path, source_url, source_type, duration_sec, created_at, updated_at FROM repertoire ORDER BY updated_at DESC, id DESC'));
ipcMain.handle('repertoire:get', async (_, id) => {
  const row = (await dbQuery('SELECT * FROM repertoire WHERE id = ?', [id]))[0];
  if (!row) return null;
  const sheets = await dbQuery('SELECT id, name, length(musicxml) AS xml_length, created_at FROM repertoire_sheets WHERE repertoire_id = ? ORDER BY id ASC', [id]);
  return { ...row, sheets };
});
ipcMain.handle('repertoire:getSheetXml', async (_, sheetId) => {
  const row = (await dbQuery('SELECT musicxml FROM repertoire_sheets WHERE id = ?', [sheetId]))[0];
  return row ? row.musicxml : null;
});
ipcMain.handle('repertoire:create', async (_, { title, composer, audioPath, sourceUrl, sourceType }) => {
  const result: any = await dbRun('INSERT INTO repertoire (title, composer, audio_path, source_url, source_type) VALUES (?, ?, ?, ?, ?)', [title, composer, audioPath, sourceUrl, sourceType]);
  return { id: result.id };
});
ipcMain.handle('repertoire:update', async (_, { id, fields }) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return { success: false };
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await dbRun(`UPDATE repertoire SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(k => fields[k]), id]);
  return { success: true };
});
ipcMain.handle('repertoire:delete', async (_, id) => {
  const row = (await dbQuery('SELECT audio_path FROM repertoire WHERE id = ?', [id]))[0];
  if (row?.audio_path && fs.existsSync(row.audio_path)) fs.unlinkSync(row.audio_path);
  await dbRun('DELETE FROM repertoire_sheets WHERE repertoire_id = ?', [id]);
  await dbRun('DELETE FROM repertoire WHERE id = ?', [id]);
  return { success: true };
});
ipcMain.handle('repertoire:attachSheet', async (_, { repertoireId, name, musicxml }) => {
  const result: any = await dbRun('INSERT INTO repertoire_sheets (repertoire_id, name, musicxml) VALUES (?, ?, ?)', [repertoireId, name, musicxml]);
  return { id: result.id };
});
ipcMain.handle('repertoire:deleteSheet', async (_, sheetId) => {
  await dbRun('DELETE FROM repertoire_sheets WHERE id = ?', [sheetId]);
  return { success: true };
});

// Music generation IPC
ipcMain.handle('load_demo_tracks', async () => {
  try {
    const candidates = [
      path.resolve(__dirname, '..', '..', 'assets', 'demo_audio'),
      path.join(process.resourcesPath || '', 'assets', 'demo_audio'),
      path.join(app.getAppPath(), 'assets', 'demo_audio'),
    ];
    const dir = candidates.find(p => fs.existsSync(p));
    if (!dir) return { success: false, error: 'demo_audio directory not found in app resources' };
    const files = fs.readdirSync(dir)
      .filter(n => /\.(wav|mp3|ogg|flac|m4a|aac|aiff)$/i.test(n))
      .map(n => ({ name: n, path: path.join(dir, n) }));
    return { success: true, tracks: files, dir };
  } catch (error: any) {
    console.error('Error loading demo tracks:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate_music', async (_, { prompt, provider, model, duration, currentPath, workspacePath, baseFilename, apiKey }) => {
  console.log(`[Main Process] Generate music: "${prompt}" provider=${provider} model=${model} dur=${duration}s`);
  if (!prompt) return { success: false, error: 'Prompt is required' };

  const p = (provider || 'local').toLowerCase();
  const isLocal = ['local', 'musicgen', 'transformers', 'meta'].includes(p);

  // Non-local providers: proxy to the shared backend exactly like incognide does
  if (!isLocal) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate_music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider, model, duration, currentPath }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }
      return data;
    } catch (error: any) {
      console.error('Error generating music via backend:', error);
      return { success: false, error: error.message || 'Music generation failed — is the backend running?' };
    }
  }

  // Local providers: shell out to Python helper
  const outputDir = currentPath && currentPath.startsWith('~')
    ? path.join(os.homedir(), currentPath.slice(1).replace(/^\//, ''))
    : (currentPath || path.join(os.homedir(), '.npcsh', 'audio'));

  const python = getPythonPath();
  if (!python) {
    return { success: false, error: 'No Python environment found. Install npcpy in a venv and try again.' };
  }

  const result = await shellOutHelper(python, 'run_music_gen.py', {
    prompt,
    provider,
    model,
    duration,
    output_dir: outputDir,
    base_filename: baseFilename,
    api_key: apiKey,
  });
  if (!result.success) {
    console.error('Music generation (shell-out) failed:', result.error);
    return { success: false, error: result.error };
  }

  // Read the generated file and return base64 so the renderer can use it inline
  try {
    const buf = fs.readFileSync(result.path);
    const b64 = buf.toString('base64');
    return { success: true, audio: b64, format: result.format || 'wav', filename: path.basename(result.path), path: result.path };
  } catch (err: any) {
    return { success: false, error: `Generated file could not be read: ${err.message}` };
  }
});
