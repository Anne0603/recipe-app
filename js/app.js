/* ==========================================================
   app.js — 進入點
   ----------------------------------------------------------
   流程：
   1. 檢查 js/config.js 裡的金鑰是否齊全
      → 不齊全：強制導去 #/setup 顯示還缺哪些欄位、指引去改 config.js
      → 齊全：初始化 Firebase，監聽登入狀態
   2. 未登入 → 導去 #/login
   3. 已登入但不在白名單 / 帳號被停用 → 顯示對應訊息，不放行
   4. 已登入且通過檢查 → 顯示導覽列，可以進入各功能頁面
   ========================================================== */

import { isConfigComplete, getMissingFields } from "./config-check.js";
import { initFirebase } from "./firebase-init.js";
import { signInWithGoogle, signOutUser, resolveMember, watchAuthState, getCurrentMember, isAdmin, updateMyTheme } from "./auth.js";
import { getAppSettings, saveAppSettings, isAppSettingsComplete } from "./app-settings.js";
import { renderRecipeListPage, renderRecipeDetailPage, renderRecipeFormPage } from "./recipe-pages.js";
import { getTopPublicRecipes, getRecentPublicRecipes } from "./recipes.js";
import { openLotteryFlow } from "./lottery.js";
import { registerRoute, setBeforeEach, setOnRouteChange, startRouter, navigate } from "./router.js";
import { showToast } from "./utils.js";

let isLoggedIn = false;

const THEME_STORAGE_KEY = "recipeApp.theme";
const THEME_OPTIONS = [
  { value: "terracotta", label: "陶土橘", swatch: "#D9773F" },
  { value: "sage", label: "鼠尾草綠", swatch: "#8A9A7E" },
  { value: "blue-grey", label: "霧藍灰", swatch: "#7B93A0" },
  { value: "rose", label: "霧玫瑰", swatch: "#B98A88" },
  { value: "taupe", label: "奶茶駝", swatch: "#A98F6E" },
];

function applyTheme(theme) {
  const value = theme || "terracotta";
  document.documentElement.setAttribute("data-theme", value);
  localStorage.setItem(THEME_STORAGE_KEY, value);
}

// 頁面一開啟就先套用上次快取的主題，避免登入資料還沒回來前畫面閃一下預設色
applyTheme(localStorage.getItem(THEME_STORAGE_KEY));

/* ---------------------------------------------------------
   設定未完成時的提示頁面（#/setup）
   ----------------------------------------------------------
   金鑰改用 js/config.js 這個檔案填（不進 git，見 .gitignore）。
   這裡不提供表單填寫，只告訴使用者要去改哪個檔案、缺什麼欄位。
--------------------------------------------------------- */
function renderSetupPage(container) {
  const missing = getMissingFields();
  const missingHtml = missing.map((key) => `<li>${key}</li>`).join("");

  container.innerHTML = `
    <div class="setup-wizard">
      <h1>金鑰還沒填齊</h1>
      <p class="setup-intro">
        請打開專案裡的 <code>js/config.js</code>，照著「申請帳號步驟清單」
        拿到的值填進對應欄位，存檔後重新整理這個頁面即可。
        還沒有 <code>config.js</code> 的話，先複製一份 <code>js/config.example.js</code>
        改名成 <code>config.js</code> 再填。
      </p>
      <div class="setup-section">
        <h2>目前還缺這些欄位：</h2>
        <ul>${missingHtml}</ul>
      </div>
      <button id="setup-recheck-btn" class="btn btn-primary">我填好了，重新檢查</button>
    </div>
  `;

  document.getElementById("setup-recheck-btn").addEventListener("click", () => {
    window.location.reload();
  });
}

/* ---------------------------------------------------------
   登入頁面（#/login）
--------------------------------------------------------- */
function renderLoginPage(container) {
  container.innerHTML = `
    <div class="login-page">
      <h1>今天吃什麼？</h1>
      <p>用 Google 帳號登入</p>
      <button id="google-login-btn" class="btn btn-primary">使用 Google 登入</button>
    </div>
  `;

  document.getElementById("google-login-btn").addEventListener("click", async () => {
    try {
      await signInWithGoogle();
      // 登入成功後 watchAuthState 的 callback 會接手處理白名單比對與導頁
    } catch (err) {
      console.error(err);
      showToast("登入失敗，請再試一次");
    }
  });
}

/* ---------------------------------------------------------
   首頁（#/home）
   ----------------------------------------------------------
   視覺依 mockup 確認版本製作。熱門食譜、朋友新分享、本週挑戰
   這幾塊背後的功能都還沒做，先用空狀態文字，不用假資料冒充。
   天氣、抽籤按鈕也是先有畫面，實際邏輯等對應功能開工時才接上。
--------------------------------------------------------- */
async function renderHomePage(container) {
  const member = getCurrentMember();
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早安" : hour < 18 ? "午安" : "晚安";
  const name = member?.displayName || "朋友";

  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
  const dateLabel = `${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日星期${weekday}`;

  container.innerHTML = `
    <div class="home-header">
      <div class="home-header-top">
        <div class="hello">${greeting}，<span>${name}</span></div>
        <div class="streak-badge">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c0-1-.5-2-1-2.5.8 1.5 2 2.8 2 5.5a6 6 0 1 1-12 0c0-4 2-5 3-7 .3 1 1 2 2 2-.5-2-1-3.5 2-5Z"/></svg>
          連續登入功能開發中
        </div>
      </div>
      <div class="weather-line">
        <svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="9" r="4"/><path d="M9 2v1.4M9 14.6V16M2 9h1.4M14.6 9H16M4 4l1 1M13 13l1 1M14 4l-1 1M5 13l-1 1"/></svg>
        天氣功能開發中 <span class="weather-dot">・</span> <span class="weather-date">${dateLabel}</span>
      </div>
    </div>

    <div class="lottery-wrap">
      <button id="lottery-btn" class="lottery-card">
        <svg class="icon" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="4"/>
          <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/>
          <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/>
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>
          <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/>
          <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/>
        </svg>
        <div class="lottery-body">
          <div class="lottery-eyebrow">還沒想好嗎</div>
          <div class="lottery-title">今天吃什麼？</div>
        </div>
        <svg class="lottery-arrow icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>

    <div class="home-section">
      <div class="home-section-head">
        <svg class="icon" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5"/></svg>
        <h2>熱門食譜</h2>
        <a href="#/recipes?sort=hot" class="more">看全部 ›</a>
      </div>
      <div id="home-hot-recipes"><div class="empty-state">載入中…</div></div>
    </div>

    <div class="home-section">
      <div class="home-section-head">
        <svg class="icon" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5"/></svg>
        <h2>朋友新分享</h2>
        <a href="#/recipes?sort=recent" class="more">看全部 ›</a>
      </div>
      <div id="home-recent-recipes"><div class="empty-state">載入中…</div></div>
    </div>

    <div class="home-section">
      <div class="home-section-head">
        <svg class="icon" viewBox="0 0 24 24"><path d="M5 3v18M5 4h11l-2 3.5L16 11H5"/></svg>
        <h2>本週挑戰</h2>
      </div>
      <div class="empty-state">還沒有挑戰資料，等「挑戰系統」規格確定、管理員發布挑戰後會顯示在這裡。</div>
    </div>
  `;

  loadHomeRecipeSections();

  document.getElementById("lottery-btn").addEventListener("click", () => {
    openLotteryFlow();
  });
}

const HOME_NO_PHOTO_ICON = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 3 3 4-4 5 5"/></svg>';
const HOME_HEART_ICON = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10a1 1 0 0 1-4 0Z"/></svg>';

function homeRecipeCardHtml(recipe) {
  const styleTags = (recipe.styles || []).slice(0, 2).map((s) => `<span>${s}</span>`).join("");
  return `
    <a href="#/recipes/${recipe.id}" class="recipe-card">
      <div class="recipe-cover" style="${recipe.coverImageUrl ? `background-image:url('${recipe.coverImageUrl}')` : ""}">
        ${recipe.coverImageUrl ? "" : HOME_NO_PHOTO_ICON}
      </div>
      <div class="recipe-info">
        <div class="recipe-name">${recipe.name}</div>
        <div class="recipe-tags">${styleTags}</div>
        <div class="recipe-meta">
          <div></div>
          <div class="recipe-like-count">${HOME_HEART_ICON}${(recipe.likedBy || []).length}</div>
        </div>
      </div>
    </a>
  `;
}

async function loadHomeRecipeSections() {
  const hotEl = document.getElementById("home-hot-recipes");
  const recentEl = document.getElementById("home-recent-recipes");
  if (!hotEl || !recentEl) return; // 使用者可能已經換頁

  try {
    const [hot, recent] = await Promise.all([getTopPublicRecipes(4), getRecentPublicRecipes(4)]);

    hotEl.innerHTML = hot.length
      ? `<div class="recipe-grid">${hot.map(homeRecipeCardHtml).join("")}</div>`
      : `<div class="empty-state">還沒有公開食譜，等大家分享後這裡會顯示最多人收藏的菜色。</div>`;

    recentEl.innerHTML = recent.length
      ? `<div class="recipe-grid">${recent.map(homeRecipeCardHtml).join("")}</div>`
      : `<div class="empty-state">還沒有公開食譜，等朋友發布新食譜後會顯示在這裡。</div>`;
  } catch (err) {
    console.error(err);
    hotEl.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
    recentEl.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
  }
}

/* ---------------------------------------------------------
   服務設定頁面（#/app-config）— 管理員填 Cloudinary／天氣金鑰
   ----------------------------------------------------------
   存進 Firestore 共用設定，之後上傳圖片、天氣功能都從這裡讀。
   目前用 isAdmin() 擋畫面，不是真正的安全防線（Firestore 規則
   還是臨時版），正式規則要在「上線前」那一步一起補上。
--------------------------------------------------------- */
async function renderAppConfigPage(container) {
  if (!isAdmin()) {
    container.innerHTML = `<div class="placeholder-page"><p>這頁只有管理員能用</p></div>`;
    return;
  }

  container.innerHTML = `<div class="loading-screen"><p>載入中…</p></div>`;
  const settings = await getAppSettings({ forceRefresh: true });

  container.innerHTML = `
    <div class="setup-wizard">
      <h1>服務設定</h1>
      <p class="setup-intro">
        這裡填的值全部人共用一份，存在 Firestore，換金鑰不用碰程式碼、不用重新部署。
      </p>
      <div class="setup-section">
        <h2>Cloudinary（食譜圖片）</h2>
        <div class="field">
          <label for="field-cloudinaryCloudName">Cloud name</label>
          <input type="text" id="field-cloudinaryCloudName" value="${settings.cloudinaryCloudName}" />
        </div>
        <div class="field">
          <label for="field-cloudinaryUploadPreset">Upload preset 名稱</label>
          <input type="text" id="field-cloudinaryUploadPreset" value="${settings.cloudinaryUploadPreset}" />
        </div>
      </div>
      <div class="setup-section">
        <h2>OpenWeatherMap（天氣）</h2>
        <div class="field">
          <label for="field-openWeatherApiKey">API key</label>
          <input type="text" id="field-openWeatherApiKey" value="${settings.openWeatherApiKey}" />
        </div>
      </div>
      <button id="app-config-save-btn" class="btn btn-primary">儲存</button>
    </div>
  `;

  document.getElementById("app-config-save-btn").addEventListener("click", async () => {
    const updates = {
      cloudinaryCloudName: document.getElementById("field-cloudinaryCloudName").value.trim(),
      cloudinaryUploadPreset: document.getElementById("field-cloudinaryUploadPreset").value.trim(),
      openWeatherApiKey: document.getElementById("field-openWeatherApiKey").value.trim(),
    };
    try {
      const saved = await saveAppSettings(updates);
      showToast(isAppSettingsComplete(saved) ? "已儲存" : "已儲存（還有欄位是空的）");
    } catch (err) {
      console.error(err);
      showToast("儲存失敗，請再試一次");
    }
  });
}

/* ---------------------------------------------------------
   設定頁（#/settings）
   ----------------------------------------------------------
   目前只放登出、管理員專屬的服務設定入口。
   個人化設定（通知開關、Discord Webhook 等）之後功能討論到
   再補進來。
--------------------------------------------------------- */
function renderSettingsPage(container) {
  const member = getCurrentMember();
  const currentTheme = member?.theme || "terracotta";

  container.innerHTML = `
    <div class="setup-wizard">
      <h1>設定</h1>
      <p class="setup-intro">登入身分：${member?.displayName || ""}（${isAdmin() ? "管理員" : "一般成員"}）</p>

      <div class="setup-section">
        <h2>外觀</h2>
        <div class="theme-swatch-row">
          ${THEME_OPTIONS.map(
            (t) => `
            <button type="button" class="theme-swatch-btn ${t.value === currentTheme ? "selected" : ""}" data-theme-value="${t.value}">
              <span class="theme-swatch-dot" style="background:${t.swatch}"></span>
              <span class="theme-swatch-label">${t.label}</span>
            </button>`
          ).join("")}
        </div>
      </div>

      ${isAdmin() ? '<div class="setup-section"><a href="#/app-config" class="btn btn-ghost">服務設定（Cloudinary／天氣金鑰）</a></div>' : ""}
      <div class="setup-section">
        <button id="settings-logout-btn" class="btn btn-danger">登出</button>
      </div>
    </div>
  `;

  container.querySelectorAll(".theme-swatch-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.themeValue;
      applyTheme(value);
      container.querySelectorAll(".theme-swatch-btn").forEach((b) => b.classList.toggle("selected", b === btn));
      try {
        await updateMyTheme(value);
      } catch (err) {
        console.error(err);
        showToast("主題已套用，但存到帳號失敗，換裝置可能要重選");
      }
    });
  });

  document.getElementById("settings-logout-btn").addEventListener("click", async () => {
    await signOutUser();
    isLoggedIn = false;
    updateTabbarVisibility();
    navigate("/login");
  });
}

/* ---------------------------------------------------------
   其他導覽頁面：骨架階段先放「開發中」佔位
--------------------------------------------------------- */
function renderPlaceholderPage(title) {
  return (container) => {
    container.innerHTML = `<div class="placeholder-page"><p>${title} — 開發中</p></div>`;
  };
}

/* ---------------------------------------------------------
   底部導覽列的顯示/隱藏
   ----------------------------------------------------------
   要同時看兩個條件：有沒有登入、目前這個路由要不要顯示導覽列
   （詳情頁、新增表單這種次頁面 hideTabbar 是 true）。
--------------------------------------------------------- */
let currentRouteHideTabbar = false;

function updateTabbarVisibility() {
  const shouldShow = isLoggedIn && !currentRouteHideTabbar;
  document.getElementById("tabbar").classList.toggle("hidden", !shouldShow);
}

setOnRouteChange(({ hideTabbar }) => {
  currentRouteHideTabbar = hideTabbar;
  updateTabbarVisibility();
});

/* ---------------------------------------------------------
   路由註冊
--------------------------------------------------------- */
registerRoute("/setup", renderSetupPage);
registerRoute("/login", renderLoginPage);
registerRoute("/home", renderHomePage);
registerRoute("/recipes", renderRecipeListPage);
registerRoute("/recipes/new", renderRecipeFormPage, { hideTabbar: true });
registerRoute("/recipes/:id/edit", renderRecipeFormPage, { hideTabbar: true });
registerRoute("/recipes/:id", renderRecipeDetailPage, { hideTabbar: true });
registerRoute("/diary", renderPlaceholderPage("料理日記"));
registerRoute("/expenses", renderPlaceholderPage("花費記錄"));
registerRoute("/friends", renderPlaceholderPage("朋友"));
registerRoute("/settings", renderSettingsPage);
registerRoute("/app-config", renderAppConfigPage);

// 換頁前檢查：設定沒填齊 → 強制留在 /setup；沒登入 → 強制留在 /login
setBeforeEach((path) => {
  if (!isConfigComplete()) {
    if (path !== "/setup") {
      navigate("/setup");
      return false;
    }
    return true;
  }

  if (!isLoggedIn && path !== "/login" && path !== "/setup") {
    navigate("/login");
    return false;
  }

  if (isLoggedIn && path === "/login") {
    navigate("/home");
    return false;
  }

  return true;
});

/* ---------------------------------------------------------
   啟動流程
--------------------------------------------------------- */
async function boot() {
  if (!isConfigComplete()) {
    updateTabbarVisibility();
    startRouter();
    navigate("/setup");
    return;
  }

  initFirebase();

  watchAuthState(async (firebaseUser) => {
    if (!firebaseUser) {
      isLoggedIn = false;
      updateTabbarVisibility();
      navigate("/login");
      return;
    }

    const result = await resolveMember(firebaseUser);

    if (result === "ok") {
      isLoggedIn = true;
      applyTheme(getCurrentMember()?.theme);
      updateTabbarVisibility();
      if (window.location.hash === "#/login" || !window.location.hash) {
        navigate("/home");
      }
    } else if (result === "not_whitelisted") {
      isLoggedIn = false;
      updateTabbarVisibility();
      await signOutUser();
      showToast("這個帳號還不在成員名單裡，請聯絡管理員");
      navigate("/login");
    } else if (result === "disabled") {
      isLoggedIn = false;
      updateTabbarVisibility();
      await signOutUser();
      showToast("帳號已停用，等待管理員審核啟用");
      navigate("/login");
    }
  });

  startRouter();
}

boot();
