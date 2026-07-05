import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';

interface AudioFile {
    id: string;
    name: string;
    path: string;
    duration?: number;
    waveform?: number[];
    bpm?: number;
    key?: string;
}

interface AnalysisPanelProps {
    analysisMode: 'waveform' | 'spectrum' | 'spectrogram';
    setAnalysisMode: (mode: 'waveform' | 'spectrum' | 'spectrogram') => void;
    analysisWaveformData: number[];
    analysisFrequencyData: Uint8Array | null;
    analyzeAudio: (audioPath: string) => void;
    selectedAudio: AudioFile | null;
    formatTime: (seconds: number) => string;
    analysisAudioBuffer: AudioBuffer | null;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    analysisMode,
    setAnalysisMode,
    analysisWaveformData,
    analysisFrequencyData,
    analyzeAudio,
    selectedAudio,
    formatTime,
    analysisAudioBuffer,
}) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-12 border-b theme-border flex items-center px-4 gap-2 theme-bg-secondary">
                {(['waveform', 'spectrum', 'spectrogram'] as const).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setAnalysisMode(mode)}
                        className={`px-3 py-1.5 rounded text-sm capitalize ${
                            analysisMode === mode
                                ? 'bg-purple-600 text-white'
                                : 'theme-bg-tertiary theme-hover theme-text-secondary'
                        }`}
                    >
                        {mode}
                    </button>
                ))}
                <div className="flex-1"/>
                {selectedAudio && (
                    <button
                        onClick={() => analyzeAudio(selectedAudio.path)}
                        className="px-3 py-1.5 theme-bg-tertiary theme-hover rounded text-sm flex items-center gap-1"
                    >
                        <RefreshCw size={14}/> Refresh
                    </button>
                )}
            </div>

            <div className="flex-1 p-4">
                <div className="w-full h-full theme-bg-primary rounded-lg flex items-center justify-center overflow-hidden">
                    {selectedAudio ? (
                        <div className="w-full h-full p-4 flex flex-col">
                            {analysisMode === 'waveform' && (
                                <div className="flex-1 flex items-center">
                                    <div className="w-full h-48 flex items-center justify-center">
                                        <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                                            <line x1="0" y1="50" x2="500" y2="50" stroke="#4B5563" strokeWidth="0.5"/>
                                            <path
                                                d={analysisWaveformData.length > 0
                                                    ? `M 0,50 ${analysisWaveformData.map((v, i) =>
                                                        `L ${(i / analysisWaveformData.length) * 500},${50 - v * 200}`
                                                    ).join(' ')}`
                                                    : 'M 0,50 L 500,50'
                                                }
                                                fill="none"
                                                stroke="#8B5CF6"
                                                strokeWidth="1"
                                            />
                                            <path
                                                d={analysisWaveformData.length > 0
                                                    ? `M 0,50 ${analysisWaveformData.map((v, i) =>
                                                        `L ${(i / analysisWaveformData.length) * 500},${50 + v * 200}`
                                                    ).join(' ')}`
                                                    : 'M 0,50 L 500,50'
                                                }
                                                fill="none"
                                                stroke="#8B5CF6"
                                                strokeWidth="1"
                                                opacity="0.5"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            )}
                            {analysisMode === 'spectrum' && (
                                <div className="flex-1 flex items-end justify-center gap-1 pb-4">
                                    {(analysisFrequencyData ? Array.from(analysisFrequencyData).slice(0, 64) : Array(64).fill(0)).map((v, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 max-w-4 bg-gradient-to-t from-purple-600 via-pink-500 to-orange-400 rounded-t transition-all duration-75"
                                            style={{ height: `${(v / 255) * 100}%`, minHeight: '2px' }}
                                        />
                                    ))}
                                </div>
                            )}
                            {analysisMode === 'spectrogram' && (
                                <div className="flex-1 overflow-hidden rounded">
                                    <div className="w-full h-full grid grid-rows-32 gap-px">
                                        {Array.from({ length: 32 }).map((_, rowIdx) => (
                                            <div key={rowIdx} className="flex gap-px">
                                                {Array.from({ length: 100 }).map((_, colIdx) => {
                                                    const intensity = analysisWaveformData[Math.floor(colIdx * analysisWaveformData.length / 100)] || 0;
                                                    const freq = 1 - rowIdx / 32;
                                                    const value = Math.abs(intensity) * freq * 255;
                                                    return (
                                                        <div
                                                            key={colIdx}
                                                            className="flex-1"
                                                            style={{
                                                                backgroundColor: `rgb(${value * 0.8}, ${value * 0.3}, ${value})`
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center">
                            <Activity size={64} className="mx-auto theme-text-muted mb-4"/>
                            <p className="theme-text-muted">Select an audio file to analyze</p>
                        </div>
                    )}
                </div>
            </div>

            {selectedAudio && (
                <div className="h-32 border-t theme-border p-4 theme-bg-secondary">
                    <div className="grid grid-cols-5 gap-4">
                        <div>
                            <p className="text-xs theme-text-muted">Duration</p>
                            <p className="text-lg font-mono">{formatTime(analysisAudioBuffer?.duration || selectedAudio.duration || 0)}</p>
                        </div>
                        <div>
                            <p className="text-xs theme-text-muted">Sample Rate</p>
                            <p className="text-lg font-mono">{analysisAudioBuffer ? `${(analysisAudioBuffer.sampleRate / 1000).toFixed(1)} kHz` : '---'}</p>
                        </div>
                        <div>
                            <p className="text-xs theme-text-muted">Channels</p>
                            <p className="text-lg font-mono">{analysisAudioBuffer?.numberOfChannels || '---'}</p>
                        </div>
                        <div>
                            <p className="text-xs theme-text-muted">BPM (est.)</p>
                            <p className="text-lg font-mono">{selectedAudio.bpm || '---'}</p>
                        </div>
                        <div>
                            <p className="text-xs theme-text-muted">Key (est.)</p>
                            <p className="text-lg font-mono">{selectedAudio.key || '---'}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisPanel;
export type { AudioFile, AnalysisPanelProps };
