// Video Downloader extension

// Background service worker for Video Downloader extension

chrome.runtime.onInstalled.addListener(function() {
    console.log('Video Downloader extension installed');
});

console.log('Video Downloader background script loaded');
