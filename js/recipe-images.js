/* ==========================================================
   recipe-images.js — 對應需求文件「05｜食譜圖片」
   ----------------------------------------------------------
   Cloudinary unsigned 上傳。cloud name／upload preset 從
   app-settings.js 讀（管理員在「服務設定」頁填的那份 Firestore 設定），
   不是從 config.js 讀（config.js 只放 Firebase 連線用的值）。

   只支援上傳，不支援刪除（見 recipes.js 檔頭說明的架構限制）。
   ========================================================== */

import { getAppSettings } from "./app-settings.js";

/**
 * 上傳一張圖片到 Cloudinary，回傳圖片網址
 * @param {File} file 使用者選的圖片檔案
 * @returns {Promise<string>} secure_url
 */
export async function uploadRecipeImage(file) {
  const settings = await getAppSettings();
  const { cloudinaryCloudName, cloudinaryUploadPreset } = settings;

  if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error(
      "Cloudinary 還沒設定，請管理員先到「服務設定」頁填入 Cloud name 與 Upload preset"
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryUploadPreset);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
  const response = await fetch(uploadUrl, { method: "POST", body: formData });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`圖片上傳失敗（${response.status}）${errText}`);
  }

  const result = await response.json();
  return result.secure_url;
}
