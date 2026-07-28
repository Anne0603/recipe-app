/* ==========================================================
   challenges.js — 挑戰系統（屬於帳號系統）
   ----------------------------------------------------------
   範圍說明（跟文件的差異，先講清楚）：
   文件寫「新增挑戰時選擇完成判斷方式：可自動判斷（新增特定風格
   食譜、這週煮幾道菜、分享食譜、連續登入、使用特定食材）／
   無法自動判斷（手動確認或管理員審核）」。

   「可自動判斷」那 5 種類型的自動偵測邏輯還沒做，之後有需要再
   回來加。「無法自動判斷」那兩種模式（手動確認／管理員審核）
   這次都做了——管理員發布挑戰時自己選這個挑戰要哪一種：
     - self：成員自己標記完成，立刻計入徽章（信任制，跟你們熟識
       的朋友圈比較搭）
     - admin_review：成員「提交完成」後變成待審核，管理員在挑戰
       管理頁核准/拒絕，核准後才計入徽章

   集合：challenges/{challengeId}
     title, description, deadline（YYYY-MM-DD，必填，到期自動結束）,
     verificationMode（'self' | 'admin_review'）,
     createdBy, createdAt, active,
     completedBy[]（真的算完成的人）,
     pendingReview[]（admin_review 模式下，提交了但還沒被核准的人）

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

/** 管理員發布新挑戰，deadline 是 "YYYY-MM-DD"，verificationMode 是 'self' 或 'admin_review' */
export async function createChallenge(title, description, deadline, verificationMode, createdBy) {
  const db = getDbInstance();
  const ref = await addDoc(collection(db, COLLECTION), {
    title,
    description: description || "",
    deadline,
    verificationMode: verificationMode === "admin_review" ? "admin_review" : "self",
    createdBy,
    active: true,
    completedBy: [],
    pendingReview: [],
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

/**
 * 成員標記自己完成這個挑戰。
 * verificationMode === 'self' → 立刻算完成、計入徽章
 * verificationMode === 'admin_review' → 進入待審核，還不算完成、不計徽章
 */
export async function markChallengeComplete(challengeId, uid) {
  const db = getDbInstance();
  const ref = doc(db, COLLECTION, challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這個挑戰");

  const data = snap.data();
  const completedBy = data.completedBy || [];
  if (completedBy.includes(uid)) return "already_done";

  if (data.verificationMode === "admin_review") {
    const pendingReview = data.pendingReview || [];
    if (pendingReview.includes(uid)) return "already_pending";
    await updateDoc(ref, { pendingReview: [...pendingReview, uid] });
    return "pending";
  }

  await updateDoc(ref, { completedBy: [...completedBy, uid] });
  await incrementBadgeCounter(uid, "challenge");
  return "done";
}

/** 管理員核准一筆待審核的完成提交，這時候才真的計入徽章 */
export async function approveChallengeCompletion(challengeId, uid) {
  const db = getDbInstance();
  const ref = doc(db, COLLECTION, challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這個挑戰");

  const data = snap.data();
  const pendingReview = (data.pendingReview || []).filter((id) => id !== uid);
  const completedBy = data.completedBy || [];
  if (!completedBy.includes(uid)) completedBy.push(uid);

  await updateDoc(ref, { pendingReview, completedBy });
  await incrementBadgeCounter(uid, "challenge");
}

/** 管理員拒絕一筆待審核的完成提交，不計徽章 */
export async function rejectChallengeCompletion(challengeId, uid) {
  const db = getDbInstance();
  const ref = doc(db, COLLECTION, challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這個挑戰");

  const pendingReview = (snap.data().pendingReview || []).filter((id) => id !== uid);
  await updateDoc(ref, { pendingReview });
}
