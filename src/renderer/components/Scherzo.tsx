import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAiEnabled } from './AiFeatureContext';
import {
    Music, Play, Pause, Square, Circle, SkipBack, SkipForward,
    Volume2, VolumeX, Upload, Download, Trash2, Plus, Search,
    Mic, Radio, Sliders, Waves, BarChart3, FileAudio, Folder,
    Scissors, Copy, ClipboardPaste, Undo, Redo, ZoomIn, ZoomOut,
    Music2, Music3, Music4, Disc, Disc3, ListMusic, Library,
    Sparkles, Loader, X, ChevronRight, Grid, Settings, Save,
    FastForward, Rewind, RotateCcw, Shuffle, Repeat, Heart,
    PlusCircle, FolderOpen, Clock, Activity, AudioLines, Piano,
    Guitar, ChevronLeft, Star, Package, Layers, FileJson, Tag,
    RefreshCw, Lock, Unlock, Move, MousePointer, Magnet,
    Youtube, ListPlus, AlignJustify, LayoutGrid, FolderPlus
} from 'lucide-react';
import {
    Renderer as VFRenderer, Stave, StaveNote, Voice, Formatter,
    Beam, Accidental, StaveConnector
} from 'vexflow';
import { demoScores, DemoScore } from '../lib/scherzoLibrary';
import { toMediaUrl } from '../lib/utils';
import JSZip from 'jszip';
import RadioPanel from './RadioPanel';
import LibraryPanel from './LibraryPanel';
import DJMixerPanel from './DJMixerPanel';
import NotationPanel from './NotationPanel';
import EditorPanel from './EditorPanel';
import BeatMakerPanel from './BeatMakerPanel';
import UpdateChecker from './UpdateChecker';
import SeekBar from './SeekBar';

interface ScherzoProps {
    currentPath?: string;
    onClose?: () => void;
}

export interface AudioFile {
    id: string;
    name: string;
    path: string;
    duration?: number;
    waveform?: number[];
    bpm?: number;
    key?: string;
    artist?: string;
}

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
    reversed?: boolean;
}

interface TimelineMarker {
    id: string;
    time: number;
    name: string;
    color: string;
}

const GUITAR_TUNING = [64, 59, 55, 50, 45, 40];

const tabToMidi = (stringIdx: number, fret: number): number => {
    return GUITAR_TUNING[stringIdx] + fret;
};

const midiToTab = (midi: number): { string: number; fret: number } | null => {
    let best: { string: number; fret: number } | null = null;
    for (let s = 0; s < GUITAR_TUNING.length; s++) {
        const fret = midi - GUITAR_TUNING[s];
        if (fret >= 0 && fret <= 24) {
            if (!best || fret < best.fret) {
                best = { string: s, fret };
            }
        }
    }
    return best;
};

const staffPositionToMidi = (pos: number, clef: 'treble' | 'bass'): number => {
    const diatonic = [0, 2, 4, 5, 7, 9, 11];

    const refIdx = clef === 'bass' ? 5 : 3;
    const refOctave = clef === 'bass' ? 3 : 5;

    let targetIdx = refIdx - pos;
    let targetOctave = refOctave;
    while (targetIdx < 0) { targetIdx += 7; targetOctave--; }
    while (targetIdx >= 7) { targetIdx -= 7; targetOctave++; }

    return (targetOctave + 1) * 12 + diatonic[targetIdx];
};

interface DJDeck {
    audioFile: AudioFile | null;
    playing: boolean;
    currentTime: number;
    volume: number;
    speed: number;
    eq: { low: number; mid: number; high: number };
    eqKill: { low: boolean; mid: boolean; high: boolean };
    hotCues: (number | null)[];
    loopIn: number | null;
    loopOut: number | null;
    loopActive: boolean;
    filter: number;
    effects: { echo: number; flanger: number; reverb: number; roll: number };
    activeEffect: string | null;

    beatGrid: number[];
    beatGridOffset: number;
    jogOffset: number;
    keyLock: boolean;
    slip: boolean;
    slipPosition: number;
}

export const Scherzo: React.FC<ScherzoProps> = ({ currentPath, onClose }) => {
    const aiEnabled = useAiEnabled();

    const [activeMode, _setActiveMode] = useState(() => localStorage.getItem('scherzo_activeMode') || 'library');

    // Beat maker state
    const [beatPattern, setBeatPattern] = useState<Set<string>>(new Set());
    const [beatBpm, setBeatBpm] = useState(120);
    const [beatPlaying, setBeatPlaying] = useState(false);
    const [beatCurrentStep, setBeatCurrentStep] = useState(-1);
    const beatPlayRef = useRef<any>(null);
    const beatAudioCtxRef = useRef<AudioContext | null>(null);
    useEffect(() => () => {
        if (beatPlayRef.current) clearInterval(beatPlayRef.current);
        if (beatAudioCtxRef.current) { try { beatAudioCtxRef.current.close(); } catch {} }
    }, []);
    const setActiveMode = useCallback((mode: string) => {
        _setActiveMode(mode);
        localStorage.setItem('scherzo_activeMode', mode);
    }, []);

    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [audioSource, setAudioSource] = useState(currentPath || '');

    useEffect(() => {
        if (currentPath && currentPath !== audioSource) {
            setAudioSource(currentPath);
        }
    }, [currentPath]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const audioRef = useRef<HTMLAudioElement>(null);

    const [tracks, setTracks] = useState<AudioTrack[]>([
        { id: 'track-1', name: 'Track 1', clips: [], volume: 1, pan: 0, muted: false, solo: false, color: 0, height: 80 },
        { id: 'track-2', name: 'Track 2', clips: [], volume: 1, pan: 0, muted: false, solo: false, color: 1, height: 80 }
    ]);
    const [editorZoom, setEditorZoom] = useState(1);
    const [editorPosition, setEditorPosition] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);
    const recordingWaveAnimRef = useRef<number | null>(null);
    const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
    const recordingAudioCtxRef = useRef<AudioContext | null>(null);
    const recordingWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const recordingStartDrawRef = useRef<(() => void) | null>(null);
    const recordingClipRef = useRef<HTMLDivElement | null>(null);
    const recordingHistoryRef = useRef<number[]>([]);
    const recordingStartTimeRef = useRef(0);
    const recordingPlayheadStartRef = useRef(0);

    // ── Library state ──────────────────────────────
    const [libTracks, setLibTracks] = useState<any[]>([]);
    const [libPlaylists, setLibPlaylists] = useState<any[]>([]);
    const [libQueue, setLibQueue] = useState<any[]>([]);
    const [libQueueIndex, setLibQueueIndex] = useState(-1);
    const [libIndexedFolders, setLibIndexedFolders] = useState<any[]>([]);
    const [libViewMode, setLibViewMode] = useState<'table' | 'grid'>('table');
    const [libSort, setLibSort] = useState('added_at');
    const [libSearch, setLibSearch] = useState('');
    const [libSelectedPlaylist, setLibSelectedPlaylist] = useState<number | null>(null);
    const [libPlaylistTracks, setLibPlaylistTracks] = useState<any[]>([]);
    const [libYtResults, setLibYtResults] = useState<any[]>([]);
    const [libYtSearching, setLibYtSearching] = useState(false);
    const [libYtDownloading, setLibYtDownloading] = useState<string | null>(null);
    const [libYtError, setLibYtError] = useState<string | null>(null);
    const [libIndexing, setLibIndexing] = useState(false);
    const [libShowYtSearch, setLibShowYtSearch] = useState(false);
    const [libNewPlaylistName, setLibNewPlaylistName] = useState('');
    const [libRefreshing, setLibRefreshing] = useState(false);
    const [libRadioFavorites, setLibRadioFavorites] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('scherzo_radio_favorites') || '[]'); } catch { return []; }
    });
    const [libRadioActive, setLibRadioActive] = useState(false);
    const [libRadioStation, setLibRadioStation] = useState<any>(null);
    const [libLibraryView, setLibLibraryView] = useState<'songs' | 'artists' | 'albums' | 'playlists'>('songs');
    const [libSelectedArtist, setLibSelectedArtist] = useState<string | null>(null);
    const [libSelectedAlbum, setLibSelectedAlbum] = useState<string | null>(null);

    const playNextInQueue = useCallback(() => {
        if (libQueue.length === 0) return;
        const next = libQueueIndex + 1;
        if (next < libQueue.length) {
            setLibQueueIndex(next);
            const track = libQueue[next];
            if (track.path) {
                setSelectedAudio({ id: track.id?.toString() || '', name: track.title || '', path: track.path, duration: track.duration });
                setIsPlaying(true);
            }
        } else {
            setLibQueueIndex(-1);
            setLibQueue([]);
        }
    }, [libQueue, libQueueIndex]);

    const playPrevious = useCallback(() => {
        if (!audioRef.current || !selectedAudio) return;
        if (currentTime > 3) {
            audioRef.current.currentTime = 0;
        } else {
            // If we support queue history in future, jump to previous track here
            audioRef.current.currentTime = 0;
        }
    }, [currentTime, selectedAudio]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current || !selectedAudio) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch((err: any) => {
                    console.error('[Audio] toggle play failed', err);
                    setIsPlaying(false);
                });
        }
    }, [isPlaying, selectedAudio]);

    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [waveformCache, setWaveformCache] = useState<Map<string, number[]>>(new Map());
    const editorAudioContextRef = useRef<AudioContext | null>(null);
    const trackNodesRef = useRef<Map<string, { source: AudioBufferSourceNode, gain: GainNode }>>(new Map());
    const [editorPlayhead, setEditorPlayhead] = useState(0);
    const [isEditorPlaying, setIsEditorPlaying] = useState(false);
    const editorAnimationRef = useRef<number | null>(null);
    const editorStartTimeRef = useRef<number>(0);
    const [selectedRegion, setSelectedRegion] = useState<{ start: number; end: number } | null>(null);
    const [clipboard, setClipboard] = useState<AudioClip | null>(null);
    const [undoStack, setUndoStack] = useState<AudioTrack[][]>([]);
    const [redoStack, setRedoStack] = useState<AudioTrack[][]>([]);
    const [editorTool, setEditorTool] = useState<'select' | 'cut' | 'move'>('select');
    const [showEffectsPanel, setShowEffectsPanel] = useState(false);
    const [trackEffects, setTrackEffects] = useState<Map<string, { gain: number; pan: number; reverb: number; delay: number; eq: { low: number; mid: number; high: number } }>>(new Map());

    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridSize, setGridSize] = useState<0.25 | 0.5 | 1 | 2 | 4>(1);
    const [trackLevels, setTrackLevels] = useState<Map<string, { left: number; right: number }>>(new Map());
    const [armedTracks, setArmedTracks] = useState<Set<string>>(new Set());
    const [lockedTracks, setLockedTracks] = useState<Set<string>>(new Set());
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [masterVolume, setMasterVolume] = useState(1);
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [loopStart, setLoopStart] = useState(0);
    const [loopEnd, setLoopEnd] = useState(10);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const levelAnimationRef = useRef<number | null>(null);

    const [markers, setMarkers] = useState<TimelineMarker[]>([]);

    const [projectBpm, setProjectBpm] = useState(120);
    const [showBpmGrid, setShowBpmGrid] = useState(false);

    const [waveformZoom, setWaveformZoom] = useState(1);

    const [dragState, setDragState] = useState<{
        type: 'move' | 'resize-left' | 'resize-right' | 'fade-in' | 'fade-out' | 'selection' | null;
        clipId?: string;
        trackId?: string;
        startX: number;
        startTime: number;
        originalClip?: AudioClip;
    } | null>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId?: string; trackId?: string } | null>(null);

    const [waveformDataCache, setWaveformDataCache] = useState<Map<string, Float32Array>>(new Map());

    const [notationView, setNotationView] = useState<'piano' | 'sheet' | 'tab'>('sheet');
    type NotationNote = { note: number; start: number; duration: number; velocity: number };
    type NotationTrack = { id: string; name: string; clef: 'treble' | 'bass'; notes: NotationNote[] };
    const [notationTracks, setNotationTracks] = useState<NotationTrack[]>([
        { id: 't0', name: 'Track 1', clef: 'treble', notes: [] },
    ]);
    const [activeTrackIdx, setActiveTrackIdx] = useState(0);
    const [workTitle, setWorkTitle] = useState('');
    const [composer, setComposer] = useState('');
    const pianoNotes = notationTracks[activeTrackIdx]?.notes ?? [];
    const setPianoNotes = useCallback((value: NotationNote[] | ((prev: NotationNote[]) => NotationNote[])) => {
        setNotationTracks(prev => prev.map((t, i) => {
            if (i !== activeTrackIdx) return t;
            const newNotes = typeof value === 'function'
                ? (value as (p: NotationNote[]) => NotationNote[])(t.notes)
                : value;
            return { ...t, notes: newNotes };
        }));
    }, [activeTrackIdx]);
    // Repertoire state
    type RepertoireItem = {
        id: number; title: string; composer: string | null; album: string | null;
        audio_path: string | null; source_url: string | null; source_type: string | null;
        duration_sec?: number | null;
        created_at?: string; updated_at?: string;
    };
    type RepertoireSheetMeta = { id: number; name: string; xml_length: number; created_at?: string };
    const [repertoireItems, setRepertoireItems] = useState<RepertoireItem[]>([]);
    const [repertoireSelectedId, setRepertoireSelectedId] = useState<number | null>(null);
    const [repertoireSheets, setRepertoireSheets] = useState<RepertoireSheetMeta[]>([]);
    const [repertoireDownloading, setRepertoireDownloading] = useState(false);
    const [repertoireDeriving, setRepertoireDeriving] = useState(false);
    const [repertoireError, setRepertoireError] = useState<string | null>(null);
    const [repertoireProgressLog, setRepertoireProgressLog] = useState<string[]>([]);
    const [repertoirePlaybackRate, setRepertoirePlaybackRate] = useState(1);
    const [repertoireYouTubeUrl, setRepertoireYouTubeUrl] = useState('');
    const repertoireAudioRef = useRef<HTMLAudioElement | null>(null);

    const [tabNotes, setTabNotes] = useState<Array<{ string: number; fret: number; start: number; duration: number }>>([]);
    const [notationZoom, setNotationZoom] = useState(1);
    const [notationPlayhead, setNotationPlayhead] = useState(0);
    const [isNotationPlaying, setIsNotationPlaying] = useState(false);
    const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
    const [notationBpm, setNotationBpm] = useState(120);
    const [notationTimeSignature, setNotationTimeSignature] = useState<[number, number]>([4, 4]);
    const synthRef = useRef<AudioContext | null>(null);
    const activeNotesRef = useRef<Map<number, OscillatorNode>>(new Map());
    const vexflowRef = useRef<HTMLDivElement | null>(null);
    const ghostNoteRef = useRef<HTMLDivElement | null>(null);
    const ghostLabelRef = useRef<HTMLDivElement | null>(null);
    const dragNoteRef = useRef<{ idx: number; origMidi: number; origBeat: number } | null>(null);
    const staveLayoutRef = useRef<Array<{
        x: number; y: number; width: number; measureIdx: number;
        clef: 'treble' | 'bass'; topLineY: number; bottomLineY: number;
        trackIdx: number; isActive: boolean;
        noteStartX: number; noteEndX: number;
    }>>([]);
    const sheetPlayheadRef = useRef<HTMLDivElement | null>(null);
    const pianoPlayheadRef = useRef<HTMLDivElement | null>(null);
    const tabPlayheadRef = useRef<HTMLDivElement | null>(null);
    const [notationMutedTracks, setNotationMutedTracks] = useState<Set<number>>(new Set());
    const [notationKeySignature, setNotationKeySignature] = useState('C');
    const [notationClef, setNotationClef] = useState<'treble' | 'bass' | 'grand'>('treble');
    const [inputNoteDuration, setInputNoteDuration] = useState(1);
    const [inputCursor, setInputCursor] = useState(0);
    const [inputOctave, setInputOctave] = useState(4);
    const [notationInstrument, setNotationInstrument] = useState<'sine' | 'triangle' | 'square' | 'sawtooth'>('triangle');
    const [noteContextMenu, setNoteContextMenu] = useState<{
        x: number; y: number; noteIdx: number | null; beat: number; measureIdx: number;
    } | null>(null);

    const [notationUndoStack, setNotationUndoStack] = useState<Array<{ note: number; start: number; duration: number; velocity: number }[]>>([]);
    const [notationRedoStack, setNotationRedoStack] = useState<Array<{ note: number; start: number; duration: number; velocity: number }[]>>([]);
    const [notationClipboard, setNotationClipboard] = useState<Array<{ note: number; start: number; duration: number; velocity: number }>>([]);
    const [notationMeasures, setNotationMeasures] = useState(4);
    const [showLibrary, setShowLibrary] = useState(false);
    const pianoRollScrollRef = useRef<HTMLDivElement>(null);
    const pianoRollGridRef = useRef<HTMLDivElement>(null);
    const sheetMusicScrollRef = useRef<HTMLDivElement>(null);
    const vfContainerRef = useRef<HTMLDivElement>(null);
    const tabScrollRef = useRef<HTMLDivElement>(null);
    const notationAnimRef = useRef<number | null>(null);
    const notationOscillators = useRef<OscillatorNode[]>([]);
    const [pianoRollDrag, setPianoRollDrag] = useState<{
        type: 'move' | 'resize';
        noteIdx: number;
        startX: number;
        startY: number;
        origNote: { note: number; start: number; duration: number; velocity: number };
    } | null>(null);

    const [analysisAudioBuffer, setAnalysisAudioBuffer] = useState<AudioBuffer | null>(null);
    const [analysisFrequencyData, setAnalysisFrequencyData] = useState<Uint8Array | null>(null);
    const [analysisWaveformData, setAnalysisWaveformData] = useState<number[]>([]);

    const defaultDeckState: DJDeck = {
        audioFile: null, playing: false, currentTime: 0, volume: 1, speed: 1,
        eq: { low: 0, mid: 0, high: 0 },
        eqKill: { low: false, mid: false, high: false },
        hotCues: [null, null, null, null, null, null, null, null],
        loopIn: null, loopOut: null, loopActive: false,
        filter: 50,
        effects: { echo: 0, flanger: 0, reverb: 0, roll: 0 },
        activeEffect: null,
        beatGrid: [],
        beatGridOffset: 0,
        jogOffset: 0,
        keyLock: false,
        slip: false,
        slipPosition: 0
    };

    const [crossfaderCurve, setCrossfaderCurve] = useState<'linear' | 'cut' | 'smooth'>('smooth');

    const [deckAEffects, setDeckAEffects] = useState<{ [key: string]: number }>({});
    const [deckBEffects, setDeckBEffects] = useState<{ [key: string]: number }>({});
    const [deckA, setDeckA] = useState<DJDeck>({ ...defaultDeckState });
    const [deckB, setDeckB] = useState<DJDeck>({ ...defaultDeckState });
    const [crossfader, setCrossfader] = useState(0.5);
    const [loadingDemoTracks, setLoadingDemoTracks] = useState(false);
    const deckARef = useRef<HTMLAudioElement>(null);
    const deckBRef = useRef<HTMLAudioElement>(null);

    const [djMasterGain, setDjMasterGain] = useState(1);
    const [djBpm, setDjBpm] = useState<{ a: number; b: number }>({ a: 0, b: 0 });

    const [analysisData, setAnalysisData] = useState<{ frequencies: number[], waveform: number[] } | null>(null);
    const [analysisMode, setAnalysisMode] = useState<'waveform' | 'spectrum' | 'spectrogram'>('waveform');
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const [visualizerActive, setVisualizerActive] = useState(false);
    const [visualizerMode, setVisualizerMode] = useState<'bars' | 'wave' | 'circle' | 'particles'>('bars');
    const [visualizerColor, setVisualizerColor] = useState<'rainbow' | 'purple' | 'blue' | 'green'>('rainbow');
    const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
    const visualizerAnimationRef = useRef<number | null>(null);
    const visualizerAnalyzerRef = useRef<AnalyserNode | null>(null);
    const visualizerAudioCtxRef = useRef<AudioContext | null>(null);
    const visualizerSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('scherzo_sidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('scherzo_sidebarCollapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (activeMode === 'dj') {
            setSidebarCollapsed(true);
        }
    }, [activeMode]);

    useEffect(() => {
        if (isRecording && activeMode !== 'editor') {
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
        }
    }, [activeMode, isRecording]);

    useEffect(() => {
        if (isRecording && recordingStartDrawRef.current) {
            recordingStartDrawRef.current();
            recordingStartDrawRef.current = null;
        }
    }, [isRecording]);

    useEffect(() => {
        if (audioSource) {
            loadAudioFiles(audioSource);
        }
    }, [audioSource]);

    useEffect(() => {
        if (!visualizerActive || !visualizerCanvasRef.current) {
            if (visualizerAnimationRef.current) {
                cancelAnimationFrame(visualizerAnimationRef.current);
                visualizerAnimationRef.current = null;
            }
            return;
        }

        const canvas = visualizerCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const connectAudio = () => {

            if (audioRef.current && !visualizerSourceRef.current) {
                try {
                    if (!visualizerAudioCtxRef.current) {
                        visualizerAudioCtxRef.current = new AudioContext();
                    }
                    const analyzer = visualizerAudioCtxRef.current.createAnalyser();
                    analyzer.fftSize = 256;
                    const source = visualizerAudioCtxRef.current.createMediaElementSource(audioRef.current);
                    source.connect(analyzer);
                    analyzer.connect(visualizerAudioCtxRef.current.destination);
                    visualizerAnalyzerRef.current = analyzer;
                    visualizerSourceRef.current = source;
                } catch (e) {

                }
            }

            if (deckARef.current && deckA.playing && !visualizerSourceRef.current) {
                try {
                    if (!visualizerAudioCtxRef.current) {
                        visualizerAudioCtxRef.current = new AudioContext();
                    }
                    const analyzer = visualizerAudioCtxRef.current.createAnalyser();
                    analyzer.fftSize = 256;
                    const source = visualizerAudioCtxRef.current.createMediaElementSource(deckARef.current);
                    source.connect(analyzer);
                    analyzer.connect(visualizerAudioCtxRef.current.destination);
                    visualizerAnalyzerRef.current = analyzer;
                    visualizerSourceRef.current = source;
                } catch (e) {}
            }
        };

        connectAudio();

        const getColor = (i: number, total: number, value: number) => {
            if (visualizerColor === 'rainbow') {
                const hue = (i / total) * 360;
                return `hsl(${hue}, 80%, ${50 + value * 20}%)`;
            } else if (visualizerColor === 'purple') {
                return `rgba(147, 51, 234, ${0.5 + value * 0.5})`;
            } else if (visualizerColor === 'blue') {
                return `rgba(59, 130, 246, ${0.5 + value * 0.5})`;
            } else {
                return `rgba(34, 197, 94, ${0.5 + value * 0.5})`;
            }
        };

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, width, height);

            if (!visualizerAnalyzerRef.current) {

                const time = Date.now() / 1000;
                const bars = 64;
                const barWidth = width / bars;
                for (let i = 0; i < bars; i++) {
                    const value = Math.sin(time * 2 + i * 0.2) * 0.3 + 0.3;
                    const barHeight = value * height;
                    ctx.fillStyle = getColor(i, bars, value);
                    ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
                }
                visualizerAnimationRef.current = requestAnimationFrame(draw);
                return;
            }

            const analyzer = visualizerAnalyzerRef.current;
            const bufferLength = analyzer.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            if (visualizerMode === 'bars' || visualizerMode === 'wave') {
                analyzer.getByteFrequencyData(dataArray);
            } else {
                analyzer.getByteTimeDomainData(dataArray);
            }

            if (visualizerMode === 'bars') {
                const barWidth = width / bufferLength;
                for (let i = 0; i < bufferLength; i++) {
                    const value = dataArray[i] / 255;
                    const barHeight = value * height;
                    ctx.fillStyle = getColor(i, bufferLength, value);
                    ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
                }
            } else if (visualizerMode === 'wave') {
                ctx.beginPath();
                ctx.strokeStyle = getColor(0, 1, 0.8);
                ctx.lineWidth = 2;
                const sliceWidth = width / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const value = dataArray[i] / 255;
                    const y = height - value * height;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.stroke();
            } else if (visualizerMode === 'circle') {
                analyzer.getByteFrequencyData(dataArray);
                const centerX = width / 2;
                const centerY = height / 2;
                const radius = Math.min(width, height) * 0.3;
                for (let i = 0; i < bufferLength; i++) {
                    const value = dataArray[i] / 255;
                    const angle = (i / bufferLength) * Math.PI * 2;
                    const barHeight = value * radius;
                    const x1 = centerX + Math.cos(angle) * radius;
                    const y1 = centerY + Math.sin(angle) * radius;
                    const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                    const y2 = centerY + Math.sin(angle) * (radius + barHeight);
                    ctx.beginPath();
                    ctx.strokeStyle = getColor(i, bufferLength, value);
                    ctx.lineWidth = 3;
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            } else if (visualizerMode === 'particles') {
                analyzer.getByteFrequencyData(dataArray);
                const avgFreq = dataArray.reduce((a, b) => a + b, 0) / bufferLength / 255;
                const time = Date.now() / 1000;
                for (let i = 0; i < 50; i++) {
                    const angle = (i / 50) * Math.PI * 2 + time;
                    const distance = 50 + avgFreq * 150 + Math.sin(time * 3 + i) * 20;
                    const x = width / 2 + Math.cos(angle) * distance;
                    const y = height / 2 + Math.sin(angle) * distance;
                    const size = 3 + avgFreq * 10;
                    ctx.beginPath();
                    ctx.fillStyle = getColor(i, 50, avgFreq);
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            visualizerAnimationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (visualizerAnimationRef.current) {
                cancelAnimationFrame(visualizerAnimationRef.current);
            }
        };
    }, [visualizerActive, visualizerMode, visualizerColor, isPlaying, deckA.playing]);

    const refreshLibrary = useCallback(async () => {
        const api = window.api;
        if (!api) return;
        setLibRefreshing(true);
        try {
            const [tracks, playlists, folders] = await Promise.all([
                api.libraryListTracks?.({ sort: libSort }) || [],
                api.playlistList?.() || [],
                api.libraryListIndexedFolders?.() || [],
            ]);
            setLibTracks(tracks);
            setLibPlaylists(playlists);
            setLibIndexedFolders(folders);
        } catch (e) { console.error('library refresh error:', e); }
        setLibRefreshing(false);
    }, [libSort]);

    useEffect(() => { refreshLibrary(); }, []);

    useEffect(() => {
        if (libSelectedPlaylist !== null) {
            window.api?.playlistGetTracks?.(libSelectedPlaylist).then(setLibPlaylistTracks);
        }
    }, [libSelectedPlaylist]);

    const loadAudioFiles = async (source: string) => {
        try {

            const dirContents = await window.api?.readDirectory?.(source);
            if (dirContents && Array.isArray(dirContents)) {
                const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff'];
                const files = dirContents
                    .filter((f: any) => {
                        if (f.isDirectory) return false;
                        const ext = f.name.split('.').pop()?.toLowerCase();
                        return ext && audioExtensions.includes(ext);
                    })
                    .map((f: any) => ({
                        id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: f.name,
                        path: f.path || `${source}/${f.name}`,
                        duration: 0
                    }));
                setAudioFiles(files);
            }
        } catch (err) {
            console.error('Error loading audio files:', err);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const detectBeats = useCallback(async (audioPath: string): Promise<{ bpm: number; beats: number[]; key: string }> => {
        try {
            const response = await fetch(toMediaUrl(audioPath));
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const windowSize = Math.floor(sampleRate * 0.02);
            const hopSize = Math.floor(windowSize / 2);
            const energies: number[] = [];

            for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
                let energy = 0;
                for (let j = 0; j < windowSize; j++) {
                    energy += channelData[i + j] * channelData[i + j];
                }
                energies.push(energy);
            }

            const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.5;
            const peaks: number[] = [];
            for (let i = 1; i < energies.length - 1; i++) {
                if (energies[i] > threshold && energies[i] > energies[i-1] && energies[i] > energies[i+1]) {
                    peaks.push(i * hopSize / sampleRate);
                }
            }

            const intervals: number[] = [];
            for (let i = 1; i < Math.min(peaks.length, 100); i++) {
                intervals.push(peaks[i] - peaks[i-1]);
            }

            if (intervals.length === 0) {
                return { bpm: 120, beats: [], key: 'Am' };
            }

            intervals.sort((a, b) => a - b);
            const medianInterval = intervals[Math.floor(intervals.length / 2)];
            const rawBpm = 60 / medianInterval;

            let bpm = rawBpm;
            while (bpm < 80) bpm *= 2;
            while (bpm > 180) bpm /= 2;
            bpm = Math.round(bpm);

            const beatInterval = 60 / bpm;
            const beats: number[] = [];
            for (let t = 0; t < audioBuffer.duration; t += beatInterval) {
                beats.push(t);
            }

            const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const modes = ['', 'm'];
            const keyIndex = Math.floor(Math.random() * 12);
            const modeIndex = Math.floor(Math.random() * 2);
            const key = keys[keyIndex] + modes[modeIndex];

            await audioContext.close();
            return { bpm, beats, key };
        } catch (error) {
            console.error('Beat detection failed:', error);
            return { bpm: 120, beats: [], key: 'Am' };
        }
    }, []);

    const nudgeDeck = useCallback((deck: DJDeck, setDeck: React.Dispatch<React.SetStateAction<DJDeck>>, audioRef: React.RefObject<HTMLAudioElement>, amount: number) => {
        if (audioRef.current && deck.audioFile) {
            const newTime = Math.max(0, Math.min(deck.audioFile.duration || 0, deck.currentTime + amount));
            audioRef.current.currentTime = newTime;
            setDeck(prev => ({ ...prev, currentTime: newTime }));
        }
    }, []);

    const readAudioBuffer = async (filePath: string): Promise<ArrayBuffer | null> => {
        const result = await window.api?.readFileBuffer?.(filePath);
        if (!result?.data) return null;
        const binaryStr = atob(result.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    };

    const loadWaveform = useCallback(async (audioPath: string, audioId: string) => {
        if (waveformCache.has(audioId)) return waveformCache.get(audioId);
        try {
            const ab = await readAudioBuffer(audioPath);
            if (!ab) return null;
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(ab);
            const channelData = audioBuffer.getChannelData(0);
            const duration = audioBuffer.duration;
            const hiResSamples = Math.min(Math.ceil(duration * 1000), 50000);
            const blockSize = Math.floor(channelData.length / hiResSamples);
            const hiResWaveform = new Float32Array(hiResSamples * 2);
            for (let i = 0; i < hiResSamples; i++) {
                let min = 1, max = -1;
                const start = i * blockSize;
                const end = Math.min(start + blockSize, channelData.length);
                for (let j = start; j < end; j++) {
                    const val = channelData[j];
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
                hiResWaveform[i * 2] = min;
                hiResWaveform[i * 2 + 1] = max;
            }
            setWaveformDataCache(prev => new Map(prev).set(audioId, hiResWaveform));
            const samples = 200;
            const thumbBlockSize = Math.floor(channelData.length / samples);
            const waveform: number[] = [];
            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < thumbBlockSize; j++) {
                    sum += Math.abs(channelData[i * thumbBlockSize + j]);
                }
                waveform.push(sum / thumbBlockSize);
            }
            const maxVal = Math.max(...waveform);
            const normalized = waveform.map(v => v / (maxVal || 1));
            setWaveformCache(prev => new Map(prev).set(audioId, normalized));
            audioContext.close();
            return normalized;
        } catch (err) {
            console.error('Error loading waveform:', err);
            return null;
        }
    }, []);

    const SCHERZO_MODES = [
        { id: 'library', name: 'Listen', icon: Library, group: '' },
        { id: 'editor', name: 'Record', icon: Waves, group: '' },
        { id: 'dj', name: 'Mix', icon: Disc3, group: '' },
        { id: 'notation', name: 'Write', icon: Music2, group: '' }
    ];

    const currentMode_obj = SCHERZO_MODES.find(m => m.id === activeMode) || SCHERZO_MODES[0];
    const CurrentModeIcon = currentMode_obj.icon;

    const renderSidebar = () => {
        if (sidebarCollapsed) {
            return (
                <div className="w-12 border-r theme-border theme-bg-secondary flex flex-col items-center py-2">
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="p-2 theme-hover rounded mb-2"
                        title="Expand sidebar"
                    >
                        <ChevronRight size={16}/>
                    </button>
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm">
                        <Music size={20} className="text-purple-600"/>
                    </div>
                    <div className="flex-1"/>
                </div>
            );
        }

        return (
            <div className="w-64 border-r theme-border theme-bg-secondary flex flex-col overflow-hidden">
                <div className="p-3 border-b theme-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <Music size={18} className="text-purple-600"/>
                        </div>
                        <span className="font-semibold">Scherzo</span>
                    </div>
                    <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="p-1 theme-hover rounded"
                    >
                        <ChevronLeft size={16}/>
                    </button>
                </div>

                <div className="p-3 border-b theme-border">
                    <label className="text-xs theme-text-muted uppercase font-semibold">Source Folder</label>
                    <div className="flex gap-2 mt-1">
                        <input
                            type="text"
                            value={audioSource}
                            onChange={(e) => setAudioSource(e.target.value)}
                            placeholder="/path/to/music"
                            className="flex-1 theme-input text-xs"
                        />
                        <button
                            onClick={async () => {
                                try {
                                    const result = await window.api.showOpenDialog({
                                        properties: ['openDirectory']
                                    });
                                    if (result && result.length > 0) {
                                        setAudioSource(result[0].path);
                                    }
                                } catch (err) {
                                    console.error('Error selecting folder:', err);
                                }
                            }}
                            className="p-1.5 theme-bg-tertiary theme-hover rounded"
                        >
                            <FolderOpen size={14}/>
                        </button>
                    </div>
                </div>

                <div className="p-3 border-b theme-border">
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 theme-text-muted"/>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search audio..."
                            className="w-full theme-input text-xs pl-7"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {audioFiles
                        .filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(file => (
                            <div
                                key={file.id}
                                onClick={() => setSelectedAudio(file)}
                                onDoubleClick={() => {
                                    setSelectedAudio(file);
                                    setIsPlaying(true);
                                }}
                                className={`p-2 rounded cursor-pointer flex items-center gap-2 mb-1 ${
                                    selectedAudio?.id === file.id
                                        ? 'bg-purple-600/30 border border-purple-500'
                                        : 'theme-hover'
                                }`}
                            >
                                <FileAudio size={14} className="text-purple-400 flex-shrink-0"/>
                                <span className="text-xs truncate flex-1">{file.name}</span>
                                {file.duration && (
                                    <span className="text-xs theme-text-muted">{formatTime(file.duration)}</span>
                                )}
                            </div>
                        ))}
                    {audioFiles.length === 0 && (
                        <div className="text-center py-8 theme-text-muted">
                            <Music size={32} className="mx-auto mb-2 opacity-50"/>
                            <p className="text-xs">No audio files</p>
                            <p className="text-xs mt-1">Select a source folder above</p>
                        </div>
                    )}
                </div>

                {selectedAudio && (
                    <div className="p-3 border-t theme-border theme-bg-secondary">
                        <div className="flex items-center gap-2 mb-2">
                            <FileAudio size={14} className="text-purple-400"/>
                            <span className="text-xs truncate flex-1">{selectedAudio.name}</span>
                            <button
                                onClick={() => setVisualizerActive(!visualizerActive)}
                                className={`p-1 rounded ${visualizerActive ? 'bg-purple-600 text-white' : 'theme-hover theme-text-muted'}`}
                                title="Toggle Visualizer"
                            >
                                <Activity size={14}/>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (isPlaying) {
                                        audioRef.current?.pause();
                                        setIsPlaying(false);
                                    } else {
                                        audioRef.current?.play()
                                            .then(() => setIsPlaying(true))
                                            .catch((err: any) => {
                                                console.error('[Audio] toggle play failed', err);
                                                setIsPlaying(false);
                                            });
                                    }
                                }}
                                className="p-1.5 bg-purple-600 hover:bg-purple-700 rounded"
                            >
                                {isPlaying ? <Pause size={14}/> : <Play size={14}/>}
                            </button>
                            <div className="flex-1 h-1 theme-bg-tertiary rounded overflow-hidden">
                                <div
                                    className="h-full bg-purple-500"
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-xs theme-text-muted">{formatTime(currentTime)}</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ============== REPERTOIRE ==============
    const repertoireSelected = repertoireItems.find(r => r.id === repertoireSelectedId) || null;

    const repertoireRefreshList = useCallback(async () => {
        const api = window.api;
        if (!api?.repertoireList) return;
        const r = await api.repertoireList();
        if (r?.success) setRepertoireItems(r.items || []);
        else setRepertoireError(r?.error || 'failed to load');
    }, []);

    const repertoireLoadDetail = useCallback(async (id: number) => {
        const api = window.api;
        if (!api?.repertoireGet) return;
        const r = await api.repertoireGet(id);
        if (r?.success) setRepertoireSheets(r.sheets || []);
        else setRepertoireError(r?.error || 'failed to load detail');
    }, []);

    useEffect(() => {
        if (activeMode === 'repertoire') repertoireRefreshList();
    }, [activeMode, repertoireRefreshList]);


    useEffect(() => {
        if (repertoireSelectedId != null) repertoireLoadDetail(repertoireSelectedId);
        else setRepertoireSheets([]);
    }, [repertoireSelectedId, repertoireLoadDetail]);

    // Re-apply rate whenever it changes OR a new audio src loads
    useEffect(() => {
        const a = repertoireAudioRef.current;
        if (!a) return;
        a.playbackRate = repertoirePlaybackRate;
        // Preserve pitch across speed changes (most browsers default true; be explicit for older Electron)
        try {
            (a as any).preservesPitch = true;
            (a as any).mozPreservesPitch = true;
            (a as any).webkitPreservesPitch = true;
        } catch {}
    }, [repertoirePlaybackRate, repertoireSelectedId]);

    const repertoireImportLocal = async () => {
        const api = window.api;
        if (!api?.showOpenDialog) return;
        const result = await api.showOpenDialog({
            title: 'Add audio to Repertoire',
            properties: ['openFile'],
            filters: [
                { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] },
            ],
        });
        const picked: string | undefined = Array.isArray(result) ? result[0]?.path : result?.filePaths?.[0];
        if (!picked) return;
        const title = (picked.split('/').pop() || 'Untitled').replace(/\.[^.]+$/, '');
        const r = await api.repertoireCreate({ title, audio_path: picked, source_type: 'local' });
        if (r?.success) {
            await repertoireRefreshList();
            setRepertoireSelectedId(r.id);
        } else {
            setRepertoireError(r?.error || 'import failed');
        }
    };

    const repertoireDownload = async () => {
        const api = window.api;
        const url = repertoireYouTubeUrl.trim().replace(/^[\\"']+|[\\"']+$/g, '');
        if (!url || !api?.libraryYoutubeDownload) return;
        setRepertoireError(null);
        setRepertoireProgressLog([]);
        setRepertoireDownloading(true);
        try {
            const r = await api.libraryYoutubeDownload(url);
            if (r?.success) {
                setRepertoireYouTubeUrl('');
                setRepertoireProgressLog([]);
                await repertoireRefreshList();
                if (r.path) {
                    const createR = await api.repertoireCreate({ title: r.title || url, audio_path: r.path, source_type: 'youtube', source_url: url });
                    if (createR?.success) setRepertoireSelectedId(createR.id);
                }
            } else {
                setRepertoireError(r?.error || 'download failed');
            }
        } finally {
            setRepertoireDownloading(false);
        }
    };

    const repertoireDeleteCurrent = async () => {
        if (!repertoireSelectedId) return;
        const api = window.api;
        if (!confirm('Delete this piece (and its sheets/audio) from your repertoire?')) return;
        const r = await api.repertoireDelete(repertoireSelectedId);
        if (r?.success) {
            setRepertoireSelectedId(null);
            await repertoireRefreshList();
        }
    };

    const repertoireUpdateField = async (field: 'title' | 'composer' | 'album', value: string) => {
        if (!repertoireSelectedId) return;
        setRepertoireItems(prev => prev.map(it => it.id === repertoireSelectedId ? { ...it, [field]: value } : it));
        const api = window.api;
        await api.repertoireUpdate({ id: repertoireSelectedId, fields: { [field]: value } });
    };

    const repertoireAttachSheetFromFile = async () => {
        if (!repertoireSelectedId) return;
        const api = window.api;
        const result = await api.showOpenDialog({
            title: 'Attach MusicXML',
            properties: ['openFile'],
            filters: [{ name: 'MusicXML', extensions: ['musicxml', 'xml', 'mxl'] }],
        });
        const picked: string | undefined = Array.isArray(result) ? result[0]?.path : result?.filePaths?.[0];
        if (!picked) return;
        try {
            let xmlText: string;
            if (/\.mxl$/i.test(picked)) {
                const result = await api.readFileBuffer(picked);
                if (!result?.data) { alert('Failed to read file'); return; }
                const bin = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
                const zip = await JSZip.loadAsync(bin);
                const containerFile = zip.file('META-INF/container.xml');
                let rootPath: string | null = null;
                if (containerFile) {
                    const cdoc = new DOMParser().parseFromString(await containerFile.async('string'), 'text/xml');
                    rootPath = cdoc.querySelector('rootfile')?.getAttribute('full-path') || null;
                }
                if (!rootPath) {
                    rootPath = Object.keys(zip.files).find(n => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n)) || null;
                }
                if (!rootPath) throw new Error('no score file inside .mxl');
                xmlText = await zip.file(rootPath)!.async('string');
            } else {
                const r = await api.readFileContent(picked);
                xmlText = typeof r === 'string' ? r : (r?.content ?? '');
            }
            const name = (picked.split('/').pop() || 'Sheet');
            const r = await api.repertoireAttachSheet({ repertoireId: repertoireSelectedId, name, musicxml: xmlText });
            if (r?.success) await repertoireLoadDetail(repertoireSelectedId);
            else setRepertoireError(r?.error || 'attach failed');
        } catch (e: any) {
            setRepertoireError(e?.message || 'attach failed');
        }
    };

    const repertoireOpenSheetInNotation = async (sheetId: number) => {
        const api = window.api;
        const r = await api.repertoireGetSheetXml(sheetId);
        if (!r?.success) { setRepertoireError(r?.error || 'load sheet failed'); return; }
        // Parse via the same code path as importMusicXML — pop the user into notation mode after loading.
        // Stash the XML on window so importMusicXML can pick it up if invoked, but we reuse parsing inline here:
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(r.musicxml, 'text/xml');
            const stepToSemitone: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
            const title = doc.querySelector('work > work-title')?.textContent?.trim() || repertoireSelected?.title || '';
            const composerName = Array.from(doc.querySelectorAll('identification > creator'))
                .find(c => c.getAttribute('type') === 'composer')?.textContent?.trim()
                || repertoireSelected?.composer || '';
            const partNameById = new Map<string, string>();
            doc.querySelectorAll('part-list > score-part').forEach(sp => {
                const id = sp.getAttribute('id') || '';
                const name = sp.querySelector('part-name')?.textContent?.trim() || id;
                if (id) partNameById.set(id, name);
            });
            const metronome = doc.querySelector('metronome');
            let bpm = 120;
            if (metronome?.querySelector('per-minute')?.textContent) bpm = parseInt(metronome.querySelector('per-minute')!.textContent!) || 120;
            const timeEl = doc.querySelector('time');
            let tsNum = 4, tsDenom = 4;
            if (timeEl?.querySelector('beats')?.textContent) tsNum = parseInt(timeEl.querySelector('beats')!.textContent!) || 4;
            if (timeEl?.querySelector('beat-type')?.textContent) tsDenom = parseInt(timeEl.querySelector('beat-type')!.textContent!) || 4;
            const keyEl = doc.querySelector('key');
            const keySig = keyEl
                ? fifthsToKeySignature(parseInt(keyEl.querySelector('fifths')?.textContent || '0'))
                : 'C';

            const parts = doc.querySelectorAll('score-partwise > part');
            const partList = parts.length > 0 ? Array.from(parts) : Array.from(doc.querySelectorAll('part'));
            let maxMeasureCount = 0;
            const newTracks: NotationTrack[] = [];
            partList.forEach((part, partIdx) => {
                let divisions = parseInt(part.querySelector('divisions')?.textContent || '1') || 1;
                let beatOffset = 0;
                const measures = part.querySelectorAll('measure');
                if (measures.length > maxMeasureCount) maxMeasureCount = measures.length;
                let trackClef: 'treble' | 'bass' = 'treble';
                const sign = part.querySelector('attributes > clef > sign')?.textContent;
                if (sign === 'F') trackClef = 'bass';
                const partId = part.getAttribute('id') || `P${partIdx + 1}`;
                const partName = partNameById.get(partId) || `Track ${partIdx + 1}`;
                const trackNotes: NotationNote[] = [];
                measures.forEach((measure) => {
                    let measureBeat = beatOffset;
                    const beatsPerMeasure = tsNum * (4 / tsDenom);
                    let prevNoteBeat = measureBeat;
                    Array.from(measure.children).forEach((child) => {
                        const tag = child.tagName;
                        if (tag === 'attributes') {
                            const d = child.querySelector('divisions');
                            if (d?.textContent) divisions = parseInt(d.textContent) || divisions;
                            return;
                        }
                        if (tag === 'backup') {
                            measureBeat -= (parseInt(child.querySelector('duration')?.textContent || '0') || 0) / divisions;
                            prevNoteBeat = measureBeat;
                            return;
                        }
                        if (tag === 'forward') {
                            measureBeat += (parseInt(child.querySelector('duration')?.textContent || '0') || 0) / divisions;
                            prevNoteBeat = measureBeat;
                            return;
                        }
                        if (tag !== 'note') return;
                        const isRest = child.querySelector('rest');
                        const isChord = child.querySelector('chord');
                        const isGrace = child.querySelector('grace');
                        const durationBeats = (parseInt(child.querySelector('duration')?.textContent || '0') || 0) / divisions;
                        if (isChord) measureBeat = prevNoteBeat;
                        if (!isRest && !isGrace) {
                            const pitchEl = child.querySelector('pitch');
                            if (pitchEl) {
                                const step = pitchEl.querySelector('step')?.textContent || 'C';
                                const alter = parseInt(pitchEl.querySelector('alter')?.textContent || '0') || 0;
                                const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4') || 4;
                                const midi = (octave + 1) * 12 + (stepToSemitone[step] || 0) + alter;
                                trackNotes.push({ note: midi, start: measureBeat, duration: durationBeats, velocity: 0.8 });
                            }
                        }
                        if (!isChord && !isGrace) { prevNoteBeat = measureBeat; measureBeat += durationBeats; }
                    });
                    beatOffset += beatsPerMeasure;
                });
                newTracks.push({ id: `t${partIdx}_${partId}`, name: partName, clef: trackClef, notes: trackNotes });
            });
            if (newTracks.length === 0) newTracks.push({ id: 't0', name: 'Track 1', clef: 'treble', notes: [] });
            setNotationTracks(newTracks);
            setActiveTrackIdx(0);
            setWorkTitle(title);
            setComposer(composerName);
            setNotationBpm(bpm);
            setNotationTimeSignature([tsNum, tsDenom]);
            setNotationKeySignature(keySig);
            setNotationClef(newTracks[0]?.clef ?? 'treble');
            setNotationMeasures(Math.max(4, maxMeasureCount));
            setActiveMode('notation');
            setNotationView('sheet');
        } catch (e: any) {
            setRepertoireError(e?.message || 'parse failed');
        }
    };

    const repertoireDeriveCurrent = async () => {
        if (!repertoireSelectedId) return;
        setRepertoireError(null);
        setRepertoireDeriving(true);
        try {
            // Derive sheet is not implemented; open empty notation instead
            setActiveMode('notation');
        } finally {
            setRepertoireDeriving(false);
        }
    };

    const renderWaveformPath = useCallback((
        audioId: string,
        clipWidth: number,
        clipHeight: number,
        clipOffset: number,
        clipDuration: number,
        audioDuration: number
    ): string => {
        const hiResData = waveformDataCache.get(audioId);
        if (!hiResData) return '';

        const totalSamples = hiResData.length / 2;
        const samplesPerSecond = totalSamples / audioDuration;
        const startSample = Math.floor(clipOffset * samplesPerSecond);
        const endSample = Math.min(Math.floor((clipOffset + clipDuration) * samplesPerSecond), totalSamples);
        const visibleSamples = endSample - startSample;

        if (visibleSamples <= 0) return '';

        const pointsToRender = Math.min(visibleSamples, Math.floor(clipWidth));
        const samplesPerPoint = visibleSamples / pointsToRender;

        const centerY = clipHeight / 2;
        const amplitude = (clipHeight / 2 - 2) * waveformZoom;

        const topPoints: [number, number][] = [];
        const bottomPoints: [number, number][] = [];

        for (let i = 0; i < pointsToRender; i++) {
            const sampleIndex = Math.floor(startSample + i * samplesPerPoint);
            const x = (i / pointsToRender) * clipWidth;

            if (sampleIndex * 2 + 1 < hiResData.length) {
                const min = hiResData[sampleIndex * 2];
                const max = hiResData[sampleIndex * 2 + 1];
                topPoints.push([x, centerY - max * amplitude]);
                bottomPoints.push([x, centerY - min * amplitude]);
            }
        }

        if (topPoints.length === 0) return '';

        const d = [
            `M 0 ${centerY}`,
            ...topPoints.map(([x, y]) => `L ${x} ${y}`),
            ...bottomPoints.reverse().map(([x, y]) => `L ${x} ${y}`),
            'Z'
        ].join(' ');

        return d;
    }, [waveformDataCache, waveformZoom]);

    const playEditorTimeline = useCallback(async () => {
        if (!editorAudioContextRef.current) {
            editorAudioContextRef.current = new AudioContext();
        }
        const ctx = editorAudioContextRef.current;

        trackNodesRef.current.forEach(({ source }) => {
            try { source.stop(); } catch {}
        });
        trackNodesRef.current.clear();

        const startTime = ctx.currentTime;
        editorStartTimeRef.current = performance.now() - (editorPlayhead * 1000);

        for (const track of tracks) {
            if (track.muted) continue;

            for (const clip of track.clips) {
                if (clip.startTime + clip.duration < editorPlayhead) continue;
                if (clip.startTime > editorPlayhead + 60) continue;

                const audioFile = audioFiles.find(f => f.id === clip.audioId);
                if (!audioFile) continue;

                try {
                    const ab = await readAudioBuffer(audioFile.path);
                    if (!ab) continue;
                    const audioBuffer = await ctx.decodeAudioData(ab);
                    const source = ctx.createBufferSource();
                    const gain = ctx.createGain();

                    source.buffer = audioBuffer;
                    gain.gain.value = track.volume;
                    source.connect(gain);
                    gain.connect(ctx.destination);

                    const clipStart = clip.startTime - editorPlayhead;
                    if (clipStart >= 0) {
                        source.start(startTime + clipStart, clip.offset);
                    } else {
                        source.start(startTime, clip.offset - clipStart);
                    }

                    trackNodesRef.current.set(clip.id, { source, gain });
                } catch (err) {
                    console.error('Error playing clip:', err);
                }
            }
        }

        setIsEditorPlaying(true);

        const animate = () => {
            const elapsed = (performance.now() - editorStartTimeRef.current) / 1000;
            setEditorPlayhead(elapsed);
            editorAnimationRef.current = requestAnimationFrame(animate);
        };
        editorAnimationRef.current = requestAnimationFrame(animate);
    }, [tracks, audioFiles, editorPlayhead]);

    const stopEditorTimeline = useCallback(() => {
        if (editorAnimationRef.current) {
            cancelAnimationFrame(editorAnimationRef.current);
            editorAnimationRef.current = null;
        }
        trackNodesRef.current.forEach(({ source }) => {
            try { source.stop(); } catch {}
        });
        trackNodesRef.current.clear();
        setIsEditorPlaying(false);
    }, []);

    const exportTimeline = useCallback(async () => {
        const ctx = new OfflineAudioContext(2, 44100 * 60, 44100);

        let maxEnd = 0;
        for (const track of tracks) {
            for (const clip of track.clips) {
                maxEnd = Math.max(maxEnd, clip.startTime + clip.duration);
            }
        }
        if (maxEnd === 0) return;

        const renderCtx = new OfflineAudioContext(2, Math.ceil(44100 * maxEnd), 44100);

        for (const track of tracks) {
            if (track.muted) continue;

            for (const clip of track.clips) {
                const audioFile = audioFiles.find(f => f.id === clip.audioId);
                if (!audioFile) continue;

                try {
                    const ab = await readAudioBuffer(audioFile.path);
                    if (!ab) continue;
                    const audioBuffer = await renderCtx.decodeAudioData(ab);
                    const source = renderCtx.createBufferSource();
                    const gain = renderCtx.createGain();

                    source.buffer = audioBuffer;
                    gain.gain.value = track.volume;
                    source.connect(gain);
                    gain.connect(renderCtx.destination);
                    source.start(clip.startTime, clip.offset);
                } catch (err) {
                    console.error('Error rendering clip:', err);
                }
            }
        }

        const renderedBuffer = await renderCtx.startRendering();

        const wav = audioBufferToWav(renderedBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mixdown.wav';
        a.click();
        URL.revokeObjectURL(url);
    }, [tracks, audioFiles]);

    const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataLength = buffer.length * blockAlign;
        const headerLength = 44;
        const totalLength = headerLength + dataLength;

        const arrayBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(arrayBuffer);

        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return arrayBuffer;
    };

    const saveUndoState = useCallback(() => {
        setUndoStack(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(tracks))]);
        setRedoStack([]);
    }, [tracks]);

    const editorUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const prevState = undoStack[undoStack.length - 1];
        setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(tracks))]);
        setUndoStack(prev => prev.slice(0, -1));
        setTracks(prevState);
    }, [undoStack, tracks]);

    const editorRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];
        setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(tracks))]);
        setRedoStack(prev => prev.slice(0, -1));
        setTracks(nextState);
    }, [redoStack, tracks]);

    const copyClip = useCallback(() => {
        if (!selectedClipId) return;
        for (const track of tracks) {
            const clip = track.clips.find(c => c.id === selectedClipId);
            if (clip) {
                setClipboard({ ...clip, id: `clip_${Date.now()}` });
                return;
            }
        }
    }, [selectedClipId, tracks]);

    const cutClip = useCallback(() => {
        if (!selectedClipId) return;
        saveUndoState();
        for (const track of tracks) {
            const clip = track.clips.find(c => c.id === selectedClipId);
            if (clip) {
                setClipboard({ ...clip, id: `clip_${Date.now()}` });
                setTracks(prev => prev.map(t => ({
                    ...t,
                    clips: t.clips.filter(c => c.id !== selectedClipId)
                })));
                setSelectedClipId(null);
                return;
            }
        }
    }, [selectedClipId, tracks, saveUndoState]);

    const pasteClip = useCallback((trackId: string, time: number) => {
        if (!clipboard) return;
        saveUndoState();
        const newClip = { ...clipboard, id: `clip_${Date.now()}`, startTime: time };
        setTracks(prev => prev.map(t =>
            t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
        ));
    }, [clipboard, saveUndoState]);

    const deleteClip = useCallback(() => {
        if (!selectedClipId) return;
        saveUndoState();
        setTracks(prev => prev.map(t => ({
            ...t,
            clips: t.clips.filter(c => c.id !== selectedClipId)
        })));
        setSelectedClipId(null);
    }, [selectedClipId, saveUndoState]);

    const splitClipAtPlayhead = useCallback(() => {
        if (!selectedClipId) return;
        saveUndoState();
        setTracks(prev => prev.map(track => {
            const clipIndex = track.clips.findIndex(c => c.id === selectedClipId);
            if (clipIndex === -1) return track;

            const clip = track.clips[clipIndex];
            if (editorPlayhead <= clip.startTime || editorPlayhead >= clip.startTime + clip.duration) {
                return track;
            }

            const splitPoint = editorPlayhead - clip.startTime;
            const clip1 = { ...clip, duration: splitPoint };
            const clip2 = {
                ...clip,
                id: `clip_${Date.now()}`,
                startTime: editorPlayhead,
                duration: clip.duration - splitPoint,
                offset: clip.offset + splitPoint
            };

            const newClips = [...track.clips];
            newClips.splice(clipIndex, 1, clip1, clip2);
            return { ...track, clips: newClips };
        }));
    }, [selectedClipId, editorPlayhead, saveUndoState]);

    const noteToFrequency = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteToName = (note: number) => `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`;

    const keySignatureToFifths = (key: string): number => {
        const map: Record<string, number> = { 'Cb': -7, 'Gb': -6, 'Db': -5, 'Ab': -4, 'Eb': -3, 'Bb': -2, 'F': -1, 'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7 };
        return map[key] ?? 0;
    };
    const fifthsToKeySignature = (fifths: number): string => {
        const map: Record<number, string> = { [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
        return map[fifths] ?? 'C';
    };

    const playNote = useCallback((note: number, velocity: number = 0.5) => {
        if (!synthRef.current) synthRef.current = new AudioContext();
        const ctx = synthRef.current;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = notationInstrument;
        osc.frequency.value = noteToFrequency(note);

        const vol = velocity * 0.3;
        if (notationInstrument === 'square') {
            gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        } else if (notationInstrument === 'sawtooth') {
            gain.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        } else {
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
        activeNotesRef.current.set(note, osc);
    }, [notationInstrument]);

    const stopNote = useCallback((note: number) => {
        const osc = activeNotesRef.current.get(note);
        if (osc) {
            try { osc.stop(); } catch {}
            activeNotesRef.current.delete(note);
        }
    }, []);

    const loadDemoScore = useCallback((demo: DemoScore) => {
        setPianoNotes(demo.notes);
        setNotationKeySignature(demo.key);
        setNotationClef(demo.clef);
        setNotationTimeSignature(demo.timeSignature);
        setNotationBpm(demo.bpm);
        setNotationMeasures(demo.measures);
        setSelectedNotes(new Set());
        setInputCursor(0);
        setNotationUndoStack([]);
        setNotationRedoStack([]);
        setShowLibrary(false);
    }, []);

    const pushNotationUndo = useCallback(() => {
        setNotationUndoStack(prev => [...prev.slice(-30), pianoNotes]);
        setNotationRedoStack([]);
    }, [pianoNotes]);

    const notationUndo = useCallback(() => {
        if (notationUndoStack.length === 0) return;
        setNotationRedoStack(prev => [...prev, pianoNotes]);
        const last = notationUndoStack[notationUndoStack.length - 1];
        setNotationUndoStack(prev => prev.slice(0, -1));
        setPianoNotes(last);
        setSelectedNotes(new Set());
    }, [notationUndoStack, pianoNotes]);

    const notationRedo = useCallback(() => {
        if (notationRedoStack.length === 0) return;
        setNotationUndoStack(prev => [...prev, pianoNotes]);
        const last = notationRedoStack[notationRedoStack.length - 1];
        setNotationRedoStack(prev => prev.slice(0, -1));
        setPianoNotes(last);
        setSelectedNotes(new Set());
    }, [notationRedoStack, pianoNotes]);

    const addPianoNote = useCallback((note: number, start: number, duration: number = 0.5, velocity: number = 0.8) => {
        pushNotationUndo();
        setPianoNotes(prev => [...prev, { note, start, duration, velocity }]);
        // Auto-expand measures if note is near or past the end
        const beatsPerMeas = notationTimeSignature[0];
        const noteEndMeasure = Math.ceil((start + duration) / beatsPerMeas);
        if (noteEndMeasure >= notationMeasures) {
            setNotationMeasures(noteEndMeasure + 2);
        }
    }, [pushNotationUndo, notationTimeSignature, notationMeasures]);

    const deleteSelectedNotes = useCallback(() => {
        pushNotationUndo();
        setPianoNotes(prev => prev.filter((_, i) => !selectedNotes.has(i)));
        setSelectedNotes(new Set());
    }, [selectedNotes, pushNotationUndo]);

    const copySelectedNotes = useCallback(() => {
        if (selectedNotes.size === 0) return;
        const copied = pianoNotes.filter((_, i) => selectedNotes.has(i));
        const minStart = Math.min(...copied.map(n => n.start));
        setNotationClipboard(copied.map(n => ({ ...n, start: n.start - minStart })));
    }, [pianoNotes, selectedNotes]);

    const pasteNotes = useCallback(() => {
        if (notationClipboard.length === 0) return;
        pushNotationUndo();
        const offset = inputCursor;
        const pasted = notationClipboard.map(n => ({ ...n, start: n.start + offset }));
        setPianoNotes(prev => [...prev, ...pasted]);
        const maxEnd = Math.max(...pasted.map(n => n.start + n.duration));
        setInputCursor(maxEnd);
    }, [notationClipboard, inputCursor, pushNotationUndo]);

    const transposeSelected = useCallback((semitones: number) => {
        if (selectedNotes.size === 0) return;
        pushNotationUndo();
        setPianoNotes(prev => prev.map((n, i) =>
            selectedNotes.has(i) ? { ...n, note: Math.max(21, Math.min(108, n.note + semitones)) } : n
        ));
    }, [selectedNotes, pushNotationUndo]);

    const selectAllNotes = useCallback(() => {
        setSelectedNotes(new Set(pianoNotes.map((_, i) => i)));
    }, [pianoNotes]);

    const exportMidi = useCallback(async () => {
        // Build a simple MIDI file (format 0, single track)
        const bpm = notationBpm;
        const ticksPerBeat = 480;
        const sorted = [...pianoNotes].sort((a, b) => a.start - b.start);

        const writeVarLen = (value: number): number[] => {
            const bytes: number[] = [];
            let v = value;
            bytes.unshift(v & 0x7F);
            while ((v >>= 7) > 0) {
                bytes.unshift((v & 0x7F) | 0x80);
            }
            return bytes;
        };

        const events: Array<{ tick: number; data: number[] }> = [];

        // Tempo event
        const tempo = Math.round(60000000 / bpm);
        events.push({ tick: 0, data: [0xFF, 0x51, 0x03, (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF] });

        // Time signature event
        const [num, denom] = notationTimeSignature;
        const denomPow = Math.log2(denom);
        events.push({ tick: 0, data: [0xFF, 0x58, 0x04, num, denomPow, 24, 8] });

        // Note events
        for (const note of sorted) {
            const startTick = Math.round(note.start * ticksPerBeat);
            const endTick = Math.round((note.start + note.duration) * ticksPerBeat);
            const vel = Math.round(note.velocity * 127);
            events.push({ tick: startTick, data: [0x90, note.note, vel] }); // note on
            events.push({ tick: endTick, data: [0x80, note.note, 0] }); // note off
        }

        // End of track
        const lastTick = events.length > 0 ? Math.max(...events.map(e => e.tick)) : 0;
        events.push({ tick: lastTick, data: [0xFF, 0x2F, 0x00] });

        events.sort((a, b) => a.tick - b.tick);

        // Build track data
        const trackData: number[] = [];
        let prevTick = 0;
        for (const evt of events) {
            const delta = evt.tick - prevTick;
            trackData.push(...writeVarLen(delta));
            trackData.push(...evt.data);
            prevTick = evt.tick;
        }

        // MIDI header
        const header = [
            0x4D, 0x54, 0x68, 0x64, // MThd
            0x00, 0x00, 0x00, 0x06, // chunk length
            0x00, 0x00,             // format 0
            0x00, 0x01,             // 1 track
            (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF, // ticks per beat
        ];

        const trackHeader = [
            0x4D, 0x54, 0x72, 0x6B, // MTrk
            (trackData.length >> 24) & 0xFF,
            (trackData.length >> 16) & 0xFF,
            (trackData.length >> 8) & 0xFF,
            trackData.length & 0xFF,
        ];

        const midiBytes = new Uint8Array([...header, ...trackHeader, ...trackData]);

        const result = await window.api?.showSaveDialog?.({
            title: 'Export MIDI',
            defaultPath: `${workTitle || 'notation'}.mid`,
            filters: [{ name: 'MIDI File', extensions: ['mid', 'midi'] }],
        });
        // show-save-dialog returns the path string directly (or null/undefined on cancel),
        // older callers may receive a {filePath} envelope.
        const savePath: string | undefined = typeof result === 'string'
            ? result
            : result?.filePath;
        if (savePath) {
            await window.api?.writeFileBuffer?.(savePath, midiBytes);
            console.log('[Scherzo] Wrote MIDI to', savePath);
        } else {
            console.log('[Scherzo] MIDI export cancelled');
        }
    }, [pianoNotes, notationBpm, notationTimeSignature, workTitle]);

    const exportMusicXML = useCallback(async () => {
        const [tsNum, tsDenom] = notationTimeSignature;
        const beatsPerMeasure = tsNum * (4 / tsDenom);
        const divisions = 4; // divisions per quarter note

        const midiToPitch = (midi: number) => {
            const names = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
            const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
            const pc = midi % 12;
            const octave = Math.floor(midi / 12) - 1;
            return { step: names[pc], alter: alters[pc], octave };
        };

        const durationToType = (dur: number): string => {
            if (dur >= 4) return 'whole';
            if (dur >= 2) return 'half';
            if (dur >= 1) return 'quarter';
            if (dur >= 0.5) return 'eighth';
            if (dur >= 0.25) return '16th';
            return '32nd';
        };

        const escapeXml = (s: string) => s.replace(/[<>&"']/g, c => (
            { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string
        ));

        const tracksToExport = notationTracks.length > 0
            ? notationTracks
            : [{ id: 't0', name: 'Track 1', clef: notationClef === 'bass' ? 'bass' as const : 'treble' as const, notes: pianoNotes }];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${escapeXml(workTitle || 'Untitled')}</work-title></work>
  <identification>
    <creator type="composer">${escapeXml(composer || '')}</creator>
    <encoding><software>Incognide Scherzo</software></encoding>
  </identification>
  <part-list>\n`;
        tracksToExport.forEach((t, i) => {
            xml += `    <score-part id="P${i + 1}"><part-name>${escapeXml(t.name)}</part-name></score-part>\n`;
        });
        xml += `  </part-list>\n`;

        tracksToExport.forEach((track, partIdx) => {
            const partId = `P${partIdx + 1}`;
            xml += `  <part id="${partId}">\n`;

            // Group this track's notes per measure
            const trackMeasureNotes: NotationNote[][] = [];
            for (let m = 0; m < notationMeasures; m++) trackMeasureNotes.push([]);
            for (const n of track.notes) {
                const mIdx = Math.floor(n.start / beatsPerMeasure);
                if (mIdx >= 0 && mIdx < notationMeasures) trackMeasureNotes[mIdx].push(n);
            }

            for (let m = 0; m < notationMeasures; m++) {
                xml += `    <measure number="${m + 1}">\n`;
                if (m === 0) {
                    xml += `      <attributes>
        <divisions>${divisions}</divisions>
        <key><fifths>${keySignatureToFifths(notationKeySignature)}</fifths></key>
        <time><beats>${tsNum}</beats><beat-type>${tsDenom}</beat-type></time>
        <clef><sign>${track.clef === 'bass' ? 'F' : 'G'}</sign><line>${track.clef === 'bass' ? 4 : 2}</line></clef>
      </attributes>
      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${notationBpm}</per-minute></metronome></direction-type></direction>\n`;
                }

                const notes = trackMeasureNotes[m].slice().sort((a, b) => a.start - b.start);
                const measureStart = m * beatsPerMeasure;

                if (notes.length === 0) {
                    xml += `      <note><rest/><duration>${Math.round(beatsPerMeasure * divisions)}</duration><type>whole</type></note>\n`;
                } else {
                    let cursor = measureStart;
                    for (let i = 0; i < notes.length; i++) {
                        const n = notes[i];
                        const noteStart = n.start;

                        if (noteStart > cursor + 0.01) {
                            const restDur = noteStart - cursor;
                            xml += `      <note><rest/><duration>${Math.round(restDur * divisions)}</duration><type>${durationToType(restDur)}</type></note>\n`;
                        }

                        const { step, alter, octave } = midiToPitch(n.note);
                        const dur = Math.min(n.duration, measureStart + beatsPerMeasure - noteStart);
                        const xmlDur = Math.round(dur * divisions);
                        const dynamics = Math.round(n.velocity * 127);
                        const isChord = i > 0 && Math.abs(notes[i].start - notes[i - 1].start) < 0.01;

                        xml += `      <note>\n`;
                        if (isChord) xml += `        <chord/>\n`;
                        xml += `        <pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>\n`;
                        xml += `        <duration>${xmlDur}</duration>\n`;
                        xml += `        <type>${durationToType(dur)}</type>\n`;
                        xml += `        <dynamics><other-dynamics>${dynamics}</other-dynamics></dynamics>\n`;
                        xml += `      </note>\n`;

                        if (!isChord) cursor = noteStart + dur;
                    }

                    const remaining = measureStart + beatsPerMeasure - cursor;
                    if (remaining > 0.01) {
                        xml += `      <note><rest/><duration>${Math.round(remaining * divisions)}</duration><type>${durationToType(remaining)}</type></note>\n`;
                    }
                }
                xml += `    </measure>\n`;
            }
            xml += `  </part>\n`;
        });

        xml += `</score-partwise>`;

        const result = await window.api?.showSaveDialog?.({
            title: 'Export MusicXML',
            defaultPath: `${workTitle || 'notation'}.musicxml`,
            filters: [{ name: 'MusicXML', extensions: ['musicxml', 'xml'] }],
        });
        const savePath: string | undefined = typeof result === 'string'
            ? result
            : result?.filePath;
        if (savePath) {
            await window.api?.writeFileContent?.(savePath, xml);
            console.log('[Scherzo] Wrote MusicXML to', savePath);
        } else {
            console.log('[Scherzo] MusicXML export cancelled');
        }
    }, [pianoNotes, notationTracks, notationBpm, notationTimeSignature, notationKeySignature, notationClef, notationMeasures, workTitle, composer]);

    const importMusicXML = useCallback(async () => {
        const result = await window.api?.showOpenDialog?.({
            title: 'Import MusicXML',
            filters: [{ name: 'MusicXML', extensions: ['musicxml', 'xml', 'mxl'] }],
            properties: ['openFile'],
        });
        // show-open-dialog returns either an array of {path,...} objects or a {filePaths:[...]} envelope, depending on handler version
        let filePath: string | undefined;
        if (Array.isArray(result)) filePath = result[0]?.path;
        else filePath = result?.filePaths?.[0];
        if (!filePath) {
            console.log('[Scherzo] MusicXML import cancelled or no file selected', result);
            return;
        }
        console.log('[Scherzo] Importing MusicXML from', filePath);
        const isCompressed = /\.mxl$/i.test(filePath);

        let xmlText: string | null = null;
        try {
            if (isCompressed) {
                const result = await window.api?.readFileBuffer?.(filePath);
                if (!result?.data) return;
                const bin = Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
                const zip = await JSZip.loadAsync(bin);
                // Find root file via META-INF/container.xml; fall back to any score-looking .xml
                let rootPath: string | null = null;
                const containerFile = zip.file('META-INF/container.xml');
                if (containerFile) {
                    const containerXml = await containerFile.async('string');
                    const cdoc = new DOMParser().parseFromString(containerXml, 'text/xml');
                    rootPath = cdoc.querySelector('rootfile')?.getAttribute('full-path') || null;
                }
                if (!rootPath) {
                    rootPath = Object.keys(zip.files).find(
                        n => !n.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(n)
                    ) || null;
                }
                if (!rootPath) {
                    console.error('MusicXML: no score file inside .mxl');
                    return;
                }
                const scoreFile = zip.file(rootPath);
                if (!scoreFile) {
                    console.error('MusicXML: rootfile referenced but missing:', rootPath);
                    return;
                }
                xmlText = await scoreFile.async('string');
            } else {
                const r = await window.api?.readFileContent?.(filePath);
                xmlText = typeof r === 'string' ? r : (r?.content ?? null);
                if (r?.error) {
                    console.error('Failed to read MusicXML:', r.error);
                    return;
                }
            }
        } catch (e) {
            console.error('Failed to load MusicXML file:', e);
            return;
        }
        if (!xmlText) return;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');

            const stepToSemitone: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

            // Extract tempo
            const metronome = doc.querySelector('metronome');
            let bpm = notationBpm;
            if (metronome) {
                const pm = metronome.querySelector('per-minute');
                if (pm?.textContent) bpm = parseInt(pm.textContent) || bpm;
            }

            // Extract time signature
            const timeEl = doc.querySelector('time');
            let tsNum = notationTimeSignature[0], tsDenom = notationTimeSignature[1];
            if (timeEl) {
                const b = timeEl.querySelector('beats');
                const bt = timeEl.querySelector('beat-type');
                if (b?.textContent) tsNum = parseInt(b.textContent) || tsNum;
                if (bt?.textContent) tsDenom = parseInt(bt.textContent) || tsDenom;
            }

            // Extract key signature
            const keyEl = doc.querySelector('key');
            let keySig = notationKeySignature;
            if (keyEl) {
                const fifths = parseInt(keyEl.querySelector('fifths')?.textContent || '0');
                keySig = fifthsToKeySignature(fifths);
            }

            // Title + composer
            const title = doc.querySelector('work > work-title')?.textContent?.trim()
                || doc.querySelector('movement-title')?.textContent?.trim()
                || '';
            const composerName = Array.from(doc.querySelectorAll('identification > creator'))
                .find(c => c.getAttribute('type') === 'composer')?.textContent?.trim()
                || doc.querySelector('identification > creator')?.textContent?.trim()
                || '';

            // Build partId -> name map from part-list
            const partNameById = new Map<string, string>();
            doc.querySelectorAll('part-list > score-part').forEach(sp => {
                const id = sp.getAttribute('id') || '';
                const name = sp.querySelector('part-name')?.textContent?.trim() || id;
                if (id) partNameById.set(id, name);
            });

            // Parse notes per part — each part becomes its own track
            const parts = doc.querySelectorAll('score-partwise > part');
            const partList = parts.length > 0 ? Array.from(parts) : Array.from(doc.querySelectorAll('part'));
            let maxMeasureCount = 0;
            const newTracks: NotationTrack[] = [];

            partList.forEach((part, partIdx) => {
                let divisions = parseInt(part.querySelector('divisions')?.textContent || '1') || 1;
                let beatOffset = 0;
                const measures = part.querySelectorAll('measure');
                if (measures.length > maxMeasureCount) maxMeasureCount = measures.length;

                // Detect this part's clef from the first <clef sign> inside it
                let trackClef: 'treble' | 'bass' = 'treble';
                const partClefSign = part.querySelector('attributes > clef > sign')?.textContent;
                if (partClefSign === 'F') trackClef = 'bass';
                else if (partClefSign === 'G') trackClef = 'treble';

                const partId = part.getAttribute('id') || `P${partIdx + 1}`;
                const partName = partNameById.get(partId) || `Track ${partIdx + 1}`;
                const trackNotes: NotationNote[] = [];

                measures.forEach((measure) => {
                    let measureBeat = beatOffset;
                    const beatsPerMeasure = tsNum * (4 / tsDenom);
                    let prevNoteBeat = measureBeat;

                    Array.from(measure.children).forEach((child) => {
                        const tag = child.tagName;

                        if (tag === 'attributes') {
                            const d = child.querySelector('divisions');
                            if (d?.textContent) divisions = parseInt(d.textContent) || divisions;
                            return;
                        }

                        if (tag === 'backup') {
                            const ticks = parseInt(child.querySelector('duration')?.textContent || '0') || 0;
                            measureBeat -= ticks / divisions;
                            prevNoteBeat = measureBeat;
                            return;
                        }

                        if (tag === 'forward') {
                            const ticks = parseInt(child.querySelector('duration')?.textContent || '0') || 0;
                            measureBeat += ticks / divisions;
                            prevNoteBeat = measureBeat;
                            return;
                        }

                        if (tag !== 'note') return;
                        const noteEl = child;
                        const isRest = noteEl.querySelector('rest');
                        const isChord = noteEl.querySelector('chord');
                        const isGrace = noteEl.querySelector('grace');
                        const durEl = noteEl.querySelector('duration');
                        const durationTicks = parseInt(durEl?.textContent || '0') || 0;
                        const durationBeats = durationTicks / divisions;

                        if (isChord) measureBeat = prevNoteBeat;

                        if (!isRest && !isGrace) {
                            const pitchEl = noteEl.querySelector('pitch');
                            if (pitchEl) {
                                const step = pitchEl.querySelector('step')?.textContent || 'C';
                                const alter = parseInt(pitchEl.querySelector('alter')?.textContent || '0') || 0;
                                const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4') || 4;
                                const midi = (octave + 1) * 12 + (stepToSemitone[step] || 0) + alter;

                                let velocity = 0.8;
                                const dynEl = noteEl.querySelector('dynamics other-dynamics');
                                if (dynEl?.textContent) velocity = (parseInt(dynEl.textContent) || 100) / 127;

                                trackNotes.push({ note: midi, start: measureBeat, duration: durationBeats, velocity: Math.min(1, Math.max(0.1, velocity)) });
                            }
                        }

                        if (!isChord && !isGrace) {
                            prevNoteBeat = measureBeat;
                            measureBeat += durationBeats;
                        }
                    });

                    beatOffset += beatsPerMeasure;
                });

                newTracks.push({ id: `t${partIdx}_${partId}`, name: partName, clef: trackClef, notes: trackNotes });
            });

            pushNotationUndo();
            if (newTracks.length === 0) {
                newTracks.push({ id: 't0', name: 'Track 1', clef: 'treble', notes: [] });
            }
            setNotationTracks(newTracks);
            setActiveTrackIdx(0);
            setWorkTitle(title);
            setComposer(composerName);
            setNotationBpm(bpm);
            setNotationTimeSignature([tsNum, tsDenom]);
            setNotationKeySignature(keySig);
            setNotationClef(newTracks[0]?.clef ?? 'treble');
            setNotationMeasures(Math.max(notationMeasures, maxMeasureCount));
            setSelectedNotes(new Set());
            setInputCursor(0);
            console.log(`[Scherzo] Imported "${title}" by ${composerName}: ${newTracks.length} tracks, ${maxMeasureCount} measures`);
        } catch (e) {
            console.error('Failed to import MusicXML:', e);
        }
    }, [notationBpm, notationTimeSignature, notationKeySignature, notationClef, notationMeasures, pushNotationUndo]);

    const stopNotation = useCallback(() => {
        // Stop all oscillators
        notationOscillators.current.forEach(osc => { try { osc.stop(); } catch {} });
        notationOscillators.current = [];
        if (notationAnimRef.current) cancelAnimationFrame(notationAnimRef.current);
        notationAnimRef.current = null;
        setIsNotationPlaying(false);
        setNotationPlayhead(0);
    }, []);

    const playNotation = useCallback(() => {
        if (isNotationPlaying) { stopNotation(); return; }

        if (!synthRef.current) synthRef.current = new AudioContext();
        const ctx = synthRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        // Schedule slightly in the future so all per-note scheduling completes
        // before audio begins; same anchor used for visual playhead → no drift.
        const startTime = ctx.currentTime + 0.05;

        // Stop any previous oscillators
        notationOscillators.current.forEach(osc => { try { osc.stop(); } catch {} });
        notationOscillators.current = [];

        // Play all tracks simultaneously (skipping muted ones), not just the active one
        const allNotes: NotationNote[] = notationTracks.length > 0
            ? notationTracks.flatMap((t, i) => notationMutedTracks.has(i) ? [] : t.notes)
            : pianoNotes;
        allNotes.forEach(note => {
            const noteStartTime = startTime + (note.start * 60 / notationBpm);
            const noteDuration = note.duration * 60 / notationBpm;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = notationInstrument;
            osc.frequency.value = noteToFrequency(note.note);
            const vol = note.velocity * 0.3 * (notationInstrument === 'square' ? 0.5 : notationInstrument === 'sawtooth' ? 0.4 : 1);
            gain.gain.setValueAtTime(vol, noteStartTime);
            gain.gain.exponentialRampToValueAtTime(0.01, noteStartTime + noteDuration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(noteStartTime);
            osc.stop(noteStartTime + noteDuration + 0.05);
            notationOscillators.current.push(osc);
        });

        setIsNotationPlaying(true);
        setNotationPlayhead(0);
        const bpmPerMeasure = notationTimeSignature[0];
        const totalNoteBeat = allNotes.length > 0 ? Math.max(...allNotes.map(n => n.start + n.duration)) : 0;
        // Play through ALL measures, not just to the last note
        const totalBeats = Math.max(totalNoteBeat, notationMeasures * bpmPerMeasure);
        const totalDurationSec = totalBeats * 60 / notationBpm;
        const beatWidthLocal = 40 * notationZoom;
        const tabBeatWidthLocal = 36 * notationZoom;

        // Page padding inside the white sheet music container — must match JSX below
        const SHEET_PAD_LEFT = 45;
        const SHEET_PAD_TOP = 40;

        const animatePlayhead = () => {
            // Use AudioContext clock + small lookahead — same clock as the audio scheduler so playhead never drifts.
            const elapsedSec = ctx.currentTime - startTime;
            const currentBeat = Math.max(0, elapsedSec * (notationBpm / 60));
            if (elapsedSec < totalDurationSec) {
                // Update piano-roll playhead via ref (no React render)
                if (pianoPlayheadRef.current) {
                    pianoPlayheadRef.current.style.left = `${currentBeat * beatWidthLocal}px`;
                }
                if (pianoRollGridRef.current) {
                    const playheadX = currentBeat * beatWidthLocal;
                    const scrollLeft = pianoRollGridRef.current.scrollLeft;
                    const viewWidth = pianoRollGridRef.current.clientWidth;
                    if (playheadX > scrollLeft + viewWidth - 60 || playheadX < scrollLeft) {
                        pianoRollGridRef.current.scrollLeft = playheadX - 80;
                    }
                }

                // Update sheet music playhead via ref
                if (sheetPlayheadRef.current && staveLayoutRef.current.length > 0) {
                    const measureIdx = Math.min(notationMeasures - 1, Math.floor(currentBeat / bpmPerMeasure));
                    const beatInMeasure = currentBeat - measureIdx * bpmPerMeasure;
                    const stavesAtMeasure = staveLayoutRef.current.filter(s => s.measureIdx === measureIdx);
                    if (stavesAtMeasure.length > 0) {
                        // X anchored to the stave's note region (consistent per measure → smooth across barlines)
                        const ref = stavesAtMeasure[0];
                        const noteRangeX = Math.max(1, ref.noteEndX - ref.noteStartX);
                        const xRatio = Math.min(1, beatInMeasure / bpmPerMeasure);
                        const playX = (ref.noteStartX + xRatio * noteRangeX) * notationZoom + SHEET_PAD_LEFT;
                        // Y span: top of topmost stave to bottom of bottommost, with extra padding to ensure all tracks are crossed
                        const minTop = Math.min(...stavesAtMeasure.map(s => s.topLineY));
                        const maxBot = Math.max(...stavesAtMeasure.map(s => s.bottomLineY));
                        const playTop = (minTop - 18) * notationZoom + SHEET_PAD_TOP;
                        const playH = (maxBot - minTop + 36) * notationZoom;
                        sheetPlayheadRef.current.style.display = 'block';
                        sheetPlayheadRef.current.style.left = `${playX}px`;
                        sheetPlayheadRef.current.style.top = `${playTop}px`;
                        sheetPlayheadRef.current.style.height = `${playH}px`;
                    }
                    // Auto-scroll
                    if (sheetMusicScrollRef.current) {
                        const stave = staveLayoutRef.current.find(s => s.measureIdx === measureIdx && s.trackIdx === 0);
                        if (stave) {
                            const scrollEl = sheetMusicScrollRef.current;
                            const staveY = stave.y * notationZoom;
                            const scrollTop = scrollEl.scrollTop;
                            const viewH = scrollEl.clientHeight;
                            if (staveY < scrollTop + 40 || staveY > scrollTop + viewH - 80) {
                                scrollEl.scrollTop = staveY - 60;
                            }
                        }
                    }
                }

                // Tab view playhead
                if (tabPlayheadRef.current) {
                    tabPlayheadRef.current.style.left = `${currentBeat * tabBeatWidthLocal}px`;
                }
                if (tabScrollRef.current) {
                    const playheadX = currentBeat * tabBeatWidthLocal;
                    const scrollLeft = tabScrollRef.current.scrollLeft;
                    const viewWidth = tabScrollRef.current.clientWidth;
                    if (playheadX > scrollLeft + viewWidth - 60 || playheadX < scrollLeft) {
                        tabScrollRef.current.scrollLeft = playheadX - 80;
                    }
                }
                notationAnimRef.current = requestAnimationFrame(animatePlayhead);
            } else {
                setNotationPlayhead(0);
                setIsNotationPlaying(false);
                notationAnimRef.current = null;
                notationOscillators.current = [];
                if (sheetPlayheadRef.current) sheetPlayheadRef.current.style.display = 'none';
            }
        };
        notationAnimRef.current = requestAnimationFrame(animatePlayhead);
    }, [pianoNotes, notationTracks, notationMutedTracks, notationBpm, notationInstrument, notationZoom, isNotationPlaying, stopNotation, notationTimeSignature, notationMeasures]);

    // Auto-scroll piano roll to middle C on first render
    useEffect(() => {
        if (activeMode === 'notation' && notationView === 'piano' && pianoRollScrollRef.current) {
            // Middle C is MIDI 60, key index 60-21=39 from bottom
            // Scroll to show middle C area
            const noteHeight = 14;
            const totalKeys = 88;
            const middleCRow = totalKeys - 1 - 39; // row from top
            const scrollTo = middleCRow * noteHeight - (pianoRollScrollRef.current.clientHeight / 2);
            pianoRollScrollRef.current.scrollTop = scrollTo;
        }
    }, [activeMode, notationView]);

    // Keyboard shortcuts for notation mode
    useEffect(() => {
        if (activeMode !== 'notation') return;
        const handler = (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); notationUndo(); }
            else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); notationRedo(); }
            else if (ctrl && e.key === 'c') { if (selectedNotes.size > 0) { e.preventDefault(); copySelectedNotes(); } }
            else if (ctrl && e.key === 'v') { if (notationClipboard.length > 0) { e.preventDefault(); pasteNotes(); } }
            else if (ctrl && e.key === 'a') { e.preventDefault(); selectAllNotes(); }
            else if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedNotes.size > 0) { e.preventDefault(); deleteSelectedNotes(); } }
            // Number keys for duration
            else if (e.key === '1') setInputNoteDuration(4);    // whole
            else if (e.key === '2') setInputNoteDuration(2);    // half
            else if (e.key === '3') setInputNoteDuration(1);    // quarter
            else if (e.key === '4') setInputNoteDuration(0.5);  // eighth
            else if (e.key === '5') setInputNoteDuration(0.25); // 16th
            // Arrow keys for transpose
            else if (e.key === 'ArrowUp' && selectedNotes.size > 0 && !ctrl) { e.preventDefault(); transposeSelected(e.shiftKey ? 12 : 1); }
            else if (e.key === 'ArrowDown' && selectedNotes.size > 0 && !ctrl) { e.preventDefault(); transposeSelected(e.shiftKey ? -12 : -1); }
            // Space to play
            else if (e.key === ' ' && !ctrl) { e.preventDefault(); if (pianoNotes.length > 0) playNotation(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeMode, notationUndo, notationRedo, copySelectedNotes, pasteNotes, selectAllNotes, deleteSelectedNotes, transposeSelected, playNotation, selectedNotes, notationClipboard, pianoNotes]);

    const analyzeAudio = useCallback(async (audioPath: string) => {
        try {
            const ab = await readAudioBuffer(audioPath);
            if (!ab) return;

            // Clean up previous context
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch {}
            }
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(ab);
            setAnalysisAudioBuffer(audioBuffer);

            const channelData = audioBuffer.getChannelData(0);
            const samples = 500;
            const blockSize = Math.floor(channelData.length / samples);
            const waveform: number[] = [];
            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += channelData[i * blockSize + j];
                }
                waveform.push(sum / blockSize);
            }
            setAnalysisWaveformData(waveform);

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            setAnalysisFrequencyData(frequencyData);
            analyzerRef.current = analyser;
            audioContextRef.current = audioContext;

        } catch (err) {
            console.error('Error analyzing audio:', err);
        }
    }, []);

    const midiToGuitarTab = (note: number): { string: number; fret: number } | null => {
        const openStrings = [64, 59, 55, 50, 45, 40];
        for (let s = 0; s < 6; s++) {
            const fret = note - openStrings[s];
            if (fret >= 0 && fret <= 24) {
                return { string: s, fret };
            }
        }
        return null;
    };

    const snapToGridTime = useCallback((time: number): number => {
        if (!snapToGrid) return time;
        return Math.round(time / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    useEffect(() => {
        if (activeMode !== 'editor') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const isMeta = e.metaKey || e.ctrlKey;

            if (e.code === 'Space') {
                e.preventDefault();
                isEditorPlaying ? stopEditorTimeline() : playEditorTimeline();
            } else if (e.code === 'Home' || (isMeta && e.code === 'ArrowLeft')) {
                e.preventDefault();
                setEditorPlayhead(0);
            } else if (e.code === 'End' || (isMeta && e.code === 'ArrowRight')) {
                e.preventDefault();
                const maxTime = Math.max(...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration)), 0);
                setEditorPlayhead(maxTime);
            }

            else if (isMeta && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                editorUndo();
            } else if (isMeta && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
                e.preventDefault();
                editorRedo();
            } else if (isMeta && e.code === 'KeyX') {
                e.preventDefault();
                cutClip();
            } else if (isMeta && e.code === 'KeyC') {
                e.preventDefault();
                copyClip();
            } else if (isMeta && e.code === 'KeyV') {
                e.preventDefault();
                if (tracks.length > 0) pasteClip(tracks[0].id, editorPlayhead);
            } else if (e.code === 'Delete' || e.code === 'Backspace') {
                e.preventDefault();
                deleteClip();
            } else if (e.code === 'KeyS' && !isMeta) {
                e.preventDefault();
                splitClipAtPlayhead();
            }

            else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                setEditorPlayhead(prev => Math.max(0, prev - (e.shiftKey ? 1 : 0.1)));
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                setEditorPlayhead(prev => prev + (e.shiftKey ? 1 : 0.1));
            }

            else if (isMeta && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
                e.preventDefault();
                setEditorZoom(prev => Math.min(8, prev + 0.25));
            } else if (isMeta && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
                e.preventDefault();
                setEditorZoom(prev => Math.max(0.25, prev - 0.25));
            }

            else if (e.code === 'KeyG') {
                e.preventDefault();
                setSnapToGrid(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeMode, isEditorPlaying, tracks, editorPlayhead, playEditorTimeline, stopEditorTimeline, editorUndo, editorRedo, cutClip, copyClip, pasteClip, deleteClip, splitClipAtPlayhead]);

    useEffect(() => {
        if (!dragState) return;

        const pixelsPerSecond = 50 * editorZoom;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragState.startX;
            const deltaTime = deltaX / pixelsPerSecond;

            setTracks(prev => prev.map(track => ({
                ...track,
                clips: track.clips.map(clip => {
                    if (clip.id !== dragState.clipId) return clip;

                    const orig = dragState.originalClip!;
                    switch (dragState.type) {
                        case 'move':
                            return { ...clip, startTime: Math.max(0, snapToGridTime(orig.startTime + deltaTime)) };
                        case 'resize-left': {
                            const newStart = Math.max(0, snapToGridTime(orig.startTime + deltaTime));
                            const maxStart = orig.startTime + orig.duration - 0.1;
                            const clampedStart = Math.min(newStart, maxStart);
                            const startDelta = clampedStart - orig.startTime;
                            return {
                                ...clip,
                                startTime: clampedStart,
                                duration: orig.duration - startDelta,
                                offset: Math.max(0, orig.offset + startDelta)
                            };
                        }
                        case 'resize-right': {
                            const newDuration = Math.max(0.1, snapToGridTime(orig.duration + deltaTime));
                            return { ...clip, duration: newDuration };
                        }
                        case 'fade-in': {
                            const newFadeIn = Math.max(0, Math.min(clip.duration / 2, (orig.fadeIn || 0) + deltaTime));
                            return { ...clip, fadeIn: newFadeIn };
                        }
                        case 'fade-out': {
                            const newFadeOut = Math.max(0, Math.min(clip.duration / 2, (orig.fadeOut || 0) - deltaTime));
                            return { ...clip, fadeOut: newFadeOut };
                        }
                        default:
                            return clip;
                    }
                })
            })));
        };

        const handleMouseUp = () => {
            if (dragState.type === 'move' || dragState.type?.startsWith('resize')) {
                saveUndoState();
            }
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, editorZoom, snapToGridTime, saveUndoState]);

    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    const normalizeClip = useCallback((clipId: string) => {
        saveUndoState();
        setTracks(prev => prev.map(t => ({
            ...t,
            clips: t.clips.map(c => c.id === clipId ? { ...c, gain: 1.5 } : c)
        })));
        setContextMenu(null);
    }, [saveUndoState]);

    const reverseClip = useCallback(async (clipId: string) => {
        saveUndoState();
        // Find the clip and reverse its audio by swapping start/end offset markers
        setTracks(prev => prev.map(t => ({
            ...t,
            clips: t.clips.map(c => {
                if (c.id !== clipId) return c;
                return { ...c, reversed: !c.reversed };
            })
        })));
        setContextMenu(null);
    }, [saveUndoState]);

    const addFadeToClip = useCallback((clipId: string, fadeType: 'in' | 'out', duration: number) => {
        saveUndoState();
        setTracks(prev => prev.map(t => ({
            ...t,
            clips: t.clips.map(c => {
                if (c.id !== clipId) return c;
                return fadeType === 'in' ? { ...c, fadeIn: duration } : { ...c, fadeOut: duration };
            })
        })));
        setContextMenu(null);
    }, [saveUndoState]);

    const adjustClipGain = useCallback((clipId: string, gain: number) => {
        saveUndoState();
        setTracks(prev => prev.map(t => ({
            ...t,
            clips: t.clips.map(c => c.id === clipId ? { ...c, gain } : c)
        })));
    }, [saveUndoState]);

    const duplicateClip = useCallback((clipId: string) => {
        saveUndoState();
        setTracks(prev => prev.map(t => {
            const clip = t.clips.find(c => c.id === clipId);
            if (!clip) return t;
            return {
                ...t,
                clips: [...t.clips, {
                    ...clip,
                    id: `clip_${Date.now()}`,
                    startTime: clip.startTime + clip.duration + 0.1
                }]
            };
        }));
        setContextMenu(null);
    }, [saveUndoState]);

    const setClipColor = useCallback((clipId: string, colorIndex: number) => {
        saveUndoState();
        setTracks(prev => prev.map(t => ({
            ...t,
            clips: t.clips.map(c => c.id === clipId ? { ...c, color: colorIndex } : c)
        })));
        setContextMenu(null);
    }, [saveUndoState]);

    const addMarker = useCallback((name?: string) => {
        const markerName = name || `Marker ${markers.length + 1}`;
        setMarkers(prev => [...prev, {
            id: `marker_${Date.now()}`,
            time: editorPlayhead,
            name: markerName,
            color: '#FFD700'
        }]);
    }, [editorPlayhead, markers.length]);

    const formatTimeMs = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };


    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
                {renderSidebar()}
                <main className="flex-1 w-full flex flex-col overflow-hidden relative">
                    <div className="flex items-center h-10 px-2 theme-bg-primary border-b theme-border shrink-0">
                        <div className="relative group">
                            <button className="flex items-center gap-2 px-3 py-1.5 theme-bg-secondary theme-hover rounded-lg border theme-border text-sm">
                                <CurrentModeIcon size={16} className="text-purple-400"/>
                                <span className="font-medium">{currentMode_obj.name}</span>
                                <ChevronRight size={14} className="theme-text-muted rotate-90"/>
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-48 theme-bg-secondary rounded-lg border theme-border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <div className="py-1">
                                    {SCHERZO_MODES.map(mode => {
                                        const ModeIcon = mode.icon;
                                        return (
                                            <button
                                                key={mode.id}
                                                onClick={() => setActiveMode(mode.id)}
                                                className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm theme-hover ${
                                                    activeMode === mode.id ? 'text-purple-400 bg-purple-600/20' : 'theme-text-secondary'
                                                }`}
                                            >
                                                <ModeIcon size={14}/>{mode.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1"/>
                        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                            <UpdateChecker />
                        </div>
                    </div>

                    {activeMode === 'library' && (
                        <LibraryPanel
                            libTracks={libTracks} libPlaylists={libPlaylists}
                            libQueue={libQueue} libQueueIndex={libQueueIndex}
                            setLibQueue={setLibQueue} setLibQueueIndex={setLibQueueIndex}
                            libIndexedFolders={libIndexedFolders}
                            libViewMode={libViewMode} setLibViewMode={setLibViewMode}
                            libSort={libSort} setLibSort={setLibSort}
                            libSearch={libSearch} setLibSearch={setLibSearch}
                            libSelectedPlaylist={libSelectedPlaylist} setLibSelectedPlaylist={setLibSelectedPlaylist}
                            libPlaylistTracks={libPlaylistTracks} setLibPlaylistTracks={setLibPlaylistTracks}
                            libYtResults={libYtResults} setLibYtResults={setLibYtResults}
                            libYtSearching={libYtSearching} setLibYtSearching={setLibYtSearching}
                            libYtDownloading={libYtDownloading} setLibYtDownloading={setLibYtDownloading}
                            libYtError={libYtError} setLibYtError={setLibYtError}
                            libIndexing={libIndexing} setLibIndexing={setLibIndexing}
                            libShowYtSearch={libShowYtSearch} setLibShowYtSearch={setLibShowYtSearch}
                            libNewPlaylistName={libNewPlaylistName} setLibNewPlaylistName={setLibNewPlaylistName}
                            libRefreshing={libRefreshing}
                            libRadioFavorites={libRadioFavorites} setLibRadioFavorites={setLibRadioFavorites}
                            libRadioActive={libRadioActive} setLibRadioActive={setLibRadioActive}
                            libRadioStation={libRadioStation} setLibRadioStation={setLibRadioStation}
                            libLibraryView={libLibraryView} setLibLibraryView={setLibLibraryView}
                            libSelectedArtist={libSelectedArtist} setLibSelectedArtist={setLibSelectedArtist}
                            libSelectedAlbum={libSelectedAlbum} setLibSelectedAlbum={setLibSelectedAlbum}
                            refreshLibrary={refreshLibrary}
                            audioRef={audioRef} setIsPlaying={setIsPlaying}
                            setSelectedAudio={setSelectedAudio} selectedAudio={selectedAudio}
                            audioSource={audioSource}
                            formatTime={formatTime}
                        />
                    )}
                    {activeMode === 'editor' && (
                        <EditorPanel
                            tracks={tracks} setTracks={setTracks}
                            editorPlayhead={editorPlayhead} setEditorPlayhead={setEditorPlayhead}
                            isEditorPlaying={isEditorPlaying} setIsEditorPlaying={setIsEditorPlaying}
                            editorTool={editorTool} setEditorTool={setEditorTool}
                            editorZoom={editorZoom} setEditorZoom={setEditorZoom}
                            editorPosition={editorPosition} setEditorPosition={setEditorPosition}
                            isRecording={isRecording} setIsRecording={setIsRecording}
                            selectedClipId={selectedClipId} setSelectedClipId={setSelectedClipId}
                            lockedTracks={lockedTracks} setLockedTracks={setLockedTracks}
                            armedTracks={armedTracks} setArmedTracks={setArmedTracks}
                            markers={markers} setMarkers={setMarkers}
                            projectBpm={projectBpm} setProjectBpm={setProjectBpm}
                            showBpmGrid={showBpmGrid} setShowBpmGrid={setShowBpmGrid}
                            waveformZoom={waveformZoom} setWaveformZoom={setWaveformZoom}
                            showEffectsPanel={showEffectsPanel} setShowEffectsPanel={setShowEffectsPanel}
                            masterVolume={masterVolume} setMasterVolume={setMasterVolume}
                            audioFiles={audioFiles} setAudioFiles={setAudioFiles}
                            waveformCache={waveformCache} waveformDataCache={waveformDataCache}
                            selectionRange={selectionRange} setSelectionRange={setSelectionRange}
                            loopEnabled={loopEnabled} setLoopEnabled={setLoopEnabled}
                            loopStart={loopStart} setLoopStart={setLoopStart}
                            loopEnd={loopEnd} setLoopEnd={setLoopEnd}
                            contextMenu={contextMenu} setContextMenu={setContextMenu}
                            snapToGrid={snapToGrid} setSnapToGrid={setSnapToGrid}
                            gridSize={gridSize} setGridSize={setGridSize}
                            undoStack={undoStack} redoStack={redoStack}
                            clipboard={clipboard}
                            dragState={dragState} setDragState={setDragState}
                            trackLevels={trackLevels}
                            recordingWaveform={recordingWaveform} setRecordingWaveform={setRecordingWaveform}
                            selectedAudio={selectedAudio} audioSource={audioSource}
                            recordingClipRef={recordingClipRef}
                            recordingWaveCanvasRef={recordingWaveCanvasRef}
                            recordingWaveAnimRef={recordingWaveAnimRef}
                            recordingAudioCtxRef={recordingAudioCtxRef}
                            recordingAnalyserRef={recordingAnalyserRef}
                            mediaRecorderRef={mediaRecorderRef}
                            recordingStartTimeRef={recordingStartTimeRef}
                            recordingPlayheadStartRef={recordingPlayheadStartRef}
                            recordingHistoryRef={recordingHistoryRef}
                            recordingStartDrawRef={recordingStartDrawRef}
                            editorContainerRef={editorContainerRef}
                            addMarker={addMarker}
                            playEditorTimeline={playEditorTimeline} stopEditorTimeline={stopEditorTimeline}
                            cutClip={cutClip} copyClip={copyClip} pasteClip={pasteClip}
                            deleteClip={deleteClip} splitClipAtPlayhead={splitClipAtPlayhead}
                            saveUndoState={saveUndoState}
                            editorUndo={editorUndo} editorRedo={editorRedo}
                            loadWaveform={loadWaveform} loadAudioFiles={loadAudioFiles}
                            exportTimeline={exportTimeline}
                            duplicateClip={duplicateClip} normalizeClip={normalizeClip}
                            addFadeToClip={addFadeToClip}
                            adjustClipGain={adjustClipGain}
                            setClipColor={setClipColor}
                            formatTime={formatTime} formatTimeMs={formatTimeMs}
                            snapToGridTime={snapToGridTime}
                            renderWaveformPath={renderWaveformPath}
                        />
                    )}
                    {activeMode === 'dj' && (
                        <DJMixerPanel
                            deckA={deckA} setDeckA={setDeckA}
                            deckB={deckB} setDeckB={setDeckB}
                            deckARef={deckARef} deckBRef={deckBRef}
                            djMasterGain={djMasterGain} setDjMasterGain={setDjMasterGain}
                            crossfader={crossfader} setCrossfader={setCrossfader}
                            crossfaderCurve={crossfaderCurve} setCrossfaderCurve={setCrossfaderCurve}
                            deckAEffects={deckAEffects} setDeckAEffects={setDeckAEffects}
                            deckBEffects={deckBEffects} setDeckBEffects={setDeckBEffects}
                            selectedAudio={selectedAudio} setSelectedAudio={setSelectedAudio}
                            setAudioFiles={setAudioFiles}
                            waveformCache={waveformCache} waveformDataCache={waveformDataCache}
                            nudgeDeck={nudgeDeck} detectBeats={detectBeats}
                            loadWaveform={loadWaveform} formatTime={formatTime}
                            defaultDeckState={defaultDeckState}
                            refreshLibrary={refreshLibrary}
                        />
                    )}
                    {activeMode === 'notation' && (
                        <NotationPanel
                            notationView={notationView} setNotationView={setNotationView}
                            notationTracks={notationTracks}
                            activeTrackIdx={activeTrackIdx} setActiveTrackIdx={setActiveTrackIdx}
                            setPianoNotes={setPianoNotes}
                            inputCursor={inputCursor} setInputCursor={setInputCursor}
                            inputNoteDuration={inputNoteDuration} setInputNoteDuration={setInputNoteDuration}
                            notationZoom={notationZoom}
                            notationPlayhead={notationPlayhead} setNotationPlayhead={setNotationPlayhead}
                            isNotationPlaying={isNotationPlaying} setIsNotationPlaying={setIsNotationPlaying}
                            notationBpm={notationBpm} setNotationBpm={setNotationBpm}
                            notationTimeSignature={notationTimeSignature} setNotationTimeSignature={setNotationTimeSignature}
                            notationInstrument={notationInstrument} setNotationInstrument={setNotationInstrument}
                            notationClef={notationClef} setNotationClef={setNotationClef}
                            notationKeySignature={notationKeySignature} setNotationKeySignature={setNotationKeySignature}
                            notationMeasures={notationMeasures} setNotationMeasures={setNotationMeasures}
                            workTitle={workTitle} setWorkTitle={setWorkTitle}
                            composer={composer} setComposer={setComposer}
                            selectedNotes={selectedNotes} setSelectedNotes={setSelectedNotes}
                            pianoRollDrag={pianoRollDrag} setPianoRollDrag={setPianoRollDrag}
                            noteContextMenu={noteContextMenu} setNoteContextMenu={setNoteContextMenu}
                            notationClipboard={notationClipboard}
                            inputOctave={inputOctave} setInputOctave={setInputOctave}
                            showLibrary={showLibrary} setShowLibrary={setShowLibrary}
                            audioFiles={audioFiles} setAudioFiles={setAudioFiles}
                            notationUndoStack={notationUndoStack}
                            notationRedoStack={notationRedoStack}
                            notationMutedTracks={notationMutedTracks} setNotationMutedTracks={setNotationMutedTracks}
                            addPianoNote={addPianoNote} pushNotationUndo={pushNotationUndo}
                            noteToName={noteToName} noteToFrequency={noteToFrequency}
                            playNote={playNote} playNotation={playNotation} stopNotation={stopNotation}
                            notationUndo={notationUndo} notationRedo={notationRedo}
                            copySelectedNotes={copySelectedNotes} pasteNotes={pasteNotes}
                            deleteSelectedNotes={deleteSelectedNotes} transposeSelected={transposeSelected}
                            exportMidi={exportMidi} exportMusicXML={exportMusicXML}
                            importMusicXML={importMusicXML} loadDemoScore={loadDemoScore}
                            ghostNoteRef={ghostNoteRef} ghostLabelRef={ghostLabelRef}
                            staveLayoutRef={staveLayoutRef} sheetMusicScrollRef={sheetMusicScrollRef}
                            sheetPlayheadRef={sheetPlayheadRef}
                            pianoRollGridRef={pianoRollGridRef} pianoRollScrollRef={pianoRollScrollRef}
                            tabScrollRef={tabScrollRef}
                            dragNoteRef={dragNoteRef}
                        />
                    )}
                    {activeMode === 'beats' && (
                        <BeatMakerPanel
                            beatPattern={beatPattern} setBeatPattern={setBeatPattern}
                            beatBpm={beatBpm} setBeatBpm={setBeatBpm}
                            beatPlaying={beatPlaying} setBeatPlaying={setBeatPlaying}
                            beatCurrentStep={beatCurrentStep} setBeatCurrentStep={setBeatCurrentStep}
                            beatPlayRef={beatPlayRef}
                            beatAudioCtxRef={beatAudioCtxRef}
                        />
                    )}

                    {visualizerActive && (
                        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col">
                            <div className="flex items-center justify-between p-4 bg-black/50">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-purple-400">Visualizer</span>
                                    <div className="flex gap-1">
                                        {(['bars', 'wave', 'circle', 'particles'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => setVisualizerMode(mode)}
                                                className={`px-3 py-1 text-xs rounded ${
                                                    visualizerMode === mode ? 'bg-purple-600' : 'theme-bg-secondary theme-hover'
                                                }`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-1">
                                        {(['rainbow', 'purple', 'blue', 'green'] as const).map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setVisualizerColor(color)}
                                                className={`w-6 h-6 rounded ${
                                                    visualizerColor === color ? 'ring-2 ring-white' : ''
                                                }`}
                                                style={{
                                                    background: color === 'rainbow'
                                                        ? 'linear-gradient(90deg, red, orange, yellow, green, blue, purple)'
                                                        : color === 'purple' ? '#9333ea'
                                                        : color === 'blue' ? '#3b82f6'
                                                        : '#22c55e'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setVisualizerActive(false)}
                                    className="p-2 theme-hover rounded"
                                >
                                    <X size={20}/>
                                </button>
                            </div>
                            <div className="flex-1 relative">
                                <canvas
                                    ref={visualizerCanvasRef}
                                    className="absolute inset-0 w-full h-full"
                                    width={1200}
                                    height={600}
                                />
                            </div>
                            {selectedAudio && (
                                <div className="p-4 bg-black/50 flex items-center gap-4">
                                    <button
                                        onClick={() => {
                                            if (isPlaying) {
                                                audioRef.current?.pause();
                                                setIsPlaying(false);
                                            } else {
                                                audioRef.current?.play()
                                                    .then(() => setIsPlaying(true))
                                                    .catch((err: any) => {
                                                        console.error('[Audio] visualizer play failed', err);
                                                        setIsPlaying(false);
                                                    });
                                            }
                                        }}
                                        className="p-3 bg-purple-600 hover:bg-purple-700 rounded-full"
                                    >
                                        {isPlaying ? <Pause size={24}/> : <Play size={24}/>}
                                    </button>
                                    <div className="flex-1">
                                        <div className="text-lg font-medium">{selectedAudio.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm theme-text-muted">{formatTime(currentTime)}</span>
                                            <div className="flex-1 h-1 theme-bg-tertiary rounded overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500"
                                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-sm theme-text-muted">{formatTime(duration)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
            <div className="h-20 theme-bg-secondary border-t theme-border flex flex-col px-3 py-1.5 shrink-0 z-40">
                <div className="flex items-center gap-3">
                    {selectedAudio ? (
                        <>
                            <div className="w-8 h-8 rounded bg-purple-600/20 flex items-center justify-center shrink-0 overflow-hidden">
                                <Music size={16} className="text-purple-400"/>
                            </div>
                            <div className="flex flex-col min-w-0 w-40 md:w-56">
                                <span className="text-xs font-medium truncate">{selectedAudio.name}</span>
                                <span className="text-[10px] theme-text-muted truncate">{selectedAudio.artist || selectedAudio.path?.split('/').pop()?.split('\\').pop()}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-xs theme-text-muted">
                            <Music size={16} className="text-purple-400"/>
                            <span>Nothing playing</span>
                        </div>
                    )}
                    <div className="flex-1"/>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={playPrevious}
                            disabled={!selectedAudio}
                            className="p-1.5 rounded-full theme-hover disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Back to start"
                        >
                            <SkipBack size={16}/>
                        </button>
                        <button
                            onClick={togglePlay}
                            disabled={!selectedAudio}
                            className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isPlaying ? 'Pause' : 'Play'}
                        >
                            {isPlaying ? <Pause size={18}/> : <Play size={18}/>}
                        </button>
                        <button
                            onClick={() => {
                                if (audioRef.current) audioRef.current.pause();
                                setIsPlaying(false);
                                setCurrentTime(0);
                                if (audioRef.current) audioRef.current.currentTime = 0;
                            }}
                            disabled={!selectedAudio}
                            className="p-1.5 rounded-full theme-hover disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Stop"
                        >
                            <Square size={16} fill="currentColor"/>
                        </button>
                        <button
                            onClick={playNextInQueue}
                            disabled={!selectedAudio || libQueue.length === 0}
                            className="p-1.5 rounded-full theme-hover disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Next"
                        >
                            <SkipForward size={16}/>
                        </button>
                    </div>
                    <div className="flex-1"/>
                    <div className="flex items-center gap-2 w-24 md:w-32 shrink-0">
                        {volume === 0 ? <VolumeX size={16} className="theme-text-muted"/> : <Volume2 size={16} className="theme-text-muted"/>}
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setVolume(v);
                                if (audioRef.current) audioRef.current.volume = v;
                            }}
                            className="flex-1 h-1 accent-purple-500 bg-purple-500/30 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
                <SeekBar
                    currentTime={currentTime}
                    duration={duration}
                    disabled={!selectedAudio}
                    onSeek={(t) => {
                        console.log('[Scherzo] onSeek', { t, hasAudio: !!audioRef.current, currentTime, duration });
                        if (audioRef.current && Number.isFinite(t)) {
                            audioRef.current.currentTime = t;
                            setCurrentTime(t);
                        }
                    }}
                    formatTime={formatTime}
                />
            </div>
            <audio
                ref={audioRef}
                src={selectedAudio ? toMediaUrl(selectedAudio.path) : ''}
                onTimeUpdate={(e) => {
                    const t = (e.target as HTMLAudioElement).currentTime;
                    if (!Number.isFinite(t)) return;
                    setCurrentTime(t);
                }}
                onLoadedMetadata={(e) => {
                    const a = e.target as HTMLAudioElement;
                    const dur = a.duration;
                    console.log('[Audio] loadedmetadata', { src: a.src, duration: dur, currentTime: a.currentTime, isPlaying });
                    if (Number.isFinite(dur)) setDuration(dur);
                    a.volume = volume;
                    if (isPlaying) {
                        a.play().catch((err: any) => {
                            console.error('[Audio] auto-play after load failed', err);
                            setIsPlaying(false);
                        });
                    }
                }}
                onSeeked={(e) => {
                    const a = e.target as HTMLAudioElement;
                    console.log('[Audio] seeked', { currentTime: a.currentTime, seeking: a.seeking });
                    setCurrentTime(a.currentTime);
                }}
                onError={(e) => console.error('[Audio] playback error', (e.target as HTMLAudioElement).error, (e.target as HTMLAudioElement).src)}
                onEnded={() => { setIsPlaying(false); playNextInQueue(); }}
            />
        </div>
    );
};

export default Scherzo;
