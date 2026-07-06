import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import sqlite3 from 'sqlite3';
import { spawn, exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IS_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const BACKEND_PORT = IS_DEV ? '7139' : '5139';
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const DB_DIR = path.join(os.homedir(), '.npcsh', 'scherzo', 'data');
const DB_PATH = path.join(DB_DIR, 'repertoire.db');

protocol.registerSchemesAsPrivileged([{
  scheme: 'media',
  privileges: { standard: true, supportFetchAPI: true, stream: true, secure: true, corsEnabled: true }
}]);

let backendProcess: ReturnType<typeof spawn> | null = null;

function killBackendProcess() {
  if (!backendProcess) return;
  console.log('[Main] Killing backend process');
  if (process.platform === 'win32') {
    try { require('child_process').execSync(`taskkill /F /T /PID ${backendProcess.pid}`, { stdio: 'ignore' }); } catch {}
  } else {
    const pid = backendProcess.pid;
    if (pid !== undefined) {
      try { process.kill(-pid, 'SIGTERM'); } catch {}
    }
  }
  backendProcess = null;
}

function spawnBackendProcess(pythonPath: string, args: string[], env: Record<string, string>) {
  console.log(`[Main] Spawning backend: ${pythonPath} ${args.join(' ')}`);
  const proc = spawn(pythonPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
    env,
  });
  proc.stdout.on('data', (d: Buffer) => console.log('[Backend stdout]', d.toString().trim()));
  proc.stderr.on('data', (d: Buffer) => console.error('[Backend stderr]', d.toString().trim()));
  proc.on('error', (err: Error) => console.error('[Backend error]', err.message));
  proc.on('close', (code: number | null) => console.log(`[Backend] exited with code ${code}`));
  return proc;
}

async function waitForServer(maxAttempts = 60, delay = 1000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) { console.log(`[Main] Backend ready (attempt ${i})`); return true; }
    } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  console.error('[Main] Backend failed to start');
  return false;
}

function getBackendPythonPath(): string | null {
  const rc = path.join(os.homedir(), '.npcshrc');
  try {
    if (fs.existsSync(rc)) {
      const content = fs.readFileSync(rc, 'utf8');
      const m = content.match(/BACKEND_PYTHON_PATH=["']?([^"'\n]+)["']?/);
      if (m?.[1]?.trim()) {
        const p = m[1].trim().replace(/^~/, os.homedir());
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return getPythonPath();
}

async function startBackend() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) { console.log('[Main] Backend already running'); return true; }
  } catch {}

  const python = getBackendPythonPath();
  if (!python) {
    console.error('[Main] No Python found for backend');
    return false;
  }

  const backendEnv = {
    ...process.env,
    SCHERZO_PORT: BACKEND_PORT,
    FRONTEND_PORT: IS_DEV ? '7339' : '6339',
    FLASK_DEBUG: IS_DEV ? '1' : '0',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    HOME: os.homedir(),
    NPCSH_BASE: path.join(os.homedir(), '.npcsh'),
  };

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    const devScriptPath = path.join(app.getAppPath(), 'scherzo_serve.py');
    if (fs.existsSync(devScriptPath)) {
      backendProcess = spawnBackendProcess(python, [devScriptPath], backendEnv);
      return await waitForServer();
    }
  }
  const executableName = process.platform === 'win32' ? 'scherzo_serve.exe' : 'scherzo_serve';
  const bundledPath = path.join(process.resourcesPath || '', 'backend', executableName);
  if (fs.existsSync(bundledPath)) {
    backendProcess = spawnBackendProcess(bundledPath, [], backendEnv);
  } else {
    console.error(`[Main] No backend found at ${bundledPath}`);
    return false;
  }
  return await waitForServer();
}

app.on('before-quit', () => killBackendProcess());

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
  db.run(`CREATE TABLE IF NOT EXISTS indexed_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    label TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS library_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    title TEXT, artist TEXT, album TEXT,
    duration REAL, file_size INTEGER,
    source TEXT DEFAULT 'local',
    source_url TEXT, yt_video_id TEXT,
    liked INTEGER DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES library_tracks(id) ON DELETE CASCADE
  )`);
  return db;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });
  if (IS_DEV) { win.loadURL('http://localhost:7339'); win.webContents.openDevTools(); }
  else { win.loadFile(path.join(__dirname, '../dist/index.html')); }
}

app.whenReady().then(async () => {
  await startBackend();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const db = initDb();
console.log('[Main] DB initialized, registering handlers...');
const dbQuery = (sql: string, params: unknown[] = []): Promise<unknown[]> => new Promise((res, rej) => {
  db.all(sql, params, (err: Error | null, rows: unknown[]) => err ? rej(err) : res(rows));
});
const dbRun = (sql: string, params: unknown[] = []): Promise<{ id: number; changes: number }> => new Promise((res, rej) => {
  db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
    err ? rej(err) : res({ id: this.lastID, changes: this.changes });
  });
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
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', (err: Error) => resolve({ success: false, error: `Failed to spawn ${pythonPath}: ${err.message}` }));
    proc.on('close', (code: number | null) => {
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
  });
}

// ── Library IPC ──────────────────────────────────────────────
console.log('[Main] Registering library IPC handlers...');

ipcMain.handle('library:indexFolder', async (_e, folderPath: string) => {
  try {
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) return { success: false, error: 'Not a directory' };
    const label = path.basename(folderPath);
    dbRun('INSERT OR IGNORE INTO indexed_folders (path, label) VALUES (?, ?)', [folderPath, label]);

    const audioExts = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff', 'webm', 'opus']);
    const added: string[] = [];

    function walk(dir: string) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        const ext = e.name.split('.').pop()?.toLowerCase() || '';
        if (!audioExts.has(ext)) continue;
        try {
          const stat = fs.statSync(full);
          dbRun('INSERT OR IGNORE INTO library_tracks (path, title, file_size) VALUES (?, ?, ?)',
            [full, e.name.replace(/\.[^.]+$/, ''), stat.size]);
          added.push(full);
        } catch {}
      }
    }
    walk(folderPath);
    return { success: true, added };
  } catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('library:removeIndexedFolder', async (_e, folderId: number) => {
  try {
    const rows = await dbQuery('SELECT path FROM indexed_folders WHERE id = ?', [folderId]) as any[];
    if (rows[0]) {
      dbRun('DELETE FROM library_tracks WHERE path LIKE ?', [rows[0].path + '%']);
    }
    dbRun('DELETE FROM indexed_folders WHERE id = ?', [folderId]);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('library:listIndexedFolders', async () => {
  try { return await dbQuery('SELECT * FROM indexed_folders ORDER BY added_at DESC'); }
  catch (e: any) { return []; }
});

ipcMain.handle('library:listTracks', async (_e, opts?: { search?: string; sort?: string; offset?: number; limit?: number }) => {
  console.log('[Main] library:listTracks HANDLER CALLED');
  try {
    let sql = 'SELECT * FROM library_tracks WHERE 1=1';
    const params: any[] = [];
    if (opts?.search) { sql += ' AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)'; params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`); }
    sql += ` ORDER BY ${opts?.sort === 'title' ? 'title' : opts?.sort === 'artist' ? 'artist' : opts?.sort === 'album' ? 'album' : 'added_at'} DESC`;
    if (opts?.limit) { sql += ' LIMIT ?'; params.push(opts.limit); if (opts.offset) { sql += ' OFFSET ?'; params.push(opts.offset); } }
    return await dbQuery(sql, params);
  } catch (e: any) { return []; }
});

ipcMain.handle('library:getTrack', async (_e, id: number) => {
  try { const rows = await dbQuery('SELECT * FROM library_tracks WHERE id = ?', [id]); return rows[0] || null; }
  catch { return null; }
});

ipcMain.handle('library:likeTrack', async (_e, id: number, liked: boolean) => {
  try { await dbRun('UPDATE library_tracks SET liked = ? WHERE id = ?', [liked ? 1 : 0, id]); return { success: true }; }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('library:likedTracks', async () => {
  try { return await dbQuery('SELECT * FROM library_tracks WHERE liked = 1 ORDER BY added_at DESC'); }
  catch { return []; }
});

// ── YouTube IPC ──────────────────────────────────────────────

function findYtDlp(): string | null {
  try { return execSync('which yt-dlp 2>/dev/null', { encoding: 'utf8' }).trim(); } catch {}
  try { return execSync('where yt-dlp 2>nul', { encoding: 'utf8' }).trim(); } catch {}
  return null;
}

ipcMain.handle('library:youtubeSearch', async (_e, query: string) => {
  const ytdlp = findYtDlp();
  if (!ytdlp) return { success: false, error: 'yt-dlp not found. Install with: brew install yt-dlp' };
  return new Promise((resolve) => {
    exec(`"${ytdlp}" "ytsearch10:${query}" --flat-playlist --dump-json --no-playlist --ignore-errors`, {
      timeout: 15000, maxBuffer: 1024 * 1024,
    }, (err, stdout) => {
      if (err && !stdout) { resolve({ success: false, error: err.message }); return; }
      const results = (stdout || '').trim().split('\n').filter(Boolean).map((line: string) => {
        try {
          const j = JSON.parse(line);
          return { id: j.id, title: j.title, duration: j.duration, uploader: j.uploader || j.channel, url: j.webpage_url || `https://youtube.com/watch?v=${j.id}` };
        } catch { return null; }
      }).filter(Boolean);
      resolve({ success: true, results });
    });
  });
});

ipcMain.handle('library:youtubeDownload', async (_e, videoUrl: string, _outputDir?: string) => {
  const ytdlp = findYtDlp();
  if (!ytdlp) return { success: false, error: 'yt-dlp not found' };

  // Step 1: Extract metadata (artist/uploader) before downloading
  const metaResult = await new Promise<string>((resolve, reject) => {
    exec(`"${ytdlp}" "${videoUrl}" --print "%(uploader)s|||%(title)s" --no-playlist --ignore-errors`, {
      timeout: 15000, maxBuffer: 1024 * 1024,
    }, (err, stdout) => {
      if (err && !stdout) { reject(err); return; }
      resolve((stdout || '').trim());
    });
  }).catch(() => '');

  const metaParts = metaResult.split('\n').pop()?.split('|||') || [];
  const artist = (metaParts[0]?.trim() || 'Unknown').replace(/[\/\\:*?"<>|]/g, '_').trim();

  // Always download into ~/.scherzo/library/{artist}/
  const libraryDir = path.join(os.homedir(), '.scherzo', 'library', artist);
  fs.mkdirSync(libraryDir, { recursive: true });

  return new Promise((resolve) => {
    exec(`"${ytdlp}" "${videoUrl}" -x --audio-format mp3 --audio-quality 0 -o "${libraryDir}/%(title)s.%(ext)s" --print filename --no-playlist --ignore-errors`, {
      timeout: 600000, maxBuffer: 1024 * 1024,
    }, async (err, stdout) => {
      if (err && !stdout) { resolve({ success: false, error: err.message }); return; }
      const filename = (stdout || '').trim().split('\n').pop()?.trim() || '';
      if (!filename || !fs.existsSync(filename)) { resolve({ success: false, error: `Download failed: ${stdout?.slice(0, 200)}` }); return; }
      const title = path.basename(filename, path.extname(filename));
      const stat = fs.statSync(filename);
      const videoId = videoUrl.split('v=')[1]?.split('&')[0] || '';
      await dbRun('INSERT OR IGNORE INTO library_tracks (path, title, artist, source, source_url, yt_video_id, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [filename, title, artist, 'youtube', videoUrl, videoId, stat.size]);
      resolve({ success: true, path: filename, title, artist });
    });
  });
});

// ── Radio IPC ──────────────────────────────────────────────

ipcMain.handle('library:radioRecommendations', async (_e, seedId: string) => {
  const ytdlp = findYtDlp();
  if (!ytdlp) return { success: false, error: 'yt-dlp not found' };
  return new Promise((resolve) => {
    exec(`"${ytdlp}" "https://music.youtube.com/watch?v=${seedId}" --flat-playlist --dump-json --playlist-end 20 --ignore-errors`, {
      timeout: 15000, maxBuffer: 1024 * 1024,
    }, (err, stdout) => {
      if (err && !stdout) { resolve({ success: false, error: err.message }); return; }
      const results = (stdout || '').trim().split('\n').filter(Boolean).map((line: string) => {
        try {
          const j = JSON.parse(line);
          return { id: j.id, title: j.title, duration: j.duration, uploader: j.uploader || j.channel, url: j.webpage_url || `https://youtube.com/watch?v=${j.id}` };
        } catch { return null; }
      }).filter(Boolean);
      resolve({ success: true, results });
    });
  });
});

// ── Playlist IPC ─────────────────────────────────────────────

ipcMain.handle('playlist:list', async () => {
  try { return await dbQuery('SELECT * FROM playlists ORDER BY updated_at DESC'); }
  catch { return []; }
});

ipcMain.handle('playlist:create', async (_e, name: string) => {
  try { const r: any = await dbRun('INSERT INTO playlists (name) VALUES (?)', [name]); return { success: true, id: r.id }; }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('playlist:delete', async (_e, id: number) => {
  try { await dbRun('DELETE FROM playlists WHERE id = ?', [id]); return { success: true }; }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('playlist:rename', async (_e, id: number, name: string) => {
  try { await dbRun('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]); return { success: true }; }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('playlist:getTracks', async (_e, playlistId: number) => {
  try { return await dbQuery('SELECT t.*, pt.position, pt.id as pt_id FROM library_tracks t JOIN playlist_tracks pt ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position', [playlistId]); }
  catch { return []; }
});

ipcMain.handle('playlist:addTrack', async (_e, playlistId: number, trackId: number) => {
  try {
    const rows: any = await dbQuery('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    const pos = (rows[0]?.maxPos ?? 0) + 1;
    await dbRun('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [playlistId, trackId, pos]);
    await dbRun('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [playlistId]);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('playlist:removeTrack', async (_e, ptId: number) => {
  try { await dbRun('DELETE FROM playlist_tracks WHERE id = ?', [ptId]); return { success: true }; }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('playlist:reorder', async (_e, playlistId: number, trackIds: number[]) => {
  try {
    const stmt = db.prepare('UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?');
    trackIds.forEach((ptId, i) => stmt.run(i + 1, ptId, playlistId));
    stmt.finalize();
    await dbRun('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [playlistId]);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
});

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
ipcMain.handle('readDirectory', async (_event: Electron.IpcMainInvokeEvent, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name, path: path.join(dirPath, e.name), isDirectory: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).size : 0,
      modified: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).mtime.toISOString() : '',
    }));
  } catch (e: unknown) { return { error: (e as Error).message }; }
});
ipcMain.handle('ensureDirectory', async (_event: Electron.IpcMainInvokeEvent, dirPath: string) => {
  try { await fs.promises.mkdir(dirPath, { recursive: true }); return { success: true }; }
  catch (e: unknown) { return { error: (e as Error).message }; }
});
ipcMain.handle('getHomeDir', async () => os.homedir());
ipcMain.handle('show-open-dialog', async (_event: Electron.IpcMainInvokeEvent, options: Electron.OpenDialogOptions) => {
  const win = BrowserWindow.getFocusedWindow(); if (!win) return { canceled: true };
  return dialog.showOpenDialog(win, options);
});
ipcMain.handle('show-save-dialog', async (_event: Electron.IpcMainInvokeEvent, options: Electron.SaveDialogOptions) => {
  const win = BrowserWindow.getFocusedWindow(); if (!win) return { canceled: true };
  return dialog.showSaveDialog(win, options);
});
ipcMain.handle('read-file-content', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
  try { const content = await fs.promises.readFile(filePath, 'utf-8'); return { content }; }
  catch (e: unknown) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-content', async (_event: Electron.IpcMainInvokeEvent, filePath: string, content: string) => {
  try { await fs.promises.writeFile(filePath, content, 'utf-8'); return { success: true }; }
  catch (e: unknown) { return { error: (e as Error).message }; }
});
ipcMain.handle('read-file-buffer', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
  try {
    const buf = fs.readFileSync(filePath);
    return { data: buf.toString('base64') };
  }
  catch (e: unknown) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-buffer', async (_event: Electron.IpcMainInvokeEvent, filePath: string, data: Uint8Array) => {
  try { fs.writeFileSync(filePath, Buffer.from(data)); return { success: true }; }
  catch (e: unknown) { return { error: (e as Error).message }; }
});

// Repertoire IPC
ipcMain.handle('repertoire:list', async () => dbQuery('SELECT id, title, composer, album, audio_path, source_url, source_type, duration_sec, created_at, updated_at FROM repertoire ORDER BY updated_at DESC, id DESC'));
ipcMain.handle('repertoire:get', async (_event: Electron.IpcMainInvokeEvent, id: number) => {
  const row = (await dbQuery('SELECT * FROM repertoire WHERE id = ?', [id]))[0];
  if (!row) return null;
  const sheets = await dbQuery('SELECT id, name, length(musicxml) AS xml_length, created_at FROM repertoire_sheets WHERE repertoire_id = ? ORDER BY id ASC', [id]);
  return { ...row, sheets };
});
ipcMain.handle('repertoire:getSheetXml', async (_event: Electron.IpcMainInvokeEvent, sheetId: number) => {
  const rows = await dbQuery('SELECT musicxml FROM repertoire_sheets WHERE id = ?', [sheetId]) as { musicxml: string }[];
  const row = rows[0];
  return row ? row.musicxml : null;
});
ipcMain.handle('repertoire:create', async (_event: Electron.IpcMainInvokeEvent, { title, composer, audioPath, sourceUrl, sourceType }: { title: string; composer?: string; audioPath?: string; sourceUrl?: string; sourceType?: string }) => {
  const result: any = await dbRun('INSERT INTO repertoire (title, composer, audio_path, source_url, source_type) VALUES (?, ?, ?, ?, ?)', [title, composer, audioPath, sourceUrl, sourceType]);
  return { id: result.id };
});
ipcMain.handle('repertoire:update', async (_event: Electron.IpcMainInvokeEvent, { id, fields }: { id: number; fields: Record<string, unknown> }) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return { success: false };
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await dbRun(`UPDATE repertoire SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...keys.map(k => fields[k]), id]);
  return { success: true };
});
ipcMain.handle('repertoire:delete', async (_event: Electron.IpcMainInvokeEvent, id: number) => {
  const rows = await dbQuery('SELECT audio_path FROM repertoire WHERE id = ?', [id]) as { audio_path?: string }[];
  const row = rows[0];
  if (row?.audio_path && fs.existsSync(row.audio_path)) fs.unlinkSync(row.audio_path);
  await dbRun('DELETE FROM repertoire_sheets WHERE repertoire_id = ?', [id]);
  await dbRun('DELETE FROM repertoire WHERE id = ?', [id]);
  return { success: true };
});
ipcMain.handle('repertoire:attachSheet', async (_event: Electron.IpcMainInvokeEvent, { repertoireId, name, musicxml }: { repertoireId: number; name: string; musicxml: string }) => {
  const result: any = await dbRun('INSERT INTO repertoire_sheets (repertoire_id, name, musicxml) VALUES (?, ?, ?)', [repertoireId, name, musicxml]);
  return { id: result.id };
});
ipcMain.handle('repertoire:deleteSheet', async (_event: Electron.IpcMainInvokeEvent, sheetId: number) => {
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
      .filter((n: string) => /\.(wav|mp3|ogg|flac|m4a|aac|aiff)$/i.test(n))
      .map((n: string) => ({ name: n, path: path.join(dir, n) }));
    return { success: true, tracks: files, dir };
  } catch (error: unknown) {
    console.error('Error loading demo tracks:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('generate_music', async (_event: Electron.IpcMainInvokeEvent, { prompt, provider, model, duration, currentPath, workspacePath, baseFilename, apiKey }: { prompt: string; provider?: string; model?: string; duration?: number; currentPath?: string; workspacePath?: string; baseFilename?: string; apiKey?: string }) => {
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
console.log('[Main] All handlers registered');
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }
      return data;
    } catch (error: unknown) {
      console.error('Error generating music via backend:', error);
      return { success: false, error: (error as Error).message || 'Music generation failed — is the backend running?' };
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
