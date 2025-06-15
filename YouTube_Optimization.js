// ==UserScript==
// @name         YouTube 优化
// @description  自动设置 YouTube 视频分辨率、播放速度，添加网页全屏功能，整合到控制面板，支持自动隐藏与收起。
// @match        *://www.youtube.com/*
// @grant        none
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

    function applyAllSettings() {
        setVideoQuality(defaultQuality);
        setPlaybackSpeed(defaultSpeed);
    }

    function observeNavigation() {
        const apply = () => {
            setTimeout(() => {
                applyAllSettings();
                createSettingsUI();
            }, 1000);
        };
        window.addEventListener('yt-navigate-finish', apply);
        apply();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const player = document.querySelector('.html5-video-player.webfullscreen');
            if (player) toggleWebFullscreen();
        }
    });

    observeNavigation();
})();
