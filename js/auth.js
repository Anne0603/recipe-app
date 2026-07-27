/* ==========================================================
   auth.js — 登入登出、白名單比對、角色判斷
   ----------------------------------------------------------
   規則見需求文件「權限與角色定案」：
   - 白名單＝成員名單本身（同一份資料）
   - 登入後比對 email 是否在 users 集合裡有對應的一筆
   - 有 → 放行；沒有 → 擋在門外（不開放排隊申請）
   - 第一個管理員：上線時由你自己在 Firebase 後台手動建一筆
     role: admin 的 users 資料，這裡的程式不處理「怎麼變成第一個管理員」
   ========================================================== */

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuthInstance, getDbInstance, getGoogleProvider } from "./firebase-init.js";

let currentMember = null; // 目前登入者在 Firestore 裡的成員資料（含角色）

export function getCurrentMember() {
  return currentMember;
}

/** 用 Google 彈窗登入 */
export async function signInWithGoogle() {
  const auth = getAuthInstance();
  const provider = getGoogleProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  currentMember = null;
  return signOut(getAuthInstance());
}

/**
 * 登入成功後呼叫：比對白名單、載入/建立成員資料
 * @param {import("firebase/auth").User} firebaseUser
 * @returns {"ok" | "not_whitelisted" | "disabled"} 結果狀態
 */
export async function resolveMember(firebaseUser) {
  const db = getDbInstance();
  const memberRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(memberRef);

  if (!snap.exists()) {
    // uid 對不到既有資料。理論上管理員是用 email 先建好白名單資料，
    // 這裡先用最保守的方式擋下來，白名單比對的完整規則等寫「成員系統」
    // 該段功能時再依實際 Firestore 資料設計細修（此為骨架階段的簡化版）。
    currentMember = null;
    return "not_whitelisted";
  }

  const data = snap.data();

  if (data.status === "disabled") {
    currentMember = null;
    return "disabled";
  }

  // 更新最後登入時間（連續登入天數的計算屬於徽章系統，之後在 badges.js 處理）
  await setDoc(memberRef, { lastLoginAt: serverTimestamp() }, { merge: true });

  currentMember = { uid: firebaseUser.uid, ...data };
  return "ok";
}

/** 監聽登入狀態變化，callback 收到 firebaseUser（未登入為 null） */
export function watchAuthState(callback) {
  onAuthStateChanged(getAuthInstance(), callback);
}

export function isAdmin() {
  return currentMember?.role === "admin";
}

/** 依 uid 查一筆成員資料（例如食譜詳情頁要顯示發布者名字），查不到回傳 null */
export async function getMemberById(uid) {
  if (!uid) return null;
  const db = getDbInstance();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** 更新目前登入者的主題偏好（存進 Firestore 的成員資料，換裝置也會記得） */
export async function updateMyTheme(theme) {
  if (!currentMember) return;
  const db = getDbInstance();
  await setDoc(doc(db, "users", currentMember.uid), { theme }, { merge: true });
  currentMember.theme = theme;
}
