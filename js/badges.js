/* ==========================================================
   badges.js — 徽章系統（屬於帳號系統）
   ----------------------------------------------------------
   每類 7 等級、每等級 3 顆星，門檻表照文件「徽章系統」章節。
   全部用「累計數」（只會往上加、不會往下掉），存在
   users/{uid}.badgeCounts，不即時算，顯示效率較好。

   五類累計數的計算時機：
   - cooking（料理）：每記一筆日記 +1（見 diary.js，刪除不倒扣）
   - sharing（分享）：食譜第一次被設成公開時 +1（見 recipes.js，
     用 sharedForBadge 旗標防止同一食譜重複切換公開/私人被多次計算）
   - popularity（人氣）：食譜被按愛心時 +1，但同一人對同一食譜
     取消再按不會重複計（見 recipes.js 的 everLikedBy 防灌水機制）
   - loginStreak（連續登入）：存「歷史最高連續天數」，不是目前
     連續天數（因為連續天數本質上會斷，但徽章要保得住）
   - challenge（挑戰）：每完成一個挑戰 +1
   ========================================================== */

import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbInstance } from "./firebase-init.js";
import { createNotification } from "./notifications.js";

export const BADGE_CATEGORIES = [
  { key: "cooking", label: "料理", icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16M5 12a7 7 0 0 0 14 0M3 12l1-5h16l1 5"/></svg>' },
  { key: "sharing", label: "分享", icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 4a2 2 0 0 1 2-2h11v18H7a2 2 0 0 0-2 2V4Z"/><path d="M8 7h6M8 10h6"/></svg>' },
  { key: "popularity", label: "人氣", icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>' },
  { key: "loginStreak", label: "連續登入", icon: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' },
  { key: "challenge", label: "挑戰", icon: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 3v18M5 4h11l-2 3.5L16 11H5"/></svg>' },
];

const BADGE_THRESHOLDS = {
  cooking: [[5,10,20],[35,50,70],[100,150,200],[250,300,400],[500,650,800],[1000,1200,1500],[2000,2500,3000]],
  sharing: [[3,6,10],[15,20,30],[40,55,70],[90,110,130],[160,200,250],[300,380,500],[600,800,1000]],
  popularity: [[3,6,10],[15,20,30],[40,55,70],[90,110,130],[160,200,250],[300,380,500],[600,800,1000]],
  loginStreak: [[3,7,14],[21,30,45],[60,75,90],[120,150,180],[240,300,365],[450,540,630],[730,900,1095]],
  challenge: [[1,2,3],[5,7,10],[13,16,20],[25,30,36],[43,50,60],[70,85,100],[120,150,200]],
};

/** 依累計數算出目前第幾級、幾顆星（tier 0～7，star 0～3；0 代表連第 1 級 1 顆星都還沒到） */
export function computeBadgeLevel(category, count) {
  const table = BADGE_THRESHOLDS[category];
  let tier = 0;
  let star = 0;
  for (let t = 0; t < table.length; t++) {
    for (let s = 0; s < 3; s++) {
      if (count >= table[t][s]) {
        tier = t + 1;
        star = s + 1;
      }
    }
  }
  return { tier, star };
}

/** 拿某人五類的徽章等級（給朋友個人頁面用） */
export async function getUserBadgeSummary(uid) {
  const db = getDbInstance();
  const snap = await getDoc(doc(db, "users", uid));
  const counts = snap.exists() ? snap.data().badgeCounts || {} : {};
  return BADGE_CATEGORIES.map((cat) => ({
    ...cat,
    count: counts[cat.key] || 0,
    ...computeBadgeLevel(cat.key, counts[cat.key] || 0),
  }));
}

/** 排行榜：某一類徽章累計數排名前面的成員（只看啟用中的帳號） */
export async function getLeaderboard(category, topN = 10) {
  const db = getDbInstance();
  const q = query(collection(db, "users"), where("status", "==", "active"));
  const snap = await getDocs(q);
  const members = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

  return members
    .map((m) => ({
      uid: m.uid,
      displayName: m.displayName,
      photoURL: m.photoURL,
      count: m.badgeCounts?.[category] || 0,
      ...computeBadgeLevel(category, m.badgeCounts?.[category] || 0),
    }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * 累計數 +1。改成「讀了再寫」而不是純原子 increment()，是為了能比較
 * 加之前/加之後的等級，等級真的往上升時才發一則升級通知（同一使用者
 * 連續動作間隔通常夠長，10 人小規模不太會撞併發，可以接受這個取捨）。
 */
export async function incrementBadgeCounter(uid, category, amount = 1) {
  const db = getDbInstance();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const before = snap.exists() ? snap.data().badgeCounts?.[category] || 0 : 0;
  const after = before + amount;

  await setDoc(ref, { badgeCounts: { [category]: after } }, { merge: true });

  const beforeLevel = computeBadgeLevel(category, before);
  const afterLevel = computeBadgeLevel(category, after);
  if (afterLevel.tier > beforeLevel.tier || (afterLevel.tier === beforeLevel.tier && afterLevel.star > beforeLevel.star)) {
    const label = BADGE_CATEGORIES.find((c) => c.key === category)?.label || category;
    try {
      await createNotification(
        uid,
        "badge",
        "徽章升級了！",
        `「${label}」徽章升到 Lv.${afterLevel.tier} ${"★".repeat(afterLevel.star)}${"☆".repeat(3 - afterLevel.star)} 了`,
        "/friends/" + uid
      );
    } catch (err) {
      console.error("建立徽章升級通知失敗", err);
    }
  }
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 登入時呼叫：更新連續登入天數。同一天內重複登入不會重複累加。
 * 徽章的「連續登入」累計數存歷史最高天數，目前連續天數另外存
 * loginStreakCurrent（這個會因為漏登入而歸零，是正常行為）。
 */
export async function updateLoginStreak(uid) {
  const db = getDbInstance();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  const today = todayDateStr();
  if (data.lastLoginDate === today) {
    return data.loginStreakCurrent || 1; // 今天已經算過了
  }

  const newStreak = data.lastLoginDate === yesterdayDateStr() ? (data.loginStreakCurrent || 0) + 1 : 1;
  const bestStreak = Math.max(data.badgeCounts?.loginStreak || 0, newStreak);

  await updateDoc(ref, {
    lastLoginDate: today,
    loginStreakCurrent: newStreak,
    "badgeCounts.loginStreak": bestStreak,
  });

  return newStreak;
}
