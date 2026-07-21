/* ==========================================================
   config.js — 這裡填入 Firebase 連線設定
   ----------------------------------------------------------
   只放 Firebase 的 6 個值，因為程式要先連上 Firebase 才能讀到
   其他共用設定（Cloudinary、天氣），這幾個值沒辦法從資料庫讀。
   這幾個值本來就是「前端一定看得到」的類型，直接進 git 沒關係，
   真正的防線是 Firestore Rules。
   照著「申請帳號步驟清單」2-4 拿到的 firebaseConfig 貼進來即可。
   ========================================================== */

export const CONFIG = {
  firebaseApiKey: "",
  firebaseAuthDomain: "",
  firebaseProjectId: "",
  firebaseStorageBucket: "",
  firebaseMessagingSenderId: "",
  firebaseAppId: "",
};
