/**
 * znlgis.github.io — 主脚本
 * 搜索 / 主题 / 侧边栏 / 目录树 / 页内目录 / 代码复制 / 表格与锚点增强
 */
(function () {
    'use strict';

    var STORAGE = {
        theme: 'theme',
        tree: 'tree-open'
    };

    /* ------------------------------------------------------------------
     * localStorage 安全包装：隐私模式下可能直接抛错
     * ---------------------------------------------------------------- */
    var store = {
        get: function (key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        set: function (key, value) {
            try { localStorage.setItem(key, value); } catch (e) { /* 忽略 */ }
        }
    };

    /* ------------------------------------------------------------------
     * 1. 客户端即时搜索
     * ---------------------------------------------------------------- */
    (function () {
        var searchData = null;
        var searchInput = document.getElementById('searchInput');
        var searchResults = document.getElementById('searchResults');
        if (!searchInput || !searchResults) return;

        var SCORE_TITLE_EXACT = 100;
        var SCORE_TITLE_FUZZY = 60;
        var SCORE_DESC_EXACT = 30;
        var SCORE_CONTENT_EXACT = 20;
        var MAX_SEARCH_RESULTS = 15;

        var activeIndex = -1;
        var searchTimeout = null;
        var currentResults = [];

        function setResultsVisible(visible) {
            searchResults.classList.toggle('show', visible);
            searchInput.setAttribute('aria-expanded', visible ? 'true' : 'false');
        }

        function loadSearchData(callback) {
            if (searchData !== null) {
                callback(searchData);
                return;
            }
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                if (xhr.status === 200) {
                    try { searchData = JSON.parse(xhr.responseText); } catch (e) { searchData = []; }
                } else {
                    searchData = [];
                }
                callback(searchData);
            };
            xhr.onerror = function () { searchData = []; callback(searchData); };
            xhr.open('GET', '/search.json', true);
            xhr.send();
        }

        function fuzzyMatch(text, query) {
            var t = text.toLowerCase();
            var q = query.toLowerCase();
            if (t.indexOf(q) !== -1) return true;
            var qi = 0;
            for (var i = 0; i < t.length && qi < q.length; i++) {
                if (t[i] === q[qi]) qi++;
            }
            return qi === q.length;
        }

        function escapeHtml(str) {
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(str == null ? '' : String(str)));
            return div.innerHTML.replace(/"/g, '&quot;');
        }

        function highlightMatch(text, query) {
            var t = (text || '').toLowerCase();
            var q = query.toLowerCase();
            var idx = t.indexOf(q);
            if (idx === -1) return escapeHtml(text);
            return escapeHtml(text.substring(0, idx)) +
                '<mark>' + escapeHtml(text.substring(idx, idx + q.length)) + '</mark>' +
                escapeHtml((text || '').substring(idx + q.length));
        }

        function updateActive(items) {
            for (var i = 0; i < items.length; i++) {
                var isActive = i === activeIndex;
                items[i].classList.toggle('active', isActive);
                items[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
                if (isActive) items[i].scrollIntoView({ block: 'nearest' });
            }
        }

        function doSearch(query) {
            if (!query || query.trim().length === 0) {
                searchResults.innerHTML = '';
                currentResults = [];
                setResultsVisible(false);
                activeIndex = -1;
                return;
            }
            loadSearchData(function (data) {
                if (!data || data.length === 0) {
                    searchResults.innerHTML = '<div class="search-no-results">暂无搜索结果</div>';
                    currentResults = [];
                    setResultsVisible(true);
                    return;
                }
                var results = [];
                var q = query.trim();
                var qLower = q.toLowerCase();
                for (var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var title = item.title || '';
                    var description = item.description || '';
                    var content = item.content || '';
                    var score = 0;
                    if (title.toLowerCase().indexOf(qLower) !== -1) { score += SCORE_TITLE_EXACT; }
                    else if (fuzzyMatch(title, q)) { score += SCORE_TITLE_FUZZY; }
                    if (description.toLowerCase().indexOf(qLower) !== -1) score += SCORE_DESC_EXACT;
                    if (content.toLowerCase().indexOf(qLower) !== -1) score += SCORE_CONTENT_EXACT;
                    if (score > 0) results.push({ item: item, score: score });
                }
                results.sort(function (a, b) { return b.score - a.score; });
                currentResults = results.slice(0, MAX_SEARCH_RESULTS).map(function (e) { return e.item; });

                if (currentResults.length === 0) {
                    searchResults.innerHTML = '<div class="search-no-results">未找到匹配的教程</div>';
                } else {
                    var html = '';
                    for (var j = 0; j < currentResults.length; j++) {
                        html += '<a class="search-result-item" role="option" aria-selected="false" href="' +
                            escapeHtml(currentResults[j].url) + '" data-index="' + j + '">' +
                            highlightMatch(currentResults[j].title, q) + '</a>';
                    }
                    searchResults.innerHTML = html;
                }
                setResultsVisible(true);
                activeIndex = -1;
            });
        }

        searchInput.addEventListener('input', function () {
            var query = this.value;
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function () { doSearch(query); }, 150);
        });

        searchInput.addEventListener('focus', function () {
            if (this.value.trim().length > 0) doSearch(this.value);
            if (searchData === null) loadSearchData(function () {});
        });

        searchInput.addEventListener('keydown', function (e) {
            var items = searchResults.querySelectorAll('.search-result-item');
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

        document.addEventListener('click', function (e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                setResultsVisible(false);
                activeIndex = -1;
            }
        });

        searchResults.addEventListener('mouseover', function (e) {
            var item = e.target.closest('.search-result-item');
            if (!item) return;
            var all = searchResults.querySelectorAll('.search-result-item');
            for (var i = 0; i < all.length; i++) {
                all[i].classList.toggle('active', all[i] === item);
            }
            activeIndex = parseInt(item.getAttribute('data-index'), 10);
        });

        /* 全站快捷键：/ 聚焦搜索，Esc 退出 */
        document.addEventListener('keydown', function (e) {
            var tag = (e.target.tagName || '').toLowerCase();
            var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
            if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });
    })();

    /* ------------------------------------------------------------------
     * 2. 主题切换
     * ---------------------------------------------------------------- */
    (function () {
        var root = document.documentElement;
        var themeToggle = document.getElementById('themeToggle');

        function systemTheme() {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light';
        }

        function applyTheme(theme, persist) {
            root.setAttribute('data-theme', theme);
            if (persist) store.set(STORAGE.theme, theme);
            if (themeToggle) {
                themeToggle.setAttribute(
                    'aria-label',
                    theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'
                );
                themeToggle.setAttribute('title', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
                themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
            }
            /* 通知依赖主题的脚本（如 mermaid 之类） */
            document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
        }

        applyTheme(store.get(STORAGE.theme) || systemTheme(), false);

        if (themeToggle) {
            themeToggle.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                applyTheme(next, true);
            });
        }

        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var onChange = function (e) {
                if (!store.get(STORAGE.theme)) applyTheme(e.matches ? 'dark' : 'light', false);
            };
            if (mq.addEventListener) mq.addEventListener('change', onChange);
            else if (mq.addListener) mq.addListener(onChange);
        }
    })();

    /* ------------------------------------------------------------------
     * 3. 侧边栏（移动端抽屉）与目录树
     * ---------------------------------------------------------------- */
    (function () {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebarOverlay');
        var sidebarToggle = document.getElementById('sidebarToggle');
        if (!sidebar || !overlay) return;

        function setSidebar(open) {
            sidebar.classList.toggle('show', open);
            overlay.classList.toggle('show', open);
            if (sidebarToggle) {
                sidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                sidebarToggle.setAttribute('aria-label', open ? '隐藏目录导航' : '显示目录导航');
            }
            document.body.style.overflow = open ? 'hidden' : '';
        }

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', function () {
                setSidebar(!sidebar.classList.contains('show'));
            });
        }

        overlay.addEventListener('click', function () { setSidebar(false); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && sidebar.classList.contains('show')) setSidebar(false);
        });

        /* ---- 目录树展开/折叠，状态跨页记住 ---- */
        var treeGroups = sidebar.querySelectorAll('.js-tree-toggle');
        var openPaths = [];
        try {
            openPaths = JSON.parse(store.get(STORAGE.tree) || '[]');
        } catch (e) {
            openPaths = [];
        }

        function groupKey(btn) {
            /* 用 navigation.yml 的稳定 id，标题改动不会丢失用户展开状态 */
            return btn.getAttribute('data-group') || '';
        }

        function setGroup(btn, expanded, animate) {
            var children = btn.nextElementSibling;
            if (!children || !children.classList.contains('tree-children')) return;
            var toggle = btn.querySelector('.tree-toggle');
            children.classList.toggle('expanded', expanded);
            if (toggle) toggle.classList.toggle('expanded', expanded);
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            if (!animate) {
                children.style.animation = 'none';
                /* 强制回流后再还原，避免首屏展开时闪一下 */
                void children.offsetHeight;
                children.style.animation = '';
            }
        }

        function persistOpenGroups() {
            var open = [];
            for (var i = 0; i < treeGroups.length; i++) {
                if (treeGroups[i].getAttribute('aria-expanded') === 'true') {
                    open.push(groupKey(treeGroups[i]));
                }
            }
            store.set(STORAGE.tree, JSON.stringify(open));
        }

        /* 先按上次状态恢复 */
        for (var g = 0; g < treeGroups.length; g++) {
            if (openPaths.indexOf(groupKey(treeGroups[g])) !== -1) {
                setGroup(treeGroups[g], true, false);
            }
        }

        sidebar.addEventListener('click', function (e) {
            var btn = e.target.closest('.js-tree-toggle');
            if (!btn) return;
            var expanded = btn.getAttribute('aria-expanded') === 'true';
            setGroup(btn, !expanded, true);
            persistOpenGroups();
        });

        /* ---- 高亮当前页，并展开其所有祖先分组 ---- */
        var currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
        var treeLinks = sidebar.querySelectorAll('.dir-tree a.tree-item');

        for (var i = 0; i < treeLinks.length; i++) {
            var link = treeLinks[i];
            var href = link.getAttribute('href');
            if (!href) continue;
            var normalizedHref = href.replace(/\/+$/, '') || '/';
            if (currentPath === normalizedHref || currentPath.indexOf(normalizedHref + '/') === 0) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');

                var parent = link.closest('.tree-children');
                while (parent) {
                    parent.classList.add('expanded');
                    var toggleBtn = parent.previousElementSibling;
                    if (toggleBtn && toggleBtn.classList.contains('tree-item')) {
                        var tg = toggleBtn.querySelector('.tree-toggle');
                        if (tg) tg.classList.add('expanded');
                        toggleBtn.setAttribute('aria-expanded', 'true');
                    }
                    var parentLi = parent.parentElement;
                    parent = parentLi && parentLi.closest ? parentLi.closest('.tree-children') : null;
                }
            }
        }

        /* 当前页展开的祖先分组不写入持久化，避免污染用户手动折叠的偏好 */
    })();

    /* ------------------------------------------------------------------
     * 4. 回到顶部
     * ---------------------------------------------------------------- */
    (function () {
        var backToTop = document.getElementById('backToTop');
        if (!backToTop) return;
        var ticking = false;

        function update() {
            var show = window.pageYOffset > 400;
            backToTop.classList.toggle('show', show);
            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }, { passive: true });

        update();

        backToTop.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            /* 键盘用户：焦点回到主内容 */
            var main = document.getElementById('main-content');
            if (main) main.focus({ preventScroll: true });
        });
    })();

    /* ------------------------------------------------------------------
     * 5. 正文增强：表格包裹、标题锚点、代码复制
     * ---------------------------------------------------------------- */
    (function () {
        var main = document.querySelector('main');
        if (!main) return;

        /* 表格横向滚动容器 */
        var tables = main.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            var table = tables[i];
            if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) continue;
            var wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }

        /* 标题锚点 */
        var headings = main.querySelectorAll('h2[id], h3[id], h4[id]');
        for (var h = 0; h < headings.length; h++) {
            var heading = headings[h];
            if (heading.querySelector('.heading-anchor')) continue;
            var anchor = document.createElement('a');
            anchor.className = 'heading-anchor';
            anchor.href = '#' + heading.id;
            anchor.textContent = '#';
            anchor.setAttribute('aria-label', '链接到本节');
            heading.appendChild(anchor);
        }

        /* 代码复制 */
        function copyText(text, onOk, onFail) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(onOk, onFail);
                return;
            }
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.cssText = 'position:fixed;top:-9999px;opacity:0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy') ? onOk() : onFail();
            } catch (e) {
                onFail();
            }
            document.body.removeChild(textarea);
        }

        var pres = main.querySelectorAll('pre');
        for (var p = 0; p < pres.length; p++) {
            (function (pre) {
                if (pre.querySelector('.code-copy-btn')) return;
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'code-copy-btn';
                btn.textContent = '复制';
                btn.setAttribute('aria-label', '复制代码');

                var resetTimer = null;
                function flash(text, ok) {
                    btn.textContent = text;
                    btn.classList.toggle('copied', ok);
                    clearTimeout(resetTimer);
                    resetTimer = setTimeout(function () {
                        btn.textContent = '复制';
                        btn.classList.remove('copied');
                    }, 1600);
                }

                btn.addEventListener('click', function () {
                    var codeEl = pre.querySelector('code');
                    var text = codeEl ? codeEl.textContent : pre.textContent;
                    copyText(text, function () { flash('已复制 ✓', true); },
                             function () { flash('复制失败', false); });
                });

                /* 让绝对定位的按钮以代码块为参照 */
                if (window.getComputedStyle(pre).position === 'static') {
                    pre.style.position = 'relative';
                }
                pre.appendChild(btn);
            })(pres[p]);
        }
    })();

    /* ------------------------------------------------------------------
     * 6. 页内目录（TOC）+ 滚动高亮
     * ---------------------------------------------------------------- */
    (function () {
        var tocContainer = document.getElementById('sidebarToc');
        var tocList = document.getElementById('tocList');
        if (!tocContainer || !tocList) return;

        var headingEls = document.querySelectorAll('main h2[id], main h3[id], main h4[id]');
        if (headingEls.length < 2) {
            tocContainer.style.display = 'none';
            return;
        }

        var minLevel = 6;
        for (var i = 0; i < headingEls.length; i++) {
            var lv = parseInt(headingEls[i].tagName.charAt(1), 10);
            if (lv < minLevel) minLevel = lv;
        }

        var html = '';
        for (var j = 0; j < headingEls.length; j++) {
            var h = headingEls[j];
            var level = Math.min(parseInt(h.tagName.charAt(1), 10) - minLevel, 2);
            var text = h.textContent.replace(/#$/, '').trim();
            html += '<a class="toc-item toc-level-' + level + '" href="#' + h.id +
                '" data-heading-id="' + h.id + '">' + text + '</a>';
        }
        tocList.innerHTML = html;

        var tocLinks = tocList.querySelectorAll('.toc-item');
        var activeId = '';

        function setActive(id) {
            if (id === activeId) return;
            activeId = id;
            for (var k = 0; k < tocLinks.length; k++) {
                var isActive = tocLinks[k].getAttribute('data-heading-id') === id;
                tocLinks[k].classList.toggle('active', isActive);
                if (isActive) tocLinks[k].setAttribute('aria-current', 'true');
                else tocLinks[k].removeAttribute('aria-current');
            }
            var activeLink = tocList.querySelector('.toc-item.active');
            if (activeLink) {
                var containerRect = tocList.getBoundingClientRect();
                var linkRect = activeLink.getBoundingClientRect();
                if (linkRect.top < containerRect.top || linkRect.bottom > containerRect.bottom) {
                    activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        }

        if ('IntersectionObserver' in window) {
            var visible = new Set();
            var observer = new IntersectionObserver(function (entries) {
                for (var m = 0; m < entries.length; m++) {
                    var entry = entries[m];
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                /* 取文档顺序中第一个可见标题，避免快速滚动时抖动 */
                for (var n = 0; n < headingEls.length; n++) {
                    if (visible.has(headingEls[n].id)) {
                        setActive(headingEls[n].id);
                        return;
                    }
                }
            }, {
                rootMargin: '-80px 0px -65% 0px',
                threshold: 0
            });
            for (var k = 0; k < headingEls.length; k++) observer.observe(headingEls[k]);
        } else {
            var scrollTimer = null;
            window.addEventListener('scroll', function () {
                if (scrollTimer) return;
                scrollTimer = setTimeout(function () {
                    scrollTimer = null;
                    var scrollTop = window.pageYOffset + 100;
                    var current = '';
                    for (var n = 0; n < headingEls.length; n++) {
                        if (headingEls[n].offsetTop <= scrollTop) current = headingEls[n].id;
                    }
                    if (current) setActive(current);
                }, 100);
            }, { passive: true });
        }

        /* 手机端点击目录后收起抽屉 */
        tocList.addEventListener('click', function (e) {
            var link = e.target.closest('.toc-item');
            if (!link) return;
            var sidebar = document.getElementById('sidebar');
            var overlay = document.getElementById('sidebarOverlay');
            if (sidebar && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
                if (overlay) overlay.classList.remove('show');
                document.body.style.overflow = '';
                var toggle = document.getElementById('sidebarToggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
    })();
})();
