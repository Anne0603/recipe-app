# 今天吃什麼？— 專案骨架

## 目前狀態
這是專案骨架，只有以下流程能動：
- 第一次開啟會導去「設定精靈」（`#/setup`）填四個服務的金鑰
- 填完會導去登入頁，用 Google 登入
- 登入後比對白名單（Firestore `users` 集合，用 uid 比對，目前是簡化版邏輯，正式的白名單/成員系統邏輯之後開工「20｜朋友系統」「帳號系統」時會再確認補齊）
- 通過後看到導覽列與首頁（首頁內容尚未實作，其餘導覽頁目前都是「開發中」佔位）

其餘 25 項功能都還沒實作，`js/` 底下對應的檔案先建好空模組，等每項功能個別討論規格確認後再動工（依合作原則第 1 條）。

## 金鑰怎麼填
分成兩部分:

**Firebase（一定要放檔案裡，因為要先連上才能讀其他設定）**
1. 複製一份 `js/config.example.js`，改名成 `js/config.js`
2. 照著「申請帳號步驟清單」拿到的 firebaseConfig，填進 `js/config.js`
3. 存檔、commit、push 上 GitHub 即可

`js/config.js` 這幾個值屬於「前端本來就看得到」的類型，直接進 git 沒關係，防線是 Firestore Rules，不是藏這個檔案。`config.example.js` 留著當範本，方便之後對照有哪些欄位要填。

**Cloudinary、OpenWeatherMap（全部人共用，存在 Firestore，不用碰程式碼）**
1. Firebase 設定好、能登入後，用管理員帳號登入
2. 點導覽列「服務設定」（`#/app-config`）
3. 填入 Cloud name、Upload preset 名稱、天氣 API key，按儲存
4. 之後要換金鑰，回這頁改就好，不用重新部署、不用碰程式碼

沒填齊 Firebase 的話，網頁會自動導去提示頁面告訴你還缺哪些欄位。

## 部署方式（之後上線時）
1. 這個資料夾整個 push 到你的 GitHub repo
2. Repo 設定裡開啟 GitHub Pages，指到根目錄（或 `/docs`，看你 repo 結構）
3. 開啟網址，走一次設定精靈填金鑰即可使用

## 檔案結構
見合作原則討論時確認的拆檔規劃：`index.html` / `css/`（style、layout、components）/ `js/`（依功能拆模組）。
