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
import { updateLoginStreak } from "./badges.js";

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

  // 同步 Google 頭貼（每次登入都更新，因為大頭貼可能換）；
  // 但如果使用者已經自己在 APP 裡換過大頭貼（hasCustomAvatar），就不要再被 Google 的蓋回去
  // displayName 只在管理員沒手動填時才自動帶入
  // 補上「加入時間」：如果這筆資料還沒有 joinedAt（例如手動建的第一個管理員帳號），這裡補記第一次成功登入的時間
  const syncUpdates = { lastLoginAt: serverTimestamp() };
  if (!data.hasCustomAvatar) syncUpdates.photoURL = firebaseUser.photoURL || "";
  if (!data.displayName) syncUpdates.displayName = firebaseUser.displayName || "";
  if (!data.joinedAt) syncUpdates.joinedAt = serverTimestamp();
  await setDoc(memberRef, syncUpdates, { merge: true });

  currentMember = {
    uid: firebaseUser.uid,
    ...data,
    photoURL: syncUpdates.photoURL ?? data.photoURL,
    displayName: data.displayName || syncUpdates.displayName || "",
  };

  // 更新連續登入天數（徽章系統用，同一天內重複登入不會重複累加）
  try {
    currentMember.loginStreakCurrent = await updateLoginStreak(firebaseUser.uid);
  } catch (err) {
    console.error("更新連續登入天數失敗", err);
  }

  return "ok";
}

/** 使用者自己在 APP 裡換大頭貼（存進 Cloudinary 的圖片網址），換過之後 Google 頭貼就不會再蓋回來 */
export async function updateMyAvatar(photoURL) {
  if (!currentMember) return;
  const db = getDbInstance();
  await setDoc(doc(db, "users", currentMember.uid), { photoURL, hasCustomAvatar: true }, { merge: true });
  currentMember.photoURL = photoURL;
  currentMember.hasCustomAvatar = true;
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
