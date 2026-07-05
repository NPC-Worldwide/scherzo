import React, { useRef } from 'react';
import {
    Play, Pause, Square, Circle, SkipBack, SkipForward,
    Volume2, Upload, Download, Trash2, Plus,
    Scissors, Copy, ClipboardPaste, Undo, Redo, ZoomIn, ZoomOut,
    Grid, Tag, Sliders, Repeat,
    FastForward, Rewind, Lock, Unlock, Move, MousePointer, Magnet,
    BarChart3, ChevronRight
} from 'lucide-react';

const TRACK_COLORS = [
    { bg: 'from-purple-600 to-purple-800', border: 'border-purple-500', text: 'text-purple-400' },
    { bg: 'from-blue-600 to-blue-800', border: 'border-blue-500', text: 'text-blue-400' },
    { bg: 'from-green-600 to-green-800', border: 'border-green-500', text: 'text-green-400' },
    { bg: 'from-orange-600 to-orange-800', border: 'border-orange-500', text: 'text-orange-400' },
    { bg: 'from-pink-600 to-pink-800', border: 'border-pink-500', text: 'text-pink-400' },
    { bg: 'from-cyan-600 to-cyan-800', border: 'border-cyan-500', text: 'text-cyan-400' },
    { bg: 'from-red-600 to-red-800', border: 'border-red-500', text: 'text-red-400' },
    { bg: 'from-yellow-600 to-yellow-800', border: 'border-yellow-500', text: 'text-yellow-400' },
];

interface AudioFile {
    id: string;
    name: string;
    path: string;
    duration?: number;
    waveform?: number[];
    bpm?: number;
    key?: string;
}

interface AudioTrack {
    id: string;
    name: string;
    clips: AudioClip[];
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    color: number;
    height: number;
}

interface AudioClip {
    id: string;
    audioId: string;
    startTime: number;
    duration: number;
    offset: number;
    name: string;
    gain: number;
    fadeIn: number;
    fadeOut: number;
    color?: number;
}

interface TimelineMarker {
    id: string;
    time: number;
    name: string;
    color: string;
}

interface DragStateType {
    type: 'move' | 'resize-left' | 'resize-right' | 'fade-in' | 'fade-out' | 'selection' | null;
    clipId?: string;
    trackId?: string;
    startX: number;
    startTime: number;
    originalClip?: AudioClip;
}

interface ContextMenuType {
    x: number;
    y: number;
    clipId?: string;
    trackId?: string;
}

interface EditorPanelProps {
    tracks: AudioTrack[];
    setTracks: React.Dispatch<React.SetStateAction<AudioTrack[]>>;
    editorPlayhead: number;
    setEditorPlayhead: React.Dispatch<React.SetStateAction<number>>;
    isEditorPlaying: boolean;
    setIsEditorPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    editorTool: 'select' | 'cut' | 'move';
    setEditorTool: React.Dispatch<React.SetStateAction<'select' | 'cut' | 'move'>>;
    editorZoom: number;
    setEditorZoom: React.Dispatch<React.SetStateAction<number>>;
    editorPosition: number;
    setEditorPosition: React.Dispatch<React.SetStateAction<number>>;
    isRecording: boolean;
    setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
    selectedClipId: string | null;
    setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>;
    lockedTracks: Set<string>;
    setLockedTracks: React.Dispatch<React.SetStateAction<Set<string>>>;
    armedTracks: Set<string>;
    setArmedTracks: React.Dispatch<React.SetStateAction<Set<string>>>;
    markers: TimelineMarker[];
    setMarkers: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
    projectBpm: number;
    setProjectBpm: React.Dispatch<React.SetStateAction<number>>;
    showBpmGrid: boolean;
    setShowBpmGrid: React.Dispatch<React.SetStateAction<boolean>>;
    waveformZoom: number;
    setWaveformZoom: React.Dispatch<React.SetStateAction<number>>;
    showEffectsPanel: boolean;
    setShowEffectsPanel: React.Dispatch<React.SetStateAction<boolean>>;
    masterVolume: number;
    setMasterVolume: React.Dispatch<React.SetStateAction<number>>;
    audioFiles: AudioFile[];
    setAudioFiles: React.Dispatch<React.SetStateAction<AudioFile[]>>;
    waveformCache: Map<string, number[]>;
    waveformDataCache: Map<string, Float32Array>;
    selectionRange: { start: number; end: number } | null;
    setSelectionRange: React.Dispatch<React.SetStateAction<{ start: number; end: number } | null>>;
    loopEnabled: boolean;
    setLoopEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    loopStart: number;
    setLoopStart: React.Dispatch<React.SetStateAction<number>>;
    loopEnd: number;
    setLoopEnd: React.Dispatch<React.SetStateAction<number>>;
    contextMenu: ContextMenuType | null;
    setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuType | null>>;
    snapToGrid: boolean;
    setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>;
    gridSize: 0.25 | 0.5 | 1 | 2 | 4;
    setGridSize: React.Dispatch<React.SetStateAction<0.25 | 0.5 | 1 | 2 | 4>>;
    undoStack: AudioTrack[][];
    redoStack: AudioTrack[][];
    clipboard: AudioClip | null;
    dragState: DragStateType | null;
    setDragState: React.Dispatch<React.SetStateAction<DragStateType | null>>;
    trackLevels: Map<string, { left: number; right: number }>;
    recordingWaveform: number[];
    setRecordingWaveform: React.Dispatch<React.SetStateAction<number[]>>;
    selectedAudio: AudioFile | null;
    audioSource: string;
    recordingClipRef: React.MutableRefObject<HTMLDivElement | null>;
    recordingWaveCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
    recordingWaveAnimRef: React.MutableRefObject<number | null>;
    recordingAudioCtxRef: React.MutableRefObject<AudioContext | null>;
    recordingAnalyserRef: React.MutableRefObject<AnalyserNode | null>;
    mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>;
    recordingStartTimeRef: React.MutableRefObject<number>;
    recordingPlayheadStartRef: React.MutableRefObject<number>;
    recordingHistoryRef: React.MutableRefObject<number[]>;
    recordingStartDrawRef: React.MutableRefObject<(() => void) | null>;
    editorContainerRef: React.MutableRefObject<HTMLDivElement | null>;
    addMarker: (name?: string) => void;
    playEditorTimeline: () => void;
    stopEditorTimeline: () => void;
    cutClip: () => void;
    copyClip: () => void;
    pasteClip: (trackId: string, time: number) => void;
    deleteClip: () => void;
    splitClipAtPlayhead: () => void;
    saveUndoState: () => void;
    editorUndo: () => void;
    editorRedo: () => void;
    loadWaveform: (audioPath: string, audioId: string) => void;
    loadAudioFiles: (source: string) => void;
    exportTimeline: () => void;
    duplicateClip: (clipId: string) => void;
    normalizeClip: (clipId: string) => void;
    addFadeToClip: (clipId: string, fadeType: 'in' | 'out', duration: number) => void;
    adjustClipGain: (clipId: string, gain: number) => void;
    setClipColor: (clipId: string, colorIndex: number) => void;
    formatTime: (seconds: number) => string;
    formatTimeMs: (seconds: number) => string;
    snapToGridTime: (time: number) => number;
    renderWaveformPath: (audioId: string, clipWidth: number, clipHeight: number, offset: number, clipDuration: number, audioDuration: number) => string;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
    tracks,
    setTracks,
    editorPlayhead,
    setEditorPlayhead,
    isEditorPlaying,
    setIsEditorPlaying,
    editorTool,
    setEditorTool,
    editorZoom,
    setEditorZoom,
    editorPosition,
    setEditorPosition,
    isRecording,
    setIsRecording,
    selectedClipId,
    setSelectedClipId,
    lockedTracks,
    setLockedTracks,
    armedTracks,
    setArmedTracks,
    markers,
    setMarkers,
    projectBpm,
    setProjectBpm,
    showBpmGrid,
    setShowBpmGrid,
    waveformZoom,
    setWaveformZoom,
    showEffectsPanel,
    setShowEffectsPanel,
    masterVolume,
    setMasterVolume,
    audioFiles,
    setAudioFiles,
    waveformCache,
    waveformDataCache,
    selectionRange,
    setSelectionRange,
    loopEnabled,
    setLoopEnabled,
    loopStart,
    setLoopStart,
    loopEnd,
    setLoopEnd,
    contextMenu,
    setContextMenu,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    undoStack,
    redoStack,
    clipboard,
    dragState,
    setDragState,
    trackLevels,
    recordingWaveform,
    setRecordingWaveform,
    selectedAudio,
    audioSource,
    recordingClipRef,
    recordingWaveCanvasRef,
    recordingWaveAnimRef,
    recordingAudioCtxRef,
    recordingAnalyserRef,
    mediaRecorderRef,
    recordingStartTimeRef,
    recordingPlayheadStartRef,
    recordingHistoryRef,
    recordingStartDrawRef,
    editorContainerRef,
    addMarker,
    playEditorTimeline,
    stopEditorTimeline,
    cutClip,
    copyClip,
    pasteClip,
    deleteClip,
    splitClipAtPlayhead,
    saveUndoState,
    editorUndo,
    editorRedo,
    loadWaveform,
    loadAudioFiles,
    exportTimeline,
    duplicateClip,
    normalizeClip,
    addFadeToClip,
    adjustClipGain,
    setClipColor,
    formatTime,
    formatTimeMs,
    snapToGridTime,
    renderWaveformPath,
}) => {
    const pixelsPerSecond = 50 * editorZoom;
    const totalDuration = Math.max(60, ...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration + 10)));
    const timelineWidth = totalDuration * pixelsPerSecond;

    const markerInterval = editorZoom >= 2 ? 1 : editorZoom >= 1 ? 2 : editorZoom >= 0.5 ? 5 : 10;
    const rulerMarkers: number[] = [];
    for (let t = 0; t <= totalDuration; t += markerInterval) {
        rulerMarkers.push(t);
    }

    const LevelMeter = ({ trackId }: { trackId: string }) => {
        const levels = trackLevels.get(trackId) || { left: 0, right: 0 };
        return (
            <div className="flex gap-0.5 h-12">
                {['left', 'right'].map(ch => (
                    <div key={ch} className="w-1.5 theme-bg-secondary rounded-sm overflow-hidden flex flex-col-reverse">
                        <div
                            className={`transition-all duration-75 ${levels[ch as 'left' | 'right'] > 0.9 ? 'bg-red-500' : levels[ch as 'left' | 'right'] > 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ height: `${levels[ch as 'left' | 'right'] * 100}%` }}
                        />
                    </div>
                ))}
            </div>
        );
    };

    const PanKnob = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
        const rotation = value * 135;
        return (
            <div
                className="w-6 h-6 rounded-full theme-bg-tertiary border-2 theme-border cursor-pointer relative flex items-center justify-center"
                onMouseDown={(e) => {
                    const startY = e.clientY;
                    const startVal = value;
                    const onMove = (me: MouseEvent) => {
                        const delta = (startY - me.clientY) / 50;
                        onChange(Math.max(-1, Math.min(1, startVal + delta)));
                    };
                    const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                }}
                onDoubleClick={() => onChange(0)}
                title={`Pan: ${value === 0 ? 'C' : value < 0 ? `L${Math.abs(Math.round(value * 100))}` : `R${Math.round(value * 100)}`}`}
            >
                <div
                    className="w-0.5 h-2 bg-purple-400 absolute"
                    style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'bottom center', bottom: '50%' }}
                />
                <div className="w-1 h-1 rounded-full bg-gray-500" />
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-10 border-b theme-border flex items-center px-2 gap-1 theme-bg-secondary">
                <div className="flex theme-bg-primary rounded p-0.5 mr-2">
                    <button
                        onClick={() => setEditorTool('select')}
                        className={`p-1.5 rounded ${editorTool === 'select' ? 'bg-purple-600' : 'theme-hover'}`}
                        title="Select Tool (V)"
                    >
                        <MousePointer size={14}/>
                    </button>
                    <button
                        onClick={() => setEditorTool('move')}
                        className={`p-1.5 rounded ${editorTool === 'move' ? 'bg-purple-600' : 'theme-hover'}`}
                        title="Move Tool (M)"
                    >
                        <Move size={14}/>
                    </button>
                    <button
                        onClick={() => setEditorTool('cut')}
                        className={`p-1.5 rounded ${editorTool === 'cut' ? 'bg-purple-600' : 'theme-hover'}`}
                        title="Cut Tool (C)"
                    >
                        <Scissors size={14}/>
                    </button>
                </div>

                <button onClick={editorUndo} disabled={undoStack.length === 0}
                        className={`p-1.5 rounded ${undoStack.length > 0 ? 'theme-hover' : 'opacity-40'}`} title="Undo (Ctrl+Z)">
                    <Undo size={14}/>
                </button>
                <button onClick={editorRedo} disabled={redoStack.length === 0}
                        className={`p-1.5 rounded ${redoStack.length > 0 ? 'theme-hover' : 'opacity-40'}`} title="Redo (Ctrl+Y)">
                    <Redo size={14}/>
                </button>
                <div className="w-px h-5 theme-bg-tertiary mx-1"/>
                <button onClick={cutClip} disabled={!selectedClipId}
                        className={`p-1.5 rounded ${selectedClipId ? 'theme-hover' : 'opacity-40'}`} title="Cut (Ctrl+X)">
                    <Scissors size={14}/>
                </button>
                <button onClick={copyClip} disabled={!selectedClipId}
                        className={`p-1.5 rounded ${selectedClipId ? 'theme-hover' : 'opacity-40'}`} title="Copy (Ctrl+C)">
                    <Copy size={14}/>
                </button>
                <button onClick={() => tracks.length > 0 && pasteClip(tracks[0].id, editorPlayhead)}
                        disabled={!clipboard} className={`p-1.5 rounded ${clipboard ? 'theme-hover' : 'opacity-40'}`} title="Paste (Ctrl+V)">
                    <ClipboardPaste size={14}/>
                </button>
                <button onClick={deleteClip} disabled={!selectedClipId}
                        className={`p-1.5 rounded ${selectedClipId ? 'theme-hover text-red-400' : 'opacity-40'}`} title="Delete">
                    <Trash2 size={14}/>
                </button>
                <div className="w-px h-5 theme-bg-tertiary mx-1"/>
                <button onClick={splitClipAtPlayhead} disabled={!selectedClipId}
                        className={`p-1.5 rounded ${selectedClipId ? 'theme-hover' : 'opacity-40'}`} title="Split at Playhead (S)">
                    <Scissors size={14} className="rotate-90"/>
                </button>

                <div className="w-px h-5 theme-bg-tertiary mx-1"/>
                <button
                    onClick={() => setSnapToGrid(!snapToGrid)}
                    className={`p-1.5 rounded flex items-center gap-1 ${snapToGrid ? 'bg-purple-600' : 'theme-hover'}`}
                    title="Snap to Grid (G)"
                >
                    <Magnet size={14}/>
                </button>
                <select
                    value={gridSize}
                    onChange={(e) => setGridSize(parseFloat(e.target.value) as any)}
                    className="px-1.5 py-0.5 theme-bg-secondary border theme-border rounded text-xs"
                    disabled={!snapToGrid}
                >
                    <option value={0.25}>1/4s</option>
                    <option value={0.5}>1/2s</option>
                    <option value={1}>1s</option>
                    <option value={2}>2s</option>
                    <option value={4}>4s</option>
                </select>

                <div className="w-px h-5 theme-bg-tertiary mx-1"/>
                <button onClick={() => setEditorZoom(Math.max(0.25, editorZoom - 0.25))} className="p-1.5 theme-hover rounded">
                    <ZoomOut size={14}/>
                </button>
                <span className="text-xs theme-text-muted w-10 text-center">{Math.round(editorZoom * 100)}%</span>
                <button onClick={() => setEditorZoom(Math.min(8, editorZoom + 0.25))} className="p-1.5 theme-hover rounded">
                    <ZoomIn size={14}/>
                </button>

                <div className="w-px h-5 theme-bg-tertiary mx-1"/>
                <button
                    onClick={() => setShowEffectsPanel(!showEffectsPanel)}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${showEffectsPanel ? 'bg-purple-600' : 'theme-bg-tertiary theme-hover'}`}
                >
                    <Sliders size={12}/> FX
                </button>

                <div className="w-px h-5 theme-bg-tertiary mx-1"/>
                <button
                    onClick={async () => {
                        const api = window.api;
                        if (!api?.showOpenDialog) { alert('file dialog IPC missing — restart app'); return; }
                        const result = await api.showOpenDialog({
                            title: 'Import Audio Files',
                            properties: ['openFile', 'multiSelections'],
                            filters: [
                                { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'aiff', 'wma', 'webm'] },
                                { name: 'All Files', extensions: ['*'] },
                            ],
                        });
                        const picked: string[] = Array.isArray(result)
                            ? result.map((r: any) => r?.path).filter(Boolean)
                            : (result?.filePaths || []);
                        if (picked.length === 0) return;

                        const newFiles = picked.map((p, i) => ({
                            id: `imported_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                            name: p.split('/').pop() || p,
                            path: p,
                            duration: 0,
                        }));
                        setAudioFiles(prev => {
                            const existing = new Set(prev.map(f => f.path));
                            return [...prev, ...newFiles.filter(f => !existing.has(f.path))];
                        });

                        const probeDuration = (src: string) => new Promise<number>(resolve => {
                            const a = new Audio();
                            a.preload = 'metadata';
                            a.onloadedmetadata = () => resolve(a.duration || 5);
                            a.onerror = () => resolve(5);
                            a.src = `file://${src}`;
                        });

                        saveUndoState();
                        for (let i = 0; i < newFiles.length; i++) {
                            const f = newFiles[i];
                            const dur = await probeDuration(f.path);
                            setAudioFiles(prev => prev.map(af => af.id === f.id ? { ...af, duration: dur } : af));
                            const clip = {
                                id: `clip_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                                audioId: f.id,
                                startTime: editorPlayhead,
                                duration: dur,
                                offset: 0,
                                name: f.name,
                                gain: 1,
                                fadeIn: 0,
                                fadeOut: 0,
                            };
                            setTracks(prev => {
                                if (prev[i]) {
                                    return prev.map((t, idx) => idx === i ? { ...t, clips: [...t.clips, clip] } : t);
                                }
                                return [...prev, {
                                    id: `track-${prev.length + 1}`,
                                    name: `Track ${prev.length + 1}`,
                                    clips: [clip],
                                    volume: 1, pan: 0, muted: false, solo: false,
                                    color: prev.length % TRACK_COLORS.length, height: 80,
                                }];
                            });
                            loadWaveform(f.path, f.id);
                        }
                    }}
                    className="px-2 py-1 rounded text-xs flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white"
                    title="Import audio files from disk as new clips"
                >
                    <Upload size={12}/> Import Audio
                </button>

                <div className="flex-1"/>

                <button
                    onClick={async () => {
                        if (isRecording) {
                            mediaRecorderRef.current?.stop();
                            setIsRecording(false);
                            setRecordingWaveform([]);
                            if (recordingWaveAnimRef.current) {
                                cancelAnimationFrame(recordingWaveAnimRef.current);
                                recordingWaveAnimRef.current = null;
                            }
                            if (recordingAudioCtxRef.current) {
                                recordingAudioCtxRef.current.close();
                                recordingAudioCtxRef.current = null;
                            }
                            recordingAnalyserRef.current = null;
                        } else {
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                const recorder = new MediaRecorder(stream);
                                mediaRecorderRef.current = recorder;
                                const chunks: Blob[] = [];
                                let recordFileName = '';
                                recorder.ondataavailable = (e) => chunks.push(e.data);
                                recorder.onstop = async () => {
                                    const blob = new Blob(chunks, { type: 'audio/webm' });
                                    const arrayBuffer = await blob.arrayBuffer();
                                    recordFileName = `recording_${Date.now()}.webm`;
                                    const savePath = audioSource ? `${audioSource}/${recordFileName}` : recordFileName;
                                    const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
                                    const startTime = recordingPlayheadStartRef.current;
                                    try {
                                        await window.api?.writeFileBuffer?.(savePath, new Uint8Array(arrayBuffer));
                                    } catch (e) { console.error('Failed to save recording:', e); }
                                    const newAudioId = `audio_${Date.now()}_rec`;
                                    setAudioFiles(prev => [...prev, { id: newAudioId, name: recordFileName, path: savePath, duration }]);
                                    const newClip = { id: `clip_${Date.now()}`, audioId: newAudioId, startTime, duration, offset: 0, name: recordFileName, gain: 1, fadeIn: 0, fadeOut: 0 };
                                    setTracks(tp => {
                                        if (tp.length === 0) return [{ id: 'track-1', name: 'Track 1', clips: [newClip], volume: 1, pan: 0, muted: false, solo: false, color: 0, height: 80 }];
                                        return tp.map((t, i) => i === 0 ? { ...t, clips: [...t.clips, newClip] } : t);
                                    });
                                };
                                recorder.start();
                                recordingStartTimeRef.current = Date.now();
                                recordingPlayheadStartRef.current = editorPlayhead;
                                recordingHistoryRef.current = [];
                                setIsRecording(true);

                                const audioCtx = new AudioContext();
                                recordingAudioCtxRef.current = audioCtx;
                                const source = audioCtx.createMediaStreamSource(stream);
                                const analyser = audioCtx.createAnalyser();
                                analyser.fftSize = 256;
                                source.connect(analyser);
                                const monitorGain = audioCtx.createGain();
                                monitorGain.gain.value = 0;
                                analyser.connect(monitorGain);
                                monitorGain.connect(audioCtx.destination);
                                recordingAnalyserRef.current = analyser;
                                const dataArray = new Uint8Array(analyser.fftSize);

                                const drawWave = () => {
                                    if (!recordingAnalyserRef.current) return;
                                    recordingAnalyserRef.current.getByteTimeDomainData(dataArray);
                                    const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
                                    if (recordingClipRef.current) {
                                        recordingClipRef.current.style.width = `${Math.max(80, elapsed * pixelsPerSecond)}px`;
                                    }
                                    const step = Math.max(1, Math.floor(dataArray.length / 40));
                                    for (let i = 0; i < dataArray.length; i += step) {
                                        recordingHistoryRef.current.push((dataArray[i] - 128) / 128);
                                    }
                                    const maxSamples = 60 * 60;
                                    if (recordingHistoryRef.current.length > maxSamples) {
                                        recordingHistoryRef.current = recordingHistoryRef.current.slice(-maxSamples);
                                    }
                                    const canvas = recordingWaveCanvasRef.current;
                                    if (canvas) {
                                        const r = canvas.getBoundingClientRect();
                                        const w = r.width;
                                        const h = r.height;
                                        if (w > 0 && h > 0) {
                                            if (canvas.width !== Math.round(w)) canvas.width = Math.round(w);
                                            if (canvas.height !== Math.round(h)) canvas.height = Math.round(h);
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                ctx.strokeStyle = '#ef4444';
                                                ctx.lineWidth = 1.5;
                                                const history = recordingHistoryRef.current;
                                                if (history.length > 0) {
                                                    ctx.beginPath();
                                                    const midY = canvas.height / 2;
                                                    const amp = midY - 4;
                                                    for (let x = 0; x < canvas.width; x++) {
                                                        const i = Math.floor((x / canvas.width) * history.length);
                                                        const v = history[Math.min(i, history.length - 1)];
                                                        const y = midY + v * amp;
                                                        if (x === 0) ctx.moveTo(x, y);
                                                        else ctx.lineTo(x, y);
                                                    }
                                                    ctx.stroke();
                                                }
                                            }
                                        }
                                    }
                                    recordingWaveAnimRef.current = requestAnimationFrame(drawWave);
                                };
                                recordingStartDrawRef.current = () => {
                                    if (recordingWaveAnimRef.current) cancelAnimationFrame(recordingWaveAnimRef.current);
                                    drawWave();
                                };
                            } catch (err) { console.error('Recording error:', err); }
                        }
                    }}
                    className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'}`}
                >
                    <Circle size={10} fill={isRecording ? 'currentColor' : 'none'}/>
                    {isRecording ? 'Recording...' : 'REC'}
                </button>

                <div className="w-px h-5 theme-bg-tertiary mx-1"/>

                <div className="flex items-center gap-1 theme-bg-primary rounded px-2 py-0.5">
                    <span className="text-[10px] theme-text-muted">BPM</span>
                    <input
                        type="number"
                        value={projectBpm}
                        onChange={(e) => setProjectBpm(Math.max(20, Math.min(300, parseInt(e.target.value) || 120)))}
                        className="w-12 bg-transparent text-xs font-mono text-center"
                    />
                    <button
                        onClick={() => setShowBpmGrid(!showBpmGrid)}
                        className={`p-0.5 rounded ${showBpmGrid ? 'bg-purple-600' : 'theme-hover'}`}
                        title="Show beat grid"
                    >
                        <Grid size={10}/>
                    </button>
                </div>

                <button
                    onClick={() => addMarker()}
                    className="px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded text-xs flex items-center gap-1"
                    title="Add Marker (M)"
                >
                    <Tag size={10}/> Marker
                </button>

                <div className="flex items-center gap-1">
                    <span className="text-[10px] theme-text-muted">Wave</span>
                    <button onClick={() => setWaveformZoom(Math.max(0.5, waveformZoom - 0.25))} className="p-0.5 theme-hover rounded">
                        <ZoomOut size={10}/>
                    </button>
                    <span className="text-[10px] w-6 text-center">{Math.round(waveformZoom * 100)}%</span>
                    <button onClick={() => setWaveformZoom(Math.min(3, waveformZoom + 0.25))} className="p-0.5 theme-hover rounded">
                        <ZoomIn size={10}/>
                    </button>
                </div>
            </div>

            {showEffectsPanel && (
                <div className="h-24 border-b theme-border theme-bg-secondary p-2 flex gap-3 overflow-x-auto">
                    <div className="flex flex-col gap-0.5 min-w-[100px]">
                        <span className="text-[10px] theme-text-muted uppercase">Master</span>
                        <input type="range" min={0} max={2} step={0.01} value={masterVolume}
                               onChange={(e) => setMasterVolume(parseFloat(e.target.value))} className="w-full h-1.5 accent-purple-500"/>
                        <span className="text-[10px] theme-text-muted text-center">{Math.round(masterVolume * 100)}%</span>
                    </div>
                    {['Reverb', 'Delay', 'Chorus'].map(fx => (
                        <div key={fx} className="flex flex-col gap-0.5 min-w-[80px]">
                            <span className="text-[10px] theme-text-muted uppercase">{fx}</span>
                            <input type="range" min={0} max={1} step={0.01} defaultValue={0} className="w-full h-1.5 accent-purple-500"/>
                            <span className="text-[10px] theme-text-muted text-center">0%</span>
                        </div>
                    ))}
                    <div className="w-px theme-bg-tertiary"/>
                    {['Low', 'Mid', 'High'].map(band => (
                        <div key={band} className="flex flex-col gap-0.5 min-w-[60px]">
                            <span className="text-[10px] theme-text-muted uppercase">{band} EQ</span>
                            <input type="range" min={-12} max={12} step={0.5} defaultValue={0} className="w-full h-1.5 accent-blue-500"/>
                            <span className="text-[10px] theme-text-muted text-center">0dB</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex-1 flex overflow-hidden" ref={editorContainerRef}>
                <div className="w-52 border-r theme-border flex flex-col theme-bg-secondary flex-shrink-0">
                    <div className="h-6 border-b theme-border flex items-center px-2 theme-bg-primary">
                        <span className="text-[10px] theme-text-muted uppercase">Tracks</span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {tracks.map((track, trackIdx) => {
                            const isLocked = lockedTracks.has(track.id);
                            const isArmed = armedTracks.has(track.id);
                            return (
                                <div
                                    key={track.id}
                                    className={`h-20 border-b theme-border p-1.5 flex flex-col ${
                                        track.muted ? 'opacity-60' : ''
                                    } ${isLocked ? 'theme-bg-secondary' : ''}`}
                                >
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className="text-[10px] theme-text-muted w-4">{trackIdx + 1}</span>
                                        <input
                                            type="text"
                                            value={track.name}
                                            onChange={(e) => setTracks(prev => prev.map(t =>
                                                t.id === track.id ? {...t, name: e.target.value} : t
                                            ))}
                                            disabled={isLocked}
                                            className="flex-1 bg-transparent text-xs font-medium theme-text-primary border-b border-transparent hover:border-current focus:border-purple-500 outline-none"
                                        />
                                        <button
                                            onClick={() => setLockedTracks(prev => {
                                                const next = new Set(prev);
                                                if (next.has(track.id)) next.delete(track.id);
                                                else next.add(track.id);
                                                return next;
                                            })}
                                            className={`p-0.5 rounded ${isLocked ? 'text-yellow-500' : 'theme-text-muted'}`}
                                        >
                                            {isLocked ? <Lock size={10}/> : <Unlock size={10}/>}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setArmedTracks(prev => {
                                                const next = new Set(prev);
                                                if (next.has(track.id)) next.delete(track.id);
                                                else next.add(track.id);
                                                return next;
                                            })}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                                isArmed ? 'bg-red-600 text-white' : 'theme-bg-tertiary theme-text-muted theme-hover'
                                            }`}
                                            title="Arm for recording"
                                        >
                                            R
                                        </button>
                                        <button
                                            onClick={() => !isLocked && setTracks(prev => prev.map(t =>
                                                t.id === track.id ? {...t, muted: !t.muted} : t
                                            ))}
                                            disabled={isLocked}
                                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                                track.muted ? 'bg-red-600 text-white' : 'theme-bg-tertiary theme-text-muted theme-hover'
                                            }`}
                                            title="Mute"
                                        >
                                            M
                                        </button>
                                        <button
                                            onClick={() => !isLocked && setTracks(prev => prev.map(t =>
                                                t.id === track.id ? {...t, solo: !t.solo} : t
                                            ))}
                                            disabled={isLocked}
                                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                                track.solo ? 'bg-yellow-500 text-black' : 'theme-bg-tertiary theme-text-muted theme-hover'
                                            }`}
                                            title="Solo"
                                        >
                                            S
                                        </button>
                                        <PanKnob
                                            value={track.pan}
                                            onChange={(v) => !isLocked && setTracks(prev => prev.map(t =>
                                                t.id === track.id ? {...t, pan: v} : t
                                            ))}
                                        />
                                        <LevelMeter trackId={track.id}/>
                                    </div>

                                    <div className="flex items-center gap-1 mt-auto">
                                        <Volume2 size={10} className="theme-text-muted"/>
                                        <input
                                            type="range"
                                            min={0}
                                            max={1.5}
                                            step={0.01}
                                            value={track.volume}
                                            onChange={(e) => !isLocked && setTracks(prev => prev.map(t =>
                                                t.id === track.id ? {...t, volume: parseFloat(e.target.value)} : t
                                            ))}
                                            disabled={isLocked}
                                            className="flex-1 h-1 accent-purple-500"
                                        />
                                        <span className="text-[9px] theme-text-muted w-7 text-right">
                                            {track.volume <= 1 ? Math.round(track.volume * 100) : `+${Math.round((track.volume - 1) * 100)}`}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            onClick={() => setTracks(prev => [...prev, {
                                id: `track-${Date.now()}`,
                                name: `Track ${prev.length + 1}`,
                                clips: [],
                                volume: 1,
                                pan: 0,
                                muted: false,
                                solo: false,
                                color: prev.length % TRACK_COLORS.length,
                                height: 80
                            }])}
                            className="h-8 flex items-center justify-center text-xs theme-text-muted theme-hover gap-1"
                        >
                            <Plus size={12}/> Add Track
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div
                        className="h-6 border-b theme-border theme-bg-primary overflow-x-auto overflow-y-hidden flex-shrink-0"
                        style={{ scrollbarWidth: 'none' }}
                        onScroll={(e) => {
                            const tracksContainer = e.currentTarget.nextElementSibling;
                            if (tracksContainer) tracksContainer.scrollLeft = e.currentTarget.scrollLeft;
                        }}
                    >
                        <div className="h-full relative" style={{ width: `${timelineWidth}px` }}>
                            {rulerMarkers.map(t => (
                                <div
                                    key={t}
                                    className="absolute top-0 h-full flex flex-col items-center"
                                    style={{ left: `${t * pixelsPerSecond}px` }}
                                >
                                    <span className="text-[9px] theme-text-muted font-mono">{formatTime(t)}</span>
                                    <div className="flex-1 w-px theme-bg-tertiary"/>
                                </div>
                            ))}
                            {snapToGrid && gridSize < markerInterval && rulerMarkers.flatMap(t => {
                                const subMarkers = [];
                                for (let st = t + gridSize; st < t + markerInterval && st <= totalDuration; st += gridSize) {
                                    subMarkers.push(
                                        <div
                                            key={`sub-${st}`}
                                            className="absolute bottom-0 w-px h-2 theme-bg-secondary"
                                            style={{ left: `${st * pixelsPerSecond}px` }}
                                        />
                                    );
                                }
                                return subMarkers;
                            })}
                            <div
                                className="absolute top-0 h-full flex flex-col items-center pointer-events-none z-20"
                                style={{ left: `${editorPlayhead * pixelsPerSecond}px` }}
                            >
                                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500"/>
                            </div>
                            {loopEnabled && (
                                <div
                                    className="absolute top-0 h-full bg-blue-500/20 border-l-2 border-r-2 border-blue-500"
                                    style={{
                                        left: `${loopStart * pixelsPerSecond}px`,
                                        width: `${(loopEnd - loopStart) * pixelsPerSecond}px`
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <div
                        className="flex-1 overflow-auto theme-bg-primary"
                        onScroll={(e) => {
                            const ruler = e.currentTarget.previousElementSibling;
                            if (ruler) ruler.scrollLeft = e.currentTarget.scrollLeft;
                        }}
                    >
                        <div style={{ width: `${timelineWidth}px`, minHeight: '100%' }}>
                            {tracks.map((track, trackIdx) => {
                                const isLocked = lockedTracks.has(track.id);
                                return (
                                    <div
                                        key={track.id}
                                        className={`h-20 border-b theme-border relative ${
                                            track.muted ? 'opacity-50' : ''
                                        }`}
                                        onDragOver={(e) => !isLocked && e.preventDefault()}
                                        onDrop={(e) => {
                                            if (isLocked) return;
                                            const audioId = e.dataTransfer.getData('audioId');
                                            if (audioId && selectedAudio) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                let x = (e.clientX - rect.left + e.currentTarget.parentElement!.scrollLeft) / pixelsPerSecond;
                                                x = snapToGridTime(x);
                                                saveUndoState();
                                                setTracks(prev => prev.map(t =>
                                                    t.id === track.id ? {
                                                        ...t,
                                                        clips: [...t.clips, {
                                                            id: `clip_${Date.now()}`,
                                                            audioId: selectedAudio.id,
                                                            startTime: x,
                                                            duration: selectedAudio.duration || 10,
                                                            offset: 0,
                                                            name: selectedAudio.name,
                                                            gain: 1,
                                                            fadeIn: 0,
                                                            fadeOut: 0
                                                        }]
                                                    } : t
                                                ));
                                            }
                                        }}
                                        onClick={(e) => {
                                            if (e.target === e.currentTarget) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                let x = (e.clientX - rect.left + e.currentTarget.parentElement!.scrollLeft) / pixelsPerSecond;
                                                if (snapToGrid) x = snapToGridTime(x);
                                                setEditorPlayhead(x);
                                                setSelectedClipId(null);
                                            }
                                        }}
                                    >
                                        {rulerMarkers.map(t => (
                                            <div
                                                key={t}
                                                className="absolute top-0 bottom-0 w-px theme-bg-secondary"
                                                style={{ left: `${t * pixelsPerSecond}px` }}
                                            />
                                        ))}

                                        {isRecording && trackIdx === 0 && (
                                            <div
                                                ref={recordingClipRef}
                                                className="absolute top-1 bottom-1 bg-red-900/20 border border-red-500/40 rounded z-20"
                                                style={{
                                                    left: `${editorPlayhead * pixelsPerSecond}px`,
                                                    width: '80px',
                                                }}
                                            >
                                                <canvas
                                                    ref={(el) => { recordingWaveCanvasRef.current = el; }}
                                                    className="w-full h-full"
                                                />
                                                <span className="absolute top-0.5 left-1.5 text-[8px] text-red-400 font-bold font-mono">REC</span>
                                            </div>
                                        )}

                                        <div className="absolute inset-x-0 top-1/2 h-px theme-bg-tertiary pointer-events-none"/>

                                        {track.clips.map(clip => {
                                            const audioFile = audioFiles.find(f => f.id === clip.audioId);
                                            const waveform = waveformCache.get(clip.audioId);
                                            const hiResData = waveformDataCache.get(clip.audioId);
                                            const trackColor = TRACK_COLORS[clip.color ?? track.color] || TRACK_COLORS[0];
                                            const clipWidth = Math.max(clip.duration * pixelsPerSecond, 20);
                                            const clipHeight = track.height - 8;
                                            const fadeInWidth = (clip.fadeIn || 0) * pixelsPerSecond;
                                            const fadeOutWidth = (clip.fadeOut || 0) * pixelsPerSecond;

                                            if (!waveform && audioFile) {
                                                loadWaveform(audioFile.path, clip.audioId);
                                            }

                                            const waveformPath = hiResData && audioFile?.duration
                                                ? renderWaveformPath(clip.audioId, clipWidth, clipHeight - 16, clip.offset, clip.duration, audioFile.duration)
                                                : '';

                                            return (
                                                <div
                                                    key={clip.id}
                                                    onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                                                    onDoubleClick={() => setEditorPlayhead(clip.startTime)}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id, trackId: track.id });
                                                    }}
                                                    onMouseDown={(e) => {
                                                        if (isLocked) return;
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const relX = e.clientX - rect.left;

                                                        if (selectedClipId === clip.id) {
                                                            if (relX < fadeInWidth + 10 && relX < 20) {
                                                                setDragState({ type: 'fade-in', clipId: clip.id, trackId: track.id, startX: e.clientX, startTime: clip.fadeIn || 0, originalClip: {...clip} });
                                                                e.preventDefault();
                                                                return;
                                                            }
                                                            if (relX > clipWidth - fadeOutWidth - 10 && relX > clipWidth - 20) {
                                                                setDragState({ type: 'fade-out', clipId: clip.id, trackId: track.id, startX: e.clientX, startTime: clip.fadeOut || 0, originalClip: {...clip} });
                                                                e.preventDefault();
                                                                return;
                                                            }

                                                            if (relX < 6) {
                                                                setDragState({ type: 'resize-left', clipId: clip.id, trackId: track.id, startX: e.clientX, startTime: clip.startTime, originalClip: {...clip} });
                                                                e.preventDefault();
                                                                return;
                                                            }
                                                            if (relX > clipWidth - 6) {
                                                                setDragState({ type: 'resize-right', clipId: clip.id, trackId: track.id, startX: e.clientX, startTime: clip.duration, originalClip: {...clip} });
                                                                e.preventDefault();
                                                                return;
                                                            }
                                                        }

                                                        if (editorTool === 'move' || e.altKey) {
                                                            setDragState({ type: 'move', clipId: clip.id, trackId: track.id, startX: e.clientX, startTime: clip.startTime, originalClip: {...clip} });
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    className={`absolute rounded-sm cursor-pointer overflow-hidden ${
                                                        selectedClipId === clip.id
                                                            ? 'ring-2 ring-white shadow-lg z-10'
                                                            : 'hover:ring-1 hover:ring-white/50'
                                                    } ${isLocked ? 'opacity-60' : ''} ${
                                                        dragState?.clipId === clip.id ? 'opacity-80' : ''
                                                    }`}
                                                    style={{
                                                        left: `${clip.startTime * pixelsPerSecond}px`,
                                                        width: `${clipWidth}px`,
                                                        top: '4px',
                                                        height: `${clipHeight}px`,
                                                    }}
                                                >
                                                    <div className={`absolute inset-0 bg-gradient-to-b ${trackColor.bg}`} style={{ opacity: track.solo ? 0.9 : 0.85 }}/>

                                                    <div className="relative px-1.5 py-0.5 flex items-center gap-1 bg-black/30">
                                                        <span className="text-[10px] truncate font-medium flex-1">{clip.name}</span>
                                                        {(clip.gain ?? 1) !== 1 && (
                                                            <span className="text-[9px] bg-black/40 px-1 rounded">
                                                                {clip.gain! > 1 ? '+' : ''}{((clip.gain! - 1) * 100).toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="absolute inset-x-0 top-5 bottom-0 overflow-hidden">
                                                        <svg
                                                            className="w-full h-full"
                                                            viewBox={`0 0 ${clipWidth} ${clipHeight - 16}`}
                                                            preserveAspectRatio="none"
                                                        >
                                                            {waveformPath ? (
                                                                <path
                                                                    d={waveformPath}
                                                                    fill="rgba(255,255,255,0.5)"
                                                                    stroke="rgba(255,255,255,0.8)"
                                                                    strokeWidth="0.5"
                                                                />
                                                            ) : waveform ? (
                                                                waveform.map((v, i) => (
                                                                    <rect
                                                                        key={i}
                                                                        x={(i / waveform.length) * clipWidth}
                                                                        y={(clipHeight - 16) / 2 - v * (clipHeight - 20) / 2}
                                                                        width={Math.max(clipWidth / waveform.length - 0.5, 1)}
                                                                        height={Math.max(v * (clipHeight - 20), 1)}
                                                                        fill="rgba(255,255,255,0.5)"
                                                                    />
                                                                ))
                                                            ) : (
                                                                <text x="50%" y="50%" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">Loading...</text>
                                                            )}

                                                            {fadeInWidth > 0 && (
                                                                <>
                                                                    <defs>
                                                                        <linearGradient id={`fadeIn-${clip.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                                            <stop offset="0%" stopColor="black" stopOpacity="0.7"/>
                                                                            <stop offset="100%" stopColor="black" stopOpacity="0"/>
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <rect x="0" y="0" width={fadeInWidth} height={clipHeight - 16} fill={`url(#fadeIn-${clip.id})`}/>
                                                                    <line x1={fadeInWidth} y1="0" x2="0" y2={clipHeight - 16} stroke="white" strokeWidth="1" strokeDasharray="2,2" opacity="0.5"/>
                                                                </>
                                                            )}

                                                            {fadeOutWidth > 0 && (
                                                                <>
                                                                    <defs>
                                                                        <linearGradient id={`fadeOut-${clip.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                                            <stop offset="0%" stopColor="black" stopOpacity="0"/>
                                                                            <stop offset="100%" stopColor="black" stopOpacity="0.7"/>
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <rect x={clipWidth - fadeOutWidth} y="0" width={fadeOutWidth} height={clipHeight - 16} fill={`url(#fadeOut-${clip.id})`}/>
                                                                    <line x1={clipWidth - fadeOutWidth} y1={clipHeight - 16} x2={clipWidth} y2="0" stroke="white" strokeWidth="1" strokeDasharray="2,2" opacity="0.5"/>
                                                                </>
                                                            )}
                                                        </svg>
                                                    </div>

                                                    {selectedClipId === clip.id && !isLocked && (
                                                        <>
                                                            <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-w-resize bg-white/30 hover:bg-white/60 transition-colors"/>
                                                            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize bg-white/30 hover:bg-white/60 transition-colors"/>

                                                            <div
                                                                className="absolute top-0 w-3 h-3 bg-yellow-400 rounded-full cursor-ew-resize border border-white shadow-md"
                                                                style={{ left: `${fadeInWidth - 6}px`, transform: 'translateY(-1px)' }}
                                                                title="Drag to adjust fade in"
                                                            />

                                                            <div
                                                                className="absolute top-0 w-3 h-3 bg-yellow-400 rounded-full cursor-ew-resize border border-white shadow-md"
                                                                style={{ right: `${fadeOutWidth - 6}px`, transform: 'translateY(-1px)' }}
                                                                title="Drag to adjust fade out"
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-lg shadow-red-500/50"
                                            style={{ left: `${editorPlayhead * pixelsPerSecond}px` }}
                                        />

                                        {selectionRange && (
                                            <div
                                                className="absolute top-0 bottom-0 bg-blue-500/20 border-l border-r border-blue-500 pointer-events-none"
                                                style={{
                                                    left: `${selectionRange.start * pixelsPerSecond}px`,
                                                    width: `${(selectionRange.end - selectionRange.start) * pixelsPerSecond}px`
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-14 border-t theme-border theme-bg-secondary flex items-center px-4 gap-3">
                <div className="bg-black rounded px-3 py-1.5 font-mono text-lg text-green-400 tracking-wider w-32 text-center">
                    {formatTimeMs(editorPlayhead)}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setEditorPlayhead(0); stopEditorTimeline(); }}
                        className="p-2 theme-hover rounded"
                        title="Go to Start (Home)"
                    >
                        <SkipBack size={18}/>
                    </button>
                    <button
                        onClick={() => setEditorPlayhead(prev => Math.max(0, prev - 5))}
                        className="p-2 theme-hover rounded"
                        title="Rewind 5s"
                    >
                        <Rewind size={18}/>
                    </button>
                    <button
                        onClick={() => { stopEditorTimeline(); }}
                        className={`p-2.5 rounded ${isEditorPlaying ? 'theme-bg-tertiary' : 'theme-hover'}`}
                        title="Stop"
                    >
                        <Square size={18} fill={isEditorPlaying ? 'currentColor' : 'none'}/>
                    </button>
                    <button
                        onClick={() => isEditorPlaying ? stopEditorTimeline() : playEditorTimeline()}
                        className={`p-3 rounded-full ${isEditorPlaying ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                        title={isEditorPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                        {isEditorPlaying ? <Pause size={22}/> : <Play size={22} fill="currentColor"/>}
                    </button>
                    <button
                        onClick={() => setEditorPlayhead(prev => prev + 5)}
                        className="p-2 theme-hover rounded"
                        title="Forward 5s"
                    >
                        <FastForward size={18}/>
                    </button>
                    <button
                        onClick={() => {
                            const maxTime = Math.max(...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration)), 0);
                            setEditorPlayhead(maxTime);
                        }}
                        className="p-2 theme-hover rounded"
                        title="Go to End (End)"
                    >
                        <SkipForward size={18}/>
                    </button>
                </div>

                <div className="w-px h-8 theme-bg-tertiary mx-2"/>
                <button
                    onClick={() => setLoopEnabled(!loopEnabled)}
                    className={`p-2 rounded ${loopEnabled ? 'bg-blue-600' : 'theme-hover'}`}
                    title="Loop"
                >
                    <Repeat size={16}/>
                </button>

                <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs theme-text-muted">
                        Duration: {formatTime(Math.max(...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration)), 0))}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Volume2 size={14} className="theme-text-muted"/>
                    <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.01}
                        value={masterVolume}
                        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                        className="w-20 h-1.5 accent-purple-500"
                    />
                    <span className="text-xs theme-text-muted w-8">{Math.round(masterVolume * 100)}%</span>
                </div>

                <div className="w-px h-8 theme-bg-tertiary mx-2"/>
                <button
                    onClick={exportTimeline}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-2 font-medium"
                    title="Export to WAV"
                >
                    <Download size={14}/> Export
                </button>
            </div>

            {contextMenu && (
                <div
                    className="fixed theme-bg-secondary border theme-border rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.clipId && (
                        <>
                            <div className="px-3 py-1 text-[10px] theme-text-muted uppercase">Clip Actions</div>
                            <button
                                onClick={() => duplicateClip(contextMenu.clipId!)}
                                className="w-full px-3 py-1.5 text-left text-sm theme-hover flex items-center gap-2"
                            >
                                <Copy size={12}/> Duplicate
                            </button>
                            <button
                                onClick={() => { cutClip(); setContextMenu(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm theme-hover flex items-center gap-2"
                            >
                                <Scissors size={12}/> Cut
                            </button>
                            <button
                                onClick={() => { deleteClip(); setContextMenu(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm theme-hover flex items-center gap-2 text-red-400"
                            >
                                <Trash2 size={12}/> Delete
                            </button>
                            <div className="border-t theme-border my-1"/>
                            <div className="px-3 py-1 text-[10px] theme-text-muted uppercase">Processing</div>
                            <button
                                onClick={() => normalizeClip(contextMenu.clipId!)}
                                className="w-full px-3 py-1.5 text-left text-sm theme-hover flex items-center gap-2"
                            >
                                <BarChart3 size={12}/> Normalize
                            </button>
                            <button
                                onClick={() => addFadeToClip(contextMenu.clipId!, 'in', 0.5)}
                                className="w-full px-3 py-1.5 text-left text-sm theme-hover flex items-center gap-2"
                            >
                                <ChevronRight size={12} className="rotate-180"/> Add Fade In
                            </button>
                            <button
                                onClick={() => addFadeToClip(contextMenu.clipId!, 'out', 0.5)}
                                className="w-full px-3 py-1.5 text-left text-sm theme-hover flex items-center gap-2"
                            >
                                <ChevronRight size={12}/> Add Fade Out
                            </button>
                            <div className="border-t theme-border my-1"/>
                            <div className="px-3 py-1 text-[10px] theme-text-muted uppercase">Gain</div>
                            <div className="px-3 py-1.5 flex items-center gap-2">
                                <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    defaultValue={1}
                                    onChange={(e) => adjustClipGain(contextMenu.clipId!, parseFloat(e.target.value))}
                                    className="flex-1 h-1.5 accent-purple-500"
                                />
                                <span className="text-xs w-10">Gain</span>
                            </div>
                            <div className="border-t theme-border my-1"/>
                            <div className="px-3 py-1 text-[10px] theme-text-muted uppercase">Color</div>
                            <div className="px-3 py-1.5 flex gap-1 flex-wrap">
                                {TRACK_COLORS.map((color, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setClipColor(contextMenu.clipId!, i)}
                                        className={`w-5 h-5 rounded-full bg-gradient-to-b ${color.bg} border theme-border hover:scale-110 transition-transform`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {markers.length > 0 && (
                <div className="absolute left-52 right-0 top-10 h-6 pointer-events-none z-20">
                    {markers.map(marker => (
                        <div
                            key={marker.id}
                            className="absolute top-0 flex flex-col items-center pointer-events-auto cursor-pointer"
                            style={{ left: `${marker.time * 50 * editorZoom}px` }}
                            onClick={() => setEditorPlayhead(marker.time)}
                        >
                            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent" style={{ borderTopColor: marker.color }}/>
                            <span className="text-[9px] theme-bg-primary px-1 rounded whitespace-nowrap">{marker.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EditorPanel;
