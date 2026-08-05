document.addEventListener("DOMContentLoaded", function () {
    // 1. 初始化 tocbot
    tocbot.init({
        tocSelector: '.js-toc',
        contentSelector: '.js-toc-content',
        headingSelector: 'h1, h2, h3, h4, h5, h6',
        hasInnerContainers: true,
        collapseDepth: 6,
        scrollSmooth: true,
        orderedList: false,
    });

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