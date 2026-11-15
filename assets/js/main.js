document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById('interaction-section')) {
        loadInteraction();
    }

    // 1. 初始化 tocbot；即使 CDN 失敗，也不能阻止其他按鈕初始化
    if (typeof tocbot !== 'undefined') {
        const navbarOffset = window.innerWidth <= 768 ? 104 : 76;
        tocbot.init({
            tocSelector: '.js-toc',
            contentSelector: '.js-toc-content',
            headingSelector: 'h1, h2, h3, h4, h5, h6',
            hasInnerContainers: true,
            collapseDepth: 6,
            scrollSmooth: true,
            scrollSmoothOffset: -navbarOffset,
            headingsOffset: navbarOffset,
            orderedList: false,
        });
    } else {
        console.warn('Tocbot 載入失敗，文章目錄無法建立');
    }

    // 2. 切換 TOC 側邊欄顯示
    const toggleButton = document.getElementById("toggle-sidebar");
    const sidebar = document.querySelector(".sidebar");
    if (toggleButton && sidebar) {
        toggleButton.addEventListener("click", function () {
            const isCollapsed = sidebar.classList.toggle("collapsed");
            toggleButton.classList.toggle("expanded", !isCollapsed); 
        });
    }

    // 3. Jump to top 功能
    const toTopBtn = document.createElement("button");
    toTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    toTopBtn.className = "jump-top-btn";
    document.body.appendChild(toTopBtn);
    
    toTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // 4. 捲動到一定高度後顯示「Top」按鈕
    window.addEventListener("scroll", function () {
        if (window.scrollY > 300) {
            toTopBtn.style.display = "block";
        } else {
            toTopBtn.style.display = "none";
        }
    });

    // 5. 語言切換與導覽列連結動態更新 (修正  問題)
    const supportedLangs = ['en', 'zh', 'nl', 'de'];
    
    // 從網址中尋找目前的語言 (例如從 /en/about/ 抓取 "en")
    const pathMatch = window.location.pathname.match(/\/(en|zh|nl|de)(\/|$)/);
    const currentLang = pathMatch ? pathMatch[1] : "en";

    // 動態更新導覽列連結 (使用純對相對路徑，徹底拋棄 /)
    const setLink = (id, targetPath) => {
        const el = document.getElementById(id);
        if (el) el.href = `/${currentLang}/${targetPath}`;
    };

    setLink("home-link", "");
    setLink("tools-link", "tools/");
    setLink("notes-link", "notes/");
    setLink("blog-link", "blog/");
    setLink("about-link", "about/");

    // 6. 語言下拉選單邏輯
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        langSelect.value = currentLang;

        langSelect.addEventListener('change', function () {
            const selectedLang = this.value;
            const currentPath = window.location.pathname;

            let newPath;
            // 如果網址開頭已有語系 (如 /en/blog/)，替換它
            if (/\/(en|zh|nl|de)(\/|$)/.test(currentPath)) {
                newPath = currentPath.replace(/\/(en|zh|nl|de)(\/|$)/, `/${selectedLang}/`);
            } else {
                // 如果沒有語系，則加在最前面
                newPath = `/${selectedLang}${currentPath}`;
            }

            window.location.pathname = newPath;
        });
    }
});

let currentUser = null;

function getCurrentSlug() {
    return window.location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
}

async function loadInteraction() {
    try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) throw new Error('auth failed');
        const authData = await authRes.json();
        currentUser = authData.user;
    } catch (error) {
        currentUser = null;
    }

    renderAuthUI();
    loadStats();
    loadComments();
}

function renderAuthUI() {
    const container = document.getElementById('auth-status');
    const commentInput = document.getElementById('comment-input');
    const submitBtn = document.getElementById('submit-comment-btn');

    if (!container) return;

    if (currentUser) {
        container.innerHTML = `
            <img class="user-avatar" src="${currentUser.avatar_url}" alt="使用者頭像">
            <span>${currentUser.username}</span>
            <button class="logout-btn" onclick="logout()">登出</button>
        `;
        if (commentInput) commentInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
    } else {
        const redirectUrl = encodeURIComponent(window.location.href);
        container.innerHTML = `
            <span>👉 必須登入才能按讚與留言：</span>
            <a class="github-login-btn" href="/api/auth/github?redirect=${redirectUrl}">GitHub 帳號登入</a>
        `;
        if (commentInput) commentInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
    }
}

async function loadStats() {
    try {
        const res = await fetch(`/api/stats/${encodeURIComponent(getCurrentSlug())}`);
        if (!res.ok) throw new Error('stats failed');
        const data = await res.json();
        const countEl = document.getElementById('like-count');
        const likeBtn = document.getElementById('like-btn');
        if (countEl) countEl.innerText = data.likes || 0;
        if (likeBtn) {
            likeBtn.classList.toggle('is-liked', Boolean(data.hasLiked));
        }
    } catch (error) {
        console.warn('loadStats failed', error);
    }
}

async function toggleLike() {
    if (!currentUser) return alert('請先登入後再按讚！');

    const res = await fetch(`/api/likes/${encodeURIComponent(getCurrentSlug())}`, { method: 'POST' });
    if (res.status === 401) return alert('請先登入！');
    loadStats();
}

async function loadComments() {
    try {
        const res = await fetch(`/api/comments/${encodeURIComponent(getCurrentSlug())}`);
        if (!res.ok) throw new Error('comments failed');
        const comments = await res.json();
        const list = document.getElementById('comments-list');
        if (!list) return;

        list.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <img class="comment-avatar" src="${comment.avatar_url || '/assets/images/default-avatar.png'}" alt="留言者頭像">
                <strong>${comment.username || '匿名'}</strong>
                <small>${new Date(comment.created_at).toLocaleString()}</small>
                <p>${escapeHtml(comment.content || '')}</p>
            </div>
        `).join('') || '<p class="comments-empty">暫無留言，來搶頭香吧！</p>';
    } catch (error) {
        console.warn('loadComments failed', error);
    }
}

async function submitComment() {
    if (!currentUser) return alert('請先登入！');

    const input = document.getElementById('comment-input');
    const content = input ? input.value.trim() : '';
    if (!content) return alert('留言內容不能為空');

    try {
        const res = await fetch(`/api/comments/${encodeURIComponent(getCurrentSlug())}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || '發送失敗');

        if (input) input.value = '';
        loadComments();
    } catch (error) {
        console.error('submitComment failed:', error);
        alert(error.message || '發送失敗');
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.warn('logout failed', error);
    }
    window.location.reload();
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}