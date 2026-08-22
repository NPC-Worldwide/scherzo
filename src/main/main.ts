import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import sqlite3 from 'sqlite3';
import { spawn, exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Readable } from 'node:stream';
import * as musicMetadata from 'music-metadata';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IS_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const ICON_PATH = path.join(__dirname, '..', 'scherzo.png');
const DB_DIR = path.join(os.homedir(), '.scherzo', 'data');
const DB_PATH = path.join(DB_DIR, 'repertoire.db');

// Migrate legacy data from the old ~/.npcsh/scherzo/data location.
const LEGACY_DB_DIR = path.join(os.homedir(), '.npcsh', 'scherzo', 'data');
const LEGACY_DB_PATH = path.join(LEGACY_DB_DIR, 'repertoire.db');
if (fs.existsSync(LEGACY_DB_PATH) && !fs.existsSync(DB_PATH)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
    console.log('[Main] Migrated legacy DB from', LEGACY_DB_PATH, 'to', DB_PATH);
  } catch (err: any) {
    console.error('[Main] Legacy DB migration failed:', err.message);
  }
}

protocol.registerSchemesAsPrivileged([{
  scheme: 'media',
  privileges: { standard: true, supportFetchAPI: true, stream: true, secure: true, corsEnabled: true }
}]);

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
    auto_generated INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Migration: add auto_generated if table was created before this column.
  db.run(`ALTER TABLE playlists ADD COLUMN auto_generated INTEGER DEFAULT 0`, (err: any) => {
    if (err && !err.message.includes('duplicate column')) console.error('[DB] alter playlists failed:', err.message);
  });
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
    ...(fs.existsSync(ICON_PATH) ? { icon: ICON_PATH } : {}),
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

app.whenReady().then(() => {
  protocol.handle('media', async (request) => {
    let filePath: string;
    try {
      const url = new URL(request.url);
      filePath = decodeURIComponent(url.pathname);
    } catch (err: any) {
      console.error('[Media protocol] invalid URL', request.url, err.message);
      return new Response('Invalid URL', { status: 400 });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.webm': 'audio/webm',
      '.mp4': 'video/mp4',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (err: any) {
      console.error('[Media protocol] failed to stat', filePath, err.message);
      return new Response('Not found', { status: 404 });
    }
    const totalSize = stats.size;
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
      if (!match) {
        return new Response('Invalid Range', { status: 416, headers: { 'Content-Range': `bytes */${totalSize}` } });
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      if (start >= totalSize || end >= totalSize || start > end) {
        return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${totalSize}` } });
      }
      try {
        const stream = fs.createReadStream(filePath, { start, end });
        const chunks: Buffer[] = [];
        for await (const chunk of stream) { chunks.push(chunk as Buffer); }
        const data = Buffer.concat(chunks);
        return new Response(data, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(data.length),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
          },
        });
      } catch (err: any) {
        console.error('[Media protocol] range read failed', filePath, err.message);
        return new Response('Not found', { status: 404 });
      }
    }
    try {
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err: any) {
      console.error('[Media protocol] failed to read', filePath, err.message);
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

const db = initDb();
console.log('[Main] DB initialized, registering handlers...');

async function findPlaylistByName(name: string): Promise<any | null> {
  const rows: any = await dbQuery('SELECT * FROM playlists WHERE name = ?', [name]);
  return rows[0] || null;
}

async function ensurePlaylist(name: string, description: string, autoGenerated: boolean): Promise<any> {
  const existing = await findPlaylistByName(name);
  if (existing) return existing;
  const r: any = await dbRun('INSERT INTO playlists (name, description, auto_generated) VALUES (?, ?, ?)', [name, description, autoGenerated ? 1 : 0]);
  return { id: r.id, name, description, auto_generated: autoGenerated ? 1 : 0 };
}

async function addTrackToTop(playlistId: number, trackId: number) {
  await dbRun('UPDATE playlist_tracks SET position = position + 1 WHERE playlist_id = ?', [playlistId]);
  await dbRun('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, 1)', [playlistId, trackId]);
}
const dbQuery = (sql: string, params: unknown[] = []): Promise<unknown[]> => new Promise((res, rej) => {
  db.all(sql, params, (err: Error | null, rows: unknown[]) => err ? rej(err) : res(rows));
});
const dbRun = (sql: string, params: unknown[] = []): Promise<{ id: number; changes: number }> => new Promise((res, rej) => {
  db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
    err ? rej(err) : res({ id: this.lastID, changes: this.changes });
  });
});

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

    async function indexFile(full: string, fileName: string) {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (!audioExts.has(ext)) return;
      try {
        const stat = fs.statSync(full);
        let title = fileName.replace(/\.[^.]+$/, '');
        let artist: string | null = null;
        let album: string | null = null;
        let duration: number | null = null;
        try {
          const meta = await musicMetadata.parseFile(full, { duration: true });
          title = meta.common.title || title;
          artist = meta.common.artist || meta.common.artists?.[0] || null;
          album = meta.common.album || null;
          duration = typeof meta.format.duration === 'number' ? meta.format.duration : null;
        } catch (metaErr: any) {
          console.warn('[library:indexFolder] metadata parse failed for', full, metaErr.message);
        }
        await dbRun('INSERT OR IGNORE INTO library_tracks (path, title, artist, album, duration, file_size) VALUES (?, ?, ?, ?, ?, ?)',
          [full, title, artist, album, duration, stat.size]);
        added.push(full);
      } catch {}
    }

    function walk(dir: string) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      const pending: Promise<void>[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        pending.push(indexFile(full, e.name));
      }
      return Promise.all(pending);
    }
    await walk(folderPath);
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
  try {
    await dbRun('UPDATE library_tracks SET liked = ? WHERE id = ?', [liked ? 1 : 0, id]);
    if (liked) {
      const likePl = await ensurePlaylist('Liked Songs', 'Your liked tracks', true);
      const rows: any = await dbQuery('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [likePl.id, id]);
      if (rows.length === 0) {
        await dbRun('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM playlist_tracks WHERE playlist_id = ?))', [likePl.id, id, likePl.id]);
      }
    } else {
      const likePl = await findPlaylistByName('Liked Songs');
      if (likePl) await dbRun('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [likePl.id, id]);
    }
    return { success: true };
  }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('library:likedTracks', async () => {
  try { return await dbQuery('SELECT * FROM library_tracks WHERE liked = 1 ORDER BY added_at DESC'); }
  catch { return []; }
});

ipcMain.handle('library:updateTrack', async (_e, id: number, fields: { title?: string; artist?: string; album?: string }) => {
  try {
    const sets: string[] = [];
    const params: any[] = [];
    if (fields.title !== undefined) { sets.push('title = ?'); params.push(fields.title); }
    if (fields.artist !== undefined) { sets.push('artist = ?'); params.push(fields.artist); }
    if (fields.album !== undefined) { sets.push('album = ?'); params.push(fields.album); }
    if (sets.length === 0) return { success: false, error: 'no fields to update' };
    params.push(id);
    await dbRun(`UPDATE library_tracks SET ${sets.join(', ')} WHERE id = ?`, params);

    // If artist changed, re-home the track in auto-generated artist playlist.
    if (fields.artist !== undefined) {
      const newArtist = fields.artist?.trim() || 'Unknown';
      const rows: any = await dbQuery('SELECT id, artist FROM library_tracks WHERE id = ?', [id]);
      if (rows[0]) {
        const oldArtistPlaylists: any = await dbQuery('SELECT p.id FROM playlists p JOIN playlist_tracks pt ON pt.playlist_id = p.id WHERE pt.track_id = ? AND p.auto_generated = 1 AND p.name LIKE ?', [id, 'Artist: %']);
        for (const pl of oldArtistPlaylists) {
          await dbRun('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [pl.id, id]);
        }
        const artistPl = await ensurePlaylist(`Artist: ${newArtist}`, `Tracks by ${newArtist}`, true);
        await dbRun('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM playlist_tracks WHERE playlist_id = ?))', [artistPl.id, id, artistPl.id]);
      }
    }

    // If album changed, re-home the track in auto-generated album playlist.
    if (fields.album !== undefined) {
      const newAlbum = fields.album?.trim();
      if (newAlbum) {
        const oldAlbumPlaylists: any = await dbQuery('SELECT p.id FROM playlists p JOIN playlist_tracks pt ON pt.playlist_id = p.id WHERE pt.track_id = ? AND p.auto_generated = 1 AND p.name LIKE ?', [id, 'Album: %']);
        for (const pl of oldAlbumPlaylists) {
          await dbRun('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [pl.id, id]);
        }
        const albumPl = await ensurePlaylist(`Album: ${newAlbum}`, `Tracks from ${newAlbum}`, true);
        await dbRun('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM playlist_tracks WHERE playlist_id = ?))', [albumPl.id, id, albumPl.id]);
      }
    }

    return { success: true };
  }
  catch (e: any) { return { success: false, error: e.message }; }
});

// ── YouTube IPC ──────────────────────────────────────────────

function findYtDlp(): string | null {
  try { return execSync('which yt-dlp 2>/dev/null', { encoding: 'utf8' }).trim(); } catch {}
  try { return execSync('where yt-dlp 2>nul', { encoding: 'utf8' }).trim(); } catch {}
  return null;
}

function findFfmpeg(): string | null {
  try { return execSync('which ffmpeg 2>/dev/null', { encoding: 'utf8' }).trim(); } catch {}
  try { return execSync('where ffmpeg 2>nul', { encoding: 'utf8' }).trim(); } catch {}
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
  if (!ytdlp) return { success: false, error: 'yt-dlp not found. Install with: brew install yt-dlp' };
  if (!findFfmpeg()) return { success: false, error: 'ffmpeg not found. Audio extraction requires ffmpeg. Install with: brew install ffmpeg' };

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
  let rawUploader = metaParts[0]?.trim() || '';
  let rawTitle = metaParts[1]?.trim() || '';
  let artist = rawUploader || 'Unknown';
  let title = rawTitle;

  // Try to extract "Artist - Title" from the video title when uploader is a generic topic channel.
  if (rawTitle.includes(' - ')) {
    const split = rawTitle.split(' - ');
    const possibleArtist = split[0].trim();
    const possibleTitle = split.slice(1).join(' - ').trim();
    const genericChannel = /- topic$/i.test(rawUploader) || rawUploader.toLowerCase().includes('various');
    if (genericChannel || possibleArtist.length > 0 && possibleArtist.length < 80) {
      artist = possibleArtist;
      title = possibleTitle;
    }
  }

  artist = artist.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'Unknown';

  // Always download into ~/.scherzo/library/{artist}/
  const libraryDir = path.join(os.homedir(), '.scherzo', 'library', artist);
  fs.mkdirSync(libraryDir, { recursive: true });

  return new Promise((resolve) => {
    const outputTemplate = path.join(libraryDir, '%(title)s.%(ext)s');
    const cmd = `"${ytdlp}" "${videoUrl}" -x --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" --no-playlist --ignore-errors --no-keep-video`;
    exec(cmd, { timeout: 600000, maxBuffer: 1024 * 1024 }, async (err, _stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message });
        return;
      }

      // Find the final .mp3 file that yt-dlp + ffmpeg produced.
      let mp3Files: string[];
      try {
        mp3Files = fs.readdirSync(libraryDir)
          .filter(f => f.toLowerCase().endsWith('.mp3'))
          .map(f => path.join(libraryDir, f));
      } catch {
        mp3Files = [];
      }

      const downloaded = mp3Files
        .map(f => ({ path: f, mtime: fs.statSync(f).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0];

      if (!downloaded) {
        resolve({ success: false, error: `Download failed: ${stderr || 'no mp3 file created'}` });
        return;
      }

      const filename = downloaded.path;
      const fileTitle = path.basename(filename, path.extname(filename));
      const displayTitle = title || fileTitle;
      const stat = fs.statSync(filename);
      const videoId = videoUrl.split('v=')[1]?.split('&')[0] || '';
      const r: any = await dbRun('INSERT OR IGNORE INTO library_tracks (path, title, artist, source, source_url, yt_video_id, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [filename, displayTitle, artist, 'youtube', videoUrl, videoId, stat.size]);
      const trackId = r.id || (await dbQuery('SELECT id FROM library_tracks WHERE path = ?', [filename]) as any[])[0]?.id;

      // Auto-group into playlists.
      if (trackId) {
        const recentPl = await ensurePlaylist('Recently Downloaded', 'Tracks you downloaded recently', true);
        await addTrackToTop(recentPl.id, trackId);

        const artistPl = await ensurePlaylist(`Artist: ${artist}`, `Tracks by ${artist}`, true);
        await dbRun('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM playlist_tracks WHERE playlist_id = ?))', [artistPl.id, trackId, artistPl.id]);
      }

      resolve({ success: true, path: filename, title: displayTitle, artist, trackId });
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
  try {
    const rows: any = await dbQuery('SELECT auto_generated FROM playlists WHERE id = ?', [id]);
    if (rows[0]?.auto_generated) return { success: false, error: 'Cannot delete auto-generated playlist' };
    await dbRun('DELETE FROM playlists WHERE id = ?', [id]);
    return { success: true };
  }
  catch (e: any) { return { success: false, error: e.message }; }
});

ipcMain.handle('playlist:rename', async (_e, id: number, name: string) => {
  try {
    const rows: any = await dbQuery('SELECT auto_generated FROM playlists WHERE id = ?', [id]);
    if (rows[0]?.auto_generated) return { success: false, error: 'Cannot rename auto-generated playlist' };
    await dbRun('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
    return { success: true };
  }
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

// ── Window close ──────────────────────────────────────────────
ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());
console.log('[Main] All handlers registered');

// ─── Update checker ───────────────────────────────────────────
const fsPromises = fs.promises;
const APP_VERSION = (() => {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    return (JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version as string) || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
const UPDATE_MANIFEST_URL = 'https://storage.googleapis.com/scherzo-executables/manifest.json';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function platformDownloadKey(): string {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') return 'windows-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  if (platform === 'darwin') return arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
  return 'macos-arm64';
}

ipcMain.handle('get-app-version', () => APP_VERSION);

ipcMain.handle('check-for-updates', async () => {
  try {
    const response = await fetch(UPDATE_MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest: any = await response.json();
    const latestVersion: string = manifest.version || '0.0.0';
    const hasUpdate = compareVersions(latestVersion, APP_VERSION) > 0;
    const platformKey = platformDownloadKey();
    const releaseUrl: string = manifest.downloads?.[platformKey] || UPDATE_MANIFEST_URL;
    return {
      success: true,
      currentVersion: APP_VERSION,
      latestVersion,
      hasUpdate,
      releaseUrl,
      downloads: manifest.downloads || {},
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err), currentVersion: APP_VERSION };
  }
});

ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
});

ipcMain.handle('download-and-install-update', async (event, { releaseUrl }: { releaseUrl: string }) => {
  try {
    const tmpDir = path.join(os.tmpdir(), 'scherzo-update');
    await fsPromises.mkdir(tmpDir, { recursive: true });
    const fileName = path.basename(new URL(releaseUrl).pathname) || 'scherzo-update';
    const filePath = path.join(tmpDir, fileName);

    const response = await fetch(releaseUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    let receivedBytes = 0;
    const fileStream = fs.createWriteStream(filePath);
    const nodeStream = Readable.fromWeb(response.body as any);

    await new Promise<void>((resolve, reject) => {
      nodeStream.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.round((receivedBytes / totalBytes) * 100);
          event.sender.send('update-download-progress', { progress, receivedBytes, totalBytes });
        }
      });
      nodeStream.pipe(fileStream);
      nodeStream.on('error', reject);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    const platform = process.platform;
    if (platform === 'darwin' && filePath.endsWith('.dmg')) {
      spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'win32') {
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'linux') {
      if (filePath.endsWith('.AppImage')) {
        await fsPromises.chmod(filePath, 0o755);
        spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref();
      }
    }

    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
});
