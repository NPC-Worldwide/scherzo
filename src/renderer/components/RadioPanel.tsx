import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Star } from 'lucide-react';

interface RadioPanelProps {
    active: boolean;
    onStationPlay: (station: any) => void;
    onStationStop: () => void;
    radioStation: any;
    radioFavorites: any[];
    setRadioFavorites: (favs: any[]) => void;
}

const RadioPanel: React.FC<RadioPanelProps> = ({ active, onStationPlay, onStationStop, radioStation, radioFavorites, setRadioFavorites }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [search, setSearch] = useState('');
    const [stations, setStations] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [geo, setGeo] = useState<any>(null);

    useEffect(() => {
        if (!active) return;
        (async () => {
            try {
                const geoRes = await fetch('http://ip-api.com/json/?fields=country,countryCode,city');
                const g = await geoRes.json();
                setGeo(g);
                const API = 'https://de1.api.radio-browser.info';
                const [local, trending, tagList] = await Promise.all([
                    g.countryCode ? fetch(`${API}/json/stations/bycountrycodeexact/${g.countryCode}?limit=20&order=votes&reverse=true&hidebroken=true`).then(r => r.json()) : Promise.resolve([]),
                    fetch(`${API}/json/stations/topclick/20`).then(r => r.json()),
                    fetch(`${API}/json/tags?limit=30&order=stationcount&reverse=true&hidebroken=true`).then(r => r.json()),
                ]);
                setStations([...local, ...trending]);
                setTags(tagList || []);
            } catch {}
        })();
    }, [active]);

    const playStation = (s: any) => {
        onStationPlay(s);
        if (audioRef.current) {
            audioRef.current.src = s.url_resolved || s.url;
            audioRef.current.play().catch(() => {});
        }
    };

    const searchStations = async (q: string) => {
        setSearch(q);
        if (!q) return;
        try {
            const res = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}&limit=40&order=votes&reverse=true&hidebroken=true`);
            setStations(await res.json());
        } catch {}
    };

    const searchByTag = async (tag: string) => {
        try {
            const res = await fetch(`https://de1.api.radio-browser.info/json/stations/bytagexact/${encodeURIComponent(tag)}?limit=30&order=votes&reverse=true&hidebroken=true`);
            setStations(await res.json());
            setSearch(tag);
        } catch {}
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <audio ref={audioRef} onEnded={onStationStop} onError={onStationStop} className="hidden" />
            {radioStation && (
                <div className="bg-green-900/80 border-b border-green-500/30 px-4 py-2 flex items-center gap-3 shrink-0">
                    {radioStation.favicon && <img src={radioStation.favicon} alt="" className="w-8 h-8 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}/>}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-200 truncate">{radioStation.name}</p>
                        <p className="text-[10px] text-green-400/70">{radioStation.country} · {radioStation.bitrate}kbps · {radioStation.tags}</p>
                    </div>
                    <button onClick={() => { audioRef.current?.pause(); audioRef.current!.src = ''; onStationStop(); }} className="p-1 hover:bg-white/10 rounded"><Square size={16} className="text-green-300"/></button>
                </div>
            )}
            <div className="p-3 border-b theme-border shrink-0">
                <div className="flex gap-2">
                    <input type="text" placeholder="Search stations..." value={search}
                        className="flex-1 theme-input text-xs px-3 py-2 rounded"
                        onChange={e => searchStations(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchStations(search)}/>
                </div>
            </div>
            <div className="flex-1 overflow-auto p-3">
                {radioFavorites.length > 0 && (
                    <div className="mb-3">
                        <h3 className="text-xs font-semibold theme-text-muted uppercase mb-2">Your Stations</h3>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {radioFavorites.map((s: any) => (
                                <button key={s.stationuuid} onClick={() => playStation(s)} className="shrink-0 px-3 py-1.5 rounded-full text-xs theme-bg-secondary theme-hover border theme-border whitespace-nowrap">
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {search && <h3 className="text-xs font-semibold theme-text-muted uppercase mb-2">Results for "{search}"</h3>}
                {!search && <h3 className="text-xs font-semibold theme-text-muted uppercase mb-2">Popular{geo?.country ? ` in ${geo.country}` : ''}</h3>}
                {!search && tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-3">
                        {tags.slice(0, 20).map((tag: any) => (
                            <button key={tag.name} onClick={() => searchByTag(tag.name)} className="px-2 py-1 rounded text-[10px] theme-bg-secondary theme-hover border theme-border">
                                {tag.name} <span className="theme-text-muted">{tag.stationcount}</span>
                            </button>
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                    {stations.slice(0, 40).map((s: any) => (
                        <div key={s.stationuuid} onDoubleClick={() => playStation(s)} className="flex items-center gap-2 p-2 rounded theme-bg-secondary theme-hover border theme-border cursor-pointer group">
                            {s.favicon && <img src={s.favicon} alt="" className="w-8 h-8 rounded shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}/>}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{s.name}</p>
                                <p className="text-[10px] theme-text-muted truncate">{s.country}{s.bitrate ? ` · ${s.bitrate}kbps` : ''} · {s.tags}</p>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                                <button onClick={(e) => { e.stopPropagation(); playStation(s); }} className="p-1 hover:bg-white/10 rounded"><Play size={12}/></button>
                                <button onClick={(e) => { e.stopPropagation(); const isFav = radioFavorites.some(f => f.stationuuid === s.stationuuid); const next = isFav ? radioFavorites.filter(f => f.stationuuid !== s.stationuuid) : [...radioFavorites, s]; setRadioFavorites(next); localStorage.setItem('scherzo_radio_favorites', JSON.stringify(next)); }} className={`p-1 hover:bg-white/10 rounded ${radioFavorites.some(f => f.stationuuid === s.stationuuid) ? 'text-yellow-400' : ''}`}>
                                    <Star size={12} fill={radioFavorites.some(f => f.stationuuid === s.stationuuid) ? 'currentColor' : 'none'}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RadioPanel;
