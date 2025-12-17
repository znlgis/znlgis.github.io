// 主 JavaScript 文件

// 返回顶部按钮功能
(function() {
    'use strict';
    
    // 创建返回顶部按钮
    function createBackToTopButton() {
        const button = document.createElement('a');
        button.href = '#';
        button.className = 'back-to-top';
        button.innerHTML = '↑ 顶部';
        button.setAttribute('aria-label', '返回顶部');
        document.body.appendChild(button);
        return button;
    }
    
    // 显示/隐藏返回顶部按钮
    function toggleBackToTopButton(button) {
        if (window.pageYOffset > 300) {
            button.style.display = 'block';
        } else {
            button.style.display = 'none';
        }
    }
    
    // 平滑滚动到顶部
    function scrollToTop(e) {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        const backToTopButton = createBackToTopButton();
        
        // 监听滚动事件
        window.addEventListener('scroll', function() {
            toggleBackToTopButton(backToTopButton);
        });
        
        // 点击返回顶部
        backToTopButton.addEventListener('click', scrollToTop);
    });
})();

// 代码块复制功能
(function() {
    'use strict';
    
    document.addEventListener('DOMContentLoaded', function() {
        // 为所有代码块添加复制按钮
        const codeBlocks = document.querySelectorAll('pre code');
        
        codeBlocks.forEach(function(codeBlock) {
            const pre = codeBlock.parentElement;
            
            // 创建复制按钮
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-code-button';
            copyButton.innerHTML = '📋 复制';
            copyButton.setAttribute('aria-label', '复制代码');
            
            // 添加样式
            copyButton.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                padding: 0.25rem 0.5rem;
                font-size: 0.8rem;
                background: #f6f8fa;
                border: 1px solid #d1d5db;
                border-radius: 3px;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s;
            `;
            
            // 设置 pre 样式
            pre.style.position = 'relative';
            
            // 添加按钮
            pre.appendChild(copyButton);
            
            // 复制功能
            copyButton.addEventListener('click', function() {
                const code = codeBlock.textContent;
                
                // 使用 Clipboard API
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(function() {
                        copyButton.innerHTML = '✓ 已复制';
                        setTimeout(function() {
                            copyButton.innerHTML = '📋 复制';
                        }, 2000);
                    }).catch(function(err) {
                        console.error('复制失败:', err);
                        copyButton.innerHTML = '✗ 失败';
                    });
                } else {
                    // 降级方案
                    const textarea = document.createElement('textarea');
                    textarea.value = code;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        copyButton.innerHTML = '✓ 已复制';
                        setTimeout(function() {
                            copyButton.innerHTML = '📋 复制';
                        }, 2000);
                    } catch (err) {
                        console.error('复制失败:', err);
                        copyButton.innerHTML = '✗ 失败';
                    }
                    document.body.removeChild(textarea);
                }
            });
            
            // 鼠标悬停效果
            copyButton.addEventListener('mouseenter', function() {
                copyButton.style.opacity = '1';
            });
            
            copyButton.addEventListener('mouseleave', function() {
                copyButton.style.opacity = '0.7';
            });
        });
    });
})();

// 外部链接在新标签页打开
(function() {
    'use strict';
    
    document.addEventListener('DOMContentLoaded', function() {
        const links = document.querySelectorAll('a[href^="http"]');
        
        links.forEach(function(link) {
            const url = new URL(link.href);
            // 如果不是当前域名，添加 target="_blank"
            if (url.hostname !== window.location.hostname) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
    });
})();

// 添加目录自动生成（可选）
(function() {
    'use strict';
    
    document.addEventListener('DOMContentLoaded', function() {
        const content = document.querySelector('main');
        if (!content) return;
        
        const headings = content.querySelectorAll('h2, h3');
        if (headings.length < 3) return; // 少于3个标题不生成目录
        
        // 创建目录容器
        const toc = document.createElement('div');
        toc.className = 'toc';
        
        const tocTitle = document.createElement('h2');
        tocTitle.textContent = '目录';
        toc.appendChild(tocTitle);
        
        const tocList = document.createElement('ul');
        
        headings.forEach(function(heading, index) {
            // 为标题添加 ID
            if (!heading.id) {
                heading.id = 'heading-' + index;
            }
            
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#' + heading.id;
            link.textContent = heading.textContent;
            
            // 根据标题级别添加缩进
            if (heading.tagName === 'H3') {
                listItem.style.marginLeft = '1rem';
            }
            
            listItem.appendChild(link);
            tocList.appendChild(listItem);
        });
        
        toc.appendChild(tocList);
        
        // 将目录插入到第一个 h1 之后
        const firstH1 = content.querySelector('h1');
        if (firstH1 && firstH1.nextElementSibling) {
            firstH1.parentNode.insertBefore(toc, firstH1.nextElementSibling);
        }
    });
})();
