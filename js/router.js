/* ==========================================================
   router.js — 陽春 hash router
   ----------------------------------------------------------
   每個頁面對應一個 "#/路徑"，換頁時把 #app 容器內容換掉。
   不依賴任何框架，避免 Beebo 踩過的字串替換整段 JS 失效的坑
   （這裡是用 DOM API 換內容，不是對整份 HTML 做字串替換）。
   ========================================================== */

const routes = new Map();
let notFoundHandler = () => {
  document.getElementById("app").innerHTML =
    '<div class="placeholder-page">找不到這個頁面</div>';
};
let beforeEachHook = null; // 可設定「換頁前先檢查」的邏輯（例如登入狀態、設定是否完整）

/**
 * 註冊一個路徑對應的渲染函式
 * @param {string} path 例如 "/home"、"/recipes"
 * @param {(container: HTMLElement) => void} renderFn 負責把畫面畫進 container
 */
export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

/** 設定找不到路徑時的處理 */
export function setNotFoundHandler(fn) {
  notFoundHandler = fn;
}

/** 設定每次換頁前的檢查邏輯，回傳 false 可中止換頁（例如導去 #/setup） */
export function setBeforeEach(fn) {
  beforeEachHook = fn;
}

function currentPath() {
  const hash = window.location.hash || "#/home";
  return hash.replace(/^#/, "") || "/home";
}

function render() {
  const path = currentPath();

  if (beforeEachHook && beforeEachHook(path) === false) {
    return; // beforeEachHook 自己會處理導頁（例如改 location.hash）
  }

  const container = document.getElementById("app");
  const handler = routes.get(path);

  if (handler) {
    handler(container);
  } else {
    notFoundHandler(container);
  }

  // 更新底部導覽列的 active 狀態
  document.querySelectorAll("#tabbar .tab").forEach((a) => {
    a.classList.toggle("active", a.dataset.path === path);
  });
}

/** 啟動 router：監聽 hash 變化並畫出目前頁面 */
export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}

/** 用程式碼導頁（例如登入成功後導去首頁） */
export function navigate(path) {
  window.location.hash = `#${path}`;
}
