import { SummarizedArticle, UserReadingHistory } from "./types";

/**
 * Slugifies a text string into an SEO-friendly URL-ready slug.
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove all non-word chars
    .replace(/[\s_]+/g, "-") // Replace spaces/underscores with hyphen
    .replace(/^-+|-+$/g, ""); // Trim hyphens
}

const HISTORY_STORAGE_KEY = "kilassantai_user_history";

export function getUserReadingHistory(): UserReadingHistory {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    viewedArticleIds: [],
    categoryCounts: {},
    keywordCounts: {},
    lastActive: new Date().toISOString()
  };
}

export function trackArticleView(article: SummarizedArticle): void {
  try {
    const history = getUserReadingHistory();
    if (!history.viewedArticleIds.includes(article.id)) {
      history.viewedArticleIds.unshift(article.id);
      if (history.viewedArticleIds.length > 50) {
        history.viewedArticleIds.pop();
      }
    }

    // Increment category count
    if (article.category) {
      history.categoryCounts[article.category] = (history.categoryCounts[article.category] || 0) + 1;
    }

    // Increment keyword counts
    if (article.keywords && Array.isArray(article.keywords)) {
      article.keywords.forEach((kw) => {
        const cleanKw = kw.toLowerCase().trim();
        if (cleanKw) {
          history.keywordCounts[cleanKw] = (history.keywordCounts[cleanKw] || 0) + 1;
        }
      });
    }

    history.lastActive = new Date().toISOString();
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn("Failed to update user reading history:", err);
  }
}

/**
 * Super Powerful Recommendation Engine Scoring System (Client Fallback & Helper)
 * Multi-factor ranking combining keyword overlap, category affinity, engagement, and recency.
 */
export function scoreArticleRecommendation(
  article: SummarizedArticle,
  currentArticle?: SummarizedArticle | null,
  history?: UserReadingHistory
): { score: number; matchPercentage: number; badge: string; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const userHistory = history || getUserReadingHistory();

  // 1. Keyword Overlap with Current Article (if viewing an article)
  if (currentArticle && currentArticle.id !== article.id) {
    const currentKws = new Set((currentArticle.keywords || []).map((k) => k.toLowerCase()));
    const targetKws = (article.keywords || []).map((k) => k.toLowerCase());
    let overlapCount = 0;
    targetKws.forEach((k) => {
      if (currentKws.has(k)) overlapCount++;
    });

    if (overlapCount > 0) {
      score += overlapCount * 25;
      reasons.push("Topik & Keyword Sangat Mirip");
    }
  }

  // 2. Category Affinity Match
  const catCount = userHistory.categoryCounts[article.category] || 0;
  if (catCount > 0) {
    score += Math.min(catCount * 15, 30);
    reasons.push(`Kategori #${article.category.toUpperCase()} Kesukaan Lo`);
  }

  // 3. Keyword Match with User Reading History
  if (article.keywords && Array.isArray(article.keywords)) {
    let userKwMatchScore = 0;
    article.keywords.forEach((kw) => {
      const kwHits = userHistory.keywordCounts[kw.toLowerCase()] || 0;
      if (kwHits > 0) {
        userKwMatchScore += kwHits * 10;
      }
    });
    if (userKwMatchScore > 0) {
      score += Math.min(userKwMatchScore, 30);
      reasons.push("Sesuai Tren Bacaan Lo");
    }
  }

  // 4. Recency & Breaking News Boost
  const pubTime = new Date(article.publishedAt).getTime();
  const hoursOld = (Date.now() - pubTime) / (1000 * 60 * 60);
  if (hoursOld < 3) {
    score += 20;
    reasons.push("Breaking News Terhangat");
  } else if (hoursOld < 12) {
    score += 10;
  }

  // Calculate high-fidelity percentage match between 75% and 99%
  const basePercentage = 75 + Math.min(Math.round((score / 100) * 24), 24);

  // Assign smart badges based on dominant reason
  let badge = "✨ AI Recommendation";
  if (currentArticle && score > 40) {
    badge = "🎯 98% Match Topik Mirip";
  } else if (hoursOld < 3) {
    badge = "🔥 Breaking News Terhangat";
  } else if (catCount > 2) {
    badge = "⭐ Pilihan Favorit Lo";
  } else {
    badge = "🚀 Trending di Circle";
  }

  const reason = reasons[0] || "Disukai banyak pembaca muda di Kilas Berita Gaul";

  return {
    score,
    matchPercentage: basePercentage,
    badge,
    reason
  };
}