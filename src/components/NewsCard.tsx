import React, { useState } from "react";
import { SummarizedArticle } from "../types";
import { Sparkles, Calendar, ArrowUpRight, Copy, Check, MessageSquare, Newspaper, Info, Bookmark } from "lucide-react";

interface NewsCardProps {
  key?: string | number;
  article: SummarizedArticle;
  onGenerateAiImage: (articleId: string, catchyTitle: string, keywords: string[]) => Promise<void>;
  isGeneratingImage: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenDiscussion: () => void;
  commentCount: number;
  onViewDetail: () => void;
}

export default function NewsCard({ 
  article, 
  onGenerateAiImage, 
  isGeneratingImage,
  isBookmarked,
  onToggleBookmark,
  onOpenDiscussion,
  commentCount,
  onViewDetail
}: NewsCardProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"slang" | "original">("slang");

  const formatTime = (dateStr: string) => {
    try {
      const dt = new Date(dateStr);
      return dt.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }) + " WIB";
    } catch {
      return dateStr;
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${article.catchyTitle}\n\nBaca sumantap (summary mantap) ala KilasSantai:\n${article.slangSummary}\n\nSumber asli: ${article.sourceUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Share copy failed", e);
    }
  };

  return (
    <div 
      id={`news-card-${article.id}`} 
      className="group flex flex-col bg-white rounded-3xl border border-slate-100 hover:border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden h-full relative"
    >
      {/* Article Header Image */}
      <div 
        onClick={onViewDetail}
        className="relative h-48 md:h-52 overflow-hidden bg-slate-900 flex-shrink-0 cursor-pointer"
      >
        <img 
          src={article.imageUrl} 
          alt={article.catchyTitle}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-slate-800"
          onError={(e) => {
            // fallback to a robust design image link if Unsplash is blocked
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80";
          }}
        />
        
        {/* Abstract Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="text-[10px] font-mono tracking-wider uppercase font-semibold text-white bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            {article.sourceName}
          </span>
          <span className="text-[10px] font-mono tracking-wider uppercase font-semibold text-blue-200 bg-blue-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-blue-500/25">
            {article.category}
          </span>
        </div>

        {/* Read Later Bookmark button top right */}
        <button
          id={`bookmark-btn-${article.id}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleBookmark();
          }}
          className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/75 backdrop-blur-md text-white border border-white/10 hover:bg-slate-950 hover:scale-110 active:scale-95 transition-all z-20 shadow-lg"
          title={isBookmarked ? "Hapus dari Baca Nanti" : "Simpan untuk Baca Nanti"}
        >
          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "text-yellow-400 fill-yellow-400" : "text-white"}`} />
        </button>

        {article.isAiImage && (
          <div className="absolute bottom-3 left-3">
            <span className="flex items-center gap-1 text-[9px] font-mono font-semibold text-amber-300 bg-amber-950/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-amber-500/30">
              <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
              AI Illustrated
            </span>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Date and Toggle */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formatTime(article.publishedAt)}
          </span>
          
          <div className="bg-slate-100 p-0.5 rounded-lg flex gap-0.5">
            <button
              id={`toggle-slang-${article.id}`}
              onClick={() => setViewMode("slang")}
              className={`text-[9px] font-sans font-medium px-2 py-0.5 rounded-md transition ${viewMode === "slang" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Gaya Gaul 😎
            </button>
            <button
              id={`toggle-orig-${article.id}`}
              onClick={() => setViewMode("original")}
              className={`text-[9px] font-sans font-medium px-2 py-0.5 rounded-md transition ${viewMode === "original" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Berita Asli
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 
          id={`title-${article.id}`} 
          onClick={onViewDetail}
          className="font-sans font-bold text-base md:text-lg text-slate-800 leading-snug tracking-tight mb-2 group-hover:text-blue-600 transition-colors duration-200 cursor-pointer hover:underline"
        >
          {viewMode === "slang" ? article.catchyTitle : article.sourceTitle}
        </h3>

        {/* Summary Content */}
        <div id={`summary-${article.id}`} className="text-xs text-slate-600 font-sans leading-relaxed flex-grow">
          {viewMode === "slang" ? (
            <div className="space-y-2">
              <p className="bg-slate-50 border-l-2 border-blue-500 p-2 text-slate-700 italic font-medium flex items-start gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>&ldquo;{article.tagline}&rdquo;</span>
              </p>
              <p className="whitespace-pre-line text-slate-600">{article.slangSummary}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="whitespace-pre-line text-slate-500 italic">
                {article.originalDescription || "Gak ada deskripsi tambahan nih guys, langsung aja klik sumber aslinya di bawah."}
              </p>
            </div>
          )}
        </div>

        {/* Action Controls & Footer credit */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col gap-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {/* Launch illustration Generator */}
            <button
              id={`btn-ai-img-${article.id}`}
              onClick={() => onGenerateAiImage(article.id, article.catchyTitle, article.keywords)}
              disabled={isGeneratingImage}
              title="Generate a cover illustration using Gemini Image Gen!"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-sans font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 active:scale-95 disabled:opacity-50 transition shadow-sm border border-blue-200/50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-blue-500 ${isGeneratingImage ? "animate-spin" : ""}`} />
              {isGeneratingImage ? "Meracik..." : "Bikin Gambar AI"}
            </button>

            {/* View Discussion */}
            <button
              id={`btn-comments-${article.id}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenDiscussion();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-sans font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition border border-emerald-250"
              title="Join the interactive discussion"
            >
              <MessageSquare className="w-3 h-3 text-emerald-600" />
              Diskusi ({commentCount})
            </button>

            {/* Share / Copy */}
            <button
              id={`btn-share-${article.id}`}
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-sans font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 active:scale-95 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              {copied ? "Tersalin!" : "Bagikan"}
            </button>
          </div>

          {/* Attribution Credit block */}
          <div className="flex items-center justify-between text-[11px] font-sans text-slate-400">
            <span className="flex items-center gap-1 text-[10px]">
              <Newspaper className="w-3.5 h-3.5 text-slate-300" />
              <span>Sumber: {article.sourceName}</span>
            </span>
            <a 
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 text-[10px]"
            >
              Lihat Asli
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
