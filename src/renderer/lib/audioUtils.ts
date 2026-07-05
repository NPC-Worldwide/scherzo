export const readAudioBuffer = async (filePath: string): Promise<ArrayBuffer | null> => {
    const result = await (window as any).api?.readFileBuffer?.(filePath);
    if (!result?.data) return null;
    const binaryStr = atob(result.data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

export const loadWaveformData = async (
    audioPath: string,
    audioId: string,
    waveformCache: Map<string, number[]>,
    setWaveformCache: (cb: (prev: Map<string, number[]>) => Map<string, number[]>) => void,
    waveformDataCache: Map<string, Float32Array>,
    setWaveformDataCache: (cb: (prev: Map<string, Float32Array>) => Map<string, Float32Array>) => void,
): Promise<number[] | null> => {
    if (waveformCache.has(audioId)) return waveformCache.get(audioId)!;

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
};
