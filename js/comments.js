/* ==========================================================
   comments.js — 對應需求文件「21｜留言按讚」
   ----------------------------------------------------------
   Firestore 存取邏輯。集合：comments/{commentId}
   欄位對應「📦 資料結構定案 > 留言（Comment，獨立存）」：
     recipeId, authorId, content, likedBy[], createdAt
   特性：單層、只能刪不能編輯、可按讚、不能回覆

   查詢只用單一條件（recipeId == x），前端自己排序，
   延續食譜/日記那兩次的做法，避免複合索引需求。

   TODO（等「通知系統」開工時要記得回來接）：
   - 有人在你的食譜留言 → 要通知食譜擁有者
   - 有人對你的留言按讚 → 要通知留言者
   這兩個通知現在都還沒發，因為 Discord Webhook 通知系統還沒做。
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";
import { adjustCommentCount } from "./recipes.js";

const COLLECTION = "comments";

/** 新增一則留言，並讓對應食譜的留言數＋1 */
export async function createComment(recipeId, authorId, content) {
  const db = getDbInstance();
  const ref = await addDoc(collection(db, COLLECTION), {
    recipeId,
    authorId,
    content,
    likedBy: [],
    createdAt: serverTimestamp(),
  });
  await adjustCommentCount(recipeId, 1);
  return ref.id;
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

/** 該食譜的全部留言，依時間排序（最舊到新，聊天串常見順序） */
export async function listCommentsForRecipe(recipeId) {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("recipeId", "==", recipeId));
  const snap = await getDocs(q);
  const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return comments.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
}

/** 刪除留言（自己的留言自己可以刪；管理員可以刪任何人的留言，權限判斷在畫面那層做），讓留言數－1 */
export async function deleteComment(commentId, recipeId) {
  const db = getDbInstance();
  await deleteDoc(doc(db, COLLECTION, commentId));
  await adjustCommentCount(recipeId, -1);
}

/** 留言按讚切換，回傳切換後是否為「已按讚」 */
export async function toggleCommentLike(commentId, uid) {
  const db = getDbInstance();
  const ref = doc(db, COLLECTION, commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("找不到這則留言");

  const likedBy = snap.data().likedBy || [];
  const alreadyLiked = likedBy.includes(uid);
  const nextLikedBy = alreadyLiked ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];

  await updateDoc(ref, { likedBy: nextLikedBy });
  return !alreadyLiked;
}
