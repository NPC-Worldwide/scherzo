import React from 'react';
import { Plus, Loader, Download, Trash2, X, FileJson, Sparkles } from 'lucide-react';
import { toMediaUrl } from '../lib/utils';

type RepertoireItem = {
    id: number; title: string; composer: string | null; album: string | null;
    audio_path: string | null; source_url: string | null; source_type: string | null;
    duration_sec?: number | null;
    created_at?: string; updated_at?: string;
};

type RepertoireSheetMeta = { id: number; name: string; xml_length: number; created_at?: string };

interface RepertoirePanelProps {
    repertoireItems: RepertoireItem[];
    repertoireSelectedId: number | null;
    repertoireSelected: RepertoireItem | null;
    repertoireSheets: RepertoireSheetMeta[];
    repertoireDownloading: boolean;
    repertoireDeriving: boolean;
    repertoireError: string | null;
    repertoireProgressLog: string[];
    repertoirePlaybackRate: number;
    repertoireYouTubeUrl: string;
    setRepertoireSelectedId: (id: number) => void;
    setRepertoireYouTubeUrl: (url: string) => void;
    setRepertoirePlaybackRate: (rate: number) => void;
    setRepertoireError: (error: string | null) => void;
    repertoireImportLocal: () => void;
    repertoireDownload: () => void;
    repertoireUpdateField: (field: 'title' | 'composer' | 'album', value: string) => void;
    repertoireDeleteCurrent: () => void;
    repertoireAttachSheetFromFile: () => void;
    repertoireDeriveCurrent: () => void;
    repertoireOpenSheetInNotation: (sheetId: number) => void;
    repertoireLoadDetail: (id: number) => void;
    repertoireAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

const RepertoirePanel: React.FC<RepertoirePanelProps> = ({
    repertoireItems,
    repertoireSelectedId,
    repertoireSelected,
    repertoireSheets,
    repertoireDownloading,
    repertoireDeriving,
    repertoireError,
    repertoireProgressLog,
    repertoirePlaybackRate,
    repertoireYouTubeUrl,
    setRepertoireSelectedId,
    setRepertoireYouTubeUrl,
    setRepertoirePlaybackRate,
    setRepertoireError,
    repertoireImportLocal,
    repertoireDownload,
    repertoireUpdateField,
    repertoireDeleteCurrent,
    repertoireAttachSheetFromFile,
    repertoireDeriveCurrent,
    repertoireOpenSheetInNotation,
    repertoireLoadDetail,
    repertoireAudioRef,
}) => {
    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Left rail — list */}
            <div className="w-64 shrink-0 border-r theme-border flex flex-col">
                <div className="px-3 py-2 border-b theme-border flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase theme-text-muted">Repertoire</span>
                    <button
                        onClick={repertoireImportLocal}
                        className="p-1 theme-hover rounded"
                        title="Add audio file"
                    >
                        <Plus size={14}/>
                    </button>
                </div>
                <div className="px-2 py-2 border-b theme-border space-y-1">
                    <input
                        type="text"
                        value={repertoireYouTubeUrl}
                        onChange={(e) => setRepertoireYouTubeUrl(e.target.value)}
                        placeholder="Paste YouTube URL…"
                        className="theme-input text-xs w-full"
                        disabled={repertoireDownloading}
                        onKeyDown={(e) => { if (e.key === 'Enter') repertoireDownload(); }}
                    />
                    <button
                        onClick={repertoireDownload}
                        disabled={repertoireDownloading || !repertoireYouTubeUrl.trim()}
                        className={`w-full text-xs py-1 rounded flex items-center justify-center gap-1 ${
                            repertoireDownloading
                                ? 'theme-bg-tertiary opacity-50'
                                : 'bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40'
                        }`}
                    >
                        {repertoireDownloading ? <><Loader size={11} className="animate-spin"/> Downloading…</> : <><Download size={11}/> Import (yt-dlp)</>}
                    </button>
                    {repertoireDownloading && repertoireProgressLog.length > 0 && (
                        <div className="mt-1 max-h-24 overflow-y-auto rounded border theme-border bg-black/40 p-1 text-[10px] font-mono leading-tight whitespace-pre-wrap">
                            {repertoireProgressLog.slice(-6).map((l, i) => (
                                <div key={i} className="text-green-300 truncate">{l}</div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {repertoireItems.length === 0 ? (
                        <div className="text-xs theme-text-muted p-4 text-center">
                            No pieces yet. Add audio or paste a YouTube URL above.
                        </div>
                    ) : (
                        repertoireItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setRepertoireSelectedId(item.id)}
                                className={`w-full text-left px-3 py-2 border-b theme-border ${
                                    item.id === repertoireSelectedId ? 'bg-purple-600/20 text-purple-200' : 'theme-hover'
                                }`}
                            >
                                <div className="text-sm font-medium truncate">{item.title || 'Untitled'}</div>
                                {item.composer && <div className="text-[11px] theme-text-muted truncate">{item.composer}</div>}
                                {item.album && <div className="text-[10px] theme-text-muted truncate italic">{item.album}</div>}
                                {item.source_type && (
                                    <div className="text-[10px] theme-text-muted mt-0.5 uppercase">{item.source_type}</div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right pane — detail */}
            <div className="flex-1 flex flex-col overflow-auto">
                {!repertoireSelected ? (
                    <div className="flex-1 flex items-center justify-center theme-text-muted text-sm">
                        Select a piece, or add one from the left.
                    </div>
                ) : (
                    <div className="p-6 max-w-4xl mx-auto w-full">
                        {repertoireError && (
                            <div className="mb-3 px-3 py-2 rounded bg-red-900/40 text-red-200 text-xs flex items-center justify-between">
                                <span>{repertoireError}</span>
                                <button onClick={() => setRepertoireError(null)} className="opacity-60 hover:opacity-100"><X size={12}/></button>
                            </div>
                        )}
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex-1 space-y-1">
                                <input
                                    type="text"
                                    value={repertoireSelected.title}
                                    onChange={(e) => repertoireUpdateField('title', e.target.value)}
                                    className="text-2xl font-semibold w-full bg-transparent border-none outline-none theme-text-primary"
                                    placeholder="Title"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                        <span className="text-[10px] uppercase theme-text-muted">Artist / Composer</span>
                                        <input
                                            type="text"
                                            value={repertoireSelected.composer || ''}
                                            onChange={(e) => repertoireUpdateField('composer', e.target.value)}
                                            className="theme-input text-sm w-full"
                                            placeholder="Artist or composer"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-[10px] uppercase theme-text-muted">Album</span>
                                        <input
                                            type="text"
                                            value={repertoireSelected.album || ''}
                                            onChange={(e) => repertoireUpdateField('album', e.target.value)}
                                            className="theme-input text-sm w-full"
                                            placeholder="Album"
                                        />
                                    </label>
                                </div>
                            </div>
                            <button
                                onClick={repertoireDeleteCurrent}
                                className="p-2 theme-hover rounded text-red-400 mt-1"
                                title="Delete piece"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>

                        {/* Audio player */}
                        {repertoireSelected.audio_path ? (
                            <div className="mb-4 p-3 theme-bg-tertiary rounded border theme-border">
                                <audio
                                    ref={repertoireAudioRef}
                                    src={toMediaUrl(repertoireSelected.audio_path || '')}
                                    controls
                                    controlsList="noplaybackrate nodownload"
                                    className="w-full"
                                    onLoadedMetadata={(e) => {
                                        const a = e.currentTarget;
                                        a.playbackRate = repertoirePlaybackRate;
                                        try {
                                            (a as any).preservesPitch = true;
                                            (a as any).mozPreservesPitch = true;
                                            (a as any).webkitPreservesPitch = true;
                                        } catch {}
                                    }}
                                    onRateChange={(e) => {
                                        // Keep the slider in sync if the user changes rate via the native menu
                                        const a = e.currentTarget;
                                        if (Math.abs(a.playbackRate - repertoirePlaybackRate) > 0.001) {
                                            setRepertoirePlaybackRate(a.playbackRate);
                                        }
                                    }}
                                />
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs theme-text-muted shrink-0">Speed</span>
                                    <select
                                        value={repertoirePlaybackRate}
                                        onChange={(e) => {
                                            const rate = parseFloat(e.target.value);
                                            setRepertoirePlaybackRate(rate);
                                            if (repertoireAudioRef.current) repertoireAudioRef.current.playbackRate = rate;
                                        }}
                                        className="theme-bg-tertiary theme-border border rounded px-2 py-0.5 text-sm font-mono cursor-pointer"
                                        title="Change playback speed"
                                    >
                                        {[0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map(r => (
                                            <option key={r} value={r}>{r.toFixed(2)}×</option>
                                        ))}
                                    </select>
                                </div>
                                {repertoireSelected.source_url && (
                                    <div className="mt-2 text-[10px] theme-text-muted truncate">
                                        Source: {repertoireSelected.source_url}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="mb-4 p-3 theme-bg-tertiary rounded border theme-border text-xs theme-text-muted">
                                No audio attached.
                            </div>
                        )}

                        {/* Sheets */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase theme-text-muted">Sheet music</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={repertoireAttachSheetFromFile}
                                        className="text-[11px] px-2 py-0.5 rounded theme-hover border theme-border flex items-center gap-1"
                                        title="Attach a MusicXML file"
                                    >
                                        <Plus size={11}/> Attach
                                    </button>
                                    <button
                                        onClick={repertoireDeriveCurrent}
                                        className="text-[11px] px-2 py-0.5 rounded theme-hover border theme-border flex items-center gap-1 disabled:opacity-40"
                                        title="Derive sheet music from audio (basic-pitch)"
                                        disabled={!repertoireSelected.audio_path || repertoireDeriving}
                                    >
                                        {repertoireDeriving
                                            ? <><Loader size={11} className="animate-spin"/> Deriving…</>
                                            : <><Sparkles size={11}/> Derive (beta)</>}
                                    </button>
                                </div>
                            </div>
                            {repertoireSheets.length === 0 ? (
                                <div className="text-xs theme-text-muted p-3 border theme-border rounded">
                                    No sheets attached. Attach a MusicXML / .mxl file, or derive from the audio.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {repertoireSheets.map(s => (
                                        <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 theme-bg-tertiary border theme-border rounded">
                                            <button
                                                onClick={() => repertoireOpenSheetInNotation(s.id)}
                                                className="flex-1 text-left text-sm hover:text-purple-300 truncate"
                                                title="Open in Notation editor"
                                            >
                                                <FileJson size={12} className="inline mr-1.5"/>{s.name}
                                            </button>
                                            <span className="text-[10px] theme-text-muted">{Math.round((s.xml_length || 0) / 1024)} KB</span>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Delete sheet "${s.name}"?`)) return;
                                                    const api = window.api;
                                                    await api.repertoireDeleteSheet(s.id);
                                                    if (repertoireSelectedId) repertoireLoadDetail(repertoireSelectedId);
                                                }}
                                                className="theme-hover rounded p-1 text-red-400"
                                                title="Delete sheet"
                                            >
                                                <Trash2 size={11}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RepertoirePanel;
