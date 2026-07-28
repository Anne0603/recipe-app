/* ==========================================================
   weekly-summary.js — 每週結算（屬於帳號系統）
   ----------------------------------------------------------
   跟你討論過的範圍：這次只做「算數字、存歷史」這部分，不做
   Discord 通知（等通知系統做好再一起接），所以現在完全沒有
   畫面會顯示這些數字，是純後端邏輯，先打底。

   ⚠️ 誠實說明一個資料限制：
   文件裡「有異動通知」15 句範本，其中「這週被存了 X 次」
   「這週挑戰完成率 X%」「留言獲得 X 個讚」這幾項，需要「事件
   發生的時間點」才能回推算出「這一週內」發生了幾次——但目前
   愛心、留言按讚、挑戰完成都只存「目前的狀態」（例如 likedBy
   清單），沒有存「每一次按讚/完成的時間戳記」。
   這裡先只算「這週煮了幾道菜」「這週新增了幾道食譜」這兩項
   （日記的 date、食譜的 createdAt 本來就有存，可以準確回推），
   其他項目要等之後幫按讚/留言/挑戰完成也加上事件時間戳記
   （event log）才能準確算，不在這裡編假數字充數。

   純前端定時任務的做法：使用者資料存「上次算到哪一週」
   （lastSummarizedWeekStart），有人開 APP 時（登入成功後）
   補算還沒算的週，一次最多補 12 週，避免第一次上線時要
   补算太多週卡住。
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";
import { listMyDiaryEntries } from "./diary.js";
import { listMyOwnRecipes } from "./recipes.js";

const COLLECTION = "weeklySummaries";
const MAX_CATCHUP_WEEKS = 12;

function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** 該日期所在那週的星期一（週一為一週開始） */
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=日 1=一 ... 6=六
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}
function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDateStr(date);
}
function toDateStrFromTimestamp(ts) {
  if (!ts) return null;
  const millis = typeof ts.toMillis === "function" ? ts.toMillis() : ts.seconds ? ts.seconds * 1000 : null;
  if (!millis) return null;
  return formatDateStr(new Date(millis));
}

/** 算某使用者在某週（含頭尾）的統計數字。只算得準「煮了幾次」「新增幾道食譜」 */
async function computeWeekStats(uid, weekStart, weekEnd) {
  const [entries, recipes] = await Promise.all([listMyDiaryEntries(uid), listMyOwnRecipes(uid)]);

  const cookCount = entries.filter((e) => e.date && e.date >= weekStart && e.date <= weekEnd).length;

  const newRecipeCount = recipes.filter((r) => {
    const d = toDateStrFromTimestamp(r.createdAt);
    return d && d >= weekStart && d <= weekEnd;
  }).length;

  return { cookCount, newRecipeCount };
}

async function weeklySummaryExists(uid, weekStart) {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("userId", "==", uid), where("weekStart", "==", weekStart));
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * 有人開 APP、登入成功時呼叫：補算還沒算過的「已完整結束」的週。
 * 本週還在進行中，不會被算（只算到上週為止）。
 */
export async function catchUpWeeklySummaries(uid) {
  const db = getDbInstance();
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  const lastSummarizedWeekStart = userSnap.exists() ? userSnap.data().lastSummarizedWeekStart : null;

  const thisMonday = formatDateStr(getMonday(new Date()));
  const lastCompletedWeekStart = addDaysStr(thisMonday, -7); // 上一個「已經完整結束」的週一

  let cursor = lastSummarizedWeekStart ? addDaysStr(lastSummarizedWeekStart, 7) : lastCompletedWeekStart;
  let processed = 0;
  let lastDone = lastSummarizedWeekStart;

  while (cursor <= lastCompletedWeekStart && processed < MAX_CATCHUP_WEEKS) {
    const weekEnd = addDaysStr(cursor, 6);

    const already = await weeklySummaryExists(uid, cursor);
    if (!already) {
      const stats = await computeWeekStats(uid, cursor, weekEnd);
      await addDoc(collection(db, COLLECTION), {
        userId: uid,
        weekStart: cursor,
        weekEnd,
        ...stats,
        createdAt: serverTimestamp(),
      });
    }

    lastDone = cursor;
    cursor = addDaysStr(cursor, 7);
    processed++;
  }

  if (lastDone && lastDone !== lastSummarizedWeekStart) {
    await setDoc(userRef, { lastSummarizedWeekStart: lastDone }, { merge: true });
  }
}
