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
import { signInWithGoogle, signOutUser, resolveMember, watchAuthState, getCurrentMember } from "./auth.js";
import { registerRoute, setBeforeEach, startRouter, navigate } from "./router.js";
import { showToast } from "./utils.js";

let isLoggedIn = false;

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
   首頁（#/home）— 骨架階段先放最基本內容
   正式內容（天氣區塊、抽籤大按鈕、朋友新分享、當季食材）
   等全部功能討論完、mockup 確認後再補上
--------------------------------------------------------- */
function renderHomePage(container) {
  const member = getCurrentMember();
  container.innerHTML = `
    <div class="placeholder-page">
      <p>歡迎回來，${member?.displayName || "朋友"}！</p>
      <p>首頁的完整內容（天氣、抽籤、朋友新分享、當季食材）還在等各功能討論完後才會補上。</p>
    </div>
  `;
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
   導覽列的顯示/隱藏、登出按鈕
--------------------------------------------------------- */
function setHeaderVisible(visible) {
  document.getElementById("app-header").classList.toggle("hidden", !visible);
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOutUser();
  setHeaderVisible(false);
  navigate("/login");
});

/* ---------------------------------------------------------
   路由註冊
--------------------------------------------------------- */
registerRoute("/setup", renderSetupPage);
registerRoute("/login", renderLoginPage);
registerRoute("/home", renderHomePage);
registerRoute("/recipes", renderPlaceholderPage("食譜"));
registerRoute("/diary", renderPlaceholderPage("料理日記"));
registerRoute("/expenses", renderPlaceholderPage("花費記錄"));
registerRoute("/friends", renderPlaceholderPage("朋友"));
registerRoute("/settings", renderPlaceholderPage("設定"));

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
    setHeaderVisible(false);
    startRouter();
    navigate("/setup");
    return;
  }

  initFirebase();

  watchAuthState(async (firebaseUser) => {
    if (!firebaseUser) {
      isLoggedIn = false;
      setHeaderVisible(false);
      navigate("/login");
      return;
    }

    const result = await resolveMember(firebaseUser);

    if (result === "ok") {
      isLoggedIn = true;
      setHeaderVisible(true);
      if (window.location.hash === "#/login" || !window.location.hash) {
        navigate("/home");
      }
    } else if (result === "not_whitelisted") {
      isLoggedIn = false;
      setHeaderVisible(false);
      await signOutUser();
      showToast("這個帳號還不在成員名單裡，請聯絡管理員");
      navigate("/login");
    } else if (result === "disabled") {
      isLoggedIn = false;
      setHeaderVisible(false);
      await signOutUser();
      showToast("帳號已停用，等待管理員審核啟用");
      navigate("/login");
    }
  });

  startRouter();
}

boot();
