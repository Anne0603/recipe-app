/* ==========================================================
   weather.js — 對應需求文件「22｜天氣串接」
   ----------------------------------------------------------
   規則（照文件）：
   - 每次開 APP 抓一次，成功就存起來當備用
   - 5 種天氣（晴/陰/雨/冷/熱，颱風拿掉），優先順序：雨 > 冷/熱 > 晴/陰
   - 冷：體感溫度 < 15°C；熱：體感溫度 > 32°C；15~32°C 不套冷熱，看晴/陰/雨
   - 每種天氣 10 句固定文字，當天隨機選一條、同一天內固定、隔天重抽
   - 抓不到天氣：有舊資料 → 顯示舊資料＋「天氣資料更新中」；
     完全沒舊資料 → 8 句通用備用句隨機挑一條
   ========================================================== */

import { getAppSettings } from "./app-settings.js";
import { getWeatherMode, getSavedCoords, hasAskedPermission } from "./location.js";

const CACHE_KEY = "recipeApp.weather.cache";

const QUOTES = {
  sunny: [
    "陽光這麼好，今天適合做個色彩豐富的料理！",
    "晴天心情好，來挑戰一道新食譜吧！",
    "天氣這麼棒，開窗煮飯特別香！",
    "大晴天能量滿滿，今天多煮一道菜也沒問題！",
    "陽光燦爛，今天的料理也要亮眼一點！",
    "好天氣配好菜，今天吃什麼都覺得特別好吃！",
    "這種天氣最適合做涼拌料理，清爽又開胃！",
    "晴空萬里，冰箱裡的食材都在等你！",
    "天氣好就是下廚的好日子，今天來點新嘗試？",
    "陽光充足，維生素D補好補滿，晚餐也要補好！",
  ],
  cloudy: [
    "陰天最適合煮一鍋暖暖的料理！",
    "天色灰灰的，今天來點重口味的菜提振精神！",
    "陰天讓人懶洋洋，選一道簡單快速的食譜吧！",
    "灰色天空配上熱騰騰的飯，剛剛好！",
    "陰天煮飯特別有氣氛，慢慢來不急！",
    "天有點陰，食慾卻很好，今天吃什麼呢？",
    "陰天不下雨剛剛好，廚房開火不怕悶熱！",
    "灰濛濛的天，今天就用美食來點亮心情吧！",
    "陰天最適合窩在廚房慢慢燉一道菜！",
    "天色不太好，煮個顏色鮮豔的料理來平衡一下！",
  ],
  rainy: [
    "下雨天，最適合待在廚房煮一鍋熱湯！",
    "聽著雨聲煮飯，今天的料理特別有靈魂！",
    "雨天出門麻煩，用冰箱現有食材變出一道菜吧！",
    "淋了雨？趕快煮個薑湯暖暖身體！",
    "下雨天最適合吃熱呼呼的鍋物！",
    "雨天煮飯的香氣特別濃，快進廚房！",
    "外面在下雨，廚房裡要熱鬧起來！",
    "雨聲是最好的廚房配樂，今天慢慢煮！",
    "下雨天哪裡都不想去，就窩在廚房最好！",
    "雨天胃口特別好，今天多煮一道也沒關係！",
  ],
  cold: [
    "天氣冷，今天一定要吃熱的！",
    "冷天就是要吃鍋，暖胃又暖心！",
    "這麼冷還不開火？快去廚房動起來！",
    "冷天煮飯最幸福，廚房的熱氣讓全身都暖了！",
    "天冷了，湯品是今天的首選！",
    "冷颼颼的，今天要吃會讓身體發熱的料理！",
    "這種天氣就是要吃薑、吃辣、吃暖！",
    "冬天的廚房是全家最溫暖的地方！",
    "天氣冷到不想動，但吃飽才有力氣取暖！",
    "冷天能量消耗大，今天要吃得豐盛一點！",
  ],
  hot: [
    "大熱天，今天來點清爽的涼拌料理！",
    "這麼熱還要開火？你真的很勇敢！",
    "熱天胃口差，選一道清淡開胃的菜吧！",
    "高溫預警，今天的料理要清爽、快速、不流汗！",
    "熱到不想動，今天選一道電鍋就能搞定的菜！",
    "天氣這麼熱，冷麵、涼麵是今天的好朋友！",
    "炎炎夏日，料理也要清爽一點才吃得下！",
    "熱天開火要快，選一道10分鐘搞定的食譜！",
    "這種天氣最適合吃冷豆腐、涼拌小菜！",
    "天熱食慾不好？來道酸酸開胃的料理試試！",
  ],
};

const GENERIC_QUOTES = [
  "今天想煮點什麼呢？",
  "打開冰箱看看，靈感就來了！",
  "不知道吃什麼？按下「今天吃什麼」讓APP幫你決定！",
  "每一餐都值得用心，今天也要好好吃飯！",
  "簡單煮、開心吃，今天也辛苦了！",
  "翻翻收藏的食譜，找一道想念的味道吧！",
  "煮飯是給自己的小確幸，今天吃什麼好呢？",
  "來挑一道食譜，把今天的餐桌填滿吧！",
];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** 把 OpenWeatherMap 回傳的天氣狀況＋體感溫度，換算成我們的 5 種分類（雨 > 冷/熱 > 晴/陰） */
function determineCategory(owmMain, feelsLike) {
  const rainy = ["Rain", "Drizzle", "Thunderstorm"].includes(owmMain);
  if (rainy) return "rainy";
  if (feelsLike < 15) return "cold";
  if (feelsLike > 32) return "hot";
  if (owmMain === "Clear") return "sunny";
  return "cloudy";
}

/** 某分類今天要顯示哪一句：當天固定、隔天重抽 */
function pickDailyQuote(category) {
  const list = category ? QUOTES[category] : GENERIC_QUOTES;
  const key = "recipeApp.weather.quoteIndex." + (category || "generic");
  const dateKey = "recipeApp.weather.quoteDate." + (category || "generic");
  const today = todayStr();

  if (localStorage.getItem(dateKey) === today) {
    const idx = Number(localStorage.getItem(key));
    if (!Number.isNaN(idx) && list[idx]) return list[idx];
  }

  const idx = Math.floor(Math.random() * list.length);
  localStorage.setItem(dateKey, today);
  localStorage.setItem(key, String(idx));
  return list[idx];
}

function readCache() {
  const raw = localStorage.getItem(CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}
function writeCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

async function fetchCurrentWeather(lat, lon, apiKey) {
  const url = "https://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + lon + "&appid=" + apiKey + "&units=metric&lang=zh_tw";
  const res = await fetch(url);
  if (!res.ok) throw new Error("天氣資料抓取失敗");
  const data = await res.json();
  return {
    temp: Math.round(data.main.temp),
    feelsLike: data.main.feels_like,
    owmMain: (data.weather && data.weather[0] && data.weather[0].main) || "Clouds",
    cityName: data.name || "",
  };
}

/**
 * 首頁要顯示的天氣資訊。會處理：定位模式判斷、抓取、快取、雙層防護。
 */
export async function getHomeWeatherDisplay() {
  if (!hasAskedPermission() && !getWeatherMode()) {
    return { ready: false, needsLocationPrompt: true, quote: pickDailyQuote(null) };
  }

  const coords = getSavedCoords();
  if (!coords) {
    const cache = readCache();
    if (cache) return Object.assign({ ready: true, stale: true, quote: pickDailyQuote(cache.category) }, cache);
    return { ready: false, needsLocationPrompt: true, quote: pickDailyQuote(null) };
  }

  try {
    const settings = await getAppSettings();
    if (!settings.openWeatherApiKey) throw new Error("天氣功能還沒設定好");

    const weather = await fetchCurrentWeather(coords.lat, coords.lon, settings.openWeatherApiKey);
    const category = determineCategory(weather.owmMain, weather.feelsLike);
    const cityName = weather.cityName || coords.cityName || "";

    const result = { temp: weather.temp, cityName: cityName, category: category, fetchedDateStr: todayStr() };
    writeCache(result);

    return { ready: true, temp: weather.temp, cityName: cityName, category: category, quote: pickDailyQuote(category), stale: false };
  } catch (err) {
    console.error("天氣抓取失敗", err);
    const cache = readCache();
    if (cache) {
      return Object.assign({ ready: true, stale: true, quote: pickDailyQuote(cache.category) }, cache);
    }
    return { ready: true, temp: null, cityName: "", category: null, quote: pickDailyQuote(null), stale: false, noData: true };
  }
}
