/* ==========================================================
   diary-pages.js — 料理日記畫面：日曆＋當日詳情＋新增
   ========================================================== */

import { MEAL_OPTIONS, createDiaryEntry, deleteDiaryEntry, listMyDiaryEntries, todayDateStr } from "./diary.js";
import { listRecipesForDiaryPicker } from "./recipes.js";
import { getCurrentMember } from "./auth.js";
import { showToast, showConfirm, openPickerSheet } from "./utils.js";

const ICON_PLUS = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_TRASH = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2L7 7"/></svg>';
const ICON_CHEV_LEFT = '<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>';
const ICON_CHEV_RIGHT = '<svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_BOWL = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 12h16M5 12a7 7 0 0 0 14 0M3 12l1-5h16l1 5"/></svg>';
const ICON_PENCIL = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16v4Z"/></svg>';

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export async function renderDiaryPage(container) {
  const member = getCurrentMember();
  const today = new Date();

  const state = {
    year: today.getFullYear(),
    month: today.getMonth(), // 0-based
    selectedDate: todayDateStr(),
    entries: [],
  };

  container.innerHTML = `
    <div class="page-head">
      <h1>料理日記</h1>
    </div>
    <div id="diary-body"><div class="loading-screen"><p>載入中…</p></div></div>
  `;

  async function loadEntries() {
    state.entries = await listMyDiaryEntries(member.uid);
  }

  function entriesOnDate(dateStr) {
    return state.entries.filter((e) => e.date === dateStr);
  }

  function datesWithEntriesInMonth() {
    const prefix = `${state.year}-${pad2(state.month + 1)}`;
    return new Set(state.entries.filter((e) => (e.date || "").startsWith(prefix)).map((e) => e.date));
  }

  function renderCalendar() {
    const firstWeekday = new Date(state.year, state.month, 1).getDay();
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const markedDates = datesWithEntriesInMonth();

    let cells = "";
    for (let i = 0; i < firstWeekday; i++) cells += `<div class="cal-cell cal-cell-empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateStr(state.year, state.month, day);
      const isToday = dateStr === todayDateStr();
      const isSelected = dateStr === state.selectedDate;
      const hasEntry = markedDates.has(dateStr);
      cells += `
        <button type="button" class="cal-cell ${isSelected ? "cal-cell-selected" : ""} ${isToday ? "cal-cell-today" : ""}" data-date="${dateStr}">
          ${day}
          ${hasEntry ? '<span class="cal-dot"></span>' : ""}
        </button>
      `;
    }

    return `
      <div class="cal-header">
        <button type="button" id="cal-prev" class="cal-nav-btn">${ICON_CHEV_LEFT}</button>
        <div class="cal-title">${state.year} 年 ${state.month + 1} 月</div>
        <button type="button" id="cal-next" class="cal-nav-btn">${ICON_CHEV_RIGHT}</button>
      </div>
      <div class="cal-grid cal-weekday-row">
        ${WEEKDAY_LABELS.map((w) => `<div class="cal-weekday">${w}</div>`).join("")}
      </div>
      <div class="cal-grid">${cells}</div>
    `;
  }

  function mealSectionHtml(meal) {
    const items = entriesOnDate(state.selectedDate).filter((e) => e.meal === meal.value);
    return `
      <div class="diary-meal-section">
        <div class="diary-meal-head">
          <span>${meal.label}</span>
          <button type="button" class="diary-add-btn" data-meal="${meal.value}">${ICON_PLUS}新增</button>
        </div>
        ${
          items.length
            ? items
                .map(
                  (e) => `
              <div class="diary-entry-row">
                ${e.inputType === "recipe" ? ICON_BOWL : ICON_PENCIL}
                <span class="diary-entry-name">${e.name}</span>
                ${e.servings != null ? `<span class="diary-entry-servings">${e.servings} 人份</span>` : ""}
                <button type="button" class="diary-del-btn" data-id="${e.id}">${ICON_TRASH}</button>
              </div>`
                )
                .join("")
            : `<div class="diary-meal-empty">還沒有記錄</div>`
        }
      </div>
    `;
  }

  function renderDayPanel() {
    return `
      <div class="diary-day-panel">
        <div class="diary-day-title">${state.selectedDate}</div>
        ${MEAL_OPTIONS.map(mealSectionHtml).join("")}
      </div>
    `;
  }

  function render() {
    const body = document.getElementById("diary-body");
    body.innerHTML = `
      <div class="cal-wrap">${renderCalendar()}</div>
      ${renderDayPanel()}
    `;

    document.getElementById("cal-prev").addEventListener("click", () => {
      state.month -= 1;
      if (state.month < 0) {
        state.month = 11;
        state.year -= 1;
      }
      render();
    });
    document.getElementById("cal-next").addEventListener("click", () => {
      state.month += 1;
      if (state.month > 11) {
        state.month = 0;
        state.year += 1;
      }
      render();
    });

    body.querySelectorAll(".cal-cell[data-date]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedDate = btn.dataset.date;
        render();
      });
    });

    body.querySelectorAll(".diary-add-btn").forEach((btn) => {
      btn.addEventListener("click", () => openAddEntryModal(btn.dataset.meal));
    });

    body.querySelectorAll(".diary-del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await showConfirm("確定要刪除這筆日記嗎？此動作無法復原。");
        if (!ok) return;
        try {
          await deleteDiaryEntry(btn.dataset.id);
          await loadEntries();
          render();
        } catch (err) {
          console.error(err);
          showToast("刪除失敗，請再試一次");
        }
      });
    });
  }

  function openAddEntryModal(meal) {
    const overlay = document.createElement("div");
    overlay.className = "picker-overlay";
    const formState = { inputType: "recipe", recipeId: null, recipeName: "", freeformName: "", servings: "" };

    function renderModal() {
      overlay.innerHTML = `
        <div class="picker-box">
          <div class="sheet-title">新增日記（${mealLabelOf(meal)}）</div>

          <div class="segment segment-sm" id="diary-input-type">
            <button type="button" class="${formState.inputType === "recipe" ? "active" : ""}" data-type="recipe">從食譜選</button>
            <button type="button" class="${formState.inputType === "freeform" ? "active" : ""}" data-type="freeform">自由輸入</button>
          </div>

          ${
            formState.inputType === "recipe"
              ? `<div class="form-field">
                  <label>選擇食譜</label>
                  <button type="button" id="diary-pick-recipe" class="dropdown-field">
                    <span>${formState.recipeName || "點選食譜"}</span>
                  </button>
                </div>`
              : `<div class="form-field">
                  <label>菜名</label>
                  <input type="text" id="diary-freeform-name" value="${formState.freeformName}" placeholder="例如：媽媽的滷肉飯">
                </div>`
          }

          <div class="form-field">
            <label>份量（幾人份，可空）</label>
            <input type="number" id="diary-servings" min="0.5" step="0.5" value="${formState.servings}">
          </div>

          <button type="button" id="diary-save-entry" class="sheet-confirm">儲存</button>
        </div>
      `;

      overlay.querySelectorAll("#diary-input-type button").forEach((btn) => {
        btn.addEventListener("click", () => {
          formState.inputType = btn.dataset.type;
          renderModal();
        });
      });

      if (formState.inputType === "recipe") {
        document.getElementById("diary-pick-recipe").addEventListener("click", async () => {
          const recipes = await listRecipesForDiaryPicker(member.uid);
          if (recipes.length === 0) {
            showToast("你還沒有可以選的食譜，先去新增一道吧！");
            return;
          }
          openPickerSheet({
            title: "選擇食譜",
            options: recipes.map((r) => ({ value: r.id, label: r.name })),
            selected: formState.recipeId ? [formState.recipeId] : [],
            multiple: false,
            onConfirm: ([id]) => {
              const picked = recipes.find((r) => r.id === id);
              formState.recipeId = id;
              formState.recipeName = picked?.name || "";
              if (!formState.servings && picked?.servings) formState.servings = picked.servings;
              renderModal();
            },
          });
        });
      } else {
        document.getElementById("diary-freeform-name").addEventListener("input", (e) => {
          formState.freeformName = e.target.value;
        });
      }

      document.getElementById("diary-servings").addEventListener("input", (e) => {
        formState.servings = e.target.value;
      });

      document.getElementById("diary-save-entry").addEventListener("click", async () => {
        const name = formState.inputType === "recipe" ? formState.recipeName : formState.freeformName.trim();
        if (!name) {
          showToast(formState.inputType === "recipe" ? "請選擇食譜" : "請填菜名");
          return;
        }
        try {
          await createDiaryEntry(member.uid, {
            date: state.selectedDate,
            meal,
            inputType: formState.inputType,
            recipeId: formState.recipeId,
            name,
            servings: formState.servings ? Number(formState.servings) : null,
          });
          overlay.remove();
          await loadEntries();
          render();
          showToast("已記錄");
        } catch (err) {
          console.error(err);
          showToast("儲存失敗，請再試一次");
        }
      });
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    renderModal();
  }

  function mealLabelOf(value) {
    return MEAL_OPTIONS.find((m) => m.value === value)?.label || value;
  }

  await loadEntries();
  render();
}
