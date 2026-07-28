/* ==========================================================
   friends-pages.js — 朋友系統畫面：成員列表、個人頁面
   ========================================================== */

import { listMembersForFriendsPage, getMemberStats } from "./friends.js";
import { getMemberById } from "./auth.js";
import { listPublicRecipes } from "./recipes.js";
import { navigate } from "./router.js";

const ICON_NO_PHOTO = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 3 3 4-4 5 5"/></svg>';
const ICON_HEART = '<svg class="icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>';
const ICON_BADGE = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M9 14.5L7 21l5-3 5 3-2-6.5"/></svg>';
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
    <div class="page-head"><h1>朋友</h1></div>
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
              <div class="friend-row-sub">${m.lastActiveAt ? "最近有新分享" : formatJoinedDate(m.joinedAt) || "成員"}</div>
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

  container.innerHTML = `
    <div class="page-head">
      <button id="profile-back" class="back-btn"><svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>${member.displayName || "朋友"}</h1>
    </div>

    <div class="friend-profile-head">
      ${avatarHtml(member, "lg")}
      <div class="friend-profile-name">${member.displayName || "朋友"}</div>
      <div class="friend-profile-joined">${formatJoinedDate(member.joinedAt)}</div>
    </div>

    <div class="friend-stats-row">
      <div class="friend-stat-pill">${ICON_BOOK}<div class="friend-stat-val">${stats.publicRecipeCount}</div><div class="friend-stat-label">公開食譜</div></div>
      <div class="friend-stat-pill">${ICON_HEART}<div class="friend-stat-val">${stats.totalHearts}</div><div class="friend-stat-label">被收藏次數</div></div>
      <div class="friend-stat-pill">${ICON_BADGE}<div class="friend-stat-val">—</div><div class="friend-stat-label">徽章</div></div>
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

  document.getElementById("profile-back").addEventListener("click", () => navigate("/friends"));

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
