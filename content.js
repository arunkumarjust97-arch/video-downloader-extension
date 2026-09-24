// Video Downloader extension

// Content script to detect videos on web pages

// Guard against duplicate initialization: this script can run more than once
// on the same page (auto-injection via manifest.json content_scripts, plus a
// manual fallback injection from popup.js). Without this guard, re-running it
// would register additional message listeners and MutationObservers on every
// re-injection, which never get cleaned up.
if (window.__videoDownloaderContentScriptLoaded) {
    console.log('Video Downloader content script already loaded, skipping re-init');
} else {
    window.__videoDownloaderContentScriptLoaded = true;

    console.log('Video Downloader content script loaded successfully');

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Message received:', request);
    
    if (request.action === 'getVideos') {
        try {
            console.log('Scanning for videos on:', window.location.href);
            const videos = detectVideos();
            console.log('Found videos:', videos);
            sendResponse({videos: videos});
        } catch (error) {
            console.error('Error detecting videos:', error);
            sendResponse({videos: [], error: error.message});
        }
    }
    return true; // Keep message channel open for async response
});

// Detect videos on the page
function detectVideos() {
    const videos = [];
    
    // Detect HTML5 video elements
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video, index) => {
        const videoSources = [];
        
        // Helper to format and score a source
        function buildSourceObj(rawUrl, qualAttr, wAttr, hAttr) {
            if (!rawUrl || rawUrl.startsWith('blob:')) return null;
            const absoluteUrl = makeAbsoluteUrl(rawUrl);
            if (!absoluteUrl) return null;
            
            let width = wAttr ? parseInt(wAttr) : null;
            let height = hAttr ? parseInt(hAttr) : null;
            
            // If dimensions not on source, fallback to video element dimensions
            if (!width && !height && video.videoWidth && video.videoHeight) {
                width = video.videoWidth;
                height = video.videoHeight;
            }
            
            const quality = resolveQualityLabel(qualAttr, width, height, absoluteUrl);
            const score = getQualityScore(quality, width, height, absoluteUrl);
            
            let size = null;
            if (width && height) {
                size = `${width}x${height}`;
            } else if (quality && quality.match(/\d+p/)) {
                const h = parseInt(quality);
                size = `${Math.round(h * 16 / 9)}x${h}`;
            }
            
            return {
                url: absoluteUrl,
                quality: quality,
                width: width,
                height: height,
                size: size,
                score: score
            };
        }
        
        // Check video.src and video.currentSrc
        const directVideoUrl = video.src || video.currentSrc;
        if (directVideoUrl) {
            const srcObj = buildSourceObj(directVideoUrl, video.getAttribute('data-quality') || video.getAttribute('quality'), video.getAttribute('width') || video.videoWidth, video.getAttribute('height') || video.videoHeight);
            if (srcObj) videoSources.push(srcObj);
        }
        
        // Check for source elements within video
        const sources = video.querySelectorAll('source');
        sources.forEach((source) => {
            const qualAttr = source.getAttribute('data-quality') || source.getAttribute('quality') || source.getAttribute('data-res');
            const wAttr = source.getAttribute('data-width') || source.getAttribute('width');
            const hAttr = source.getAttribute('data-height') || source.getAttribute('height');
            const srcObj = buildSourceObj(source.src, qualAttr, wAttr, hAttr);
            if (srcObj) videoSources.push(srcObj);
        });
        
        // Remove duplicate URLs in sources
        const uniqueSources = [];
        const seenSourceUrls = new Set();
        videoSources.forEach(s => {
            if (!seenSourceUrls.has(s.url)) {
                seenSourceUrls.add(s.url);
                uniqueSources.push(s);
            }
        });
        
        // Automatically sort sources by quality score descending (Best Quality first!)
        uniqueSources.sort((a, b) => b.score - a.score);

        // Deduplicate sources by quality label (keep best source for each resolution)
        const dedupedSources = [];
        const seenQualities = new Set();
        uniqueSources.forEach(s => {
            const qKey = (s.quality || '').toLowerCase().trim();
            if (qKey && !seenQualities.has(qKey)) {
                seenQualities.add(qKey);
                dedupedSources.push(s);
            } else if (!qKey) {
                dedupedSources.push(s);
            }
        });
        
        // Mark top source as the best quality
        if (dedupedSources.length > 0) {
            dedupedSources[0].isBest = true;
            
            const videoTitle = getVideoTitle(video, index);
            const videoSize = getVideoSize(video);
            const bestSource = dedupedSources[0];
            
            if (dedupedSources.length > 1) {
                videos.push({
                    title: videoTitle,
                    type: 'html5-multi',
                    sources: dedupedSources,
                    bestSource: bestSource,
                    bestQuality: bestSource.quality,
                    url: bestSource.url, // Default URL is automatically the best quality
                    quality: bestSource.quality,
                    size: bestSource.size || (videoSize ? videoSize.dimensions : null),
                    score: bestSource.score
                });
            } else {
                // Single source
                videos.push({
                    url: bestSource.url,
                    title: videoTitle,
                    type: 'html5',
                    size: bestSource.size || (videoSize ? videoSize.dimensions : null),
                    quality: bestSource.quality,
                    width: bestSource.width,
                    height: bestSource.height,
                    score: bestSource.score
                });
            }
        }
        
        // Check for poster attribute (sometimes contains video info)
        if (video.poster) {
            const posterUrl = makeAbsoluteUrl(video.poster);
            // Some sites use poster images with video-like names, might indicate nearby video
        }
    });
    
    // Detect iframe embedded videos (YouTube, Vimeo, etc.)
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, index) => {
        const src = iframe.src;
        if (src) {
            // YouTube
            if (src.includes('youtube.com') || src.includes('youtu.be')) {
                const videoId = extractYouTubeId(src);
                if (videoId) {
                    // Try to get video title from page
                    const videoTitle = getYouTubeTitle(videoId) || `YouTube Video ${index + 1}`;
                    videos.push({
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        title: videoTitle,
                        type: 'youtube',
                        size: null
                    });
                }
            }
            // Vimeo
            else if (src.includes('vimeo.com')) {
                const videoId = extractVimeoId(src);
                if (videoId) {
                    videos.push({
                        url: `https://vimeo.com/${videoId}`,
                        title: `Vimeo Video ${index + 1}`,
                        type: 'vimeo',
                        size: null
                    });
                }
            }
        }
    });
    
    // Special handling for YouTube pages
    if (window.location.href.includes('youtube.com') || window.location.href.includes('youtu.be')) {
        const youtubeVideoId = extractYouTubeId(window.location.href);
        if (youtubeVideoId) {
            const videoTitle = getYouTubeTitle(youtubeVideoId) || 'YouTube Video';
            videos.push({
                url: window.location.href,
                title: videoTitle,
                type: 'youtube',
                size: null
            });
        }
    }
    
    // Detect video links (direct links to video files)
    const links = document.querySelectorAll('a[href]');
    links.forEach((link, index) => {
        const href = link.href;
        if (isVideoUrl(href)) {
            const absUrl = makeAbsoluteUrl(href);
            const qual = resolveQualityLabel(null, null, null, absUrl);
            const score = getQualityScore(qual, null, null, absUrl);
            
            // Clean link title: avoid using generic words like "Download" as video title
            let linkText = link.textContent.trim();
            const genericWords = ['download', 'download video', 'download now', 'download mp4', 'click here', 'click here to download', 'link', 'video', 'video link', 'play', 'watch'];
            if (!linkText || genericWords.includes(linkText.toLowerCase()) || linkText.length < 3) {
                try {
                    const match = absUrl.match(/\/([^\/?#&]+\.(mp4|webm|ogg|mkv|mov|avi|flv|wmv|m4v))/i);
                    linkText = (match && match[1]) ? match[1] : `Video Link ${index + 1}`;
                } catch (_) {
                    linkText = `Video Link ${index + 1}`;
                }
            }
            
            videos.push({
                url: absUrl,
                title: linkText,
                type: 'link',
                size: null,
                quality: qual !== 'Standard' ? qual : null,
                score: score
            });
        }
    });
    
    // Detect videos in object and embed tags (older formats)
    const objects = document.querySelectorAll('object[data], embed[src]');
    objects.forEach((obj, index) => {
        const url = obj.data || obj.src;
        if (url && isVideoUrl(url)) {
            const absUrl = makeAbsoluteUrl(url);
            const qual = resolveQualityLabel(null, null, null, absUrl);
            const score = getQualityScore(qual, null, null, absUrl);
            videos.push({
                url: absUrl,
                title: `Embedded Video ${index + 1}`,
                type: 'embedded',
                size: null,
                quality: qual !== 'Standard' ? qual : null,
                score: score
            });
        }
    });
    
    // Detect videos with data attributes (common in single-page apps)
    const videoElementsWithData = document.querySelectorAll('[data-video-url], [data-video-src], [data-src]');
    videoElementsWithData.forEach((element, index) => {
        const url = element.getAttribute('data-video-url') || 
                    element.getAttribute('data-video-src') || 
                    element.getAttribute('data-src');
        if (url && isVideoUrl(url)) {
            const absUrl = makeAbsoluteUrl(url);
            const qual = resolveQualityLabel(null, null, null, absUrl);
            const score = getQualityScore(qual, null, null, absUrl);
            videos.push({
                url: absUrl,
                title: `Data Attribute Video ${index + 1}`,
                type: 'data-attribute',
                size: null,
                quality: qual !== 'Standard' ? qual : null,
                score: score
            });
        }
    });
    
    // Comprehensive deduplication: ensure multi-source videos take precedence and
    // no standalone links or duplicate cards appear for sources already detected
    function getCleanBaseUrl(u) {
        if (!u) return '';
        try {
            return u.split('?')[0].split('#')[0].toLowerCase().trim();
        } catch (_) {
            return u.toLowerCase().trim();
        }
    }

    // Sort videos so that rich html5-multi and html5 elements take priority over simple <a> links
    videos.sort((a, b) => {
        const priority = { 'html5-multi': 4, 'html5': 3, 'embedded': 2, 'data-attribute': 1, 'link': 0, 'youtube': 3, 'vimeo': 3 };
        return (priority[b.type] || 0) - (priority[a.type] || 0);
    });

    const uniqueVideos = [];
    const seenUrls = new Set();
    const seenBaseUrls = new Set();
    
    videos.forEach(video => {
        const allUrls = [];
        if (video.url) allUrls.push(video.url);
        if (video.sources && video.sources.length > 0) {
            video.sources.forEach(s => {
                if (s.url) allUrls.push(s.url);
            });
        }
        
        // Check if ANY URL or base URL from this video has already been recorded
        const isDuplicate = allUrls.some(u => {
            const base = getCleanBaseUrl(u);
            return seenUrls.has(u) || (base && seenBaseUrls.has(base));
        });
        
        if (!isDuplicate && allUrls.length > 0) {
            allUrls.forEach(u => {
                seenUrls.add(u);
                const base = getCleanBaseUrl(u);
                if (base) seenBaseUrls.add(base);
            });
            uniqueVideos.push(video);
        }
    });
    
    // Identify best overall video on the page
    if (uniqueVideos.length > 0) {
        let maxScore = 0;
        let bestIndex = -1;
        uniqueVideos.forEach((v, idx) => {
            const s = v.score || (v.bestSource ? v.bestSource.score : 0) || 0;
            if (s > maxScore) {
                maxScore = s;
                bestIndex = idx;
            }
        });
        if (bestIndex >= 0 && maxScore > 200) {
            uniqueVideos[bestIndex].isPageBest = true;
        }
    }
    
    return uniqueVideos;
}

// Get video title from various sources
function getVideoTitle(videoElement, index) {
    // Try to get title from nearby elements
    const parent = videoElement.parentElement;
    if (parent) {
        // Check for title attribute
        if (videoElement.title && videoElement.title.length > 0 && videoElement.title !== 'Video') {
            return videoElement.title;
        }
        
        // Check for aria-label
        if (videoElement.getAttribute('aria-label') && videoElement.getAttribute('aria-label').length > 0) {
            return videoElement.getAttribute('aria-label');
        }
        
        // Check for alt text on parent
        if (parent.getAttribute('aria-label') && parent.getAttribute('aria-label').length > 0) {
            return parent.getAttribute('aria-label');
        }
        
        // Look for heading elements nearby
        const previousHeading = parent.previousElementSibling;
        if (previousHeading && (previousHeading.tagName === 'H1' || previousHeading.tagName === 'H2' || previousHeading.tagName === 'H3')) {
            const headingText = previousHeading.textContent.trim();
            if (headingText.length > 0 && headingText.length < 100) {
                return headingText;
            }
        }
        
        // Try to get from page title if it's relevant
        if (document.title && document.title.length > 0 && document.title.length < 100) {
            const pageTitle = document.title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            if (pageTitle.length > 5) {
                return pageTitle;
            }
        }
        
        // Try to get from URL
        try {
            const url = new URL(window.location.href);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                const cleanName = lastPart.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
                if (cleanName.length > 3 && cleanName.length < 50) {
                    return cleanName;
                }
            }
        } catch (e) {
            // URL parsing failed, continue
        }
    }
    
    return `Video_${index + 1}`;
}

// Get YouTube video title from page
function getYouTubeTitle(videoId) {
    try {
        // Try to get title from meta tags
        const titleMeta = document.querySelector('meta[property="og:title"]');
        if (titleMeta && titleMeta.content) {
            return titleMeta.content;
        }
        
        // Try to get title from page title
        if (document.title) {
            return document.title.replace(' - YouTube', '').trim();
        }
        
        // Try to get from h1 element
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent) {
            return h1.textContent.trim();
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// Get video size if available
function getVideoSize(videoElement) {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;
        return {
            dimensions: `${width}x${height}`,
            quality: getQualityLabel(width, height),
            width: width,
            height: height
        };
    }
    return null;
}

// Get quality label based on resolution
function getQualityLabel(width, height) {
    const maxDimension = Math.max(width, height);
    
    if (maxDimension >= 3840) return '4K';
    if (maxDimension >= 2560) return '2K';
    if (maxDimension >= 1920) return '1080p';
    if (maxDimension >= 1280) return '720p';
    if (maxDimension >= 854) return '480p';
    if (maxDimension >= 640) return '360p';
    if (maxDimension >= 426) return '240p';
    return `${height}p`;
}

// Calculate quality score for automatic best quality ranking (higher = better)
function getQualityScore(qualityStr, width, height, url) {
    const w = parseInt(width) || 0;
    const h = parseInt(height) || 0;
    if (w > 0 && h > 0) {
        return w * h;
    }
    if (h > 0) {
        return h * Math.round(h * 16 / 9);
    }
    
    let str = (qualityStr || '').toLowerCase().trim();
    if ((!str || str === 'unknown' || str === 'standard') && url) {
        const urlMatch = url.match(/(8k|4320p?|4k|2160p?|2k|1440p?|1080p?|720p?|480p?|360p?|240p?|144p?|hd|fhd|uhd)/i);
        if (urlMatch) {
            str = urlMatch[1].toLowerCase();
        }
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
    
    return 100; // Base score for unknown/standard quality
}

// Extract human-friendly quality label from attributes, dimensions, or URL
function resolveQualityLabel(quality, width, height, url) {
    if (width && height) {
        return getQualityLabel(width, height);
    }
    if (height && !width) {
        const estWidth = Math.round(height * 16 / 9);
        return getQualityLabel(estWidth, height);
    }
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

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Extract Vimeo video ID from URL
function extractVimeoId(url) {
    const regExp = /vimeo\.com\/(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

// Check if URL is a direct video link
function isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}

// Make relative URLs absolute
function makeAbsoluteUrl(url) {
    if (!url) return url;
    
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // Protocol-relative URL
    if (url.startsWith('//')) {
        return window.location.protocol + url;
    }
    
    // Data URL or blob URL - return as-is
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    
    try {
        // Convert relative URL to absolute
        return new URL(url, window.location.href).href;
    } catch (e) {
        console.warn('Could not make URL absolute:', url, e);
        return url; // Return original if conversion fails
    }
}

// Log when content script is loaded
console.log('Video Downloader content script loaded');

// Also try to detect videos when DOM changes (for dynamic content)
if (document.body) {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                // New nodes added, potential new videos
                console.log('DOM changed, new videos might be available');
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

} // end duplicate-injection guard
