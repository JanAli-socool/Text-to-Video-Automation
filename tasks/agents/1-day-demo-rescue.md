# 1-Day Demo Rescue Plan — NeuraMotion
**Constraint:** 8-10 hours | **Goal:** Credible demo (not perfect product) | **Strategy:** Kill the lies, show real video, hide broken UI

---

## Hour 0-1: Environment & Verification (DO FIRST)

```bash
# 1. Kill demo mode — THE ROOT CAUSE
cd repo
# Edit .env: change EXPO_PUBLIC_DEMO_MODE=true → false
# Verify EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 (native) or unset (web)

# 2. Backend env — ensure real provider path
cd backend
# Verify .env has:
# VIDEO_PROVIDER=replicate
# VIDEO_PROVIDER_TOKEN=<your 40-char token>
# VIDEO_PROVIDER_MODEL=bytedance/seedance-2.0
# ENABLE_GPU_GENERATION=false

# 3. Quick dependency check
cd ../repo && npm install 2>&1 | tail -5
cd ../backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt 2>&1 | tail -3
```

**Success criteria:** `npm run typecheck` passes (or at least no new errors), backend imports config.

---

## Hour 1-2: Fix the Two "Mock" Lies (HIGHEST IMPACT)

### A. Frontend: Stop writing `mock://` to database
**File:** `lib/videoService.ts` — lines 45-51, 181-203

```ts
// BEFORE (line 45-49):
if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
  return `mock://scene-${Math.abs(hash) % 8}-${duration}s`;
}

// AFTER — use real sample clips in demo mode:
if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
  return SAMPLE_VIDEO_URLS[Math.abs(hash) % SAMPLE_VIDEO_URLS.length];
}
```

```ts
// BEFORE (line 185, 197): writes mock:// to video_url
video_url: videoUrl,  // includes mock://

// AFTER: only write real URLs
video_url: videoUrl.startsWith('mock://') ? '' : videoUrl,
```

### B. Backend: Mock mode → fail visibly (not fake success)
**File:** `backend/app/video_engine.py` — lines 151-164

```python
# BEFORE: returns fake CDN URL, route marks completed
video_url = f"https://cdn.neuramotion.ai/mock/{hash}.mp4"
return {"video_url": video_url, ...}

# AFTER: signal no asset produced
return {
    "title": title,
    "thumbnail_url": thumbnail_url,
    "video_url": "",
    "mock": True,  # flag for route to handle
}
```

**File:** `backend/app/routes/video_routes.py` — lines 136-147

```python
# AFTER: only mark completed if real URL
delivered = bool(result.get("video_url"))
status = "completed" if delivered else "failed"
# only deduct credits if delivered
```

---

## Hour 2-3: Player Honesty (NATIVE + WEB)

### A. Native: Show "Demo — no video" instead of silent thumbnail
**File:** `components/VideoPlayer.tsx` — add after line 219

```tsx
{isMockVideo && Platform.OS !== 'web' && state !== 'generating' && state !== 'error' && (
  <View style={styles.nativeMockNotice}>
    <Text style={styles.nativeMockText}>Demo mode — no video generated</Text>
  </View>
)}
```

```tsx
// Add to styles (line 336+):
nativeMockNotice: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
nativeMockText: { fontFamily: 'Inter-Medium', fontSize: 14, color: '#fff' },
```

### B. Web: Use sample clips in demo mode (already fixed by videoService change)

### C. Don't claim "playing" for mock rows
**File:** `app/video/[id].tsx` — lines 74-82

```tsx
const playable = Boolean(videoData.video_url) && !videoData.video_url.startsWith('mock://');
if (videoData.status === 'processing') {
  setPlayerState(playable ? 'playing' : 'generating');
  startPolling(videoData.id);
} else if (videoData.status === 'completed' && playable) {
  setPlayerState('playing');
} else {
  setPlayerState('error');
}
```

---

## Hour 3-4: Hide Placebo Controls (PRODUCT CREDIBILITY)

**File:** `app/(tabs)/create.tsx` — comment out non-functional chips

```tsx
// Style chips (line 294-306) — only works on GPU path
{/* <StyleChips /> */}

// Aspect Ratio chips (line 333-354) — discarded by Replicate
{/* <AspectRatioChips /> */}

// AI Model chips (line 378-395) — only affects price, not output
{/* <ModelChips /> */}

// KEEP: Duration chips (line 315) — but constrain to [5, 10] if provider only accepts those
const DURATION_OPTIONS = [5, 10]; // verify with Replicate docs
```

**Add a banner** at top of Create screen:
```tsx
<View style={{padding: 16, backgroundColor: '#fff3cd', borderBottomWidth: 1, borderColor: '#ffc107'}}>
  <Text style={{color: '#856404', fontFamily: 'Inter-Medium'}}>
    ⚠️ Demo build: Style, Aspect Ratio, and Model selectors hidden — not yet wired to provider.
  </Text>
</View>
```

---

## Hour 4-5: Security Band-Aids (DEMO SAFETY)

### A. URL scheme validation (prevents XSS in WebView)
**File:** `lib/videoService.ts` — add at top

```ts
function isSafeMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['https:', 'http:'].includes(u.protocol); // allow http for local preview
  } catch { return false; }
}
```

Use before writing `video_url`/`thumbnail_url` to DB.

### B. Auth: Quick loopback gate (5 min)
**File:** `backend/app/auth.py` — line 29

```python
# Add at start of preview fallback:
if not credentials and settings.preview_dev_auth and x_preview_user_id:
    from fastapi import Request
    # This is a hack — proper fix needs Request param
    # For demo: at least log the attempt
    print(f"[SECURITY] Preview auth used for user {x_preview_user_id}")
```

---

## Hour 5-6: Run the Stack & Test End-to-End

```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Web preview proxy (if testing web)
cd repo && node preview-server.cjs

# Terminal 3: Expo
cd repo && npm run dev -- --clear
```

**Test flow:**
1. Open app (web or Expo Go)
2. Sign in
3. Enter prompt, pick duration (5 or 10)
4. Tap Generate
5. **Verify:** Real POST to `/api/v1/videos` (check backend logs)
6. **Verify:** Row gets `status=completed` with real `video_url` (https:// from Replicate)
7. **Verify:** Player plays actual video (not thumbnail)
8. **Verify:** Credits deducted correctly

---

## Hour 6-7: Clean Up Phantom Rows (DATA HYGIENE)

```sql
-- Run in Supabase SQL editor:
UPDATE videos 
SET status = 'failed', video_url = '', thumbnail_url = ''
WHERE video_url LIKE 'mock://%' OR video_url LIKE '%neuramotion.ai/mock%';
```

---

## Hour 7-8: Polish & Record Demo

### Visual polish (5 min each):
- [ ] Splash screen shows your logo (not Expo default)
- [ ] Loading spinner during generation (not fake progress bar)
- [ ] Success toast: "Video ready!" with play button
- [ ] Error toast: "Generation failed — please retry"

### Record:
- **Device:** iPhone (Expo Go) or Android — native feels more "app-like"
- **Flow:** Prompt → Generate → Wait (show real backend logs) → Play video
- **Narration:** "Real AI generation via Replicate, credits deducted, playable video"

---

## What to Explicitly NOT Do (TIME BOX)

| ❌ Skip | Reason |
|---|---|
| Schema migrations | Requires Supabase access, migration review |
| Provider strategy pattern | Architecture refactor — days of work |
| `expo-av` player swap | Native player works for demo |
| Design tokens / content strings | Invisible to demo viewer |
| Full XSS fix (`lib/html.ts`) | Band-aid above sufficient for controlled demo |
| Offline queue / background sync | Not visible in 2-min demo |
| Automated tests | No time |

---

## Go/No-Go Checklist (at Hour 7)

| Check | Pass? |
|---|---|
| `EXPO_PUBLIC_DEMO_MODE=false` in `.env` | ☐ |
| Backend `VIDEO_PROVIDER=replicate` with valid token | ☐ |
| Generate → real POST to backend → Replicate called | ☐ |
| Row gets `completed` + `https://` video_url | ☐ |
| Player plays video (native + web) | ☐ |
| No `mock://` URLs in database | ☐ |
| Placebo controls hidden | ☐ |
| Credits deducted correctly | ☐ |
| Phantom rows cleaned | ☐ |

**If all ☐ = ✅ → Record demo. If any ☐ = ❌ → Fix that one thing.**

---

## Emergency Fallback (if Replicate fails)

If Replicate API is down/quota exceeded at demo time:

1. **Pre-generate 3-5 videos** now, save their `video_url`s
2. **Hardcode** in `lib/videoService.ts` demo mode to return those real URLs
3. **Label clearly:** "Demo uses pre-generated samples — live generation available in production"

This is honest theatre. Better than fake progress + stock photo.