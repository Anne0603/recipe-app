/* ==========================================================
   nutrition.js — 對應需求文件「14｜營養計算」
   ----------------------------------------------------------
   資料來源說明（誠實交代，不假裝是完整官方資料庫）：
   1. 蔬菜類、水果類、全榖雜糧類：數字換算自衛生福利部國民健康署
      官方發布的「食物代換表」(2019.5)，這是真的政府資料，只是
      用「每份對照重量」換算成「每100克」，不是逐筆去查官方資料庫
      系統（那個系統本身無法從這個環境批次下載）。
   2. 肉類、魚類、蛋、豆腐類：食物代換表把很多品項歸在同一個
      「脂肪上限」分類裡（例如雞胸肉、蝦仁都算「低脂」，脂肪上限
      同樣是3克），但實際脂肪含量差很多（雞胸肉遠比脂肪上限低），
      直接按分類換算會失真，這類項目改用一般常見、公開的營養
      參考數值（不是這次特別去查證的，是既有的營養知識）。
   3. 膳食纖維：食物代換表沒有列這欄，是用類別常見範圍概估的。

   食材名稱比對：用「名稱完全比對」或「食材名稱包含資料庫關鍵字」
   兩種方式，比對不到的食材，就照文件規定「部分食材無資料，僅供
   參考」，不會為了填滿而編數字。

   單位限制：只有食譜食材是用「克/公克/公斤/兩/斤」這種重量單位
   記錄的才能準確換算成公克去對照資料庫；「顆/條/把/大匙」這種
   非重量單位無法可靠換算，會被跳過（一樣算在「部分食材無資料」）。
   ========================================================== */

/** 每 100 克的營養數字：{ calories, protein, fat, carbs, fiber } */
export const NUTRITION_DB = {
  // 全榖雜糧類（換算自衛福部食物代換表 + 直接查證的白飯數字）
  "白飯": { calories: 183, protein: 3, fat: 0.3, carbs: 41, fiber: 0.55 },
  "米飯": { calories: 183, protein: 3, fat: 0.3, carbs: 41, fiber: 0.55 },
  "糙米飯": { calories: 122, protein: 2.6, fat: 1, carbs: 25.6, fiber: 1.8 },
  "白米": { calories: 350, protein: 10, fat: 0.5, carbs: 75, fiber: 0.5 },
  "麵條": { calories: 117, protein: 3.3, fat: 0.5, carbs: 25, fiber: 1.2 },
  "義大利麵": { calories: 131, protein: 5, fat: 1.1, carbs: 25, fiber: 1.8 },
  "吐司": { calories: 233, protein: 6.7, fat: 3, carbs: 50, fiber: 2 },
  "饅頭": { calories: 233, protein: 6.7, fat: 1, carbs: 50, fiber: 1.5 },
  "馬鈴薯": { calories: 78, protein: 2.2, fat: 0.1, carbs: 16.7, fiber: 2.2 },
  "地瓜": { calories: 127, protein: 3.6, fat: 0.2, carbs: 27.3, fiber: 2.5 },
  "蕃薯": { calories: 127, protein: 3.6, fat: 0.2, carbs: 27.3, fiber: 2.5 },
  "山藥": { calories: 88, protein: 2.5, fat: 0.2, carbs: 18.8, fiber: 1.3 },
  "玉米": { calories: 82, protein: 2.4, fat: 1.2, carbs: 17.6, fiber: 2.7 },
  "南瓜": { calories: 82, protein: 2.4, fat: 0.2, carbs: 17.6, fiber: 2.5 },
  "芋頭": { calories: 128, protein: 3.6, fat: 0.3, carbs: 27.3, fiber: 2.3 },

  // 蔬菜類（衛福部食物代換表：每100克蛋白質1克、醣類5克、熱量25大卡，膳食纖維概估）
  "高麗菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.5 },
  "青江菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.6 },
  "小白菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.5 },
  "空心菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.7 },
  "菠菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.2 },
  "地瓜葉": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.5 },
  "韭菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2 },
  "芹菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.8 },
  "茼蒿": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2 },
  "花椰菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.2 },
  "青花菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.2 },
  "白花椰菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2 },
  "紅蘿蔔": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.8 },
  "胡蘿蔔": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.8 },
  "白蘿蔔": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.4 },
  "洋蔥": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.7 },
  "番茄": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.2 },
  "小黃瓜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1 },
  "苦瓜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.5 },
  "冬瓜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1 },
  "絲瓜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1 },
  "茄子": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.5 },
  "秋葵": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 3.2 },
  "青椒": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2 },
  "甜椒": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2 },
  "竹筍": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.2 },
  "牛蒡": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 3.5 },
  "木耳": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 6 },
  "香菇": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.6 },
  "金針菇": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2.4 },
  "杏鮑菇": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 2 },
  "洋菇": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1 },
  "豆芽": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.5 },
  "綠豆芽": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.5 },
  "萵苣": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.3 },
  "美生菜": { calories: 25, protein: 1, fat: 0.1, carbs: 5, fiber: 1.3 },

  // 水果類（換算自衛福部食物代換表，每份重量因水果而異）
  "香蕉": { calories: 86, protein: 1.1, fat: 0.2, carbs: 21.4, fiber: 1.6 },
  "蘋果": { calories: 52, protein: 0.3, fat: 0.2, carbs: 13, fiber: 2.4 },
  "芭樂": { calories: 39, protein: 1, fat: 0.3, carbs: 9.7, fiber: 3.1 },
  "葡萄": { calories: 57, protein: 0.5, fat: 0.2, carbs: 14.3, fiber: 0.6 },
  "鳳梨": { calories: 55, protein: 0.5, fat: 0.2, carbs: 13.6, fiber: 1.2 },
  "西瓜": { calories: 32, protein: 0.6, fat: 0.2, carbs: 7.9, fiber: 0.3 },

  // 豆魚蛋肉類（常見公開營養參考數值，不是直接按代換表脂肪上限換算，避免失真）
  "雞胸肉": { calories: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0 },
  "雞里肌": { calories: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0 },
  "雞腿肉": { calories: 209, protein: 26, fat: 10.9, carbs: 0, fiber: 0 },
  "雞蛋": { calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7, fiber: 0 },
  "豬里肌": { calories: 143, protein: 20.9, fat: 6, carbs: 0, fiber: 0 },
  "豬後腿肉": { calories: 143, protein: 20.9, fat: 6, carbs: 0, fiber: 0 },
  "豬絞肉": { calories: 263, protein: 17, fat: 21, carbs: 0, fiber: 0 },
  "五花肉": { calories: 393, protein: 14, fat: 37, carbs: 0, fiber: 0 },
  "豬排": { calories: 242, protein: 19, fat: 18, carbs: 0, fiber: 0 },
  "牛腱": { calories: 145, protein: 28, fat: 3, carbs: 0, fiber: 0 },
  "牛肉": { calories: 250, protein: 26, fat: 15, carbs: 0, fiber: 0 },
  "牛絞肉": { calories: 254, protein: 17, fat: 20, carbs: 0, fiber: 0 },
  "鮭魚": { calories: 208, protein: 20, fat: 13, carbs: 0, fiber: 0 },
  "鱈魚": { calories: 82, protein: 18, fat: 0.7, carbs: 0, fiber: 0 },
  "虱目魚": { calories: 158, protein: 20, fat: 8.3, carbs: 0, fiber: 0 },
  "蝦仁": { calories: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0 },
  "花枝": { calories: 92, protein: 15.6, fat: 1.4, carbs: 3.1, fiber: 0 },
  "文蛤": { calories: 76, protein: 11.9, fat: 1, carbs: 3.7, fiber: 0 },
  "傳統豆腐": { calories: 88, protein: 8.5, fat: 5.3, carbs: 2.5, fiber: 1.3 },
  "板豆腐": { calories: 88, protein: 8.5, fat: 5.3, carbs: 2.5, fiber: 1.3 },
  "嫩豆腐": { calories: 54, protein: 5, fat: 3, carbs: 2, fiber: 0.5 },
  "雞蛋豆腐": { calories: 79, protein: 6.5, fat: 5.2, carbs: 1.9, fiber: 0.3 },
  "豆干": { calories: 192, protein: 19, fat: 11, carbs: 4, fiber: 1.5 },
  "豆漿": { calories: 33, protein: 3, fat: 1.5, carbs: 2, fiber: 0.4 },
  "毛豆": { calories: 121, protein: 11.9, fat: 5.2, carbs: 8.9, fiber: 4.2 },
};

/** 只有這幾種單位可以換算成公克，用來準確算營養，其他單位一律跳過 */
export const WEIGHT_UNITS_TO_GRAMS = {
  "克": 1, "公克": 1,
  "公斤": 1000,
  "兩": 37.5,
  "斤": 600,
};

export const DAILY_RECOMMENDED = { calories: 2000, protein: 60, fat: 65, carbs: 300, fiber: 25 };

/** 拿食材名稱去比對資料庫：先完全比對，比對不到再看看資料庫關鍵字有沒有包含在食材名稱裡 */
function lookupIngredient(name) {
  const q = (name || "").trim();
  if (!q) return null;
  if (NUTRITION_DB[q]) return NUTRITION_DB[q];
  const key = Object.keys(NUTRITION_DB).find((k) => q.includes(k));
  return key ? NUTRITION_DB[key] : null;
}

/**
 * 算一份食譜的每人份營養（依目前的人份數，份量換算時要重算一次）。
 * @param {Array} ingredients 食譜的食材清單 [{name, amount, unit}]
 * @param {number} servings 目前的人份數
 * @returns {{ perServing: object, matchedCount: number, totalCount: number, hasPartialData: boolean }}
 */
export function computeRecipeNutrition(ingredients, servings) {
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  let matchedCount = 0;
  const totalCount = (ingredients || []).length;

  for (const ing of ingredients || []) {
    const gramsPerUnit = WEIGHT_UNITS_TO_GRAMS[ing.unit];
    if (!gramsPerUnit) continue; // 非重量單位，無法可靠換算，跳過

    const data = lookupIngredient(ing.name);
    if (!data) continue; // 資料庫沒有這個食材，跳過

    const grams = (Number(ing.amount) || 0) * gramsPerUnit;
    const ratio = grams / 100;
    totals.calories += data.calories * ratio;
    totals.protein += data.protein * ratio;
    totals.fat += data.fat * ratio;
    totals.carbs += data.carbs * ratio;
    totals.fiber += data.fiber * ratio;
    matchedCount++;
  }

  const s = Math.max(1, Number(servings) || 1);
  const perServing = {
    calories: Math.round(totals.calories / s),
    protein: Math.round((totals.protein / s) * 10) / 10,
    fat: Math.round((totals.fat / s) * 10) / 10,
    carbs: Math.round((totals.carbs / s) * 10) / 10,
    fiber: Math.round((totals.fiber / s) * 10) / 10,
  };

  return {
    perServing,
    matchedCount,
    totalCount,
    hasPartialData: matchedCount < totalCount,
    hasAnyData: matchedCount > 0,
  };
}
