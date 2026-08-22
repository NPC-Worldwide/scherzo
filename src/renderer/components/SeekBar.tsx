import React, { useRef, useCallback, useState } from 'react';

interface SeekBarProps {
    currentTime: number;
    duration: number;
    disabled?: boolean;
    onSeek: (time: number) => void;
    formatTime: (seconds: number) => string;
}

const SeekBar: React.FC<SeekBarProps> = ({ currentTime, duration, disabled, onSeek, formatTime }) => {
    const barRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const timeForEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!barRef.current || !duration) {
            console.log('[SeekBar] no bar ref or duration', { duration });
            return 0;
        }
        const rect = barRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const t = ratio * duration;
        console.log('[SeekBar] compute time', { clientX: e.clientX, left: rect.left, width: rect.width, ratio, duration, t });
        return t;
    }, [duration]);

    const handleStart = useCallback((e: React.MouseEvent) => {
        if (disabled || !duration) {
            console.log('[SeekBar] mousedown ignored', { disabled, duration });
            return;
        }
        e.preventDefault();
        setIsDragging(true);
        const t = timeForEvent(e);
        console.log('[SeekBar] mousedown seek to', t);
        onSeek(t);

        const handleMove = (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();
            const t = timeForEvent(moveEvent);
            console.log('[SeekBar] mousemove seek to', t);
            onSeek(t);
        };

        const handleUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, [disabled, duration, onSeek, timeForEvent]);

    return (
        <div className="flex items-center gap-2 flex-1 min-w-0 h-5">
            <span className="text-xs theme-text-muted w-10 text-right">{formatTime(currentTime)}</span>
            <div
                ref={barRef}
                className={`flex-1 h-3 relative rounded bg-purple-500/20 overflow-hidden ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                onMouseDown={handleStart}
            >
                <div
                    className="absolute inset-y-0 left-0 bg-purple-500"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow"
                    style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, -50%)' }}
                />
            </div>
            <span className="text-xs theme-text-muted w-10">{formatTime(duration)}</span>
        </div>
    );
};

export default SeekBar;
