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

/**
 * 通用彈出選單（置中視窗，跟刪除確認框同一種風格）
 * opts = [{value,label}]，multiple 決定單選/多選
 * 對應文件第 736 行「使用者所有選擇類的操作 → 全部用下拉選單」的規則，
 * 全站篩選/多選都共用這一個，不要各自刻一套。
 */
export function openPickerSheet({ title, options, selected, multiple, onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";
  const selectedSet = new Set(selected);

  function renderOpts() {
    return options
      .map((opt) => {
        const checked = selectedSet.has(opt.value);
        return `<div class="sheet-opt ${checked ? "checked" : ""}" data-value="${opt.value}">
          <div class="${multiple ? "box" : "radio"}">${multiple ? '<svg class="icon" viewBox="0 0 24 24" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' : ""}</div>
          ${opt.label}
        </div>`;
      })
      .join("");
  }

  overlay.innerHTML = `
    <div class="picker-box">
      <div class="sheet-title">${title}</div>
      <div class="sheet-opts">${renderOpts()}</div>
      ${multiple ? '<button type="button" class="sheet-confirm">確定</button>' : ""}
    </div>
  `;

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll(".sheet-opt").forEach((el) => {
    el.addEventListener("click", () => {
      const value = el.dataset.value;
      if (multiple) {
        if (selectedSet.has(value)) selectedSet.delete(value);
        else selectedSet.add(value);
        el.classList.toggle("checked");
      } else {
        selectedSet.clear();
        selectedSet.add(value);
        onConfirm([value]);
        close();
      }
    });
  });

  const confirmBtn = overlay.querySelector(".sheet-confirm");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      onConfirm([...selectedSet]);
      close();
    });
  }

  document.body.appendChild(overlay);
  return { close };
}
