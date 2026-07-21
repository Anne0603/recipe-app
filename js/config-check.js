/* ==========================================================
   config-check.js — 檢查 config.js 裡的金鑰是否填齊
   ----------------------------------------------------------
   邏輯跟 config.js 分開放，讓 config.js 只單純放值、方便你直接編輯。
   ========================================================== */

import { CONFIG } from "./config.js";

export function isConfigComplete() {
  return Object.values(CONFIG).every((value) => (value || "").trim() !== "");
}

/** 列出目前還沒填的欄位名稱，方便訊息裡告訴使用者缺什麼 */
export function getMissingFields() {
  return Object.entries(CONFIG)
    .filter(([, value]) => !(value || "").trim())
    .map(([key]) => key);
}
