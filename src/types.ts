export interface SummarizedArticle {
  id: string;
  sourceTitle: string; // Original title
  sourceUrl: string; // Original link
  sourceName: string; // e.g. Detik News, CNN Indonesia
  publishedAt: string;
  originalDescription: string;
  
  // AI Generated / Slangified
  catchyTitle: string;
  slangSummary: string;
  tagline: string;
  category: string;
  keywords: string[];
  imageUrl: string;
  isAiImage: boolean;

  // Smart Recommendation Engine attributes
  matchPercentage?: number;
  recommendationReason?: string;
  recommendationBadge?: string;
}

export interface NewsResponse {
  category: string;
  articles: SummarizedArticle[];
}

export interface ArticleComment {
  id: string;
  articleId: string;
  username: string;
  text: string;
  publishedAt: string;
  votes: number; // Positive/negative sum of upvotes/downvotes
  userVoted?: "up" | "down" | null;
}

export interface NotificationPreferences {
  enabled: boolean;
  categories: string[];
  keywords: string[];
  frequency: "instan" | "harian" | "mingguan";
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  articleId: string;
  publishedAt: string;
  isRead: boolean;
}

export interface UserReadingHistory {
  viewedArticleIds: string[];
  categoryCounts: Record<string, number>;
  keywordCounts: Record<string, number>;
  lastActive: string;
}