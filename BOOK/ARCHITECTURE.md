# SYSTEM ARCHITECTURE

## 1. Client-Side (Frontend)

- Framework: React (bootstrapped with Vite).
- State Management: React Context or Zustand for global state (if needed for audio player state).
- Routing: React Router (for Single Page Application navigation between Home and Browse).
- Styling: Tailwind CSS.
- Share previews: a Cloudflare Pages Function rewrites the Open Graph tags of a shared link (`/?m=<id>`, `/to/:name`) at the edge, because a crawler never runs the SPA.

## 2. Server-Side (Backend &amp; Services)

- Database &amp; Auth: Supabase. Handles direct data insertion and retrieval.
- API Wrapper: ElysiaJS. Used for handling complex logic like Zodiac/Mood combination algorithms before interacting with Supabase or the iTunes Search API.

## 3. External Integrations

- iTunes Search API: free, unauthenticated track search and lookup.
- Web Share API: For native sharing capabilities on mobile devices.

4. Tech Stack Requirements

- Frontend: React + Vite, Tailwind CSS. Package Manager: PNPM.
- Backend API: ElysiaJS running strictly on Bun runtime. Use Bun as the package manager and runner for the backend directory.
- Animations: GSAP exclusively.
- Database: Supabase.

