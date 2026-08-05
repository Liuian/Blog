# 
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


#
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

# 
## Caddy
## 


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

# Build 步驟
1. jekyll build
2. brew services restart caddy