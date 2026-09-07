import React, { useState, useEffect } from "react";
import { X, Send, ThumbsUp, ThumbsDown, ShieldAlert, Sparkles } from "lucide-react";
import { SummarizedArticle, ArticleComment } from "../types";

interface DiscussionModalProps {
  article: SummarizedArticle;
  onClose: () => void;
}

// Banned words list for youth/slang moderation
const BANNED_WORDS = ["anjing", "babi", "kontol", "bangsat", "memek", "goblok", "tolol", "idiot", "clickbait palsu", "hoax parah"];

export default function DiscussionModal({ article, onClose }: DiscussionModalProps) {
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("kilassantai_username") || "SobatSantai_" + Math.random().toString(36).substring(2, 6);
  });
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);

  // Load comments from localStorage
  useEffect(() => {
    const key = `comments_${article.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setComments(JSON.parse(stored));
    } else {
      // Seed initial funny slang discussion so it feels lively!
      const initialComments: ArticleComment[] = [
        {
          id: `seed-1-${article.id}`,
          articleId: article.id,
          username: "ReyhanGamerz",
          text: "Waduh, beneran gokil banget sih info ini! Makasih tim KilasSantai udah ngerangkum, ringkasannya dapet bgt! 🔥🚀",
          publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
          votes: 12
        },
        {
          id: `seed-2-${article.id}`,
          articleId: article.id,
          username: "PutriAesthetic",
          text: "Gua setuju sih. Akhirnya ada yang jelasin berita ini pake bahasa manusia, bukannya istilah birokrasi korporat yg bikin jidat mengkeret kwkwk 😂🤙",
          publishedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
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
    
    // Also notify App of comment count changes if needed
    window.dispatchEvent(new Event("comments_updated"));
  };

  const handleVote = (commentId: string, type: "up" | "down") => {
    const updated = comments.map(c => {
      if (c.id === commentId) {
        let voteDiff = 0;
        let nextVoted: "up" | "down" | null = type;

        if (c.userVoted === type) {
          // Undo vote
          voteDiff = type === "up" ? -1 : 1;
          nextVoted = null;
        } else if (c.userVoted) {
          // Switch vote
          voteDiff = type === "up" ? 2 : -2;
        } else {
          // Fresh vote
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

    // Save username preference
    localStorage.setItem("kilassantai_username", username.trim() || "Anonim");

    // Perform moderation / validation check
    const containsBanned = BANNED_WORDS.some(word => txt.toLowerCase().includes(word));
    if (containsBanned) {
      setModerationWarning("Eits, santuy dulu gengs! Komentar lo mengandung kata-kata kasar atau spam kurang berkemanusiaan. Yuk ganti kalimat yang lebih asik nan suportif! ✨ We support positive vibes only!");
      return;
    }

    if (txt.length < 3) {
      setModerationWarning("Komentar lo kependekan gengs, minimal ketik sepatah dua patah kata asik ya!");
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

  const formatDistance = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return "Baru saja";
      if (mins < 60) return `${mins} mnt lalu`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} jam lalu`;
      return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    } catch {
      return "Hari ini";
    }
  };

  return (
    <div id="discussion-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
        
        {/* Sleek top header strip */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-700" />
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="space-y-1 pr-6">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Forum Ngobrol Santai 💬
            </span>
            <h3 className="font-sans font-black text-slate-800 text-sm md:text-base leading-snug line-clamp-2">
              {article.catchyTitle}
            </h3>
          </div>
          <button 
            id="close-discussion"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to set Nickname */}
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl mb-4 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-medium">Username lo:</span>
          <input 
            type="text"
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold max-w-[150px] text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={username}
            onChange={(e) => setUsername(e.target.value.substring(0, 18))}
            placeholder="AnonimGokil"
          />
        </div>

        {/* Comments Scroll Area */}
        <div className="flex-grow overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <span className="text-2xl">⚡</span>
              <p className="text-xs font-sans">Belum ada obrolan nih guys. Jadilah sobat pertama yang nimbrung!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div 
                key={comment.id}
                className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-2 transition duration-150"
              >
                <div className="flex items-center justify-between text-[11px] font-sans">
                  <span className="font-extrabold text-blue-700">{comment.username}</span>
                  <span className="text-slate-400 font-mono">{formatDistance(comment.publishedAt)}</span>
                </div>
                
                <p className="text-xs font-sans text-slate-700 leading-relaxed whitespace-pre-line">
                  {comment.text}
                </p>

                {/* Vote mechanics */}
                <div className="flex items-center gap-3 pt-1 border-t border-slate-100/50 justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-slate-300" /> Moderated
                  </span>

                  <div className="flex items-center gap-2 text-slate-500">
                    <button
                      onClick={() => handleVote(comment.id, "up")}
                      className={`p-1 rounded-md flex items-center gap-1 text-[11px] font-mono transition ${
                        comment.userVoted === "up" 
                          ? "bg-blue-50 text-blue-600 font-bold" 
                          : "hover:bg-slate-200"
                      }`}
                      title="Setuju banget!"
                    >
                      <ThumbsUp className={`w-3 h-3 ${comment.userVoted === "up" ? "text-blue-500 fill-blue-500" : ""}`} />
                      <span>{comment.votes >= 0 ? comment.votes : 0}</span>
                    </button>

                    <button
                      onClick={() => handleVote(comment.id, "down")}
                      className={`p-1 rounded-md flex items-center gap-1 text-[11px] font-mono transition ${
                        comment.userVoted === "down" 
                          ? "bg-red-50 text-red-500 font-bold" 
                          : "hover:bg-slate-200"
                      }`}
                      title="Nggak setuju ah"
                    >
                      <ThumbsDown className={`w-3 h-3 ${comment.userVoted === "down" ? "text-red-500 fill-red-500" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Error/Moderation Alert Banner */}
        {moderationWarning && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-2xl text-xs flex items-start gap-2 mt-2 leading-relaxed animate-pulse">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p>{moderationWarning}</p>
          </div>
        )}

        {/* Input box to post */}
        <form onSubmit={handlePostComment} className="border-t border-slate-100 pt-4 mt-3 flex gap-2">
          <input 
            type="text"
            className="flex-1 bg-slate-100 border-none focus:ring-2 focus:ring-indigo-150 rounded-2xl px-4 py-2.5 text-xs text-slate-800 outline-none"
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
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl text-xs hover:opacity-95 active:scale-95 transition flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim</span>
          </button>
        </form>

      </div>
    </div>
  );
}
