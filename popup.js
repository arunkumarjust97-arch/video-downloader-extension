// Video Downloader extension

document.addEventListener('DOMContentLoaded', function() {
    const statusEl = document.getElementById('status');
    const videoListEl = document.getElementById('video-list');
    const refreshBtn = document.getElementById('refresh-btn');
    const autoBestToggle = document.getElementById('auto-best-toggle');
    const batchActionBar = document.getElementById('batch-action-bar');
    const batchCountEl = document.getElementById('batch-count');
    const downloadAllBestBtn = document.getElementById('download-all-best-btn');
    const toastEl = document.getElementById('toast');

    let autoSelectBest = true;
    let currentVideos = [];
    let toastTimeout = null;

    // In-app professional toast notification
    function showToast(message, type = 'info') {
        if (!toastEl) return;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastEl.textContent = message;
        toastEl.className = 'toast show ' + type;
        toastTimeout = setTimeout(() => {
            toastEl.classList.remove('show');
        }, 2400);
    }

    // Professional Empty State HTML Generator
    function getEmptyStateHtml(message = 'No video streams detected on this page') {
        return `
            <div class="empty-state-box">
                <div class="radar-wrapper">
                    <div class="radar-ring"></div>
                    <div class="radar-icon-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </div>
                </div>
                <div class="empty-title">${escapeHtml(message)}</div>
                <div class="empty-desc">Play a video or scroll the page to trigger stream capture.</div>
                <button type="button" class="empty-report-btn" id="empty-report-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    <span>Report Video / Issue</span>
                </button>
            </div>
        `;
    }

    // Validate URL
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    // Check if URL is a direct video file
    function isVideoUrl(url) {
        if (!url) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
        const urlLower = url.toLowerCase();
        return videoExtensions.some(ext => urlLower.includes(ext));
    }

    // Quality Scoring System (Higher score = higher quality resolution)
    function getQualityScore(qualityStr, width, height, url) {
        const w = parseInt(width) || 0;
        const h = parseInt(height) || 0;
        if (w > 0 && h > 0) return w * h;
        if (h > 0) return h * Math.round(h * 16 / 9);
        
        let str = (qualityStr || '').toLowerCase().trim();
        if ((!str || str === 'unknown' || str === 'standard') && url) {
            const urlMatch = url.match(/(8k|4320p?|4k|2160p?|2k|1440p?|1080p?|720p?|480p?|360p?|240p?|144p?|hd|fhd|uhd)/i);
            if (urlMatch) str = urlMatch[1].toLowerCase();
        }
        
        if (str.includes('8k') || str.includes('4320')) return 80000000;
        if (str.includes('4k') || str.includes('2160') || str.includes('uhd')) return 3840 * 2160;
        if (str.includes('2k') || str.includes('1440') || str.includes('qhd')) return 2560 * 1440;
        if (str.includes('1080') || str.includes('fhd')) return 1920 * 1080;
        if (str.includes('720') || str.includes('hd')) return 1280 * 720;
        if (str.includes('480') || str.includes('sd')) return 854 * 480;
        if (str.includes('360')) return 640 * 360;
        if (str.includes('240')) return 426 * 240;
        if (str.includes('144')) return 256 * 144;
        
        const numMatch = str.match(/(\d+)p?/);
        if (numMatch) {
            const val = parseInt(numMatch[1]);
            if (val > 0) return val * Math.round(val * 16 / 9);
        }
        
        return 100;
    }

    // Resolve human-friendly quality label from attributes, dimensions, or URL
    function resolveQualityLabel(quality, width, height, url) {
        if (width && height) return getQualityFromDimensions(width, height);
        if (height && !width) return getQualityFromDimensions(Math.round(height * 16 / 9), height);
        if (quality && quality !== 'Unknown' && quality !== 'Standard') {
            const qUpper = quality.toUpperCase();
            if (qUpper === '4K' || qUpper === '2K' || qUpper === 'HD' || qUpper === 'FHD' || qUpper === 'UHD') {
                return qUpper;
            }
            return quality;
        }
        if (url) {
            const match = url.match(/(8k|4k|2k|4320p?|2160p?|1440p?|1080p?|720p?|480p?|360p?|240p?|144p?)/i);
            if (match) {
                const raw = match[1].toUpperCase();
                return raw.endsWith('P') || raw === '4K' || raw === '2K' || raw === '8K' ? raw : `${raw}p`;
            }
        }
        return quality || 'Standard';
    }

    // Load auto-best preference from storage
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['autoSelectBest'], function(res) {
            if (res && typeof res.autoSelectBest === 'boolean') {
                autoSelectBest = res.autoSelectBest;
            } else {
                autoSelectBest = true;
            }
            if (autoBestToggle) autoBestToggle.checked = autoSelectBest;
            if (currentVideos.length > 0) displayVideos(currentVideos);
        });
    } else {
        const saved = localStorage.getItem('autoSelectBest');
        if (saved !== null) autoSelectBest = saved === 'true';
        if (autoBestToggle) autoBestToggle.checked = autoSelectBest;
    }

    if (autoBestToggle) {
        autoBestToggle.addEventListener('change', function() {
            autoSelectBest = this.checked;
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({autoSelectBest: autoSelectBest});
            } else {
                localStorage.setItem('autoSelectBest', autoSelectBest);
            }
            if (currentVideos.length > 0) {
                displayVideos(currentVideos);
            }
        });
    }

    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Update tab buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update tab contents
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
            
            // Scan for videos when switching to detect tab
            if (tabName === 'detect') {
                scanForVideos();
            }
        });
    });
    
    // URL download functionality
    const videoUrlInput = document.getElementById('video-url');
    const videoTitleInput = document.getElementById('video-title');
    const downloadUrlBtn = document.getElementById('download-url-btn');
    
    if (downloadUrlBtn) {
        downloadUrlBtn.addEventListener('click', function() {
            const url = videoUrlInput.value.trim();
            const title = videoTitleInput.value.trim();
            
            if (!url) {
                showToast('Please enter a video URL', 'error');
                return;
            }
            
            if (!isValidUrl(url)) {
                showToast('Please enter a valid video URL', 'error');
                return;
            }
            
            // Check if URL is a direct video file
            if (!isVideoUrl(url)) {
                const choice = confirm(
                    'This URL appears to be a webpage, not a direct video file.\n\n' +
                    'Click OK to open the page and find the direct video URL.\n' +
                    'Click Cancel to try downloading anyway (might download HTML instead).'
                );
                
                if (choice) {
                    chrome.tabs.create({url: url});
                    return;
                }
            }
            
            // Determine video type
            let type = 'direct';
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                type = 'youtube';
            } else if (url.includes('vimeo.com')) {
                type = 'vimeo';
            }
            
            const quality = resolveQualityLabel(null, null, null, url);
            const finalTitle = title || 'Video';
            downloadVideo(url, finalTitle, type, quality !== 'Standard' ? quality : null);
        });
    }

    // Pages Chrome never allows extensions to script, regardless of permissions
    function isRestrictedUrl(url) {
        if (!url) return true;
        return /^(chrome|chrome-extension|edge|about|devtools):/i.test(url) ||
               url.startsWith('https://chrome.google.com/webstore') ||
               url.startsWith('https://chromewebstore.google.com');
    }

    // Get current tab and scan for videos
    function scanForVideos() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                if (isRestrictedUrl(tabs[0].url)) {
                    statusEl.textContent = "Browser restricted page";
                    videoListEl.innerHTML = getEmptyStateHtml("Cannot inspect browser/store pages");
                    if (batchActionBar) batchActionBar.style.display = 'none';
                    return;
                }

                statusEl.textContent = 'Scanning for videos...';
                videoListEl.innerHTML = '';
                if (batchActionBar) batchActionBar.style.display = 'none';

                function handleResponse(response) {
                    if (chrome.runtime.lastError) {
                        const errMsg = chrome.runtime.lastError.message || '';
                        console.error('Content script error:', chrome.runtime.lastError);
                        statusEl.textContent = 'Ready';
                        videoListEl.innerHTML = getEmptyStateHtml('Could not scan this page');
                        if (batchActionBar) batchActionBar.style.display = 'none';
                        return;
                    }

                    if (response && response.error) {
                        statusEl.textContent = 'Error detecting media';
                        videoListEl.innerHTML = getEmptyStateHtml('Error detecting videos');
                        if (batchActionBar) batchActionBar.style.display = 'none';
                        return;
                    }

                    if (response && response.videos && response.videos.length > 0) {
                        displayVideos(response.videos);
                        statusEl.textContent = `Found ${response.videos.length} video(s)`;
                    } else {
                        currentVideos = [];
                        statusEl.textContent = 'No media detected';
                        videoListEl.innerHTML = getEmptyStateHtml('No video streams detected on this tab');
                        if (batchActionBar) batchActionBar.style.display = 'none';
                    }
                }

                // Query page content script
                chrome.tabs.sendMessage(tabs[0].id, {action: 'getVideos'}, function(response) {
                    if (chrome.runtime.lastError &&
                        (chrome.runtime.lastError.message || '').includes('Receiving end does not exist')) {
                        chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            files: ['content.js']
                        }, function() {
                            if (chrome.runtime.lastError) {
                                console.error('Script injection failed:', chrome.runtime.lastError);
                                statusEl.textContent = "Ready";
                                videoListEl.innerHTML = getEmptyStateHtml('Try refreshing this page');
                                return;
                            }

                            setTimeout(function() {
                                chrome.tabs.sendMessage(tabs[0].id, {action: 'getVideos'}, handleResponse);
                            }, 100);
                        });
                        return;
                    }

                    handleResponse(response);
                });
            }
        });
    }


    // Format quality label for buttons matching wireframe (e.g. 2k, 1080 P, 720 P, 480 P)
    function formatQualityBtnLabel(quality) {
        if (!quality) return 'Download';
        const q = quality.toString().trim();
        
        // Match "2k", "4k", "8k"
        const matchK = q.match(/^(\d+)\s*k$/i);
        if (matchK) {
            return `${matchK[1]}k`;
        }
        
        // Match "1080p", "720p", "480p", "360p", "1080", etc.
        const matchP = q.match(/^(\d+)\s*p?$/i);
        if (matchP) {
            return `${matchP[1]} P`;
        }
        
        if (/^fhd$/i.test(q)) return '1080 P';
        if (/^qhd$/i.test(q)) return '2k';
        if (/^uhd$/i.test(q)) return '4k';
        if (/^hd$/i.test(q)) return '720 P';
        if (/^sd$/i.test(q)) return '480 P';
        if (/^standard$/i.test(q)) return 'MP4';
        
        return q;
    }

    function isGenericTitle(str) {
        if (!str) return true;
        const s = str.trim().toLowerCase();
        const genericWords = [
            'download', 'download video', 'download now', 'download mp4', 
            'download file', 'click here', 'click here to download',
            'video', 'video link', 'play', 'watch', 'watch video', 
            'link', 'file', 'sample', 'direct link'
        ];
        if (genericWords.includes(s)) return true;
        if (s.startsWith('video ') || s.startsWith('video_') || s.startsWith('video-')) return true;
        if (s.startsWith('download ') || s.startsWith('download_')) return true;
        return s.length < 3;
    }

    // Clean title helper: extracts clean filename if title is generic or empty
    function getCleanVideoTitle(rawTitle, rawUrl) {
        if (rawTitle && !isGenericTitle(rawTitle)) {
            return rawTitle;
        }
        if (rawUrl) {
            try {
                const match = rawUrl.match(/\/([^\/?#&]+\.(mp4|webm|ogg|mkv|mov|avi|flv|wmv|m4v))/i);
                if (match && match[1]) {
                    return match[1];
                }
            } catch (_) {}
        }
        return 'Video.MP4';
    }

    // Display videos in the popup
    function displayVideos(videos) {
        // Comprehensive deduplication across videos before rendering
        function getBaseUrl(u) {
            if (!u) return '';
            try {
                return u.split('?')[0].split('#')[0].toLowerCase().trim();
            } catch (_) {
                return u.toLowerCase().trim();
            }
        }

        // Prioritize multi-source videos
        const sortedVideos = [...videos].sort((a, b) => {
            const aCount = (a.sources ? a.sources.length : 1);
            const bCount = (b.sources ? b.sources.length : 1);
            return bCount - aCount;
        });

        const dedupedVideos = [];
        const seenUrls = new Set();
        const seenBaseUrls = new Set();

        sortedVideos.forEach(video => {
            const allUrls = [];
            if (video.url) allUrls.push(video.url);
            if (video.sources && video.sources.length > 0) {
                video.sources.forEach(s => {
                    if (s.url) allUrls.push(s.url);
                });
            }

            const isDuplicate = allUrls.some(u => {
                const base = getBaseUrl(u);
                return seenUrls.has(u) || (base && seenBaseUrls.has(base));
            });

            if (!isDuplicate && allUrls.length > 0) {
                allUrls.forEach(u => {
                    seenUrls.add(u);
                    const base = getBaseUrl(u);
                    if (base) seenBaseUrls.add(base);
                });
                dedupedVideos.push(video);
            }
        });

        currentVideos = dedupedVideos;
        videoListEl.innerHTML = '';
        
        // Update status count
        if (statusEl && currentVideos.length > 0) {
            statusEl.textContent = `Found ${currentVideos.length} video(s)`;
        }
        
        // Count downloadable videos for batch action bar
        const downloadable = currentVideos.filter(v => {
            const u = v.url || (v.sources && v.sources[0] ? v.sources[0].url : '');
            return isVideoUrl(u);
        });
        
        if (downloadable.length > 1 && batchActionBar && batchCountEl) {
            batchCountEl.textContent = downloadable.length;
            batchActionBar.style.display = 'block';
        } else if (batchActionBar) {
            batchActionBar.style.display = 'none';
        }

        currentVideos.forEach((video, index) => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            
            let title = '';
            let qualityButtonsHtml = '';
            let primaryUrl = '';
            
            if (video.type === 'html5-multi' && video.sources && video.sources.length > 0) {
                // Ensure sources are sorted by quality score descending
                video.sources.sort((a, b) => {
                    const scoreA = a.score || getQualityScore(a.quality, a.width, a.height, a.url);
                    const scoreB = b.score || getQualityScore(b.quality, b.width, b.height, b.url);
                    return scoreB - scoreA;
                });
                
                // Resolve human quality on each source
                video.sources.forEach(s => {
                    s.quality = resolveQualityLabel(s.quality, s.width, s.height, s.url);
                });

                // Deduplicate sources by quality label so no duplicate resolution buttons appear
                const dedupedSources = [];
                const seenQualLabels = new Set();
                video.sources.forEach(s => {
                    const label = formatQualityBtnLabel(s.quality || 'MP4');
                    if (!seenQualLabels.has(label)) {
                        seenQualLabels.add(label);
                        dedupedSources.push(s);
                    }
                });
                video.sources = dedupedSources;
                
                const bestSource = video.sources[0];
                title = getCleanVideoTitle(video.title, bestSource.url) || `Video ${index + 1}`;
                primaryUrl = bestSource.url;
                
                // Render direct quality buttons matching wireframe: [2k] [1080 P] [720 P] [480 P]
                qualityButtonsHtml = video.sources.map((source, sIdx) => {
                    const isBest = (sIdx === 0 && autoSelectBest);
                    const qLabel = formatQualityBtnLabel(source.quality || 'MP4');
                    const tooltip = source.size ? `Download ${qLabel} (${source.size})` : `Download ${qLabel}`;
                    return `
                        <button class="quality-btn ${isBest ? 'is-best' : ''}" 
                                data-url="${escapeHtml(source.url)}" 
                                data-title="${escapeHtml(title)}" 
                                data-type="${escapeHtml(video.type || '')}" 
                                data-quality="${escapeHtml(source.quality || '')}"
                                title="${escapeHtml(tooltip)}">
                            ${escapeHtml(qLabel)}
                        </button>
                    `;
                }).join('');
                
            } else {
                // Single source video
                const url = video.url;
                title = getCleanVideoTitle(video.title, url) || `Video ${index + 1}`;
                primaryUrl = url;
                
                let quality = resolveQualityLabel(video.quality, video.width, video.height, url);
                const qLabel = (quality && quality !== 'Standard') ? formatQualityBtnLabel(quality) : (isVideoUrl(url) ? 'MP4' : 'Download');
                const tooltip = `Download ${qLabel}`;
                const isBest = autoSelectBest;
                
                qualityButtonsHtml = `
                    <button class="quality-btn ${isBest ? 'is-best' : ''}" 
                            data-url="${escapeHtml(url)}" 
                            data-title="${escapeHtml(title)}" 
                            data-type="${escapeHtml(video.type || '')}" 
                            data-quality="${escapeHtml(quality || '')}"
                            title="${escapeHtml(tooltip)}">
                        ${escapeHtml(qLabel)}
                    </button>
                `;
            }
            
            // Render card matching wireframe layout:
            // 1. Title at top: Vid 232323442-3434343.MP4
            // 2. Direct Quality Download Buttons: [ 2k ] [ 1080 P ] [ 720 P ] [ 480 P ]
            // 3. Action buttons below: [ Copy URL ] [ Open ]
            videoItem.innerHTML = `
                <div class="video-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                <div class="quality-options-grid">
                    ${qualityButtonsHtml}
                </div>
                <div class="action-options-row">
                    <button class="action-btn copy-btn" data-url="${escapeHtml(primaryUrl)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy URL</span>
                    </button>
                    <button class="action-btn open-btn" data-url="${escapeHtml(primaryUrl)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        <span>Open</span>
                    </button>
                </div>
            `;
            
            videoListEl.appendChild(videoItem);
        });

        attachEventListeners();
    }

    // Attach event listeners to video action buttons
    function attachEventListeners() {
        // Direct download on quality button clicks
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.onclick = function() {
                const url = this.getAttribute('data-url');
                const title = this.getAttribute('data-title');
                const type = this.getAttribute('data-type');
                const quality = this.getAttribute('data-quality');
                downloadVideo(url, title, type, quality);
            };
        });

        // Copy URL buttons with smooth inline feedback and toast
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.onclick = function() {
                const url = this.getAttribute('data-url');
                if (!url) return;
                navigator.clipboard.writeText(url).then(() => {
                    const span = btn.querySelector('span');
                    const originalText = span ? span.textContent : btn.textContent;
                    if (span) span.textContent = 'Copied!';
                    else btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    showToast('Link copied to clipboard!', 'success');
                    setTimeout(() => {
                        if (span) span.textContent = originalText;
                        else btn.textContent = originalText;
                        btn.classList.remove('copied');
                    }, 1800);
                }).catch(err => {
                    console.error('Failed to copy URL:', err);
                    showToast('Could not copy link', 'error');
                });
            };
        });

        // Open in new tab buttons
        document.querySelectorAll('.open-btn').forEach(btn => {
            btn.onclick = function() {
                const url = this.getAttribute('data-url');
                if (url) {
                    chrome.tabs.create({url: url});
                }
            };
        });
    }

    // Batch download all detected videos at best quality
    if (downloadAllBestBtn) {
        downloadAllBestBtn.addEventListener('click', function() {
            if (!currentVideos || currentVideos.length === 0) return;
            
            let downloadCount = 0;
            currentVideos.forEach((video, idx) => {
                let targetUrl = video.url;
                let targetQuality = video.quality;
                
                if (video.type === 'html5-multi' && video.sources && video.sources.length > 0) {
                    const best = video.sources[0];
                    targetUrl = best.url;
                    targetQuality = best.quality;
                }
                
                if (targetUrl && isVideoUrl(targetUrl)) {
                    downloadCount++;
                    // Stagger downloads by 600ms to avoid browser download limit blocks
                    setTimeout(() => {
                        const title = video.title || `Video_${idx + 1}`;
                        downloadVideo(targetUrl, title, video.type, targetQuality, true /* silent */);
                    }, idx * 600);
                }
            });
            
            if (downloadCount > 0) {
                showToast(`⚡ Starting download for ${downloadCount} video(s)!`, 'success');
            } else {
                showToast('No downloadable direct video files found in list', 'error');
            }
        });
    }

    // Download video
    function downloadVideo(url, title, type, quality, silent = false) {
        console.log('Download requested:', {url, title, type, quality, silent});
        
        // Handle YouTube videos
        if (type === 'youtube') {
            const choice = confirm(
                'YouTube videos cannot be downloaded directly due to terms of service.\n\n' +
                'Click OK to open the video in a new tab.\n' +
                'Click Cancel to copy the video URL to clipboard.'
            );
            
            if (choice) {
                chrome.tabs.create({url: url});
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    showToast('YouTube URL copied to clipboard!', 'success');
                }).catch(err => {
                    console.error('Failed to copy URL:', err);
                    showToast('Failed to copy URL', 'error');
                });
            }
            return;
        }
        
        // Handle Vimeo videos
        if (type === 'vimeo') {
            showToast('Opening Vimeo video page...', 'info');
            chrome.tabs.create({url: url});
            return;
        }
        
        // Check if URL is actually a video file
        if (!isVideoUrl(url)) {
            const choice = confirm(
                'This URL does not appear to be a direct video file.\n\n' +
                'Click OK to open the URL in a new tab to find the direct video link.\n' +
                'Click Cancel to try downloading anyway (might download HTML).'
            );
            
            if (choice) {
                chrome.tabs.create({url: url});
                return;
            }
        }
        
        // Extension determination
        let extension = '.mp4';
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.webm')) extension = '.webm';
        else if (urlLower.includes('.ogg')) extension = '.ogg';
        else if (urlLower.includes('.mov')) extension = '.mov';
        else if (urlLower.includes('.avi')) extension = '.avi';
        else if (urlLower.includes('.mkv')) extension = '.mkv';
        else if (urlLower.includes('.flv')) extension = '.flv';
        else if (urlLower.includes('.wmv')) extension = '.wmv';
        else if (urlLower.includes('.m4v')) extension = '.m4v';
        
        // Build filename with quality (prevent duplicate extension if title ends with .mp4 etc.)
        let cleanTitle = title.replace(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv|m4v)$/i, '');
        let filenameBase = sanitizeFilename(cleanTitle);
        if (quality && quality !== 'Standard') {
            filenameBase += '_' + quality.toString().replace(/\s+/g, '');
        }
        const filename = filenameBase + extension;
        
        // Trigger download via Chrome API
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: !silent,
            conflictAction: 'uniquify'
        }, function(downloadId) {
            if (chrome.runtime.lastError) {
                console.error('Download failed:', chrome.runtime.lastError);
                if (!silent) {
                    showToast('Download error: ' + chrome.runtime.lastError.message, 'error');
                }
            } else {
                console.log('Download started with ID:', downloadId);
                recordDownloadHistory({
                    id: downloadId,
                    title: cleanTitle,
                    filename: filename,
                    url: url,
                    quality: quality || 'Best Quality',
                    timestamp: new Date().toISOString()
                });
                if (!silent) {
                    showToast(`⚡ Starting download: ${quality || 'Best'}!`, 'success');
                }
            }
        });
    }

    // Record download into shared storage history for Dashboard
    function recordDownloadHistory(record) {
        try {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['downloadHistory'], function(res) {
                    const list = (res && Array.isArray(res.downloadHistory)) ? res.downloadHistory : [];
                    list.unshift(record);
                    if (list.length > 100) list.pop();
                    chrome.storage.local.set({ downloadHistory: list });
                });
            } else {
                const list = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
                list.unshift(record);
                if (list.length > 100) list.pop();
                localStorage.setItem('downloadHistory', JSON.stringify(list));
            }
        } catch (_) {}
    }

    // Format bytes to human readable format
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get quality label from dimensions
    function getQualityFromDimensions(width, height) {
        const maxDim = Math.max(width, height);
        if (maxDim >= 3840) return '4K';
        if (maxDim >= 2560) return '2K';
        if (maxDim >= 1920) return '1080p';
        if (maxDim >= 1280) return '720p';
        if (maxDim >= 854) return '480p';
        if (maxDim >= 640) return '360p';
        if (maxDim >= 426) return '240p';
        return `${height}p`;
    }

    // Sanitize filename for download
    function sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9]/gi, '_').substring(0, 100);
    }

    // Open Settings button handler
    const openSettingsBtn = document.getElementById('open-settings-btn');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', function() {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else if (chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: 'settings.html' });
            } else {
                window.open('settings.html', '_blank');
            }
        });
    }

    // Refresh button click handler with rotation animation & toast
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshBtn.classList.add('spinning');
            showToast('Rescanning page for media streams...', 'info');
            setTimeout(() => refreshBtn.classList.remove('spinning'), 750);
            scanForVideos();
        });
    }

    // Handle Empty State "Report Video / Issue" click
    if (videoListEl) {
        videoListEl.addEventListener('click', function(e) {
            const reportBtn = e.target.closest('#empty-report-btn');
            if (reportBtn) {
                const target = 'settings.html#contact-section';
                if (chrome.tabs && chrome.tabs.create) {
                    chrome.tabs.create({ url: target });
                } else {
                    window.open(target, '_blank');
                }
            }
        });
    }

    // Initial scan
    scanForVideos();
});
