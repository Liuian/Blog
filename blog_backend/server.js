require('dotenv').config();

// 1. 載入環境變數
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

// Debug 印出確認 (只確認有無抓到，不印出完整 Secret 內容)
console.log("Client ID:", GITHUB_CLIENT_ID);
console.log("Client Secret 是否載入:", !!GITHUB_CLIENT_SECRET);
console.log("目前環境:", process.env.NODE_ENV);

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = 3000;



// 這樣 Express 才能正確讀取 X-Forwarded-Proto 標頭，知道前端是 HTTPS
app.set('trust proxy', 1);

// 中介軟體
app.use(cors());
app.use(express.json());

// 1. 初始化 SQLite 資料庫
const db = new Database(path.join(__dirname, 'blog.db'));

// 初始化資料庫資料表
db.exec(`
  -- 1. 瀏覽次數表 (保持匿名可看)
  CREATE TABLE IF NOT EXISTS page_views (
    slug TEXT PRIMARY KEY,
    views INTEGER DEFAULT 0
  );

  -- 2. 使用者資料表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,          -- 例如 'github_123456'
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 3. 按讚紀錄表 (1 人 1 文章只能按 1 次)
  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT,
    slug TEXT,
    PRIMARY KEY (user_id, slug),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 4. 留言表
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// 設定 Session Cookie
const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: isProduction, // 正式環境 (HTTPS) 自動啟用 true，本機開發 (HTTP) 為 false
    httpOnly: true, 
    sameSite: 'lax',       // 關鍵：允許 OAuth 從 GitHub 重新導向回來時正常帶上與寫入 Session
    maxAge: 7 * 24 * 60 * 60 * 1000 // 保持 7 天登入
  }
}));

// 🔐 Middleware：檢查是否已登入
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: '請先登入後再進行操作' });
  }

  // 確保開發模式或既有 Session 的使用者也存在於 users 資料表，
  // 否則 comments JOIN users 時會找不到對應使用者。
  const user = req.session.user;
  db.prepare(
    'INSERT OR REPLACE INTO users (id, username, avatar_url) VALUES (?, ?, ?)'
  ).run(user.id, user.username, user.avatar_url || null);

  next();
}

// ------------------------------------------------------------------
// 🔑 1. Auth 認證 API
// ------------------------------------------------------------------

// 取得當前登入者資訊
app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// 登出
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GitHub OAuth 入口
app.get('/api/auth/github', (req, res) => {
  const redirect = req.query.redirect || '/';
  const clientId = process.env.GITHUB_CLIENT_ID;

  // 開發模式下若尚未設定 GitHub OAuth，使用一個測試使用者方便先驗證流程
  if (!clientId) {
    if (process.env.NODE_ENV !== 'production') {
      req.session.user = {
        id: 'dev_github_user',
        username: 'dev-user',
        avatar_url: 'https://avatars.githubusercontent.com/u/0?v=4'
      };
      return res.redirect(redirect);
    }

    return res.status(500).json({ error: 'GitHub OAuth 尚未設定 GITHUB_CLIENT_ID' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  req.session.oauthRedirect = redirect;

  const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://127.0.0.1:3000/api/auth/github/callback';
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'read:user,user:email');
  githubAuthUrl.searchParams.set('state', state);

  res.redirect(githubAuthUrl.toString());
});

// GitHub OAuth 回調
app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state, redirect } = req.query;
  const redirectTarget = req.session.oauthRedirect || redirect || '/';

  if (req.session.oauthState && state && req.session.oauthState !== state) {
    return res.status(400).json({ error: 'OAuth state 驗證失敗' });
  }

  // 開發模式下若未設定 GitHub OAuth，直接建立測試登入
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    if (process.env.NODE_ENV !== 'production') {
      req.session.user = {
        id: 'dev_github_user',
        username: 'dev-user',
        avatar_url: 'https://avatars.githubusercontent.com/u/0?v=4'
      };
      req.session.oauthState = null;
      req.session.oauthRedirect = null;
      return res.redirect(redirectTarget);
    }

    return res.status(500).json({ error: 'GitHub OAuth 尚未設定' });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI || 'http://127.0.0.1:3000/api/auth/github/callback'
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error(tokenData.error_description || '無法取得 GitHub access token');
    }

    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    const profile = await profileResponse.json();
    const user = {
      id: `github_${profile.id}`,
      username: profile.login,
      avatar_url: profile.avatar_url
    };

    db.prepare('INSERT OR REPLACE INTO users (id, username, avatar_url) VALUES (?, ?, ?)').run(user.id, user.username, user.avatar_url);
    req.session.user = user;
    req.session.oauthState = null;
    req.session.oauthRedirect = null;

    res.redirect(redirectTarget);
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error);
    res.status(500).json({ error: 'GitHub 登入失敗', detail: error.message });
  }
});

// ------------------------------------------------------------------
// ❤️ 2. 按讚 API (需登入)
// ------------------------------------------------------------------

// 取得文章統計 (含當前使用者是否已按讚)
app.get('/api/stats/:slug', (req, res) => {
  const { slug } = req.params;
  const userId = req.session.user?.id || null;

  // 取得總讚數
  const likeCount = db.prepare('SELECT COUNT(*) as count FROM likes WHERE slug = ?').get(slug).count;
  
  // 檢查當前使用者是否已按讚
  let hasLiked = false;
  if (userId) {
    hasLiked = !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND slug = ?').get(userId, slug);
  }

  res.json({ likes: likeCount, hasLiked });
});

// 切換按讚狀態 (已讚則取消，未讚則新增)
app.post('/api/likes/:slug', requireAuth, (req, res) => {
  const { slug } = req.params;
  const userId = req.session.user.id;

  const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND slug = ?').get(userId, slug);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND slug = ?').run(userId, slug);
  } else {
    db.prepare('INSERT INTO likes (user_id, slug) VALUES (?, ?)').run(userId, slug);
  }

  const newCount = db.prepare('SELECT COUNT(*) as count FROM likes WHERE slug = ?').get(slug).count;
  res.json({ likes: newCount, hasLiked: !existing });
});

// ------------------------------------------------------------------
// 💬 3. 留言 API (需登入)
// ------------------------------------------------------------------

// 取得文章留言列表 (公開)
app.get('/api/comments/:slug', (req, res) => {
  const { slug } = req.params;
  const comments = db.prepare(`
    SELECT c.id, c.content, c.created_at, u.username, u.avatar_url 
    FROM comments c 
    JOIN users u ON c.user_id = u.id 
    WHERE c.slug = ? 
    ORDER BY c.created_at DESC
  `).all(slug);

  res.json(comments);
});

// 新增留言 (需登入)
app.post('/api/comments/:slug', requireAuth, (req, res) => {
  try {
    const { slug } = req.params;
    const { content } = req.body;
    const userId = req.session.user.id;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: '留言內容不能為空' });
    }

    const trimmed = String(content).trim();
    const info = db.prepare('INSERT INTO comments (slug, user_id, content) VALUES (?, ?, ?)').run(slug, userId, trimmed);

    const comment = db.prepare(`
      SELECT c.id, c.content, c.created_at, u.username, u.avatar_url 
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(info.lastInsertRowid);

    return res.json({ success: true, comment });
  } catch (error) {
    console.error('Create comment failed:', error);
    return res.status(500).json({ error: '留言失敗', detail: error.message });
  }
});

// 統一處理 API 例外，避免瀏覽器只看到沒有原因的 500。
app.use('/api', (error, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: '伺服器處理失敗', detail: error.message });
});

// ==========================================
// 🔒 功能三：後端保護 Assets 資源代理
// ==========================================
const PROTECTED_ASSETS_DIR = path.resolve(__dirname, '../assets');

app.get('/assets/*filePath', (req, res) => {
  const referer = req.get('Referer') || '';
  
  // 1. 防盜鏈驗證：只允許從你的域名連線 (如 liuyian.uk 或 本機測試)
  if (!referer.includes('liuyian.uk') && !referer.includes('localhost') && !referer.includes('127.0.0.1')) {
    return res.status(403).send('Forbidden: Direct access denied.');
  }

  // 2. 證明標頭（證明是由 Node.js 後端處理與傳回的）
  res.setHeader('X-Served-By', 'My-NodeJS-Backend');

  // 💡 關鍵修復：Express 5 的 req.params.filePath 是 Array，需要用 .join('/') 轉回字串路徑
  const rawPath = req.params.filePath;
  const subPath = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');

  // 3. 安全回傳檔案 (使用 root 選項，避開絕對路徑問題)
  res.sendFile(subPath, { root: PROTECTED_ASSETS_DIR }, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(404).send('Asset not found');
      }
    }
  });
});

// 啟動 API 伺服器
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 API 後端伺服器已啟動：http://127.0.0.1:${PORT}`);
});
