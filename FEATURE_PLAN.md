# Feature Implementation Plan - AutoSong Studio v2.0

## Priority 1: Critical Backend Fixes

### 1.1 User Data Persistence ✅ (Already working)
- [x] User data stored by MongoDB user ID
- [x] Schedulers linked to user ID
- [x] Videos linked to user ID

### 1.2 Suno Credits Detection & Scheduler Auto-Pause
- [ ] Detect 429 error / "Insufficient credits" from Suno API
- [ ] Auto-pause ALL schedulers for that user with error message "Suno credits exhausted"
- [ ] When user updates API key, check if any paused schedulers exist and offer to resume

### 1.3 Video Data Retention Policy
- [ ] After YouTube upload: Delete video/audio/thumbnail files, keep only YouTube URL
- [ ] Failed videos: Keep metadata for 7 days, then auto-cleanup (cron job)
- [ ] Store: title, description, tags, youtubeUrl, status, createdAt

---

## Priority 2: YouTube Upload Improvements

### 2.1 Delayed Public Publishing
- [ ] Upload as "private" first
- [ ] Set `publishAt` to current time + 5 minutes
- [ ] YouTube automatically makes it public at that time

### 2.2 Monetization Setting
- [ ] Check if user's channel has monetization enabled (YouTube API)
- [ ] If enabled, set `selfDeclaredMadeForKids: false` and monetization params

---

## Priority 3: AI Generation Improvements

### 3.1 Thumbnail Variation
- [ ] Generate unique prompts based on full lyrics themes
- [ ] Extract key emotions, scenes, colors from lyrics
- [ ] NEVER include text in thumbnail (add to negative prompt)
- [ ] Add randomization seed for variety

### 3.2 Groq AI Prompt Enhancement
- [ ] "World's best SEO strategist" persona for metadata
- [ ] "World's best lyricist" persona for lyrics
- [ ] Maximum character limits when no user prompts:
  - Title: 80-100 chars
  - Description: 4000-5000 chars
  - Tags: 20 tags maximum
- [ ] Strictly follow user's custom prompts if provided

---

## Priority 4: Free User Restrictions

### 4.1 24-Hour Activity Check
- [ ] Track `lastActiveAt` timestamp per user
- [ ] Background job checks every hour
- [ ] If `lastActiveAt` > 24 hours ago: pause all schedulers
- [ ] Set `pauseReason: "Inactive for 24 hours. Open app to resume."`

### 4.2 Push Notifications (Requires Firebase Cloud Messaging)
- [ ] Send reminder notification 5 hours before 24-hour limit
- [ ] "Open AutoSong Studio to keep your schedulers running!"

---

## Priority 5: Android App Changes

### 5.1 Channel Switching
- [ ] Store all user channels from login
- [ ] Add dropdown in channel container (right side)
- [ ] On channel switch: filter schedulers/videos by channelId

### 5.2 Home Screen Improvements
- [ ] Show mini thumbnail for each song (not just icon)
- [ ] Show processing spinner while generating
- [ ] Show error icon + message for failed songs
- [ ] Recent Activity: Max 10 songs, pagination on scroll

### 5.3 Caching Strategy
- [ ] Cache all data locally (Hive or SharedPreferences)
- [ ] Only fetch from server on pull-to-refresh
- [ ] Background sync when app opens

### 5.4 Library Screen
- [ ] Categories: Ready, Uploaded, Processing, Failed
- [ ] Each shows songs by status
- [ ] Uploaded songs: fetch details from YouTube URL

---

## Implementation Order:

1. **Today**: Backend fixes (Suno credits, delayed publishing, thumbnail variation)
2. **Next**: Groq AI improvements
3. **Then**: Android app caching & UI changes
4. **Later**: Free user restrictions & notifications

---

## Notes:
- Firebase Cloud Messaging needed for push notifications
- YouTube API has monetization settings but limited control
- 7-day cleanup requires scheduled cron job
