/* ==========================================================
   recipe-pages.js — 食譜功能畫面：列表／詳情／新增編輯表單
   ----------------------------------------------------------
   對應 mockup 確認版本（v5）。視覺規則：
   - 不用橫向滑動；篩選/多選一律用底部彈出選單（下拉選單規則，
     文件第 736 行：「使用者所有選擇類的操作 → 全部用下拉選單」）
   - 沒有照片時，縮圖一律用同一個碗的 SVG 佔位，不逐項客製圖示
   - 留言功能（21｜留言按讚）還沒討論規格，詳情頁先顯示開發中，
     不做假的留言互動
   ========================================================== */

import {
  STYLE_CATEGORIES,
  UNIT_OPTIONS,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getRecipe,
  listPublicRecipes,
  listMyOwnRecipes,
  listMyCollectedRecipes,
  toggleLike,
} from "./recipes.js";
import { uploadRecipeImage } from "./recipe-images.js";
import { getCurrentMember, getMemberById } from "./auth.js";
import { navigate } from "./router.js";
import { showToast, showConfirm } from "./utils.js";

/* ---------------------------------------------------------
   共用小圖示／小工具
--------------------------------------------------------- */
const ICON_BOWL = '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16M5 12a7 7 0 0 0 14 0M3 12l1-5h16l1 5"/></svg>';
const ICON_HEART = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10a1 1 0 0 1-4 0Z"/></svg>';
const ICON_HEART_FILLED = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10a1 1 0 0 1-4 0Z"/></svg>';
const ICON_BACK = '<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>';
const ICON_PLUS = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_CHEV_DOWN = '<svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_TRASH = '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_UP = '<svg class="icon" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>';
const ICON_DOWN = '<svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_CLOCK = '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_PERSON = '<svg class="icon" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><path d="M2 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5"/></svg>';
const ICON_CAMERA = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>';
const ICON_SEARCH = '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
const ICON_FILTER = '<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const ICON_PIN = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"/></svg>';

function initials(name) {
  return (name || "?").trim().slice(0, 1);
}

/** 通用底部彈出選單：opts = [{value,label}]，multiple 決定單選/多選 */
function openPickerSheet({ title, options, selected, multiple, onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay open";
  const selectedSet = new Set(selected);

  function renderOpts() {
    return options
      .map((opt) => {
        const checked = selectedSet.has(opt.value);
        return `<div class="sheet-opt ${checked ? "checked" : ""}" data-value="${opt.value}">
          <div class="${multiple ? "box" : "radio"}">${multiple ? '<svg class="icon" viewBox="0 0 24 24" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>' : ""}</div>
          ${opt.label}
        </div>`;
      })
      .join("");
  }

  overlay.innerHTML = `
    <div class="sheet-box">
      <div class="sheet-title">${title}</div>
      <div class="sheet-opts">${renderOpts()}</div>
      ${multiple ? '<button type="button" class="sheet-confirm">確定</button>' : ""}
    </div>
  `;

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll(".sheet-opt").forEach((el) => {
    el.addEventListener("click", () => {
      const value = el.dataset.value;
      if (multiple) {
        if (selectedSet.has(value)) selectedSet.delete(value);
        else selectedSet.add(value);
        el.classList.toggle("checked");
      } else {
        selectedSet.clear();
        selectedSet.add(value);
        onConfirm([value]);
        close();
      }
    });
  });

  const confirmBtn = overlay.querySelector(".sheet-confirm");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      onConfirm([...selectedSet]);
      close();
    });
  }

  document.body.appendChild(overlay);
}

/* ==========================================================
   畫面 1：食譜列表（#/recipes）
   ========================================================== */
export async function renderRecipeListPage(container) {
  const member = getCurrentMember();
  const state = {
    tab: "public", // 'public' | 'mine'
    mineSub: "own", // 'own' | 'collected'
    style: null,
  };

  container.innerHTML = `
    <div class="page-head">
      <h1>食譜</h1>
      <button id="recipe-search-btn" class="head-action-btn">${ICON_SEARCH}</button>
    </div>
    <div class="segment" id="recipe-segment">
      <button type="button" class="active" data-tab="public">公開食譜</button>
      <button type="button" data-tab="mine">我的食譜</button>
    </div>
    <div id="recipe-subrow"></div>
    <div id="recipe-list-body"><div class="loading-screen"><p>載入中…</p></div></div>
    <button id="recipe-fab" class="fab-btn">${ICON_PLUS}</button>
  `;

  document.getElementById("recipe-search-btn").addEventListener("click", () => {
    showToast("搜尋功能還沒實作，等「07｜搜尋」開工時再一起討論規格");
  });
  document.getElementById("recipe-fab").addEventListener("click", () => navigate("/recipes/new"));

  container.querySelectorAll("#recipe-segment button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      container.querySelectorAll("#recipe-segment button").forEach((b) => b.classList.toggle("active", b === btn));
      renderSubRowAndBody();
    });
  });

  function renderStyleFilterTrigger() {
    const label = state.style || "全部風格";
    return `
      <button type="button" id="recipe-style-filter" class="dropdown-field dropdown-field-compact">
        ${ICON_FILTER}<span>${label}</span>${ICON_CHEV_DOWN}
      </button>
    `;
  }

  function renderSubRowAndBody() {
    const subrow = document.getElementById("recipe-subrow");
    if (state.tab === "mine") {
      subrow.innerHTML = `
        <div class="segment segment-sm" id="recipe-mine-segment">
          <button type="button" class="${state.mineSub === "own" ? "active" : ""}" data-sub="own">我新增的</button>
          <button type="button" class="${state.mineSub === "collected" ? "active" : ""}" data-sub="collected">我收藏的</button>
        </div>
      `;
      subrow.querySelectorAll("#recipe-mine-segment button").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.mineSub = btn.dataset.sub;
          subrow.querySelectorAll("#recipe-mine-segment button").forEach((b) => b.classList.toggle("active", b === btn));
          loadAndRenderBody();
        });
      });
    } else {
      subrow.innerHTML = `<div class="filter-trigger-row">${renderStyleFilterTrigger()}</div>`;
      document.getElementById("recipe-style-filter").addEventListener("click", () => {
        openPickerSheet({
          title: "依風格篩選",
          options: [{ value: "", label: "全部" }, ...STYLE_CATEGORIES.map((s) => ({ value: s, label: s }))],
          selected: state.style ? [state.style] : [""],
          multiple: false,
          onConfirm: ([value]) => {
            state.style = value || null;
            renderSubRowAndBody();
          },
        });
      });
    }
    loadAndRenderBody();
  }

  function recipeCardHtml(recipe) {
    const styleTags = (recipe.styles || []).slice(0, 2).map((s) => `<span>${s}</span>`).join("");
    return `
      <a href="#/recipes/${recipe.id}" class="recipe-card">
        <div class="recipe-cover" style="${recipe.coverImageUrl ? `background-image:url('${recipe.coverImageUrl}')` : ""}">
          ${recipe.pinned ? `<div class="pin-badge">${ICON_PIN}置頂</div>` : ""}
          ${recipe.coverImageUrl ? "" : ICON_BOWL}
        </div>
        <div class="recipe-info">
          <div class="recipe-name">${recipe.name}</div>
          <div class="recipe-tags">${styleTags}</div>
          <div class="recipe-meta">
            <div class="recipe-owner">${recipe.ownerName ? `<div class="avatar-sm">${initials(recipe.ownerName)}</div>${recipe.ownerName}` : ""}</div>
            <div class="recipe-like-count">${ICON_HEART}${(recipe.likedBy || []).length}</div>
          </div>
        </div>
      </a>
    `;
  }

  async function attachOwnerNames(recipes) {
    const cache = new Map();
    for (const r of recipes) {
      if (!cache.has(r.ownerId)) {
        const owner = await getMemberById(r.ownerId);
        cache.set(r.ownerId, owner?.displayName || "");
      }
      r.ownerName = cache.get(r.ownerId);
    }
    return recipes;
  }

  async function loadAndRenderBody() {
    const body = document.getElementById("recipe-list-body");
    body.innerHTML = `<div class="loading-screen"><p>載入中…</p></div>`;
    try {
      let recipes = [];
      if (state.tab === "public") {
        recipes = await listPublicRecipes({ style: state.style });
      } else if (state.mineSub === "own") {
        recipes = await listMyOwnRecipes(member.uid);
      } else {
        recipes = await listMyCollectedRecipes(member.uid);
      }

      if (recipes.length === 0) {
        body.innerHTML = `<div class="empty-state">${
          state.tab === "public"
            ? "還沒有公開食譜，當有人分享後會顯示在這裡。"
            : state.mineSub === "own"
            ? "還沒有新增過食譜，點右下角＋開始新增第一道吧！"
            : "還沒有收藏任何公開食譜，去公開食譜頁按愛心收藏吧。"
        }</div>`;
        return;
      }

      await attachOwnerNames(recipes);
      body.innerHTML = `<div class="recipe-grid">${recipes.map(recipeCardHtml).join("")}</div>`;
    } catch (err) {
      console.error(err);
      body.innerHTML = `<div class="empty-state">載入失敗，請稍後再試。${
        err?.message?.includes("index") ? "（Firestore 提示需要建立索引，開瀏覽器 Console 看有沒有連結，點開自動建立即可）" : ""
      }</div>`;
    }
  }

  renderSubRowAndBody();
}

/* ==========================================================
   畫面 2：食譜詳情（#/recipes/:id）
   ========================================================== */
export async function renderRecipeDetailPage(container, params) {
  container.innerHTML = `<div class="loading-screen"><p>載入中…</p></div>`;
  const recipe = await getRecipe(params.id);

  if (!recipe) {
    container.innerHTML = `<div class="placeholder-page"><p>找不到這道食譜，可能已被刪除。</p></div>`;
    return;
  }

  const member = getCurrentMember();
  const isOwner = member?.uid === recipe.ownerId;
  const liked = (recipe.likedBy || []).includes(member?.uid);
  const owner = await getMemberById(recipe.ownerId);

  container.innerHTML = `
    <div class="detail-cover" style="${recipe.coverImageUrl ? `background-image:url('${recipe.coverImageUrl}')` : ""}">
      ${recipe.coverImageUrl ? "" : ICON_BOWL}
      <div class="detail-cover-actions">
        <button id="detail-back" class="round-btn">${ICON_BACK}</button>
        ${
          recipe.isPublic
            ? `<button id="detail-like" class="round-btn ${liked ? "liked" : ""}">${liked ? ICON_HEART_FILLED : ICON_HEART}</button>`
            : ""
        }
      </div>
    </div>
    <div class="detail-body">
      <div class="detail-title">${recipe.name}</div>
      ${
        recipe.isPublic
          ? `<div class="detail-owner"><div class="avatar">${initials(owner?.displayName)}</div>${owner?.displayName || "朋友"} 分享</div>`
          : `<div class="detail-owner">私人食譜</div>`
      }
      <div class="detail-tags">${(recipe.styles || []).map((s) => `<span>${s}</span>`).join("")}</div>

      <div class="meta-row">
        <div class="meta-pill">${ICON_PERSON}<div class="meta-val">${recipe.servings ?? "－"} 人份</div><div class="meta-label">份量</div></div>
        <div class="meta-pill">${ICON_CLOCK}<div class="meta-val">${recipe.cookTimeMinutes ?? "－"} 分鐘</div><div class="meta-label">料理時間</div></div>
        ${
          recipe.isPublic
            ? `<div class="meta-pill">${ICON_HEART}<div class="meta-val">${(recipe.likedBy || []).length}</div><div class="meta-label">收藏</div></div>`
            : ""
        }
      </div>

      ${
        isOwner
          ? `<div class="owner-actions">
              <button id="detail-visibility" class="btn btn-ghost">${recipe.isPublic ? "設為私人" : "設為公開"}</button>
              <button id="detail-edit" class="btn btn-ghost">編輯</button>
              <button id="detail-delete" class="btn btn-danger">刪除</button>
            </div>`
          : ""
      }

      <div class="detail-section">
        <h3>${ICON_BOWL}食材</h3>
        ${(recipe.ingredients || [])
          .map((ing) => `<div class="ingredient-row"><span>${ing.name}</span><span class="amt">${ing.amount || ""} ${ing.unit || ""}</span></div>`)
          .join("") || '<p class="form-hint">還沒有填食材</p>'}
      </div>

      <div class="detail-section">
        <h3>步驟</h3>
        ${
          (recipe.steps || [])
            .map((s, i) => `<div class="step-row"><div class="step-no">${i + 1}</div><div class="step-text">${s}</div></div>`)
            .join("") || '<p class="form-hint">還沒有填步驟</p>'
        }
      </div>

      ${
        recipe.tip
          ? `<div class="detail-section"><h3>小撇步</h3><div class="tip-box">${recipe.tip}</div></div>`
          : ""
      }

      ${
        recipe.isPublic
          ? `<div class="detail-section">
              <h3>留言</h3>
              <div class="empty-state">留言功能還沒實作，等「21｜留言按讚」規格討論後再加上。</div>
            </div>`
          : ""
      }
    </div>
  `;

  document.getElementById("detail-back").addEventListener("click", () => navigate("/recipes"));

  const likeBtn = document.getElementById("detail-like");
  if (likeBtn) {
    likeBtn.addEventListener("click", async () => {
      likeBtn.disabled = true;
      try {
        await toggleLike(recipe.id, member.uid);
        renderRecipeDetailPage(container, params); // 重新載入畫面反映最新收藏狀態
      } catch (err) {
        console.error(err);
        showToast("操作失敗，請再試一次");
        likeBtn.disabled = false;
      }
    });
  }

  const visBtn = document.getElementById("detail-visibility");
  if (visBtn) {
    visBtn.addEventListener("click", async () => {
      try {
        await updateRecipe(recipe.id, { isPublic: !recipe.isPublic });
        showToast(recipe.isPublic ? "已設為私人" : "已設為公開");
        renderRecipeDetailPage(container, params);
      } catch (err) {
        console.error(err);
        showToast("操作失敗，請再試一次");
      }
    });
  }

  const editBtn = document.getElementById("detail-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => navigate(`/recipes/${recipe.id}/edit`));
  }

  const deleteBtn = document.getElementById("detail-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const ok = await showConfirm(`確定要刪除「${recipe.name}」嗎？此動作無法復原。`);
      if (!ok) return;
      try {
        await deleteRecipe(recipe.id);
        showToast("已刪除");
        navigate("/recipes");
      } catch (err) {
        console.error(err);
        showToast("刪除失敗，請再試一次");
      }
    });
  }
}

/* ==========================================================
   畫面 3：新增／編輯食譜（#/recipes/new、#/recipes/:id/edit）
   ========================================================== */
export async function renderRecipeFormPage(container, params) {
  const isEdit = !!params.id;
  const member = getCurrentMember();

  container.innerHTML = `<div class="loading-screen"><p>載入中…</p></div>`;

  let existing = null;
  if (isEdit) {
    existing = await getRecipe(params.id);
    if (!existing) {
      container.innerHTML = `<div class="placeholder-page"><p>找不到這道食譜。</p></div>`;
      return;
    }
    if (existing.ownerId !== member?.uid) {
      container.innerHTML = `<div class="placeholder-page"><p>你不是這道食譜的擁有者，無法編輯。</p></div>`;
      return;
    }
  }

  const form = {
    coverImageUrl: existing?.coverImageUrl || "",
    name: existing?.name || "",
    styles: existing?.styles ? [...existing.styles] : [],
    ingredients: existing?.ingredients ? existing.ingredients.map((i) => ({ ...i })) : [{ name: "", amount: "", unit: UNIT_OPTIONS[0] }],
    steps: existing?.steps ? [...existing.steps] : [""],
    servings: existing?.servings ?? "",
    cookTimeMinutes: existing?.cookTimeMinutes ?? "",
    tip: existing?.tip || "",
    tags: existing?.tags ? [...existing.tags] : [],
    isPublic: existing?.isPublic ?? false,
  };

  container.innerHTML = `
    <div class="page-head">
      <button id="form-back" class="back-btn">${ICON_BACK}</button>
      <h1>${isEdit ? "編輯食譜" : "新增食譜"}</h1>
    </div>
    <div class="form-wrap">

      <div class="form-field">
        <label>封面圖</label>
        <div id="cover-upload-box" class="cover-upload" style="${form.coverImageUrl ? `background-image:url('${form.coverImageUrl}');background-size:cover;background-position:center;` : ""}">
          ${form.coverImageUrl ? "" : `${ICON_CAMERA}<span>點擊上傳封面圖</span>`}
        </div>
        <input type="file" id="cover-file-input" accept="image/*" class="hidden" />
      </div>

      <div class="form-field">
        <label>食譜名稱 <span class="req">*</span></label>
        <input type="text" id="field-name" value="${form.name}" placeholder="例如：番茄蛋炒飯">
      </div>

      <div class="form-field">
        <label>風格分類（可多選）</label>
        <button type="button" id="field-styles" class="dropdown-field">
          <span id="field-styles-label">${form.styles.length ? `已選擇：${form.styles.join("、")}` : "請選擇風格分類"}</span>
          ${ICON_CHEV_DOWN}
        </button>
      </div>

      <div class="form-field">
        <label>食材</label>
        <div id="ingredient-rows"></div>
        <div id="add-ingredient" class="add-row-btn">${ICON_PLUS}新增食材</div>
        <div class="todo-note">TODO：食材名稱目前是純文字輸入。等「14｜營養計算」功能規格討論後，這裡要加上官方食材建議清單（自動完成），存的資料格式不變，屆時直接疊加功能即可。</div>
      </div>

      <div class="form-field">
        <label>步驟</label>
        <div id="step-rows"></div>
        <div id="add-step" class="add-row-btn">${ICON_PLUS}新增步驟</div>
      </div>

      <div class="form-field">
        <label>份量（幾人份）</label>
        <input type="number" id="field-servings" min="0.5" step="0.5" value="${form.servings}" placeholder="例如：2，也可填 1.5">
      </div>

      <div class="form-field">
        <label>料理時間（分鐘）</label>
        <input type="number" id="field-cooktime" min="1" step="1" value="${form.cookTimeMinutes}" placeholder="例如：15">
      </div>

      <div class="form-field">
        <label>小撇步</label>
        <textarea id="field-tip" placeholder="有什麼煮起來更好吃的小技巧嗎？（可空）">${form.tip}</textarea>
      </div>

      <div class="form-field">
        <label>標籤</label>
        <div id="tag-input-row" class="tag-input-row">
          <input type="text" id="tag-input" placeholder="輸入後按 Enter 新增">
        </div>
      </div>

      <div class="form-field">
        <div class="visibility-toggle">
          <div><div class="vt-label">公開這道食譜</div><div class="vt-desc">${isEdit ? "隨時可以再切換" : "新增預設為私人，之後可隨時切換"}</div></div>
          <button type="button" id="field-visibility" class="switch-btn ${form.isPublic ? "on" : ""}"></button>
        </div>
      </div>

      <button id="form-save" class="save-btn">${isEdit ? "儲存修改" : "儲存食譜"}</button>
    </div>
  `;

  document.getElementById("form-back").addEventListener("click", () => {
    navigate(isEdit ? `/recipes/${params.id}` : "/recipes");
  });

  /* ---------- 封面圖上傳 ---------- */
  const coverBox = document.getElementById("cover-upload-box");
  const coverInput = document.getElementById("cover-file-input");
  coverBox.addEventListener("click", () => coverInput.click());
  coverInput.addEventListener("change", async () => {
    const file = coverInput.files[0];
    if (!file) return;
    coverBox.innerHTML = "<span>上傳中…</span>";
    try {
      const url = await uploadRecipeImage(file);
      form.coverImageUrl = url;
      coverBox.style.backgroundImage = `url('${url}')`;
      coverBox.style.backgroundSize = "cover";
      coverBox.style.backgroundPosition = "center";
      coverBox.innerHTML = "";
    } catch (err) {
      console.error(err);
      showToast(err.message || "上傳失敗，請再試一次");
      coverBox.innerHTML = `${ICON_CAMERA}<span>點擊上傳封面圖</span>`;
    }
  });

  /* ---------- 風格分類（下拉多選） ---------- */
  document.getElementById("field-styles").addEventListener("click", () => {
    openPickerSheet({
      title: "選擇風格分類",
      options: STYLE_CATEGORIES.map((s) => ({ value: s, label: s })),
      selected: form.styles,
      multiple: true,
      onConfirm: (values) => {
        form.styles = values;
        document.getElementById("field-styles-label").textContent = values.length ? `已選擇：${values.join("、")}` : "請選擇風格分類";
      },
    });
  });

  /* ---------- 食材列 ---------- */
  function renderIngredientRows() {
    const wrap = document.getElementById("ingredient-rows");
    wrap.innerHTML = form.ingredients
      .map(
        (ing, i) => `
        <div class="ing-row" data-i="${i}">
          <input type="text" class="ing-name" placeholder="食材名稱" value="${ing.name}">
          <input type="text" class="ing-amt" placeholder="數量" value="${ing.amount}">
          <select class="ing-unit">${UNIT_OPTIONS.map((u) => `<option ${u === ing.unit ? "selected" : ""}>${u}</option>`).join("")}</select>
          <button type="button" class="row-del" data-i="${i}">${ICON_TRASH}</button>
        </div>`
      )
      .join("");

    wrap.querySelectorAll(".ing-row").forEach((row) => {
      const i = Number(row.dataset.i);
      row.querySelector(".ing-name").addEventListener("input", (e) => (form.ingredients[i].name = e.target.value));
      row.querySelector(".ing-amt").addEventListener("input", (e) => (form.ingredients[i].amount = e.target.value));
      row.querySelector(".ing-unit").addEventListener("change", (e) => (form.ingredients[i].unit = e.target.value));
    });
    wrap.querySelectorAll(".row-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        if (form.ingredients.length <= 1) {
          showToast("至少要留一筆食材欄位");
          return;
        }
        form.ingredients.splice(i, 1);
        renderIngredientRows();
      });
    });
  }
  document.getElementById("add-ingredient").addEventListener("click", () => {
    form.ingredients.push({ name: "", amount: "", unit: UNIT_OPTIONS[0] });
    renderIngredientRows();
  });
  renderIngredientRows();

  /* ---------- 步驟列（上下箭頭調序） ---------- */
  function renderStepRows() {
    const wrap = document.getElementById("step-rows");
    wrap.innerHTML = form.steps
      .map(
        (s, i) => `
        <div class="step-form-row" data-i="${i}">
          <div class="step-form-no">${i + 1}</div>
          <textarea placeholder="第 ${i + 1} 步做什麼？">${s}</textarea>
          <div class="step-form-actions">
            <button type="button" class="step-up" data-i="${i}" ${i === 0 ? "disabled" : ""}>${ICON_UP}</button>
            <button type="button" class="step-down" data-i="${i}" ${i === form.steps.length - 1 ? "disabled" : ""}>${ICON_DOWN}</button>
          </div>
        </div>`
      )
      .join("");

    wrap.querySelectorAll(".step-form-row").forEach((row) => {
      const i = Number(row.dataset.i);
      row.querySelector("textarea").addEventListener("input", (e) => (form.steps[i] = e.target.value));
    });
    wrap.querySelectorAll(".step-up").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        if (i === 0) return;
        [form.steps[i - 1], form.steps[i]] = [form.steps[i], form.steps[i - 1]];
        renderStepRows();
      })
    );
    wrap.querySelectorAll(".step-down").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        if (i === form.steps.length - 1) return;
        [form.steps[i + 1], form.steps[i]] = [form.steps[i], form.steps[i + 1]];
        renderStepRows();
      })
    );
  }
  document.getElementById("add-step").addEventListener("click", () => {
    form.steps.push("");
    renderStepRows();
  });
  renderStepRows();

  /* ---------- 標籤（自由輸入按 Enter 新增，維持原樣不改） ---------- */
  function renderTags() {
    const row = document.getElementById("tag-input-row");
    const input = document.getElementById("tag-input");
    row.querySelectorAll(".tag-chip").forEach((el) => el.remove());
    form.tags.forEach((tag, i) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip";
      chip.innerHTML = `${tag}<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
      chip.querySelector("svg").addEventListener("click", () => {
        form.tags.splice(i, 1);
        renderTags();
      });
      row.insertBefore(chip, input);
    });
  }
  document.getElementById("tag-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        form.tags.push(val);
        e.target.value = "";
        renderTags();
      }
    }
  });
  renderTags();

  /* ---------- 公開／私人開關 ---------- */
  document.getElementById("field-visibility").addEventListener("click", (e) => {
    form.isPublic = !form.isPublic;
    e.target.classList.toggle("on", form.isPublic);
  });

  /* ---------- 儲存 ---------- */
  document.getElementById("form-save").addEventListener("click", async () => {
    form.name = document.getElementById("field-name").value.trim();
    form.servings = document.getElementById("field-servings").value ? Number(document.getElementById("field-servings").value) : null;
    form.cookTimeMinutes = document.getElementById("field-cooktime").value ? Number(document.getElementById("field-cooktime").value) : null;
    form.tip = document.getElementById("field-tip").value.trim();

    if (!form.name) {
      showToast("請填食譜名稱");
      return;
    }

    const payload = {
      coverImageUrl: form.coverImageUrl,
      name: form.name,
      styles: form.styles,
      ingredients: form.ingredients.filter((i) => i.name.trim()),
      steps: form.steps.filter((s) => s.trim()),
      servings: form.servings,
      cookTimeMinutes: form.cookTimeMinutes,
      tip: form.tip,
      tags: form.tags,
    };

    const saveBtn = document.getElementById("form-save");
    saveBtn.disabled = true;
    try {
      if (isEdit) {
        await updateRecipe(params.id, { ...payload, isPublic: form.isPublic });
        showToast("已儲存修改");
        navigate(`/recipes/${params.id}`);
      } else {
        const newId = await createRecipe(member.uid, payload);
        if (form.isPublic) {
          await updateRecipe(newId, { isPublic: true });
        }
        showToast("新增完成");
        navigate(`/recipes/${newId}`);
      }
    } catch (err) {
      console.error(err);
      showToast("儲存失敗，請再試一次");
      saveBtn.disabled = false;
    }
  });
}
