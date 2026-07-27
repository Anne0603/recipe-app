/* ==========================================================
   firebase-init.js — Firebase 初始化（app / auth / firestore）
   ----------------------------------------------------------
   用 Firebase 官方 CDN 提供的 ES module 版本，不用 npm build，
   純前端＋GitHub Pages 直接能用。

   ⚠️ 安全性提醒（對應需求文件「下一步待辦」第 4 項）：
   目前 Firestore 規則還是最早設定的臨時版本（登入即可讀寫全部資料）。
   畫面上已經用「只有擁有者看得到編輯/刪除/設定公開私人按鈕」擋一般人，
   但這不是真正的安全防線——技術上懂開發者工具的人仍可能直接改到別人
   的資料。等主要功能都做完後，要照各功能實際欄位一次寫完整規則
   （例如：recipes 只能 owner 寫、私人的只能 owner 讀），不要一直拖到上線前才做。
   ========================================================== */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { CONFIG } from "./config.js";

let firebaseApp = null;
let authInstance = null;
let dbInstance = null;

/** 用 config.js 裡的值初始化 Firebase，欄位不完整時會回傳 null */
export function initFirebase() {
  const firebaseConfig = {
    apiKey: CONFIG.firebaseApiKey,
    authDomain: CONFIG.firebaseAuthDomain,
    projectId: CONFIG.firebaseProjectId,
    storageBucket: CONFIG.firebaseStorageBucket,
    messagingSenderId: CONFIG.firebaseMessagingSenderId,
    appId: CONFIG.firebaseAppId,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return null;
  }

  // 避免重複初始化（例如設定精靈存檔後重新呼叫一次）
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  authInstance = getAuth(firebaseApp);
  dbInstance = getFirestore(firebaseApp);

  return { app: firebaseApp, auth: authInstance, db: dbInstance };
}

export function getAuthInstance() {
  return authInstance;
}

export function getDbInstance() {
  return dbInstance;
}

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}
