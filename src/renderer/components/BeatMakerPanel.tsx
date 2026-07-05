import React from 'react';

interface BeatMakerPanelProps {
    beatPattern: Set<string>;
    setBeatPattern: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    beatBpm: number;
    setBeatBpm: (bpm: number) => void;
    beatPlaying: boolean;
    setBeatPlaying: (playing: boolean) => void;
    beatCurrentStep: number;
    setBeatCurrentStep: (step: number) => void;
    beatPlayRef: React.MutableRefObject<any>;
    beatAudioCtxRef: React.MutableRefObject<AudioContext | null>;
}

const BeatMakerPanel: React.FC<BeatMakerPanelProps> = ({
    beatPattern,
    setBeatPattern,
    beatBpm,
    setBeatBpm,
    beatPlaying,
    setBeatPlaying,
    beatCurrentStep,
    setBeatCurrentStep,
    beatPlayRef,
    beatAudioCtxRef,
}) => {
    const rows: Array<{ id: string; name: string; color: string }> = [
        { id: 'kick',  name: 'Kick',  color: 'bg-red-500' },
        { id: 'snare', name: 'Snare', color: 'bg-orange-500' },
        { id: 'hat',   name: 'HiHat', color: 'bg-yellow-500' },
        { id: 'open',  name: 'Open Hat', color: 'bg-lime-500' },
        { id: 'clap',  name: 'Clap',  color: 'bg-green-500' },
        { id: 'tom',   name: 'Tom',   color: 'bg-blue-500' },
        { id: 'rim',   name: 'Rim',   color: 'bg-purple-500' },
        { id: 'cow',   name: 'Cowbell', color: 'bg-cyan-500' },
    ];
    const STEPS = 16;
    const stepKey = (rowId: string, step: number) => `${rowId}-${step}`;
    const toggle = (rowId: string, step: number) => {
        setBeatPattern(prev => {
            const next = new Set(prev);
            const k = stepKey(rowId, step);
            if (next.has(k)) next.delete(k); else next.add(k);
            return next;
        });
    };

    const getNoiseBuf = (ctx: AudioContext) => {
        const r: any = beatAudioCtxRef.current as any;
        if (r && r._noiseBuf) return r._noiseBuf as AudioBuffer;
        const buf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        (beatAudioCtxRef.current as any)._noiseBuf = buf;
        return buf;
    };

    const voices = {
        kick: (ctx: AudioContext, t: number) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
            g.gain.setValueAtTime(1.0, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.4);
        },
        snare: (ctx: AudioContext, t: number) => {
            const src = ctx.createBufferSource(); src.buffer = getNoiseBuf(ctx);
            const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000;
            const ng = ctx.createGain(); ng.gain.setValueAtTime(0.8, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            src.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
            src.start(t); src.stop(t + 0.2);
            const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 180;
            const tg = ctx.createGain(); tg.gain.setValueAtTime(0.5, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(tg); tg.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.15);
        },
        hat: (ctx: AudioContext, t: number) => {
            const src = ctx.createBufferSource(); src.buffer = getNoiseBuf(ctx);
            const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            src.connect(hp); hp.connect(g); g.connect(ctx.destination);
            src.start(t); src.stop(t + 0.06);
        },
        open: (ctx: AudioContext, t: number) => {
            const src = ctx.createBufferSource(); src.buffer = getNoiseBuf(ctx);
            const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            src.connect(hp); hp.connect(g); g.connect(ctx.destination);
            src.start(t); src.stop(t + 0.3);
        },
        clap: (ctx: AudioContext, t: number) => {
            const bursts = [0, 0.01, 0.02, 0.05];
            bursts.forEach((d, i) => {
                const src = ctx.createBufferSource(); src.buffer = getNoiseBuf(ctx);
                const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.5;
                const g = ctx.createGain();
                const tt = t + d;
                g.gain.setValueAtTime(i === bursts.length - 1 ? 0.7 : 0.5, tt);
                g.gain.exponentialRampToValueAtTime(0.001, tt + (i === bursts.length - 1 ? 0.12 : 0.03));
                src.connect(bp); bp.connect(g); g.connect(ctx.destination);
                src.start(tt); src.stop(tt + 0.15);
            });
        },
        tom: (ctx: AudioContext, t: number) => {
            const osc = ctx.createOscillator(); osc.type = 'sine';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(90, t + 0.3);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.45);
        },
        rim: (ctx: AudioContext, t: number) => {
            const osc1 = ctx.createOscillator(); osc1.type = 'square'; osc1.frequency.value = 320;
            const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 800;
            const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc1.connect(g); osc2.connect(g); g.connect(ctx.destination);
            osc1.start(t); osc1.stop(t + 0.05);
            osc2.start(t); osc2.stop(t + 0.05);
        },
        cow: (ctx: AudioContext, t: number) => {
            const freqs = [560, 845];
            freqs.forEach(f => {
                const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
                const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
                o.connect(g); g.connect(ctx.destination);
                o.start(t); o.stop(t + 0.25);
            });
        },
    } as Record<string, (ctx: AudioContext, t: number) => void>;

    const playStep = (step: number) => {
        try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            if (!beatAudioCtxRef.current) beatAudioCtxRef.current = new Ctx();
            const ctx = beatAudioCtxRef.current;
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime + 0.01;
            rows.forEach(r => {
                if (!beatPattern.has(stepKey(r.id, step))) return;
                const voice = voices[r.id];
                if (voice) voice(ctx, t);
            });
        } catch (e) { console.warn('[beat] play failed', e); }
    };

    const togglePlay = () => {
        if (beatPlayRef.current) {
            clearInterval(beatPlayRef.current);
            beatPlayRef.current = null;
            setBeatPlaying(false);
            setBeatCurrentStep(-1);
            return;
        }
        setBeatPlaying(true);
        let step = 0;
        playStep(step);
        setBeatCurrentStep(step);
        const intervalMs = (60 / beatBpm / 4) * 1000;
        beatPlayRef.current = setInterval(() => {
            step = (step + 1) % STEPS;
            playStep(step);
            setBeatCurrentStep(step);
        }, intervalMs);
    };

    const clearPattern = () => setBeatPattern(new Set());

    return (
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
            <div className="flex items-center gap-3">
                <button onClick={togglePlay} className={`px-4 py-2 rounded ${beatPlaying ? 'bg-red-600' : 'bg-green-600'} text-white text-sm font-medium`}>
                    {beatPlaying ? 'Stop' : 'Play'}
                </button>
                <button onClick={clearPattern} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm">Clear</button>
                <label className="text-xs theme-text-muted ml-2">BPM</label>
                <input type="number" min={40} max={240} value={beatBpm} onChange={e => setBeatBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))} className="w-16 theme-input text-sm" />
                <span className="text-xs theme-text-muted ml-auto">{beatPattern.size} active &middot; 16-step sequencer</span>
            </div>
            <div className="flex-1 overflow-auto rounded border theme-border">
                <table className="w-full border-collapse">
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id}>
                                <td className="px-2 py-1 text-xs font-medium theme-text-primary border-b theme-border bg-black/30 sticky left-0 min-w-[80px]">{r.name}</td>
                                {Array.from({ length: STEPS }).map((_, i) => {
                                    const active = beatPattern.has(stepKey(r.id, i));
                                    const isBeat = i % 4 === 0;
                                    const isCurrent = beatCurrentStep === i;
                                    return (
                                        <td key={i} className="p-0.5 border-b theme-border">
                                            <button
                                                onClick={() => toggle(r.id, i)}
                                                className={`w-full h-9 rounded ${active ? r.color : isBeat ? 'bg-white/10' : 'bg-white/5'} ${isCurrent ? 'ring-2 ring-white' : ''} hover:brightness-125 transition-all`}
                                                title={`${r.name} &middot; step ${i + 1}`}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BeatMakerPanel;
