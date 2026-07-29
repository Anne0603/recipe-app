/* ==========================================================
   notifications.js — 站內小鈴鐺通知
   ----------------------------------------------------------
   跟文件裡「通知系統（Discord Webhook）」是分開的兩件事：
   這裡做的是 APP 內的通知中心（點小鈴鐺看），不會推播到 APP
   外面。Discord Webhook 那個還沒做，以後做的時候，這裡的事件
   寫入邏輯可以直接重複利用（同一個事件，多加一步「順便發到
   Discord」），不用重寫。

   集合：notifications/{id}
     userId（收件人）, type, title, body, relatedPath（點了要去哪頁）,
     read, createdAt

   查詢只用單一條件（userId == uid），前端排序，延續食譜/日記
   那幾次的做法，避免複合索引需求。
   ========================================================== */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";

const COLLECTION = "notifications";

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

/** 給單一個人建一則通知 */
export async function createNotification(userId, type, title, body, relatedPath) {
  const db = getDbInstance();
  await addDoc(collection(db, COLLECTION), {
    userId,
    type,
    title,
    body: body || "",
    relatedPath: relatedPath || "",
    read: false,
    createdAt: serverTimestamp(),
  });
}

/** 給全部管理員各建一則通知（挑戰待審核時用） */
export async function createNotificationForAdmins(type, title, body, relatedPath) {
  const db = getDbInstance();
  const q = query(collection(db, "users"), where("role", "==", "admin"));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => createNotification(d.id, type, title, body, relatedPath)));
}

/** 給全部啟用中的成員各建一則通知（發布新挑戰時用），可排除某人（例如發布者自己） */
export async function createNotificationForAllMembers(type, title, body, relatedPath, excludeUid) {
  const db = getDbInstance();
  const q = query(collection(db, "users"), where("status", "==", "active"));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.filter((d) => d.id !== excludeUid).map((d) => createNotification(d.id, type, title, body, relatedPath))
  );
}

/** 我的全部通知，新到舊排序 */
export async function listMyNotifications(uid) {
  const db = getDbInstance();
  const q = query(collection(db, COLLECTION), where("userId", "==", uid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

export async function countUnread(uid) {
  const list = await listMyNotifications(uid);
  return list.filter((n) => !n.read).length;
}

export async function markNotificationRead(id) {
  const db = getDbInstance();
  await updateDoc(doc(db, COLLECTION, id), { read: true });
}

export async function markAllNotificationsRead(uid) {
  const list = await listMyNotifications(uid);
  const unread = list.filter((n) => !n.read);
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}
