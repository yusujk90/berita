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
