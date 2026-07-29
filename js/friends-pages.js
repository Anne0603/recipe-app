/* ==========================================================
   friends-pages.js — 朋友系統畫面：成員列表、個人頁面
   ========================================================== */

import { listMembersForFriendsPage, getMemberStats } from "./friends.js";
import { getUserBadgeSummary, BADGE_CATEGORIES, getLeaderboard } from "./badges.js";
import { getMemberById } from "./auth.js";
import { listPublicRecipes } from "./recipes.js";
import { listAllChallenges } from "./challenges.js";
import { navigate } from "./router.js";
import { showToast } from "./utils.js";

const ICON_NO_PHOTO = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 3 3 4-4 5 5"/></svg>';
const ICON_HEART = '<svg class="icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>';
const ICON_BADGE = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M9 14.5L7 21l5-3 5 3-2-6.5"/></svg>';
const ICON_TROPHY_SM = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M5 3v18M5 4h11l-2 3.5L16 11H5"/></svg>';
const ICON_BOOK = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 4a2 2 0 0 1 2-2h11v18H7a2 2 0 0 0-2 2V4Z"/><path d="M8 7h6M8 10h6"/></svg>';
const ICON_CHEV_RIGHT = '<svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';

function initials(name) {
  return (name || "?").trim().slice(0, 1);
}

function avatarHtml(member, size = "md") {
  const cls = `friend-avatar friend-avatar-${size}`;
  if (member?.photoURL) {
    return `<img class="${cls}" src="${member.photoURL}" alt="${member.displayName || ""}" />`;
  }
  return `<div class="${cls} friend-avatar-fallback">${initials(member?.displayName)}</div>`;
}

function formatJoinedDate(ts) {
  if (!ts) return "";
  const millis = typeof ts.toMillis === "function" ? ts.toMillis() : ts.seconds ? ts.seconds * 1000 : 0;
  if (!millis) return "";
  const d = new Date(millis);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月加入`;
}

/* ==========================================================
   成員列表（#/friends）
   ========================================================== */
export async function renderFriendsListPage(container) {
  container.innerHTML = `
    <div class="page-head">
      <h1>朋友</h1>
      <a href="#/leaderboard" class="more">${ICON_TROPHY_SM}排行榜</a>
    </div>
    <div id="friends-list-body"><div class="loading-screen"><p>載入中…</p></div></div>
  `;

  try {
    const members = await listMembersForFriendsPage();
    const body = document.getElementById("friends-list-body");

    if (members.length === 0) {
      body.innerHTML = `<div class="empty-state">還沒有成員資料。</div>`;
      return;
    }

    body.innerHTML = `
      <div class="friend-list">
        ${members
          .map(
            (m) => `
          <a href="#/friends/${m.uid}" class="friend-row">
            ${avatarHtml(m, "md")}
            <div class="friend-row-text">
              <div class="friend-row-name">${m.displayName || "朋友"}</div>
              <div class="friend-row-sub">${m.bio || (m.lastActiveAt ? "最近有新分享" : formatJoinedDate(m.joinedAt) || "成員")}</div>
            </div>
            ${ICON_CHEV_RIGHT}
          </a>`
          )
          .join("")}
      </div>
    `;
  } catch (err) {
    console.error(err);
    document.getElementById("friends-list-body").innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
  }
}

/* ==========================================================
   個人頁面（#/friends/:uid）
   ========================================================== */
export async function renderMemberProfilePage(container, params) {
  container.innerHTML = `<div class="loading-screen"><p>載入中…</p></div>`;

  const member = await getMemberById(params.uid);
  if (!member) {
    container.innerHTML = `<div class="placeholder-page"><p>找不到這位成員。</p></div>`;
    return;
  }

  const stats = await getMemberStats(params.uid);
  const badges = await getUserBadgeSummary(params.uid);

  container.innerHTML = `
    <div class="page-head">
      <button id="profile-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    </div>

    <div class="friend-profile-head">
      ${avatarHtml(member, "lg")}
      <div class="friend-profile-head-text">
        <div class="friend-profile-name">${member.displayName || "朋友"}</div>
        ${member.bio ? `<div class="friend-profile-bio">${member.bio}</div>` : ""}
        <div class="friend-profile-joined">${formatJoinedDate(member.joinedAt)}</div>
      </div>
    </div>

    <div class="friend-stats-row">
      <div class="friend-stat-pill">${ICON_BOOK}<div class="friend-stat-val">${stats.publicRecipeCount}</div><div class="friend-stat-label">公開食譜</div></div>
      <div class="friend-stat-pill">${ICON_HEART}<div class="friend-stat-val">${stats.totalHearts}</div><div class="friend-stat-label">被收藏次數</div></div>
    </div>

    <div class="home-section">
      <div class="home-section-head">${ICON_BADGE}<h2>徽章</h2></div>
      <div class="badge-grid">
        ${badges
          .map((b) => {
            const clickable = true;
            return `
          <div class="badge-card ${b.tier === 0 ? "badge-card-empty" : ""} ${clickable ? "badge-card-clickable" : ""}" data-key="${b.key}">
            <div class="badge-card-icon">${b.icon}</div>
            <div class="badge-card-label">${b.label}</div>
            ${b.tier > 0 ? `<div class="badge-card-tier">Lv.${b.tier}</div><div class="badge-card-stars">${"★".repeat(b.star)}${"☆".repeat(3 - b.star)}</div>` : `<div class="badge-card-tier badge-card-tier-empty">尚未達成</div>`}
          </div>`;
          })
          .join("")}
      </div>
    </div>

    <div class="home-section">
      <div class="home-section-head">
        ${ICON_BOOK}
        <h2>公開食譜</h2>
      </div>
      <div class="segment segment-sm" id="profile-sort-toggle">
        <button type="button" class="active" data-sort="recent">最新</button>
        <button type="button" data-sort="hot">熱門</button>
      </div>
      <div id="profile-recipe-grid"><div class="empty-state">載入中…</div></div>
    </div>
  `;

  document.getElementById("profile-back").addEventListener("click", () => window.history.back());

  document.querySelectorAll(".badge-card-clickable").forEach((card) => {
    card.addEventListener("click", () => handleBadgeClick(card.dataset.key, { member, stats, badges }));
  });

  async function loadRecipes(sort) {
    const gridEl = document.getElementById("profile-recipe-grid");
    gridEl.innerHTML = `<div class="empty-state">載入中…</div>`;
    try {
      const all = await listPublicRecipes({ sort });
      const mine = all.filter((r) => r.ownerId === params.uid);
      if (mine.length === 0) {
        gridEl.innerHTML = `<div class="empty-state">還沒有公開食譜。</div>`;
        return;
      }
      gridEl.innerHTML = `<div class="recipe-grid">${mine.map(recipeCardHtml).join("")}</div>`;
    } catch (err) {
      console.error(err);
      gridEl.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
    }
  }

  document.querySelectorAll("#profile-sort-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#profile-sort-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
      loadRecipes(btn.dataset.sort);
    });
  });

  await loadRecipes("recent");
}

function recipeCardHtml(recipe) {
  const tags = (recipe.styles || []).slice(0, 2).map((s) => `<span>${s}</span>`).join("");
  return `
    <a href="#/recipes/${recipe.id}" class="recipe-card">
      <div class="recipe-cover" style="${recipe.coverImageUrl ? `background-image:url('${recipe.coverImageUrl}')` : ""}">
        ${recipe.coverImageUrl ? "" : ICON_NO_PHOTO}
      </div>
      <div class="recipe-info">
        <div class="recipe-name">${recipe.name}</div>
        <div class="recipe-tags">${tags}</div>
        <div class="recipe-meta">
          <div></div>
          <div class="recipe-like-count">${ICON_HEART}${(recipe.likedBy || []).length}</div>
        </div>
      </div>
    </a>
  `;
}

function showInfoModal(title, bodyHtml) {
  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";
  overlay.innerHTML = `
    <div class="picker-box">
      <button type="button" class="dialog-close picker-close" aria-label="關閉">
        <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="sheet-title">${title}</div>
      <div class="badge-detail-body">${bodyHtml}</div>
    </div>
  `;
  overlay.querySelector(".picker-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

async function handleBadgeClick(key, { member, stats, badges }) {
  const badge = badges.find((b) => b.key === key);

  if (key === "loginStreak") {
    showInfoModal(
      "連續登入",
      `<div class="badge-detail-stats">
         <div class="badge-detail-stat">
           <div class="badge-detail-stat-val">${member.loginStreakCurrent || 0}</div>
           <div class="badge-detail-stat-label">目前連續天數</div>
         </div>
         <div class="badge-detail-stat">
           <div class="badge-detail-stat-val">${badge?.count || 0}</div>
           <div class="badge-detail-stat-label">歷史最高天數</div>
         </div>
       </div>`
    );
    return;
  }

  if (key === "sharing") {
    const cumulative = badge?.count || 0;
    const live = stats.publicRecipeCount;
    const diff = Math.max(0, cumulative - live);
    showInfoModal(
      "分享",
      `<div class="badge-detail-stats">
         <div class="badge-detail-stat">
           <div class="badge-detail-stat-val">${cumulative}</div>
           <div class="badge-detail-stat-label">累計分享過</div>
         </div>
         <div class="badge-detail-stat">
           <div class="badge-detail-stat-val">${live}</div>
           <div class="badge-detail-stat-label">目前公開中</div>
         </div>
       </div>
       <p class="badge-detail-note">徽章看的是「累計分享過」，只會往上加${diff > 0 ? `；另外 ${diff} 道後來設回私人，還是有算進成就裡` : ""}</p>`
    );
    return;
  }

  if (key === "popularity") {
    const cumulative = badge?.count || 0;
    const live = stats.totalHearts;
    showInfoModal(
      "人氣",
      `<div class="badge-detail-stats">
         <div class="badge-detail-stat">
           <div class="badge-detail-stat-val">${cumulative}</div>
           <div class="badge-detail-stat-label">歷史累計收藏</div>
         </div>
         <div class="badge-detail-stat">
           <div class="badge-detail-stat-val">${live}</div>
           <div class="badge-detail-stat-label">目前即時收藏</div>
         </div>
       </div>
       <p class="badge-detail-note">徽章看的是「歷史累計」，只會往上加${cumulative > live ? "，可能有人後來取消收藏，所以即時數字比較小" : ""}</p>`
    );
    return;
  }

  if (key === "challenge") {
    showInfoModal("已完成的挑戰", `<p class="form-hint">載入中…</p>`);
    try {
      const all = await listAllChallenges();
      const completed = all.filter((c) => (c.completedBy || []).includes(member.uid));
      const bodyHtml = completed.length
        ? `<div class="badge-detail-stats"><div class="badge-detail-stat"><div class="badge-detail-stat-val">${completed.length}</div><div class="badge-detail-stat-label">已完成挑戰數</div></div></div>` +
          completed.map((c) => `<div class="challenge-detail-row">${ICON_TROPHY_SM}${c.title}</div>`).join("")
        : `<p class="form-hint">還沒有完成過挑戰。</p>`;
      document.querySelectorAll(".picker-overlay").forEach((o) => o.remove());
      showInfoModal("已完成的挑戰", bodyHtml);
    } catch (err) {
      console.error(err);
      showToast("載入失敗，請再試一次");
    }
    return;
  }

  if (key === "cooking") {
    navigate(`/friends/${member.uid}/recipes`);
  }
}

/* ==========================================================
   成員的公開食譜（#/friends/:uid/recipes）
   ----------------------------------------------------------
   點「料理」徽章進來，自己、別人的頁面都能點。
   列出這個人全部的公開食譜，可以用菜名/標籤搜尋。
   ========================================================== */
export async function renderMemberRecipesPage(container, params) {
  const member = await getMemberById(params.uid);

  container.innerHTML = `
    <div class="page-head">
      <button id="member-recipes-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>${member?.displayName || "朋友"}的食譜</h1>
    </div>
    <div class="search-input-row">
      <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="text" id="member-recipes-search" placeholder="搜尋菜名、標籤...">
    </div>
    <div id="member-recipes-grid"><div class="empty-state">載入中…</div></div>
  `;

  document.getElementById("member-recipes-back").addEventListener("click", () => window.history.back());

  let all = [];
  try {
    const pub = await listPublicRecipes({});
    all = pub.filter((r) => r.ownerId === params.uid);
  } catch (err) {
    console.error(err);
    document.getElementById("member-recipes-grid").innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
    return;
  }

  function render(keyword) {
    const gridEl = document.getElementById("member-recipes-grid");
    const q = keyword.trim().toLowerCase();
    const filtered = q
      ? all.filter((r) => {
          const name = (r.name || "").toLowerCase();
          const tags = (r.tags || []).map((t) => (t || "").toLowerCase());
          return name.includes(q) || tags.some((t) => t.includes(q));
        })
      : all;

    if (filtered.length === 0) {
      gridEl.innerHTML = `<div class="empty-state">${q ? "找不到符合的食譜，換個關鍵字試試？" : "還沒有公開食譜。"}</div>`;
      return;
    }
    gridEl.innerHTML = `<div class="recipe-grid">${filtered.map(recipeCardHtml).join("")}</div>`;
  }

  render("");
  document.getElementById("member-recipes-search").addEventListener("input", (e) => render(e.target.value));
}

/* ==========================================================
   排行榜（#/leaderboard）
   ========================================================== */
export async function renderLeaderboardPage(container) {
  container.innerHTML = `
    <div class="page-head">
      <button id="leaderboard-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>排行榜</h1>
    </div>
    <div class="segment segment-sm" id="leaderboard-tabs" style="margin:0 16px 14px; flex-wrap:wrap">
      ${BADGE_CATEGORIES.map((c, i) => `<button type="button" class="${i === 0 ? "active" : ""}" data-key="${c.key}">${c.label}</button>`).join("")}
    </div>
    <div id="leaderboard-list"><div class="empty-state">載入中…</div></div>
  `;
  document.getElementById("leaderboard-back").addEventListener("click", () => window.history.back());

  async function loadTab(key) {
    const listEl = document.getElementById("leaderboard-list");
    listEl.innerHTML = `<div class="empty-state">載入中…</div>`;
    try {
      const rows = await getLeaderboard(key);
      if (rows.length === 0) {
        listEl.innerHTML = `<div class="empty-state">還沒有人在這個項目達成任何等級。</div>`;
        return;
      }
      listEl.innerHTML = `
        <div class="leaderboard-list">
          ${rows
            .map(
              (r, i) => `
            <a href="#/friends/${r.uid}" class="leaderboard-row">
              <div class="leaderboard-rank">${i + 1}</div>
              ${avatarHtml(r, "leaderboard-avatar")}
              <div class="leaderboard-info">
                <div class="leaderboard-name">${r.displayName || "朋友"}</div>
                <div class="leaderboard-tier">Lv.${r.tier} ${"★".repeat(r.star)}${"☆".repeat(3 - r.star)}</div>
              </div>
              <div class="leaderboard-count">${r.count}</div>
            </a>`
            )
            .join("")}
        </div>
      `;
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。</div>`;
    }
  }

  document.querySelectorAll("#leaderboard-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#leaderboard-tabs button").forEach((b) => b.classList.toggle("active", b === btn));
      loadTab(btn.dataset.key);
    });
  });

  loadTab(BADGE_CATEGORIES[0].key);
}
