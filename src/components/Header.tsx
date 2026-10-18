import React, { useEffect, useState } from "react";
import { Sparkles, HelpCircle, Flame, Clock, RefreshCw, Newspaper } from "lucide-react";

interface HeaderProps {
  onOpenGlosarium: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function Header({ onOpenGlosarium, onRefresh, isLoading }: HeaderProps) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }) + " WIB"
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-6 md:px-12 flex-shrink-0 shadow-xl border-b border-indigo-500/20">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        {/* Left: Branding */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white select-none">
                Kilas<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Berita</span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/25">
              <Flame className="w-3 h-3 fill-emerald-400 text-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>

          <h1 className="font-sans font-black text-xl md:text-2xl text-white tracking-tight leading-none">
            Berita Terhangat, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">Gaya Gaul!</span>
          </h1>

          <p className="text-xs text-slate-400 font-sans max-w-lg leading-relaxed">
            Ringkasan berita dari <span className="font-semibold text-slate-300">CNN Indonesia, CNBC, Tempo</span> — disajikan santai, asik, & instan pakai AI. No clickbait!
          </p>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-center">
          <div className="bg-white/5 border border-white/10 p-2.5 px-3.5 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <div className="text-left font-mono">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Jakarta Time</p>
              <p className="text-xs font-bold text-white tracking-wide">{timeStr || "..."}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              id="header-open-glosarium"
              onClick={onOpenGlosarium}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 font-sans text-xs font-semibold rounded-xl transition duration-150 active:scale-95 backdrop-blur-sm"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              Kamus Slang
            </button>

            <button
              id="header-refresh"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white active:scale-95 disabled:opacity-50 font-semibold rounded-xl transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              title="Refresh Berita"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span className="text-xs font-bold font-sans">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}