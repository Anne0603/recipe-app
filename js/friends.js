/* ==========================================================
   friends.js — 對應需求文件「20｜朋友系統」
   ----------------------------------------------------------
   不需要追蹤/私訊，預設全部人都是朋友，這裡只是「成員列表＋
   個人頁面」的資料存取。

   排序規則（文件明確定義）：
   - 有公開食譜的人：依「最近一次發布公開食譜的時間」排序，最新的在前
   - 沒有公開食譜的人：依「加入時間」排序

   查詢只用單一條件（status == "active"），延續食譜/日記那幾次
   的做法，避免複合索引需求，前端自己排序。

   徽章（badges）還沒做，個人頁面那塊先顯示「尚未實作」，不做假資料。
   ========================================================== */

import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";
import { listPublicRecipes, listMyOwnRecipes } from "./recipes.js";

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

/** 停用帳號從成員列表移除，所以只查 status == "active" */
async function fetchActiveMembers() {
  const db = getDbInstance();
  const q = query(collection(db, "users"), where("status", "==", "active"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * 成員列表，依規則排序：
 * 有公開食譜的人在前（依最近發布時間新到舊），沒有的人在後（依加入時間舊到新）
 */
export async function listMembersForFriendsPage() {
  const [members, publicRecipes] = await Promise.all([fetchActiveMembers(), listPublicRecipes({})]);

  const latestByOwner = new Map();
  for (const r of publicRecipes) {
    const t = toMillis(r.createdAt);
    if (!latestByOwner.has(r.ownerId) || t > latestByOwner.get(r.ownerId)) {
      latestByOwner.set(r.ownerId, t);
    }
  }

  const withActivity = [];
  const withoutActivity = [];
  for (const m of members) {
    if (latestByOwner.has(m.uid)) {
      withActivity.push({ ...m, lastActiveAt: latestByOwner.get(m.uid) });
    } else {
      withoutActivity.push(m);
    }
  }

  withActivity.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  withoutActivity.sort((a, b) => toMillis(a.joinedAt) - toMillis(b.joinedAt));

  return [...withActivity, ...withoutActivity];
}

/**
 * 個人頁面統計：公開食譜數量、被愛心總次數
 * （從這個人自己新增的食譜裡，篩公開的來算）
 */
export async function getMemberStats(uid) {
  const ownRecipes = await listMyOwnRecipes(uid);
  const publicOnes = ownRecipes.filter((r) => r.isPublic);
  const totalHearts = publicOnes.reduce((sum, r) => sum + (r.likedBy || []).length, 0);
  return {
    publicRecipeCount: publicOnes.length,
    totalHearts,
    publicRecipes: publicOnes,
  };
}
