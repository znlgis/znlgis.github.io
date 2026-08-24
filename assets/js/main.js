/**
 * znlgis.github.io — 主脚本
 * 提取自 _layouts/default.html 内联 <script> 标签
 * 包含：客户端即时搜索 + 侧边栏/UI 交互
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

    // 懒加载搜索索引
    function loadSearchData(callback) {
        if (searchData !== null) {
            callback(searchData);
            return;
        }
        const xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    searchData = JSON.parse(xhr.responseText);
                } catch(e) {
                    searchData = [];
                }
            } else {
                searchData = [];
            }
            callback(searchData);
        };
        xhr.onerror = function() {
            searchData = [];
            callback(searchData);
        };
        xhr.open('GET', '/search.json', true);
        xhr.send();
    }

    // 模糊搜索（支持中文和拼音简拼）
    function fuzzyMatch(text, query) {
        const t = text.toLowerCase();
        const q = query.toLowerCase();
        if (t.indexOf(q) !== -1) return true;
        // 分词匹配：query 中的每个字符都按顺序出现在 text 中
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

                if (titleLower.indexOf(qLower) !== -1) {
                    score += SCORE_TITLE_EXACT;
                } else if (fuzzyMatch(title, q)) {
                    score += SCORE_TITLE_FUZZY;
                }
                if (descLower.indexOf(qLower) !== -1) score += SCORE_DESC_EXACT;
                if (contentLower.indexOf(qLower) !== -1) score += SCORE_CONTENT_EXACT;

                if (score > 0) {
                    results.push({ item: item, score: score });
                }
            }
            results.sort(function(a, b) { return b.score - a.score; });
            currentResults = results.slice(0, MAX_SEARCH_RESULTS).map(function(entry) { return entry.item; });
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
        const before = escapeHtml(text.substring(0, idx));
        const match = '<mark style="background:#fff3cd;padding:0 1px;border-radius:2px;">' + escapeHtml(text.substring(idx, idx + q.length)) + '</mark>';
        const after = escapeHtml(text.substring(idx + q.length));
        return before + match + after;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value;
        searchTimeout = setTimeout(function() { doSearch(query); }, 150);
    });

    searchInput.addEventListener('focus', function() {
        if (this.value.trim().length > 0) {
            doSearch(this.value);
        }
        // 首次聚焦预加载索引
        if (searchData === null) {
            loadSearchData(function(){});
        }
    });

    // 键盘导航
    searchInput.addEventListener('keydown', function(e) {
        const items = searchResults.querySelectorAll('.search-result-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                updateActive(items);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                activeIndex = Math.max(activeIndex - 1, 0);
                updateActive(items);
            }
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
            if (i === activeIndex) {
                item.classList.add('active');
                item.setAttribute('aria-selected', 'true');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            }
        });
    }

    // 点击外部关闭搜索
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            setResultsVisible(false);
            activeIndex = -1;
        }
    });

    // 结果项悬停时激活
    searchResults.addEventListener('mouseover', function(e) {
        const item = e.target.closest('.search-result-item');
        if (item) {
        const items = searchResults.querySelectorAll('.search-result-item');
            items.forEach(function(el, i) {
                el.classList.toggle('active', el === item);
            });
            activeIndex = parseInt(item.getAttribute('data-index'));
        }
    });
})();

// 侧边栏目录树与移动端交互
document.addEventListener('DOMContentLoaded', function() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');

    // ===== 深色模式切换 =====
    var themeToggle = document.getElementById('themeToggle');
    var html = document.documentElement;
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
        themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }
    themeToggle.addEventListener('click', function() {
        var current = html.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    });

    // 移动端侧边栏切换
    function toggleSidebar() {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    }

    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);

    // Escape 键关闭侧边栏
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        }
    });

    // 目录树展开/折叠（事件委托）
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

    // 回到顶部
    var backToTop = document.getElementById('backToTop');
    window.addEventListener('scroll', function() {
        backToTop.classList.toggle('show', window.pageYOffset > 300);
    });
    backToTop.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 表格响应式包装
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

    // 标题锚点链接
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

    // ===== 代码块复制按钮 =====
    var codeBlocks = document.querySelectorAll('.highlight, pre');
    for (var i = 0; i < codeBlocks.length; i++) {
        var block = codeBlocks[i];
        var codeEl = block.querySelector('code');
        if (!codeEl) continue;
        var copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.textContent = '复制';
        copyBtn.setAttribute('aria-label', '复制代码');
        copyBtn.addEventListener('click', function(e) {
            var btn = e.target;
            var pre = btn.closest('.highlight') || btn.closest('pre');
            var code = pre ? pre.querySelector('code') : null;
            if (code) {
                var text = code.textContent;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(function() {
                        btn.textContent = '已复制 ✓';
                        setTimeout(function() { btn.textContent = '复制'; }, 1500);
                    });
                } else {
                    var textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try { document.execCommand('copy'); btn.textContent = '已复制 ✓'; } catch(ex) { btn.textContent = '失败'; }
                    document.body.removeChild(textarea);
                    setTimeout(function() { btn.textContent = '复制'; }, 1500);
                }
            }
        });
        block.style.position = 'relative';
        block.appendChild(copyBtn);
    }

    // 高亮当前页面在目录树中的位置
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

    // 代码块复制按钮
    function addCopyButtons() {
        var blocks = document.querySelectorAll('pre');
        for (var b = 0; b < blocks.length; b++) {
            var pre = blocks[b];
            if (pre.querySelector('.code-copy-btn')) continue;
            var btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.textContent = '复制';
            btn.setAttribute('aria-label', '复制代码');
            btn.addEventListener('click', (function(codeEl, button) {
                return function() {
                    var code = codeEl.querySelector('code');
                    var text = code ? code.textContent : codeEl.textContent;
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
                        var ta = document.createElement('textarea');
                        ta.value = text;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        button.textContent = '已复制 ✓';
                        button.classList.add('copied');
                        setTimeout(function() {
                            button.textContent = '复制';
                            button.classList.remove('copied');
                        }, 1500);
                    }
                };
            })(pre, btn));
            pre.style.position = 'relative';
            pre.appendChild(btn);
        }
    }
    addCopyButtons();

    // 暗黑模式
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
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
});
