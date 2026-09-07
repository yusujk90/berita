import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import NewsCard from "./components/NewsCard";
import GlosariumGaul from "./components/GlosariumGaul";
import DiscussionModal from "./components/DiscussionModal";
import NotificationSettingsModal from "./components/NotificationSettingsModal";
import DetailBerita from "./components/DetailBerita";
import { slugify, trackArticleView, getUserReadingHistory, scoreArticleRecommendation } from "./utils";
import { SummarizedArticle, NotificationPreferences, AppNotification } from "./types";
import { 
  MapPin, 
  Globe, 
  Flame, 
  Cpu, 
  Music, 
  Trophy, 
  AlertTriangle,
  Lightbulb,
  BookOpen,
  WifiOff,
  Sparkles,
  Bookmark,
  Bell
} from "lucide-react";

const CATEGORIES = [
  { id: "indonesia", label: "Indonesia", icon: MapPin },
  { id: "luar-negeri", label: "Luar Negeri", icon: Globe },
  { id: "viral", label: "Viral/Trending", icon: Flame },
  { id: "teknologi", label: "Teknologi", icon: Cpu },
  { id: "hiburan", label: "Hiburan", icon: Music },
  { id: "olahraga", label: "Olahraga", icon: Trophy }
];

export default function App() {
  const [activeCategory, setActiveCategory] = useState("indonesia");
  const [articles, setArticles] = useState<SummarizedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [showCustomSuccess, setShowCustomSuccess] = useState(false);
  
  // Pagination & Infinite Scroll States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  // Custom Detail views Routing state
  const [detailArticle, setDetailArticle] = useState<SummarizedArticle | null>(null);

  // Track generating state for individual articles separately
  const [generatingStates, setGeneratingStates] = useState<Record<string, boolean>>({});
  
  // Glosarium Modal State
  const [glosariumOpen, setGlosariumOpen] = useState(false);

  // Read Later Bookmarks State
  const [bookmarks, setBookmarks] = useState<SummarizedArticle[]>(() => {
    try {
      const stored = localStorage.getItem("kilassantai_bookmarks");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [viewingBookmarks, setViewingBookmarks] = useState(false);

  // Personalized Notification System Settings
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem("kilassantai_notification_prefs");
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      enabled: true,
      categories: ["viral", "teknologi"],
      keywords: ["sora", "ai", "timnas", "apple"],
      frequency: "instan"
    };
  });
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);

  // Received Notification Log
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem("kilassantai_received_notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showNotificationsList, setShowNotificationsList] = useState(false);
  const [recentAlertToast, setRecentAlertToast] = useState<AppNotification | null>(null);

  // Community discussion state
  const [activeDiscussionArticle, setActiveDiscussionArticle] = useState<SummarizedArticle | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  
  // Banner message
  const [apiStatus, setApiStatus] = useState<{ hasKey: boolean; message: string }>({
    hasKey: true,
    message: ""
  });

  const retrieveCommentCounts = () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("comments_")) {
        const articleId = key.replace("comments_", "");
        try {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          counts[articleId] = list.length;
        } catch {
          counts[articleId] = 0;
        }
      }
    }
    setCommentCounts(counts);
  };

  const handleIncomingNotificationCheck = (newArticles: SummarizedArticle[]) => {
    if (!notificationPrefs.enabled) return;

    try {
      const triggeredStr = localStorage.getItem("kilassantai_triggered_notifs") || "[]";
      const triggeredIds: string[] = JSON.parse(triggeredStr);
      const newTriggers = [...triggeredIds];
      const generatedNotifs: AppNotification[] = [];

      newArticles.forEach(art => {
        if (newTriggers.includes(art.id)) return;

        const matchesCategory = notificationPrefs.categories.includes(art.category);
        const matchesKeyword = notificationPrefs.keywords.some(kw => {
          const keyword = kw.toLowerCase().trim();
          return keyword && (
            art.catchyTitle.toLowerCase().includes(keyword) || 
            art.slangSummary.toLowerCase().includes(keyword)
          );
        });

        if (matchesCategory || matchesKeyword) {
          newTriggers.push(art.id);
          const matchedKw = matchesKeyword 
            ? notificationPrefs.keywords.find(kw => 
                art.catchyTitle.toLowerCase().includes(kw.toLowerCase()) || 
                art.slangSummary.toLowerCase().includes(kw.toLowerCase())
              ) 
            : null;

          const notif: AppNotification = {
            id: `notif-${art.id}-${Math.floor(Math.random() * 1000)}`,
            title: matchedKw ? `KATA KUNCI FAVORIT: #${matchedKw} 🌟` : `KATEGORI FAVORIT LO: ${art.category.toUpperCase()} 🔥`,
            body: art.catchyTitle,
            articleId: art.id,
            publishedAt: new Date().toISOString(),
            isRead: false
          };

          generatedNotifs.push(notif);
        }
      });

      if (generatedNotifs.length > 0) {
        const merged = [...generatedNotifs, ...notifications];
        setNotifications(merged);
        localStorage.setItem("kilassantai_received_notifications", JSON.stringify(merged));
        localStorage.setItem("kilassantai_triggered_notifs", JSON.stringify(newTriggers));

        // Display beautiful in-app toast notification alert
        setRecentAlertToast(generatedNotifs[0]);
        setTimeout(() => {
          setRecentAlertToast(null);
        }, 6000);
      }
    } catch (e) {
      console.warn("Notification trigger analysis failed", e);
    }
  };

  const fetchNews = async (categoryName: string, pageNumber: number = 1) => {
    if (viewingBookmarks) {
      setIsLoading(false);
      return;
    }

    if (pageNumber === 1) {
      setIsLoading(true);
      setHasMore(true);
    } else {
      setIsFetchingMore(true);
    }

    setError(null);
    try {
      const response = await fetch(`/api/news?category=${categoryName}&page=${pageNumber}&limit=6`);
      if (!response.ok) {
        throw new Error(`Gagal memuat berita dari server (Status ${response.status})`);
      }
      const data = await response.json();
      const list = data.articles || [];
      
      if (list.length < 6) {
        setHasMore(false);
      }

      if (pageNumber === 1) {
        setArticles(list);
      } else {
        setArticles(prev => {
          const loadedIds = new Set(prev.map(a => a.id));
          const filteredNewList = list.filter((a: any) => !loadedIds.has(a.id));
          return [...prev, ...filteredNewList];
        });
      }
      
      handleIncomingNotificationCheck(list);
    } catch (err: any) {
      console.error(err);
      if (pageNumber === 1) {
        setError(err?.message || "Koneksi ke server bermasalah gengs! Coba muat ulang beberapa saat lagi.");
      }
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  const loadNextPage = () => {
    if (!hasMore || isLoading || isFetchingMore || viewingBookmarks) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNews(activeCategory, nextPage);
  };

  const observerTargetRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const currentTarget = observerTargetRef.current;
    if (!currentTarget) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentTarget);
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [page, hasMore, isLoading, isFetchingMore, activeCategory, viewingBookmarks]);

  const checkApiKeyStatus = async () => {
    try {
      const response = await fetch("/api/news?category=indonesia&page=1&limit=1");
      if (response.ok) {
        const data = await response.json();
        const isFallback = data.articles && data.articles.some((a: any) => a.catchyTitle && a.catchyTitle.includes("[INFO NYANTAI]"));
        if (isFallback) {
          setApiStatus({
            hasKey: false,
            message: "Mencari review? Hubungkan 'GEMINI_API_KEY' in Settings > Secrets untuk sumantap full AI translation dan custom gambar gaul!"
          });
        }
      }
    } catch (e) {
      console.warn("Status probe error ignored", e);
    }
  };

  // Select article & push state
  const handleSelectArticle = (article: SummarizedArticle) => {
    setDetailArticle(article);
    const slug = slugify(article.catchyTitle);
    window.history.pushState(null, "", `/berita/${slug}`);
  };

  // Back button home
  const navigateToHome = () => {
    setDetailArticle(null);
    window.history.pushState(null, "", "/");
  };

  // Dynamic Routing popstate listener
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.startsWith("/berita/")) {
        const slug = path.replace("/berita/", "");
        // Seek in both local list and saved bookmarks
        const found = [...articles, ...bookmarks].find(
          (art) => slugify(art.catchyTitle) === slug || art.id === slug
        );
        if (found) {
          setDetailArticle(found);
        }
      } else {
        setDetailArticle(null);
      }
    };

    handleLocationChange();
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, [articles, bookmarks]);

  // Initial fetch and Reset page counts on Category switch
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    if (!viewingBookmarks) {
      fetchNews(activeCategory, 1);
    } else {
      setIsLoading(false);
    }
  }, [activeCategory, viewingBookmarks]);

  useEffect(() => {
    checkApiKeyStatus();
    retrieveCommentCounts();

    const handleCommentsUpdate = () => {
      retrieveCommentCounts();
    };

    window.addEventListener("comments_updated", handleCommentsUpdate);
    return () => {
      window.removeEventListener("comments_updated", handleCommentsUpdate);
    };
  }, []);

  const handleToggleBookmark = (article: SummarizedArticle) => {
    let updated: SummarizedArticle[];
    const isBookmarked = bookmarks.some(b => b.id === article.id);
    
    if (isBookmarked) {
      updated = bookmarks.filter(b => b.id !== article.id);
    } else {
      updated = [...bookmarks, article];
    }
    
    setBookmarks(updated);
    localStorage.setItem("kilassantai_bookmarks", JSON.stringify(updated));
  };

  const handleSaveNotificationPrefs = (prefs: NotificationPreferences) => {
    setNotificationPrefs(prefs);
    localStorage.setItem("kilassantai_notification_prefs", JSON.stringify(prefs));
  };

  const handleMarkNotificationRead = (notif: AppNotification) => {
    const updated = notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n);
    setNotifications(updated);
    localStorage.setItem("kilassantai_received_notifications", JSON.stringify(updated));

    // Try to find if this article is already in current loaded state or bookmarks, and trigger discussion
    const articleMatch = [...articles, ...bookmarks].find(a => a.id === notif.articleId);
    if (articleMatch) {
      setActiveDiscussionArticle(articleMatch);
    }
    setShowNotificationsList(false);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    localStorage.setItem("kilassantai_received_notifications", "[]");
  };

  const handleGenerateAiImage = async (articleId: string, catchyTitle: string, keywords: string[]) => {
    if (generatingStates[articleId]) return;
    
    setGeneratingStates(prev => ({ ...prev, [articleId]: true }));
    try {
      const response = await fetch("/api/generate-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          catchyTitle,
          keywords,
          category: activeCategory
        })
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.message || "Gagal membuat gambar AI.");
      }

      // Update the targeted article inside our local list is successful
      if (data.imageUrl) {
        setArticles(prevArticles => 
          prevArticles.map(art => 
            art.id === articleId 
              ? { ...art, imageUrl: data.imageUrl, isAiImage: true } 
              : art
          )
        );
      }
    } catch (err: any) {
      alert(err.message || "Ops, gagal membuat ilustrasi AI. Pastikan API Key di Secrets sudah diset dengan benar ya!");
    } finally {
      setGeneratingStates(prev => ({ ...prev, [articleId]: false }));
    }
  };

  const handleCustomSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    
    setCustomLoading(true);
    setShowCustomSuccess(false);
    
    try {
      // Simulate real-time prompt generation
      const dummyId = "custom-" + Math.random().toString(36).substring(2, 9);
      const isUrl = customTopic.startsWith("http://") || customTopic.startsWith("https://");
      
      const customObj: SummarizedArticle = {
        id: dummyId,
        sourceTitle: isUrl ? "Link Rujukan Berita" : customTopic,
        sourceUrl: isUrl ? customTopic : "https://detik.com",
        sourceName: "User Request",
        publishedAt: new Date().toISOString(),
        originalDescription: "Permintaan disintesis instan oleh user melalui widget Rangkum Sendiri.",
        catchyTitle: isUrl 
          ? "🔗 Link Berhasil Dirangkum! Baca Versi Gaulnya di Sini" 
          : `🔥 Gosip Hangat: "${customTopic}" Lagi Viral di Jagat Sosmed`,
        slangSummary: `Hallo gengs! Ada request spesial nih tentang "${customTopic}". Setelah dipantau tim redaksi, topik ini beneran asik buat dibahas karena lagi rame diperbincangkan warganet di medsos maupun tongkrongan chat. Keep up to date biar lo selalu jadi yang paling keren dan gak kuper ya!`,
        tagline: "Request sumantap lo langsung meluncur nih gengs! 🚀",
        category: "viral",
        keywords: [activeCategory],
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
        isAiImage: true
      };
      
      // Let's prepend to local list to provide instant response
      setArticles(prev => [customObj, ...prev]);
      setCustomTopic("");
      setShowCustomSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setCustomLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Glosarium Slang Modal */}
      <GlosariumGaul 
        isOpen={glosariumOpen} 
        onClose={() => setGlosariumOpen(false)} 
      />

      {/* Community Discussion forums Modal popup */}
      {activeDiscussionArticle && (
        <DiscussionModal 
          article={activeDiscussionArticle}
          onClose={() => setActiveDiscussionArticle(null)}
        />
      )}

      {/* Personalized Notification preferences configuration Modal */}
      {notificationSettingsOpen && (
        <NotificationSettingsModal
          preferences={notificationPrefs}
          onSavePreferences={handleSaveNotificationPrefs}
          onClose={() => setNotificationSettingsOpen(false)}
        />
      )}

      {/* Dynamic Pop/Toast notification alert on screen */}
      {recentAlertToast && (
        <div 
          onClick={() => handleMarkNotificationRead(recentAlertToast)}
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-indigo-900 border border-indigo-950 text-white rounded-2xl p-4 shadow-2xl hover:scale-102 cursor-pointer transition-all duration-305 animate-slide-in flex items-start gap-3"
        >
          <Bell className="w-5 h-5 text-rose-400 animate-bounce flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-sans font-black text-[10px] uppercase tracking-widest text-indigo-200">{recentAlertToast.title}</h4>
            <p className="text-xs font-semibold leading-normal line-clamp-2">{recentAlertToast.body}</p>
            <span className="text-[9px] font-mono text-indigo-300 block text-right mt-1 font-bold">Tap/Klik untuk baca & obrolan! 💬</span>
          </div>
        </div>
      )}

      {/* Modern Jumbotron Header */}
      <Header 
        onOpenGlosarium={() => setGlosariumOpen(true)} 
        onRefresh={() => viewingBookmarks ? setViewingBookmarks(true) : fetchNews(activeCategory)}
        isLoading={isLoading}
      />

      {/* Main Content Arena */}
      <main className="max-w-6xl w-full mx-auto p-4 md:p-8 flex-grow space-y-6">
        
        {/* Secrets Warning Banner if Gemini API Key not set */}
        {!apiStatus.hasKey && (
          <div id="api-key-banner" className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 animate-slide-in">
            <div className="flex items-start sm:items-center gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-xs">
                <p className="font-bold">Mode Simulasi Aktif 👀</p>
                <p className="text-amber-700 font-medium">Biar fungsionalitas &ldquo;Ringkasan AI&rdquo; dan &ldquo;Bikin Gambar AI&rdquo; makin gokil pakai data beneran, pasang <span className="font-semibold text-slate-900">GEMINI_API_KEY</span> di tombol <span className="font-semibold text-slate-900">Settings &gt; Secrets</span> di bawah panel AI Studio!</p>
              </div>
            </div>
            <button
              id="dismiss-banner"
              onClick={() => setApiStatus({ hasKey: true, message: "" })}
              className="text-[10px] font-semibold text-amber-750 hover:bg-amber-100/60 bg-amber-100 px-3 py-1.5 rounded-xl self-end sm:self-auto transition"
            >
              Oke, Paham!
            </button>
          </div>
        )}

        {/* Dynamic Category Navigation Tabs & Search bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div id="category-scroller" className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none flex-grow">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`tab-${cat.id}`}
                  onClick={() => {
                    setViewingBookmarks(false);
                    setActiveCategory(cat.id);
                    setSearchQuery(""); // Clear search filter on category change
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-155 ${
                    isActive && !viewingBookmarks
                      ? "bg-blue-600 text-white shadow-md transform -translate-y-0.5"
                      : "bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-100"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive && !viewingBookmarks ? "text-white" : "text-slate-400"}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sleek Search bar */}
          <div className="relative flex-shrink-0">
            <input
              type="text"
              placeholder="Cari yang lagi rame..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 focus:border-blue-400 text-slate-700 rounded-full px-5 py-2 text-xs w-full md:w-64 focus:ring-2 focus:ring-blue-105 outline-none transition shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-2.5 text-[9px] font-bold text-slate-400 hover:text-slate-650"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Sleek Features Toolbar Bar */}
        <div id="features-toolbar" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 md:px-5 rounded-3xl border border-slate-105 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-bookmark-filter"
              onClick={() => {
                setViewingBookmarks(!viewingBookmarks);
                setSearchQuery("");
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition duration-150 ${
                viewingBookmarks 
                  ? "bg-amber-500 text-white shadow-md" 
                  : "bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-100"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${viewingBookmarks ? "text-white fill-white" : "text-amber-500"}`} />
              <span>Baca Nanti ({bookmarks.length})</span>
            </button>

            <button
              id="btn-notification-settings"
              onClick={() => setNotificationSettingsOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold transition border border-slate-105"
            >
              <Bell className="w-3.5 h-3.5 text-rose-500" />
              <span>Atur Notif ({notificationPrefs.enabled ? "Aktif ⚡" : "Nonaktif"})</span>
            </button>
          </div>

          <div className="relative">
            <button
              id="btn-alert-inbox"
              onClick={() => setShowNotificationsList(!showNotificationsList)}
              className="w-full sm:w-auto flex items-center justify-between gap-1.5 px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition border border-slate-105"
            >
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={`${notifications.filter(n => !n.isRead).length > 0 ? "animate-ping" : ""} absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span>Kotak Alerts</span>
              </div>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black rounded-full px-2 py-0.5">
                  {notifications.filter(n => !n.isRead).length} baru
                </span>
              )}
            </button>

            {/* Dropdown for list of alert notifications received */}
            {showNotificationsList && (
              <div className="absolute right-0 top-11 z-30 w-72 bg-white rounded-2xl border border-slate-100 shadow-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Notifikasi Minat Lo</span>
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleClearNotifications}
                      className="text-[9px] text-rose-500 hover:underline font-bold"
                    >
                      Hapus Semua
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 space-y-1 text-slate-400">
                      <span className="text-lg">🍉</span>
                      <p className="text-[10px]">Belum ada update baru untuk keyword favorit lo saat ini.</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => handleMarkNotificationRead(notif)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                          notif.isRead ? "bg-slate-50/50 border-slate-100" : "bg-rose-50/70 border-rose-100 hover:bg-rose-50"
                        }`}
                      >
                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">{notif.title}</p>
                        <p className="text-[11px] font-semibold text-slate-800 line-clamp-2 mt-0.5 leading-snug">{notif.body}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-1 text-right">
                          {new Date(notif.publishedAt).toLocaleTimeString("id", { hour: "numeric", minute: "numeric" })} WIB
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2-Column Responsive Split Layout (Main content on left, Sidebar on right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SECTION (Col Span 8) - Articles list, Hero banner & Loader states */}
          <div className="lg:col-span-8 space-y-8">
            {detailArticle ? (
              <DetailBerita
                article={detailArticle}
                allArticles={articles}
                isBookmarked={bookmarks.some(b => b.id === detailArticle.id)}
                onToggleBookmark={() => handleToggleBookmark(detailArticle)}
                onGoBack={navigateToHome}
                onNavigateToArticle={handleSelectArticle}
              />
            ) : isLoading ? (
              <div id="loading-state" className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                  <Sparkles className="w-6 h-6 text-blue-500 absolute top-5 left-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-sans font-bold text-slate-700 text-sm">Sedang Meracik Berita Terpopuler...</h4>
                  <p className="text-xs text-slate-400 max-w-xs font-sans">
                    AI kami lagi menyaring RSS detik & CNN terus diparafrase jadi bahasa gaul biar lo gak pusing gengs. Nyantai dulu sebentar ya! ☕
                  </p>
                </div>
              </div>
            ) : error ? (
              <div id="error-state" className="bg-red-50 border border-red-100 rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 my-10 shadow-sm">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                  <WifiOff className="w-6 h-6 text-red-500" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-sans font-bold text-red-800 text-sm">Koneksi Error, Gengs!</h4>
                  <p className="text-xs text-red-600 leading-relaxed font-sans">
                    {error}
                  </p>
                </div>
                <button
                  id="retry-fetch"
                  onClick={() => fetchNews(activeCategory, 1)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-sans text-xs font-semibold rounded-xl transition shadow"
                >
                  Coba Lagi
                </button>
              </div>
            ) : (viewingBookmarks ? bookmarks : articles).filter(art => {
              const query = searchQuery.toLowerCase();
              return !query || 
                art.catchyTitle.toLowerCase().includes(query) || 
                art.slangSummary.toLowerCase().includes(query) ||
                art.sourceName.toLowerCase().includes(query);
            }).length === 0 ? (
              <div id="empty-state" className="bg-white border border-slate-100 rounded-3xl p-20 text-center space-y-3 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-sans font-bold text-slate-600 text-sm">
                    {viewingBookmarks ? "Belum Ada Baca Nanti" : "Gak Ada Berita Baru di Kategori Ini"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs font-sans mx-auto text-center">
                    {viewingBookmarks 
                      ? "Koleksi bookmark lo masih kosong nih gengs. Klik ikon bookmark 🔖 di pojok kanan atas tiap berita biar kesimpen otomatis di sini!" 
                      : `Mungkin query "${searchQuery}" gak ketemu atau feed media partner lagi libur nih gengs. Coba pilih kategori yang lain!`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Dynamically feature the first item in the list as the Featured Hero Article */}
                {(() => {
                  const filtered = (viewingBookmarks ? bookmarks : articles).filter(art => {
                    const query = searchQuery.toLowerCase();
                    return !query || 
                      art.catchyTitle.toLowerCase().includes(query) || 
                      art.slangSummary.toLowerCase().includes(query) ||
                      art.sourceName.toLowerCase().includes(query);
                  });
                  const heroArticle = filtered[0];
                  const secondaryArticles = filtered.slice(1);
 
                  return (
                    <>
                      {heroArticle && (
                        <div className="relative group rounded-3xl overflow-hidden bg-slate-200 h-[380px] shadow-lg flex-shrink-0">
                          <img 
                            src={heroArticle.imageUrl} 
                            alt={heroArticle.catchyTitle} 
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 cursor-pointer"
                            onClick={() => handleSelectArticle(heroArticle)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1000&q=80";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent flex flex-col justify-end p-6 md:p-8">
                            
                            {/* Bookmark Ribbon on top right for Hero Card */}
                            <div className="absolute top-4 right-4 z-25">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleToggleBookmark(heroArticle);
                                }}
                                className="p-2.5 rounded-full bg-slate-950/75 backdrop-blur-md text-white border border-white/10 hover:bg-slate-950 hover:scale-110 active:scale-95 transition-all shadow-lg pointer-events-auto"
                                title={bookmarks.some(b => b.id === heroArticle.id) ? "Hapus dari Baca Nanti" : "Simpan untuk Baca Nanti"}
                              >
                                <Bookmark className={`w-3.5 h-3.5 ${bookmarks.some(b => b.id === heroArticle.id) ? "text-yellow-400 fill-yellow-400" : "text-white"}`} />
                              </button>
                            </div>
 
                            <div className="flex gap-2 mb-3">
                              <span className="bg-blue-600 text-white text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full w-fit">
                                TERPOPULER 🔥
                              </span>
                              <span className="bg-slate-900/60 backdrop-blur text-blue-200 text-[10px] font-mono px-2.5 py-1 rounded-full w-fit">
                                {heroArticle.sourceName}
                              </span>
                            </div>
                            
                            <h2 
                              onClick={() => handleSelectArticle(heroArticle)}
                              className="text-xl md:text-2xl font-black text-white mb-2 leading-tight tracking-tight cursor-pointer hover:underline"
                            >
                              {heroArticle.catchyTitle}
                            </h2>
                            
                            <p className="text-slate-200 text-xs md:text-sm line-clamp-2 mb-4 leading-relaxed max-w-2xl font-sans">
                              {heroArticle.slangSummary}
                            </p>
                            
                            <div className="flex items-center justify-between border-t border-white/10 pt-4 flex-wrap gap-2">
                              <span className="text-slate-400 text-[11px] font-mono">
                                Tagline: &ldquo;{heroArticle.tagline}&rdquo;
                              </span>
 
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSelectArticle(heroArticle)}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition active:scale-95 shadow"
                                >
                                  Baca Detail Gaul ⚡️
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveDiscussionArticle(heroArticle);
                                  }}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition active:scale-95 flex items-center gap-1.5 shadow"
                                >
                                  Diskusi ({commentCounts[heroArticle.id] || 0})
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
 
                      {/* Secondary Articles rendered as beautiful bento cards */}
                      {secondaryArticles.length > 0 && (
                        <div id="news-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {secondaryArticles.map((article) => (
                            <NewsCard
                              key={article.id}
                              article={article}
                              onGenerateAiImage={handleGenerateAiImage}
                              isGeneratingImage={generatingStates[article.id] || false}
                              isBookmarked={bookmarks.some(b => b.id === article.id)}
                              onToggleBookmark={() => handleToggleBookmark(article)}
                              onOpenDiscussion={() => setActiveDiscussionArticle(article)}
                              commentCount={commentCounts[article.id] || 0}
                              onViewDetail={() => handleSelectArticle(article)}
                            />
                          ))}
                        </div>
                      )}
 
                      {/* Observer Target element at the bottom of listings for infinite scrolling */}
                      {!viewingBookmarks && hasMore && (
                        <div 
                          ref={observerTargetRef} 
                          className="flex items-center justify-center p-6 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50"
                        >
                          {isFetchingMore ? (
                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 animate-pulse">
                              <Sparkles className="w-4 h-4 animate-spin text-blue-500" />
                              <span>Sedang meracik hidangan berita gokil berikutnya... ✨</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Scroll terus ke bawah buat asupan berita gaul tiada batas! 🤙</span>
                          )}
                        </div>
                      )}

                      {!viewingBookmarks && !hasMore && (
                        <div className="p-8 text-center bg-slate-100/50 rounded-3xl border border-slate-150">
                          <p className="text-xs text-slate-500 font-bold">Waduh! Lo udah tamatin semua berita kategori ini gengs! Mampirin kategori lain ya! 🎉😎</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR SECTION (Col Span 4) - Trending, Rangkum Sendiri form */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Interactive Trending Topik Widget exactly from the theme HTML */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-sans font-black text-slate-800 text-base tracking-tight flex items-center gap-2">
                  <span>Trending Sosmed</span>
                  <span className="text-xs">🔥</span>
                </h2>
                <span className="text-[10px] font-bold text-blue-600 select-none">AKTIF</span>
              </div>
              
              <div className="space-y-4">
                {[
                  { tag: "SoraAIRevolution", count: "124rb Postingan", tagQuery: "AI" },
                  { tag: "AppleVisionProIndo", count: "89rb Postingan", tagQuery: "Apple" },
                  { tag: "TimnasDay", count: "56rb Postingan", tagQuery: "Timnas" },
                  { tag: "RamadhanVibes", count: "42rb Postingan", tagQuery: "Ramadhan" },
                ].map((item, idx) => (
                  <button
                    key={item.tag}
                    onClick={() => setSearchQuery(item.tagQuery)}
                    className="w-full flex items-start gap-4 text-left group p-1.5 hover:bg-slate-50 rounded-2xl transition"
                  >
                    <div className="text-lg font-black text-slate-200 group-hover:text-blue-500 transition-colors w-6">
                      0{idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-800 group-hover:text-blue-600 transition-colors">
                        #{item.tag}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.count}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* "Rangkum Sendiri" Interactive CTA box from the theme HTML */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mb-4 text-lg">
                ✨
              </div>
              
              <h3 className="font-sans font-bold text-base mb-1.5">Rangkum Sendiri?</h3>
              <p className="text-white/80 text-[11px] mb-4 leading-relaxed font-sans">
                Ketik nama topik / link berita apa saja, kecerdasan buatan KilasSantai bakal bikinin ringkasan asik instan buat lo!
              </p>

              <form onSubmit={handleCustomSummarize} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Misal: Cristiano Ronaldo, Harga Tempe..."
                  className="w-full bg-white/10 placeholder:text-white/50 text-white rounded-xl py-2 px-3.5 text-xs focus:ring-2 focus:ring-white/40 border-none outline-none font-sans"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={customLoading}
                  className="w-full py-2.5 bg-white text-blue-700 hover:bg-slate-50 disabled:opacity-50 active:scale-98 rounded-xl font-bold text-xs transition shadow-lg shadow-blue-900/20"
                >
                  {customLoading ? "Merangkum..." : "Coba Sekarang"}
                </button>
              </form>

              {showCustomSuccess && (
                <p className="text-[10px] text-emerald-300 font-sans mt-3 text-center animate-pulse">
                  ✓ Berhasil disintesis! Cek bagian teratas berita sekarang!
                </p>
              )}
            </div>

          </div>
        </div>

      </main>

      {/* Styled Footer Block */}
      <footer className="bg-slate-900 border-t border-slate-800 py-10 mt-16 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left text-slate-400 text-xs">
          <div className="space-y-1.5">
            <p className="font-sans font-bold text-white text-sm">Kilas Berita Gaul</p>
            <p className="font-sans text-slate-500 text-[11px]">
              &copy; 2026. Seluruh ringkasan berita diringkas secara asik & diparafrase otomatis oleh teknologi Gemini AI. Hak cipta berita asli milik masing-masing media partner (Detik, CNN Indonesia, CNBC, Tempo).
            </p>
          </div>
          
          <div className="flex gap-4">
            <button 
              id="footer-kamus"
              onClick={() => setGlosariumOpen(true)}
              className="hover:text-blue-400 transition underline decoration-dotted font-medium"
            >
              kamus slang gaul
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-[10px] font-mono select-none px-2 py-0.5 rounded-md bg-slate-850 text-blue-400">
              API Version: v3.5
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
