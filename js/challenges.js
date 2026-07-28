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
     title, description, createdBy, createdAt, active,
     completedBy[]（手動標記完成的人，讚數模式判斷完成狀態）
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

/** 管理員發布新挑戰 */
export async function createChallenge(title, description, createdBy) {
  const db = getDbInstance();
  const ref = await addDoc(collection(db, COLLECTION), {
    title,
    description: description || "",
    createdBy,
    active: true,
    completedBy: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** 所有進行中的挑戰（單一條件查詢，前端自己排序） */
export async function listActiveChallenges() {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("active", "==", true));
  const snap = await getDocs(q);
  const challenges = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return challenges.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

/** 首頁「本週挑戰」用：目前唯一顯示中的挑戰（取最新一個進行中的） */
export async function getCurrentChallenge() {
  const challenges = await listActiveChallenges();
  return challenges[0] || null;
}

/** 管理員結束一個挑戰（不刪除，只是關閉） */
export async function endChallenge(challengeId) {
  const db = getDbInstance();
  await updateDoc(doc(db, COLLECTION, challengeId), { active: false });
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
