import React, { useEffect, useState } from "react";
import { Sparkles, HelpCircle, Flame, Clock, RefreshCw } from "lucide-react";

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
    <header className="relative w-full bg-white border-b border-slate-100 px-6 py-6 md:px-12 flex-shrink-0 shadow-sm">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Branding */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black tracking-tighter text-blue-600 select-none">
              KONSEP <span className="text-slate-400">.</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-105">
              <Flame className="w-3 h-3 fill-blue-500 text-blue-500" />
              <span>Real-Time RSS Feed</span>
            </div>
          </div>

          <h1 className="font-sans font-black text-2xl md:text-3xl text-slate-900 tracking-tight leading-none">
            Kilas Berita <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Gaul</span>
          </h1>

          <p className="text-xs text-slate-500 font-sans max-w-xl leading-relaxed">
            Nggak usah pusing baca bahasa birokrat kaku & kepanjangan gengs! Kami ringkas berita terpercaya dari <span className="font-semibold text-slate-800">CNN Ind, Detik, CNBC, Tempo</span> secara santai, asik, & instan. No clickbait!
          </p>
        </div>

        {/* Right: Live clock & interactive settings controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-center">
          {/* UTC Clock Card */}
          <div className="bg-slate-50 border border-slate-100 p-2.5 px-3.5 rounded-2xl flex items-center gap-3 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <div className="text-left font-mono">
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Jakarta Time</p>
              <p className="text-xs font-bold text-slate-800 tracking-wide">{timeStr || "Memuat..."}</p>
            </div>
          </div>

          {/* Glosarium & Refresh Button block */}
          <div className="flex gap-2">
            <button
              id="header-open-glosarium"
              onClick={onOpenGlosarium}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-sans text-xs font-semibold rounded-xl transition duration-150 active:scale-98 shadow-sm"
            >
              <HelpCircle className="w-4 h-4 text-blue-500" />
              Kamus Slang
            </button>

            <button
              id="header-refresh"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white active:scale-95 disabled:opacity-50 font-semibold rounded-xl transition shadow-md flex items-center justify-center gap-2"
              title="Refresh / Muat Ulang Berita"
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
