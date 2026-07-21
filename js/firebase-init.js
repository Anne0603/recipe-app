/* ==========================================================
   firebase-init.js — Firebase 初始化（app / auth / firestore）
   ----------------------------------------------------------
   用 Firebase 官方 CDN 提供的 ES module 版本，不用 npm build，
   純前端＋GitHub Pages 直接能用。
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
