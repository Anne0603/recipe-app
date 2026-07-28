/* ==========================================================
   search.js — 對應需求文件「07｜搜尋」
   ----------------------------------------------------------
   搜尋範圍：自己的私人食譜 + 全部人的公開食譜（跟抽籤「全部」
   來源同一套邏輯，去重）。
   搜尋欄位：菜名、標籤、食材名稱。
   排序：預設「最符合關鍵字」（用簡單的加權分數，不是真的全文
   搜尋引擎，畢竟資料量小，這樣夠用），可切換成「熱門」。
   ========================================================== */

import { listMyOwnRecipes, listPublicRecipes } from "./recipes.js";

export const TIME_FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "under30", label: "30 分鐘以內" },
  { value: "30to60", label: "30～60 分鐘" },
  { value: "over60", label: "60 分鐘以上" },
];

function matchesTime(recipe, time) {
  if (!time || time === "all") return true;
  const minutes = recipe.cookTimeMinutes;
  if (minutes == null) return false;
  if (time === "under30") return minutes <= 30;
  if (time === "30to60") return minutes > 30 && minutes <= 60;
  if (time === "over60") return minutes > 60;
  return true;
}

/** 我看得到的全部食譜：我自己的（不分公私）＋ 全部人公開的，去重 */
async function fetchSearchableRecipes(uid) {
  const [mine, pub] = await Promise.all([listMyOwnRecipes(uid), listPublicRecipes({})]);
  const map = new Map();
  [...mine, ...pub].forEach((r) => map.set(r.id, r));
  return [...map.values()];
}

/** 這道食譜跟關鍵字的符合分數：菜名 > 標籤 > 食材，分數越高排越前面 */
function relevanceScore(recipe, keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return 0;

  let score = 0;
  const name = (recipe.name || "").toLowerCase();
  if (name === q) score += 20;
  else if (name.includes(q)) score += 10;

  const tags = (recipe.tags || []).map((t) => (t || "").toLowerCase());
  if (tags.some((t) => t.includes(q))) score += 5;

  const ingredientNames = (recipe.ingredients || []).map((i) => (i.name || "").toLowerCase());
  if (ingredientNames.some((n) => n.includes(q))) score += 3;

  return score;
}

/**
 * 搜尋食譜
 * @param {string} uid
 * @param {{keyword:string, style?:string|null, time?:string, sort?:'relevance'|'hot'}} options
 */
export async function searchRecipes(uid, { keyword, style = null, time = "all", sort = "relevance" }) {
  const all = await fetchSearchableRecipes(uid);
  const q = (keyword || "").trim();

  let matched = all
    .map((r) => ({ recipe: r, score: relevanceScore(r, q) }))
    .filter(({ score }) => (q ? score > 0 : true));

  if (style) matched = matched.filter(({ recipe }) => (recipe.styles || []).includes(style));
  matched = matched.filter(({ recipe }) => matchesTime(recipe, time));

  if (sort === "hot") {
    matched.sort((a, b) => (b.recipe.popularityScore || 0) - (a.recipe.popularityScore || 0));
  } else {
    matched.sort((a, b) => b.score - a.score);
  }

  return matched.map(({ recipe }) => recipe);
}
