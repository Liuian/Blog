# Build 步驟
1. `jekyll build`	
2. `pm2 restart blog-api`
3. `brew services restart caddy`

- PM2
	1. 全`局安裝 PM2 
		- `sudo npm install -g pm2`
	2. 啟動我們的 API 後端程式 
		- `cd ~/Documents/blog-backend`
		- `pm2 start server.js --name "blog-api"`
	3. 保存當前 PM2 運行列表
		- `pm2 save`
	4. 設定開機自動重啟
		-` `pm2 startup`


# 環境變數
export GITHUB_CLIENT_ID="你的 Client ID"
export GITHUB_CLIENT_SECRET="你的 Client Secret"
export GITHUB_REDIRECT_URI="http://127.0.0.1:3000/api/auth/github/callback"
export NODE_ENV="development"

# Test 步驟
- Debug 使用
  - `pm2 status`
  - `pm2 logs blog-api --lines 20`
- 查看DB
  - 查看所有表格
    - `node -e "const DB = require('better-sqlite3'); console.table(new DB('blog.db').prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all());"`
  - 查看個別表格內容
    - `node -e "const DB = require('better-sqlite3'); console.table(new DB('blog.db').prepare('SELECT * FROM comments').all());"`


# Used Skills
- cloudflare
- caddy
- node.js
- jekyll
- OAuth app


# 取得網域 並將靜態網頁搬過去
了解，那流程會更單純。因為你目前用的是 `xxx.github.io`，沒有自己的網域，這邊有一個重要提醒：

**GitHub Pages 的網址是 GitHub 自己控制的，換到 Mac mini 後就不能再用 `xxx.github.io` 這個網址了**——除非你申請一個屬於自己的網域（例如 `.com`、`.dev`、或便宜的 `.xyz` 等）。所以第一步其實是先決定網域這件事。

## 完整步驟

### Step 1：取得一個網域名稱
- 買一個網域（Cloudflare Registrar、Namecheap、GoDaddy 都可以，`.dev` 或 `.xyz` 通常一年幾十到一百多元台幣）
- 建議直接買在 **Cloudflare**，或買了之後把 DNS 轉到 Cloudflare 管理（免費），因為下一步要用到 Cloudflare Tunnel

如果你完全不想花錢買網域，也有免費方案（如 Cloudflare 的 `*.trycloudflare.com` 臨時網址，或用免費 DDNS 服務如 DuckDNS 提供 `xxx.duckdns.org`），但這類免費網址通常不夠正式，長期經營部落格不太建議。

### Step 2：在 Mac mini 上裝 Cloudflare Tunnel
```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create my-blog
```
這會建立一條從 Cloudflare 到你 Mac mini 的加密通道，完全不用開 router 的 port，也不怕家用網路是 CGNAT。

### Step 3：裝一個靜態網頁伺服器
最簡單推薦 **Caddy**：
```bash
brew install caddy
```
你原本 GitHub Pages 的原始碼（HTML/CSS/JS，或是 build 完的靜態檔案，如果是 Hugo/Jekyll/Hexo 之類產生的）直接放到一個資料夾，例如 `/Users/yourname/blog-site`

Caddyfile 設定範例：
```
yourdomain.com {
    root * /Users/yourname/blog-site
    file_server
}
```

### Step 4：把 Tunnel 接到 Caddy
在 tunnel 設定檔（`~/.cloudflared/config.yml`）指定：
```yaml
tunnel: <你的 tunnel ID>
credentials-file: /Users/yourname/.cloudflared/xxxx.json
ingress:
  - hostname: yourdomain.com
    service: http://localhost:80
  - service: http_status:404
```

### Step 5：DNS 設定
在 Cloudflare Dashboard 幫這個網域加一條 CNAME record，指向你的 tunnel（`cloudflared tunnel route dns my-blog yourdomain.com` 這行指令可以自動幫你設定好）。

### Step 6：讓 Mac mini 常駐運行
- 用 `brew services start caddy` 讓 Caddy 開機自啟
- Tunnel 也可以用 `cloudflared service install` 註冊成系統服務，這樣重開機會自動跑起來
- 系統設定關閉自動睡眠

### Step 7：測試 + 上線
- 先用內網 `http://localhost` 確認網站正常
- 再測 `https://yourdomain.com` 確認 tunnel + DNS 生效
- 生效後就可以把原本 `xxx.github.io` 的連結導向新網址（或直接停用 GitHub Pages）

---

要不要我先幫你確認一下你部落格目前是用什麼工具產生的（Jekyll、Hugo、純手寫 HTML 之類），這樣可以確定「靜態檔案」實際在哪個資料夾、要不要先 build 一次？


# 把 GitHub Pages 徹底換成 `liuyian.uk` 上的自架服務
好，那我們從頭走一次完整流程，把 GitHub Pages 徹底換成 `liuyian.uk` 上的自架服務。

## 前置確認
先確認你現在有：
- ✅ Mac mini（當伺服器）
- ✅ `liuyian.uk` 網域（已買、狀態 Active、Cloudflare nameservers）
- ✅ 部落格前端原始碼（本機 + GitHub repo 都有）
- ⬜ CGNAT 環境 → 所以走 Cloudflare Tunnel，不走 Port Forwarding

---

## Step 1：把網站檔案準備好在 Mac mini 上

如果你電腦上已經有本機檔案，直接複製到一個固定資料夾：
```bash
mkdir -p ~/blog-site
cp -r /你現在本機檔案的路徑/* ~/blog-site/
```
或者直接從 GitHub clone 一份（比較保險，確保跟線上版本一致）：
```bash
cd ~
git clone https://github.com/你的帳號/你的repo名稱.git blog-site
```

確認 `index.html` 在哪一層：
```bash
ls ~/blog-site
```

## Step 2：安裝 Caddy（網頁伺服器）
```bash
brew install caddy
```

編輯 Caddyfile：
```bash
nano /opt/homebrew/etc/Caddyfile
```
內容改成：
```
liuyian.uk {
    root * /Users/你的帳號/blog-site
    file_server
}
```
（如果 `index.html` 是在 `docs/` 資料夾裡，`root` 後面要加上 `/docs`）

儲存後啟動 Caddy：
```bash
brew services start caddy
```

先本機測試看看：
```bash
curl http://localhost
```
應該要能看到你的 HTML 內容輸出。

## Step 3：安裝 Cloudflare Tunnel
```bash
brew install cloudflared
```

登入並授權你的網域：
```bash
cloudflared tunnel login
```
瀏覽器會跳出來，選擇 `liuyian.uk`，按下授權。

## Step 4：建立具名 Tunnel
```bash
cloudflared tunnel create blog-tunnel
```
執行後會顯示一個 Tunnel ID，並在 `~/.cloudflared/` 產生一個憑證檔（`<tunnel-ID>.json`），記下這個 ID。

## Step 5：設定 Tunnel 路由規則
```bash
nano ~/.cloudflared/config.yml
```
內容：
```yaml
tunnel: <剛剛的 tunnel ID>
credentials-file: /Users/你的帳號/.cloudflared/<tunnel-ID>.json
ingress:
  - hostname: liuyian.uk
    service: http://localhost:80
  - service: http_status:404
```

## Step 6：自動建立 DNS record
```bash
cloudflared tunnel route dns blog-tunnel liuyian.uk
```
這行會自動幫你在 Cloudflare DNS 加一筆 CNAME，指向這個 tunnel，不用手動去 Dashboard 設定。

## Step 7：把 Tunnel 設成背景常駐服務
```bash
sudo cloudflared service install
sudo brew services start cloudflared
```
這樣關掉終端機、甚至重開機，Tunnel 都會自動運作。

## Step 8：測試上線
用手機關掉 Wi-Fi、切行動網路，打開瀏覽器輸入：
```
https://liuyian.uk
```
應該要能看到你的部落格內容，並且網址列顯示安全鎖頭（Caddy 自動幫你申請好 HTTPS 憑證）。

## Step 9（可選）：處理 www 或舊網址導流
如果你想讓 `www.liuyian.uk` 也能連到同一個網站，或想把舊的 `xxx.github.io` 訪客導到新網址，這是後續可以加的，先不急。

---

先照 Step 1-2 做，把 Caddy 跑起來、確認本機看得到網站內容，卡住的話截圖給我，我再帶你往下走。

# Mac mini 網頁伺服器架設指南 (Caddy + Cloudflare Tunnel)

本教學適用於在 macOS 系統上，使用 **Caddy** 作為網頁伺服器，並搭配 **Cloudflare Tunnel** 將內網網站安全穿透至外網網域（以 `liuyian.uk` 為例）。

---

## 📋 系統環境與架構說明

* **作業系統**：macOS (Apple Silicon / Intel)
* **網頁伺服器**：Caddy (由 Homebrew 託管)
* **內網穿透**：Cloudflare Tunnel (由 macOS LaunchDaemon 託管)
* **使用者名稱**：`liuyian`
* **網站根目錄**：`/Users/liuyian/Documents/`

---

## Step 1：準備網站靜態檔案

確認你的 HTML 靜態檔案（如 `index.html`）已放置在網站根目錄下：

```bash
ls /Users/liuyian/Documents/

```

---

## Step 2：安裝與設定 Caddy Web Server

1. **安裝 Caddy**：
```bash
brew install caddy

```


2. **編輯 Caddy 設定檔** (`/opt/homebrew/etc/Caddyfile`)：
```bash
nano /opt/homebrew/etc/Caddyfile

```


**寫入以下內容**（讓 Caddy 監聽本地 `:80` 埠並指向你的專案目錄）：
```caddy
:80 {
    root * /Users/liuyian/Documents/
    file_server
}

```


3. **啟動/重啟 Caddy 背景服務**：
```bash
brew services restart caddy

```


4. **本機連線測試**：
```bash
curl -I http://localhost

```


> 預期結果：回傳 `HTTP/1.1 200 OK` 即代表 Caddy 成功讀取目錄並運行中。



---

## Step 3：安裝與設定 Cloudflare Tunnel

1. **安裝 Cloudflare CLI**：
```bash
brew install cloudflared

```


2. **登入 Cloudflare 帳號**：
```bash
cloudflared tunnel login

```


*瀏覽器會自動彈出，選擇 `liuyian.uk` 網域並點擊「授權」。*
3. **建立具名 Tunnel**：
```bash
cloudflared tunnel create blog-tunnel

```


> 記下終端機顯示的 **Tunnel ID**（範例：`1cdc4038-dd7e-4a4e-8113-ee1c01fc770e`）。


4. **設定 Tunnel 路由規則與設定檔同步**：
建立全域目錄並將設定檔寫入，確保手動測試與系統服務均能讀取：
```bash
# 1. 建立全域目錄
sudo mkdir -p /etc/cloudflared

# 2. 編輯 ~/.cloudflared/config.yml
nano ~/.cloudflared/config.yml

```


**寫入以下內容**：
```yaml
tunnel: 1cdc4038-dd7e-4a4e-8113-ee1c01fc770e
credentials-file: /Users/liuyian/.cloudflared/1cdc4038-dd7e-4a4e-8113-ee1c01fc770e.json
ingress:
  - hostname: liuyian.uk
    service: http://localhost:80
  - service: http_status:404

```


**同步複製設定檔至全域目錄**：
```bash
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/
sudo cp ~/.cloudflared/*.json /etc/cloudflared/

```


5. **綁定 DNS 紀錄**：
```bash
cloudflared tunnel route dns blog-tunnel liuyian.uk

```


*這會在 Cloudflare DNS 自動建立一筆 CNAME 紀錄指向該 Tunnel。*

---

## Step 4：將 Cloudflare Tunnel 設定為 macOS 系統常駐服務

> ⚠️ **重要經驗踩坑筆記**：
> 不要使用 `brew services start cloudflared`（會觸發 Homebrew 的 Error 78）。
> 必須使用 macOS 原生的 **LaunchDaemon** 服務，並明確傳入 `tunnel run <TUNNEL_ID>` 參數。

1. **建立標準 LaunchDaemon plist 設定檔**：
```bash
sudo bash -c 'cat <<EOF > /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.cloudflare.cloudflared</string>
	<key>ProgramArguments</key>
	<array>
		<string>/opt/homebrew/bin/cloudflared</string>
		<string>--config</string>
		<string>/etc/cloudflared/config.yml</string>
		<string>tunnel</string>
		<string>run</string>
		<string>1cdc4038-dd7e-4a4e-8113-ee1c01fc770e</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>StandardErrorPath</key>
	<string>/Library/Logs/com.cloudflare.cloudflared.err.log</string>
	<key>StandardOutPath</key>
	<string>/Library/Logs/com.cloudflare.cloudflared.out.log</string>
</dict>
</plist>
EOF'

```


2. **設定檔案權限並啟動背景服務**：
```bash
# 設定權限
sudo chown root:wheel /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
sudo chmod 644 /Library/LaunchDaemons/com.cloudflare.cloudflared.plist

# 重新載入並強制啟動服務
sudo launchctl bootout system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist 2>/dev/null || true
sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist

```



---

## Step 5：驗證與維護管理

### 1. 檢查背景程序狀態

執行以下指令確認 Caddy 與 cloudflared 均在背景運行：

```bash
# 檢查 Caddy (User: liuyian)
brew services list

# 檢查 Cloudflare Tunnel (User: root)
ps aux | grep cloudflared

```

> **成功範例**：應能看到由 `root` 跑的 `/opt/homebrew/bin/cloudflared --config /etc/cloudflared/config.yml tunnel run ...` 程序。

### 2. 外網連線測試

關閉電腦 Wi-Fi，用手機 4G/5G 行動網路訪問：
👉 **`[https://liuyian.uk](https://liuyian.uk)`**

---

## 🛠️ 常用維護指令速查表

* **更新網站內容後**：直接修改 `/Users/liuyian/Documents/` 內的 HTML/CSS 檔案即可，**無需**重啟 Caddy 或 Tunnel，瀏覽器重新整理即可看到最新畫面。
* **重啟 Caddy 網頁伺服器**：
```bash
brew services restart caddy

```


* **重啟 Cloudflare Tunnel 服務**：
```bash
sudo launchctl kickstart -k system/com.cloudflare.cloudflared

```


* **查看 Tunnel 運作 Log**：
```bash
cat /Library/Logs/com.cloudflare.cloudflared.err.log

```


TODO
# 安全與維運隱患
從你前面的配置來看，整體架構（Jekyll 靜態網站 + Caddy + Cloudflare）在**安全性上其實非常優良**，因為「純靜態網站」本身就沒有資料庫注入 (SQLi) 或伺服器端程式碼執行 (RCE) 的風險。

不過，根據你目前的 setup，有 **3 個非常關鍵的安全與維運隱患** 需要特別注意：

---

## 1. ⚠️ Caddy 暴露在公網且直接指向家中的 Home Directory

你在 `Caddyfile` 中寫的路徑是：

```caddy
root * /Users/liuyian/Documents/Pages_Blog/_site

```

### 隱患：

* **權限過大**：Caddy 是以你 Mac 系統的使用者權限在執行的。如果路徑設定不當或未修補 Web 伺服器漏洞，攻擊者可能嘗試透過「路徑穿越 (Path Traversal)」攻擊去讀取 `/Users/liuyian/` 底下的其他私密檔案（例如 `~/.ssh/` 或個人文件）。
* **本機開發環境暴露**：如果這台 Mac 是你日常使用的電腦而非獨立 Server，把它直接當作 Web Server 開放外網存取，會增加本機被掃瞄與攻擊的風險。

### 建議修正：

* **Cloudflare 存取限制**：確保你的防火牆（或 Mac 的安全設定）**只允許 Cloudflare 的 IP** 存取你的 80/443 Port。
* **使用 Cloudflare Tunnel（最推薦）**：不要在路由器上開 Port Forwarding（Port 80/443），改用 Cloudflare 免費提供的 `cloudflared` tunnel。這樣你完全不需要暴露家裡或電腦的真實 IP，就能把網站安全地發佈到 `liuyian.uk`！

---

## 2. ⚠️ Cloudflare 與 Caddy 間的連線未加密（HTTP / SSL 靈魂問題）

因為前面你在本地測試時，將 `Caddyfile` 改成了 `http://`：

```caddy
http://liuyian.uk { ... }

```

### 隱患：

* 如果你在 Cloudflare 的 SSL/TLS 設定開啟了 **"Flexible"** 模式：
* **訪客 ↔ Cloudflare**：HTTPS（有加密）
* **Cloudflare ↔ 你的 Caddy**：HTTP（**明文未加密**）


* 這意味著從 Cloudflare 到你電腦之間的所有流量都是明文傳送的，容易被 ISP 或中間人監聽（中間人攻擊, MITM）。

### 建議修正：

在 Cloudflare 將 SSL 模式設定為 **Full (Strict)**，並讓 Caddy 負責生成有效的 SSL 憑證（或使用 Cloudflare Origin CA 憑證）。

---

## 3. ⚠️ 敏感到不小心 Commit 登錄的檔案 (Git Risk)

靜態網站本身很安全，但開發者常犯的錯誤是把敏感資訊推到 GitHub。

### 隱患：

* 專案內是否有未忽略的系統檔或設定檔？例如：
* `.env`（環境變數/API Keys）
* `.DS_Store`（macOS 系統隱藏檔，會洩漏目錄結構）
* Caddy 相關的私鑰或憑證檔



### 建議修正：

確保你的專案根目錄下有完整的 `.gitignore`：

```gitignore
# Jekyll & 編譯暫存
_site/
.jekyll-cache/
.jekyll-metadata

# macOS 系統檔
.DS_Store

# 敏感變數與金鑰
*.env
*.pem
*.key

```

---

## 🛡️ 安全總結表

| 安全項目 | 目前狀態 | 潛在風險 | 建議處置 |
| --- | --- | --- | --- |
| **網站類型** | 純靜態 (Jekyll) | 🟢 非常安全 | 無需資料庫防護，維持現狀 |
| **真實 IP 暴露** | 依賴家庭網路 Port 80/443 | 🟡 中度風險 | 改用 **Cloudflare Tunnel** 隱藏 IP |
| **傳輸加密** | Caddy 目前跑 HTTP (80) | 🟡 中度風險 | 啟用 **Full SSL (Strict)** 確保全程加密 |
| **系統權限** | 指向個人使用者目錄 | 🟡 低-中度風險 | 檢查 `.gitignore` 避免洩漏私人檔案 |

你目前的技術選型（Jekyll + Caddy + Cloudflare）非常優秀，只要補齊 **Cloudflare Tunnel** 與 **全程 HTTPS**，安全性就幾乎無懈可擊了！


# 設定檔案
- nano ~/.cloudflared/config.yml
- nano /opt/homebrew/etc/cloudflared/config.yml
- nano /opt/homebrew/etc/Caddyfile


# 🛡️ 伺服器終極安全防禦架構與設定筆記（Zero Trust & Zero Open Ports）

已為你將 **Cloudflare Tunnel 設定檔** 完整整合進筆記中！這份筆記涵蓋了 **Cloudflare Tunnel 設定**、**Caddy 防禦綁定**、**系統級 LaunchDaemon 背景服務** 以及 **完整安全效益**，你可以直接複製保存至你的 Markdown 筆記（如 Obsidian / Notion）：

---


## 核心安全概念：零信任與最小暴露面（Zero Trust & Zero Open Ports）

為了確保 Mac mini 伺服器在作為個人博客（`liuyian.uk`）主機時具備最高的安全性，整體架構採用 **Cloudflare Tunnel + Localhost-Only Web Server + 系統級背景運維** 雙重防護機制。

---

## 1. Cloudflare Tunnel 設定檔

### 📄 `/etc/cloudflared/config.yml`

```yaml
tunnel: 1cdc4038-dd7e-4a4e-8113-ee1c01fc770e
credentials-file: /Users/liuyian/.cloudflared/1cdc4038-dd7e-4a4e-8113-ee1c01fc770e.json

ingress:
  - hostname: liuyian.uk
    service: http://127.0.0.1:8080
  - service: http_status:404

```

* **安全防護目的**：
* **出站加密隧道（Outbound Only）**：`cloudflared` 會主動向 Cloudflare 邊緣建立 QUIC 加密連線，**完全不需要向外開放任何 Port**。
* **精準流量路由（Ingress Rule）**：指定特定域名（`liuyian.uk`）才轉發至本地端的 `:8080`；非授權的請求直接回傳 `404` 拒絕，避免未授權的 Host 存取。
* **認證隔離**：使用專屬的 Token `.json` 憑證進行安全驗證，確保只有獲授權的 Tunnel 能接管網域流量。



---

## 2. 關閉家用路由器 Port Forwarding（80 / 443 埠）

* **安全防護目的**：
* **消除對外攻擊面**：完全不需要在路由器設定 Port Forwarding（Port 80/443），家用路由器的防火牆對外保持完全封閉狀態。
* **防範自動化攻擊**：阻絕全網 Port 掃描器（如 Shodan、Censys）直接定位並攻擊你的家用公網 IP。
* **隱蔽真實 IP**：所有外部訪客流量皆經由 Cloudflare 邊緣節點進行 DDoS 防禦與安全過濾後，才透過 Outbound 加密隧道主動連回內網，攻擊者無法得知 Mac mini 的真實實體 IP。



---

## 3. Caddy 網頁伺服器限縮綁定在 Localhost

### 📄 `Caddyfile`

```caddy
http://localhost:8080 {
    root * /Users/liuyian/Documents/Pages_Blog/_site
    file_server
}

```

* **安全防護目的**：
* **防止內網未授權存取**：指定 `http://localhost:8080`（而非廣播級別的 `:8080` 或 `0.0.0.0:8080`），強制 Caddy **僅監聽本機環回介面（Loopback Interface）**。
* **縱深防禦（Defense in Depth）**：即使有攻擊者成功存取你的家用 Local Area Network (LAN) / Wi-Fi，也無法透過內網 IP（例如 `192.168.x.x:8080`）直接存取或掃描你的網頁伺服器，只允許本機運行的 `cloudflared` 進程進行轉發。



---

## 4. macOS 系統級背景服務（LaunchDaemon）

### 📄 `/Library/LaunchDaemons/com.cloudflare.cloudflared.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.cloudflare.cloudflared</string>
	<key>ProgramArguments</key>
	<array>
		<string>/opt/homebrew/bin/cloudflared</string>
		<string>tunnel</string>
		<string>--config</string>
		<string>/etc/cloudflared/config.yml</string>
		<string>run</string>
		<string>1cdc4038-dd7e-4a4e-8113-ee1c01fc770e</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>StandardOutPath</key>
	<string>/Library/Logs/com.cloudflare.cloudflared.out.log</string>
	<key>StandardErrorPath</key>
	<string>/Library/Logs/com.cloudflare.cloudflared.err.log</string>
</dict>
</plist>

```

* **安全與高可用性目的**：
* **獨立路徑綁定**：顯式指定絕對執行檔與設定檔路徑，避免環境變數污染或模糊呼叫。
* **無人值守啟動與崩潰防護 (`KeepAlive` & `RunAtLoad`)**：開機免登入自動啟動，且遇網路波動斷線時會自動拉起服務，實現 24/7 高可用性。



---

## 5. 終極安全架構流量示意圖

$$\text{外部訪客} \xrightarrow{\text{HTTPS}} \text{Cloudflare 邊緣節點 (DDoS 防護)} \xrightarrow{\text{Cloudflare Tunnel (Outbound Only)}} \text{Mac mini: cloudflared} \xrightarrow{\text{Localhost Only}} \text{Caddy (localhost:8080)} \xrightarrow{} \text{Jekyll 靜態檔 (\_site)}$$

---

## 🛠️ 維運與狀態檢查命令庫

```bash
# 檢查 Cloudflare Tunnel 背景服務 PID 狀態 (第一欄應顯示 PID 數字)
sudo launchctl list | grep cloudflare

# 檢查 Caddy 服務狀態 (應顯示 started)
brew services list | grep caddy

# 查看 Cloudflare Tunnel 即時錯誤日誌
sudo tail -n 20 /Library/Logs/com.cloudflare.cloudflared.err.log

# 重啟服務命令
sudo launchctl unload /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
brew services restart caddy

```

# 建立專屬api後端
這個想法非常清晰！將 **「留言、按讚、瀏覽計數」** 交給專屬 API，同時將 **「靜態資源（Assets）」放在後端管理與保護**，可以讓你的博客在保有靜態頁面高速渲染優勢的同時，擁有完全自主掌控的動態功能與資源控制權。

下面為你規劃整個系統的架構，並帶你在 Mac mini 上一步步建立這個專屬 API 後端！

---

## 🏗️ 系統架構規劃

我們將使用 **Node.js + Express + SQLite** 來建立輕量且高效的 API 後端（SQLite 是單一檔案資料庫，免安裝複雜資料庫服務，非常適合個人伺服器）：

```
[外部訪客] ──HTTPS──> [Cloudflare Tunnel]
                           │
                           ▼
                  [Mac mini: Caddy (:8080)]
                   ├── / (靜態 HTML) ─────────> Jekyll (_site/*.html)
                   ├── /api/* (動態請求) ─────> Node.js API (:3000) ──> SQLite (blog.db)
                   └── /assets/* (保護資源) ──> Node.js API (:3000) ──> /protected_assets/

```

### 💡 如何實現「Assets 藏在後端」？

1. 原本 Jekyll 的圖片/CSS/JS 是直接存放在 `_site/assets`（任何人知道網址都能直接下載）。
2. 現在我們把敏感或不想被公開爬蟲隨意抓取的 Assets 移到 **Jekyll _site 目錄以外的資料夾**（例如 `/Users/liuyian/protected_assets`）。
3. 訪客請求 `/assets/image.png` 時，流量會進入 Caddy 並轉發給 Node.js。Node.js 可以先檢查防盜鏈（Referer / Token / Header），驗證通過才透過 `res.sendFile()` 讀取檔案回傳！

---

## 🛠️ 第一步：在 Mac mini 上初始化 Node.js API 專案

打開 Terminal，創建一個獨立的後端專案資料夾：

```bash
# 1. 建立專案目錄
mkdir -p ~/Documents/blog-backend
cd ~/Documents/blog-backend

# 2. 初始化 Node.js 專案
npm init -y

# 3. 安裝需要的套件：Express (Web 框架), better-sqlite3 (超快的 SQLite 庫), cors (跨域處理)
npm install express better-sqlite3 cors

```

---

## 💻 第二步：撰寫 API 後端程式碼 (`server.js`)

在 `~/Documents/blog-backend` 目錄下建立 `server.js`：

```bash
nano server.js

```

貼入以下完整程式碼（包含 **留言**、**按愛心**、**瀏覽次數** 與 **Assets 資源保護**）：

```javascript
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 中介軟體
app.use(cors());
app.use(express.json());

// 1. 初始化 SQLite 資料庫
const db = new Database(path.join(__dirname, 'blog.db'));

// 建立資料表 (自動創建)
db.exec(`
  CREATE TABLE IF NOT EXISTS page_views (
    slug TEXT PRIMARY KEY,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    nickname TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ==========================================
// 📊 功能一：瀏覽次數 (View Counter) & 按讚 (Likes)
// ==========================================

// 取得文章統計數據 (若不存在則初始化)
app.get('/api/stats/:slug', (req, res) => {
  const { slug } = req.params;
  let row = db.prepare('SELECT views, likes FROM page_views WHERE slug = ?').get(slug);
  
  if (!row) {
    db.prepare('INSERT INTO page_views (slug, views, likes) VALUES (?, 0, 0)').run(slug);
    row = { views: 0, likes: 0 };
  }
  res.json(row);
});

// 增加瀏覽次數 (+1)
app.post('/api/views/:slug', (req, res) => {
  const { slug } = req.params;
  db.prepare(`
    INSERT INTO page_views (slug, views, likes) VALUES (?, 1, 0)
    ON CONFLICT(slug) DO UPDATE SET views = views + 1
  `).run(slug);
  
  const updated = db.prepare('SELECT views FROM page_views WHERE slug = ?').get(slug);
  res.json(updated);
});

// 按愛心 (+1)
app.post('/api/likes/:slug', (req, res) => {
  const { slug } = req.params;
  db.prepare(`
    INSERT INTO page_views (slug, views, likes) VALUES (?, 0, 1)
    ON CONFLICT(slug) DO UPDATE SET likes = likes + 1
  `).run(slug);
  
  const updated = db.prepare('SELECT likes FROM page_views WHERE slug = ?').get(slug);
  res.json(updated);
});

// ==========================================
// 💬 功能二：留言板 (Comments)
// ==========================================

// 取得某篇文章的所有留言
app.get('/api/comments/:slug', (req, res) => {
  const { slug } = req.params;
  const comments = db.prepare('SELECT id, nickname, content, created_at FROM comments WHERE slug = ? ORDER BY id DESC').all(slug);
  res.json(comments);
});

// 新增留言
app.post('/api/comments/:slug', (req, res) => {
  const { slug } = req.params;
  const { nickname, content } = req.body;

  if (!nickname || !content) {
    return res.status(400).json({ error: '請填寫暱稱與留言內容' });
  }

  const stmt = db.prepare('INSERT INTO comments (slug, nickname, content) VALUES (?, ?, ?)');
  const info = stmt.run(slug, nickname.trim(), content.trim());

  res.json({ success: true, id: info.lastInsertRowid });
});

// ==========================================
// 🔒 功能三：後端保護 Assets 資源代理
// ==========================================
const PROTECTED_ASSETS_DIR = path.join(__dirname, 'protected_assets');

app.get('/assets/*', (req, res) => {
  const referer = req.get('Referer') || '';
  
  // 簡易防盜鏈驗證：只允許從你的域名連線 (如 liuyian.uk 或 本機測試)
  if (!referer.includes('liuyian.uk') && !referer.includes('localhost')) {
    return res.status(403).send('Forbidden: Direct access denied.');
  }

  // 取得請求的檔案相對路徑
  const filePath = req.params[0];
  const absolutePath = path.join(PROTECTED_ASSETS_DIR, filePath);

  // 回傳檔案
  res.sendFile(absolutePath, (err) => {
    if (err) {
      res.status(404).send('Asset not found');
    }
  });
});

// 啟動 API 伺服器
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 API 後端伺服器已啟動：http://127.0.0.1:${PORT}`);
});

```

---

## 🌐 第三步：修改 `Caddyfile` 設定路由轉發

為了讓 `liuyian.uk/api/...` 與 `liuyian.uk/assets/...` 能無縫對接到 Node.js，我們需要更新你的 `Caddyfile`。

打開 Caddyfile：

```bash
nano ~/Caddyfile   # 或你實際存放 Caddyfile 的路徑

```

修改為以下結構：

```caddy
http://localhost:8080 {
    # 1. 將所有 /api/* 的請求轉發給 Node.js 後端 (:3000)
    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    # 2. 將所有 /assets/* 的請求轉發給 Node.js 後端 (進行權限控管與輸出)
    handle /assets/* {
        reverse_proxy 127.0.0.1:3000
    }

    # 3. 其餘所有一般頁面繼續由 Caddy 直接讀取 Jekyll _site
    handle {
        root * /Users/liuyian/Documents/Pages_Blog/_site
        file_server
    }
}

```

存檔後重啟 Caddy：

```bash
brew services restart caddy

```

---

## ⚙️ 第四步：將 API 後端設為 macOS 開機自動啟動

我們使用 `PM2`（Node.js 界最棒的進程管理器）來確保 API 可以在背景 24/7 運行，並且開機自動啟動：

```bash
# 1. 全局安裝 PM2
sudo npm install -g pm2

# 2. 啟動我們的 API 後端程式
cd ~/Documents/blog-backend
pm2 start server.js --name "blog-api"

# 3. 保存當前 PM2 運行列表
pm2 save

# 4. 設定開機自動重啟
pm2 startup

```

*(照著 `pm2 startup` 提示在 Terminal 輸入最後一行指令即可完工！)*

---

## 🎨 第五步：在 Jekyll 前端調用 API

現在你的 API 已經正式上線！你可以直接在 Jekyll 的文章範本（例如 `_layouts/post.html`）底部加入簡單的 HTML 與 JavaScript：

### 1. 瀏覽量與點讚按鈕範例

```html
<div class="blog-stats">
  <span>👀 瀏覽次數：<span id="view-count">...</span></span>
  <button id="like-btn">❤️ 愛心 (<span id="like-count">0</span>)</button>
</div>

<script>
  // 取得當前文章的 slug (例如 /posts/hello-world -> hello-world)
  const slug = window.location.pathname.replace(/\//g, '-') || 'home';

  // 1. 進入頁面時增加瀏覽數並取得最新統計
  fetch(`/api/views/${slug}`, { method: 'POST' })
    .then(() => fetch(`/api/stats/${slug}`))
    .then(res => res.json())
    .then(data => {
      document.getElementById('view-count').innerText = data.views;
      document.getElementById('like-count').innerText = data.likes;
    });

  // 2. 點擊愛心按鈕
  document.getElementById('like-btn').addEventListener('click', () => {
    fetch(`/api/likes/${slug}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        document.getElementById('like-count').innerText = data.likes;
      });
  });
</script>

```

---

## 🛡️ 總結你的全新架構優勢

1. **零外部依賴**：不需要依賴 Firebase、Giscus 等第三方服務，所有數據（留言、讚數）都安全的保存在你 Mac mini 的 `blog.db` 裡面。
2. **極致安全**：
* 路由器依然**不用開 Port**（走 Cloudflare Tunnel）。
* Node.js 僅綁定在 `127.0.0.1:3000`，只接受來自 Caddy 的轉轉發。
* Assets 檔案存在 `_site` 之外，只有過濾驗證過的請求才能順利下載。


3. **高效輕量**：`better-sqlite3` 每秒可處理上萬次讀取，對於個人博客來說效能綽綽有餘！

**可以放在 `Pages_Blog` 底下，但「絕對不能隨便放」！**

因為 Jekyll 預設會把目錄下的檔案**通通編譯複製到 `_site` 資料夾**。如果你把包含 API 程式碼、資料庫 (`blog.db`)、套件檔 (`node_modules`) 的 `blog_backend` 放在裡面：

1. **極大的安全漏洞**：`blog.db` 資料庫和你的後端原始碼會被 Jekyll 一起打包進 `_site`，任何人只要輸入 `[https://liuyian.uk/blog_backend/blog.db](https://liuyian.uk/blog_backend/blog.db)`，就能**直接下載你的整個資料庫**！
2. **編譯效能變極差**：Jekyll 會試圖去掃描 `node_modules` 裡上萬個檔案，導致每次 `jekyll build` 變超慢甚至卡死。

---

## 🛠️ 正確做法：放在 `Pages_Blog` 底下 + 設定 `_config.yml` 忽略

如果你希望專案目錄乾淨、把所有專案相關的東西集中在 `Pages_Blog`，請務必按照以下 **三個步驟** 設定：

### 步驟 1：建立 `blog_backend` 資料夾

將後端專案建立在 `Pages_Blog` 根目錄下：

```bash
cd ~/Documents/Pages_Blog
mkdir blog_backend

```

此時你的目錄結構會長這樣：

```
Pages_Blog/
├── _config.yml
├── _site/
├── assets/
│   └── private/    <-- (適合放你的保護 Assets)
├── blog_backend/   <-- 我們的 API 後端
│   ├── server.js
│   ├── blog.db
│   └── package.json
├── index.html
└── zh/

```

---

### 步驟 2：修改 `_config.yml` 告訴 Jekyll 忽略它（最關鍵 ⚠️）

打開你的 `_config.yml`：

```bash
nano ~/Documents/Pages_Blog/_config.yml

```

加入 `exclude` 屬性（如果原本就有 `exclude`，請直接在清單後方追加）：

```yaml
exclude:
  - blog_backend
  - node_modules
  - Gemfile
  - Gemfile.lock

```

> **效果**：設定 `exclude: [blog_backend]` 後，Jekyll 在執行 `jekyll build` 時就會**完全跳過這個資料夾**，絕對不會把你的後端程式碼與資料庫搬進 `_site` 裡面對外曝光！

---

### 步驟 3：記得將資料庫與套件寫入 `.gitignore`

如果你有使用 Git 進行版控，請確認 `blog_backend` 內部的敏感資料不會被 push 到 GitHub 上：

打開（或建立）`~/Documents/Pages_Blog/.gitignore`，加入：

```gitignore
# 忽略 Jekyll 輸出檔
_site/
.jekyll-cache/

# 忽略 Node.js API 後端敏感檔案
blog_backend/node_modules/
blog_backend/blog.db

```

---

## 📍 補充：`assets/private` 的絕佳運用

從你的 `tree` 結構可以看到你已經建立了一個 `assets/private` 目錄！

如果你把 `blog_backend` 放在 `Pages_Blog` 底下，你可以在 `server.js` 中直接把私有 Assets 目錄指向這裡：

```javascript
// 在 server.js 裡面這樣設定私有檔案路徑
const PROTECTED_ASSETS_DIR = path.join(__dirname, '../assets/private');

```

並且在 `_config.yml` 裡加上忽略：

```yaml
exclude:
  - blog_backend
  - assets/private

```

這樣一來，`assets/private` 裡面的圖片與檔案**不會被 Jekyll 直接發布到 `_site**`，而是只能透過你的 Node.js API 通過驗證後才能下載，完美實現你要的後端保護效果！

# 設定github login 的環境變數
在 Node.js 專案中，設定環境變數最標準且最方便的做法是使用 **`.env` 檔案** 搭配 **`dotenv`** 套件。

不要直接在 Terminal 一行行輸入 `export ...`，因為重開 Terminal 後設定就會消失。以下是完整的設定步驟：

---

1. **安裝 dotenv 套件:**
在你的後端專案目錄（`blog_backend`）下執行：

```bash
npm install dotenv

```


2. **建立 .env 檔案:**
在專案的**根目錄**（與 `server.js` 同一層）建立一個名為 `.env` 的檔案（沒有檔名，只有副檔名）。

將你的設定值寫進去（**注意：不需要加 `export`，也不需要加引號**）：

```env
GITHUB_CLIENT_ID=你的_Client_ID
GITHUB_CLIENT_SECRET=你的_Client_Secret
GITHUB_REDIRECT_URI=http://127.0.0.1:3000/api/auth/github/callback
NODE_ENV=development
PORT=3000

```


3. **在程式碼中載入環境變數:**
開啟你的 **`server.js`**，在檔案的最頂端（第一行）加入以下程式碼：

```javascript
require('dotenv').config();

// 接下來就能透過 process.env 讀取到了
console.log("Client ID:", process.env.GITHUB_CLIENT_ID);
console.log("環境:", process.env.NODE_ENV);

```


4. **將 .env 加入 .gitignore（重要資安步驟）:**
`.env` 裡面包含極度敏感的密鑰（Client Secret），**絕對不能上傳到 GitHub**。

請在根目錄建立或開啟 **`.gitignore`** 檔案，確保裡面有寫入這行：

```text
.env
node_modules/

```


---

## 💡 額外技巧：如果在 PM2 環境下運作

如果你未來使用 **PM2** 部署正式環境，可以在專案根目錄建立 `ecosystem.config.js`，PM2 會自動載入這裡的環境變數：

```javascript
module.exports = {
  apps: [{
    name: "blog-api",
    script: "./server.js",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
      GITHUB_CLIENT_ID: "正式環境的_ID",
      GITHUB_CLIENT_SECRET: "正式環境的_Secret",
      GITHUB_REDIRECT_URI: "https://yourblog.com/api/auth/github/callback"
    }
  }]
}

```