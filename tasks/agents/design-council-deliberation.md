# Design Council Deliberation — NeuraMotion Refactor
**Date:** 2026-10-05  
**Convened by:** Orchestrator  
**Attendees:** 12 council members  
**Artefact:** This file — written to `tasks/agents/design-council-deliberation.md` for cross-process coordination

---

## 1. Principal UX Researcher — Dr. Maya Chen

**Problem framing:** The user report ("no motion, no graphics, looks like a static video") is a trust collapse, not a feature gap. Users who pay credits and receive a stock photo learn the system lies. Trust lost here cannot be regained by adding motion parameters later.

**Evidence from investigation:**  
- Demo mode silently disables the backend (finding 1, confidence: very high)  
- `mock://` URLs written as `video_url` (finding 2)  
- Native shows only a static thumbnail while claiming `playing` (finding 3)  
- Thumbnails are prompt-hashed stock photos (finding 4)

**Position:**  
1. **Kill demo mode as a runtime `.env` toggle.** It is a loaded footgun. Replace with an explicit `--demo` build flag that strips the backend integration entirely and ships a self-contained demo bundle.  
2. **Never write a non-playable URL to `video_url`.** The column means "there is a video file at this address." If there isn't, the value must be `NULL`.  
3. **Add a `generation_method` enum column** (`provider` | `gpu` | `demo` | `mock`) so the UI can honestly label what the user is seeing.  
4. **Run a 5-user unmoderated test** on the fixed flow before merging: task = "generate a 5s video and tell me when it's ready." Measure time-to-first-frame and perceived honesty.

**Dissent:** None. This is the root cause.

---

## 2. Staff Web Designer — Alex Rivera

**Problem framing:** The web player has two code paths that diverge silently: `WebVideo` (React `createElement`) and `WebView` (raw HTML string). The `WebView` path is the XSS vector (findings 3 & 4) and the native mock gap (finding 3, native branch).

**Position:**  
1. **Unify the player to one component.** `WebVideo` is safe (React escapes attributes). `WebView` exists only because `react-native-webview` is the native bridge. On web, `WebView` renders an iframe — unnecessary indirection. Replace the web branch with `WebVideo` everywhere.  
2. **Delete the `mock://` animated gradient surface** (`MockVideoSurface`). It is a design debt artifact: looks like video, isn't video, confuses users. Replace with an honest "Demo mode — no render attached" card that matches the native notice from Step 4.  
3. **Poster image:** Use the first frame of the actual video. If unavailable, show a neutral skeleton — never a stock photo. The current Pexels pool is visual noise.  
4. **Loading states:** The fake progress bar (`polling ? 50 : 100`) is deceptive. Show real provider progress if the provider streams it; otherwise show an indeterminate spinner with "Waiting for render…"

**Risk:** Removing `WebView` on web may break `preview-server.cjs` proxy expectations. Verify the proxy forwards `POST /api/v1/videos` to the backend unchanged — it does (Step 3).

---

## 3. Staff Product Designer — Sam Okafor

**Problem framing:** Three UI controls (Style, Aspect Ratio, AI Model) do nothing on the Replicate path (finding 6). The credit surcharge for "AI Model" is a dark pattern — users pay more for identical output.

**Position:**  
1. **Remove non-functional controls.** If Seedance 2.0 does not accept `aspect_ratio` or `model`, hide those chips. Show a single "Quality" toggle if the provider has a meaningful tier.  
2. **Credit pricing must match reality.** Consolidate the triplicated formula (`create.tsx:87`, `videoService.ts:53`, `video_routes.py:81`) into a single source of truth — ideally a backend endpoint `GET /api/v1/pricing` that the UI fetches.  
3. **Duration chips:** Validate against provider capabilities *before* showing them. If the provider only does 5s and 10s, show only those.  
4. **Style:** If it only works on the GPU path (prompt suffix), either wire it to the provider (if supported) or move it to an "Advanced" section with a tooltip: "Only applies when running local GPU generation."

**Decision:** Do not ship placebo controls. Honest UI > feature theatre.

---

## 4. Design Systems Lead — Priya Nair

**Problem framing:** The codebase has no design tokens for motion, loading, or empty states. The "mock" gradient, the fake progress bar, the stock photo fallback — all are ad-hoc one-offs.

**Position:**  
1. **Define motion tokens:** `duration.short` (3s), `duration.medium` (5-10s), `duration.long` (15s+). Map to provider capabilities in config.  
2. **Empty state system:** `EmptyState{type: 'demo' | 'failed' | 'processing' | 'no-credits'}` with consistent illustration, copy, and primary action. Replace the bare thumbnail, the "Demo render" notice, and the error overlay with instances of this system.  
3. **Player states:** Formalise `PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error' | 'demo'`. The current `playerState` in `app/video/[id].tsx` mixes generation status and playback status — separate them.  
4. **Colour/opacity tokens for overlays:** The dim overlay at `VideoPlayer.tsx:236` uses hardcoded opacity. Extract to `tokens.overlay.scrim`.

**Deliverable:** A `design-tokens.ts` (or JSON) consumed by both web and native. No new dependencies.

---

## 5. Visual Design Director — Marco Rossi

**Problem framing:** The visual language promises cinematic output (dark theme, gradient accents, "AI Video" branding) but delivers a Pexels landscape photo. The gap between promise and delivery is the brand risk.

**Position:**  
1. **No stock photography in the product.** Ever. If we cannot show a frame from the user's video, show a generated placeholder that *looks* like a video frame — e.g., a subtle noise texture with the prompt text faintly watermarked.  
2. **Demo mode aesthetic:** If we keep a demo mode, it must look intentionally stylised — not "broken real mode." Suggest a distinct "sketch" visual language: wireframe frames, storyboard panels, or a looping abstract shader that clearly reads "this is a preview."  
3. **Thumbnail generation:** Invest in a real first-frame extraction pipeline (Step 5). It is the single highest-impact visual fix.  
4. **Loading animation:** Replace the fake progress bar with a generative preview — e.g., a low-res latent space interpolation that runs client-side while waiting for the provider. Even a fake-but-honest "dreaming" animation is better than a lying progress bar.

**Budget note:** First-frame extraction is backend work (Step 5). Client-side "dreaming" animation is a weekend task for a creative coder. Prioritise extraction.

---

## 6. Information Architect — Dr. Lisa Park

**Problem framing:** The data model does not match the user mental model. Users think: "I create a video → it has a file → I play it." The schema has: `status`, `video_url`, `thumbnail_url`, `prediction_id` — but no `generation_method`, no `asset_ready`, no `duration_actual`, no `provider_used`.

**Position:**  
1. **Add `generation_method` enum** (as UX Researcher requested).  
2. **Add `asset_ready` boolean** — true only when `video_url` is a playable `https:` URL. Derived column or application-level invariant.  
3. **Add `provider_used`** — records which provider actually ran. Critical for debugging and for the pricing consolidation.  
4. **Add `duration_requested` vs `duration_actual`** — providers may clamp.  
5. **Deprecate `mock://` in `video_url`.** Move demo scene identifier to a new `demo_scene` column if the feature stays.  
6. **Migration strategy:** Backfill existing rows with `generation_method='unknown'`, `asset_ready=false` where `video_url` is `mock://` or empty.

**Schema changes are low-risk** — additive columns, no NOT NULL. Do them early (Step 0.5).

---

## 7. Human Factors Specialist — Capt. (Ret.) James Whitaker

**Context:** Aviation maintenance technicians use this on tablets in hangars: gloved hands, vibration, poor lighting, cognitive fatigue after 10h shifts. Glanceability and error prevention are non-negotiable.

**Position:**  
1. **No silent failures.** Every generation must end in one of: (a) playable video, (b) explicit error with recovery action, (c) honest "not available" state. The current "completed + mock URL + static thumbnail" is a latent mode error — the system displays "success" while the user has nothing.  
2. **Touch targets:** The play button on `VideoPlayer` must be ≥48dp. Verify on native.  
3. **Colour-blind safe:** The mock gradient (blue-purple) and the error red must pass WCAG AA for deuteranopia. Test with simulator.  
4. **Haptic feedback:** On native, generate a light impact on generation complete (success or failure). `expo-haptics` is already a dependency.  
5. **Offline queue:** If the backend is unreachable, queue the request locally and sync when online. Do not show "Unable to reach backend" and lose the prompt.  
6. **Fatigue-resistant copy:** "Generating your video…" → "Rendering frame 1 of 120…" (real progress) or "Waiting for GPU slot…" (honest wait). No fake percentages.

**Mandate:** Any change that reduces honesty or increases cognitive load is rejected.

---

## 8. Mobile UX Specialist — Yuki Tanaka

**Problem framing:** Native is the primary platform (Expo, `react-native-webview`, `expo-router`). The web build is a preview. The current code treats web as first-class and native as an afterthought (mock surface only on web, WebView fallback on native).

**Position:**  
1. **Native-first player.** Replace `WebView` with `expo-av` `Video` component. `expo-av` supports HLS, caching, background playback, and proper native controls. `react-native-webview` is a crutch.  
2. **Demo mode on native:** Must have an equivalent experience to web. The "Demo render — no video file attached" notice (Step 4) is the minimum. Better: a lightweight Lottie or Reanimated animation that plays offline.  
3. **Offline-first architecture:** `expo-sqlite` or `watermelondb` for local queue. Generation requests persist; polling resumes on app foreground.  
4. **Background generation:** Use `expo-task-manager` + `expo-background-fetch` to poll generation status when app is backgrounded. Notify on completion.  
5. **Safe area handling:** `VideoPlayer.tsx:336` uses absolute fill. Verify on iPhone Dynamic Island and Android gesture nav.  
6. **Memory:** 45s at 8fps = 360 frames. `expo-av` streams; `WebView` loads the whole MP4. Switching to `expo-av` solves the OOM risk.

**Migration:** `expo-av` is already in the Expo SDK. No new dependency. Incremental swap: new component `NativeVideoPlayer` behind a flag, then flip.

---

## 9. Staff Frontend Developer — Diego Morales

**Problem framing:** The frontend has three generations of code coexisting:  
- Legacy: `lib/videoService.ts` (direct Supabase writes, mock logic)  
- Current: `app/(tabs)/create.tsx` (UI, credit math)  
- New: `app/video/[id].tsx` (player orchestration)  

They share state via props, context, and direct Supabase reads — no single source of truth.

**Position:**  
1. **Introduce a `VideoGenerationService` class** (or React Query mutations) that encapsulates: create → poll → completion → error. One place for retry, dedupe, offline queue.  
2. **Remove direct Supabase writes from `lib/videoService.ts`.** The client should call the backend API (`POST /api/v1/videos`) and receive a `video_id`. All status updates come from polling that endpoint.  
3. **TypeScript strictness:** `tsconfig.json` has `strict: true` but `exactOptionalPropertyTypes: false`. Enable it. The `GenerationParams` interface (`types/index.ts:38`) should be the single contract.  
4. **Delete `preview-server.cjs` from the repo.** It is a dev-only proxy. Move to `scripts/preview-server.cjs` and add to `.gitignore`. The production web deploy uses Vercel rewrites (already configured in `vercel.json` if it exists; if not, add it).  
5. **Bundle size:** `expo-router` + `react-native-web` + `three` (not used?) + font weights (18 Inter variants!) = 4.35 MB JS bundle. Audit with `npx expo-bundle-analyzer`. Drop unused font weights.

**Technical debt budget:** Allocate 20% of sprint capacity to the service layer rewrite. Do not block the critical fixes (Steps 1-4) on it.

---

## 10. Staff Backend Developer — Amara Diallo

**Problem framing:** The backend has two generation paths (Replicate, GPU) and a mock path, all in one function (`generate_video`). The GPU path is broken (infinite recursion, wrong pipeline call, no interpolation). The Replicate adapter discards parameters. Config is split between `config.py`, `.env`, and hardcoded defaults.

**Position:**  
1. **Strategy pattern for providers.** `VideoEngine` → `Provider` interface (`ReplicateProvider`, `GPUProvider`, `MockProvider`). Each implements `generate(params) → Result`. Eliminates the `if/else` cascade and the recursion bug.  
2. **Provider capabilities registry.** `config.py` declares what each provider accepts (durations, aspect ratios, motion params). The API validates against this *before* calling the provider. Solves finding 6.  
3. **Async job queue.** Generation is long-running. Move to Celery + Redis (or Cloud Tasks / SQS). The API returns `202 Accepted` + `job_id`; client polls `/jobs/{id}`. This also solves the fake progress bar — real progress comes from the worker.  
4. **Observability.** Structured logging (JSON), request IDs, provider latency histograms. `health` endpoint already exposes provider config (Step 2) — extend with queue depth, error rates.  
5. **Secrets:** `JWT_SECRET` default is a finding. Rotate immediately. Use `python-dotenv` only in dev; production reads from secret manager.  
6. **Database:** The `videos` table is written by both client (Supabase JS) and backend (service role). Pick one. Backend should own writes; client reads via RLS. Remove `supabase-js` writes from `lib/videoService.ts`.

**Priority:** Strategy pattern + capabilities registry (Step 6) unblocks the UI fixes. Job queue is Phase 2.

---

## 11. Content Writer — Jordan Kim

**Problem framing:** The user-facing copy is inconsistent, misleading, or missing.  
- "Syncing credits…" (create.tsx) — credits are local state, not synced  
- "Generating your video" — when demo mode shows a stock photo  
- "Preview is still processing" — when the row is `completed` with a mock URL  
- No empty state copy for "no video file"  
- Error messages leak implementation details ("Unable to reach the video generation backend")

**Position:**  
1. **Voice & tone guide:** Technical but human. No jargon in user-facing strings.  
2. **Copy inventory:** Audit every string in `app/`, `components/`, `lib/videoService.ts`. Classify: `action`, `status`, `error`, `empty`, `education`.  
3. **Rewrite the generation flow:**  
   - Start: "Rendering your video…" (honest verb)  
   - Polling: "Frame 12 of 240 rendered…" (if provider streams) or "In queue… position 3" (if queued)  
   - Complete: "Your video is ready" + play button  
   - Demo: "Demo preview — no credits used" + [Generate for real] button  
   - Error: "Generation failed. [Retry] [Contact support]"  
4. **Microcopy for controls:** "Style" → "Visual style (GPU only)" if it only works there. "AI Model" → "Quality tier" if it only affects price.  
5. **Accessibility:** All status messages must be announced via `aria-live` / `accessibilityLiveRegion`. The fake progress bar is not announced — screen reader users hear nothing.

**Deliverable:** `content/strings.json` (or TypeScript const) — single source for all locales, even if English-only today.

---

## 12. Senior Logo Designer — Elena Volkova

**Problem framing:** The brand mark (assets/images/icon.png) appears in the splash screen and favicon. The app feels like a generic Expo template. No motion in the brand itself.

**Position:**  
1. **Animated logo for loading states.** A 2-3s loop (Lottie / Reanimated) that plays during generation. Reinforces "motion" as brand promise.  
2. **Favicon:** Current is generic. Replace with a 3-frame animated favicon (browser supports `.ico` animation or use `<link rel="icon" href="favicon.gif">`).  
3. **Splash screen:** `expo-splash-screen` shows the static icon. Add `expo-splash-screen` `preventAutoHide` and animate the logo while the app hydrates.  
4. **Watermark (optional):** If Step 8 (compositing) lands, a subtle animated logo watermark on demo/low-tier outputs. Not on paid tiers.  
5. **Design system alignment:** Logo colours must map to design tokens (Design Systems Lead). The current purple-blue gradient (`#6366f1` → `#8b5cf6`) should be `tokens.brand.gradient`.

**Scope:** Visual only. No code logic changes. Can land in parallel with Step 4 (player fixes).

---

## Council Synthesis — Unified Decision

### Principles (unanimous)
1. **Honesty over theatre.** No fake progress, no stock photos, no placebo controls.  
2. **Native-first.** Web is a preview target; native is the product.  
3. **Single source of truth.** One service layer, one pricing source, one player component, one config schema.  
4. **Fail visibly.** Mock mode, missing config, provider errors — all surface as explicit, actionable states.  
5. **Accessibility and human factors are not optional.** Glanceability, touch targets, screen readers, fatigue resistance.

---

### Phase 0 — Foundation (Week 1) — **BLOCKS ALL VERIFICATION**
| Task | Owner | Dependency |
|---|---|---|
| `npm install`, backend venv + `pip install` | Frontend/Backend | None |
| `npm run typecheck` clean, `npm run lint` clean | Frontend | Node modules |
| Schema migration: add `generation_method`, `asset_ready`, `provider_used`, `duration_actual`, `demo_scene` | Backend | Supabase access |
| Backfill existing rows | Backend | Migration |
| Design tokens file (`design-tokens.ts`) | Design Systems | None |
| Content strings inventory (`content/strings.ts`) | Content | None |

**Exit criteria:** TypeScript compiles, linter passes, backend imports, migrations applied, tokens/strings files exist.

---

### Phase 1 — Critical Fixes (Week 1-2) — **SHIP TOGETHER**
| Step | Description | Files | Verification |
|---|---|---|---|
| 1 | Kill demo mode runtime toggle; add `EXPO_PUBLIC_API_URL` docs | `.env`, `.env.example`, `lib/videoService.ts` | Real POST fires, no `mock://` in DB |
| 2 | Backend mock mode → `failed` not `completed` | `video_engine.py`, `video_routes.py`, `health_routes.py` | 503 on mock, no credit deduction |
| 3 | Fix web proxy header forwarding | `preview-server.cjs` | Web generation works via proxy |
| 4 | Player: playability from URL, native demo notice | `VideoPlayer.tsx`, `app/video/[id].tsx`, `videoService.ts` | Native shows notice, web shows sample clip |
| 5 | Posters from real frames, never stock | `video_engine.py`, `video_routes.py`, `videoService.ts` | Poster matches render or is empty |
| 6 | Provider capabilities registry + duration validation | `config.py`, `replicate.py`, `video_engine.py`, `create.tsx` | 45s rejected, 5s accepted |
| 3+4 (security) | HTML injection fixes | `lib/html.ts`, `web-view.tsx`, `VideoPlayer.tsx` | `safeMediaUrl` used, XSS vectors closed |
| 1+2 (security) | Auth: loopback gate, default off, startup guard | `auth.py`, `config.py`, `main.py`, `preview-server.cjs` | 401 on exploit, boot refusal on prod |

**Exit criteria:** All 8 verifications pass. No `completed` row with unresolvable `video_url`. `npm run typecheck` + `lint` + `build:web` clean.

---

### Phase 2 — Architecture & Polish (Week 3-4)
| Task | Owner | Dependency |
|---|---|---|
| Provider strategy pattern (`Provider` interface) | Backend | Phase 1 done |
| Async job queue (Celery/Redis or Cloud Tasks) | Backend | Provider pattern |
| `expo-av` native player swap | Mobile UX | Phase 1 player fixes |
| Offline queue + background sync | Mobile UX | Service layer |
| First-frame extraction pipeline | Backend | Job queue |
| Credit pricing consolidation (`/api/v1/pricing`) | Backend + Frontend | Provider capabilities |
| Design token integration (player, empty states) | Design Systems + Frontend | Tokens file |
| Content string deployment | Content | Strings file |
| Animated logo + favicon | Logo Designer | Design tokens |
| Bundle audit + font weight reduction | Frontend | `expo-bundle-analyzer` |

---

### Phase 3 — Motion & Graphics (Week 5+) — **OPTIONAL**
Only if user confirms "motion" = provider camera controls OR post-processing overlays.  
Requires: verified provider capability, storage target, compositing pipeline.  
**Do not start until Phase 1 is green in production.**

---

## Open Questions for User (from Council)

1. **Demo mode audience:** Is this for a public demo site, investor preview, or internal QA? Determines whether we keep it at all.  
2. **Production provider:** Confirm `bytedance/seedance-2.0` input schema (durations, aspect ratio, motion params). We designed capabilities registry for this — need the values.  
3. **Test platform:** The screenshot shows only Create screen. Was the static output on iOS, Android, or web? Changes native vs web priority.  
4. **Mock scene feature:** Keep the CSS gradient demo as a "sketch mode" (Visual Design Director's idea) or drop entirely?  
5. **Storage target:** `cdn.neuramotion.ai` — real host or placeholder? Need bucket/credentials for poster extraction and compositing.  
6. **Graphics definition:** Provider motion parameters (camera/subject) OR post-production overlays (titles/watermarks)? Different architectures.  
7. **Phantom row cleanup:** Supabase project has existing `completed` rows with `mock://` URLs. Delete? Mark `failed`? Archive?

---

## Coordination Protocol

- This file is the **single source of truth** for the refactor.  
- Each phase produces a commit (or PR) that references the step numbers above.  
- Council members update their section with 🟢/🟡/🔴 status emoji as work progresses.  
- Blockers are added as `<!-- BLOCKER: ... -->` comments in this file.  
- No Slack, no chat, no verbal sync — this file *is* the sync.

---

**Signed:**  
Dr. Maya Chen (UX Research) — 🟡  
Alex Rivera (Web Design) — 🟡  
Sam Okafor (Product Design) — 🟡  
Priya Nair (Design Systems) — 🟡  
Marco Rossi (Visual Design) — 🟡  
Dr. Lisa Park (Info Architecture) — 🟡  
Capt. James Whitaker (Human Factors) — 🟡  
Yuki Tanaka (Mobile UX) — 🟡  
Diego Morales (Frontend) — 🟡  
Amara Diallo (Backend) — 🟡  
Jordan Kim (Content) — 🟡  
Elena Volkova (Logo) — 🟡

**Orchestrator note:** All members start at 🟡 (ready). Update to 🟢 when your phase tasks are verified. 🔴 if blocked — add blocker comment.