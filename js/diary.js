/* ==========================================================
   diary.js — 對應需求文件「17｜料理日記」
   ----------------------------------------------------------
   Firestore 存取邏輯。集合：diaryEntries/{entryId}
   欄位對應「📦 資料結構定案 > 料理日記（DiaryEntry，一道菜一筆）」：
     userId, date（YYYY-MM-DD 字串，可補記手動選）,
     meal（breakfast/lunch/dinner）, inputType（recipe/freeform）,
     recipeId／name／servings（依 inputType 不同）, createdAt

   輸入方式目前只做兩種：從食譜選、自由輸入名稱。
   「從食材資料庫選」需要 14｜營養計算 的食材資料庫，還沒做，
   先不出現在畫面上，等 14 做完再回來加這個輸入方式
   （介面設計已經用 inputType 這個欄位留好位置，到時候加
   inputType === "ingredient" 的分支即可，不用改資料結構）。

   查詢只用單一條件（userId == uid），不加 orderBy／第二個 where，
   避免任何複合索引需求，資料量小前端自己排序/篩選就好（延續
   食譜功能那次的做法）。
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";
import { incrementDiaryUsage } from "./recipes.js";
import { getAppSettings } from "./app-settings.js";

const COLLECTION = "diaryEntries";

export const MEAL_OPTIONS = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
];

function mealLabel(v) {
  return MEAL_OPTIONS.find((m) => m.value === v)?.label || v;
}

/**
 * 新增一筆日記
 * @param {string} uid
 * @param {{date:string, meal:string, inputType:'recipe'|'freeform', recipeId?:string, name:string, servings?:number}} entry
 */
export async function createDiaryEntry(uid, entry) {
  const db = getDbInstance();
  const payload = {
    userId: uid,
    date: entry.date, // "YYYY-MM-DD"
    meal: entry.meal,
    inputType: entry.inputType,
    name: entry.name, // 從食譜選時＝當時的食譜名稱快照；自由輸入時＝輸入的名稱
    servings: entry.servings ?? null,
    recipeId: entry.inputType === "recipe" ? entry.recipeId : null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);

  // 只有「從食譜選」才計入熱門排序（文件明確規定）
  if (entry.inputType === "recipe" && entry.recipeId) {
    await incrementDiaryUsage(entry.recipeId);
  }

  return ref.id;
}

/** 我全部的日記（單一條件查詢，前端自己依月份/日期篩選） */
export async function listMyDiaryEntries(uid) {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 刪除一筆日記（徽章累計數不跟著減，是歷史成就；這裡只負責刪資料本身） */
export async function deleteDiaryEntry(entryId) {
  const db = getDbInstance();
  await deleteDoc(doc(db, COLLECTION, entryId));
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthsAgoDateStr(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 純前端定時任務：有人開 APP 時檢查、清掉超過保留期限的舊日記。
 * 每次最多清一小批（50 筆），分次清完，避免一次刪太多卡住。
 * 只清「目前登入者自己」的日記（日記本來就是私人的，其他人的之後
 * 換他自己開 APP 時會清自己的）。
 */
export async function cleanupExpiredEntries(uid) {
  const settings = await getAppSettings();
  const retentionMonths = settings.diaryRetentionMonths || 18;
  const cutoff = monthsAgoDateStr(retentionMonths);

  const all = await listMyDiaryEntries(uid);
  const expired = all.filter((e) => e.date && e.date < cutoff).slice(0, 50);

  for (const entry of expired) {
    await deleteDiaryEntry(entry.id);
  }
  return expired.length;
}

export { mealLabel, todayDateStr };
