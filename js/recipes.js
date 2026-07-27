/* ==========================================================
   recipes.js — 對應需求文件「03｜食譜收藏、04｜新增食譜」
   ----------------------------------------------------------
   Firestore 存取邏輯。集合：recipes/{recipeId}
   欄位對應「📦 資料結構定案 > 食譜（Recipe）」：
     name, coverImageUrl, styles[], ingredients[{name,amount,unit}],
     steps[], servings, cookTimeMinutes, tip, tags[],
     ownerId, isPublic, createdAt, updatedAt,
     likedBy[]（愛心＝收藏，公開食譜才有意義）,
     diaryUsageCount, commentCount, pinned,
     popularityScore（愛心×3＋日記使用次數×2＋留言數×1，存起來方便排序)

   刪除食譜時的圖片：只刪 Firestore 資料，Cloudinary 上的圖片不會
   自動刪除（討論過的架構限制：unsigned 上傳沒有對應的安全刪除方式，
   純前端拿不到 API Secret，免費額度夠用，先接受這個取捨）。

   TODO（等 17｜料理日記、21｜留言按讚 開工時要記得回來接）：
   - 日記那邊「這道菜被用了一次」要呼叫這裡加 diaryUsageCount 並重算 popularityScore
   - 留言新增/刪除時要更新 commentCount 並重算 popularityScore
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";

const COLLECTION = "recipes";

/** 08｜風格分類：預設清單。管理員能不能新增/刪除/排序，等「風格分類管理」功能討論時再做設定介面。 */
export const STYLE_CATEGORIES = ["台式", "韓式", "日式", "義式", "湯品", "快炒", "其他"];

/** 04｜新增食譜：單位選項（下拉選單） */
export const UNIT_OPTIONS = [
  "克", "公克", "公斤", "斤", "兩",
  "毫升", "公升", "杯", "大匙", "小匙",
  "顆", "片", "根", "條", "把", "適量",
];

function computePopularityScore({ likedBy = [], diaryUsageCount = 0, commentCount = 0 }) {
  return likedBy.length * 3 + diaryUsageCount * 2 + commentCount * 1;
}

/** 新增食譜（04｜新增食譜，預設私人） */
export async function createRecipe(ownerId, data) {
  const db = getDbInstance();
  const payload = {
    name: data.name,
    coverImageUrl: data.coverImageUrl || "",
    styles: data.styles || [],
    ingredients: data.ingredients || [], // [{ name, amount, unit }]
    steps: data.steps || [], // string[]
    servings: data.servings ?? null,
    cookTimeMinutes: data.cookTimeMinutes ?? null,
    tip: data.tip || "",
    tags: data.tags || [],
    ownerId,
    isPublic: false, // 新增食譜預設私人
    likedBy: [],
    diaryUsageCount: 0,
    commentCount: 0,
    pinned: false,
    popularityScore: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

/** 編輯食譜（公開食譜可編輯，不影響已收藏的人；私人食譜所有欄位都可編輯） */
export async function updateRecipe(recipeId, data) {
  const db = getDbInstance();
  await updateDoc(doc(db, COLLECTION, recipeId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** 公開／私人切換（可隨時互換） */
export async function setRecipeVisibility(recipeId, isPublic) {
  return updateRecipe(recipeId, { isPublic });
}

/** 刪除食譜（跳確認框的邏輯在畫面那層處理，這裡只負責刪除本身；圖片不會一起刪，見檔頭說明） */
export async function deleteRecipe(recipeId) {
  const db = getDbInstance();
  await deleteDoc(doc(db, COLLECTION, recipeId));
}

/** 取得單一食譜 */
export async function getRecipe(recipeId) {
  const db = getDbInstance();
  const snap = await getDoc(doc(db, COLLECTION, recipeId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** 公開食譜列表（列表頁「公開食譜」分頁），可依風格篩選 */
export async function listPublicRecipes({ style = null } = {}) {
  const db = getDbInstance();
  const clauses = [where("isPublic", "==", true)];
  if (style) clauses.push(where("styles", "array-contains", style));
  const q = query(collection(db, COLLECTION), ...clauses, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 我新增的食譜（「我的食譜」分頁 > 我新增的） */
export async function listMyOwnRecipes(uid) {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("ownerId", "==", uid), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 我收藏的食譜（「我的食譜」分頁 > 我收藏的）
 * 注意：這是複合查詢（isPublic == true 且 likedBy array-contains uid），
 * Firestore 第一次執行時通常會在瀏覽器 Console 印出一個建立索引的連結，
 * 點開自動建立即可，屬於正常流程不是錯誤。
 */
export async function listMyCollectedRecipes(uid) {
  const db = getDbInstance();
  const q = query(
    collection(db, COLLECTION),
    where("isPublic", "==", true),
    where("likedBy", "array-contains", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 首頁「熱門食譜」用：依熱門分數排序前 N 筆公開食譜 */
export async function getTopPublicRecipes(count = 3) {
  const db = getDbInstance();
  const q = query(
    collection(db, COLLECTION),
    where("isPublic", "==", true),
    orderBy("popularityScore", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 首頁「朋友新分享」用：依建立時間排序最新 N 筆公開食譜 */
export async function getRecentPublicRecipes(count = 3) {
  const db = getDbInstance();
  const q = query(
    collection(db, COLLECTION),
    where("isPublic", "==", true),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 愛心／收藏切換（愛心＝收藏，可防重複按、可取消扣回）
 * @returns {Promise<boolean>} 切換後是否為「已收藏」狀態
 */
export async function toggleLike(recipeId, uid) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) throw new Error("找不到這道食譜");

  const likedBy = recipe.likedBy || [];
  const alreadyLiked = likedBy.includes(uid);
  const nextLikedBy = alreadyLiked ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];

  const popularityScore = computePopularityScore({
    likedBy: nextLikedBy,
    diaryUsageCount: recipe.diaryUsageCount || 0,
    commentCount: recipe.commentCount || 0,
  });

  await updateRecipe(recipeId, { likedBy: nextLikedBy, popularityScore });
  return !alreadyLiked;
}
