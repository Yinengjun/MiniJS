// ==UserScript==
// @name         YouTube 优化
// @description  自动设置 YouTube 视频分辨率、播放速度，添加网页全屏功能，整合到控制面板，支持自动隐藏与收起。
// @match        *://www.youtube.com/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    const qualityMap = {
        'highres': '8K',
        'hd2160': '4K',
        'hd1440': '1440p',
        'hd1080': '1080p',
        'hd720': '720p',
        'large': '480p',
        'medium': '360p',
        'small': '240p',
        'tiny': '144p'
    };

    const speedOptions = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 16];
    let defaultQuality = localStorage.getItem('yt-default-quality') || 'hd1080';
    let defaultSpeed = parseFloat(localStorage.getItem('yt-default-speed')) || 2;

    function setVideoQuality(quality) {
        const ytPlayer = document.querySelector('ytd-player')?.getPlayer?.();
        if (ytPlayer && typeof ytPlayer.setPlaybackQuality === 'function') {
            ytPlayer.setPlaybackQualityRange(quality);
            ytPlayer.setPlaybackQuality(quality);
            console.log(`[YouTube脚本] 画质设置为：${quality}`);
        }
    }

    function setPlaybackSpeed(speed) {
        const video = document.querySelector('video');
        if (video) {
            video.playbackRate = speed;
            console.log(`[YouTube脚本] 倍速设置为：${speed}x`);
        }
    }

    function getYouTubeTheme() {
        const isDark = document.documentElement.getAttribute('dark') === '' ||
                       document.documentElement.getAttribute('dark') === 'true' ||
                       document.documentElement.classList.contains('dark');
        return isDark ? 'dark' : 'light';
    }

    function toggleWebFullscreen() {
        const player = document.querySelector('.html5-video-player');
        if (!player) return;

        const bgId = 'webfullscreen-bg';
        let bg = document.getElementById(bgId);

        player.classList.toggle('webfullscreen');

        if (player.classList.contains('webfullscreen')) {
            player.style.position = 'fixed';
            player.style.top = 0;
            player.style.left = 0;
            player.style.width = '100vw';
            player.style.height = '100vh';
            player.style.zIndex = 9998;
            document.body.style.overflow = 'hidden';

            if (!bg) {
                bg = document.createElement('div');
                bg.id = bgId;
                bg.style.position = 'fixed';
                bg.style.top = 0;
                bg.style.left = 0;
                bg.style.width = '100vw';
                bg.style.height = '100vh';
                bg.style.zIndex = 9997;
                bg.style.backgroundColor = getYouTubeTheme() === 'dark' ? '#0f0f0f' : '#f9f9f9';
                document.body.appendChild(bg);
            }

            window.dispatchEvent(new Event('resize'));
        } else {
            player.removeAttribute('style');
            document.body.style.overflow = '';
            if (bg) bg.remove();
        }
    }

    function isVideoPage() {
        return location.href.includes('watch?v=');
    }

    function setupVideoEndListener() {
        const video = document.querySelector('video');
        if (!video) return;

        video.addEventListener('ended', () => {
            const player = document.querySelector('.html5-video-player.webfullscreen');
            if (player) {
                toggleWebFullscreen();
            }
        });
    }

    function tryAutoWebFullscreen() {
        const autoWebFullscreen = localStorage.getItem('yt-auto-webfullscreen') === 'true';
        if (!autoWebFullscreen) return;

        if (isVideoPage()) {
            const player = document.querySelector('.html5-video-player');
            if (player && !player.classList.contains('webfullscreen')) {
                toggleWebFullscreen();
            }
            setupVideoEndListener();  // 监听播放完毕事件，自动退出网页全屏
        } else {
            // 不是视频页，确保退出网页全屏
            const player = document.querySelector('.html5-video-player.webfullscreen');
            if (player) {
                toggleWebFullscreen();
            }
        }
    }

    function setupFullscreenQualitySwitcher() {
        const video = document.querySelector('video');
        if (!video) return;

        let prevQuality = null;

        document.addEventListener('fullscreenchange', () => {
            const isFullscreen = document.fullscreenElement !== null;
            const ytPlayer = document.querySelector('ytd-player')?.getPlayer?.();
            if (!ytPlayer) return;

            const autoSwitch = localStorage.getItem('yt-auto-fullscreen-quality') === 'true';
            const maxSwitch = localStorage.getItem('yt-fullscreen-max-quality') === 'true';
            const videoMaxSwitch = localStorage.getItem('yt-fullscreen-video-max-quality') === 'true';

            if (!autoSwitch && !maxSwitch && !videoMaxSwitch) return;

            if (isFullscreen) {
                prevQuality = ytPlayer.getPlaybackQuality?.();

                if (videoMaxSwitch) {
                    const levels = ytPlayer.getAvailableQualityLevels?.();
                    if (levels?.length > 0) {
                        const best = levels[0]; // 通常为视频最高分辨率
                        ytPlayer.setPlaybackQualityRange(best);
                        ytPlayer.setPlaybackQuality(best);
                        console.log(`[YouTube脚本] 进入全屏：使用视频最高画质 ${best}`);
                    }
                } else if (maxSwitch) {
                    const playerRect = document.querySelector('.html5-video-player')?.getBoundingClientRect?.();
                    if (playerRect) {
                        const width = playerRect.width * window.devicePixelRatio;
                        const height = playerRect.height * window.devicePixelRatio;
                        const targetHeight = Math.max(width, height); // 通常只看高即可

                        const levels = ytPlayer.getAvailableQualityLevels?.();
                        const matched = levels?.find(lv => {
                            const h = parseInt(lv.replace(/\D/g, '')) || 0;
                            return h <= targetHeight + 100; // 允许略大
                        });

                        if (matched) {
                            ytPlayer.setPlaybackQualityRange(matched);
                            ytPlayer.setPlaybackQuality(matched);
                            console.log(`[YouTube脚本] 进入全屏：按屏幕尺寸选择画质 ${matched}`);
                        }
                    }
                } else if (autoSwitch) {
                    const fullscreenQuality = localStorage.getItem('yt-fullscreen-quality-value') || 'hd1080';
                    ytPlayer.setPlaybackQualityRange(fullscreenQuality);
                    ytPlayer.setPlaybackQuality(fullscreenQuality);
                    console.log(`[YouTube脚本] 进入全屏：使用指定画质 ${fullscreenQuality}`);
                }
            } else {
                // 退出全屏：恢复原画质
                const restoreQuality = localStorage.getItem('yt-default-quality') || prevQuality;
                if (restoreQuality && restoreQuality !== ytPlayer.getPlaybackQuality?.()) {
                    ytPlayer.setPlaybackQualityRange(restoreQuality);
                    ytPlayer.setPlaybackQuality(restoreQuality);
                    console.log(`[YouTube脚本] 已退出全屏，画质恢复为 ${restoreQuality}`);
                }
            }

        });
    }

    function enforceMutualExclusion(...switches) {
        switches.forEach((sw, i) => {
            sw.addEventListener('change', () => {
                if (sw.checked) {
                    switches.forEach((other, j) => {
                        if (i !== j) {
                            other.checked = false;
                            localStorage.setItem(other.dataset.key, 'false');
                        }
                    });
                }
                localStorage.setItem(sw.dataset.key, sw.checked);
            });
        });
    }

    function setupRecommendationFilter() {
        const getSettings = () => ({
            enabled: localStorage.getItem('yt-filter-enabled') === 'true',
            filterHome: localStorage.getItem('yt-filter-home') === 'true',
            filterRelated: localStorage.getItem('yt-filter-related') === 'true',
            filterKeywords: localStorage.getItem('yt-filter-keywords') === 'true',
            filterProgress: localStorage.getItem('yt-filter-progress') === 'true',
            progressThreshold: parseInt(localStorage.getItem('yt-filter-progress-threshold')) || 90,
            keywords: JSON.parse(localStorage.getItem('yt-filter-words') || '[]')
        });

        let hiddenCount = 0;

        function containsKeyword(title, keywords) {
            return keywords.some(keyword => {
                return title.toLowerCase().includes(keyword.toLowerCase());
            });
        }

        function getPlayedPercentage(item) {
            const progressElem = item.querySelector('.ytd-thumbnail-overlay-resume-playback-renderer');
            if (progressElem && progressElem.style.width) {
                const match = progressElem.style.width.match(/([\d.]+)%/);
                if (match) return parseFloat(match[1]);
            }
            return 0;
        }

        function filterHomeVideos() {
            const settings = getSettings();
            if (!settings.enabled || !settings.filterHome) return;

            const items = document.querySelectorAll('ytd-rich-item-renderer:not([data-yt-filtered])');

            items.forEach(item => {
                const titleElem = item.querySelector('#video-title');
                const title = titleElem?.textContent.trim() || '';
                const playedPercent = getPlayedPercentage(item);

                const matchedByKeyword = settings.filterKeywords && containsKeyword(title, settings.keywords);
                const matchedByPlayed = settings.filterProgress && playedPercent >= settings.progressThreshold;

                if (matchedByKeyword || matchedByPlayed) {
                    item.style.display = 'none';
                    item.setAttribute('data-yt-filtered', '1');
                    hiddenCount++;
                } else {
                    item.setAttribute('data-yt-filtered', '0');
                }
            });
        }

        function observeHomePage() {
            const target = document.querySelector('ytd-page-manager');
            if (!target) return;

            const observer = new MutationObserver(() => filterHomeVideos());
            observer.observe(target, { childList: true, subtree: true });

            filterHomeVideos();
        }

        observeHomePage();
    }

    function createSettingsUI() {
        if (document.getElementById('yt-settings-container')) return;

        const container = document.createElement('div');
        container.id = 'yt-settings-container';
        container.style.cssText = `
            position: fixed; top: 10px; right: 0; z-index: 9999;
            background: rgba(255,255,255,0.95); border-radius: 10px 0 0 10px;
            font-size: 14px; box-shadow: 0 0 5px rgba(0,0,0,0.2);
            transition: opacity 0.3s, transform 0.3s; user-select: none;
            display: flex; flex-direction: row; align-items: stretch;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 10px;
            background: transparent;
        `;

        const qualityLabel = document.createElement('label');
        qualityLabel.innerText = '默认画质：';
        const qualitySelect = document.createElement('select');
        for (const key in qualityMap) {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = qualityMap[key];
            if (key === defaultQuality) option.selected = true;
            qualitySelect.appendChild(option);
        }
        qualitySelect.onchange = () => {
            localStorage.setItem('yt-default-quality', qualitySelect.value);
            defaultQuality = qualitySelect.value;
            setVideoQuality(defaultQuality);
        };

        const speedLabel = document.createElement('label');
        speedLabel.innerText = ' 默认倍速：';
        const speedSelect = document.createElement('select');
        for (const s of speedOptions) {
            const option = document.createElement('option');
            option.value = s;
            option.innerText = `${s}x`;
            if (s === defaultSpeed) option.selected = true;
            speedSelect.appendChild(option);
        }
        speedSelect.onchange = () => {
            localStorage.setItem('yt-default-speed', speedSelect.value);
            defaultSpeed = parseFloat(speedSelect.value);
            setPlaybackSpeed(defaultSpeed);
        };

        const fsButton = document.createElement('button');
        fsButton.textContent = '网页全屏';
        fsButton.style.cssText = `
            padding: 3px 6px; font-size: 12px; background: #ff5c5c; color: white;
            border: none; border-radius: 4px; cursor: pointer;
        `;
        fsButton.onclick = toggleWebFullscreen;

        const rightControls = document.createElement('div');
        rightControls.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 6px;
            border-left: 1px solid #aaa;
            background: transparent;
            transition: all 0.3s;
        `;

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '▶';
        toggleBtn.style.cssText = `
            border: none; background: none; cursor: pointer;
            font-size: 16px; padding: 2px 4px; margin: 0;
        `;
        toggleBtn.title = '收起面板';

        let collapsed = false;
        toggleBtn.onclick = () => {
            collapsed = !collapsed;
            panel.style.display = collapsed ? 'none' : 'flex';
            toggleBtn.textContent = collapsed ? '◀' : '▶';
            toggleBtn.title = collapsed ? '展开面板' : '收起面板';

            rightControls.style.borderLeft = collapsed ? 'none' : '1px solid #aaa';
            rightControls.style.padding = collapsed ? '0 4px' : '0 6px';
        };

        panel.appendChild(qualityLabel);
        panel.appendChild(qualitySelect);
        panel.appendChild(speedLabel);
        panel.appendChild(speedSelect);
        panel.appendChild(fsButton);

        rightControls.appendChild(toggleBtn);

        container.appendChild(panel);
        container.appendChild(rightControls);
        document.body.appendChild(container);

        let hideTimer;
        const show = () => {
            container.style.opacity = '1';
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                if (document.fullscreenElement || document.querySelector('.html5-video-player.webfullscreen')) {
                    container.style.opacity = '0';
                }
            }, 3000);
        };

        document.addEventListener('mousemove', show);
        document.addEventListener('keydown', show);
        show();
    }

    function showSettingsModal() {
        console.log('显示设置面板');
        if (document.getElementById('yt-settings-modal')) {
            document.getElementById('yt-settings-modal').style.display = 'flex';
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'yt-settings-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;
            z-index: 10000;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            width: 500px; max-width: 90%;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            font-size: 14px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
        `;

        // 添加关闭按钮 X
        const closeX = document.createElement('button');
        closeX.textContent = '×';
        closeX.style.cssText = `
            position: absolute;
            top: 8px;
            right: 10px;
            font-size: 18px;
            border: none;
            background: transparent;
            cursor: pointer;
            color: #999;
        `;
        closeX.onclick = () => {
            modal.style.display = 'none';
        };
        dialog.appendChild(closeX);

        // Tab Header
        const tabHeader = document.createElement('div');
        tabHeader.style.cssText = `
            display: flex;
            border-bottom: 1px solid #ddd;
            background: #f8f8f8;
        `;

        const tabs = ['行为', '过滤', '字幕', '快捷键'];
        const tabButtons = {};
        const tabContents = {};

        tabs.forEach(tab => {
            const btn = document.createElement('button');
            btn.textContent = tab;
            btn.style.cssText = `
                flex: 1; padding: 10px; background: none; border: none;
                border-bottom: 2px solid transparent; cursor: pointer;
            `;
            btn.addEventListener('click', () => switchTab(tab));
            tabHeader.appendChild(btn);
            tabButtons[tab] = btn;
        });

        dialog.appendChild(tabHeader);

        tabs.forEach(tab => {
            const content = document.createElement('div');
            content.style.cssText = `
                padding: 15px;
                display: none;
            `;

            if (tab === '行为') {
                const config = {
                    autoWebFullscreen: localStorage.getItem('yt-auto-webfullscreen') === 'true',
                    autoFullscreenQuality: localStorage.getItem('yt-auto-fullscreen-quality') === 'true',
                    fullscreenQuality: localStorage.getItem('yt-fullscreen-quality-value') || 'hd1080',
                };

                config.fullscreenMaxQuality = localStorage.getItem('yt-fullscreen-max-quality') === 'true';
                config.fullscreenVideoMaxQuality = localStorage.getItem('yt-fullscreen-video-max-quality') === 'true';

                const awfLabel = document.createElement('label');
                awfLabel.textContent = '自动网页全屏 ';
                awfLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';

                const awfSwitch = document.createElement('input');
                awfSwitch.type = 'checkbox';
                awfSwitch.checked = config.autoWebFullscreen;
                awfSwitch.id = 'auto-webfullscreen-switch';

                awfSwitch.addEventListener('change', () => {
                    localStorage.setItem('yt-auto-webfullscreen', awfSwitch.checked);
                });

                awfLabel.appendChild(awfSwitch);

                const awfNote = document.createElement('div');
                awfNote.textContent = '打开视频页面后自动网页全屏，播放结束后自动退出网页全屏';
                awfNote.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 15px;';

                const afqLabel = document.createElement('label');
                afqLabel.textContent = '自动全屏画质 ';
                afqLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';

                const afqSwitch = document.createElement('input');
                afqSwitch.type = 'checkbox';
                afqSwitch.checked = config.autoFullscreenQuality;
                afqSwitch.id = 'auto-fullscreen-quality-switch';
                afqSwitch.dataset.key = 'yt-auto-fullscreen-quality';

                afqLabel.appendChild(afqSwitch);

                const afqNote = document.createElement('div');
                afqNote.textContent = '当视频全屏时更改为指定画质，与其它全屏画质设置互斥';
                afqNote.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 15px;';

                const fqLabel = document.createElement('label');
                fqLabel.textContent = '全屏画质：';
                fqLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';

                const fqSelect = document.createElement('select');
                fqSelect.id = 'fullscreen-quality-select';

                for (const [key, val] of Object.entries(qualityMap)) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = val;
                    if (key === config.fullscreenQuality) option.selected = true;
                    fqSelect.appendChild(option);
                }

                fqSelect.addEventListener('change', () => {
                    localStorage.setItem('yt-fullscreen-quality-value', fqSelect.value);
                });

                fqLabel.appendChild(fqSelect);

                const maxqLabel = document.createElement('label');
                maxqLabel.textContent = '全屏自适应最高画质 ';
                maxqLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';

                const maxqSwitch = document.createElement('input');
                maxqSwitch.type = 'checkbox';
                maxqSwitch.checked = config.fullscreenMaxQuality;
                maxqSwitch.id = 'fullscreen-max-quality-switch';
                maxqSwitch.dataset.key = 'yt-fullscreen-max-quality';

                maxqLabel.appendChild(maxqSwitch);

                const maxqNote = document.createElement('div');
                maxqNote.textContent = '当视频全屏时设置为屏幕可显示的最高画质，与其它全屏画质设置互斥';
                maxqNote.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 15px;';

                const vqLabel = document.createElement('label');
                vqLabel.textContent = '全屏自动视频最高画质 ';
                vqLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';

                const vqSwitch = document.createElement('input');
                vqSwitch.type = 'checkbox';
                vqSwitch.checked = config.fullscreenVideoMaxQuality;
                vqSwitch.id = 'fullscreen-video-max-quality-switch';
                vqSwitch.dataset.key = 'yt-fullscreen-video-max-quality';

                vqLabel.appendChild(vqSwitch);

                const vqNote = document.createElement('div');
                vqNote.textContent = '当视频全屏时切换为当前视频提供的最高清晰度，与其它全屏画质设置互斥';
                vqNote.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 15px;';

                content.appendChild(awfLabel);
                content.appendChild(awfNote);
                content.appendChild(afqLabel);
                content.appendChild(afqNote);
                content.appendChild(fqLabel);
                content.appendChild(maxqLabel);
                content.appendChild(maxqNote);
                content.appendChild(vqLabel);
                content.appendChild(vqNote);

                enforceMutualExclusion(afqSwitch, maxqSwitch, vqSwitch);
            }

            if (tab === '过滤') {
                const filterSettings = document.createElement('div');
                filterSettings.style.display = 'flex';
                filterSettings.style.flexDirection = 'column';
                filterSettings.style.gap = '10px';

                function createToggle(labelText, key) {
                    const container = document.createElement('label');
                    container.style.cssText = `
                        display: flex; justify-content: space-between; align-items: center;
                        font-size: 14px;
                    `;

                    const label = document.createElement('span');
                    label.textContent = labelText;

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.style.transform = 'scale(1.3)';
                    checkbox.dataset.key = key;
                    checkbox.checked = localStorage.getItem(key) === 'true';
                    checkbox.addEventListener('change', (e) => {
                        localStorage.setItem(key, checkbox.checked);
                    });

                    container.appendChild(label);
                    container.appendChild(checkbox);
                    return container;
                }

                filterSettings.appendChild(createToggle('过滤功能总开关', 'yt-filter-enabled'));
                filterSettings.appendChild(createToggle('过滤首页推荐', 'yt-filter-home'));
                filterSettings.appendChild(createToggle('过滤视频页相关推荐', 'yt-filter-related'));
                filterSettings.appendChild(createToggle('关键词过滤', 'yt-filter-keywords'));

                // 关键词部分
                const keywordLabel = document.createElement('div');
                keywordLabel.textContent = '屏蔽词（回车添加，点击删除）：';

                const keywordBox = document.createElement('div');
                keywordBox.style.cssText = `
                    display: flex; flex-wrap: wrap; gap: 6px;
                    border: 1px solid #ccc; padding: 6px; border-radius: 4px;
                    min-height: 36px;
                `;

                const keywordInput = document.createElement('input');
                keywordInput.type = 'text';
                keywordInput.placeholder = '输入关键词后回车';
                keywordInput.style.cssText = `
                    border: none; outline: none; flex-grow: 1;
                    min-width: 100px;
                `;

                keywordBox.appendChild(keywordInput);

                function renderKeywords() {
                    // 清除旧词块（保留输入框）
                    [...keywordBox.querySelectorAll('.keyword-chip')].forEach(el => el.remove());

                    const keywords = JSON.parse(localStorage.getItem('yt-filter-words') || '[]');
                    keywords.forEach(word => {
                        const chip = document.createElement('span');
                        chip.className = 'keyword-chip';
                        chip.style.cssText = `
                            display: inline-flex; align-items: center; padding: 2px 6px;
                            background: #eee; border-radius: 4px;
                            font-size: 13px; gap: 4px;
                        `;

                        const wordText = document.createElement('span');
                        wordText.textContent = word;

                        const closeBtn = document.createElement('span');
                        closeBtn.textContent = '×';
                        closeBtn.style.cssText = 'cursor: pointer; color: #c00;';
                        closeBtn.addEventListener('click', () => {
                            const newWords = keywords.filter(k => k !== word);
                            localStorage.setItem('yt-filter-words', JSON.stringify(newWords));
                            renderKeywords();
                        });

                        chip.appendChild(wordText);
                        chip.appendChild(closeBtn);
                        keywordBox.insertBefore(chip, keywordInput);
                    });
                }

                keywordInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const value = keywordInput.value.trim();
                        if (value) {
                            let keywords = JSON.parse(localStorage.getItem('yt-filter-words') || '[]');
                            if (!keywords.includes(value)) {
                                keywords.push(value);
                                localStorage.setItem('yt-filter-words', JSON.stringify(keywords));
                                renderKeywords();
                            }
                            keywordInput.value = '';
                        }
                    }
                });

                renderKeywords();

                filterSettings.appendChild(keywordLabel);
                filterSettings.appendChild(keywordBox);

                // 播放进度过滤
                const progressToggle = createToggle('播放进度过滤', 'yt-filter-progress');
                filterSettings.appendChild(progressToggle);

                const progressLine = document.createElement('div');
                progressLine.style.display = 'flex';
                progressLine.style.alignItems = 'center';

                const progressInputLabel = document.createElement('label');
                progressInputLabel.textContent = '过滤播放进度大于：';

                const progressInput = document.createElement('input');
                progressInput.type = 'number';
                progressInput.min = '1';
                progressInput.max = '100';
                progressInput.value = localStorage.getItem('yt-filter-progress-threshold') || '90';
                progressInput.style.cssText = 'width: 60px; margin-left: 6px;';
                progressInput.addEventListener('input', () => {
                    const val = Math.min(100, Math.max(1, parseInt(progressInput.value)));
                    localStorage.setItem('yt-filter-progress-threshold', val);
                });

                const percentSign = document.createElement('span');
                percentSign.textContent = '%';
                percentSign.style.marginLeft = '6px';

                progressLine.appendChild(progressInputLabel);
                progressLine.appendChild(progressInput);
                progressLine.appendChild(percentSign);

                filterSettings.appendChild(progressLine);

                content.appendChild(filterSettings);
            }

            if (tab === '字幕') {
                const subLabel = document.createElement('p');
                subLabel.textContent = '字幕设置占位：未来可以在这里添加语言、样式等。';
                content.appendChild(subLabel);
            }

            if (tab === '快捷键') {
                const hotkeySettings = document.createElement('div');
                hotkeySettings.style.display = 'flex';
                hotkeySettings.style.flexDirection = 'column';
                hotkeySettings.style.gap = '12px';

                const hotkeyOptions = [
                    {
                        key: 'webfullscreen',
                        label: '切换网页全屏',
                        defaultKey: 'w',
                        note: '建议使用 W 键'
                    },
                    {
                        key: 'open-settings',
                        label: '打开设置面板',
                        defaultKey: 's',
                        note: '使用 Ctrl+Shift+S 触发'
                    },
                    {
                        key: 'increase-speed',
                        label: '播放速度切换（1x/2x/4x）',
                        defaultKey: 'x',
                        note: '循环加速'
                    },
                    {
                        key: 'toggle-subtitle',
                        label: '开关字幕',
                        defaultKey: 'c',
                        note: '字幕按钮快捷开关'
                    },
                    {
                        key: 'show-stats',
                        label: '显示详细统计信息',
                        defaultKey: 'd',
                        note: '模拟 Ctrl+Shift+Alt+D'
                    }
                ];

                hotkeyOptions.forEach(opt => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

                    const enable = document.createElement('input');
                    enable.type = 'checkbox';
                    enable.checked = localStorage.getItem(`yt-hotkey-toggle-${opt.key}`) === 'true';
                    enable.addEventListener('change', () => {
                        localStorage.setItem(`yt-hotkey-toggle-${opt.key}`, enable.checked);
                    });

                    const label = document.createElement('label');
                    label.textContent = opt.label;
                    label.style.flex = '1';

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.maxLength = 1;
                    input.style.cssText = 'width: 30px; text-align: center;';
                    input.value = localStorage.getItem(`yt-hotkey-key-${opt.key}`) || opt.defaultKey;

                    input.addEventListener('input', () => {
                        const val = input.value.toLowerCase().trim();
                        if (/^[a-z]$/.test(val)) {
                            localStorage.setItem(`yt-hotkey-key-${opt.key}`, val);
                        } else {
                            input.value = '';
                            localStorage.removeItem(`yt-hotkey-key-${opt.key}`);
                        }
                    });

                    const note = document.createElement('span');
                    note.textContent = opt.note;
                    note.style.fontSize = '12px';
                    note.style.color = '#888';

                    row.appendChild(enable);
                    row.appendChild(label);
                    row.appendChild(input);
                    hotkeySettings.appendChild(row);
                    hotkeySettings.appendChild(note);
                });

                content.appendChild(hotkeySettings);
            }

            dialog.appendChild(content);
            tabContents[tab] = content;
        });

        modal.appendChild(dialog);
        document.body.appendChild(modal);

        function switchTab(tab) {
            tabs.forEach(t => {
                tabButtons[t].style.borderBottom = t === tab ? '2px solid #2196f3' : '2px solid transparent';
                tabContents[t].style.display = t === tab ? 'block' : 'none';
            });
        }

        switchTab('行为');
    }

    function applyAllSettings() {
        setVideoQuality(defaultQuality);
        setPlaybackSpeed(defaultSpeed);
        tryAutoWebFullscreen();
        setupFullscreenQualitySwitcher();
    }

    function observeNavigation() {
        const apply = () => {
            setTimeout(() => {
                applyAllSettings();
                createSettingsUI();
                setupRecommendationFilter();
            }, 1000);
        };
        window.addEventListener('yt-navigate-finish', apply);
        apply();
    }

    GM_registerMenuCommand('打开设置面板', () => {
        showSettingsModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('yt-settings-modal');
            if (modal && modal.style.display !== 'none') {
                modal.style.display = 'none';
                return;
            }

            const player = document.querySelector('.html5-video-player.webfullscreen');
            if (player) {
                toggleWebFullscreen();
                return;
            }
        }

        const hotkeyActions = [
            {
                key: 'webfullscreen',
                defaultKey: 'w',
                action: () => toggleWebFullscreen(),
            },
            {
                key: 'increase-speed',
                defaultKey: 'x',
                action: () => {
                    const video = document.querySelector('video');
                    if (video) {
                        const current = video.playbackRate;
                        const next = current >= 4 ? 1 : current * 2;
                        video.playbackRate = next;
                        console.log(`[快捷键] 播放速度设置为 ${next}x`);
                    }
                }
            },
            {
                key: 'toggle-subtitle',
                defaultKey: 'c',
                action: () => {
                    const btn = document.querySelector('.ytp-subtitles-button');
                    if (btn) btn.click();
                }
            },
            {
                key: 'show-stats',
                defaultKey: 'd',
                action: () => {
                    // 模拟 Ctrl+Shift+Alt+D
                    const evt = new KeyboardEvent('keydown', {
                        bubbles: true,
                        cancelable: true,
                        key: 'D',
                        code: 'KeyD',
                        ctrlKey: true,
                        shiftKey: true,
                        altKey: true
                    });
                    document.dispatchEvent(evt);
                }
            }
        ];

        hotkeyActions.forEach(({ key, defaultKey, action }) => {
            const enabled = localStorage.getItem(`yt-hotkey-toggle-${key}`) === 'true';
            const userKey = localStorage.getItem(`yt-hotkey-key-${key}`) || defaultKey;
            if (enabled && e.key.toLowerCase() === userKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                action();
            }
        });

        if (
            localStorage.getItem('yt-hotkey-toggle-open-settings') === 'true' &&
            e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's'
        ) {
            showSettingsModal();
        }
    });

    observeNavigation();
})();
