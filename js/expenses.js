/* ==========================================================
   expenses.js — 對應需求文件「16｜花費記錄」
   ----------------------------------------------------------
   純個人記帳＋菜價追蹤，不做跨使用者共享，只能讀寫自己的。

   欄位：食材名稱、價格、數量＋單位、日期（預設今天可改）、
   地點（選填）、記錄者=自己、建立時間。

   平均與趨勢依「食材＋單位」分組計算，不同單位不混算
   （豆腐/盒、豆腐/公斤 各自算各自的）。

   範圍說明：文件裡「顯示是否為當季食材」需要串接
   18｜季節食材提醒 的資料，那個還沒做，這裡先不做這塊，
   等 18 做完再回來接，不編假資料充數。
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";

const COLLECTION = "expenses";

export const EXPENSE_UNIT_SUGGESTIONS = ["盒", "板", "斤", "公斤", "克", "條", "顆", "把", "包", "袋", "份"];

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 新增一筆花費記錄 */
export async function createExpense(uid, { ingredientName, price, quantity, unit, date, location }) {
  const db = getDbInstance();
  const ref = await addDoc(collection(db, COLLECTION), {
    userId: uid,
    ingredientName: ingredientName.trim(),
    price: Number(price),
    quantity: Number(quantity) || 1,
    unit: (unit || "").trim(),
    date: date || todayStr(),
    location: (location || "").trim(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** 我全部的花費記錄（單一條件查詢，前端自己排序/篩選/分組） */
export async function listMyExpenses(uid) {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("userId", "==", uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.date || "").localeCompare(a.date || "") || toMillis(b.createdAt) - toMillis(a.createdAt));
}

export async function deleteExpense(expenseId) {
  const db = getDbInstance();
  await deleteDoc(doc(db, COLLECTION, expenseId));
}

/**
 * 記錄同食材時自動帶入上次的名稱、單位，減少重複輸入。
 * 用「已經存在的記錄」裡，名稱最像的那筆（完全比對，忽略大小寫/前後空白）。
 */
export function findLastEntryForName(entries, name) {
  const q = (name || "").trim().toLowerCase();
  if (!q) return null;
  const matched = entries.filter((e) => (e.ingredientName || "").trim().toLowerCase() === q);
  if (matched.length === 0) return null;
  return matched.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0];
}

/**
 * 依「食材＋單位」分組，算平均價格跟簡單趨勢（最新一筆 vs 該組最早一筆比較，
 * 抓「跟以前比是漲是跌」的感覺，不是嚴謹的統計模型）。
 */
export function groupExpensesByIngredient(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = `${(e.ingredientName || "").trim()}｜${(e.unit || "").trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  return [...groups.entries()].map(([key, list]) => {
    const sorted = list.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const avg = sorted.reduce((sum, e) => sum + (e.price || 0), 0) / sorted.length;
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];
    let trend = "flat";
    if (sorted.length > 1) {
      if (latest.price > earliest.price * 1.05) trend = "up";
      else if (latest.price < earliest.price * 0.95) trend = "down";
    }
    return {
      ingredientName: latest.ingredientName,
      unit: latest.unit,
      count: sorted.length,
      avg,
      latestPrice: latest.price,
      latestDate: latest.date,
      trend,
      entries: sorted,
    };
  });
}
