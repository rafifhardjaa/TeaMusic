# SYSTEM RULES AND CONSTRAINTS

## 1. UI/UX &amp; Design System (Anthropic Style)

- STRICT RULE: DO NOT USE EMOJIS IN ANY UI COMPONENT. Zero exceptions.
- Use ONLY Phosphor Icons for iconography.
- Typography: Use "Playfair Display" for headers/logos, "Inter" for UI elements, and "Kalam" for handwritten messages.
- Color Palette: 
  - Background: Warm white/Alabaster (#FAF9F6, #F5F5F7).
  - Text: Deep Charcoal (#2D2B2A).
  - Borders/Dividers: Subtle gray (#E5E2DC).
  - Accents/Hover states: Terracotta/Peach (#D97757).
- Borders must be thin (1px) and subtle. Avoid heavy dark borders (No Neo-brutalism).

## 2. Tech Stack Requirements

- Frontend: React + Vite (or Next.js if specified), Tailwind CSS.
- Animations: GSAP exclusively. Avoid overly complex CSS animations unless it is for infinite marquees.
- Backend/Database: Supabase for data persistence. ElysiaJS for custom API routes.
- Package Manager: PNPM.
- Server-Side (Backend &amp; Services)

  - Database &amp; Auth: Supabase.

  - Runtime: Bun.

  - API Wrapper: ElysiaJS (running on Bun). Used for Zodiac/Mood combination logic and iTunes Search API integration.

## 3. Code Generation Rules

- Write clean, modular, functional components.
- Do not hallucinate external libraries unless instructed.
- All forms must be fully controlled components.

