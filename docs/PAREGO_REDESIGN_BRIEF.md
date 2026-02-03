# Parego Redesign Brief — Landing, Onboarding & Presence

You are a senior product-minded full-stack engineer and UX designer. You are helping redesign the landing page and onboarding experience for an OTB (over-the-board) chess tournament application called Parego.

---

## Stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS** + **Radix UI** + **Lucide**
- **React Hook Form** + **Zod**
- **Supabase** (Auth, Postgres, RLS)
- **Sonner** (toasts)
- **next-themes**
- **date-fns**
- **nanoid**

**Important:** You are responsible for designing any data structures, database changes, APIs, and internal architecture. Do NOT expect them to be pre-defined. Propose and implement them as needed.

You must preserve existing functionality and pairing logic.

---

## Product Vision

Parego is for real-life chess tournaments played in person. The experience should feel like walking into a tournament hall, not using administrative software.

The current landing page is too plain and signup-focused. The new landing page should immediately show chess activity near the user and make the app feel alive and social.

---

## Primary Goals

### 1) Landing Page Should Show Activity Immediately

When a user opens the app for the first time:

- They should see **nearby tournaments** right away.
- They should **NOT** be forced to sign up just to browse.
- The page should communicate:
  - Real tournaments are happening
  - Real players are there
  - They can quickly join or watch

The landing page should highlight:

- Tournaments near the user
- Player activity
- Status of tournaments (live / starting soon / upcoming)
- Player participation indicators (avatars or similar)
- Urgency elements (countdowns, next pairing timing)
- Clear CTAs: **View tournament**, **Join tournament**

**If location permission is denied:**

- Provide an alternative discovery experience: popular tournaments, manual location search, or venue codes.
- Clearly explain that physical proximity will eventually be required to join and be paired.

**Alignment with codebase:** The new landing and discovery experience should reuse and extend the existing nearby-tournaments logic and tournament location/organizer data (e.g. `/nearby`, latitude/longitude, visibility) rather than duplicating it. Presence and check-in are additive (new fields and flows) and must not replace or bypass existing pairing logic.

---

### 2) Prevent Remote Trolling (Extremely Important)

Because this is for physical tournaments, users must be **near the venue** to actually participate.

The system should allow:

- Viewing tournaments from anywhere
- **Expressing interest** remotely (see below)

But it should **require physical presence** to:

- Check in
- Enter the pairing pool
- Play games

You must design and implement a **reliable presence verification system**.

**Primary method (Phase 1):** GPS proximity.

- Presence is verified by GPS within a **configurable radius** (e.g. 150 m default) of the tournament’s set venue.
- Allow **one retry** after a short delay to handle indoor drift.
- If verification fails, show a clear message and an **optional manual override** for the organizer (e.g. “Mark present”) for rare edge cases.
- **Phase 1 is GPS-only.** QR code or venue-based check-in is explicitly deferred to a later phase. The presence model (e.g. a single “verified at” timestamp and source) should be designed so we can add QR or other methods as alternative verification sources without changing core pairing or TD flows.

**Future / optional:** QR code check-in at venue; Bluetooth / local device presence (experimental; design so it could be supported later if feasible).

**Goal:** Protect tournaments from players joining remotely and never showing up.

**Location privacy:** Location is used only for proximity checks at join/check-in and for surfacing nearby tournaments. We do not persist precise coordinates long-term, and we do not show other users’ locations—only that tournaments exist near them.

---

### 3) “Reserve” vs “Express Interest”

Remote users may only browse and **“express interest”** in a tournament—a lightweight, non-binding flag (e.g. a count or list of interested users) that organizers can see. Reserving a slot or joining the pairing pool requires presence verification at the venue.

---

### 4) Fun and Low-Friction Onboarding

Avoid traditional boring signup forms.

- Users should be able to **explore tournaments before creating an account**.
- When onboarding is needed (e.g. joining a tournament), it should feel **playful and fast**.

Suggested flow concept:

- Ask for **name** first
- Ask a **fun chess personality or skill question** with humorous answer choices
- Offer **optional avatar or photo** upload
- Only request **email or authentication** when the user attempts to actually join or save participation

**Anonymous → identified:** Users may browse and express interest without an account. When they choose to join a tournament, we prompt for display name and the optional fun/chess personality step, then create or link to an account (e.g. magic link or OAuth via Supabase Auth) so their participation and reliability are tied to a stable identity.

This onboarding should feel **social and game-like** rather than administrative.

**Avatars/photos:** Player avatars or photos are optional and stored in Supabase Storage under a dedicated bucket with size and type limits. We do not support moderation in v1 beyond basic upload rules; use a public or signed URL pattern that works with RLS and our existing user/profile model.

---

### 5) Reliability and Attendance Awareness

The system should encourage **responsible participation**.

Design a concept where the app can:

- Detect or infer player attendance
- Remove inactive players from pairings
- Potentially track reliability over time
- Surface attendance/reliability information in a **lightweight, positive** way

**Tournament director (TD) view:** Tournament directors see a single, clear list of players who are **“checked in”** (presence-verified); only those players are included in the pairing pool. Players who have joined but not yet checked in are visible as **“pending check-in”** so TDs can nudge or manage expectations without extra workflow.

Keep this socially encouraging, not punitive.

---

### 6) Who Can Create Tournaments

Any **authenticated user** may create a tournament. We do not introduce organizer verification or approval in the first version. The data model and RLS should treat organizer as a first-class role so we can add verification or badges later without a breaking change.

---

## UX and Emotional Direction

The app should feel:

- **Live**
- **Social**
- **Real-world**
- **Low friction**
- **Trustworthy**

Avoid:

- Spreadsheet-like tournament software feel
- Large signup walls
- Overly complex onboarding

Encourage:

- Real player identity (photos or avatars)
- Movement and activity indicators
- Tournament urgency and excitement

---

## Additional Product & Technical Clarifications

**Offline / connectivity:** In v1 we assume a working connection for pairing and check-in; we optimize for fast loads and clear loading/error states. Offline support (e.g. cached pairings, queued actions) is explicitly out of scope for the first release. The data layer should avoid patterns that would make offline support impossible later.

**Notifications:** In-app state (e.g. pairing ready, your game is next) is reflected immediately via existing real-time or refetch patterns. Push or email notifications are out of scope for the first release. The data model (e.g. pairing and match state in Supabase) should not preclude adding them later.

**Accessibility:** UI should be mobile-first with sufficient touch targets and contrast. We follow Radix’s accessibility defaults and avoid custom components that bypass them.

**Success (optional):** We consider the redesign successful if discovery-to-join and join-to-check-in rates improve and time-to-first-meaningful-action (e.g. viewing or joining a tournament) decreases. We will add minimal, privacy-conscious instrumentation (e.g. Supabase or a simple events table) to measure these once the core flows are stable.

---

## Engineering Expectations

You must:

1. **Inspect** the existing repository and understand the current landing page, tournament pages, authentication, and pairing logic.
2. **Propose** improvements to:
   - Landing page layout
   - Discovery experience
   - Onboarding flow
   - Presence verification workflow
   - Tournament join lifecycle
3. **Design and implement** any required:
   - Database or Supabase changes
   - APIs or server actions
   - Client UI components
   - State flows and permission handling

You decide the best architecture. Respect security and RLS patterns. Preserve existing working tournament functionality.

---

## UI / Component Direction

- **Tailwind CSS**
- **Radix UI** components
- Modern animation and micro-interactions where appropriate
- Clean **mobile-first** design

The landing page should visually communicate **activity** and **proximity**.

---

## Phased Delivery Approach

1. **First:** Propose new UX layout and user flows.
2. **Second:** Provide a file-by-file implementation plan.
3. **Third:** Implement a minimal but functional version.
4. **Fourth:** Add polish, animations, and enhancements.

---

## Recommended Implementation Order

Implement in this order to respect dependencies, avoid rework, and deliver usable value at each step.

| Order | Work | Why this order |
|-------|------|-----------------|
| **1** | **Schema & data model** | Add presence fields (`checked_in_at`, `presence_source`), optional `tournament_interest` (or equivalent), and profile extensions (avatar, fun-question). No UI. Unblocks all later steps. |
| **2** | **Landing page redesign** | New layout and discovery using existing `/nearby` and tournament data. Show nearby tournaments, status (live / soon / upcoming), and CTAs. No signup gate. Delivers “activity first” without touching pairing or auth. |
| **3** | **Express interest** | Backend (e.g. `tournament_interest` table + RLS) and UI (button + count). Lightweight; can require sign-in for v1. Organizers see interest; no presence required yet. |
| **4** | **Presence verification** | Server action: accept lat/lon + tournament id, validate radius, set `checked_in_at` (and optionally `presence_source`). Client: request location, call action, one retry, clear success/fail. Organizer override: “Mark present” that sets `checked_in_at`. |
| **5** | **Join flow gated by presence** | “Join tournament” requires successful check-in first. If not checked in, prompt presence flow then retry join. Reuse existing add-player logic after gate. |
| **6** | **Playful onboarding** | Name → fun chess question → optional avatar → auth (magic link/OAuth) when joining. Persist to profile; use in join flow. |
| **7** | **TD view: checked in vs pending** | In tournament management, show “Checked in” (in pairing pool) vs “Pending check-in.” Pairing logic uses only presence-verified players. Small change to existing player list + pairing input. |
| **8** | **Polish** | Avatars on landing/cards, reliability hints, micro-interactions, location-denied fallback (popular/search/venue code), and any instrumentation for success metrics. |

**Principle:** Each step leaves the app in a shippable state. Steps 1–3 give a better landing and discovery; 4–5 enforce presence at join; 6–7 complete the join and TD experience; 8 improves feel and measurability.

---

## Constraints

**Do not:**

- Overcomplicate tournament director workflows
- Break existing pairing logic
- Require signup before discovery

**Do:**

- Focus heavily on user experience
- Design scalable presence verification
- Keep architecture extensible

---

## Next Step

Start by **analyzing the current codebase** and explaining how you would redesign the landing page, onboarding, and presence verification systems **before** writing code.
