import React, { useState } from 'react';
import {
    Music, Play, Pause, RotateCcw, Repeat, X, FolderOpen,
    Disc3, Sparkles, Loader, Youtube, Search
} from 'lucide-react';

interface AudioFile {
    id: string;
    name: string;
    path: string;
    duration?: number;
    waveform?: number[];
    bpm?: number;
    key?: string;
}

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

interface DJMixerPanelProps {
    deckA: DJDeck;
    setDeckA: React.Dispatch<React.SetStateAction<DJDeck>>;
    deckB: DJDeck;
    setDeckB: React.Dispatch<React.SetStateAction<DJDeck>>;
    deckARef: React.RefObject<HTMLAudioElement>;
    deckBRef: React.RefObject<HTMLAudioElement>;
    djMasterGain: number;
    setDjMasterGain: React.Dispatch<React.SetStateAction<number>>;
    crossfader: number;
    setCrossfader: React.Dispatch<React.SetStateAction<number>>;
    crossfaderCurve: 'linear' | 'cut' | 'smooth';
    setCrossfaderCurve: React.Dispatch<React.SetStateAction<'linear' | 'cut' | 'smooth'>>;
    deckAEffects: { [key: string]: number };
    setDeckAEffects: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
    deckBEffects: { [key: string]: number };
    setDeckBEffects: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
    selectedAudio: AudioFile | null;
    setSelectedAudio: React.Dispatch<React.SetStateAction<AudioFile | null>>;
    setAudioFiles: React.Dispatch<React.SetStateAction<AudioFile[]>>;
    waveformCache: Map<string, number[]>;
    waveformDataCache: Map<string, Float32Array>;
    defaultDeckState: DJDeck;
    nudgeDeck: (deck: DJDeck, setDeck: React.Dispatch<React.SetStateAction<DJDeck>>, audioRef: React.RefObject<HTMLAudioElement>, amount: number) => void;
    detectBeats: (audioPath: string) => Promise<{ bpm: number; beats: number[]; key: string }>;
    loadWaveform: (audioPath: string, audioId: string) => Promise<number[] | null | undefined>;
    formatTime: (seconds: number) => string;
    refreshLibrary?: () => void;
}

const HOT_CUE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const LOOP_SIZES = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

const DJMixerPanel: React.FC<DJMixerPanelProps> = ({
    deckA, setDeckA, deckB, setDeckB,
    deckARef, deckBRef,
    djMasterGain, setDjMasterGain,
    crossfader, setCrossfader,
    crossfaderCurve, setCrossfaderCurve,
    deckAEffects, setDeckAEffects,
    deckBEffects, setDeckBEffects,
    selectedAudio, setSelectedAudio,
    setAudioFiles,
    waveformCache, waveformDataCache,
    defaultDeckState,
    nudgeDeck, detectBeats, loadWaveform, formatTime,
    refreshLibrary,
}) => {
    const [loadingDemoTracks, setLoadingDemoTracks] = useState(false);
    const [showYtSearch, setShowYtSearch] = useState(false);
    const [ytQuery, setYtQuery] = useState('');
    const [ytResults, setYtResults] = useState<any[]>([]);
    const [ytSearching, setYtSearching] = useState(false);
    const [ytDownloading, setYtDownloading] = useState<string | null>(null);

    const searchYt = async () => {
        if (!ytQuery.trim()) return;
        setYtSearching(true);
        const r = await window.api?.libraryYoutubeSearch?.(ytQuery.trim());
        setYtResults(r?.results || []);
        setYtSearching(false);
    };

    const renderDeck = (deck: DJDeck, setDeck: React.Dispatch<React.SetStateAction<DJDeck>>, label: string, audioRef: React.RefObject<HTMLAudioElement>, isLeft: boolean) => {
        const waveform = deck.audioFile ? waveformCache.get(deck.audioFile.id) : null;
        const hiResWaveform = deck.audioFile ? waveformDataCache.get(deck.audioFile.id) : null;
        const accentColor = isLeft ? 'blue' : 'orange';
        const accentClass = isLeft ? 'text-blue-400' : 'text-orange-400';
        const bgAccent = isLeft ? 'bg-blue-600' : 'bg-orange-600';
        const bgAccentHover = isLeft ? 'hover:bg-blue-700' : 'hover:bg-orange-700';

        if (deck.audioFile && !waveform) {
            loadWaveform(deck.audioFile.path, deck.audioFile.id);
        }

        const setHotCue = (index: number) => {
            if (deck.hotCues[index] === null) {

                setDeck(prev => {
                    const newCues = [...prev.hotCues];
                    newCues[index] = prev.currentTime;
                    return { ...prev, hotCues: newCues };
                });
            } else {

                if (audioRef.current) {
                    audioRef.current.currentTime = deck.hotCues[index]!;
                }
                setDeck(prev => ({ ...prev, currentTime: prev.hotCues[index]! }));
            }
        };

        const clearHotCue = (index: number, e: React.MouseEvent) => {
            e.preventDefault();
            setDeck(prev => {
                const newCues = [...prev.hotCues];
                newCues[index] = null;
                return { ...prev, hotCues: newCues };
            });
        };

        const setLoopPoint = (point: 'in' | 'out') => {
            setDeck(prev => ({
                ...prev,
                [point === 'in' ? 'loopIn' : 'loopOut']: prev.currentTime,
                loopActive: point === 'out' && prev.loopIn !== null
            }));
        };

        const setAutoLoop = (beats: number) => {
            const bpm = deck.audioFile?.bpm || 120;
            const loopDuration = (beats / bpm) * 60;
            setDeck(prev => ({
                ...prev,
                loopIn: prev.currentTime,
                loopOut: prev.currentTime + loopDuration,
                loopActive: true
            }));
        };

        return (
            <div className="flex-1 flex flex-col theme-bg-primary min-w-0">
                <div className={`h-8 flex items-center justify-between px-3 ${isLeft ? 'bg-blue-900/40' : 'bg-orange-900/40'} border-b theme-border`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${accentClass}`}>{label}</span>
                        <span className="text-[10px] theme-text-muted uppercase">Deck</span>
                    </div>
                    <span className="text-xs theme-text-muted truncate max-w-[150px]">{deck.audioFile?.name || 'No Track'}</span>
                </div>

                <div
                    className="h-8 bg-black/50 border-b theme-border relative cursor-pointer"
                    onClick={(e) => {
                        if (!deck.audioFile?.duration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const newTime = (x / rect.width) * deck.audioFile.duration;
                        if (audioRef.current) audioRef.current.currentTime = newTime;
                        setDeck(prev => ({ ...prev, currentTime: newTime }));
                    }}
                >
                    {waveform && (
                        <svg className="w-full h-full" viewBox="0 0 200 32" preserveAspectRatio="none">
                            {waveform.map((v, i) => (
                                <rect
                                    key={i}
                                    x={i}
                                    y={16 - v * 14}
                                    width="1"
                                    height={v * 28}
                                    fill={i / 200 < (deck.currentTime / (deck.audioFile?.duration || 1))
                                        ? (isLeft ? '#1E40AF' : '#9A3412')
                                        : (isLeft ? '#3B82F6' : '#F97316')}
                                    opacity={i / 200 < (deck.currentTime / (deck.audioFile?.duration || 1)) ? 0.6 : 1}
                                />
                            ))}
                        </svg>
                    )}
                    {deck.audioFile?.duration && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white"
                            style={{ left: `${(deck.currentTime / deck.audioFile.duration) * 100}%` }}
                        />
                    )}
                    {deck.audioFile?.duration && deck.hotCues.map((cue, i) => {
                        if (cue === null) return null;
                        return (
                            <div
                                key={i}
                                className="absolute top-0 w-1 h-2 rounded-b-sm"
                                style={{
                                    left: `${(cue / deck.audioFile!.duration!) * 100}%`,
                                    backgroundColor: HOT_CUE_COLORS[i]
                                }}
                            />
                        );
                    })}
                    {deck.audioFile?.duration && deck.loopIn !== null && deck.loopOut !== null && (
                        <div
                            className="absolute top-0 bottom-0 border-x-2"
                            style={{
                                left: `${(deck.loopIn / deck.audioFile.duration) * 100}%`,
                                width: `${((deck.loopOut - deck.loopIn) / deck.audioFile.duration) * 100}%`,
                                backgroundColor: deck.loopActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                                borderColor: deck.loopActive ? '#22c55e' : '#666'
                            }}
                        />
                    )}
                </div>

                <div className="h-20 bg-black border-b theme-border relative overflow-hidden">
                    {hiResWaveform && deck.audioFile?.duration ? (
                        <div className="absolute inset-0">
                            <svg className="w-full h-full" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id={`waveGrad${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor={isLeft ? '#3B82F6' : '#F97316'}/>
                                        <stop offset="50%" stopColor={isLeft ? '#1E40AF' : '#C2410C'}/>
                                        <stop offset="100%" stopColor={isLeft ? '#3B82F6' : '#F97316'}/>
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    const duration = deck.audioFile?.duration || 1;
                                    const visibleSeconds = 10;
                                    const centerTime = deck.currentTime;
                                    const startTime = Math.max(0, centerTime - visibleSeconds / 2);
                                    const endTime = Math.min(duration, centerTime + visibleSeconds / 2);

                                    const totalSamples = hiResWaveform.length / 2;
                                    const samplesPerSecond = totalSamples / duration;
                                    const startSample = Math.floor(startTime * samplesPerSecond);
                                    const endSample = Math.floor(endTime * samplesPerSecond);

                                    const points: JSX.Element[] = [];
                                    const step = Math.max(1, Math.floor((endSample - startSample) / 200));

                                    for (let i = startSample; i < endSample; i += step) {
                                        if (i * 2 + 1 >= hiResWaveform.length) break;
                                        const min = hiResWaveform[i * 2];
                                        const max = hiResWaveform[i * 2 + 1];
                                        const x = ((i / samplesPerSecond - startTime) / visibleSeconds) * 100;
                                        const yTop = 50 - max * 45;
                                        const height = (max - min) * 45;

                                        const sampleTime = i / samplesPerSecond;
                                        const isPast = sampleTime < centerTime;

                                        points.push(
                                            <rect
                                                key={i}
                                                x={`${x}%`}
                                                y={yTop}
                                                width="0.5%"
                                                height={Math.max(height, 1)}
                                                fill={isPast ? (isLeft ? '#1E40AF' : '#9A3412') : `url(#waveGrad${label})`}
                                                opacity={isPast ? 0.5 : 1}
                                            />
                                        );
                                    }
                                    return points;
                                })()}

                                <line x1="50%" y1="0" x2="50%" y2="100" stroke="white" strokeWidth="2"/>

                                {deck.loopIn !== null && deck.loopOut !== null && (
                                    <rect
                                        x={`${((deck.loopIn - (deck.currentTime - 5)) / 10) * 100}%`}
                                        y="0"
                                        width={`${((deck.loopOut - deck.loopIn) / 10) * 100}%`}
                                        height="100"
                                        fill={deck.loopActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 100, 100, 0.2)'}
                                        stroke={deck.loopActive ? '#22c55e' : '#666'}
                                        strokeWidth="1"
                                    />
                                )}

                                {deck.hotCues.map((cue, i) => {
                                    if (cue === null) return null;
                                    const x = ((cue - (deck.currentTime - 5)) / 10) * 100;
                                    if (x < 0 || x > 100) return null;
                                    return (
                                        <g key={i}>
                                            <line x1={`${x}%`} y1="0" x2={`${x}%`} y2="100" stroke={HOT_CUE_COLORS[i]} strokeWidth="1" strokeDasharray="2,2"/>
                                            <circle cx={`${x}%`} cy="8" r="4" fill={HOT_CUE_COLORS[i]}/>
                                        </g>
                                    );
                                })}

                                {deck.beatGrid.length > 0 && (() => {
                                    const lines: JSX.Element[] = [];
                                    const visibleSeconds = 10;
                                    const startTime = Math.max(0, deck.currentTime - visibleSeconds / 2);
                                    const endTime = deck.currentTime + visibleSeconds / 2;

                                    deck.beatGrid.forEach((beat, i) => {
                                        if (beat >= startTime && beat <= endTime) {
                                            const x = ((beat - startTime) / visibleSeconds) * 100;
                                            const isBeat4 = i % 4 === 0;
                                            const isBeat16 = i % 16 === 0;
                                            lines.push(
                                                <line
                                                    key={`beat-${i}`}
                                                    x1={`${x}%`}
                                                    y1={isBeat16 ? 0 : isBeat4 ? 15 : 25}
                                                    x2={`${x}%`}
                                                    y2={isBeat16 ? 80 : isBeat4 ? 65 : 55}
                                                    stroke={isBeat16 ? '#fff' : isBeat4 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                                                    strokeWidth={isBeat16 ? 1.5 : 0.5}
                                                />
                                            );
                                        }
                                    });
                                    return lines;
                                })()}
                            </svg>
                        </div>
                    ) : waveform ? (
                        <div className="absolute inset-0 flex items-center opacity-30">
                            <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                                {waveform.map((v, i) => (
                                    <rect key={i} x={i} y={40 - v * 35} width="0.8" height={v * 70} fill={isLeft ? '#3B82F6' : '#F97316'}/>
                                ))}
                            </svg>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full theme-text-muted text-sm">
                            {deck.audioFile ? 'Loading...' : 'Load a track'}
                        </div>
                    )}

                    <div className="absolute bottom-1 left-2 bg-black/70 px-1.5 py-0.5 rounded">
                        <span className="text-sm font-mono text-white">{formatTime(deck.currentTime)}</span>
                    </div>
                    <div className="absolute bottom-1 right-2 bg-black/70 px-1.5 py-0.5 rounded">
                        <span className="text-sm font-mono text-red-400">-{formatTime((deck.audioFile?.duration || 0) - deck.currentTime)}</span>
                    </div>
                </div>

                <div className="h-8 flex items-center justify-between px-2 theme-bg-primary border-b theme-border">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => nudgeDeck(deck, setDeck, audioRef, -0.02)}
                            className="px-1.5 py-0.5 theme-bg-secondary theme-hover rounded text-[9px] font-bold"
                            title="Nudge backward"
                        >-</button>
                        <div className="flex items-center gap-1">
                            <span className="text-base font-bold font-mono text-white">{deck.audioFile?.bpm || '---'}</span>
                            <span className="text-[8px] theme-text-muted">BPM</span>
                        </div>
                        <button
                            onClick={() => nudgeDeck(deck, setDeck, audioRef, 0.02)}
                            className="px-1.5 py-0.5 theme-bg-secondary theme-hover rounded text-[9px] font-bold"
                            title="Nudge forward"
                        >+</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${deck.audioFile?.key ? (isLeft ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300') : 'theme-text-muted'}`}>
                            {deck.audioFile?.key || '--'}
                        </span>
                        <button
                            onClick={() => setDeck(prev => ({ ...prev, keyLock: !prev.keyLock }))}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${deck.keyLock ? 'bg-green-600 text-white' : 'theme-bg-secondary theme-text-muted theme-hover'}`}
                            title="Key Lock"
                        >
                            KEY
                        </button>
                    </div>
                    <div className={`text-sm font-mono ${deck.speed !== 1 ? (deck.speed > 1 ? 'text-green-400' : 'text-red-400') : 'theme-text-muted'}`}>
                        {deck.speed > 1 ? '+' : ''}{((deck.speed - 1) * 100).toFixed(1)}%
                    </div>
                </div>

                <div className="flex-1 flex min-h-0">
                    <div className="w-28 shrink-0 border-r theme-border px-2 py-2 flex flex-col gap-1 overflow-hidden">
                        <div className="text-[9px] theme-text-muted font-semibold tracking-wider text-center mb-1">EQ</div>
                        {(['high', 'mid', 'low'] as const).map(band => (
                            <div key={band} className="flex items-center gap-1.5 min-w-0">
                                <button
                                    onClick={() => setDeck(prev => ({
                                        ...prev,
                                        eqKill: { ...prev.eqKill, [band]: !prev.eqKill[band] }
                                    }))}
                                    title={`Kill ${band}`}
                                    className={`shrink-0 w-7 h-5 text-[9px] font-bold rounded ${
                                        deck.eqKill[band] ? 'bg-red-600 text-white' : 'theme-bg-secondary theme-text-muted theme-hover'
                                    }`}
                                >
                                    {band === 'high' ? 'HI' : band === 'mid' ? 'MID' : 'LO'}
                                </button>
                                <input
                                    type="range"
                                    min={-12}
                                    max={12}
                                    value={deck.eqKill[band] ? -12 : deck.eq[band]}
                                    disabled={deck.eqKill[band]}
                                    onChange={(e) => setDeck(prev => ({
                                        ...prev,
                                        eq: { ...prev.eq, [band]: parseInt(e.target.value) }
                                    }))}
                                    className="flex-1 min-w-0 h-1.5 accent-purple-500"
                                />
                            </div>
                        ))}
                        <div className="border-t theme-border mt-2 pt-2">
                            <div className="text-[9px] theme-text-muted font-semibold tracking-wider text-center mb-1">FILTER</div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={deck.filter}
                                onChange={(e) => setDeck(prev => ({ ...prev, filter: parseInt(e.target.value) }))}
                                className="w-full h-1.5 accent-yellow-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col p-2 gap-2 min-w-0">
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => {
                                    if (audioRef.current) audioRef.current.currentTime = deck.hotCues[0] || 0;
                                    setDeck(prev => ({ ...prev, currentTime: prev.hotCues[0] || 0 }));
                                }}
                                className="p-2 theme-bg-secondary theme-hover rounded text-yellow-400"
                                title="Cue"
                            >
                                <RotateCcw size={14}/>
                            </button>
                            <button
                                onClick={() => {
                                    if (audioRef.current) {
                                        if (deck.playing) audioRef.current.pause();
                                        else audioRef.current.play();
                                    }
                                    setDeck(prev => ({ ...prev, playing: !prev.playing }));
                                }}
                                className={`p-3 rounded-lg ${deck.playing ? 'bg-green-600 hover:bg-green-700' : `${bgAccent} ${bgAccentHover}`}`}
                            >
                                {deck.playing ? <Pause size={18}/> : <Play size={18} fill="white"/>}
                            </button>
                            <button
                                onClick={() => {

                                    const otherDeck = isLeft ? deckB : deckA;
                                    if (otherDeck.audioFile?.bpm && deck.audioFile?.bpm) {
                                        const ratio = otherDeck.audioFile.bpm / deck.audioFile.bpm;
                                        const newSpeed = Math.max(0.5, Math.min(2, ratio));
                                        setDeck(prev => ({ ...prev, speed: newSpeed }));
                                        if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                                    }
                                }}
                                className={`p-2 rounded ${deck.speed === 1 ? 'theme-bg-secondary theme-hover' : 'bg-purple-600'}`}
                                title="Sync BPM"
                            >
                                <Repeat size={14}/>
                            </button>
                        </div>

                        <div>
                            <div className="text-[9px] theme-text-muted text-center mb-1">HOT CUES</div>
                            <div className="grid grid-cols-4 gap-1">
                                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                                    <button
                                        key={i}
                                        onClick={() => setHotCue(i)}
                                        onContextMenu={(e) => clearHotCue(i, e)}
                                        className={`h-6 rounded text-[10px] font-bold transition-colors ${
                                            deck.hotCues[i] !== null
                                                ? 'text-white shadow-lg'
                                                : 'theme-bg-secondary theme-hover theme-text-muted'
                                        }`}
                                        style={deck.hotCues[i] !== null ? { backgroundColor: HOT_CUE_COLORS[i] } : {}}
                                        title={deck.hotCues[i] !== null ? `${formatTime(deck.hotCues[i]!)} (right-click to clear)` : 'Set cue'}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="text-[9px] theme-text-muted text-center mb-1">LOOP</div>
                            <div className="flex gap-1 mb-1">
                                <button
                                    onClick={() => setLoopPoint('in')}
                                    className={`flex-1 h-5 rounded text-[9px] font-bold ${
                                        deck.loopIn !== null ? 'bg-green-600' : 'theme-bg-secondary theme-hover'
                                    }`}
                                >
                                    IN
                                </button>
                                <button
                                    onClick={() => setLoopPoint('out')}
                                    className={`flex-1 h-5 rounded text-[9px] font-bold ${
                                        deck.loopOut !== null ? 'bg-green-600' : 'theme-bg-secondary theme-hover'
                                    }`}
                                >
                                    OUT
                                </button>
                                <button
                                    onClick={() => setDeck(prev => ({ ...prev, loopActive: !prev.loopActive }))}
                                    disabled={deck.loopIn === null || deck.loopOut === null}
                                    className={`flex-1 h-5 rounded text-[9px] font-bold ${
                                        deck.loopActive ? 'bg-green-500 animate-pulse' : 'theme-bg-secondary theme-hover'
                                    } disabled:opacity-40`}
                                >
                                    {deck.loopActive ? 'ON' : 'OFF'}
                                </button>
                                <button
                                    onClick={() => setDeck(prev => ({ ...prev, loopIn: null, loopOut: null, loopActive: false }))}
                                    className="flex-1 h-5 rounded text-[9px] font-bold theme-bg-secondary hover:bg-red-600"
                                >
                                    CLR
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-0.5">
                                {LOOP_SIZES.map(size => (
                                    <button
                                        key={size}
                                        onClick={() => setAutoLoop(size)}
                                        className="h-5 rounded text-[9px] theme-bg-secondary hover:bg-purple-600"
                                    >
                                        {size >= 1 ? size : `1/${1/size}`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="w-20 border-l theme-border py-2 flex flex-col items-center gap-1.5">
                        <div className="text-[9px] theme-text-muted font-semibold tracking-wider">TEMPO</div>
                        <input
                            type="range"
                            min={0.5}
                            max={1.5}
                            step={0.001}
                            value={deck.speed}
                            onChange={(e) => {
                                const speed = parseFloat(e.target.value);
                                setDeck(prev => ({ ...prev, speed }));
                                if (audioRef.current) audioRef.current.playbackRate = speed;
                            }}
                            className="h-32 accent-purple-500"
                            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                        />
                        <button
                            onClick={() => {
                                setDeck(prev => ({ ...prev, speed: 1 }));
                                if (audioRef.current) audioRef.current.playbackRate = 1;
                            }}
                            title="Reset tempo to 0%"
                            className="w-12 py-0.5 text-[9px] theme-bg-secondary theme-hover rounded"
                        >
                            RESET
                        </button>
                        <div className="border-t theme-border w-full my-1"/>
                        <div className="text-[9px] theme-text-muted font-semibold tracking-wider">VOL</div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={deck.volume}
                            onChange={(e) => {
                                const vol = parseFloat(e.target.value);
                                setDeck(prev => ({ ...prev, volume: vol }));
                                if (audioRef.current) {
                                    audioRef.current.volume = vol * (isLeft ? Math.max(0, 1 - crossfader * 2) : Math.max(0, crossfader * 2 - 1));
                                }
                            }}
                            className="h-28 accent-green-500"
                            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                        />
                    </div>
                </div>

                <div className="h-9 border-t theme-border flex items-center px-2 gap-1.5">
                    <button
                        onClick={() => {
                            if (selectedAudio) {
                                setDeck(prev => ({
                                    ...defaultDeckState,
                                    audioFile: selectedAudio,
                                    volume: prev.volume
                                }));
                                if (audioRef.current) {
                                    audioRef.current.src = `file://${selectedAudio.path}`;
                                    audioRef.current.load();
                                }
                            }
                        }}
                        disabled={!selectedAudio}
                        className={`flex-1 h-6 px-2 rounded text-xs font-medium truncate flex items-center justify-center gap-1.5 ${
                            selectedAudio ? `${bgAccent} ${bgAccentHover} text-white` : 'theme-bg-secondary theme-text-muted'
                        }`}
                    >
                        <Music size={11}/>
                        <span className="truncate">{selectedAudio ? selectedAudio.name : 'Select from library'}</span>
                    </button>
                    <button
                        onClick={async () => {
                            const api = window.api;
                            if (!api?.showOpenDialog) { alert('file dialog IPC missing — restart app'); return; }
                            const result = await api.showOpenDialog({
                                title: `Open track for Deck ${label}`,
                                properties: ['openFile'],
                                filters: [
                                    { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'aiff', 'wma'] },
                                    { name: 'All Files', extensions: ['*'] },
                                ],
                            });
                            const picked: string | undefined = Array.isArray(result)
                                ? result[0]?.path
                                : result?.filePaths?.[0];
                            if (!picked) return;
                            const file = {
                                id: `picked_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                name: picked.split('/').pop() || picked,
                                path: picked,
                                duration: 0,
                            };
                            setAudioFiles(prev => prev.some(f => f.path === file.path) ? prev : [...prev, file]);
                            setSelectedAudio(file);
                            setDeck(prev => ({ ...defaultDeckState, audioFile: file, volume: prev.volume }));
                            if (audioRef.current) {
                                audioRef.current.src = `file://${file.path}`;
                                audioRef.current.load();
                            }
                        }}
                        className="h-6 px-2 theme-bg-secondary theme-hover rounded flex items-center gap-1 text-[10px] font-medium theme-text-muted"
                        title="Browse filesystem for an audio file"
                    >
                        <FolderOpen size={11}/>
                        Browse
                    </button>
                    <button
                        onClick={() => setDeck(prev => ({ ...defaultDeckState, volume: prev.volume }))}
                        className="h-6 w-6 theme-bg-secondary hover:bg-red-600 hover:text-white rounded flex items-center justify-center"
                        title="Eject"
                    >
                        <X size={12}/>
                    </button>
                </div>

                <audio
                    ref={audioRef}
                    onTimeUpdate={(e) => {
                        const time = (e.target as HTMLAudioElement).currentTime;
                        setDeck(prev => ({ ...prev, currentTime: time }));

                        if (deck.loopActive && deck.loopOut !== null && time >= deck.loopOut && deck.loopIn !== null) {
                            (e.target as HTMLAudioElement).currentTime = deck.loopIn;
                        }
                    }}
                    onEnded={() => setDeck(prev => ({ ...prev, playing: false, currentTime: 0 }))}
                    onLoadedMetadata={async (e) => {
                        const audio = e.target as HTMLAudioElement;
                        if (deck.audioFile) {

                            setDeck(prev => ({
                                ...prev,
                                audioFile: prev.audioFile ? { ...prev.audioFile, duration: audio.duration } : null
                            }));

                            try {
                                const { bpm, beats, key } = await detectBeats(deck.audioFile.path);
                                setDeck(prev => ({
                                    ...prev,
                                    audioFile: prev.audioFile ? { ...prev.audioFile, bpm, key } : null,
                                    beatGrid: beats
                                }));
                            } catch (err) {
                                console.error('Beat detection failed:', err);

                                const estimatedBpm = 120 + Math.floor(Math.random() * 20);
                                setDeck(prev => ({
                                    ...prev,
                                    audioFile: prev.audioFile ? { ...prev.audioFile, bpm: estimatedBpm, key: 'Am' } : null
                                }));
                            }
                        }
                    }}
                />
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden theme-bg-primary w-full">
            <div className="h-10 border-b theme-border flex items-center px-4 gap-4 theme-bg-primary">
                <div className="flex items-center gap-2">
                    <Disc3 className="text-purple-400" size={18}/>
                    <span className="text-sm font-bold text-purple-400">DJ MIXER</span>
                </div>
                <div className="flex-1"/>
                <button
                    onClick={() => setShowYtSearch(!showYtSearch)}
                    className={`px-3 py-1 rounded text-xs text-white flex items-center gap-1.5 ${showYtSearch ? 'bg-red-600' : 'bg-red-700 hover:bg-red-600'}`}
                    title="Search and download from YouTube"
                >
                    <Youtube size={12}/> YouTube
                </button>
                <button
                    onClick={async () => {
                        const api = window.api;
                        if (!api?.loadDemoTracks) {
                            alert('loadDemoTracks IPC not available — restart Electron.');
                            return;
                        }
                        setLoadingDemoTracks(true);
                        try {
                            const data = await api.loadDemoTracks();
                            if (!data?.success) throw new Error(data?.error || 'demo tracks failed');
                            const newFiles = (data.tracks || []).map((t: any, i: number) => ({
                                id: `demo_${Date.now()}_${i}`,
                                name: t.name,
                                path: t.path,
                                duration: 0,
                            }));
                            if (newFiles.length === 0) throw new Error('no demo tracks found in bundle');
                            setAudioFiles(prev => {
                                const existing = new Set(prev.map(f => f.path));
                                return [...prev, ...newFiles.filter((f: any) => !existing.has(f.path))];
                            });
                            // Auto-load deck A + B so the user sees something happen right away.
                            if (newFiles[0]) {
                                setDeckA(prev => ({ ...defaultDeckState, volume: prev.volume, audioFile: newFiles[0] }));
                                if (deckARef.current) {
                                    deckARef.current.src = `file://${newFiles[0].path}`;
                                    deckARef.current.load();
                                }
                            }
                            if (newFiles[1]) {
                                setDeckB(prev => ({ ...defaultDeckState, volume: prev.volume, audioFile: newFiles[1] }));
                                if (deckBRef.current) {
                                    deckBRef.current.src = `file://${newFiles[1].path}`;
                                    deckBRef.current.load();
                                }
                            }
                            setSelectedAudio(newFiles[0] || null);
                        } catch (e: any) {
                            alert('Demo track load failed: ' + (e.message || e));
                        } finally {
                            setLoadingDemoTracks(false);
                        }
                    }}
                    disabled={loadingDemoTracks}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-xs text-white flex items-center gap-1.5"
                    title="Add the bundled demo tracks to your library"
                >
                    {loadingDemoTracks ? <Loader size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                    Load Demo Tracks
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-xs theme-text-muted">MASTER</span>
                    <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.01}
                        value={djMasterGain}
                        onChange={(e) => setDjMasterGain(parseFloat(e.target.value))}
                        className="w-24 h-1.5 accent-purple-500"
                    />
                    <span className="text-xs theme-text-muted w-8">{Math.round(djMasterGain * 100)}%</span>
                </div>
            </div>

            {showYtSearch && (
                <div className="border-b theme-border theme-bg-secondary p-3 shrink-0">
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={ytQuery}
                            onChange={e => setYtQuery(e.target.value)}
                            placeholder="Search YouTube Music..."
                            className="flex-1 theme-input text-xs px-2 py-1"
                            onKeyDown={e => { if (e.key === 'Enter') searchYt(); }}
                        />
                        <button
                            onClick={searchYt}
                            disabled={ytSearching}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded text-xs text-white flex items-center gap-1"
                        >
                            {ytSearching ? <Loader size={12} className="animate-spin"/> : <Search size={12}/>}
                            {ytSearching ? '...' : 'Search'}
                        </button>
                    </div>
                    {ytResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                            {ytResults.map((r: any, i: number) => (
                                <div key={r.id || i} className="flex items-center gap-2 px-2 py-1 rounded theme-hover text-xs">
                                    <Play size={10} className="text-red-400 cursor-pointer" onClick={() => window.open(r.url, '_blank')}/>
                                    <span className="flex-1 truncate">{r.title}</span>
                                    <span className="theme-text-muted">{r.duration ? `${Math.floor(r.duration)}s` : ''}</span>
                                    <span className="theme-text-muted text-[10px] truncate max-w-[100px]">{r.uploader}</span>
                                    <button
                                        onClick={async () => {
                                            setYtDownloading(r.id);
                                            const result = await window.api?.libraryYoutubeDownload?.(r.url);
                                            setYtDownloading(null);
                                            if (result?.success && result.path) {
                                                const file: AudioFile = {
                                                    id: `yt_${r.id}`,
                                                    name: result.title || r.title,
                                                    path: result.path,
                                                    duration: 0,
                                                };
                                                setAudioFiles(prev => prev.some(f => f.path === file.path) ? prev : [...prev, file]);
                                                setSelectedAudio(file);
                                                refreshLibrary?.();
                                            } else {
                                                alert(result?.error || 'Download failed');
                                            }
                                        }}
                                        disabled={ytDownloading === r.id}
                                        className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-[10px] text-white whitespace-nowrap"
                                    >
                                        {ytDownloading === r.id ? '...' : 'Download'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 flex overflow-hidden w-full">
                {renderDeck(deckA, setDeckA, 'A', deckARef, true)}

                <div className="w-52 theme-bg-primary border-x theme-border flex flex-col">
                    <div className="h-32 p-2 border-b theme-border">
                        <div className="text-[9px] theme-text-muted text-center mb-1">LEVEL</div>
                        <div className="flex justify-center gap-3 h-full pb-2">
                            <div className="flex gap-0.5">
                                <div className="w-2 h-full theme-bg-secondary rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full rounded-sm"
                                        style={{
                                            height: `${Math.min(100, (deckA.playing ? 60 + Math.random() * 30 : 0) * deckA.volume)}%`,
                                            background: 'linear-gradient(to top, #22c55e, #eab308, #ef4444)'
                                        }}
                                    />
                                </div>
                                <div className="w-2 h-full theme-bg-secondary rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full rounded-sm"
                                        style={{
                                            height: `${Math.min(100, (deckA.playing ? 55 + Math.random() * 35 : 0) * deckA.volume)}%`,
                                            background: 'linear-gradient(to top, #22c55e, #eab308, #ef4444)'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-0.5">
                                <div className="w-2 h-full theme-bg-secondary rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full rounded-sm"
                                        style={{
                                            height: `${Math.min(100, ((deckA.playing ? 60 : 0) + (deckB.playing ? 60 : 0)) / 2 * djMasterGain)}%`,
                                            background: 'linear-gradient(to top, #22c55e, #eab308, #ef4444)'
                                        }}
                                    />
                                </div>
                                <div className="w-2 h-full theme-bg-secondary rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full rounded-sm"
                                        style={{
                                            height: `${Math.min(100, ((deckA.playing ? 55 : 0) + (deckB.playing ? 55 : 0)) / 2 * djMasterGain)}%`,
                                            background: 'linear-gradient(to top, #22c55e, #eab308, #ef4444)'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-0.5">
                                <div className="w-2 h-full theme-bg-secondary rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full rounded-sm"
                                        style={{
                                            height: `${Math.min(100, (deckB.playing ? 58 + Math.random() * 32 : 0) * deckB.volume)}%`,
                                            background: 'linear-gradient(to top, #22c55e, #eab308, #ef4444)'
                                        }}
                                    />
                                </div>
                                <div className="w-2 h-full theme-bg-secondary rounded-sm relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 w-full rounded-sm"
                                        style={{
                                            height: `${Math.min(100, (deckB.playing ? 62 + Math.random() * 28 : 0) * deckB.volume)}%`,
                                            background: 'linear-gradient(to top, #22c55e, #eab308, #ef4444)'
                                        }}
                                    />
                    </div>
                </div>
            </div>
                        <div className="flex justify-between text-[8px] theme-text-muted">
                            <span className="text-blue-400">A</span>
                            <span>M</span>
                            <span className="text-orange-400">B</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center p-3 gap-1">
                        <div className="text-[9px] theme-text-muted font-semibold tracking-wider mb-1">CROSSFADER</div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={crossfader}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setCrossfader(val);

                                let volA = 1, volB = 1;
                                if (crossfaderCurve === 'smooth') {
                                    volA = Math.cos(val * Math.PI / 2);
                                    volB = Math.sin(val * Math.PI / 2);
                                } else if (crossfaderCurve === 'cut') {

                                    volA = val < 0.1 ? 1 : val > 0.9 ? 0 : 1 - ((val - 0.1) / 0.8);
                                    volB = val > 0.9 ? 1 : val < 0.1 ? 0 : (val - 0.1) / 0.8;
                                } else {

                                    volA = 1 - val;
                                    volB = val;
                                }
                                if (deckARef.current) deckARef.current.volume = deckA.volume * volA;
                                if (deckBRef.current) deckBRef.current.volume = deckB.volume * volB;
                            }}
                            className="w-full accent-purple-500"
                        />
                        <div className="flex justify-between w-full text-[10px] mt-1">
                            <span className="text-blue-400 font-bold">A</span>
                            <span className="text-orange-400 font-bold">B</span>
                        </div>

                        <div className="mt-4 w-full">
                            <div className="text-[9px] theme-text-muted font-semibold tracking-wider text-center mb-2">MASTER FX</div>
                            <div className="space-y-1.5">
                                {[
                                    { name: 'Echo', key: 'echo', color: 'accent-cyan-500' },
                                    { name: 'Reverb', key: 'reverb', color: 'accent-purple-500' },
                                    { name: 'Filter', key: 'filter', color: 'accent-yellow-500' },
                                    { name: 'Flanger', key: 'flanger', color: 'accent-pink-500' }
                                ].map(fx => {
                                    const active = (deckAEffects[fx.key] || 0) > 0 || (deckBEffects[fx.key] || 0) > 0;
                                    return (
                                        <div key={fx.key} className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => {
                                                    setDeckAEffects(prev => ({ ...prev, [fx.key]: prev[fx.key] > 0 ? 0 : 50 }));
                                                    setDeckBEffects(prev => ({ ...prev, [fx.key]: prev[fx.key] > 0 ? 0 : 50 }));
                                                }}
                                                className={`w-14 h-5 text-[9px] font-semibold rounded transition-colors ${
                                                    active ? 'bg-purple-600 text-white' : 'theme-bg-secondary theme-text-muted theme-hover'
                                                }`}
                                            >
                                                {fx.name}
                                            </button>
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={(deckAEffects[fx.key] || 0 + deckBEffects[fx.key] || 0) / 2}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setDeckAEffects(prev => ({ ...prev, [fx.key]: val }));
                                                    setDeckBEffects(prev => ({ ...prev, [fx.key]: val }));
                                                }}
                                                className={`flex-1 h-1 ${fx.color}`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-3 flex gap-1 w-full">
                            {(['linear', 'cut', 'smooth'] as const).map(curve => (
                                <button
                                    key={curve}
                                    onClick={() => setCrossfaderCurve(curve)}
                                    className={`flex-1 py-1 text-[9px] font-medium rounded uppercase tracking-wide ${
                                        crossfaderCurve === curve ? 'bg-purple-600 text-white' : 'theme-bg-secondary theme-hover theme-text-muted'
                                    }`}
                                >
                                    {curve}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => {

                                const bpmA = deckA.audioFile?.bpm || 120;
                                const bpmB = deckB.audioFile?.bpm || 120;
                                const avgBpm = (bpmA + bpmB) / 2;

                                if (deckA.audioFile?.bpm) {
                                    const speedA = avgBpm / deckA.audioFile.bpm;
                                    setDeckA(prev => ({ ...prev, speed: speedA }));
                                    if (deckARef.current) deckARef.current.playbackRate = speedA;
                                }
                                if (deckB.audioFile?.bpm) {
                                    const speedB = avgBpm / deckB.audioFile.bpm;
                                    setDeckB(prev => ({ ...prev, speed: speedB }));
                                    if (deckBRef.current) deckBRef.current.playbackRate = speedB;
                                }
                            }}
                            className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-xs font-bold"
                        >
                            SYNC
                        </button>
                    </div>
                </div>

                {renderDeck(deckB, setDeckB, 'B', deckBRef, false)}
            </div>
        </div>
    );
};

export default DJMixerPanel;
