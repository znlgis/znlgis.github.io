/**
 * znlgis.github.io — 主脚本
 * 包含：客户端即时搜索 + 侧边栏/UI 交互 + 深色模式 + 代码复制
 */

// 客户端即时搜索
(function() {
    let searchData = null;
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const SCORE_TITLE_EXACT = 100;
    const SCORE_TITLE_FUZZY = 60;
    const SCORE_DESC_EXACT = 30;
    const SCORE_CONTENT_EXACT = 20;
    const MAX_SEARCH_RESULTS = 15;
    let activeIndex = -1;
    let searchTimeout = null;
    let currentResults = [];

    function setResultsVisible(visible) {
        searchResults.classList.toggle('show', visible);
        searchInput.setAttribute('aria-expanded', visible ? 'true' : 'false');
    }

    function loadSearchData(callback) {
        if (searchData !== null) {
            callback(searchData);
            return;
        }
        const xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status === 200) {
                try { searchData = JSON.parse(xhr.responseText); } catch(e) { searchData = []; }
            } else {
                searchData = [];
            }
            callback(searchData);
        };
        xhr.onerror = function() { searchData = []; callback(searchData); };
        xhr.open('GET', '/search.json', true);
        xhr.send();
    }

    function fuzzyMatch(text, query) {
        const t = text.toLowerCase();
        const q = query.toLowerCase();
        if (t.indexOf(q) !== -1) return true;
        let qi = 0;
        for (let i = 0; i < t.length && qi < q.length; i++) {
            if (t[i] === q[qi]) qi++;
        }
        return qi === q.length;
    }

    function doSearch(query) {
        if (!query || query.trim().length === 0) {
            searchResults.innerHTML = '';
            currentResults = [];
            setResultsVisible(false);
            activeIndex = -1;
            return;
        }
        loadSearchData(function(data) {
            if (!data || data.length === 0) {
                searchResults.innerHTML = '<div class="search-no-results">暂无搜索结果</div>';
                currentResults = [];
                setResultsVisible(true);
                return;
            }
            const results = [];
            const q = query.trim();
            const qLower = q.toLowerCase();
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const title = (item.title || '');
                const description = (item.description || '');
                const content = (item.content || '');
                const titleLower = title.toLowerCase();
                const descLower = description.toLowerCase();
                const contentLower = content.toLowerCase();
                let score = 0;
                if (titleLower.indexOf(qLower) !== -1) { score += SCORE_TITLE_EXACT; }
                else if (fuzzyMatch(title, q)) { score += SCORE_TITLE_FUZZY; }
                if (descLower.indexOf(qLower) !== -1) score += SCORE_DESC_EXACT;
                if (contentLower.indexOf(qLower) !== -1) score += SCORE_CONTENT_EXACT;
                if (score > 0) results.push({ item: item, score: score });
            }
            results.sort(function(a, b) { return b.score - a.score; });
            currentResults = results.slice(0, MAX_SEARCH_RESULTS).map(function(e) { return e.item; });
            if (currentResults.length === 0) {
                searchResults.innerHTML = '<div class="search-no-results">未找到匹配的教程</div>';
            } else {
                let html = '';
                for (let j = 0; j < currentResults.length; j++) {
                    html += '<a class="search-result-item" role="option" aria-selected="false" href="' + escapeHtml(currentResults[j].url) + '" data-index="' + j + '">' + highlightMatch(currentResults[j].title, q) + '</a>';
                }
                searchResults.innerHTML = html;
            }
            setResultsVisible(true);
            activeIndex = -1;
        });
    }

    function highlightMatch(text, query) {
        const t = text.toLowerCase();
        const q = query.toLowerCase();
        const idx = t.indexOf(q);
        if (idx === -1) return escapeHtml(text);
        return escapeHtml(text.substring(0, idx)) +
            '<mark>' + escapeHtml(text.substring(idx, idx + q.length)) + '</mark>' +
            escapeHtml(text.substring(idx + q.length));
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            var query = this.value;
            searchTimeout = setTimeout(function() { doSearch(query); }, 150);
        });

        searchInput.addEventListener('focus', function() {
            if (this.value.trim().length > 0) doSearch(this.value);
            if (searchData === null) loadSearchData(function(){});
        });

        searchInput.addEventListener('keydown', function(e) {
            var items = searchResults.querySelectorAll('.search-result-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length > 0) { activeIndex = Math.min(activeIndex + 1, items.length - 1); updateActive(items); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length > 0) { activeIndex = Math.max(activeIndex - 1, 0); updateActive(items); }
            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && items.length > 0 && items[activeIndex]) {
                    e.preventDefault();
                    window.location.href = items[activeIndex].getAttribute('href');
                }
            } else if (e.key === 'Escape') {
                setResultsVisible(false);
                activeIndex = -1;
            }
        });

        function updateActive(items) {
            items.forEach(function(item, i) {
                item.classList.toggle('active', i === activeIndex);
                item.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
                if (i === activeIndex) item.scrollIntoView({ block: 'nearest' });
            });
        }
    }

    // 点击外部关闭搜索
    document.addEventListener('click', function(e) {
        if (searchInput && searchResults &&
            !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            setResultsVisible(false);
            activeIndex = -1;
        }
    });

    if (searchResults) {
        searchResults.addEventListener('mouseover', function(e) {
            var item = e.target.closest('.search-result-item');
            if (item) {
                searchResults.querySelectorAll('.search-result-item').forEach(function(el) {
                    el.classList.toggle('active', el === item);
                });
                activeIndex = parseInt(item.getAttribute('data-index'));
            }
        });
    }
})();

// 侧边栏、主题切换、UI 交互
document.addEventListener('DOMContentLoaded', function() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');

    // ===== 深色模式切换（单实例） =====
    var themeToggle = document.getElementById('themeToggle');
    var root = document.documentElement;

    function getPreferredTheme() {
        var stored = localStorage.getItem('theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
        }
    }

    applyTheme(getPreferredTheme());

    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            var current = root.getAttribute('data-theme');
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    // 监听系统主题变化
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    // ===== 移动端侧边栏切换 =====
    function toggleSidebar() {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    }

    var sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        }
    });

    // ===== 目录树展开/折叠 =====
    if (sidebar) {
        sidebar.addEventListener('click', function(e) {
            var btn = e.target.closest('.js-tree-toggle');
            if (!btn) return;
            var toggle = btn.querySelector('.tree-toggle');
            var children = btn.nextElementSibling;
            if (children && children.classList.contains('tree-children')) {
                toggle.classList.toggle('expanded');
                children.classList.toggle('expanded');
                btn.setAttribute('aria-expanded', children.classList.contains('expanded'));
            }
        });
    }

    // ===== 回到顶部 =====
    var backToTop = document.getElementById('backToTop');
    if (backToTop) {
        window.addEventListener('scroll', function() {
            backToTop.classList.toggle('show', window.pageYOffset > 300);
        });
        backToTop.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ===== 表格响应式包装 =====
    var tables = document.querySelectorAll('main table');
    for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        if (!table.parentElement.classList.contains('table-wrapper')) {
            var wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    }

    // ===== 标题锚点链接 =====
    var headings = document.querySelectorAll('main h2, main h3, main h4');
    for (var h = 0; h < headings.length; h++) {
        var heading = headings[h];
        if (heading.id) {
            var anchor = document.createElement('a');
            anchor.className = 'heading-anchor';
            anchor.href = '#' + heading.id;
            anchor.textContent = '#';
            anchor.setAttribute('aria-hidden', 'false');
            heading.appendChild(anchor);
        }
    }

    // ===== 侧边栏目录（TOC）+ 滚动同步高亮 =====
    (function() {
        var tocContainer = document.getElementById('sidebarToc');
        var tocList = document.getElementById('tocList');
        if (!tocContainer || !tocList) return;

        // 收集标题（h2 / h3 / h4）
        var tocHeadings = [];
        var headingEls = document.querySelectorAll('main h2[id], main h3[id], main h4[id]');
        for (var i = 0; i < headingEls.length; i++) {
            tocHeadings.push(headingEls[i]);
        }

        // 标题少于 2 个时隐藏 TOC
        if (tocHeadings.length < 2) {
            tocContainer.style.display = 'none';
            return;
        }

        // 计算最大缩进层级
        var minLevel = 6;
        for (var i = 0; i < tocHeadings.length; i++) {
            var lv = parseInt(tocHeadings[i].tagName.charAt(1));
            if (lv < minLevel) minLevel = lv;
        }

        // 构建 TOC HTML
        var html = '';
        for (var i = 0; i < tocHeadings.length; i++) {
            var h = tocHeadings[i];
            var level = parseInt(h.tagName.charAt(1)) - minLevel;
            var text = h.textContent.replace(/#$/, '').trim();
            html += '<a class="toc-item toc-level-' + level + '" href="#' + h.id + '" data-heading-id="' + h.id + '">' + text + '</a>';
        }
        tocList.innerHTML = html;

        var tocLinks = tocList.querySelectorAll('.toc-item');
        var activeId = '';

        // 点击 TOC 链接时关闭移动侧边栏
        tocList.addEventListener('click', function(e) {
            var link = e.target.closest('.toc-item');
            if (!link) return;
            if (sidebar && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
                overlay.classList.remove('show');
            }
        });

        // 高亮当前标题
        function setActive(id) {
            if (id === activeId) return;
            activeId = id;
            for (var i = 0; i < tocLinks.length; i++) {
                var link = tocLinks[i];
                var isActive = link.getAttribute('data-heading-id') === id;
                link.classList.toggle('active', isActive);
            }
            // 自动滚动 TOC 使活跃项可见
            var activeLink = tocList.querySelector('.toc-item.active');
            if (activeLink) {
                var containerRect = tocList.getBoundingClientRect();
                var linkRect = activeLink.getBoundingClientRect();
                if (linkRect.top < containerRect.top || linkRect.bottom > containerRect.bottom) {
                    activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        }

        // IntersectionObserver（性能优先）
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function(entries) {
                for (var i = entries.length - 1; i >= 0; i--) {
                    if (entries[i].isIntersecting) {
                        setActive(entries[i].target.id);
                        return;
                    }
                }
            }, {
                rootMargin: '-80px 0px -60% 0px',
                threshold: 0
            });
            for (var i = 0; i < tocHeadings.length; i++) {
                observer.observe(tocHeadings[i]);
            }
        } else {
            // 回退：scroll 事件
            var scrollTimer = null;
            window.addEventListener('scroll', function() {
                if (scrollTimer) return;
                scrollTimer = setTimeout(function() {
                    scrollTimer = null;
                    var scrollTop = window.pageYOffset + 100;
                    var current = '';
                    for (var i = 0; i < tocHeadings.length; i++) {
                        if (tocHeadings[i].offsetTop <= scrollTop) {
                            current = tocHeadings[i].id;
                        }
                    }
                    if (current) setActive(current);
                }, 100);
            }, { passive: true });
        }
    })();

    // ===== 代码块复制按钮（单实例） =====
    var codeBlocks = document.querySelectorAll('pre');
    for (var i = 0; i < codeBlocks.length; i++) {
        var pre = codeBlocks[i];
        if (pre.querySelector('.code-copy-btn')) continue;
        var copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.textContent = '复制';
        copyBtn.setAttribute('aria-label', '复制代码');
        copyBtn.addEventListener('click', (function(button) {
            return function() {
                var preBlock = button.closest('.highlight') || button.closest('pre');
                var code = preBlock ? preBlock.querySelector('code') : null;
                var text = code ? code.textContent : preBlock.textContent;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function() {
                        button.textContent = '已复制 ✓';
                        button.classList.add('copied');
                        setTimeout(function() {
                            button.textContent = '复制';
                            button.classList.remove('copied');
                        }, 1500);
                    });
                } else {
                    var textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.cssText = 'position:fixed;opacity:0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try { document.execCommand('copy'); button.textContent = '已复制 ✓'; button.classList.add('copied'); }
                    catch(ex) { button.textContent = '失败'; }
                    document.body.removeChild(textarea);
                    setTimeout(function() { button.textContent = '复制'; button.classList.remove('copied'); }, 1500);
                }
            };
        })(copyBtn));
        pre.style.position = 'relative';
        pre.appendChild(copyBtn);
    }

    // ===== 高亮当前页面在目录树中的位置 =====
    var currentPath = window.location.pathname;
    var treeLinks = document.querySelectorAll('.dir-tree a.tree-item');
    for (var i = 0; i < treeLinks.length; i++) {
        var link = treeLinks[i];
        var href = link.getAttribute('href');
        if (href) {
            var normalizedHref = href.replace(/\/$/, '');
            var normalizedPath = currentPath.replace(/\/$/, '');
            if (normalizedPath === normalizedHref || normalizedPath.indexOf(normalizedHref + '/') === 0) {
                link.classList.add('active');
                var parent = link.closest('.tree-children');
                while (parent) {
                    parent.classList.add('expanded');
                    var toggleBtn = parent.previousElementSibling;
                    if (toggleBtn) {
                        var tg = toggleBtn.querySelector('.tree-toggle');
                        if (tg) tg.classList.add('expanded');
                        toggleBtn.setAttribute('aria-expanded', 'true');
                    }
                    parent = parent.parentElement ? parent.parentElement.closest('.tree-children') : null;
                }
            }
        }
    }
});
