/* ==========================================================
   router.js — 陽春 hash router（支援 /path/:id 動態參數）
   ----------------------------------------------------------
   每個頁面對應一個 "#/路徑"，換頁時把 #app 容器內容換掉。
   不依賴任何框架，避免 Beebo 踩過的字串替換整段 JS 失效的坑
   （這裡是用 DOM API 換內容，不是對整份 HTML 做字串替換）。
   ========================================================== */

const routes = []; // { segments, keys, handler, hideTabbar }
let notFoundHandler = () => {
  document.getElementById("app").innerHTML =
    '<div class="placeholder-page">找不到這個頁面</div>';
};
let beforeEachHook = null; // 可設定「換頁前先檢查」的邏輯（例如登入狀態、設定是否完整）
let onRouteChangeHook = null; // app.js 用這個知道「目前這頁該不該顯示底部導覽列」，自己跟登入狀態合併判斷後再決定

/**
 * 註冊一個路徑對應的渲染函式
 * @param {string} path 例如 "/home"、"/recipes"、"/recipes/:id"
 * @param {(container: HTMLElement, params: Record<string,string>) => void} renderFn
 * @param {{ hideTabbar?: boolean }} [options] hideTabbar: 這個頁面是否要隱藏底部導覽列（例如詳情頁、表單頁）
 */
export function registerRoute(path, renderFn, options = {}) {
  const segments = path.split("/").filter(Boolean);
  const keys = [];
  segments.forEach((seg, i) => {
    if (seg.startsWith(":")) keys.push({ index: i, name: seg.slice(1) });
  });
  routes.push({ segments, keys, handler: renderFn, hideTabbar: !!options.hideTabbar });
}

/** 設定找不到路徑時的處理 */
export function setNotFoundHandler(fn) {
  notFoundHandler = fn;
}

/** 設定每次換頁前的檢查邏輯，回傳 false 可中止換頁（例如導去 #/setup） */
export function setBeforeEach(fn) {
  beforeEachHook = fn;
}

/** 設定路由變化後的回呼，收到 { path, basePath, hideTabbar }，讓 app.js 自己決定導覽列顯示（要跟登入狀態合併判斷） */
export function setOnRouteChange(fn) {
  onRouteChangeHook = fn;
}

function currentPath() {
  const hash = window.location.hash || "#/home";
  return hash.replace(/^#/, "").split("?")[0] || "/home";
}

function currentQuery() {
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(qIndex + 1)));
}

/** 找出符合目前路徑的路由，回傳 { route, params }，找不到回傳 null */
function matchRoute(path) {
  const pathSegments = path.split("/").filter(Boolean);
  for (const route of routes) {
    if (route.segments.length !== pathSegments.length) continue;
    let ok = true;
    const params = {};
    for (let i = 0; i < route.segments.length; i++) {
      const routeSeg = route.segments[i];
      if (routeSeg.startsWith(":")) {
        params[routeSeg.slice(1)] = pathSegments[i];
      } else if (routeSeg !== pathSegments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function render() {
  const path = currentPath();

  if (beforeEachHook && beforeEachHook(path) === false) {
    return; // beforeEachHook 自己會處理導頁（例如改 location.hash）
  }

  const container = document.getElementById("app");
  const matched = matchRoute(path);
  const query = currentQuery();

  if (matched) {
    matched.route.handler(container, matched.params, query);
  } else {
    notFoundHandler(container);
  }

  // 底部導覽列的顯示/隱藏交給 app.js 決定（它要合併「有沒有登入」跟「這頁要不要顯示」兩個條件）
  const basePath = "/" + (path.split("/").filter(Boolean)[0] || "home");
  if (onRouteChangeHook) {
    onRouteChangeHook({ path, basePath, hideTabbar: !!matched?.route.hideTabbar });
  }

  // 更新底部導覽列的 active 狀態（用路徑的第一段比對，/recipes/xxx 也會讓「食譜」亮起來）
  document.querySelectorAll("#tabbar .tab").forEach((a) => {
    a.classList.toggle("active", a.dataset.path === basePath);
  });
}

/** 啟動 router：監聽 hash 變化並畫出目前頁面 */
export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}

/** 用程式碼導頁（例如登入成功後導去首頁），第二個參數可帶查詢字串物件，例如 navigate("/recipes", { sort: "hot" }) */
export function navigate(path, query) {
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : "";
  window.location.hash = `#${path}${qs}`;
}

/** 重新渲染目前頁面（不改網址），用於同頁內資料更新後刷新畫面 */
export function rerender() {
  render();
}
