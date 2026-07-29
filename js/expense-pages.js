/* ==========================================================
   expense-pages.js — 花費記錄畫面：清單、統計、新增
   ========================================================== */

import { createExpense, listMyExpenses, deleteExpense, findLastEntryForName, groupExpensesByIngredient, EXPENSE_UNIT_SUGGESTIONS } from "./expenses.js";
import { getCurrentMember } from "./auth.js";
import { showToast, showConfirm } from "./utils.js";

const ICON_PLUS = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_TRASH = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2L7 7"/></svg>';
const ICON_UP = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>';
const ICON_DOWN = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function renderExpensesPage(container) {
  const member = getCurrentMember();
  const state = { tab: "list", keyword: "", entries: [] };

  container.innerHTML = `
    <div class="page-head"><h1>花費記錄</h1></div>
    <div class="segment" id="expense-tab-segment">
      <button type="button" class="active" data-tab="list">記錄</button>
      <button type="button" data-tab="stats">菜價統計</button>
    </div>
    <div class="search-input-row" id="expense-search-row">
      <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="text" id="expense-search-input" placeholder="搜尋食材名稱...">
    </div>
    <div id="expense-body"><div class="empty-state">載入中…</div></div>
    <button type="button" id="expense-fab" class="fab-btn" aria-label="新增花費記錄">${ICON_PLUS}</button>
  `;

  async function loadEntries() {
    state.entries = await listMyExpenses(member.uid);
  }

  function renderListTab() {
    const bodyEl = document.getElementById("expense-body");
    const q = state.keyword.trim().toLowerCase();
    const filtered = q ? state.entries.filter((e) => (e.ingredientName || "").toLowerCase().includes(q)) : state.entries;

    if (filtered.length === 0) {
      bodyEl.innerHTML = `<div class="empty-state">${q ? "找不到符合的記錄" : "還沒有花費記錄，點右下角＋新增第一筆吧"}</div>`;
      return;
    }

    bodyEl.innerHTML = `
      <div class="expense-list">
        ${filtered
          .map(
            (e) => `
          <div class="expense-row" data-id="${e.id}">
            <div class="expense-row-main">
              <div class="expense-row-name">${e.ingredientName}</div>
              <div class="expense-row-meta">${e.quantity}${e.unit} ・ ${e.date}${e.location ? ` ・ ${e.location}` : ""}</div>
            </div>
            <div class="expense-row-price">$${e.price}</div>
            <button type="button" class="expense-del-btn" data-id="${e.id}">${ICON_TRASH}</button>
          </div>`
          )
          .join("")}
      </div>
    `;

    bodyEl.querySelectorAll(".expense-del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await showConfirm("確定要刪除這筆記錄嗎？此動作無法復原。");
        if (!ok) return;
        try {
          await deleteExpense(btn.dataset.id);
          await loadEntries();
          renderCurrentTab();
        } catch (err) {
          console.error(err);
          showToast("刪除失敗，請再試一次");
        }
      });
    });
  }

  function renderStatsTab() {
    const bodyEl = document.getElementById("expense-body");
    const q = state.keyword.trim().toLowerCase();
    let groups = groupExpensesByIngredient(state.entries);
    if (q) groups = groups.filter((g) => g.ingredientName.toLowerCase().includes(q));
    groups.sort((a, b) => b.count - a.count);

    if (groups.length === 0) {
      bodyEl.innerHTML = `<div class="empty-state">${q ? "找不到符合的食材" : "還沒有足夠的記錄可以統計"}</div>`;
      return;
    }

    bodyEl.innerHTML = `
      <div class="expense-stats-list">
        ${groups
          .map(
            (g) => `
          <div class="expense-stat-card">
            <div class="expense-stat-head">
              <div class="expense-stat-name">${g.ingredientName}<span class="expense-stat-unit">／${g.unit || "無單位"}</span></div>
              <div class="expense-stat-trend expense-stat-trend-${g.trend}">
                ${g.trend === "up" ? ICON_UP : g.trend === "down" ? ICON_DOWN : ""}
                ${g.trend === "up" ? "上漲" : g.trend === "down" ? "下降" : "持平"}
              </div>
            </div>
            <div class="expense-stat-numbers">
              <div><div class="expense-stat-val">$${g.avg.toFixed(0)}</div><div class="expense-stat-label">平均價</div></div>
              <div><div class="expense-stat-val">$${g.latestPrice}</div><div class="expense-stat-label">最近一次（${g.latestDate}）</div></div>
              <div><div class="expense-stat-val">${g.count}</div><div class="expense-stat-label">記錄筆數</div></div>
            </div>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  function renderCurrentTab() {
    if (state.tab === "list") renderListTab();
    else renderStatsTab();
  }

  document.querySelectorAll("#expense-tab-segment button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll("#expense-tab-segment button").forEach((b) => b.classList.toggle("active", b === btn));
      renderCurrentTab();
    });
  });

  document.getElementById("expense-search-input").addEventListener("input", (e) => {
    state.keyword = e.target.value;
    renderCurrentTab();
  });

  document.getElementById("expense-fab").addEventListener("click", () => openAddExpenseModal(member, state, async () => {
    await loadEntries();
    renderCurrentTab();
  }));

  await loadEntries();
  renderCurrentTab();
}

function openAddExpenseModal(member, state, onSaved) {
  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";
  overlay.innerHTML = `
    <div class="picker-box">
      <button type="button" class="dialog-close picker-close" aria-label="關閉">
        <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="sheet-title">新增花費記錄</div>
      <div class="field">
        <label for="expense-name-input">食材名稱</label>
        <input type="text" id="expense-name-input" list="expense-name-suggestions" placeholder="例如：豆腐">
        <datalist id="expense-name-suggestions">
          ${[...new Set(state.entries.map((e) => e.ingredientName))].map((n) => `<option value="${n}">`).join("")}
        </datalist>
      </div>
      <div class="field" style="display:flex;gap:8px">
        <div style="flex:1">
          <label for="expense-price-input">價格</label>
          <input type="number" id="expense-price-input" min="0" step="1" placeholder="0">
        </div>
        <div style="flex:1">
          <label for="expense-qty-input">數量</label>
          <input type="number" id="expense-qty-input" min="0" step="0.5" value="1">
        </div>
        <div style="flex:1">
          <label for="expense-unit-input">單位</label>
          <input type="text" id="expense-unit-input" list="expense-unit-suggestions" placeholder="盒">
          <datalist id="expense-unit-suggestions">
            ${EXPENSE_UNIT_SUGGESTIONS.map((u) => `<option value="${u}">`).join("")}
          </datalist>
        </div>
      </div>
      <div class="field">
        <label for="expense-date-input">日期</label>
        <input type="date" id="expense-date-input" value="${todayStr()}">
      </div>
      <div class="field" style="margin-bottom:0">
        <label for="expense-location-input">地點（可空）</label>
        <input type="text" id="expense-location-input" placeholder="例如：全聯">
      </div>
      <button type="button" id="expense-save-btn" class="sheet-confirm" style="margin-top:14px">儲存</button>
    </div>
  `;
  overlay.querySelector(".picker-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

  // 打同食材名稱時，自動帶入上次用過的單位，減少重複輸入
  document.getElementById("expense-name-input").addEventListener("blur", (e) => {
    const last = findLastEntryForName(state.entries, e.target.value);
    const unitInput = document.getElementById("expense-unit-input");
    if (last && !unitInput.value) unitInput.value = last.unit || "";
  });

  document.getElementById("expense-save-btn").addEventListener("click", async () => {
    const ingredientName = document.getElementById("expense-name-input").value.trim();
    const price = document.getElementById("expense-price-input").value;
    const quantity = document.getElementById("expense-qty-input").value;
    const unit = document.getElementById("expense-unit-input").value.trim();
    const date = document.getElementById("expense-date-input").value;
    const location = document.getElementById("expense-location-input").value.trim();

    if (!ingredientName) {
      showToast("請填食材名稱");
      return;
    }
    if (!price || Number(price) < 0) {
      showToast("請填價格");
      return;
    }
    try {
      await createExpense(member.uid, { ingredientName, price, quantity, unit, date, location });
      overlay.remove();
      showToast("已記錄");
      onSaved();
    } catch (err) {
      console.error(err);
      showToast("儲存失敗，請再試一次");
    }
  });
}
