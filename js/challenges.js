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
import { createNotificationForAllMembers, createNotificationForAdmins, createNotification } from "./notifications.js";
import { listMyDiaryEntries } from "./diary.js";
import { listMyOwnRecipes } from "./recipes.js";
import { getMemberById } from "./auth.js";

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
function toDateStrFromTimestamp(ts) {
  const millis = toMillis(ts);
  if (!millis) return null;
  const d = new Date(millis);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateStrToEndOfDayMillis(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export const CRITERION_TYPES = [
  { value: "manual", label: "手動（自行標記或審核）", group: "一般" },
  { value: "loginStreak", label: "連續登入幾天", group: "系統" },
  { value: "diaryDays", label: "記錄幾天的日記（不同天數）", group: "系統" },
  { value: "diaryMeals", label: "記錄幾餐的日記（次數）", group: "系統" },
  { value: "recipeCount", label: "發布幾道食譜", group: "食譜" },
  { value: "recipeStyleCount", label: "發布特定風格的食譜幾道", group: "食譜" },
];

/**
 * 管理員發布新挑戰。
 * criterionType 不是 'manual' 時，代表這是「自動判斷」挑戰：達標後不會直接
 * 完成，而是自動送進「待審核」（跟手動提交審核走同一套機制），管理員核准
 * 後才算數、才計入徽章——這是因為自動判斷邏輯有可能誤判，讓管理員把關。
 * 這種情況下 verificationMode 一律當作 admin_review，畫面上不會再讓使用者
 * 自己標記完成。
 */
export async function createChallenge(title, description, deadline, verificationMode, createdBy, criterionType = "manual", criterionTarget = null, criterionStyle = null) {
  const db = getDbInstance();
  const isAuto = criterionType && criterionType !== "manual";
  const ref = await addDoc(collection(db, COLLECTION), {
    title,
    description: description || "",
    deadline,
    verificationMode: isAuto ? "admin_review" : verificationMode === "admin_review" ? "admin_review" : "self",
    criterionType: criterionType || "manual",
    criterionTarget: isAuto ? Number(criterionTarget) || 1 : null,
    criterionStyle: criterionType === "recipeStyleCount" ? criterionStyle : null,
    createdBy,
    active: true,
    completedBy: [],
    pendingReview: [],
    createdAt: serverTimestamp(),
  });

  try {
    await createNotificationForAllMembers("challenge", "有新挑戰囉", `「${title}」開始了，期限至 ${deadline}`, "/challenges", createdBy);
  } catch (err) {
    console.error("建立新挑戰通知失敗", err);
  }

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

/**
 * 所有還有「待審核」項目的挑戰，不限進行中／已結束都查（重要：
 * 避免有人在期限前一刻提交、但管理員來不及審核、挑戰就先自動
 * 結束了，導致那筆待審核資料在舊寫法裡永遠不會被看到）。
 */
export async function listChallengesWithPendingReview() {
  const all = await listAllChallenges();
  return all.filter((c) => (c.pendingReview || []).length > 0);
}

const REVIEW_GRACE_DAYS = 10;

/**
 * 有人開 APP、登入成功時呼叫：挑戰期限到了之後，還會再留 10 天
 * 讓管理員審核待審核項目；超過 10 天都沒處理的，自動判定失敗
 * （不計入徽章，直接從待審核清單移除）。
 * @returns {Promise<number>} 這次自動判定失敗的筆數
 */
export async function autoResolveStalePendingReviews() {
  const withPending = await listChallengesWithPendingReview();
  const today = todayStr();
  let resolvedCount = 0;

  for (const c of withPending) {
    if (!c.deadline) continue;
    const graceDeadline = addDaysToDateStr(c.deadline, REVIEW_GRACE_DAYS);
    if (today > graceDeadline) {
      const db = getDbInstance();
      await updateDoc(doc(db, COLLECTION, c.id), { pendingReview: [] });
      resolvedCount += (c.pendingReview || []).length;
    }
  }
  return resolvedCount;
}

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

/** 送進待審核（手動提交跟自動判斷達標都共用這個），回傳 'pending' 或 'already_pending' */
async function submitForReview(ref, data, uid) {
  const pendingReview = data.pendingReview || [];
  if (pendingReview.includes(uid)) return "already_pending";
  await updateDoc(ref, { pendingReview: [...pendingReview, uid] });
  try {
    await createNotificationForAdmins("challenge_review", "有挑戰待審核", `「${data.title}」有新的完成提交，等你審核`, "/challenge-admin");
  } catch (err) {
    console.error("建立待審核通知失敗", err);
  }
  return "pending";
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
    return submitForReview(ref, data, uid);
  }

  await updateDoc(ref, { completedBy: [...completedBy, uid] });
  await incrementBadgeCounter(uid, "challenge");
  return "done";
}

/**
 * 算某人在某個「自動判斷」挑戰裡目前的進度，回傳 {current, target}。
 * manual 類型回傳 null（沒有進度可算）。
 * 判斷範圍只看「挑戰建立之後、期限之前」發生的，不算挑戰開始前的舊資料。
 */
export async function computeChallengeProgress(challenge, uid) {
  if (!challenge.criterionType || challenge.criterionType === "manual") return null;

  const target = challenge.criterionTarget || 1;
  const periodStartMillis = toMillis(challenge.createdAt);
  const periodStartDateStr = toDateStrFromTimestamp(challenge.createdAt);
  const periodEndMillis = dateStrToEndOfDayMillis(challenge.deadline);

  if (challenge.criterionType === "loginStreak") {
    // 連續登入天數看目前值就好（累計數的概念跟這裡不同，這裡要的是「連續」）
    const member = await getMemberById(uid);
    return { current: Math.min(member?.loginStreakCurrent || 0, target), target };
  }

  if (challenge.criterionType === "diaryDays" || challenge.criterionType === "diaryMeals") {
    const entries = await listMyDiaryEntries(uid);
    const inPeriod = entries.filter((e) => e.date && (!periodStartDateStr || e.date >= periodStartDateStr) && e.date <= challenge.deadline);
    const current = challenge.criterionType === "diaryDays" ? new Set(inPeriod.map((e) => e.date)).size : inPeriod.length;
    return { current: Math.min(current, target), target };
  }

  if (challenge.criterionType === "recipeCount" || challenge.criterionType === "recipeStyleCount") {
    const recipes = await listMyOwnRecipes(uid);
    const inPeriod = recipes.filter((r) => {
      if (!r.isPublic) return false;
      const millis = toMillis(r.createdAt);
      return millis > 0 && millis >= periodStartMillis && millis <= periodEndMillis;
    });
    const filtered = challenge.criterionType === "recipeStyleCount" ? inPeriod.filter((r) => (r.styles || []).includes(challenge.criterionStyle)) : inPeriod;
    return { current: Math.min(filtered.length, target), target };
  }

  return null;
}

/**
 * 有人開 APP、登入成功時呼叫：全面檢查一次所有「自動判斷」的進行中挑戰，
 * 達標的自動送進待審核（不會直接完成，管理員還是要核准一次，因為自動
 * 判斷邏輯有可能誤判）。
 */
export async function checkAutoChallenges(uid) {
  const active = await listActiveChallenges();
  const autoOnes = active.filter((c) => c.criterionType && c.criterionType !== "manual");

  for (const challenge of autoOnes) {
    if ((challenge.completedBy || []).includes(uid) || (challenge.pendingReview || []).includes(uid)) continue;

    try {
      const progress = await computeChallengeProgress(challenge, uid);
      if (progress && progress.current >= progress.target) {
        const db = getDbInstance();
        const ref = doc(db, COLLECTION, challenge.id);
        const snap = await getDoc(ref);
        if (snap.exists()) await submitForReview(ref, snap.data(), uid);
      }
    } catch (err) {
      console.error(`自動判斷挑戰「${challenge.title}」檢查失敗`, err);
    }
  }
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

  try {
    await createNotification(uid, "challenge_result", "挑戰核准了！", `「${data.title}」審核通過，已計入你的挑戰徽章`, "/challenges");
  } catch (err) {
    console.error("建立核准通知失敗", err);
  }
}

/** 管理員拒絕一筆待審核的完成提交，不計徽章 */
export async function rejectChallengeCompletion(challengeId, uid) {
  const db = getDbInstance();
  const ref = doc(db, COLLECTION, challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這個挑戰");

  const data = snap.data();
  const pendingReview = (data.pendingReview || []).filter((id) => id !== uid);
  await updateDoc(ref, { pendingReview });

  try {
    await createNotification(uid, "challenge_result", "挑戰沒有通過審核", `「${data.title}」這次提交沒有通過，期限內可以再試一次`, "/challenges");
  } catch (err) {
    console.error("建立拒絕通知失敗", err);
  }
}
