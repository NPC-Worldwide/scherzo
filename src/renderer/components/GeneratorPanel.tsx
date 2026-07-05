import React from 'react';
import {
    Sparkles, Loader, Music, Play, Download, Plus, ChevronRight, Layers,
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

interface AudioDatasetExample {
    id: string;
    prompt: string;
    negativePrompt?: string;
    audioPath?: string;
    duration: number;
    model: string;
    qualityScore: number;
    tags: string[];
    createdAt: string;
}

interface AudioDataset {
    id: string;
    name: string;
    description?: string;
    examples: AudioDatasetExample[];
    createdAt: string;
    updatedAt: string;
    targetModel?: string;
    tags: string[];
}

interface AudioModel {
    id: string;
    name: string;
    provider: string;
    backendModel: string;
    type: 'music' | 'sfx' | 'speech';
}

const AUDIO_MODELS: AudioModel[] = [
    { id: 'replicate:meta/musicgen',              name: 'MusicGen (Replicate)',          provider: 'replicate',  backendModel: 'meta/musicgen',                      type: 'music' },
    { id: 'replicate:stackadoc/stable-audio-open-1.0', name: 'Stable Audio Open (Replicate)', provider: 'replicate',  backendModel: 'stackadoc/stable-audio-open-1.0',    type: 'music' },
    { id: 'replicate:riffusion/riffusion',        name: 'Riffusion (Replicate)',         provider: 'replicate',  backendModel: 'riffusion/riffusion',                type: 'music' },
    { id: 'local:facebook/musicgen-small',        name: 'MusicGen Small (Local)',        provider: 'local',      backendModel: 'facebook/musicgen-small',            type: 'music' },
    { id: 'local:facebook/musicgen-medium',       name: 'MusicGen Medium (Local)',       provider: 'local',      backendModel: 'facebook/musicgen-medium',           type: 'music' },
    { id: 'elevenlabs:sfx',                       name: 'ElevenLabs SFX (≤22s)',         provider: 'elevenlabs', backendModel: 'sound-generation',                  type: 'sfx' },
    { id: 'tts:kokoro',                           name: 'Kokoro (Local TTS)',            provider: 'kokoro',     backendModel: 'kokoro',                             type: 'speech' },
    { id: 'tts:elevenlabs',                       name: 'ElevenLabs Voice',              provider: 'elevenlabs', backendModel: 'elevenlabs',                         type: 'speech' },
];

export interface GeneratorPanelProps {
    genPrompt: string;
    setGenPrompt: (value: string) => void;
    genModel: string;
    setGenModel: (value: string) => void;
    genDuration: number;
    setGenDuration: (value: number) => void;
    generating: boolean;
    setGenerating: (value: boolean) => void;
    generatedAudio: AudioFile[];
    setGeneratedAudio: React.Dispatch<React.SetStateAction<AudioFile[]>>;
    selectedGeneratedAudio: Set<string>;
    setSelectedGeneratedAudio: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectionMode: boolean;
    setSelectionMode: (value: boolean) => void;
    showAddToDataset: boolean;
    setShowAddToDataset: (value: boolean) => void;
    audioDatasets: AudioDataset[];
    currentPath?: string;
    formatTime: (seconds: number) => string;
    toggleGeneratedSelection: (id: string) => void;
    addGeneratedToDataset: (datasetId: string) => void;
    setAudioFiles: React.Dispatch<React.SetStateAction<AudioFile[]>>;
    setActiveMode: (mode: string) => void;
    setShowCreateDataset: (value: boolean) => void;
}

const GeneratorPanel: React.FC<GeneratorPanelProps> = ({
    genPrompt,
    setGenPrompt,
    genModel,
    setGenModel,
    genDuration,
    setGenDuration,
    generating,
    setGenerating,
    generatedAudio,
    setGeneratedAudio,
    selectedGeneratedAudio,
    setSelectedGeneratedAudio,
    selectionMode,
    setSelectionMode,
    showAddToDataset,
    setShowAddToDataset,
    audioDatasets,
    currentPath,
    formatTime,
    toggleGeneratedSelection,
    addGeneratedToDataset,
    setAudioFiles,
    setActiveMode,
    setShowCreateDataset,
}) => {
    const handleGenerate = async () => {
        if (!genPrompt || !genModel) return;
        setGenerating(true);
        try {
            const modelDef = AUDIO_MODELS.find(m => m.id === genModel);
            if (!modelDef) throw new Error(`Unknown model: ${genModel}`);

            let resp: any;
            let audioB64 = '';
            let fmt = 'wav';
            let savedPath = '';

            if (modelDef.type === 'speech') {
                const engine = modelDef.provider === 'elevenlabs' ? 'elevenlabs' : 'kokoro';
                const r = await fetch('http://127.0.0.1:5437/api/audio/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: genPrompt, engine }),
                });
                resp = await r.json();
                if (!resp.success) throw new Error(resp.error || 'TTS failed');
                audioB64 = resp.audio;
                fmt = resp.format || 'wav';
            } else {
                const api = (window as any).api;
                if (!api?.generateMusic) throw new Error('generateMusic IPC not available (restart app)');
                resp = await api.generateMusic(
                    genPrompt,
                    modelDef.provider,
                    modelDef.backendModel,
                    genDuration,
                    currentPath || undefined,
                    { workspacePath: currentPath || undefined },
                );
                if (!resp?.success) throw new Error(resp?.error || 'music gen failed');
                audioB64 = resp.audio;
                fmt = resp.format || 'wav';
                savedPath = resp.filename || '';
            }

            const bin = atob(audioB64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const mime = fmt === 'mp3' ? 'audio/mpeg' : 'audio/wav';
            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);

            setGeneratedAudio(prev => [...prev, {
                id: `gen_${Date.now()}`,
                name: genPrompt.slice(0, 40),
                path: savedPath || url,
                duration: genDuration,
            }]);
        } catch (e: any) {
            alert('Audio generation failed: ' + (e.message || e));
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="w-96 border-r theme-border p-4 flex flex-col gap-4 overflow-y-auto theme-bg-secondary">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles size={20} className="text-purple-400"/> Audio Generator
                </h3>

                <div>
                    <label className="text-xs theme-text-muted font-semibold uppercase">Prompt</label>
                    <textarea
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder="Describe the audio you want to create..."
                        className="w-full theme-input mt-2 text-sm"
                        rows={4}
                    />
                </div>

                <div>
                    <label className="text-xs theme-text-muted font-semibold uppercase">Model</label>
                    <select
                        value={genModel}
                        onChange={(e) => setGenModel(e.target.value)}
                        className="w-full theme-input mt-2 text-sm"
                    >
                        <option value="">Select a model...</option>
                        <optgroup label="Music Generation">
                            {AUDIO_MODELS.filter(m => m.type === 'music').map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Sound Effects">
                            {AUDIO_MODELS.filter(m => m.type === 'sfx').map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Speech/Voice">
                            {AUDIO_MODELS.filter(m => m.type === 'speech').map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                <div>
                    <label className="text-xs theme-text-muted font-semibold uppercase">Duration (seconds)</label>
                    <div className="flex items-center gap-3 mt-2">
                        <input
                            type="range"
                            min={5}
                            max={180}
                            value={genDuration}
                            onChange={(e) => setGenDuration(parseInt(e.target.value))}
                            className="flex-1"
                        />
                        <span className="text-sm w-12">{genDuration}s</span>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={generating || !genPrompt || !genModel}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                    {generating ? (
                        <>
                            <Loader size={18} className="animate-spin"/>
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles size={18}/>
                            Generate Audio
                        </>
                    )}
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {generatedAudio.length > 0 && (
                    <div className="p-3 border-b theme-border flex items-center gap-2">
                        <button
                            onClick={() => {
                                setSelectionMode(!selectionMode);
                                if (selectionMode) setSelectedGeneratedAudio(new Set());
                            }}
                            className={`px-3 py-1.5 rounded text-xs flex items-center gap-1 ${
                                selectionMode ? 'bg-purple-600 text-white' : 'theme-bg-tertiary theme-hover'
                            }`}
                        >
                            <Layers size={12} /> Select
                        </button>
                        {selectionMode && selectedGeneratedAudio.size > 0 && (
                            <>
                                <span className="text-xs theme-text-muted">{selectedGeneratedAudio.size} selected</span>
                                <button
                                    onClick={() => setShowAddToDataset(true)}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs flex items-center gap-1"
                                >
                                    <Plus size={12} /> Add to Dataset
                                </button>
                            </>
                        )}
                    </div>
                )}
                <div className="flex-1 p-4 overflow-y-auto">
                {generatedAudio.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                        {generatedAudio.map(audio => (
                            <div
                                key={audio.id}
                                onClick={() => selectionMode && toggleGeneratedSelection(audio.id)}
                                className={`theme-bg-secondary rounded-xl p-4 ${
                                    selectionMode
                                        ? selectedGeneratedAudio.has(audio.id)
                                            ? 'ring-2 ring-purple-500 bg-purple-900/20 cursor-pointer'
                                            : 'theme-hover cursor-pointer'
                                        : ''
                                }`}
                            >
                                <div className="relative aspect-video bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg flex items-center justify-center mb-3">
                                    {selectionMode && (
                                        <input
                                            type="checkbox"
                                            checked={selectedGeneratedAudio.has(audio.id)}
                                            onChange={() => toggleGeneratedSelection(audio.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute top-2 left-2 w-4 h-4"
                                        />
                                    )}
                                    <Music size={32} className="text-purple-400"/>
                                </div>
                                <p className="text-sm truncate">{audio.name}</p>
                                <p className="text-xs theme-text-muted">{formatTime(audio.duration || 0)}</p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => {
                                            if (audio.path) {
                                                const a = new Audio(`file://${audio.path}`);
                                                a.play().catch(e => console.error('Playback error:', e));
                                            }
                                        }}
                                        disabled={!audio.path}
                                        className="flex-1 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 rounded text-purple-400 text-xs disabled:opacity-40"
                                    >
                                        <Play size={12} className="inline mr-1"/> Play
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (audio.path) {
                                                const file: AudioFile = { id: audio.id, name: audio.name, path: audio.path, duration: audio.duration };
                                                setAudioFiles(prev => [...prev, file]);
                                            }
                                        }}
                                        disabled={!audio.path}
                                        className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 rounded text-blue-400 text-xs disabled:opacity-40"
                                    >
                                        <Download size={12} className="inline mr-1"/> Add to Editor
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Sparkles size={64} className="mx-auto theme-text-muted mb-4"/>
                            <p className="theme-text-muted text-lg">Generate AI Audio</p>
                            <p className="theme-text-muted text-sm mt-2">Enter a prompt and select a model</p>
                        </div>
                    </div>
                )}
                </div>

                {showAddToDataset && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]" onClick={() => setShowAddToDataset(false)}>
                        <div className="theme-bg-secondary rounded-lg shadow-xl w-96 p-6" onClick={e => e.stopPropagation()}>
                            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Plus className="text-purple-400" size={18} />
                                Add to Dataset
                            </h4>
                            {audioDatasets.length === 0 ? (
                                <div className="text-center py-4 theme-text-muted">
                                    <p>No datasets yet</p>
                                    <button
                                        onClick={() => { setShowAddToDataset(false); setActiveMode('datasets'); setShowCreateDataset(true); }}
                                        className="mt-2 text-purple-400 hover:text-purple-300"
                                    >
                                        Create a dataset first
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {audioDatasets.map(dataset => (
                                        <button
                                            key={dataset.id}
                                            onClick={() => addGeneratedToDataset(dataset.id)}
                                            className="w-full p-3 theme-bg-tertiary theme-hover rounded text-left flex items-center justify-between"
                                        >
                                            <div>
                                                <span className="font-medium">{dataset.name}</span>
                                                <span className="text-xs theme-text-muted ml-2">{dataset.examples.length} samples</span>
                                            </div>
                                            <ChevronRight size={16} className="theme-text-muted"/>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={() => setShowAddToDataset(false)}
                                    className="px-4 py-2 theme-bg-tertiary theme-hover theme-text-primary rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneratorPanel;
