import React, { useRef } from 'react';
import {
    Piano, Music2, Guitar, Library, SkipBack, Play, Square,
    Undo, Redo, Copy, ClipboardPaste, Trash2, Download,
    Save, FolderOpen, X,
} from 'lucide-react';
import {
    Renderer as VFRenderer, Stave, StaveNote, Voice, Formatter,
    Beam, Accidental, StaveConnector,
} from 'vexflow';
import { demoScores, DemoScore } from '../lib/scherzoLibrary';

export interface NotationNote {
    note: number;
    start: number;
    duration: number;
    velocity: number;
}

export interface NotationTrack {
    id: string;
    name: string;
    clef: 'treble' | 'bass';
    notes: NotationNote[];
}

export interface PianoRollDrag {
    type: 'move' | 'resize';
    noteIdx: number;
    startX: number;
    startY: number;
    origNote: NotationNote;
}

export interface NoteContextMenu {
    x: number;
    y: number;
    noteIdx: number | null;
    beat: number;
    measureIdx: number;
}

export interface DragNote {
    idx: number;
    origMidi: number;
    origBeat: number;
}

export interface StaveLayoutEntry {
    x: number;
    y: number;
    width: number;
    measureIdx: number;
    clef: 'treble' | 'bass';
    topLineY: number;
    bottomLineY: number;
    trackIdx: number;
    isActive: boolean;
    noteStartX: number;
    noteEndX: number;
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

interface NotationPanelProps {
    notationView: 'piano' | 'sheet' | 'tab';
    setNotationView: (v: 'piano' | 'sheet' | 'tab') => void;
    notationTracks: NotationTrack[];
    activeTrackIdx: number;
    setActiveTrackIdx: (idx: number) => void;
    inputCursor: number;
    setInputCursor: React.Dispatch<React.SetStateAction<number>>;
    inputNoteDuration: number;
    setInputNoteDuration: React.Dispatch<React.SetStateAction<number>>;
    notationZoom: number;
    notationPlayhead: number;
    setNotationPlayhead: React.Dispatch<React.SetStateAction<number>>;
    isNotationPlaying: boolean;
    setIsNotationPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    notationBpm: number;
    setNotationBpm: React.Dispatch<React.SetStateAction<number>>;
    notationTimeSignature: [number, number];
    setNotationTimeSignature: React.Dispatch<React.SetStateAction<[number, number]>>;
    notationInstrument: 'sine' | 'triangle' | 'square' | 'sawtooth';
    setNotationInstrument: React.Dispatch<React.SetStateAction<'sine' | 'triangle' | 'square' | 'sawtooth'>>;
    notationClef: 'treble' | 'bass' | 'grand';
    setNotationClef: React.Dispatch<React.SetStateAction<'treble' | 'bass' | 'grand'>>;
    notationKeySignature: string;
    setNotationKeySignature: React.Dispatch<React.SetStateAction<string>>;
    notationMeasures: number;
    setNotationMeasures: React.Dispatch<React.SetStateAction<number>>;
    workTitle: string;
    setWorkTitle: React.Dispatch<React.SetStateAction<string>>;
    composer: string;
    setComposer: React.Dispatch<React.SetStateAction<string>>;
    selectedNotes: Set<number>;
    setSelectedNotes: React.Dispatch<React.SetStateAction<Set<number>>>;
    pianoRollDrag: PianoRollDrag | null;
    setPianoRollDrag: React.Dispatch<React.SetStateAction<PianoRollDrag | null>>;
    noteContextMenu: NoteContextMenu | null;
    setNoteContextMenu: React.Dispatch<React.SetStateAction<NoteContextMenu | null>>;
    notationClipboard: NotationNote[];
    inputOctave: number;
    setInputOctave: React.Dispatch<React.SetStateAction<number>>;
    showLibrary: boolean;
    setShowLibrary: React.Dispatch<React.SetStateAction<boolean>>;
    notationUndoStack: NotationNote[][];
    notationRedoStack: NotationNote[][];
    notationMutedTracks: Set<number>;
    setNotationMutedTracks: React.Dispatch<React.SetStateAction<Set<number>>>;

    addPianoNote: (note: number, start: number, duration?: number, velocity?: number) => void;
    pushNotationUndo: () => void;
    noteToName: (note: number) => string;
    noteToFrequency: (note: number) => number;
    playNote: (note: number, velocity?: number) => void;
    playNotation: () => void;
    stopNotation: () => void;
    notationUndo: () => void;
    notationRedo: () => void;
    copySelectedNotes: () => void;
    pasteNotes: () => void;
    deleteSelectedNotes: () => void;
    transposeSelected: (semitones: number) => void;
    exportMidi: () => Promise<void>;
    exportMusicXML: () => Promise<void>;
    importMusicXML: () => Promise<void>;
    loadDemoScore: (demo: DemoScore) => void;
    setPianoNotes: (value: NotationNote[] | ((prev: NotationNote[]) => NotationNote[])) => void;

    ghostNoteRef: React.MutableRefObject<HTMLDivElement | null>;
    ghostLabelRef: React.MutableRefObject<HTMLDivElement | null>;
    staveLayoutRef: React.MutableRefObject<StaveLayoutEntry[]>;
    sheetMusicScrollRef: React.MutableRefObject<HTMLDivElement | null>;
    sheetPlayheadRef: React.MutableRefObject<HTMLDivElement | null>;
    pianoRollGridRef: React.MutableRefObject<HTMLDivElement>;
    pianoRollScrollRef: React.MutableRefObject<HTMLDivElement>;
    dragNoteRef: React.MutableRefObject<DragNote | null>;
    tabScrollRef: React.MutableRefObject<HTMLDivElement>;
}

const NotationPanel: React.FC<NotationPanelProps> = ({
    notationView, setNotationView,
    notationTracks, activeTrackIdx, setActiveTrackIdx,
    inputCursor, setInputCursor,
    inputNoteDuration, setInputNoteDuration,
    notationZoom, notationPlayhead, setNotationPlayhead,
    isNotationPlaying, setIsNotationPlaying,
    notationBpm, setNotationBpm,
    notationTimeSignature, setNotationTimeSignature,
    notationInstrument, setNotationInstrument,
    notationClef, setNotationClef,
    notationKeySignature, setNotationKeySignature,
    notationMeasures, setNotationMeasures,
    workTitle, setWorkTitle,
    composer, setComposer,
    selectedNotes, setSelectedNotes,
    pianoRollDrag, setPianoRollDrag,
    noteContextMenu, setNoteContextMenu,
    notationClipboard,
    inputOctave, setInputOctave,
    showLibrary, setShowLibrary,
    notationUndoStack, notationRedoStack,
    notationMutedTracks, setNotationMutedTracks,
    addPianoNote, pushNotationUndo,
    noteToName, noteToFrequency,
    playNote, playNotation, stopNotation,
    notationUndo, notationRedo,
    copySelectedNotes, pasteNotes, deleteSelectedNotes,
    transposeSelected,
    exportMidi, exportMusicXML, importMusicXML,
    loadDemoScore, setPianoNotes,
    ghostNoteRef, ghostLabelRef, staveLayoutRef,
    sheetMusicScrollRef, sheetPlayheadRef,
    pianoRollGridRef, pianoRollScrollRef,
    dragNoteRef, tabScrollRef,
}) => {
    const pianoKeys = Array.from({ length: 88 }, (_, i) => i + 21);
    const guitarStrings = ['E', 'B', 'G', 'D', 'A', 'E'];
    const measures = notationMeasures;
    const beatsPerMeasure = notationTimeSignature[0];
    const totalBeats = measures * beatsPerMeasure;
    const pianoNotes = notationTracks[activeTrackIdx]?.notes ?? [];

    const visibleKeys = pianoKeys;
    const noteHeight = 14;
    const beatWidth = 40 * notationZoom;

    const handlePianoRollMouseDown = (e: React.MouseEvent, noteIdx: number, type: 'move' | 'resize') => {
        e.stopPropagation();
        e.preventDefault();
        pushNotationUndo();
        setPianoRollDrag({
            type,
            noteIdx,
            startX: e.clientX,
            startY: e.clientY,
            origNote: { ...pianoNotes[noteIdx] },
        });
    };

    const handlePianoRollMouseMove = (e: React.MouseEvent) => {
        if (!pianoRollDrag) return;
        const dx = e.clientX - pianoRollDrag.startX;
        const dy = e.clientY - pianoRollDrag.startY;
        const { type, noteIdx, origNote } = pianoRollDrag;

        if (type === 'resize') {
            const durationDelta = dx / beatWidth;
            const newDuration = Math.max(0.125, origNote.duration + durationDelta);
            const quantized = Math.round(newDuration * 4) / 4;
            setPianoNotes(prev => prev.map((n, i) => i === noteIdx ? { ...n, duration: Math.max(0.125, quantized) } : n));
        } else {
            const beatDelta = Math.round((dx / beatWidth) * 4) / 4;
            const noteDelta = -Math.round(dy / noteHeight);
            setPianoNotes(prev => prev.map((n, i) => i === noteIdx ? {
                ...n,
                start: Math.max(0, origNote.start + beatDelta),
                note: Math.max(21, Math.min(108, origNote.note + noteDelta)),
            } : n));
        }
    };

    const handlePianoRollMouseUp = () => {
        setPianoRollDrag(null);
    };

    const renderPianoRoll = () => (
        <div
            className="flex-1 flex overflow-hidden"
            style={{ background: '#121218' }}
            onMouseMove={handlePianoRollMouseMove}
            onMouseUp={handlePianoRollMouseUp}
            onMouseLeave={handlePianoRollMouseUp}
        >
            <div className="flex flex-col overflow-y-auto overflow-x-hidden" ref={pianoRollScrollRef}
                style={{ scrollbarWidth: 'none', width: '52px', background: '#0d0d12' }}
                onScroll={(e) => {
                    const gridEl = e.currentTarget.nextElementSibling as HTMLElement;
                    if (gridEl) gridEl.scrollTop = e.currentTarget.scrollTop;
                }}
            >
                {[...visibleKeys].reverse().map(note => {
                    const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
                    const isC = note % 12 === 0;
                    const isE = note % 12 === 4;
                    return (
                        <div
                            key={note}
                            onClick={() => playNote(note)}
                            className="shrink-0 cursor-pointer flex items-center justify-end pr-1"
                            style={{
                                height: `${noteHeight}px`,
                                background: isBlack
                                    ? 'linear-gradient(90deg, #1a1a24, #15151e)'
                                    : isC ? '#2a2a38' : '#1e1e2a',
                                borderBottom: isC ? '1px solid rgba(99,102,241,0.25)' : isE ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(255,255,255,0.02)',
                                color: isC ? 'rgba(165,180,252,0.9)' : isBlack ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.35)',
                                fontSize: '8px',
                                fontFamily: "'SF Mono', 'Fira Code', monospace",
                                fontWeight: isC ? 700 : 400,
                                letterSpacing: '0.5px',
                            }}
                        >
                            {isC ? noteToName(note) : note % 12 === 5 ? 'F' : ''}
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 overflow-auto" ref={pianoRollGridRef}
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #1a1a1a' }}
                onScroll={(e) => {
                    if (pianoRollScrollRef.current) pianoRollScrollRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
            >
                <div
                    className="relative"
                    style={{
                        width: `${totalBeats * beatWidth}px`,
                        minWidth: '100%',
                        height: `${visibleKeys.length * noteHeight}px`,
                    }}
                    onClick={(e) => {
                        if (pianoRollDrag) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = (e.clientX - rect.left + (e.currentTarget.parentElement?.scrollLeft || 0));
                        const y = (e.clientY - rect.top + (e.currentTarget.parentElement?.scrollTop || 0));
                        const beat = Math.floor((x / beatWidth) * 4) / 4;
                        const rowIdx = Math.floor(y / noteHeight);
                        const note = visibleKeys[visibleKeys.length - 1 - rowIdx];
                        if (note >= 21 && note <= 108) {
                            addPianoNote(note, beat, inputNoteDuration, 0.8);
                            playNote(note);
                        }
                    }}
                >
                    {visibleKeys.map((note, idx) => {
                        const rowIdx = visibleKeys.length - 1 - idx;
                        const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
                        const isC = note % 12 === 0;
                        return (
                            <div
                                key={note}
                                className="absolute left-0 right-0"
                                style={{
                                    top: `${rowIdx * noteHeight}px`,
                                    height: `${noteHeight}px`,
                                    backgroundColor: isBlack ? 'rgba(0,0,0,0.3)' : 'rgba(30,30,45,0.15)',
                                    borderBottom: isC ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(255,255,255,0.018)',
                                }}
                            />
                        );
                    })}

                    {Array.from({ length: totalBeats }).map((_, beat) => {
                        const isMeasure = beat % beatsPerMeasure === 0;
                        const isHalf = beat % (beatsPerMeasure / 2) === 0 && !isMeasure;
                        return (
                            <div
                                key={beat}
                                className="absolute top-0 bottom-0"
                                style={{
                                    left: `${beat * beatWidth}px`,
                                    width: '1px',
                                    backgroundColor: isMeasure ? 'rgba(99,102,241,0.3)' : isHalf ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
                                }}
                            />
                        );
                    })}

                    {Array.from({ length: Math.ceil(totalBeats / beatsPerMeasure) }).map((_, m) => (
                        <div
                            key={m}
                            className="absolute pointer-events-none select-none"
                            style={{
                                left: `${m * beatsPerMeasure * beatWidth + 4}px`,
                                top: '3px',
                                fontSize: '9px',
                                color: 'rgba(99,102,241,0.45)',
                                fontWeight: 700,
                                fontFamily: "'SF Mono', 'Fira Code', monospace",
                                letterSpacing: '0.5px',
                            }}
                        >
                            {m + 1}
                        </div>
                    ))}

                    {pianoNotes.map((note, idx) => {
                        const keyIdx = visibleKeys.indexOf(note.note);
                        if (keyIdx === -1) return null;
                        const rowIdx = visibleKeys.length - 1 - keyIdx;
                        const noteW = Math.max(note.duration * beatWidth, 6);
                        const isSelected = selectedNotes.has(idx);
                        const hue = (note.note % 12) * 30;
                        return (
                            <div
                                key={idx}
                                className="absolute cursor-grab group"
                                style={{
                                    top: `${rowIdx * noteHeight + 1}px`,
                                    left: `${note.start * beatWidth}px`,
                                    width: `${noteW}px`,
                                    height: `${noteHeight - 2}px`,
                                    borderRadius: '2px',
                                    background: isSelected
                                        ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                                        : `linear-gradient(180deg, hsla(${hue},75%,60%,${0.7 + note.velocity * 0.3}), hsla(${hue},65%,42%,${0.65 + note.velocity * 0.35}))`,
                                    border: isSelected ? '1px solid #fcd34d' : `1px solid hsla(${hue},60%,70%,0.3)`,
                                    boxShadow: isSelected
                                        ? '0 0 10px rgba(251,191,36,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                                        : `0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 hsla(${hue},60%,80%,0.15)`,
                                    zIndex: isSelected ? 10 : 1,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNotes(prev => {
                                        const next = new Set(prev);
                                        if (e.shiftKey) {
                                            if (next.has(idx)) next.delete(idx); else next.add(idx);
                                        } else {
                                            if (next.has(idx) && next.size === 1) next.delete(idx);
                                            else { next.clear(); next.add(idx); }
                                        }
                                        return next;
                                    });
                                }}
                                onMouseDown={(e) => { if (e.button === 0) handlePianoRollMouseDown(e, idx, 'move'); }}
                                title={`${noteToName(note.note)} | Beat ${note.start} | Dur ${note.duration} | Vel ${Math.round(note.velocity * 100)}%`}
                            >
                                <span className="pointer-events-none select-none pl-0.5" style={{
                                    fontSize: '7px', color: 'rgba(255,255,255,0.9)', fontWeight: 600,
                                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                                    textShadow: '0 1px 1px rgba(0,0,0,0.4)',
                                }}>
                                    {noteW > 30 ? noteToName(note.note) : ''}
                                </span>
                                <div className="absolute bottom-0 left-0 pointer-events-none" style={{
                                    height: '2px', borderRadius: '0 0 2px 2px',
                                    width: `${note.velocity * 100}%`,
                                    background: isSelected ? 'rgba(255,255,255,0.5)' : `hsla(${hue},80%,75%,0.5)`,
                                }}/>
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100"
                                    style={{ background: 'rgba(255,255,255,0.35)', borderRadius: '0 2px 2px 0' }}
                                    onMouseDown={(e) => { e.stopPropagation(); handlePianoRollMouseDown(e, idx, 'resize'); }}
                                />
                            </div>
                        );
                    })}

                    {(isNotationPlaying || notationPlayhead > 0) && (
                        <div
                            className="absolute top-0 pointer-events-none z-30"
                            style={{ left: `${notationPlayhead * beatWidth}px`, height: `${visibleKeys.length * noteHeight}px` }}
                        >
                            <div className="absolute top-0 bottom-0" style={{
                                left: '-6px', width: '13px',
                                background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.08), rgba(239,68,68,0.12), rgba(239,68,68,0.08), transparent)',
                            }}/>
                            <div style={{
                                position: 'absolute', top: '-2px', left: '-5px',
                                width: 0, height: 0,
                                borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                                borderTop: '8px solid #ef4444',
                                filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.8))',
                            }}/>
                            <div style={{
                                width: '2px', height: '100%',
                                background: 'linear-gradient(180deg, #ef4444, #dc2626)',
                                transform: 'translateX(-1px)',
                                boxShadow: '0 0 8px rgba(239,68,68,0.5), 0 0 2px rgba(239,68,68,0.8)',
                            }}/>
                        </div>
                    )}

                    {!isNotationPlaying && (
                        <div
                            className="absolute top-0 bottom-0 pointer-events-none z-10"
                            style={{
                                left: `${inputCursor * beatWidth}px`,
                                width: '1px',
                                background: 'rgba(52,211,153,0.4)',
                                boxShadow: '0 0 6px rgba(52,211,153,0.2)',
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );

    const renderSheetMusic = () => {
        const midiToVexPitch = (midi: number): string => {
            const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(midi / 12) - 1;
            const name = names[midi % 12];
            return `${name}/${octave}`;
        };

        const quantizeDuration = (dur: number): string => {
            if (dur >= 3.5) return 'w';
            if (dur >= 1.75) return 'h';
            if (dur >= 0.875) return 'q';
            if (dur >= 0.4375) return '8';
            if (dur >= 0.21875) return '16';
            return '32';
        };

        const durationBeats = (d: string): number => {
            const map: Record<string, number> = { 'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125 };
            return map[d] || 1;
        };

        type RenderTrack = { name: string; clef: 'treble' | 'bass'; notes: NotationNote[] };
        let renderTracks: RenderTrack[];
        if (notationTracks.length === 1 && notationClef === 'grand') {
            const allNotes = notationTracks[0].notes;
            renderTracks = [
                { name: notationTracks[0].name, clef: 'treble', notes: allNotes.filter(n => n.note >= 60) },
                { name: notationTracks[0].name, clef: 'bass', notes: allNotes.filter(n => n.note < 60) },
            ];
        } else {
            renderTracks = notationTracks.map(t => ({ name: t.name, clef: t.clef, notes: t.notes }));
        }

        const groupedByTrack: Array<Array<NotationNote[]>> = renderTracks.map(track => {
            const out: NotationNote[][] = [];
            for (let m = 0; m < measures; m++) {
                const ms = m * beatsPerMeasure;
                const me = ms + beatsPerMeasure;
                out.push(track.notes.filter(n => n.start >= ms && n.start < me));
            }
            return out;
        });

        const renderVexFlow = (container: HTMLDivElement | null) => {
            if (!container) return;
            const tracksKey = renderTracks.map(t =>
                `${t.name}:${t.clef}:${t.notes.map(n => `${n.note}|${n.start}|${n.duration}`).join(',')}`
            ).join('||');
            const contentKey = `${tracksKey}|${notationKeySignature}|${notationTimeSignature.join('/')}|${measures}|${activeTrackIdx}`;
            if (container.dataset.vfKey === contentKey) return;
            container.dataset.vfKey = contentKey;
            container.innerHTML = '';
            staveLayoutRef.current = [];

            const measuresPerLine = 4;
            const staveStartX = 50;
            const pageWidth = 1100;
            const staveWidth = Math.floor((pageWidth - staveStartX - 30) / measuresPerLine);
            const staveSpacing = 90;
            const linePadding = 40;
            const numTracks = renderTracks.length;
            const lineHeight = numTracks * staveSpacing + linePadding;
            const totalLines = Math.ceil(measures / measuresPerLine);
            const totalHeight = Math.max(totalLines * lineHeight + 80, 500);

            const renderer = new VFRenderer(container, VFRenderer.Backends.SVG);
            renderer.resize(pageWidth, totalHeight);
            const context = renderer.getContext();
            context.setFont('Arial', 10);

            const svgEl = container.querySelector('svg');
            if (svgEl) {
                svgEl.style.overflow = 'visible';
                const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                style.textContent = `
                    .vf-stave .vf-stave-section rect { stroke-width: 0.8; }
                    line.vf-barline { stroke-width: 1.2 !important; }
                `;
                svgEl.prepend(style);
            }

            for (let line = 0; line < totalLines; line++) {
                const lineY = line * lineHeight + 30;

                for (let mInLine = 0; mInLine < measuresPerLine; mInLine++) {
                    const mIdx = line * measuresPerLine + mInLine;
                    if (mIdx >= measures) break;

                    const x = staveStartX + mInLine * staveWidth;
                    const isFirstInLine = mInLine === 0;
                    const isFirstMeasure = mIdx === 0;

                    const stavesAtMeasure: Stave[] = [];
                    renderTracks.forEach((track, tIdx) => {
                        const sy = lineY + tIdx * staveSpacing;
                        const stave = new Stave(x, sy, staveWidth);
                        if (isFirstInLine) stave.addClef(track.clef);
                        if (isFirstMeasure) {
                            stave.addTimeSignature(`${notationTimeSignature[0]}/${notationTimeSignature[1]}`);
                            if (notationKeySignature !== 'C') stave.addKeySignature(notationKeySignature);
                        }
                        if (tIdx === 0 && (isFirstInLine || mIdx > 0)) {
                            stave.setMeasure(mIdx + 1);
                        }
                        stave.setContext(context).draw();
                        stavesAtMeasure.push(stave);

                        if (isFirstInLine && track.name) {
                            try {
                                const ctx: any = context;
                                if (ctx.save) ctx.save();
                                ctx.setFont?.('Arial', 9, 'normal');
                                ctx.fillText?.(track.name, x - 46, sy + 30);
                                if (ctx.restore) ctx.restore();
                            } catch {}
                        }
                    });

                    if (isFirstInLine && stavesAtMeasure.length > 1) {
                        const top = stavesAtMeasure[0];
                        const bot = stavesAtMeasure[stavesAtMeasure.length - 1];
                        try {
                            new StaveConnector(top, bot).setType('singleLeft').setContext(context).draw();
                            new StaveConnector(top, bot).setType('brace').setContext(context).draw();
                        } catch {}
                    }

                    const fillRests = (out: StaveNote[], beatsFilled: number, clef: string) => {
                        let remaining = beatsPerMeasure - beatsFilled;
                        while (remaining > 0) {
                            let restDur = 'qr', restBeats = 1;
                            if (remaining >= 4) { restDur = 'wr'; restBeats = 4; }
                            else if (remaining >= 2) { restDur = 'hr'; restBeats = 2; }
                            else if (remaining >= 1) { restDur = 'qr'; restBeats = 1; }
                            else if (remaining >= 0.5) { restDur = '8r'; restBeats = 0.5; }
                            else { restDur = '16r'; restBeats = 0.25; }
                            try {
                                out.push(new StaveNote({
                                    clef,
                                    keys: [clef === 'bass' ? 'D/3' : 'B/4'],
                                    duration: restDur,
                                }));
                            } catch { break; }
                            remaining -= restBeats;
                        }
                    };

                    renderTracks.forEach((track, tIdx) => {
                        const stave = stavesAtMeasure[tIdx];
                        const measureNotes = groupedByTrack[tIdx][mIdx] || [];
                        const clef = track.clef;
                        const restPitch = clef === 'bass' ? 'D/3' : 'B/4';

                        const out: StaveNote[] = [];
                        let beatsFilled = 0;

                        if (measureNotes.length === 0) {
                            out.push(new StaveNote({ clef, keys: [restPitch], duration: 'wr' }));
                        } else {
                            const sorted = [...measureNotes].sort((a, b) => a.start - b.start || a.note - b.note);

                            const groups: NotationNote[][] = [];
                            for (const n of sorted) {
                                const last = groups[groups.length - 1];
                                if (last && Math.abs(last[0].start - n.start) < 0.01) last.push(n);
                                else groups.push([n]);
                            }

                            for (const group of groups) {
                                const maxDur = Math.max(...group.map(n => n.duration));
                                const vexDuration = quantizeDuration(maxDur);
                                const beats = durationBeats(vexDuration);
                                const keys = group.map(n => midiToVexPitch(n.note));
                                try {
                                    const sn = new StaveNote({ clef, keys, duration: vexDuration });
                                    keys.forEach((pitch, idx) => {
                                        const noteName = pitch.split('/')[0];
                                        if (noteName.includes('#')) sn.addModifier(new Accidental('#'), idx);
                                        else if (noteName.includes('b')) sn.addModifier(new Accidental('b'), idx);
                                    });
                                    out.push(sn);
                                    beatsFilled += beats;
                                } catch {}
                            }

                            if (out.length === 0) {
                                out.push(new StaveNote({ clef, keys: [restPitch], duration: 'wr' }));
                            } else {
                                fillRests(out, beatsFilled, clef);
                            }
                        }

                        try {
                            const voice = new Voice({ numBeats: beatsPerMeasure, beatValue: notationTimeSignature[1] })
                                .setMode(Voice.Mode.SOFT);
                            voice.addTickables(out);
                            new Formatter().joinVoices([voice])
                                .format([voice], staveWidth - (isFirstInLine ? 60 : 20));
                            voice.draw(context, stave);

                            const beamable = out.filter(n => {
                                const d = n.getDuration();
                                return !d.includes('r') && (d === '8' || d === '16' || d === '32');
                            });
                            if (beamable.length >= 2) {
                                Beam.generateBeams(beamable).forEach(b => b.setContext(context).draw());
                            }
                        } catch {}

                        try {
                            const noteStartX = (stave as any).getNoteStartX?.() ?? x;
                            const noteEndX = x + staveWidth;
                            staveLayoutRef.current.push({
                                x, y: lineY + tIdx * staveSpacing, width: staveWidth, measureIdx: mIdx,
                                clef: track.clef,
                                topLineY: stave.getYForLine(0),
                                bottomLineY: stave.getYForLine(4),
                                trackIdx: tIdx,
                                isActive: tIdx === activeTrackIdx,
                                noteStartX,
                                noteEndX,
                            });
                        } catch {}
                    });
                }
            }
        };

        const sheetNoteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const sheetNoteNamesFull = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        const addSheetNote = (noteName: string, octave: number) => {
            const noteIdx = sheetNoteNamesFull.indexOf(noteName);
            if (noteIdx === -1) return;
            const midi = (octave + 1) * 12 + noteIdx;
            addPianoNote(midi, inputCursor, inputNoteDuration, 0.8);
            playNote(midi);
        };

        const addSheetRest = () => {
            setInputCursor(prev => prev + inputNoteDuration);
        };

        const snapToStaff = (container: HTMLDivElement, clientX: number, clientY: number) => {
            if (staveLayoutRef.current.length === 0) return null;
            const svg = container.querySelector('svg');
            const rect = svg ? svg.getBoundingClientRect() : container.getBoundingClientRect();
            const svgX = (clientX - rect.left) / notationZoom;
            const svgY = (clientY - rect.top) / notationZoom;

            let closestStave: StaveLayoutEntry | null = null;
            let minDist = Infinity;
            for (const stave of staveLayoutRef.current) {
                const margin = 25;
                if (svgX >= stave.x && svgX <= stave.x + stave.width &&
                    svgY >= stave.topLineY - margin && svgY <= stave.bottomLineY + margin) {
                    const centerY = (stave.topLineY + stave.bottomLineY) / 2;
                    const dist = Math.abs(svgY - centerY);
                    if (dist < minDist) { minDist = dist; closestStave = stave; }
                }
            }
            if (!closestStave) return null;

            const lineSpacing = (closestStave.bottomLineY - closestStave.topLineY) / 4;
            const halfLine = lineSpacing / 2;
            const staffPos = Math.round((svgY - closestStave.topLineY) / halfLine);
            const snappedSvgY = closestStave.topLineY + staffPos * halfLine;
            const midi = staffPositionToMidi(staffPos, closestStave.clef);

            const xRatio = (svgX - closestStave.x) / closestStave.width;
            const beatInMeasure = Math.max(0, Math.min(beatsPerMeasure - 0.25, xRatio * beatsPerMeasure));
            const quantStep = Math.min(inputNoteDuration, 0.5);
            const quantizedBeat = Math.round(beatInMeasure / quantStep) * quantStep;
            const snappedSvgX = closestStave.x + (quantizedBeat / beatsPerMeasure) * closestStave.width;
            const globalBeat = closestStave.measureIdx * beatsPerMeasure + quantizedBeat;

            const screenX = rect.left + snappedSvgX * notationZoom;
            const screenY = rect.top + snappedSvgY * notationZoom;

            return { midi, globalBeat, screenX, screenY, staffPos, clef: closestStave.clef };
        };

        const findNoteAt = (midi: number, beat: number): number | null => {
            for (let i = 0; i < pianoNotes.length; i++) {
                const n = pianoNotes[i];
                if (Math.abs(n.start - beat) < 0.3 && Math.abs(n.note - midi) <= 1) return i;
            }
            return null;
        };

        const positionGhost = (vfContainer: HTMLElement, snap: NonNullable<ReturnType<typeof snapToStaff>>, dragging: boolean) => {
            const ghost = ghostNoteRef.current;
            const label = ghostLabelRef.current;
            if (!ghost || !label) return;

            const vfRect = vfContainer.getBoundingClientRect();
            const gx = snap.screenX - vfRect.left;
            const gy = snap.screenY - vfRect.top;

            ghost.style.display = 'block';
            ghost.style.left = `${gx - 6}px`;
            ghost.style.top = `${gy - 6}px`;
            ghost.style.background = dragging ? 'rgba(234, 88, 12, 0.6)' : 'rgba(147, 51, 234, 0.5)';
            ghost.style.borderColor = dragging ? 'rgba(234, 88, 12, 0.9)' : 'rgba(147, 51, 234, 0.8)';
            ghost.style.width = dragging ? '14px' : '12px';
            ghost.style.height = dragging ? '14px' : '12px';

            label.style.display = 'block';
            label.style.left = `${gx + 12}px`;
            label.style.top = `${gy - 10}px`;
            label.style.color = dragging ? 'rgba(234, 88, 12, 0.9)' : 'rgba(147, 51, 234, 0.9)';
            label.textContent = noteToName(snap.midi);
        };

        const hideGhost = () => {
            if (ghostNoteRef.current) ghostNoteRef.current.style.display = 'none';
            if (ghostLabelRef.current) ghostLabelRef.current.style.display = 'none';
        };

        const handleStaffMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
            const vfContainer = e.currentTarget.querySelector('div[style]') as HTMLDivElement;
            if (!vfContainer) return;
            const snap = snapToStaff(vfContainer, e.clientX, e.clientY);
            if (!snap) { hideGhost(); return; }

            const dragging = dragNoteRef.current !== null;

            if (dragging) {
                positionGhost(vfContainer, snap, true);
                e.currentTarget.style.cursor = 'grabbing';
            } else {
                const hoverIdx = findNoteAt(snap.midi, snap.globalBeat);
                if (hoverIdx !== null) {
                    e.currentTarget.style.cursor = 'grab';
                } else {
                    e.currentTarget.style.cursor = 'crosshair';
                }
                positionGhost(vfContainer, snap, false);
            }
        };

        const handleStaffMouseLeave = () => {
            hideGhost();
            dragNoteRef.current = null;
        };

        const handleStaffMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.button !== 0) return;
            const vfContainer = e.currentTarget.querySelector('div[style]') as HTMLDivElement;
            if (!vfContainer) return;
            const snap = snapToStaff(vfContainer, e.clientX, e.clientY);
            if (!snap) return;

            const noteIdx = findNoteAt(snap.midi, snap.globalBeat);
            if (noteIdx !== null) {
                e.preventDefault();
                dragNoteRef.current = {
                    idx: noteIdx,
                    origMidi: pianoNotes[noteIdx].note,
                    origBeat: pianoNotes[noteIdx].start,
                };
            }
        };

        const handleStaffMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
            const drag = dragNoteRef.current;
            if (!drag) return;

            const vfContainer = e.currentTarget.querySelector('div[style]') as HTMLDivElement;
            if (!vfContainer) { dragNoteRef.current = null; return; }
            const snap = snapToStaff(vfContainer, e.clientX, e.clientY);
            dragNoteRef.current = null;
            e.currentTarget.style.cursor = 'crosshair';

            if (!snap) return;

            if (snap.midi !== drag.origMidi || Math.abs(snap.globalBeat - drag.origBeat) > 0.01) {
                pushNotationUndo();
                setPianoNotes(prev => prev.map((n, i) =>
                    i === drag.idx ? { ...n, note: snap.midi, start: snap.globalBeat } : n
                ));
                playNote(snap.midi);
            }
        };

        const handleStaffDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
            if (dragNoteRef.current) return;
            const vfContainer = e.currentTarget.querySelector('div[style]') as HTMLDivElement;
            if (!vfContainer) return;
            const snap = snapToStaff(vfContainer, e.clientX, e.clientY);
            if (!snap) return;

            if (findNoteAt(snap.midi, snap.globalBeat) !== null) return;
            addPianoNote(snap.midi, snap.globalBeat, inputNoteDuration, 0.8);
            playNote(snap.midi);
        };

        const handleStaffRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const vfContainer = e.currentTarget.querySelector('div[style]') as HTMLDivElement;
            if (!vfContainer || staveLayoutRef.current.length === 0) {
                setNoteContextMenu(null);
                return;
            }

            const rect = vfContainer.getBoundingClientRect();
            const clickX = (e.clientX - rect.left) / notationZoom;
            const clickY = (e.clientY - rect.top) / notationZoom;

            let closestStave: StaveLayoutEntry | null = null;
            for (const stave of staveLayoutRef.current) {
                const margin = 25;
                if (clickX >= stave.x && clickX <= stave.x + stave.width &&
                    clickY >= stave.topLineY - margin && clickY <= stave.bottomLineY + margin) {
                    closestStave = stave;
                    break;
                }
            }
            if (!closestStave) { setNoteContextMenu(null); return; }

            const xRatio = (clickX - closestStave.x) / closestStave.width;
            const beatInMeasure = Math.max(0, xRatio * beatsPerMeasure);
            const globalBeat = closestStave.measureIdx * beatsPerMeasure + beatInMeasure;

            let nearestNoteIdx: number | null = null;
            let minDist = 0.5;
            pianoNotes.forEach((n, idx) => {
                const dist = Math.abs(n.start - globalBeat);
                if (dist < minDist) { minDist = dist; nearestNoteIdx = idx; }
            });

            setNoteContextMenu({
                x: e.clientX, y: e.clientY,
                noteIdx: nearestNoteIdx,
                beat: globalBeat,
                measureIdx: closestStave.measureIdx,
            });
        };

        const durationOptions = [
            { value: 4, label: '\u{1D15D}', title: 'Whole' },
            { value: 2, label: '\u{1D15E}\u{1D165}', title: 'Half' },
            { value: 1, label: '\u2669', title: 'Quarter' },
            { value: 0.5, label: '\u266A', title: 'Eighth' },
            { value: 0.25, label: '\u{1D161}\u{1D165}\u{1D16F}', title: '16th' },
        ];

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-1 px-3 h-8 shrink-0 border-b theme-border theme-bg-secondary">
                    <select value={notationKeySignature} onChange={(e) => setNotationKeySignature(e.target.value)}
                        className="px-1.5 py-0.5 rounded text-xs theme-bg-tertiary theme-border border">
                        {['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Cb', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].map(k => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                    <select value={notationClef} onChange={(e) => setNotationClef(e.target.value as 'treble' | 'bass' | 'grand')}
                        className="px-1.5 py-0.5 rounded text-xs theme-bg-tertiary theme-border border">
                        <option value="treble">Treble</option>
                        <option value="bass">Bass</option>
                        <option value="grand">Grand</option>
                    </select>

                    <div className="w-px h-4 theme-bg-tertiary"/>

                    {durationOptions.map(d => (
                        <button key={d.value} onClick={() => setInputNoteDuration(d.value)} title={d.title}
                            className={`w-6 h-6 flex items-center justify-center rounded text-sm border ${inputNoteDuration === d.value ? 'bg-purple-600 text-white border-purple-600' : 'theme-bg-tertiary theme-text-muted theme-border theme-hover'}`}>
                            {d.label}
                        </button>
                    ))}

                    <div className="w-px h-4 theme-bg-tertiary"/>

                    <span className="text-[10px] font-medium theme-text-muted">Oct</span>
                    <button onClick={() => setInputOctave(o => Math.max(1, o - 1))} className="w-5 h-5 flex items-center justify-center rounded text-xs theme-bg-tertiary theme-hover theme-border border">-</button>
                    <span className="text-xs font-bold w-3 text-center">{inputOctave}</span>
                    <button onClick={() => setInputOctave(o => Math.min(7, o + 1))} className="w-5 h-5 flex items-center justify-center rounded text-xs theme-bg-tertiary theme-hover theme-border border">+</button>

                    <div className="w-px h-4 theme-bg-tertiary"/>

                    {sheetNoteNames.map(name => (
                        <React.Fragment key={name}>
                            <button onClick={() => addSheetNote(name, inputOctave)}
                                className="h-6 w-6 rounded text-xs font-semibold theme-bg-tertiary theme-hover theme-border border">{name}</button>
                            {name !== 'E' && name !== 'B' && (
                                <button onClick={() => addSheetNote(name + '#', inputOctave)}
                                    className="h-5 w-5 rounded text-[9px] font-semibold -mx-0.5 bg-gray-600 text-gray-200 hover:bg-gray-500 border border-gray-500">{name}#</button>
                            )}
                        </React.Fragment>
                    ))}
                    <button onClick={addSheetRest} className="h-6 px-2 rounded text-xs font-medium theme-bg-tertiary theme-hover theme-border border" title="Rest">Rest</button>
                </div>

                {notationTracks.length > 1 && (
                    <div className="flex items-center gap-1.5 px-3 h-7 shrink-0 border-b theme-border theme-bg-secondary overflow-x-auto">
                        <span className="text-[10px] font-medium theme-text-muted shrink-0">Tracks:</span>
                        {notationTracks.map((t, i) => {
                            const isMuted = notationMutedTracks.has(i);
                            return (
                                <div key={t.id} className="flex items-center rounded border theme-border overflow-hidden shrink-0">
                                    <button
                                        onClick={() => setActiveTrackIdx(i)}
                                        className={`px-2 py-0.5 text-[11px] whitespace-nowrap ${
                                            i === activeTrackIdx
                                                ? 'bg-purple-600 text-white'
                                                : 'theme-bg-tertiary theme-text-muted theme-hover'
                                        } ${isMuted ? 'opacity-50 line-through' : ''}`}
                                        title={`Edit ${t.name} (${t.clef})`}
                                    >
                                        {t.name}
                                    </button>
                                    <button
                                        onClick={() => setNotationMutedTracks(prev => {
                                            const next = new Set(prev);
                                            if (next.has(i)) next.delete(i); else next.add(i);
                                            return next;
                                        })}
                                        className={`px-1.5 py-0.5 text-[10px] border-l theme-border ${
                                            isMuted
                                                ? 'bg-red-600 text-white'
                                                : 'theme-bg-tertiary theme-text-muted theme-hover'
                                        }`}
                                        title={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        M
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div
                    className="flex-1 overflow-auto cursor-crosshair relative"
                    ref={sheetMusicScrollRef}
                    onMouseDown={handleStaffMouseDown}
                    onMouseMove={handleStaffMouseMove}
                    onMouseUp={handleStaffMouseUp}
                    onMouseLeave={handleStaffMouseLeave}
                    onDoubleClick={handleStaffDoubleClick}
                    onContextMenu={handleStaffRightClick}
                    onClick={() => setNoteContextMenu(null)}
                    title="Double-click to place notes, drag to move"
                    style={{ background: '#8b8b92', padding: '24px 16px' }}
                >
                    <div style={{
                        background: '#fff',
                        margin: '0 auto',
                        width: `${(1100 + 90) * notationZoom}px`,
                        maxWidth: '100%',
                        minHeight: `${Math.max((Math.max(Math.ceil(measures / 4) * (notationClef === 'grand' ? 240 : 150) + 80, 500)) * notationZoom + 100, 600)}px`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
                        padding: '40px 45px 60px',
                        position: 'relative',
                    }}>
                        <div style={{ marginBottom: '20px', textAlign: 'center', userSelect: 'text' }}>
                            <input
                                type="text"
                                value={workTitle}
                                onChange={(e) => setWorkTitle(e.target.value)}
                                placeholder="Untitled"
                                style={{
                                    width: '100%',
                                    textAlign: 'center',
                                    fontSize: '22px',
                                    fontWeight: 600,
                                    fontFamily: 'Georgia, "Times New Roman", serif',
                                    color: '#111',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    padding: '2px 0',
                                }}
                            />
                            <input
                                type="text"
                                value={composer}
                                onChange={(e) => setComposer(e.target.value)}
                                placeholder="Composer"
                                style={{
                                    width: '100%',
                                    textAlign: 'right',
                                    fontSize: '13px',
                                    fontStyle: 'italic',
                                    fontFamily: 'Georgia, "Times New Roman", serif',
                                    color: '#333',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    padding: '2px 4px 0 0',
                                }}
                            />
                        </div>
                        <div
                            ref={renderVexFlow}
                            style={{ transform: `scale(${notationZoom})`, transformOrigin: 'top left' }}
                        />
                        <div
                            ref={sheetPlayheadRef}
                            className="absolute pointer-events-none z-20"
                            style={{
                                display: (isNotationPlaying || notationPlayhead > 0) ? 'block' : 'none',
                                left: '0px', top: '0px',
                                width: '2.5px',
                                height: '0px',
                                background: 'rgba(59, 130, 246, 0.85)',
                                boxShadow: '0 0 6px rgba(59,130,246,0.4)',
                                borderRadius: '1px',
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: '-6px', left: '-4.75px',
                                width: 0, height: 0,
                                borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                                borderTop: '6px solid rgba(59, 130, 246, 0.9)',
                            }}/>
                        </div>
                        <div
                            ref={ghostNoteRef}
                            className="absolute pointer-events-none"
                            style={{
                                display: 'none',
                                width: 12, height: 12,
                                borderRadius: '50%',
                                background: 'rgba(99, 102, 241, 0.5)',
                                border: '2px solid rgba(99, 102, 241, 0.8)',
                                boxShadow: '0 0 6px rgba(99,102,241,0.3)',
                            }}
                        />
                        <div
                            ref={ghostLabelRef}
                            className="absolute pointer-events-none text-xs font-bold"
                            style={{
                                display: 'none',
                                color: 'rgba(99, 102, 241, 0.9)',
                                textShadow: '0 0 3px white, 0 0 3px white',
                                fontFamily: "'SF Mono', monospace",
                            }}
                        />
                    </div>
                </div>

                {noteContextMenu && (
                    <div
                        className="fixed z-50 theme-bg-secondary border theme-border rounded-lg shadow-xl py-1 min-w-[180px]"
                        style={{ left: noteContextMenu.x, top: noteContextMenu.y }}
                        onClick={() => setNoteContextMenu(null)}
                    >
                        {noteContextMenu.noteIdx !== null ? (
                            <>
                                <div className="px-3 py-1 text-xs theme-text-muted border-b theme-border">
                                    {noteToName(pianoNotes[noteContextMenu.noteIdx].note)} - Beat {pianoNotes[noteContextMenu.noteIdx].start.toFixed(1)}
                                </div>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-sm theme-hover text-red-400"
                                    onClick={() => {
                                        setPianoNotes(prev => prev.filter((_, i) => i !== noteContextMenu.noteIdx));
                                        setNoteContextMenu(null);
                                    }}
                                >
                                    Delete Note
                                </button>
                                <div className="border-t theme-border my-1"/>
                                <div className="px-3 py-1 text-xs theme-text-muted">Change Duration</div>
                                {[
                                    { v: 4, l: 'Whole' }, { v: 2, l: 'Half' }, { v: 1, l: 'Quarter' },
                                    { v: 0.5, l: 'Eighth' }, { v: 0.25, l: '16th' }
                                ].map(d => (
                                    <button
                                        key={d.v}
                                        className={`w-full text-left px-3 py-1 text-sm theme-hover ${
                                            pianoNotes[noteContextMenu.noteIdx!]?.duration === d.v ? 'text-purple-400' : 'theme-text-secondary'
                                        }`}
                                        onClick={() => {
                                            const idx = noteContextMenu.noteIdx!;
                                            setPianoNotes(prev => prev.map((n, i) => i === idx ? { ...n, duration: d.v } : n));
                                            setNoteContextMenu(null);
                                        }}
                                    >
                                        {d.l} {pianoNotes[noteContextMenu.noteIdx!]?.duration === d.v ? '  *' : ''}
                                    </button>
                                ))}
                                <div className="border-t theme-border my-1"/>
                                <div className="px-3 py-1 text-xs theme-text-muted">Octave</div>
                                <div className="flex gap-1 px-3 py-1">
                                    <button
                                        className="px-2 py-0.5 theme-bg-tertiary rounded text-xs theme-hover"
                                        onClick={() => {
                                            const idx = noteContextMenu.noteIdx!;
                                            setPianoNotes(prev => prev.map((n, i) => i === idx ? { ...n, note: Math.max(21, n.note - 12) } : n));
                                            setNoteContextMenu(null);
                                        }}
                                    >Oct -</button>
                                    <button
                                        className="px-2 py-0.5 theme-bg-tertiary rounded text-xs theme-hover"
                                        onClick={() => {
                                            const idx = noteContextMenu.noteIdx!;
                                            setPianoNotes(prev => prev.map((n, i) => i === idx ? { ...n, note: Math.min(108, n.note + 12) } : n));
                                            setNoteContextMenu(null);
                                        }}
                                    >Oct +</button>
                                </div>
                                <div className="border-t theme-border my-1"/>
                                <div className="px-3 py-1 text-xs theme-text-muted">Velocity</div>
                                <div className="flex gap-1 px-3 py-1">
                                    {[0.3, 0.5, 0.7, 0.9, 1.0].map(v => (
                                        <button
                                            key={v}
                                            className={`px-2 py-0.5 rounded text-xs ${
                                                Math.abs((pianoNotes[noteContextMenu.noteIdx!]?.velocity || 0) - v) < 0.05
                                                    ? 'bg-purple-600' : 'theme-bg-tertiary theme-hover'
                                            }`}
                                            onClick={() => {
                                                const idx = noteContextMenu.noteIdx!;
                                                setPianoNotes(prev => prev.map((n, i) => i === idx ? { ...n, velocity: v } : n));
                                                setNoteContextMenu(null);
                                            }}
                                        >
                                            {v === 0.3 ? 'pp' : v === 0.5 ? 'mp' : v === 0.7 ? 'mf' : v === 0.9 ? 'f' : 'ff'}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-3 py-1 text-xs theme-text-muted border-b theme-border">
                                    Measure {noteContextMenu.measureIdx + 1}, Beat {(noteContextMenu.beat % beatsPerMeasure).toFixed(1)}
                                </div>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-sm theme-hover theme-text-secondary"
                                    onClick={() => {
                                        setInputCursor(noteContextMenu.beat);
                                        setNoteContextMenu(null);
                                    }}
                                >
                                    Set Cursor Here
                                </button>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-sm theme-hover theme-text-secondary"
                                    onClick={() => {
                                        setInputCursor(noteContextMenu.beat + inputNoteDuration);
                                        setNoteContextMenu(null);
                                    }}
                                >
                                    Add Rest Here
                                </button>
                                <div className="border-t theme-border my-1"/>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-sm theme-hover text-red-400"
                                    onClick={() => {
                                        const mStart = noteContextMenu.measureIdx * beatsPerMeasure;
                                        const mEnd = mStart + beatsPerMeasure;
                                        setPianoNotes(prev => prev.filter(n => n.start < mStart || n.start >= mEnd));
                                        setNoteContextMenu(null);
                                    }}
                                >
                                    Clear Measure
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderGuitarTab = () => {
        const tabBeatWidth = 36 * notationZoom;

        const derivedTabNotes = pianoNotes.map(n => {
            const tab = midiToTab(n.note);
            return tab ? { ...tab, start: n.start, duration: n.duration } : null;
        }).filter(Boolean) as Array<{ string: number; fret: number; start: number; duration: number }>;

        const addTabNote = (stringIdx: number, fret: number, beat: number) => {
            const midi = tabToMidi(stringIdx, fret);
            addPianoNote(midi, beat, inputNoteDuration, 0.8);
            playNote(midi);
        };

        const stringRowH = 28;

        return (
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#121218' }}>
                <div className="flex items-center gap-3 px-4 py-1.5 shrink-0" style={{
                    background: 'linear-gradient(180deg, #252535, #1e1e2c)',
                    borderBottom: '1px solid rgba(99,102,241,0.15)',
                }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(165,180,252,0.9)', fontFamily: "'SF Mono', monospace", letterSpacing: '1px' }}>TAB</span>
                    <span style={{ fontSize: '10px', color: 'rgba(165,180,252,0.4)', fontFamily: "'SF Mono', monospace" }}>Standard (EADGBE)</span>
                    <div style={{ width: '1px', height: '16px', background: 'rgba(99,102,241,0.15)', margin: '0 4px' }}/>
                    <span style={{ fontSize: '10px', color: 'rgba(165,180,252,0.5)', fontFamily: "'SF Mono', monospace" }}>Beat {inputCursor.toFixed(1)}</span>
                    <button onClick={() => setInputCursor(0)}
                        style={{ fontSize: '10px', color: 'rgba(129,140,248,0.8)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Reset
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex flex-col justify-center shrink-0" style={{
                        width: '36px',
                        borderRight: '2px solid rgba(99,102,241,0.25)',
                        background: '#16161f',
                    }}>
                        {guitarStrings.map((s, i) => (
                            <div key={i} style={{
                                height: `${stringRowH}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: 700, color: 'rgba(165,180,252,0.7)',
                                fontFamily: "'SF Mono', 'Courier New', monospace",
                                borderBottom: i < 5 ? '1px solid rgba(99,102,241,0.06)' : 'none',
                            }}>{s}</div>
                        ))}
                    </div>

                    <div className="flex-1 overflow-auto relative" ref={tabScrollRef} style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #1a1a1a' }}>
                        <div className="relative" style={{
                            width: `${totalBeats * tabBeatWidth + 40}px`,
                            height: `${guitarStrings.length * stringRowH}px`,
                        }}>
                            {guitarStrings.map((_, stringIdx) => (
                                <div key={stringIdx} className="absolute left-0 right-0" style={{
                                    top: `${stringIdx * stringRowH + stringRowH / 2}px`,
                                    height: '1px',
                                    background: `rgba(165,180,252,${0.12 + stringIdx * 0.01})`,
                                }}/>
                            ))}

                            {Array.from({ length: Math.ceil(totalBeats / beatsPerMeasure) + 1 }).map((_, m) => (
                                <div key={m} className="absolute" style={{
                                    left: `${m * beatsPerMeasure * tabBeatWidth}px`,
                                    top: '0',
                                    height: `${guitarStrings.length * stringRowH}px`,
                                    width: m === 0 ? '2px' : '1px',
                                    background: m === 0 ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.2)',
                                }}/>
                            ))}

                            {Array.from({ length: Math.ceil(totalBeats / beatsPerMeasure) }).map((_, m) => (
                                <div key={m} className="absolute pointer-events-none" style={{
                                    left: `${m * beatsPerMeasure * tabBeatWidth + 4}px`,
                                    top: '-16px',
                                    fontSize: '9px', color: 'rgba(99,102,241,0.4)', fontWeight: 700,
                                    fontFamily: "'SF Mono', monospace",
                                }}>{m + 1}</div>
                            ))}

                            {Array.from({ length: totalBeats }).map((_, beat) => {
                                if (beat % beatsPerMeasure === 0) return null;
                                return (
                                    <div key={beat} className="absolute" style={{
                                        left: `${beat * tabBeatWidth}px`,
                                        top: '0',
                                        height: `${guitarStrings.length * stringRowH}px`,
                                        width: '1px',
                                        background: 'rgba(255,255,255,0.025)',
                                    }}/>
                                );
                            })}

                            {derivedTabNotes.map((n, i) => (
                                <div key={i}
                                    className="absolute flex items-center justify-center cursor-pointer"
                                    style={{
                                        left: `${n.start * tabBeatWidth - 8}px`,
                                        top: `${n.string * stringRowH + 4}px`,
                                        width: '20px', height: '20px',
                                        background: '#121218',
                                        fontSize: '13px', fontWeight: 800,
                                        fontFamily: "'SF Mono', 'Courier New', monospace",
                                        color: '#818cf8',
                                        zIndex: 5,
                                        borderRadius: '2px',
                                        textShadow: '0 0 6px rgba(129,140,248,0.3)',
                                    }}
                                >
                                    {n.fret}
                                </div>
                            ))}

                            {guitarStrings.map((_, stringIdx) => (
                                <div key={stringIdx} className="absolute left-0 right-0 cursor-crosshair"
                                    style={{ top: `${stringIdx * stringRowH}px`, height: `${stringRowH}px`, zIndex: 2 }}
                                    onClick={(e) => {
                                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                        if (!rect) return;
                                        const x = e.clientX - rect.left + (e.currentTarget.parentElement?.parentElement?.scrollLeft || 0);
                                        const beat = Math.round((x / tabBeatWidth) * 4) / 4;
                                        addTabNote(stringIdx, 0, beat);
                                    }}
                                />
                            ))}

                            {(isNotationPlaying || notationPlayhead > 0) && (
                                <div className="absolute pointer-events-none z-20" style={{
                                    left: `${notationPlayhead * tabBeatWidth}px`,
                                    top: '-4px',
                                    height: `${guitarStrings.length * stringRowH + 8}px`,
                                }}>
                                    <div className="absolute" style={{
                                        left: '-5px', top: '-2px',
                                        width: 0, height: 0,
                                        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                                        borderTop: '7px solid #ef4444',
                                        filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.6))',
                                    }}/>
                                    <div style={{
                                        width: '2px', height: '100%',
                                        background: 'linear-gradient(180deg, #ef4444, #dc2626)',
                                        boxShadow: '0 0 8px rgba(239,68,68,0.4), 0 0 2px rgba(239,68,68,0.8)',
                                        borderRadius: '1px',
                                    }}/>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="shrink-0" style={{
                    borderTop: '1px solid rgba(99,102,241,0.1)',
                    background: '#16161f', padding: '10px 16px',
                }}>
                    <div style={{ fontSize: '10px', color: 'rgba(165,180,252,0.4)', marginBottom: '6px', fontWeight: 500, fontFamily: "'SF Mono', monospace", letterSpacing: '0.5px' }}>
                        Click fretboard at beat {inputCursor.toFixed(1)}
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'auto repeat(15, 1fr)',
                        background: 'linear-gradient(180deg, #2a1f18, #1e1610)',
                        borderRadius: '6px', overflow: 'hidden',
                        border: '1px solid rgba(139,92,46,0.3)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}>
                        <div style={{ gridColumn: '1', gridRow: '1 / span 6', background: 'linear-gradient(90deg, #d4c8a8, #e0d8c0, #d4c8a8)', width: '5px' }}/>
                        {guitarStrings.map((stringName, stringIdx) => (
                            <React.Fragment key={stringIdx}>
                                <div style={{
                                    gridColumn: '1', gridRow: stringIdx + 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '24px', fontSize: '9px', fontWeight: 700,
                                    color: 'rgba(212,200,168,0.7)', fontFamily: "'SF Mono', monospace",
                                }}>{stringName}</div>
                                {Array.from({ length: 15 }).map((_, fret) => {
                                    const hasDot = [3, 5, 7, 9].includes(fret) && stringIdx === 2;
                                    const hasDoubleDot = fret === 12 && (stringIdx === 1 || stringIdx === 3);
                                    return (
                                        <div
                                            key={fret}
                                            onClick={() => addTabNote(stringIdx, fret, inputCursor)}
                                            style={{
                                                height: '22px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderRight: '1px solid rgba(139,92,46,0.2)',
                                                borderBottom: stringIdx < 5 ? `1px solid rgba(200,180,140,${0.15 - stringIdx * 0.015})` : 'none',
                                                cursor: 'pointer',
                                                fontSize: '9px', color: 'rgba(200,180,140,0.5)',
                                                fontFamily: "'SF Mono', monospace",
                                                background: 'transparent',
                                                position: 'relative',
                                            }}
                                            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.2)'; }}
                                            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            {fret}
                                            {(hasDot || hasDoubleDot) && <div style={{
                                                position: 'absolute', bottom: '-2px',
                                                width: '4px', height: '4px', borderRadius: '50%',
                                                background: fret === 12 ? 'rgba(212,200,168,0.5)' : 'rgba(139,92,46,0.5)',
                                            }}/>}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-10 border-b theme-border flex items-center px-3 gap-1 theme-bg-secondary">
                <div className="flex items-center rounded-md overflow-hidden border theme-border mr-2">
                    <button
                        onClick={() => setNotationView('piano')}
                        className={`px-3 py-1.5 text-xs flex items-center gap-1.5 border-r theme-border ${notationView === 'piano' ? 'bg-purple-600 text-white' : 'theme-hover theme-text-muted'}`}
                    >
                        <Piano size={13}/> Piano Roll
                    </button>
                    <button
                        onClick={() => setNotationView('sheet')}
                        className={`px-3 py-1.5 text-xs flex items-center gap-1.5 border-r theme-border ${notationView === 'sheet' ? 'bg-purple-600 text-white' : 'theme-hover theme-text-muted'}`}
                    >
                        <Music2 size={13}/> Sheet Music
                    </button>
                    <button
                        onClick={() => setNotationView('tab')}
                        className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${notationView === 'tab' ? 'bg-purple-600 text-white' : 'theme-hover theme-text-muted'}`}
                    >
                        <Guitar size={13}/> Guitar Tab
                    </button>
                </div>

                <button onClick={() => setShowLibrary(!showLibrary)} className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 ${showLibrary ? 'bg-purple-600 text-white' : 'theme-bg-tertiary theme-hover'}`} title="Demo Scores Library">
                    <Library size={13}/> Scores
                </button>

                <div className="w-px h-6 theme-bg-tertiary mx-2"/>

                <button
                    onClick={() => { stopNotation(); setNotationPlayhead(0); }}
                    className="p-2 theme-hover rounded" title="Rewind"
                >
                    <SkipBack size={16}/>
                </button>
                <button
                    onClick={playNotation}
                    className={`p-1.5 rounded ${isNotationPlaying ? 'bg-red-500 hover:bg-red-600 text-white' : 'theme-bg-tertiary theme-hover'}`}
                    title={isNotationPlaying ? 'Stop' : 'Play'}
                >
                    {isNotationPlaying ? <Square size={14}/> : <Play size={14}/>}
                </button>

                <div className="w-px h-6 theme-bg-tertiary mx-2"/>

                <span className="text-xs theme-text-muted">BPM:</span>
                <input
                    type="number"
                    value={notationBpm}
                    onChange={(e) => setNotationBpm(Math.max(40, Math.min(300, parseInt(e.target.value) || 120)))}
                    className="w-16 px-2 py-1 theme-bg-tertiary rounded text-sm"
                />

                <span className="text-xs theme-text-muted ml-2">Time:</span>
                <select
                    value={`${notationTimeSignature[0]}/${notationTimeSignature[1]}`}
                    onChange={(e) => {
                        const [n, d] = e.target.value.split('/').map(Number);
                        setNotationTimeSignature([n, d]);
                    }}
                    className="px-2 py-1 theme-bg-tertiary rounded text-sm"
                >
                    <option value="4/4">4/4</option>
                    <option value="3/4">3/4</option>
                    <option value="2/4">2/4</option>
                    <option value="6/8">6/8</option>
                    <option value="5/4">5/4</option>
                    <option value="7/8">7/8</option>
                    <option value="2/2">2/2</option>
                    <option value="3/8">3/8</option>
                    <option value="12/8">12/8</option>
                </select>

                <div className="w-px h-6 theme-bg-tertiary mx-2"/>

                <span className="text-xs theme-text-muted">Sound:</span>
                <select
                    value={notationInstrument}
                    onChange={(e) => setNotationInstrument(e.target.value as typeof notationInstrument)}
                    className="px-2 py-1 theme-bg-tertiary rounded text-sm"
                >
                    <option value="triangle">{notationView === 'tab' ? 'Clean' : 'Piano'}</option>
                    <option value="sine">{notationView === 'tab' ? 'Mellow' : 'Flute'}</option>
                    <option value="square">{notationView === 'tab' ? 'Drive' : 'Organ'}</option>
                    <option value="sawtooth">{notationView === 'tab' ? 'Distortion' : 'Strings'}</option>
                </select>

                <div className="flex-1"/>

                <div className="w-px h-6 theme-bg-tertiary mx-1"/>

                <button onClick={notationUndo} disabled={notationUndoStack.length === 0}
                    className={`p-1.5 rounded ${notationUndoStack.length > 0 ? 'theme-hover' : 'opacity-30'}`} title="Undo (Ctrl+Z)">
                    <Undo size={14}/>
                </button>
                <button onClick={notationRedo} disabled={notationRedoStack.length === 0}
                    className={`p-1.5 rounded ${notationRedoStack.length > 0 ? 'theme-hover' : 'opacity-30'}`} title="Redo (Ctrl+Y)">
                    <Redo size={14}/>
                </button>

                <div className="w-px h-6 theme-bg-tertiary mx-1"/>

                <button onClick={copySelectedNotes} disabled={selectedNotes.size === 0}
                    className={`p-1.5 rounded ${selectedNotes.size > 0 ? 'theme-hover' : 'opacity-30'}`} title="Copy (Ctrl+C)">
                    <Copy size={14}/>
                </button>
                <button onClick={pasteNotes} disabled={notationClipboard.length === 0}
                    className={`p-1.5 rounded ${notationClipboard.length > 0 ? 'theme-hover' : 'opacity-30'}`} title="Paste (Ctrl+V)">
                    <ClipboardPaste size={14}/>
                </button>

                {selectedNotes.size > 0 && (
                    <>
                        <div className="w-px h-6 theme-bg-tertiary mx-1"/>
                        <button onClick={() => transposeSelected(1)} className="px-1.5 py-1 theme-bg-tertiary theme-hover rounded text-[10px]" title="Transpose Up">+1</button>
                        <button onClick={() => transposeSelected(-1)} className="px-1.5 py-1 theme-bg-tertiary theme-hover rounded text-[10px]" title="Transpose Down">-1</button>
                        <button onClick={() => transposeSelected(12)} className="px-1.5 py-1 theme-bg-tertiary theme-hover rounded text-[10px]" title="Octave Up">+Oct</button>
                        <button onClick={() => transposeSelected(-12)} className="px-1.5 py-1 theme-bg-tertiary theme-hover rounded text-[10px]" title="Octave Down">-Oct</button>
                    </>
                )}

                <div className="flex-1"/>

                <span className="text-xs theme-text-muted">Meas:</span>
                <select
                    value={notationMeasures}
                    onChange={(e) => setNotationMeasures(parseInt(e.target.value))}
                    className="w-14 px-1 py-1 theme-bg-tertiary rounded text-sm"
                >
                    {[4, 8, 16, 24, 32, 48, 64].map(n => <option key={n} value={n}>{n}</option>)}
                </select>

                <div className="w-px h-6 theme-bg-tertiary mx-1"/>

                <button onClick={exportMusicXML} disabled={pianoNotes.length === 0}
                    className={`p-1.5 rounded ${pianoNotes.length > 0 ? 'theme-hover' : 'opacity-30'}`} title="Save as MusicXML (reads in MuseScore, Finale, Sibelius, Logic, Dorico)">
                    <Save size={14}/>
                </button>
                <button onClick={importMusicXML} className="p-1.5 theme-hover rounded" title="Open MusicXML">
                    <FolderOpen size={14}/>
                </button>
                <button onClick={exportMidi} disabled={pianoNotes.length === 0}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${pianoNotes.length > 0 ? 'theme-bg-tertiary theme-hover' : 'opacity-30'}`} title="Export as MIDI (for DAWs)">
                    <Download size={12}/> MIDI
                </button>

                <div className="w-px h-6 theme-bg-tertiary mx-1"/>

                <button
                    onClick={deleteSelectedNotes}
                    disabled={selectedNotes.size === 0}
                    className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${selectedNotes.size > 0 ? 'bg-red-600 hover:bg-red-700' : 'theme-bg-tertiary opacity-50'}`}
                >
                    <Trash2 size={12}/> {selectedNotes.size > 0 ? selectedNotes.size : ''}
                </button>

                <button
                    onClick={() => { pushNotationUndo(); setPianoNotes([]); setSelectedNotes(new Set()); setInputCursor(0); }}
                    className="px-2 py-1 theme-bg-tertiary theme-hover rounded text-xs"
                >
                    Clear
                </button>
            </div>

            {showLibrary ? (
                <div className="flex-1 overflow-auto" style={{ background: '#1a1a2e' }}>
                    <div className="max-w-4xl mx-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Score Library</h2>
                            <button onClick={() => setShowLibrary(false)} className="p-1 rounded hover:bg-white/10">
                                <X size={16} className="text-gray-400"/>
                            </button>
                        </div>

                        {(['classical', 'folk', 'guitar'] as const).map(cat => (
                            <div key={cat} className="mb-6">
                                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: cat === 'classical' ? '#a78bfa' : cat === 'folk' ? '#34d399' : '#f59e0b' }}>
                                    {cat === 'classical' ? 'Classical' : cat === 'folk' ? 'World Folk' : 'Guitar Masters'}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {demoScores.filter(s => s.category === cat).map((score, i) => (
                                        <button
                                            key={i}
                                            onClick={() => loadDemoScore(score)}
                                            className="text-left p-3 rounded-lg border transition-colors hover:border-purple-500/50"
                                            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                                        >
                                            <div className="text-sm font-medium text-white truncate">{score.title}</div>
                                            <div className="text-xs text-gray-400 mt-0.5">{score.composer}</div>
                                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
                                                <span>{score.region}</span>
                                                <span>·</span>
                                                <span>{score.year}</span>
                                                <span>·</span>
                                                <span>{score.key} {score.timeSignature[0]}/{score.timeSignature[1]}</span>
                                                <span>·</span>
                                                <span>{score.notes.length} notes</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <p className="text-[10px] text-gray-600 mt-4">All scores are public domain excerpts. Import full scores via MusicXML from IMSLP or MuseScore.</p>
                    </div>
                </div>
            ) : (
                <>
                    {notationView === 'piano' && renderPianoRoll()}
                    {notationView === 'sheet' && renderSheetMusic()}
                    {notationView === 'tab' && renderGuitarTab()}
                </>
            )}
        </div>
    );
};

export default NotationPanel;
