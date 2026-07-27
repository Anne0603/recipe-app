/* ==========================================================
   app-settings.js — App 共用設定（Cloudinary／天氣金鑰）
   ----------------------------------------------------------
   這兩組是全部人共用同一組（不是每人各自申請），存在 Firestore
   一份文件：settings/appConfig。
   由管理員在「服務設定」頁面（#/app-config）填入，
   其他功能（天氣、上傳圖片）之後都從這裡讀取，不用碰程式碼。

   權限：目前 Firestore 還是臨時規則（登入即可讀寫），
   上線前產出正式規則時，這份文件要設成「登入可讀、僅 admin 可寫」，
   現在畫面上只用 isAdmin() 擋寫入按鈕，這不是真正的安全防線，
   之後補正式 Firestore 規則時要記得一起處理。
   ========================================================== */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";

const SETTINGS_DOC_PATH = ["settings", "appConfig"];

const EMPTY_SETTINGS = {
  cloudinaryCloudName: "",
  cloudinaryUploadPreset: "",
  openWeatherApiKey: "",
};

/** 這些有自己的合理預設值，不算在「Cloudinary/天氣填齊了沒」的檢查裡 */
const OTHER_DEFAULTS = {
  diaryRetentionMonths: 18, // 17｜料理日記：保留期限，管理員可調整，文件建議值 18 個月
};

let cachedSettings = null;

/** 讀取共用設定（有快取，同一個分頁內不會重複打 Firestore） */
export async function getAppSettings({ forceRefresh = false } = {}) {
  if (cachedSettings && !forceRefresh) {
    return cachedSettings;
  }
  const db = getDbInstance();
  const ref = doc(db, ...SETTINGS_DOC_PATH);
  const snap = await getDoc(ref);
  const base = { ...EMPTY_SETTINGS, ...OTHER_DEFAULTS };
  cachedSettings = snap.exists() ? { ...base, ...snap.data() } : base;
  return cachedSettings;
}

/** 寫入共用設定（只有管理員應該呼叫這個，UI 層要先擋） */
export async function saveAppSettings(partial) {
  const db = getDbInstance();
  const ref = doc(db, ...SETTINGS_DOC_PATH);
  await setDoc(ref, { ...partial, updatedAt: serverTimestamp() }, { merge: true });
  cachedSettings = { ...(cachedSettings || { ...EMPTY_SETTINGS, ...OTHER_DEFAULTS }), ...partial };
  return cachedSettings;
}

export function isAppSettingsComplete(settings) {
  return Object.keys(EMPTY_SETTINGS).every((key) => (settings[key] || "").trim() !== "");
}
