/* ==========================================================
   lottery.js — 對應需求文件「09｜抽籤」
   ----------------------------------------------------------
   流程（跟你確認過的版本）：
   按首頁大按鈕 → 先跳篩選視窗（來源／風格／時間，預設全部＝全隨機）
   → 按「開始抽籤」才真正抽 → 結果卡（可再抽一次，同一輪不重複，
   抽完重新洗牌）→「就決定是你了」問要不要記錄料理日記
   （17｜料理日記還沒做，先禮貌地告知還沒接上，不裝作有這功能）
   ========================================================== */

import { listMyOwnRecipes, listPublicRecipes, listMyCollectedRecipes, getStyleCategories } from "./recipes.js";
import { getCurrentMember } from "./auth.js";
import { showToast, showConfirm, openPickerSheet } from "./utils.js";
import { navigate } from "./router.js";

const ICON_NO_PHOTO = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 3 3 4-4 5 5"/></svg>';
const ICON_DICE = '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
const ICON_DICE_SM = '<svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
const ICON_CHECK = '<svg class="icon icon-sm" viewBox="0 0 24 24" stroke-width="2.4"><path d="M5 13l4 4L19 7"/></svg>';
const ICON_PERSON_SM = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><path d="M2 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5"/></svg>';
const ICON_CLOCK_SM = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

const SOURCE_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "mine", label: "只抽我的" },
  { value: "public", label: "只抽公開" },
  { value: "collected", label: "只抽我收藏的" },
];
const TIME_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "under30", label: "30 分鐘以內" },
  { value: "30to60", label: "30～60 分鐘" },
  { value: "over60", label: "60 分鐘以上" },
];

function sourceLabel(v) {
  return SOURCE_OPTIONS.find((o) => o.value === v)?.label || "全部";
}
function timeLabel(v) {
  return TIME_OPTIONS.find((o) => o.value === v)?.label || "全部";
}

/** 依「來源」抓候選食譜清單 */
async function fetchBySource(source, uid) {
  if (source === "mine") return listMyOwnRecipes(uid);
  if (source === "public") return listPublicRecipes({});
  if (source === "collected") return listMyCollectedRecipes(uid);
  // 全部：我自己的（不分公私） + 全部人公開的，用 id 去重
  const [mine, pub] = await Promise.all([listMyOwnRecipes(uid), listPublicRecipes({})]);
  const map = new Map();
  [...mine, ...pub].forEach((r) => map.set(r.id, r));
  return [...map.values()];
}

function matchesTime(recipe, time) {
  if (time === "all") return true;
  const minutes = recipe.cookTimeMinutes;
  if (minutes == null) return false; // 沒填時間的食譜，選了時間篩選就不算進去
  if (time === "under30") return minutes <= 30;
  if (time === "30to60") return minutes > 30 && minutes <= 60;
  if (time === "over60") return minutes > 60;
  return true;
}

async function getCandidates(filters, uid) {
  let recipes = await fetchBySource(filters.source, uid);
  if (filters.style !== "all") {
    recipes = recipes.filter((r) => (r.styles || []).includes(filters.style));
  }
  recipes = recipes.filter((r) => matchesTime(r, filters.time));
  return recipes;
}

/* ---------------------------------------------------------
   結果卡（可以再抽一次，同一輪不重複，抽完重新洗牌）
--------------------------------------------------------- */
function showResultCard(candidates, filters) {
  let pool = [...candidates]; // 這一輪還沒抽過的
  let current = null;

  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";
  document.body.appendChild(overlay);

  function drawNext() {
    if (pool.length === 0) {
      pool = [...candidates]; // 全部抽完了，重新洗牌
    }
    const idx = Math.floor(Math.random() * pool.length);
    current = pool[idx];
    pool.splice(idx, 1);
    render();
  }

  function render() {
    const tags = (current.styles || []).map((s) => `<span>${s}</span>`).join("");
    overlay.innerHTML = `
      <div class="picker-box lottery-result-box">
        <div class="lottery-result-cover" style="${current.coverImageUrl ? `background-image:url('${current.coverImageUrl}')` : ""}">
          ${current.coverImageUrl ? "" : ICON_NO_PHOTO}
        </div>
        <div class="lottery-result-name">${current.name}</div>
        <div class="lottery-result-tags">${tags}</div>
        <div class="lottery-result-meta">
          ${current.servings != null ? `${ICON_PERSON_SM}${current.servings} 人份` : ""}
          ${current.cookTimeMinutes != null ? `${ICON_CLOCK_SM}${current.cookTimeMinutes} 分鐘` : ""}
        </div>
        <div class="lottery-result-actions">
          <button type="button" id="lottery-redraw" class="btn btn-ghost">${ICON_DICE_SM}再抽一次</button>
          <button type="button" id="lottery-confirm" class="btn btn-primary">${ICON_CHECK}就決定是你了</button>
        </div>
        <button type="button" id="lottery-adjust-filter" class="lottery-adjust-link">調整篩選條件</button>
      </div>
    `;

    document.getElementById("lottery-redraw").addEventListener("click", drawNext);

    document.getElementById("lottery-confirm").addEventListener("click", async () => {
      const wantsDiary = await showConfirm("要記錄到今天的料理日記嗎？");
      overlay.remove();
      if (wantsDiary) {
        showToast("日記功能還沒實作，等「17｜料理日記」開工時再串接");
      }
    });

    document.getElementById("lottery-adjust-filter").addEventListener("click", () => {
      overlay.remove();
      openFilterModal(filters);
    });
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  drawNext();
}

/* ---------------------------------------------------------
   篩選視窗（來源／風格／時間，選完按「開始抽籤」才真正抽）
--------------------------------------------------------- */
function openFilterModal(initialFilters) {
  const member = getCurrentMember();
  const filters = { ...initialFilters };

  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";

  function render() {
    overlay.innerHTML = `
      <div class="picker-box">
        <div class="sheet-title">抽籤條件</div>

        <div class="lottery-filter-row">
          <label>來源</label>
          <button type="button" id="lf-source" class="dropdown-field">
            <span>${sourceLabel(filters.source)}</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div class="lottery-filter-row">
          <label>風格</label>
          <button type="button" id="lf-style" class="dropdown-field">
            <span>${filters.style === "all" ? "全部" : filters.style}</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div class="lottery-filter-row">
          <label>時間</label>
          <button type="button" id="lf-time" class="dropdown-field">
            <span>${timeLabel(filters.time)}</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        <button type="button" id="lf-start" class="sheet-confirm">${ICON_DICE}開始抽籤</button>
      </div>
    `;

    document.getElementById("lf-source").addEventListener("click", () => {
      openPickerSheet({
        title: "選擇來源",
        options: SOURCE_OPTIONS,
        selected: [filters.source],
        multiple: false,
        onConfirm: ([v]) => {
          filters.source = v;
          render();
        },
      });
    });

    document.getElementById("lf-style").addEventListener("click", async () => {
      const categories = await getStyleCategories();
      openPickerSheet({
        title: "選擇風格",
        options: [{ value: "all", label: "全部" }, ...categories.map((s) => ({ value: s, label: s }))],
        selected: [filters.style],
        multiple: false,
        onConfirm: ([v]) => {
          filters.style = v;
          render();
        },
      });
    });

    document.getElementById("lf-time").addEventListener("click", () => {
      openPickerSheet({
        title: "選擇時間",
        options: TIME_OPTIONS,
        selected: [filters.time],
        multiple: false,
        onConfirm: ([v]) => {
          filters.time = v;
          render();
        },
      });
    });

    document.getElementById("lf-start").addEventListener("click", async () => {
      overlay.remove();
      const candidates = await getCandidates(filters, member?.uid);

      if (candidates.length === 0) {
        showToast("還沒有食譜，快去新增吧！");
        navigate("/recipes/new");
        return;
      }
      if (candidates.length === 1) {
        showToast("符合條件的食譜只有1道");
      }
      showResultCard(candidates, filters);
    });
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  render();
}

/** 首頁大按鈕的進入點 */
export function openLotteryFlow() {
  openFilterModal({ source: "all", style: "all", time: "all" });
}
