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
import { signInWithGoogle, signOutUser, resolveMember, watchAuthState, getCurrentMember, isAdmin, updateMyTheme, updateMyAvatar, getMemberById } from "./auth.js";
import { getAppSettings, saveAppSettings, isAppSettingsComplete } from "./app-settings.js";
import { uploadRecipeImage } from "./recipe-images.js";
import { renderRecipeListPage, renderRecipeDetailPage, renderRecipeFormPage, renderSearchPage } from "./recipe-pages.js";
import { getTopPublicRecipes, getRecentPublicRecipes } from "./recipes.js";
import { openLotteryFlow } from "./lottery.js";
import { renderDiaryPage } from "./diary-pages.js";
import { cleanupExpiredEntries } from "./diary.js";
import { catchUpWeeklySummaries } from "./weekly-summary.js";
import { getHomeWeatherDisplay } from "./weather.js";
import { requestAutoLocation, setManualCity, getWeatherMode } from "./location.js";
import { renderFriendsListPage, renderMemberProfilePage } from "./friends-pages.js";
import { getCurrentChallenge, markChallengeComplete, createChallenge, endChallenge, autoExpireChallenges, listActiveChallenges, listEndedChallenges, approveChallengeCompletion, rejectChallengeCompletion, listChallengesWithPendingReview, autoResolveStalePendingReviews } from "./challenges.js";
import { registerRoute, setBeforeEach, setOnRouteChange, startRouter, navigate } from "./router.js";
import { showToast, showConfirm } from "./utils.js";

let isLoggedIn = false;

const THEME_STORAGE_KEY = "recipeApp.theme";
const ICON_IMAGE = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 3 3 4-4 5 5"/></svg>';
const ICON_CLOUD = '<svg class="icon" viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.6A4 4 0 0 1 17 18H7Z"/></svg>';
const ICON_CALENDAR = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
const ICON_CHALLENGE_ADMIN = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 3v18M5 4h11l-2 3.5L16 11H5"/></svg>';
const ICON_PALETTE = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.9.9-1.7-.6-.7-.3-1.8.7-1.8H15a5 5 0 0 0 5-5c0-5.5-3.6-9.5-8-9.5Z"/><circle cx="7.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="8" r="1.1" fill="currentColor" stroke="none"/></svg>';
const ICON_GEAR = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L10 21h4l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/></svg>';
const ICON_LOGOUT = '<svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>';
const ICON_CAMERA_SM = '<svg class="icon" viewBox="0 0 24 24" style="width:12px;height:12px"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>';
const ICON_REFRESH = '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66"/><path d="M17 3v4h-4M7 21v-4h4"/></svg>';

const THEME_OPTIONS = [
  { value: "terracotta", label: "陶土橘", swatch: "#D9773F" },
  { value: "sage", label: "鼠尾草綠", swatch: "#7A9B5E" },
  { value: "blue-grey", label: "霧藍灰", swatch: "#5B84A0" },
  { value: "rose", label: "霧玫瑰", swatch: "#C97B82" },
  { value: "taupe", label: "奶茶駝", swatch: "#B8874F" },
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
          連續登入 ${member?.loginStreakCurrent || 1} 天
        </div>
      </div>
      <div id="home-weather"><div class="weather-line"><span class="weather-date">${dateLabel}</span></div></div>
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
        <h2>食譜精選</h2>
        <a href="#/recipes" id="home-recipes-more" class="more">看全部 ›</a>
      </div>
      <div class="segment segment-sm" id="home-recipes-toggle" style="margin:0 16px 12px">
        <button type="button" data-sort="recent" class="active">最新</button>
        <button type="button" data-sort="hot">熱門</button>
      </div>
      <div id="home-recipes"><div class="empty-state">載入中…</div></div>
    </div>

    <div class="home-section">
      <div class="home-section-head">
        <svg class="icon" viewBox="0 0 24 24"><path d="M5 3v18M5 4h11l-2 3.5L16 11H5"/></svg>
        <h2>本週挑戰</h2>
        <a href="#/challenges" id="home-challenge-count" class="more hidden"></a>
      </div>
      <div id="home-challenge"><div class="empty-state">載入中…</div></div>
    </div>
  `;

  loadHomeRecipeSections();
  loadHomeChallenge();
  loadHomeWeather();

  document.getElementById("lottery-btn").addEventListener("click", () => {
    openLotteryFlow();
  });
}

const HOME_NO_PHOTO_ICON = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 3 3 4-4 5 5"/></svg>';
const HOME_HEART_ICON = '<svg class="icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>';

const WEATHER_ICONS = {
  sunny: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4 12H2M22 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>',
  cloudy: '<svg class="icon" viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.6A4 4 0 0 1 17 18H7Z"/></svg>',
  rainy: '<svg class="icon" viewBox="0 0 24 24"><path d="M7 15a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.6A4 4 0 0 1 17 15H7Z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/></svg>',
  cold: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20M5.5 6l13 12M18.5 6l-13 12"/></svg>',
  hot: '<svg class="icon" viewBox="0 0 24 24"><path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z"/><circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg>',
};
const ICON_LOCATION_SM = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

async function loadHomeWeather() {
  const el = document.getElementById("home-weather");
  if (!el) return;

  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
  const dateLabel = `${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日星期${weekday}`;

  try {
    const w = await getHomeWeatherDisplay();

    if (w.needsLocationPrompt) {
      el.innerHTML = `
        <div class="weather-prompt">
          ${ICON_LOCATION_SM}
          <span>開啟定位就能看到今天的天氣</span>
          <div class="weather-prompt-actions">
            <button type="button" id="weather-allow-btn" class="weather-prompt-btn">開啟定位</button>
            <button type="button" id="weather-manual-btn" class="weather-prompt-btn weather-prompt-btn-ghost">手動選城市</button>
          </div>
        </div>
      `;
      document.getElementById("weather-allow-btn").addEventListener("click", async () => {
        const coords = await requestAutoLocation();
        if (coords) {
          loadHomeWeather();
        } else {
          showToast("定位被拒絕了，改用手動選城市吧");
          loadHomeWeather();
        }
      });
      document.getElementById("weather-manual-btn").addEventListener("click", () => openManualCityPrompt());
      return;
    }

    if (w.noData) {
      el.innerHTML = `<div class="weather-line"><span class="weather-date">${dateLabel}</span></div><div class="weather-quote">${w.quote}</div>`;
      return;
    }

    const icon = WEATHER_ICONS[w.category] || WEATHER_ICONS.cloudy;
    el.innerHTML = `
      <div class="weather-line">
        ${icon}
        ${w.cityName ? `${w.cityName}・` : ""}${w.temp}°C
        <span class="weather-dot">・</span>
        <span class="weather-date">${dateLabel}</span>
        ${w.stale ? '<span class="weather-stale">（天氣資料更新中）</span>' : ""}
      </div>
      <div class="weather-quote">${w.quote}</div>
    `;
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="weather-line"><span class="weather-date">${dateLabel}</span></div>`;
  }
}

function openManualCityPrompt() {
  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";
  overlay.innerHTML = `
    <div class="picker-box">
      <button type="button" class="dialog-close picker-close" aria-label="關閉">
        <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="sheet-title">選擇城市</div>
      <div class="field" style="margin-bottom:0">
        <input type="text" id="manual-city-input" placeholder="例如：台北、高雄">
      </div>
      <button type="button" id="manual-city-confirm" class="sheet-confirm" style="margin-top:14px">確定</button>
    </div>
  `;
  overlay.querySelector(".picker-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

  document.getElementById("manual-city-confirm").addEventListener("click", async () => {
    const city = document.getElementById("manual-city-input").value.trim();
    if (!city) return;
    try {
      await setManualCity(city);
      overlay.remove();
      loadHomeWeather();
    } catch (err) {
      console.error(err);
      showToast(err.message || "查詢失敗，請再試一次");
    }
  });
}

function updateWeatherModeLabel() {
  const label = document.getElementById("weather-mode-label");
  if (!label) return;
  const mode = getWeatherMode();
  label.textContent = mode === "auto" ? "自動定位" : mode === "manual" ? "手動選城市" : "尚未設定";
}

function openManualCityPromptInSettings() {
  openManualCityPrompt();
  // openManualCityPrompt 內部成功後會呼叫 loadHomeWeather()（在設定頁找不到首頁容器會自動跳過，不會出錯）
  // 這裡額外等一下再更新設定頁上的模式文字
  setTimeout(updateWeatherModeLabel, 600);
}

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
  const el = document.getElementById("home-recipes");
  if (!el) return; // 使用者可能已經換頁

  let currentSort = "recent";

  async function render(sort) {
    currentSort = sort;
    const moreLink = document.getElementById("home-recipes-more");
    if (moreLink) moreLink.href = `#/recipes?sort=${sort}`;

    el.innerHTML = `<div class="empty-state">載入中…</div>`;
    try {
      const recipes = sort === "hot" ? await getTopPublicRecipes(4) : await getRecentPublicRecipes(4);
      el.innerHTML = recipes.length
        ? `<div class="recipe-grid">${recipes.map(homeRecipeCardHtml).join("")}</div>`
        : `<div class="empty-state">${sort === "hot" ? "還沒有公開食譜，等大家分享後這裡會顯示最多人收藏的菜色。" : "還沒有公開食譜，等朋友發布新食譜後會顯示在這裡。"}</div>`;
    } catch (err) {
      console.error(err);
      el.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
    }
  }

  document.querySelectorAll("#home-recipes-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.sort === currentSort) return;
      document.querySelectorAll("#home-recipes-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
      render(btn.dataset.sort);
    });
  });

  render("recent");
}

/** 管理員登入時，如果有待審核的挑戰申請，主動跳提示提醒（純前端能做到的最接近「通知」的做法） */
async function notifyAdminOfPendingReviews() {
  if (!isAdmin()) return;
  try {
    const withPending = await listChallengesWithPendingReview();
    const total = withPending.reduce((sum, c) => sum + (c.pendingReview || []).length, 0);
    if (total > 0) {
      showToast(`你有 ${total} 筆挑戰待審核，記得去「本週挑戰」看看`);
    }
  } catch (err) {
    console.error("待審核提醒失敗", err);
  }
}

const ICON_CHALLENGE = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_CLOCK_URGENT = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

/** 距離期限還有幾天（今天算 0），deadline 是 "YYYY-MM-DD" */
function daysUntil(deadline) {
  if (!deadline) return null;
  const [y, m, d] = deadline.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}
const ICON_CHECK_SM = '<svg class="icon icon-sm icon-solid" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';

async function loadHomeChallenge() {
  const el = document.getElementById("home-challenge");
  const countEl = document.getElementById("home-challenge-count");
  if (!el) return;

  try {
    const allActive = await listActiveChallenges();
    const challenge = allActive[0];

    if (countEl) {
      if (allActive.length > 1) {
        countEl.textContent = `共 ${allActive.length} 個 ›`;
        countEl.classList.remove("hidden");
      } else {
        countEl.classList.add("hidden");
      }
    }

    if (!challenge) {
      el.innerHTML = `<div class="empty-state">還沒有挑戰資料，等管理員發布挑戰後會顯示在這裡。</div>`;
      return;
    }
    const member = getCurrentMember();
    const done = (challenge.completedBy || []).includes(member?.uid);
    const pending = (challenge.pendingReview || []).includes(member?.uid);
    const needsReview = challenge.verificationMode === "admin_review";
    const daysLeft = daysUntil(challenge.deadline);
    const urgent = daysLeft != null && daysLeft <= 2;

    let btnHtml;
    if (done) {
      btnHtml = `<button type="button" class="challenge-status-btn done" disabled>${ICON_CHECK_SM}已完成</button>`;
    } else if (pending) {
      btnHtml = `<button type="button" class="challenge-status-btn pending" disabled>審核中</button>`;
    } else {
      btnHtml = `<button type="button" id="home-challenge-btn" class="challenge-status-btn">${needsReview ? "提交完成" : "標記完成"}</button>`;
    }

    el.innerHTML = `
      <div class="challenge-card ${done ? "challenge-card-done" : ""}">
        ${ICON_CHALLENGE}
        <div class="challenge-body">
          <div class="challenge-title">${challenge.title}</div>
          ${challenge.description ? `<div class="challenge-desc">${challenge.description}</div>` : ""}
          ${challenge.deadline ? `<div class="challenge-deadline ${urgent ? "urgent" : ""}">${urgent ? ICON_CLOCK_URGENT : ""}${urgent ? "快到期・" : "期限至"} ${challenge.deadline}</div>` : ""}
        </div>
        ${btnHtml}
      </div>
    `;

    const btn = document.getElementById("home-challenge-btn");
    if (btn) {
      btn.addEventListener("click", async () => {
        const ok = await showConfirm(
          needsReview
            ? `確定要提交「${challenge.title}」這個挑戰嗎？提交後要等管理員審核才會計入徽章。`
            : `確定要標記完成「${challenge.title}」這個挑戰嗎？`
        );
        if (!ok) return;

        btn.disabled = true;
        try {
          const result = await markChallengeComplete(challenge.id, member.uid);
          if (result === "pending") {
            showToast("已提交，等管理員審核");
          } else if (result === "done") {
            showToast("完成挑戰！已計入你的挑戰徽章");
          }
          loadHomeChallenge();
        } catch (err) {
          console.error(err);
          showToast("操作失敗，請再試一次");
          btn.disabled = false;
        }
      });
    }
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
  }
}

/** 成員版「全部挑戰」列表頁（#/challenges），每個挑戰都能個別標記完成 */
async function renderAllChallengesPage(container) {
  container.innerHTML = `
    <div class="page-head">
      <button id="all-challenges-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>全部挑戰</h1>
    </div>
    <div id="all-challenges-list" class="challenge-admin-list"><p class="form-hint" style="padding:0 16px">載入中…</p></div>
  `;
  document.getElementById("all-challenges-back").addEventListener("click", () => navigate("/home"));

  await renderAllChallengesList();
}

async function renderAllChallengesList() {
  const listEl = document.getElementById("all-challenges-list");
  if (!listEl) return;

  try {
    const challenges = await listActiveChallenges();
    const member = getCurrentMember();

    if (challenges.length === 0) {
      listEl.innerHTML = `<p class="form-hint" style="padding:0 16px">目前沒有進行中的挑戰。</p>`;
      return;
    }

    listEl.innerHTML = challenges
      .map((c) => {
        const done = (c.completedBy || []).includes(member?.uid);
        const pending = (c.pendingReview || []).includes(member?.uid);
        const needsReview = c.verificationMode === "admin_review";
        const daysLeft = daysUntil(c.deadline);
        const urgent = daysLeft != null && daysLeft <= 2;

        let btnHtml;
        if (done) {
          btnHtml = `<button type="button" class="challenge-status-btn done" disabled>${ICON_CHECK_SM}已完成</button>`;
        } else if (pending) {
          btnHtml = `<button type="button" class="challenge-status-btn pending" disabled>審核中</button>`;
        } else {
          btnHtml = `<button type="button" class="challenge-status-btn all-challenge-btn" data-id="${c.id}" data-title="${c.title}" data-review="${needsReview}">${needsReview ? "提交完成" : "標記完成"}</button>`;
        }

        return `
          <div class="challenge-admin-item ${done ? "challenge-card-done" : ""}">
            <div class="challenge-admin-item-title">${c.title}</div>
            ${c.description ? `<div class="challenge-admin-item-desc">${c.description}</div>` : ""}
            <div class="challenge-admin-item-meta">
              <span class="${urgent ? "urgent" : ""}">${urgent ? "快到期・" : "期限至"} ${c.deadline}</span>
              <span>${(c.completedBy || []).length} 人已完成</span>
            </div>
            ${btnHtml}
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".all-challenge-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const needsReview = btn.dataset.review === "true";
        const ok = await showConfirm(
          needsReview
            ? `確定要提交「${btn.dataset.title}」這個挑戰嗎？提交後要等管理員審核才會計入徽章。`
            : `確定要標記完成「${btn.dataset.title}」這個挑戰嗎？`
        );
        if (!ok) return;
        btn.disabled = true;
        try {
          const result = await markChallengeComplete(btn.dataset.id, member.uid);
          if (result === "pending") showToast("已提交，等管理員審核");
          else if (result === "done") showToast("完成挑戰！已計入你的挑戰徽章");
          renderAllChallengesList();
        } catch (err) {
          console.error(err);
          showToast("操作失敗，請再試一次");
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p class="form-hint" style="padding:0 16px">載入失敗，請重新整理再試。</p>`;
  }
}

/* ---------------------------------------------------------
   管理設定頁面（#/app-config）— 管理員填 Cloudinary／天氣金鑰
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
    <div class="page-head">
      <button id="config-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>管理設定</h1>
    </div>
    <p class="settings-page-desc">管理員專屬，全部人共用一份，存在 Firestore，改了不用碰程式碼、不用重新部署。</p>

    <div class="settings-group">
      <div class="settings-group-title">${ICON_IMAGE}Cloudinary（食譜圖片）</div>
      <div class="settings-card">
        <div class="field">
          <label for="field-cloudinaryCloudName">Cloud name</label>
          <input type="text" id="field-cloudinaryCloudName" value="${settings.cloudinaryCloudName}" />
        </div>
        <div class="field" style="margin-bottom:0">
          <label for="field-cloudinaryUploadPreset">Upload preset 名稱</label>
          <input type="text" id="field-cloudinaryUploadPreset" value="${settings.cloudinaryUploadPreset}" />
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">${ICON_CLOUD}OpenWeatherMap（天氣）</div>
      <div class="settings-card">
        <div class="field" style="margin-bottom:0">
          <label for="field-openWeatherApiKey">API key</label>
          <input type="text" id="field-openWeatherApiKey" value="${settings.openWeatherApiKey}" />
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">${ICON_CALENDAR}料理日記</div>
      <div class="settings-card">
        <div class="field" style="margin-bottom:0">
          <label for="field-diaryRetentionMonths">保留期限（幾個月，超過自動清除）</label>
          <input type="number" id="field-diaryRetentionMonths" min="1" step="1" value="${settings.diaryRetentionMonths}" />
        </div>
      </div>
    </div>

    <div class="settings-save-bar">
      <button id="app-config-save-btn" class="btn btn-primary settings-save-btn">儲存</button>
    </div>
  `;

  document.getElementById("config-back").addEventListener("click", () => navigate("/settings"));

  document.getElementById("app-config-save-btn").addEventListener("click", async () => {
    const updates = {
      cloudinaryCloudName: document.getElementById("field-cloudinaryCloudName").value.trim(),
      cloudinaryUploadPreset: document.getElementById("field-cloudinaryUploadPreset").value.trim(),
      openWeatherApiKey: document.getElementById("field-openWeatherApiKey").value.trim(),
      diaryRetentionMonths: Number(document.getElementById("field-diaryRetentionMonths").value) || 18,
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

/** 「本週挑戰」管理頁面（#/challenge-admin）：管理員專屬，跟管理設定平行、不再巢狀在裡面 */
async function renderChallengeAdminPage(container) {
  if (!isAdmin()) {
    container.innerHTML = `<div class="placeholder-page"><p>這頁只有管理員能用</p></div>`;
    return;
  }

  const defaultDeadline = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  container.innerHTML = `
    <div class="page-head">
      <button id="challenge-admin-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>本週挑戰</h1>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">發布新挑戰</div>
      <div class="settings-card">
        <div class="field">
          <label for="challenge-title-input">標題</label>
          <input type="text" id="challenge-title-input" placeholder="例如：這週煮 3 道不重複的菜">
        </div>
        <div class="field">
          <label for="challenge-desc-input">說明（可空）</label>
          <textarea id="challenge-desc-input" placeholder="補充規則或提示"></textarea>
        </div>
        <div class="field" style="margin-bottom:0">
          <label for="challenge-deadline-input">期限（到這天為止，過了自動結束）</label>
          <input type="date" id="challenge-deadline-input" value="${defaultDeadline}">
        </div>
        <div class="field" style="margin-bottom:0; margin-top:14px">
          <label>完成方式</label>
          <div class="segment segment-sm" id="challenge-mode-toggle">
            <button type="button" class="active" data-mode="self">自行標記</button>
            <button type="button" data-mode="admin_review">需要審核</button>
          </div>
          <div class="form-hint" style="margin-top:6px">簡單、好判斷的挑戰選「自行標記」；需要看照片或證明的挑戰選「需要審核」，成員提交後你要在下面核准才算數。</div>
        </div>
        <button type="button" id="challenge-create-btn" class="btn btn-primary" style="margin-top:12px;width:100%">發布新挑戰</button>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">待審核</div>
      <div id="challenge-pending-list" class="challenge-admin-list"><p class="form-hint" style="padding:0 16px">載入中…</p></div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">進行中</div>
      <div id="challenge-active-list" class="challenge-admin-list"><p class="form-hint" style="padding:0 16px">載入中…</p></div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">已結束</div>
      <div id="challenge-ended-list" class="challenge-admin-list"><p class="form-hint" style="padding:0 16px">載入中…</p></div>
    </div>
  `;

  document.getElementById("challenge-admin-back").addEventListener("click", () => navigate("/settings"));

  let selectedMode = "self";
  document.querySelectorAll("#challenge-mode-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedMode = btn.dataset.mode;
      document.querySelectorAll("#challenge-mode-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  document.getElementById("challenge-create-btn").addEventListener("click", async () => {
    const title = document.getElementById("challenge-title-input").value.trim();
    const desc = document.getElementById("challenge-desc-input").value.trim();
    const deadline = document.getElementById("challenge-deadline-input").value;
    if (!title) {
      showToast("請填挑戰標題");
      return;
    }
    if (!deadline) {
      showToast("請選期限");
      return;
    }
    try {
      await createChallenge(title, desc, deadline, selectedMode, getCurrentMember()?.uid);
      showToast("已發布新挑戰");
      document.getElementById("challenge-title-input").value = "";
      document.getElementById("challenge-desc-input").value = "";
      loadChallengeLists();
    } catch (err) {
      console.error(err);
      showToast("發布失敗，請再試一次");
    }
  });

  loadChallengeLists();
}

function challengeAdminCardHtml(c, { ended }) {
  return `
    <div class="challenge-admin-item ${ended ? "ended" : ""}">
      <div class="challenge-admin-item-title">
        ${c.title}
        ${c.verificationMode === "admin_review" ? '<span class="challenge-mode-tag">需審核</span>' : ""}
      </div>
      ${c.description ? `<div class="challenge-admin-item-desc">${c.description}</div>` : ""}
      <div class="challenge-admin-item-meta">
        <span>${ended ? "期限至" : "還剩到"} ${c.deadline}</span>
        <span>${(c.completedBy || []).length} 人已完成</span>
      </div>
      ${!ended ? `<button type="button" class="btn btn-ghost challenge-admin-end-btn" data-id="${c.id}" data-title="${c.title}">結束這個挑戰</button>` : ""}
    </div>
  `;
}

async function pendingReviewCardHtml(c) {
  const uids = c.pendingReview || [];
  if (uids.length === 0) return "";
  const members = await Promise.all(uids.map((uid) => getMemberById(uid)));
  const rows = members
    .map(
      (m, i) => `
      <div class="challenge-pending-row">
        <span>${m?.displayName || "朋友"}</span>
        <div class="challenge-pending-actions">
          <button type="button" class="challenge-approve-btn" data-cid="${c.id}" data-uid="${uids[i]}" data-name="${m?.displayName || "朋友"}">核准</button>
          <button type="button" class="challenge-reject-btn" data-cid="${c.id}" data-uid="${uids[i]}" data-name="${m?.displayName || "朋友"}">拒絕</button>
        </div>
      </div>`
    )
    .join("");
  return `
    <div class="challenge-admin-item">
      <div class="challenge-admin-item-title">${c.title}</div>
      ${rows}
    </div>
  `;
}

async function loadChallengeLists() {
  const activeEl = document.getElementById("challenge-active-list");
  const endedEl = document.getElementById("challenge-ended-list");
  const pendingEl = document.getElementById("challenge-pending-list");
  if (!activeEl || !endedEl || !pendingEl) return;

  try {
    const [active, ended] = await Promise.all([listActiveChallenges(), listEndedChallenges()]);

    activeEl.innerHTML = active.length
      ? active.map((c) => challengeAdminCardHtml(c, { ended: false })).join("")
      : `<p class="form-hint" style="padding:0 16px">目前沒有進行中的挑戰。</p>`;

    endedEl.innerHTML = ended.length
      ? ended.map((c) => challengeAdminCardHtml(c, { ended: true })).join("")
      : `<p class="form-hint" style="padding:0 16px">還沒有結束過的挑戰。</p>`;

    const withPending = await listChallengesWithPendingReview();
    if (withPending.length === 0) {
      pendingEl.innerHTML = `<p class="form-hint" style="padding:0 16px">目前沒有待審核的項目。</p>`;
    } else {
      const cards = await Promise.all(withPending.map(pendingReviewCardHtml));
      pendingEl.innerHTML = cards.join("");
    }

    pendingEl.querySelectorAll(".challenge-approve-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await showConfirm(`確定要核准「${btn.dataset.name}」完成這個挑戰嗎？核准後會計入對方的挑戰徽章。`);
        if (!ok) return;
        try {
          await approveChallengeCompletion(btn.dataset.cid, btn.dataset.uid);
          showToast("已核准，計入對方的挑戰徽章");
          loadChallengeLists();
        } catch (err) {
          console.error(err);
          showToast("操作失敗，請再試一次");
        }
      });
    });
    pendingEl.querySelectorAll(".challenge-reject-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await showConfirm(`確定要拒絕「${btn.dataset.name}」這次的提交嗎？如果期限還沒到，對方還可以重新提交。`);
        if (!ok) return;
        try {
          await rejectChallengeCompletion(btn.dataset.cid, btn.dataset.uid);
          showToast("已拒絕");
          loadChallengeLists();
        } catch (err) {
          console.error(err);
          showToast("操作失敗，請再試一次");
        }
      });
    });

    activeEl.querySelectorAll(".challenge-admin-end-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await showConfirm(`確定要結束「${btn.dataset.title}」這個挑戰嗎？`);
        if (!ok) return;
        try {
          await endChallenge(btn.dataset.id);
          showToast("已結束");
          loadChallengeLists();
        } catch (err) {
          console.error(err);
          showToast("操作失敗，請再試一次");
        }
      });
    });
  } catch (err) {
    console.error(err);
    activeEl.innerHTML = `<p class="form-hint" style="padding:0 16px">載入失敗，請重新整理再試。</p>`;
    endedEl.innerHTML = "";
    pendingEl.innerHTML = "";
  }
}

/* ---------------------------------------------------------
   設定頁（#/settings）
   ----------------------------------------------------------
   個人化設定（通知開關、Discord Webhook 等）之後功能討論到
   再補進來。
--------------------------------------------------------- */
function renderSettingsPage(container) {
  const member = getCurrentMember();
  const currentTheme = member?.theme || "terracotta";

  container.innerHTML = `
    <div class="page-head"><h1>設定</h1></div>

    <div class="settings-profile-card">
      <button type="button" id="avatar-upload-btn" class="settings-profile-avatar-btn" style="${member?.photoURL ? `background-image:url('${member.photoURL}')` : ""}">
        ${member?.photoURL ? "" : (member?.displayName || "?").slice(0, 1)}
        <span class="settings-avatar-edit-badge">${ICON_CAMERA_SM}</span>
      </button>
      <input type="file" id="avatar-file-input" accept="image/*" class="hidden" />
      <div>
        <div class="settings-profile-name">${member?.displayName || ""}</div>
        <div class="settings-profile-role">${isAdmin() ? "管理員" : "一般成員"}</div>
      </div>
    </div>

    <div class="settings-group">
      <button type="button" id="settings-refresh-btn" class="settings-link-card">
        <div class="settings-link-icon">${ICON_REFRESH}</div>
        <div class="settings-link-text">
          <div class="settings-link-title">重新整理 APP</div>
          <div class="settings-link-desc">畫面看起來卡卡的、或功能好像沒更新時按這個</div>
        </div>
      </button>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">${ICON_PALETTE}外觀</div>
      <div class="settings-card">
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
    </div>

    <div class="settings-group">
      <div class="settings-group-title">${ICON_CLOUD}天氣</div>
      <div class="settings-card">
        <p class="form-hint" style="margin:0 0 10px">目前模式：<strong id="weather-mode-label">讀取中…</strong></p>
        <div style="display:flex;gap:8px">
          <button type="button" id="weather-switch-auto" class="btn btn-ghost" style="flex:1">切回自動定位</button>
          <button type="button" id="weather-switch-manual" class="btn btn-ghost" style="flex:1">改成手動選城市</button>
        </div>
      </div>
    </div>

    ${
      isAdmin()
        ? `<div class="settings-group">
            <div class="settings-group-title">管理員專區</div>
            <div class="settings-link-stack">
              <a href="#/app-config" class="settings-link-card">
                <div class="settings-link-icon">${ICON_GEAR}</div>
                <div class="settings-link-text">
                  <div class="settings-link-title">管理設定</div>
                  <div class="settings-link-desc">第三方服務金鑰、料理日記保留期限</div>
                </div>
                <svg class="icon settings-link-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
              </a>
              <a href="#/challenge-admin" class="settings-link-card">
                <div class="settings-link-icon">${ICON_CHALLENGE_ADMIN}</div>
                <div class="settings-link-text">
                  <div class="settings-link-title">本週挑戰</div>
                  <div class="settings-link-desc">發布新挑戰、結束目前的挑戰</div>
                </div>
                <svg class="icon settings-link-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
              </a>
            </div>
          </div>`
        : ""
    }

    <div class="settings-group">
      <button id="settings-logout-btn" class="settings-link-card settings-link-danger">
        <div class="settings-link-icon">${ICON_LOGOUT}</div>
        <div class="settings-link-text"><div class="settings-link-title">登出</div></div>
      </button>
    </div>
  `;

  document.getElementById("settings-refresh-btn").addEventListener("click", () => {
    const base = window.location.origin + window.location.pathname;
    window.location.href = `${base}?v=${Date.now()}#/home`;
  });

  const avatarBtn = document.getElementById("avatar-upload-btn");
  const avatarInput = document.getElementById("avatar-file-input");
  avatarBtn.addEventListener("click", () => avatarInput.click());
  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    avatarBtn.innerHTML = `<span class="settings-avatar-uploading">上傳中…</span>`;
    try {
      const url = await uploadRecipeImage(file);
      await updateMyAvatar(url);
      showToast("大頭貼已更新");
      renderSettingsPage(container);
    } catch (err) {
      console.error(err);
      showToast(err.message || "上傳失敗，請再試一次");
      renderSettingsPage(container);
    }
  });

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

  updateWeatherModeLabel();
  document.getElementById("weather-switch-auto").addEventListener("click", async () => {
    const coords = await requestAutoLocation();
    if (coords) {
      showToast("已切回自動定位");
    } else {
      showToast("瀏覽器沒有再次詢問授權（可能之前拒絕過），請到瀏覽器網址列的鎖頭圖示手動開啟定位權限");
    }
    updateWeatherModeLabel();
  });
  document.getElementById("weather-switch-manual").addEventListener("click", () => {
    openManualCityPromptInSettings();
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
registerRoute("/search", renderSearchPage, { hideTabbar: true });
registerRoute("/recipes/:id/edit", renderRecipeFormPage, { hideTabbar: true });
registerRoute("/recipes/:id", renderRecipeDetailPage, { hideTabbar: true });
registerRoute("/diary", renderDiaryPage);
registerRoute("/expenses", renderPlaceholderPage("花費記錄"));
registerRoute("/friends", renderFriendsListPage);
registerRoute("/challenges", renderAllChallengesPage, { hideTabbar: true });
registerRoute("/friends/:uid", renderMemberProfilePage, { hideTabbar: true });
registerRoute("/settings", renderSettingsPage);
registerRoute("/app-config", renderAppConfigPage, { hideTabbar: true });
registerRoute("/challenge-admin", renderChallengeAdminPage, { hideTabbar: true });

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
      cleanupExpiredEntries(getCurrentMember()?.uid).catch((err) => console.error("日記過期清理失敗", err));
      catchUpWeeklySummaries(getCurrentMember()?.uid).catch((err) => console.error("每週結算補算失敗", err));
      autoExpireChallenges().catch((err) => console.error("挑戰自動到期檢查失敗", err));
      autoResolveStalePendingReviews().catch((err) => console.error("挑戰待審核逾期檢查失敗", err));
      notifyAdminOfPendingReviews();
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
