import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  ExternalLink, 
  Calendar, 
  MessageSquare, 
  Sparkles, 
  Send, 
  ThumbsUp, 
  ThumbsDown, 
  ShieldAlert, 
  Bookmark, 
  Volume2, 
  VolumeX, 
  Zap, 
  BookOpenText,
  Copy,
  Check,
  Share2,
  Flame,
  TrendingUp,
  Compass
} from "lucide-react";
import { SummarizedArticle, ArticleComment } from "../types";
import { slugify, trackArticleView, getUserReadingHistory, scoreArticleRecommendation } from "../utils";

interface DetailBeritaProps {
  article: SummarizedArticle;
  allArticles: SummarizedArticle[];
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onGoBack: () => void;
  onNavigateToArticle: (art: SummarizedArticle) => void;
}

const BANNED_WORDS = ["anjing", "babi", "kontol", "bangsat", "memek", "goblok", "tolol", "idiot", "clickbait palsu", "hoax parah"];

export default function DetailBerita({
  article,
  allArticles,
  isBookmarked,
  onToggleBookmark,
  onGoBack,
  onNavigateToArticle
}: DetailBeritaProps) {
  const [longSummary, setLongSummary] = useState<string>("");
  const [isLoadingLong, setIsLoadingLong] = useState<boolean>(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("kilassantai_username") || "SobatSantai_" + Math.random().toString(36).substring(2, 6);
  });
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<"quick" | "deep">("deep");
  const [quickSummary, setQuickSummary] = useState<string>("");
  const [isLoadingQuick, setIsLoadingQuick] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [recommendations, setRecommendations] = useState<SummarizedArticle[]>([]);

  // Scroll to top and track reading history when article changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    trackArticleView(article);
  }, [article.id]);

  // Load / generate long form summary
  useEffect(() => {
    setLongSummary(""); 
    setIsLoadingLong(true);

    const checkAndFetchLongSummary = async () => {
      try {
        const cacheKey = `long_summary_${article.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setLongSummary(cached);
          setIsLoadingLong(false);
          return;
        }

        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: article.sourceTitle,
            context: article.originalDescription || article.slangSummary,
            category: article.category,
            mode: "long"
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.slangSummary) {
            setLongSummary(data.slangSummary);
            localStorage.setItem(cacheKey, data.slangSummary);
          } else {
            setLongSummary(article.slangSummary);
          }
        } else {
          setLongSummary(article.slangSummary);
        }
      } catch (err) {
        console.warn("Error getting long summary, using short slang summary instead", err);
        setLongSummary(article.slangSummary);
      } finally {
        setIsLoadingLong(false);
      }
    };

    checkAndFetchLongSummary();
  }, [article.id, article.slangSummary]);

  // Super Powerful Recommendation Engine Fetcher
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const history = getUserReadingHistory();
        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentId: article.id,
            historyCategories: history.categoryCounts,
            historyKeywords: history.keywordCounts
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
            setRecommendations(data.recommendations);
            return;
          }
        }
      } catch (err) {
        console.warn("Recommendation API fallback to client scoring engine:", err);
      }

      // Client-Side Fallback Recommendation Scoring Engine
      const history = getUserReadingHistory();
      const scoredCandidates = allArticles
        .filter((a) => a.id !== article.id)
        .map((art) => {
          const scoring = scoreArticleRecommendation(art, article, history);
          return {
            ...art,
            matchPercentage: scoring.matchPercentage,
            recommendationBadge: scoring.badge,
            recommendationReason: scoring.reason,
            score: scoring.score
          };
        });

      scoredCandidates.sort((a, b) => b.score - a.score);
      setRecommendations(scoredCandidates.slice(0, 6));
    };

    fetchRecommendations();
  }, [article.id, allArticles]);

  // Comments System Sync
  useEffect(() => {
    const key = `comments_${article.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setComments(JSON.parse(stored));
    } else {
      const initialComments: ArticleComment[] = [
        {
          id: `seed-1-${article.id}`,
          articleId: article.id,
          username: "ReyhanGamerz",
          text: "Waduh, beneran gokil banget sih info ini! Makasih tim KilasBeritaGaul udah ngerangkum versi panjangnya, super informatif & asik bgt! 🔥🚀",
          publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          votes: 12
        },
        {
          id: `seed-2-${article.id}`,
          articleId: article.id,
          username: "PutriAesthetic",
          text: "Vibes nulisnya dapet banget, gak kaku kayak portal berita sebelah. Sumpah ini ngebantu bgt buat tugas & nambah wawasan circle tongkrongan gw! 😂🤙",
          publishedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
          votes: 8
        }
      ];
      setComments(initialComments);
      localStorage.setItem(key, JSON.stringify(initialComments));
    }
  }, [article.id]);

  const saveComments = (updated: ArticleComment[]) => {
    setComments(updated);
    localStorage.setItem(`comments_${article.id}`, JSON.stringify(updated));
    window.dispatchEvent(new Event("comments_updated"));
  };

  const handleVote = (commentId: string, type: "up" | "down") => {
    const updated = comments.map(c => {
      if (c.id === commentId) {
        let voteDiff = 0;
        let nextVoted: "up" | "down" | null = type;

        if (c.userVoted === type) {
          voteDiff = type === "up" ? -1 : 1;
          nextVoted = null;
        } else if (c.userVoted) {
          voteDiff = type === "up" ? 2 : -2;
        } else {
          voteDiff = type === "up" ? 1 : -1;
        }

        return {
          ...c,
          votes: c.votes + voteDiff,
          userVoted: nextVoted
        };
      }
      return c;
    });
    saveComments(updated);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    setModerationWarning(null);

    const txt = newComment.trim();
    if (!txt) return;

    localStorage.setItem("kilassantai_username", username.trim() || "Anonim");

    const containsBanned = BANNED_WORDS.some(word => txt.toLowerCase().includes(word));
    if (containsBanned) {
      setModerationWarning("Eits, santuy dulu gengs! Komentar lo mengandung kata kasar. Yuk ganti kalimat yang lebih asik nan suportif! ✨");
      return;
    }

    if (txt.length < 3) {
      setModerationWarning("Komentar kependekan gengs, ketik sepatah dua patah kata ya!");
      return;
    }

    const brandNew: ArticleComment = {
      id: "comment-" + Math.random().toString(36).substring(2, 9),
      articleId: article.id,
      username: username.trim() || "Anonim",
      text: txt,
      publishedAt: new Date().toISOString(),
      votes: 0,
      userVoted: null
    };

    const updated = [brandNew, ...comments];
    saveComments(updated);
    setNewComment("");
  };

  // Text-to-Speech
  const handleTTS = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const textToRead = summaryMode === "quick" ? (quickSummary || article.slangSummary) : (longSummary || article.slangSummary);
    if (!textToRead) return;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = "id-ID";
    utterance.rate = 1;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // Fetch quick summary
  const handleQuickSummary = async () => {
    if (quickSummary) { setSummaryMode("quick"); return; }
    setSummaryMode("quick");
    setIsLoadingQuick(true);
    try {
      const cacheKey = `quick_summary_${article.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setQuickSummary(cached); setIsLoadingQuick(false); return; }
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: article.sourceTitle, context: article.originalDescription || article.slangSummary, category: article.category, mode: "short" })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.slangSummary) {
          setQuickSummary(data.slangSummary);
          localStorage.setItem(cacheKey, data.slangSummary);
        } else {
          setQuickSummary(article.slangSummary);
        }
      } else {
        setQuickSummary(article.slangSummary);
      }
    } catch {
      setQuickSummary(article.slangSummary);
    } finally {
      setIsLoadingQuick(false);
    }
  };

  // Direct Share Link Handler
  const handleShareDirectUrl = async () => {
    const directUrl = `${window.location.origin}${window.location.pathname}?article=${article.id}`;
    try {
      await navigator.clipboard.writeText(`${article.catchyTitle}\n\nBaca berita lengkapnya di Kilas Berita Gaul:\n${directUrl}`);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      console.warn("Direct URL copy failed");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return "Baru Saja";
    }
  };

  return (
    <div id={`detail-berita-${article.id}`} className="space-y-8 animate-fade-in pb-12">
      {/* Back button strip & bookmark & direct share */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition font-semibold text-xs py-1.5 px-3 rounded-xl hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Share Direct Link Button */}
          <button
            onClick={handleShareDirectUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            title="Salin Link Langsung Artikel Ini"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-blue-500" />}
            <span>{copiedUrl ? "Link Tersalin!" : "Bagikan Link"}</span>
          </button>

          {/* Bookmark Button */}
          <button
            onClick={onToggleBookmark}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              isBookmarked 
                ? "bg-amber-500 text-white border-amber-600 shadow" 
                : "bg-white text-slate-500 hover:bg-slate-100 border-slate-200"
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-white text-white" : "text-amber-500"}`} />
            <span>{isBookmarked ? "Disimpan" : "Simpan Baca Nanti"}</span>
          </button>
        </div>
      </div>

      {/* Hero Header Area with Large Image */}
      <div className="relative h-[260px] md:h-[420px] rounded-3xl overflow-hidden shadow-xl border border-slate-100 bg-slate-900">
        <img
          src={article.imageUrl}
          alt={article.catchyTitle}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1000&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            <span className="bg-blue-600/90 text-white text-[9px] md:text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-sm">
              #{article.category.toUpperCase()}
            </span>
            <span className="bg-slate-900/70 text-blue-200 text-[9px] md:text-[10px] font-mono px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {formatDate(article.publishedAt)}
            </span>
            {article.isAiImage && (
              <span className="bg-amber-950/80 text-amber-300 text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> AI Illustrated
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-3xl font-black leading-tight tracking-tight max-w-4xl drop-shadow">
            {article.catchyTitle}
          </h1>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* News text container */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
          
          {/* Header metadata + TTS & Quick/Deep toggle */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs">
                📰
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">{article.sourceName}</p>
                <p className="text-[10px] text-slate-400 font-mono">Sumber Feed Terpercaya</p>
              </div>
            </div>

            {/* Audio & Summary Length Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTTS}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition border ${
                  isSpeaking
                    ? "bg-blue-600 text-white border-blue-700 shadow animate-pulse"
                    : "bg-white text-slate-500 hover:bg-slate-100 border-slate-200"
                }`}
                title={isSpeaking ? "Stop Audio" : "Dengarkan Audio Suara Ringkasan"}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-blue-500" />}
                <span>{isSpeaking ? "Stop Audio" : "Dengarkan"}</span>
              </button>
              <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                <button
                  onClick={handleQuickSummary}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                    summaryMode === "quick" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Zap className="w-3 h-3" /> Quick Read
                </button>
                <button
                  onClick={() => setSummaryMode("deep")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                    summaryMode === "deep" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <BookOpenText className="w-3 h-3" /> Deep Dive
                </button>
              </div>
            </div>
          </div>

          {/* Content display */}
          <div className="prose max-w-none text-slate-700 font-sans space-y-4 text-xs md:text-sm leading-relaxed">
            {summaryMode === "deep" ? (
              isLoadingLong ? (
                <div className="space-y-4 py-6">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs animate-pulse">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Kecerdasan Gemini AI sedang menganalisis & menulis ringkasan gaul versi panjang...</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6"></div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3"></div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5"></div>
                </div>
              ) : (
                longSummary.split("\n\n").map((para, idx) => (
                  <p key={idx} className="font-medium text-slate-705 leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-50/20 shadow-xs">
                    {para}
                  </p>
                ))
              )
            ) : (
              isLoadingQuick ? (
                <div className="space-y-4 py-6">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs animate-pulse">
                    <Zap className="w-4 h-4 animate-spin" />
                    <span>Merangkum cepat versi Quick Read...</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2"></div>
                </div>
              ) : (
                (quickSummary || article.slangSummary).split("\n\n").map((para, idx) => (
                  <p key={idx} className="font-medium text-slate-705 leading-relaxed bg-blue-50/50 p-3 rounded-2xl border border-blue-50/20 shadow-xs">
                    {para}
                  </p>
                ))
              )
            )}
          </div>

          {/* Tagline highlight */}
          <div className="border-l-4 border-indigo-600 pl-4 py-2 bg-indigo-50/40 rounded-r-2xl">
            <p className="text-xs md:text-sm font-sans font-black text-indigo-900 italic">
              &ldquo;{article.tagline}&rdquo;
            </p>
          </div>

          {/* Source Link */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-[11px] font-mono text-slate-450 italic">
              *Hak cipta konten milik {article.sourceName}
            </span>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/10 active:scale-95 transition"
            >
              <span>Baca Artikel Aslinya →</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Comments Section */}
          <div className="pt-8 border-t border-slate-100 space-y-6">
            <h3 className="font-sans font-black text-slate-800 text-sm md:text-base tracking-tight flex items-center gap-2">
              <span>Kolom Diskusi ({comments.length})</span>
              <MessageSquare className="w-4.5 h-4.5 text-blue-500" />
            </h3>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">Nickname Lo di Tongkrongan:</span>
              <input
                type="text"
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-850 font-bold max-w-[150px] text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={username}
                onChange={(e) => setUsername(e.target.value.substring(0, 18))}
              />
            </div>

            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-slate-100 border-none focus:ring-2 focus:ring-indigo-150 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none"
                placeholder="Ketuk opini asik lo di sini... (Be nice ya!)"
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  if (moderationWarning) setModerationWarning(null);
                }}
                maxLength={180}
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs hover:opacity-95 active:scale-95 transition"
              >
                Kirim
              </button>
            </form>

            {moderationWarning && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-xs flex items-start gap-2 mt-2">
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p>{moderationWarning}</p>
              </div>
            )}

            <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Koleksi obrolan masih sepi, mimpin tulisan asik lo di sini gengs!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-blue-700">{comment.username}</span>
                      <span className="text-slate-400 font-mono">
                        {new Date(comment.publishedAt).toLocaleTimeString("id-ID", { hour: "numeric", minute: "numeric" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{comment.text}</p>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100/30">
                      <button
                        onClick={() => handleVote(comment.id, "up")}
                        className={`p-1 rounded flex items-center gap-1 text-[10px] font-mono transition ${
                          comment.userVoted === "up" ? "bg-blue-50 text-blue-600 font-bold" : "text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{comment.votes >= 0 ? comment.votes : 0}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* SIDEBAR - SUPER POWERFUL RECOMMENDATIONS ENGINE */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-sans font-black text-slate-800 text-sm md:text-base tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Rekomendasi Pintar AI</span>
              </h3>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                For You 🎯
              </span>
            </div>

            <div className="space-y-4">
              {recommendations.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Menyiapkan rekomendasi buat lo...</p>
              ) : (
                recommendations.slice(0, 4).map((art) => (
                  <button
                    key={art.id}
                    onClick={() => onNavigateToArticle(art)}
                    className="w-full flex items-start gap-3.5 text-left group p-2 hover:bg-slate-50 rounded-2xl transition border border-transparent hover:border-slate-100"
                  >
                    <img
                      src={art.imageUrl}
                      alt={art.catchyTitle}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-100 group-hover:scale-105 transition"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80";
                      }}
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      {art.recommendationBadge && (
                        <span className="inline-block text-[9px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                          {art.recommendationBadge}
                        </span>
                      )}
                      <p className="font-bold text-xs text-slate-800 transition line-clamp-2 leading-snug group-hover:text-blue-600">
                        {art.catchyTitle}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {art.sourceName}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION - DIVERSIFIED SMART RECOMMENDATION CARDS (Jangan Pulang Dulu!) */}
      {recommendations.length > 2 && (
        <div className="mt-12 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <h3 className="text-lg md:text-xl font-black flex items-center gap-2 text-white">
                <Flame className="w-5 h-5 text-amber-400" />
                <span>Jangan Pergi Dulu Gengs! Lanjut Baca Ini:</span>
              </h3>
              <p className="text-xs text-slate-300 font-sans">
                Rekomendasi otomatis berbasis AI agar lo tetep up-to-date & makin wawasan di circle nongkrong!
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-full text-blue-300 border border-white/10">
              ⚡ Super Powerful Recommendations
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.slice(1, 4).map((rec) => (
              <div
                key={rec.id}
                onClick={() => onNavigateToArticle(rec)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-1 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-blue-300">
                    <span>{rec.sourceName}</span>
                    {rec.matchPercentage && (
                      <span className="bg-blue-600/80 text-white font-bold px-2 py-0.5 rounded-full">
                        {rec.matchPercentage}% Match
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs leading-snug line-clamp-2 text-white hover:text-blue-300 transition">
                    {rec.catchyTitle}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-sans">
                    {rec.slangSummary}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-amber-300 font-bold">
                  <span>{rec.recommendationBadge || "⚡ Trending"}</span>
                  <span className="underline">Baca Now →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}