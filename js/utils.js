/* ==========================================================
   utils.js — 全站共用工具
   ========================================================== */

/**
 * 顯示確認刪除／確認動作的彈窗（合作原則要求：所有刪除動作都要跳確認框）
 * @param {string} message 顯示的文字，例如「確定要刪除 XXX 嗎？此動作無法復原」
 * @returns {Promise<boolean>} 使用者按確定則 resolve(true)，取消則 resolve(false)
 */
export function showConfirm(message) {
  const overlay = document.getElementById("confirm-dialog");
  const messageEl = document.getElementById("confirm-dialog-message");
  const okBtn = document.getElementById("confirm-dialog-ok");
  const cancelBtn = document.getElementById("confirm-dialog-cancel");

  messageEl.textContent = message;
  overlay.classList.remove("hidden");

  return new Promise((resolve) => {
    function cleanup(result) {
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk() {
      cleanup(true);
    }
    function onCancel() {
      cleanup(false);
    }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

/** 顯示輕量提示訊息，幾秒後自動消失 */
export function showToast(message, duration = 2500) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}

/** 簡易防抖，用於搜尋輸入等場景 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** 將 Date 或 timestamp 格式化成 YYYY-MM-DD */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
