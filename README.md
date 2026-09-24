# Video Downloader Chrome Extension

A Chrome extension that allows users to detect and download videos from web pages.

Copyright (c) 2026 Arun Kumar. Licensed under the MIT License — see [LICENSE](LICENSE).

## Features

- Detects HTML5 video elements on web pages
- Identifies YouTube and Vimeo embedded videos
- Finds direct video links (MP4, WebM, etc.)
- Clean, modern popup interface
- Multiple download options:
  - **Download**: Direct download (works for most videos)
  - **Copy URL**: Copy video URL to clipboard for manual download
  - **Open**: Open video in new tab (useful for testing or alternative downloaders)
- Automatic file extension detection
- Fallback mechanisms for download failures

## Installation

1. **Add icons**: Add icon files to the `icons/` directory:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

   You can create simple icons using online tools like:
   - https://www.favicon-generator.org/
   - https://canva.com/
   - Or use any image editor

2. **Load extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `video-downloader-extension` folder

3. **Test the extension**:
   - Open the included `test.html` file in Chrome to test video detection
   - Or navigate to any page with videos (e.g., YouTube, or any page with HTML5 video)
   - Click the extension icon in the browser toolbar
   - The popup will show detected videos
   - Click "Download" on any video to download it

## File Structure

```
video-downloader-extension/
├── manifest.json       # Extension configuration
├── popup.html          # Popup UI structure
├── popup.css           # Popup styling
├── popup.js            # Popup functionality
├── content.js          # Content script for video detection
├── background.js       # Background service worker
├── icons/              # Extension icons (you need to add these)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── package.json        # Project metadata
```

## How It Works

1. **Content Script** (`content.js`): Runs on every page and detects:
   - HTML5 `<video>` elements
   - YouTube and Vimeo iframes
   - Direct video links

2. **Popup** (`popup.html/js/css`): 
   - Shows detected videos when you click the extension icon
   - Provides download buttons for each video
   - Displays video information (title, URL, size)

3. **Background Script** (`background.js`): 
   - Handles download events
   - Manages extension lifecycle

## Permissions

The extension requires:
- `activeTab`: Access to the current tab to scan for videos
- `downloads`: Ability to download files
- `scripting`: Ability to inject content scripts
- `<all_urls>`: Access to all websites to detect videos

## Limitations

- YouTube/Vimeo videos: Only detects the video page URL, actual download may require additional tools
- Some streaming platforms may not allow direct downloads
- Blob URLs are not supported (temporary streaming URLs)

## Development

To modify the extension:
1. Make changes to the files
2. Go to `chrome://extensions/`
3. Click the reload button on your extension card
4. Test the changes

## Support & Contact

For questions, issues, or suggestions, please contact the development team at:
- Email: [devteam.official@myyahoo.com](mailto:devteam.official@myyahoo.com)
- GitHub: [arunkumarjust97-arch/video-downloader-extension](https://github.com/arunkumarjust97-arch/video-downloader-extension)
- Report Issues: [GitHub Issues](https://github.com/arunkumarjust97-arch/video-downloader-extension/issues)

## Security Note

This extension is for educational purposes and personal use. Always respect copyright laws and terms of service of the websites you use.
