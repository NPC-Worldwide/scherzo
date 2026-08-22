import React, { useState, useMemo } from 'react';
import {
    Music, Play, Search, Loader, X, RotateCcw,
    Youtube, ListPlus, AlignJustify, LayoutGrid, FolderPlus,
    FolderOpen, Heart, ListMusic, Radio, Edit2, User, Disc
} from 'lucide-react';
import RadioPanel from './RadioPanel';
import { toMediaUrl } from '../lib/utils';

interface LibraryPanelProps {
    libTracks: any[];
    libPlaylists: any[];
    libQueue: any[];
    libQueueIndex: number;
    libIndexedFolders: any[];
    libViewMode: 'table' | 'grid';
    libSort: string;
    libSearch: string;
    libSelectedPlaylist: number | null;
    libPlaylistTracks: any[];
    libYtResults: any[];
    libYtSearching: boolean;
    libYtDownloading: string | null;
    libYtError: string | null;
    libIndexing: boolean;
    libShowYtSearch: boolean;
    libNewPlaylistName: string;
    libRefreshing: boolean;
    libRadioFavorites: any[];
    libRadioActive: boolean;
    libRadioStation: any;
    libLibraryView: 'songs' | 'artists' | 'albums' | 'playlists';
    libSelectedArtist: string | null;
    libSelectedAlbum: string | null;
    setLibQueue: React.Dispatch<React.SetStateAction<any[]>>;
    setLibQueueIndex: React.Dispatch<React.SetStateAction<number>>;
    setLibViewMode: React.Dispatch<React.SetStateAction<'table' | 'grid'>>;
    setLibSort: React.Dispatch<React.SetStateAction<string>>;
    setLibSearch: React.Dispatch<React.SetStateAction<string>>;
    setLibSelectedPlaylist: React.Dispatch<React.SetStateAction<number | null>>;
    setLibPlaylistTracks: React.Dispatch<React.SetStateAction<any[]>>;
    setLibYtResults: React.Dispatch<React.SetStateAction<any[]>>;
    setLibYtSearching: React.Dispatch<React.SetStateAction<boolean>>;
    setLibYtDownloading: React.Dispatch<React.SetStateAction<string | null>>;
    setLibYtError: React.Dispatch<React.SetStateAction<string | null>>;
    setLibIndexing: React.Dispatch<React.SetStateAction<boolean>>;
    setLibShowYtSearch: React.Dispatch<React.SetStateAction<boolean>>;
    setLibNewPlaylistName: React.Dispatch<React.SetStateAction<string>>;
    setLibRadioFavorites: React.Dispatch<React.SetStateAction<any[]>>;
    setLibRadioActive: React.Dispatch<React.SetStateAction<boolean>>;
    setLibRadioStation: React.Dispatch<React.SetStateAction<any>>;
    setLibLibraryView: React.Dispatch<React.SetStateAction<'songs' | 'artists' | 'albums' | 'playlists'>>;
    setLibSelectedArtist: React.Dispatch<React.SetStateAction<string | null>>;
    setLibSelectedAlbum: React.Dispatch<React.SetStateAction<string | null>>;
    refreshLibrary: () => void;
    audioRef: React.MutableRefObject<HTMLAudioElement | null>;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedAudio: React.Dispatch<React.SetStateAction<any>>;
    selectedAudio: any;
    audioSource: string;
    formatTime: (seconds: number) => string;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({
    libTracks,
    libPlaylists,
    libQueue,
    libQueueIndex,
    libIndexedFolders,
    libViewMode,
    libSort,
    libSearch,
    libSelectedPlaylist,
    libPlaylistTracks,
    libYtResults,
    libYtSearching,
    libYtDownloading,
    libYtError,
    libIndexing,
    libShowYtSearch,
    libNewPlaylistName,
    libRefreshing,
    libRadioFavorites,
    libRadioActive,
    libRadioStation,
    libLibraryView,
    libSelectedArtist,
    libSelectedAlbum,
    setLibQueue,
    setLibQueueIndex,
    setLibViewMode,
    setLibSort,
    setLibSearch,
    setLibSelectedPlaylist,
    setLibPlaylistTracks,
    setLibYtResults,
    setLibYtSearching,
    setLibYtDownloading,
    setLibYtError,
    setLibIndexing,
    setLibShowYtSearch,
    setLibNewPlaylistName,
    setLibRadioFavorites,
    setLibRadioActive,
    setLibRadioStation,
    setLibLibraryView,
    setLibSelectedArtist,
    setLibSelectedAlbum,
    refreshLibrary,
    audioRef,
    setIsPlaying,
    setSelectedAudio,
    selectedAudio,
    audioSource,
    formatTime,
}) => {
    const filteredTracks = useMemo(() => libTracks.filter(t =>
        !libSearch || t.title?.toLowerCase().includes(libSearch.toLowerCase()) ||
        t.artist?.toLowerCase().includes(libSearch.toLowerCase()) ||
        t.album?.toLowerCase().includes(libSearch.toLowerCase())
    ), [libTracks, libSearch]);

    const artists = useMemo(() => {
        const map = new Map<string, any[]>();
        filteredTracks.forEach(t => {
            const key = t.artist?.trim() || 'Unknown Artist';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(t);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredTracks]);

    const albums = useMemo(() => {
        const map = new Map<string, { artist: string; tracks: any[] }>();
        filteredTracks.forEach(t => {
            const key = t.album?.trim() || 'Unknown Album';
            if (!map.has(key)) map.set(key, { artist: t.artist?.trim() || 'Unknown Artist', tracks: [] });
            map.get(key)!.tracks.push(t);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredTracks]);

    const playTrack = (track: any) => {
        if (!audioRef.current) {
            console.warn('[LibraryPanel] playTrack called but audioRef is not mounted');
            return;
        }
        if (!track?.path) {
            console.warn('[LibraryPanel] playTrack called with no path', track);
            return;
        }
        const url = toMediaUrl(track.path);
        console.log('[LibraryPanel] playTrack', track.id, url);
        setSelectedAudio({ id: track.id?.toString() || '', name: track.title || track.path, path: track.path, duration: track.duration, artist: track.artist });
        setIsPlaying(true);
    };

    const updateTrackField = async (id: number, field: 'title' | 'artist' | 'album', value: string) => {
        const result = await window.api?.libraryUpdateTrack?.(id, { [field]: value });
        if (result?.success) refreshLibrary();
        else alert(result?.error || 'Update failed');
    };

    const TrackTable = ({ tracks, numbered, editable }: { tracks: any[]; numbered?: boolean; editable?: boolean }) => (
        <table className="w-full text-xs">
            <thead className="sticky top-0 theme-bg-secondary">
                <tr className="theme-text-muted">
                    {numbered && <th className="w-8 py-1.5">#</th>}
                    <th className="text-left px-2 py-1.5">Title</th>
                    <th className="text-left px-2 py-1.5">Artist</th>
                    <th className="text-left px-2 py-1.5 hidden md:table-cell">Album</th>
                    <th className="text-right px-2 py-1.5 w-16">Time</th>
                    <th className="w-10 py-1.5"></th>
                </tr>
            </thead>
            <tbody>
                {tracks.map((t: any, i: number) => (
                    <tr
                        key={t.id || t.pt_id || i}
                        onDoubleClick={() => playTrack(t)}
                        className="border-b theme-border theme-hover cursor-pointer group"
                    >
                        {numbered && <td className="text-center py-1 theme-text-muted w-8">{i + 1}</td>}
                        <td className="px-2 py-1 truncate max-w-[250px]">
                            {!numbered && (
                                <button onClick={() => playTrack(t)} className="opacity-0 group-hover:opacity-100 p-1 theme-hover rounded mr-1">
                                    <Play size={10}/>
                                </button>
                            )}
                            {editable ? (
                                <span
                                    className={`${t.liked ? 'text-red-400' : ''} inline-flex items-center gap-1`}
                                    title="Click to edit"
                                >
                                    <EditableText value={t.title || t.path?.split('/').pop()?.split('\\').pop()} onSave={(v) => updateTrackField(t.id, 'title', v)}/>
                                    {t.source === 'youtube' && <Youtube size={10} className="inline text-red-500"/>}
                                </span>
                            ) : (
                                <span className={t.liked ? 'text-red-400' : ''}>
                                    {t.title || t.path?.split('/').pop()?.split('\\').pop()}
                                    {t.source === 'youtube' && <Youtube size={10} className="inline ml-1 text-red-500"/>}
                                </span>
                            )}
                        </td>
                        <td className="px-2 py-1 theme-text-muted truncate max-w-[150px]">
                            {editable ? (
                                <EditableText value={t.artist || '-'} onSave={(v) => updateTrackField(t.id, 'artist', v)}/>
                            ) : (
                                t.artist || '-'
                            )}
                        </td>
                        <td className="px-2 py-1 theme-text-muted truncate max-w-[150px] hidden md:table-cell">
                            {editable ? (
                                <EditableText value={t.album || '-'} onSave={(v) => updateTrackField(t.id, 'album', v)}/>
                            ) : (
                                t.album || '-'
                            )}
                        </td>
                        <td className="px-2 py-1 text-right theme-text-muted w-16">{t.duration ? formatTime(t.duration) : '-'}</td>
                        <td className="py-1 w-10 text-right pr-1">
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 justify-end">
                                <button
                                    onClick={async () => { await window.api?.libraryLikeTrack?.(t.id, !t.liked); refreshLibrary(); }}
                                    className={`p-0.5 rounded ${t.liked ? 'text-red-400' : 'theme-text-muted'}`}
                                ><Heart size={11} fill={t.liked ? 'currentColor' : 'none'}/></button>
                                <button onClick={() => addToQueue(t)} className="p-0.5 theme-text-muted" title="Add to queue">
                                    <ListPlus size={11}/>
                                </button>
                                {libPlaylists.length > 0 && (
                                    <select
                                        className="bg-transparent text-[8px] w-4"
                                        onChange={async (e) => {
                                            const plId = parseInt(e.target.value);
                                            if (plId) { await window.api?.playlistAddTrack?.(plId, t.id); refreshLibrary(); }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>+</option>
                                        {libPlaylists.map((pl: any) => (
                                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const EditableText = ({ value, onSave }: { value: string; onSave: (val: string) => void }) => {
        const [editing, setEditing] = useState(false);
        const [val, setVal] = useState(value);
        if (editing) {
            return (
                <input
                    type="text"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={() => { setEditing(false); if (val !== value) onSave(val); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { setEditing(false); if (val !== value) onSave(val); }
                        if (e.key === 'Escape') { setEditing(false); setVal(value); }
                    }}
                    autoFocus
                    className="bg-transparent border-b border-purple-500 outline-none w-full min-w-[80px]"
                    onClick={(e) => e.stopPropagation()}
                />
            );
        }
        return (
            <span className="inline-flex items-center gap-1 group/edit cursor-text" onClick={(e) => { e.stopPropagation(); setEditing(true); setVal(value); }}>
                {value}
                <Edit2 size={10} className="opacity-0 group-hover/edit:opacity-100 text-purple-400"/>
            </span>
        );
    };

    const addToQueue = (track: any) => {
        setLibQueue(prev => [...prev, track]);
        if (libQueueIndex < 0) setLibQueueIndex(0);
    };

    const playNextInQueue = () => {
        if (libQueue.length === 0) return;
        const next = libQueueIndex + 1;
        if (next < libQueue.length) {
            setLibQueueIndex(next);
            playTrack(libQueue[next]);
        } else {
            setLibQueueIndex(-1);
            setLibQueue([]);
        }
    };

    const clearQueue = () => { setLibQueue([]); setLibQueueIndex(-1); };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* ── Left Panel: Library Nav ── */}
            <div className="w-56 border-r theme-border flex flex-col theme-bg-secondary shrink-0">
                <div className="p-3 border-b theme-border">
                    <h4 className="text-xs font-semibold theme-text-muted uppercase mb-2">Library</h4>
                    <div className="space-y-0.5">
                        {[
                            { id: 'songs', icon: Music, label: 'Songs' },
                            { id: 'artists', icon: User, label: 'Artists' },
                            { id: 'albums', icon: Disc, label: 'Albums' },
                            { id: 'playlists', icon: ListMusic, label: 'Playlists' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setLibLibraryView(item.id as any);
                                    setLibSelectedPlaylist(null);
                                    setLibSelectedArtist(null);
                                    setLibSelectedAlbum(null);
                                }}
                                className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1 ${libLibraryView === item.id ? 'bg-purple-600/30 text-purple-300' : 'theme-hover theme-text-secondary'}`}
                            >
                                <item.icon size={12}/> {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                {libLibraryView === 'playlists' && (
                    <div className="p-3 border-b theme-border">
                        <h4 className="text-xs font-semibold theme-text-muted uppercase mb-2">Playlists</h4>
                        <div className="flex gap-1 mb-2">
                            <input
                                type="text" value={libNewPlaylistName} onChange={e => setLibNewPlaylistName(e.target.value)}
                                placeholder="New playlist..."
                                className="flex-1 theme-input text-xs px-2 py-1"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && libNewPlaylistName.trim()) {
                                        await window.api?.playlistCreate?.(libNewPlaylistName.trim());
                                        setLibNewPlaylistName('');
                                        refreshLibrary();
                                    }
                                }}
                            />
                            <button
                                onClick={async () => {
                                    if (!libNewPlaylistName.trim()) return;
                                    await window.api?.playlistCreate?.(libNewPlaylistName.trim());
                                    setLibNewPlaylistName('');
                                    refreshLibrary();
                                }}
                                className="p-1 bg-purple-600 hover:bg-purple-500 rounded text-white text-xs"
                            >+</button>
                        </div>
                        <div className="space-y-0.5 max-h-40 overflow-y-auto">
                            {libPlaylists.map((pl: any) => (
                                <div key={pl.id} className="flex items-center group">
                                    <button
                                        onClick={() => setLibSelectedPlaylist(pl.id)}
                                        className={`flex-1 text-left px-2 py-1 rounded text-xs ${libSelectedPlaylist === pl.id ? 'bg-purple-600/30 text-purple-300' : 'theme-hover theme-text-secondary'}`}
                                    >
                                        <ListMusic size={12} className="inline mr-1"/>{pl.name}
                                    </button>
                                    {!pl.auto_generated && (
                                        <button
                                            onClick={async () => { await window.api?.playlistDelete?.(pl.id); setLibSelectedPlaylist(null); refreshLibrary(); }}
                                            className="p-0.5 opacity-0 group-hover:opacity-100 theme-hover rounded text-red-400"
                                        ><X size={10}/></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="p-3 border-b theme-border flex-1">
                    <h4 className="text-xs font-semibold theme-text-muted uppercase mb-2">Folders</h4>
                    <button
                        onClick={async () => {
                            const result = await window.api?.showOpenDialog?.({ properties: ['openDirectory'] });
                            if (result?.length > 0) {
                                setLibIndexing(true);
                                await window.api?.libraryIndexFolder?.(result[0]);
                                setLibIndexing(false);
                                refreshLibrary();
                            }
                        }}
                        disabled={libIndexing}
                        className="w-full px-2 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-xs text-white flex items-center justify-center gap-1 mb-2"
                    >
                        {libIndexing ? <Loader size={10} className="animate-spin"/> : <FolderPlus size={12}/>}
                        {libIndexing ? 'Indexing...' : 'Index Folder'}
                    </button>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                        {libIndexedFolders.map((f: any) => (
                            <div key={f.id} className="flex items-center group text-xs theme-text-muted px-2 py-0.5 rounded theme-hover">
                                <FolderOpen size={10} className="mr-1 shrink-0"/>
                                <span className="truncate flex-1">{f.label || f.path.split('/').pop()}</span>
                                <button
                                    onClick={async () => { await window.api?.libraryRemoveIndexedFolder?.(f.id); refreshLibrary(); }}
                                    className="p-0.5 opacity-0 group-hover:opacity-100 text-red-400"
                                ><X size={10}/></button>
                            </div>
                        ))}
                        {libIndexedFolders.length === 0 && (
                            <p className="text-xs theme-text-muted px-2 py-1">No indexed folders</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="h-10 border-b theme-border flex items-center px-3 gap-2 theme-bg-primary shrink-0">
                    <button
                        onClick={() => setLibShowYtSearch(!libShowYtSearch)}
                        className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${libShowYtSearch ? 'bg-red-600 text-white' : 'theme-bg-secondary theme-hover theme-text-secondary'}`}
                    >
                        <Youtube size={12}/> YouTube
                    </button>
                    <button
                        onClick={() => { setLibRadioActive(!libRadioActive); if (!libRadioActive) setLibShowYtSearch(false); }}
                        className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${libRadioActive ? 'bg-green-600 text-white' : 'theme-bg-secondary theme-hover theme-text-secondary'}`}
                    >
                        <Radio size={12}/> Radio
                    </button>
                    <div className="flex-1 flex items-center gap-1 theme-bg-secondary rounded px-2">
                        <Search size={12} className="theme-text-muted"/>
                        <input
                            type="text" value={libSearch} onChange={e => setLibSearch(e.target.value)}
                            placeholder="Search library..."
                            className="flex-1 bg-transparent text-xs py-1 outline-none"
                        />
                        {libSearch && (
                            <button onClick={() => setLibSearch('')} className="theme-text-muted"><X size={12}/></button>
                        )}
                    </div>
                    <select
                        value={libSort} onChange={e => setLibSort(e.target.value)}
                        className="theme-bg-secondary text-xs rounded px-1.5 py-1 border theme-border"
                    >
                        <option value="added_at">Date Added</option>
                        <option value="title">Title</option>
                        <option value="artist">Artist</option>
                        <option value="album">Album</option>
                    </select>
                    <button onClick={() => setLibViewMode(libViewMode === 'table' ? 'grid' : 'table')} className="p-1 theme-hover rounded" title="Toggle view">
                        {libViewMode === 'table' ? <LayoutGrid size={14}/> : <AlignJustify size={14}/>}
                    </button>
                    <button onClick={refreshLibrary} className="p-1 theme-hover rounded" title="Refresh">
                        <RotateCcw size={14} className={libRefreshing ? 'animate-spin' : ''}/>
                    </button>
                </div>

                {/* YouTube Search Panel */}
                {libShowYtSearch && (
                    <div className="border-b theme-border theme-bg-secondary p-3 shrink-0">
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text" placeholder="Search YouTube Music..." id="ytSearchInput"
                                className="flex-1 theme-input text-xs px-2 py-1"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const q = (e.target as HTMLInputElement).value.trim();
                                        if (!q) return;
                                        setLibYtSearching(true);
                                        setLibYtError(null);
                                        const r = await window.api?.libraryYoutubeSearch?.(q);
                                        if (r && !r.success) setLibYtError(r.error || 'Search failed');
                                        else setLibYtResults(r?.results || []);
                                        setLibYtSearching(false);
                                    }
                                }}
                            />
                            <button
                                onClick={async () => {
                                    const inp = document.getElementById('ytSearchInput') as HTMLInputElement;
                                    const q = inp?.value?.trim();
                                    if (!q) return;
                                    setLibYtSearching(true);
                                    setLibYtError(null);
                                    const r = await window.api?.libraryYoutubeSearch?.(q);
                                    if (r && !r.success) setLibYtError(r.error || 'Search failed');
                                    else setLibYtResults(r?.results || []);
                                    setLibYtSearching(false);
                                }}
                                disabled={libYtSearching}
                                className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded text-xs text-white"
                            >
                                {libYtSearching ? '...' : 'Search'}
                            </button>
                        </div>
                        {libYtError && (
                            <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded p-2 mb-2">
                                {libYtError}
                            </div>
                        )}
                        {libYtResults.length > 0 && (
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {libYtResults.map((r: any, i: number) => (
                                    <div key={r.id || i} className="flex items-center gap-2 px-2 py-1 rounded theme-hover text-xs">
                                        <Play size={10} className="text-red-400 cursor-pointer" onClick={() => {
                                            window.open(r.url, '_blank');
                                        }}/>
                                        <span className="flex-1 truncate">{r.title}</span>
                                        <span className="theme-text-muted">{r.duration ? `${Math.floor(r.duration)}s` : ''}</span>
                                        <span className="theme-text-muted text-[10px] truncate max-w-[100px]">{r.uploader}</span>
                                        <button
                                            onClick={async () => {
                                                setLibYtDownloading(r.id);
                                                const result = await window.api?.libraryYoutubeDownload?.(r.url);
                                                setLibYtDownloading(null);
                                                if (result?.success) refreshLibrary();
                                                else alert(result?.error || 'Download failed');
                                            }}
                                            disabled={libYtDownloading === r.id}
                                            className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-[10px] text-white whitespace-nowrap"
                                        >
                                            {libYtDownloading === r.id ? '...' : 'Download'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Main View Content */}
                {libRadioActive ? (
                    <RadioPanel
                        active={libRadioActive}
                        onStationPlay={(s) => { setLibRadioStation(s); }}
                        onStationStop={() => setLibRadioStation(null)}
                        radioStation={libRadioStation}
                        radioFavorites={libRadioFavorites}
                        setRadioFavorites={setLibRadioFavorites}
                    />
                ) : (
                    <div className="flex-1 overflow-auto">
                        {libLibraryView === 'playlists' && libSelectedPlaylist !== null ? (
                            /* Selected playlist tracks */
                            libPlaylistTracks.length === 0 ? (
                                <div className="flex items-center justify-center h-full theme-text-muted text-sm">Playlist is empty</div>
                            ) : (
                                <TrackTable tracks={libPlaylistTracks} numbered />
                            )
                        ) : libLibraryView === 'artists' && libSelectedArtist !== null ? (
                            /* Selected artist tracks */
                            <TrackTable tracks={artists.find(a => a[0] === libSelectedArtist)?.[1] || []} />
                        ) : libLibraryView === 'albums' && libSelectedAlbum !== null ? (
                            /* Selected album tracks */
                            <TrackTable tracks={albums.find(a => a[0] === libSelectedAlbum)?.[1].tracks || []} />
                        ) : libLibraryView === 'artists' ? (
                            /* Artists grid */
                            <div className="grid grid-cols-4 gap-3 p-3">
                                {artists.map(([name, tracks]) => (
                                    <div
                                        key={name}
                                        onClick={() => setLibSelectedArtist(name)}
                                        className="p-3 rounded-lg cursor-pointer theme-hover theme-bg-secondary"
                                    >
                                        <div className="aspect-square bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded flex items-center justify-center mb-2">
                                            <User size={28} className="text-purple-400"/>
                                        </div>
                                        <p className="text-[11px] font-medium truncate">{name}</p>
                                        <p className="text-[10px] theme-text-muted truncate">{tracks.length} song{tracks.length === 1 ? '' : 's'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : libLibraryView === 'albums' ? (
                            /* Albums grid */
                            <div className="grid grid-cols-4 gap-3 p-3">
                                {albums.map(([name, { artist, tracks }]) => (
                                    <div
                                        key={name}
                                        onClick={() => setLibSelectedAlbum(name)}
                                        className="p-3 rounded-lg cursor-pointer theme-hover theme-bg-secondary"
                                    >
                                        <div className="aspect-square bg-gradient-to-br from-pink-600/20 to-orange-600/20 rounded flex items-center justify-center mb-2">
                                            <Disc size={28} className="text-pink-400"/>
                                        </div>
                                        <p className="text-[11px] font-medium truncate">{name}</p>
                                        <p className="text-[10px] theme-text-muted truncate">{artist} · {tracks.length} song{tracks.length === 1 ? '' : 's'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : libLibraryView === 'playlists' ? (
                            /* Playlists grid */
                            <div className="grid grid-cols-4 gap-3 p-3">
                                {libPlaylists.map((pl: any) => (
                                    <div
                                        key={pl.id}
                                        onClick={() => setLibSelectedPlaylist(pl.id)}
                                        className="p-3 rounded-lg cursor-pointer theme-hover theme-bg-secondary"
                                    >
                                        <div className="aspect-square bg-gradient-to-br from-green-600/20 to-cyan-600/20 rounded flex items-center justify-center mb-2">
                                            <ListMusic size={28} className="text-green-400"/>
                                        </div>
                                        <p className="text-[11px] font-medium truncate">{pl.name}</p>
                                        {pl.auto_generated && <p className="text-[10px] theme-text-muted truncate">Auto-generated</p>}
                                    </div>
                                ))}
                            </div>
                        ) : filteredTracks.length === 0 ? (
                            /* Empty songs state */
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <Music size={48} className="mx-auto theme-text-muted mb-3"/>
                                    <p className="theme-text-muted text-sm">{libTracks.length === 0 ? 'No tracks indexed' : 'No matches'}</p>
                                    <p className="theme-text-muted text-xs mt-1">Index a folder or download from YouTube</p>
                                </div>
                            </div>
                        ) : libViewMode === 'table' ? (
                            /* Songs table */
                            <TrackTable tracks={filteredTracks} editable />
                        ) : (
                            /* Songs grid */
                            <div className="grid grid-cols-4 gap-3 p-3">
                                {filteredTracks.map((t: any) => (
                                    <div
                                        key={t.id}
                                        onDoubleClick={() => playTrack(t)}
                                        onClick={() => setSelectedAudio({ id: t.id.toString(), name: t.title || t.path, path: t.path, duration: t.duration })}
                                        className={`p-3 rounded-lg cursor-pointer transition-all theme-hover ${selectedAudio?.id === t.id.toString() ? 'bg-purple-600/20 ring-1 ring-purple-500' : 'theme-bg-secondary'}`}
                                    >
                                        <div className="aspect-square bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded flex items-center justify-center mb-2">
                                            <Music size={28} className="text-purple-400"/>
                                        </div>
                                        <p className="text-[11px] font-medium truncate">{t.title || t.path?.split('/').pop()?.split('\\').pop()}</p>
                                        <p className="text-[10px] theme-text-muted truncate">{t.artist || 'Unknown'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Queue Panel ── */}
            {libQueue.length > 0 && (
                <div className="w-48 border-l theme-border flex flex-col theme-bg-secondary shrink-0">
                    <div className="p-2 border-b theme-border flex items-center justify-between">
                        <span className="text-[10px] font-semibold theme-text-muted uppercase">Queue ({libQueue.length})</span>
                        <button onClick={clearQueue} className="text-[10px] text-red-400">Clear</button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {libQueue.map((t, i) => (
                            <div
                                key={`q-${i}`}
                                className={`px-2 py-1.5 text-[10px] border-b theme-border cursor-pointer theme-hover truncate ${i === libQueueIndex ? 'bg-purple-600/20 text-purple-300' : ''}`}
                                onDoubleClick={() => { setLibQueueIndex(i); playTrack(t); }}
                            >
                                <span className="theme-text-muted mr-1">{i + 1}.</span>
                                {t.title || t.path?.split('/').pop()?.split('\\').pop()}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LibraryPanel;
