/* ==========================================================
   challenges.js — 挑戰系統（屬於帳號系統）
   ----------------------------------------------------------
   範圍說明（跟文件的差異，先講清楚）：
   文件寫「新增挑戰時選擇完成判斷方式：可自動判斷（新增特定風格
   食譜、這週煮幾道菜、分享食譜、連續登入、使用特定食材）／
   無法自動判斷（手動確認或管理員審核）」。

   這次先只做「手動完成」這一種模式——管理員發布挑戰、成員自己
   按「完成挑戰」標記——文件裡「無法自動判斷」的類型本來就是走
   這條路。「可自動判斷」那 5 種類型的自動偵測邏輯還沒做，
   之後有需要再回來加，資料結構已經留了 criterionType 欄位，
   不用重改。

   集合：challenges/{challengeId}
     title, description, deadline（YYYY-MM-DD，必填，到期自動結束）,
     createdBy, createdAt, active, completedBy[]

   到期自動結束：純前端定時任務的做法，跟日記自動清除、每週結算
   補算同一套邏輯——有人開 APP 時（登入成功後）檢查一次，
   把「還是 active 但 deadline 已過」的挑戰關掉，不用管理員手動按。
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";
import { incrementBadgeCounter } from "./badges.js";

const COLLECTION = "challenges";

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

/** 管理員發布新挑戰，deadline 是 "YYYY-MM-DD"，必填 */
export async function createChallenge(title, description, deadline, createdBy) {
  const db = getDbInstance();
  const ref = await addDoc(collection(db, COLLECTION), {
    title,
    description: description || "",
    deadline,
    createdBy,
    active: true,
    completedBy: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** 所有挑戰（單一條件都不用，直接抓全部，資料量小），前端自己分「進行中／已結束」並排序 */
export async function listAllChallenges() {
  const db = getDbInstance();
  const snap = await getDocs(collection(db, COLLECTION));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return all.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

export async function listActiveChallenges() {
  const all = await listAllChallenges();
  return all.filter((c) => c.active);
}

export async function listEndedChallenges() {
  const all = await listAllChallenges();
  return all.filter((c) => !c.active);
}

/** 首頁「本週挑戰」用：目前唯一顯示中的挑戰（取最新一個進行中的） */
export async function getCurrentChallenge() {
  const active = await listActiveChallenges();
  return active[0] || null;
}

/** 管理員手動提早結束一個挑戰 */
export async function endChallenge(challengeId) {
  const db = getDbInstance();
  await updateDoc(doc(db, COLLECTION, challengeId), { active: false });
}

/**
 * 有人開 APP、登入成功時呼叫：檢查有沒有「還是 active 但 deadline 已過」的挑戰，
 * 過期的自動關掉，不用管理員手動按。
 */
export async function autoExpireChallenges() {
  const active = await listActiveChallenges();
  const today = todayStr();
  const expired = active.filter((c) => c.deadline && c.deadline < today);
  for (const c of expired) {
    await endChallenge(c.id);
  }
  return expired.length;
}

/** 成員標記自己完成這個挑戰，計入「挑戰」徽章（同一人對同一挑戰只會算一次） */
export async function markChallengeComplete(challengeId, uid) {
  const db = getDbInstance();
  const ref = doc(db, COLLECTION, challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這個挑戰");

  const completedBy = snap.data().completedBy || [];
  if (completedBy.includes(uid)) return; // 已經標記過，不重複算

  await updateDoc(ref, { completedBy: [...completedBy, uid] });
  await incrementBadgeCounter(uid, "challenge");
}
