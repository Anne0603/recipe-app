/* ==========================================================
   location.js — 對應需求文件「23｜定位設定」
   ----------------------------------------------------------
   定位模式（自動／手動）跟座標存在瀏覽器 localStorage，不是
   帳號資料——因為瀏覽器的定位權限本來就是「裝置/瀏覽器」層級的
   東西（換一台裝置本來就要重新授權），存在 localStorage 剛好對應
   這個特性，不用另外做同步。

   - 首次進 APP：問一次系統定位授權，之後不再主動問
     - 答應 → 自動定位模式（存經緯度，城市名之後由天氣 API 回傳）
     - 拒絕 → 提示改用手動選城市
   - 自動/手動可以在設定裡切換
   - 「從手動切回自動」的限制（瀏覽器先天規則，不是設計限制）：
     - 當初答應過 → 可以再呼叫一次拿到座標
     - 當初拒絕過／後來手動關掉 → 瀏覽器不會再彈系統授權框，
       只能引導使用者自己去瀏覽器設定開權限
   ========================================================== */

import { getAppSettings } from "./app-settings.js";

const MODE_KEY = "recipeApp.weather.mode"; // "auto" | "manual"
const COORDS_KEY = "recipeApp.weather.coords"; // { lat, lon, cityName }
const ASKED_KEY = "recipeApp.weather.askedPermission"; // "1" 表示已經問過一次
const DENIED_KEY = "recipeApp.weather.permissionDenied"; // "1" 表示曾經被拒絕過

export function getWeatherMode() {
  return localStorage.getItem(MODE_KEY);
}

export function hasAskedPermission() {
  return localStorage.getItem(ASKED_KEY) === "1";
}

export function wasPermissionDenied() {
  return localStorage.getItem(DENIED_KEY) === "1";
}

export function getSavedCoords() {
  const raw = localStorage.getItem(COORDS_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveCoords(coords) {
  localStorage.setItem(COORDS_KEY, JSON.stringify(coords));
}

/**
 * 跟瀏覽器要一次定位授權（首次進 APP、或使用者自己在設定裡按「切回自動」時呼叫）。
 * 成功會把模式設成 auto、存下經緯度。
 * @returns {Promise<{lat:number, lon:number}|null>} 拒絕或失敗回傳 null
 */
export function requestAutoLocation() {
  localStorage.setItem(ASKED_KEY, "1");

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
        localStorage.setItem(MODE_KEY, "auto");
        localStorage.removeItem(DENIED_KEY);
        saveCoords(coords);
        resolve(coords);
      },
      () => {
        localStorage.setItem(DENIED_KEY, "1");
        resolve(null);
      },
      { timeout: 8000 }
    );
  });
}

/**
 * 手動選城市：用 OpenWeatherMap Geocoding API 查城市名對應的經緯度。
 * @param {string} cityName 例如「台北」「高雄」
 */
export async function setManualCity(cityName) {
  const settings = await getAppSettings();
  if (!settings.openWeatherApiKey) {
    throw new Error("天氣功能還沒設定好，請聯絡管理員到「管理設定」填 OpenWeatherMap API key");
  }

  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${settings.openWeatherApiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("查詢城市失敗，請再試一次");

  const results = await res.json();
  if (!results.length) throw new Error("找不到這個城市，換個名稱試試？");

  const coords = { lat: results[0].lat, lon: results[0].lon, cityName: results[0].local_names?.zh || results[0].name };
  localStorage.setItem(MODE_KEY, "manual");
  saveCoords(coords);
  return coords;
}
