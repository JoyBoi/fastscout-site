# Pricing Page Redesign — Premium Automobile Glassmorphism

## Context
The current pricing page is functional but generic — it looks like a basic template. AutoBridge serves automotive dealers, and the page should reflect a premium, high-end feel inspired by luxury car configurators (BMW, Mercedes). The redesign adds a monthly/annual toggle with animations, enriched feature lists, and glassmorphism card styling.

## Design Direction
Dark, sleek, premium automotive aesthetic. Glassmorphism cards with gradient borders, animated toggle, counter animations on price switch. The Pro plan dominates visually.

## Layout Structure

### 1. Header Section
- Badge pill: "Pricing" with subtle glow
- H2: "Choose your plan" (Plus Jakarta Sans, 800, clamp 28-40px)
- Subtitle: one-liner about transparent pricing for dealers
- Centered, max-width 600px

### 2. Billing Toggle
- Centered pill toggle: "Monthly" | "Annual"
- Animated sliding indicator (gradient background, 300ms ease)
- When "Annual" selected: badge "-15%" appears next to toggle with a subtle scale-in animation
- Toggle state controls which prices are displayed in cards below

### 3. Plan Cards (2-column grid, max-width 800px)

**Shared card styling:**
- `backdrop-filter: blur(16px)`
- `background: rgba(24, 24, 27, 0.6)`
- `border: 1px solid rgba(255, 255, 255, 0.06)`
- `border-radius: var(--radius-lg)` (20px)
- `padding: 40px 32px`
- Hover: `translateY(-4px)`, border brightens to `rgba(255,255,255,0.12)`
- Transition: `all 0.35s cubic-bezier(0.16, 1, 0.3, 1)`

**Starter Card (left):**
- Plan name: "Starter" (h3, 18px, 700)
- Subtitle: "Pour commencer" in muted text
- Price block:
  - Monthly: "50€" large (48px, 800) + "/mois" muted
  - Annual: "42.50€" + "/mois" + strikethrough "50€" + badge "Save 15%"
  - Price animates on toggle switch (CSS transition on opacity/transform)
- CTA: outline button "Get Started"
- Feature list with checkmark icons

**Pro Card (right, featured):**
- Gradient border effect: `linear-gradient(var(--color-bg-card), var(--color-bg-card)) padding-box, linear-gradient(135deg, #06B6D4 0%, #6366f1 100%) border-box`
- `border: 2px solid transparent`
- Top glow line: 3px gradient bar across top
- Badge: "Most Popular" pill top-right with gradient bg
- Subtle box-shadow glow: `0 20px 60px -12px rgba(6, 182, 212, 0.15)`
- Plan name: "Pro" (h3, 18px, 700)
- Subtitle: "Vehicules illimites" in primary color
- Price block:
  - Monthly: "250€" large + "/mois"
  - Annual: "212.50€" + "/mois" + strikethrough "250€" + badge "Save 15%"
- CTA: primary gradient button "Get Pro"
- Feature list with checkmark icons (primary color checks)

### 4. Feature Lists

**Starter features:**
- 500 vehicules / mois
- Extraction FastBack & CarCollect
- Mapping AutoScout24 automatique
- Chrome Extension
- Dashboard & historique
- Support par email

**Pro features:**
- **Vehicules illimites**
- Extraction FastBack & CarCollect
- Mapping AutoScout24 automatique
- Chrome Extension
- Dashboard & analytics avances
- Support prioritaire
- Acces anticipe aux nouveautes
- Encheres Auto1 (coming soon badge)

Feature list items:
- Each item has a small checkmark icon (svg, 16px)
- Starter: muted checkmarks
- Pro: primary-colored checkmarks
- "Coming soon" items get a dim badge next to them
- Line-height: 1.6, gap between items: 12px

### 5. Trust Section
Horizontal row of 3 trust badges below cards (centered, gap 32px):
- Lock icon + "Paiement securise via Stripe"
- Clock icon + "Annulation a tout moment"
- Card icon + "Sans frais caches"
Styling: 12px text, dim color, flex with icon

### 6. FAQ Section
Accordion-style (click to expand) instead of static grid:
- 3-4 questions
- Each item: question text (14px, 600) with chevron icon
- Expanded: answer text (13px, muted, 1.7 line-height)
- Smooth height animation (max-height transition)
- Questions:
  1. "Puis-je annuler a tout moment ?"
  2. "Comment fonctionnent les factures ?"
  3. "Que se passe-t-il si je depasse 500 vehicules ?"
  4. "Comment fonctionne l'extension Chrome ?"

## Interactions & Animations

### Toggle Animation
- Sliding pill indicator moves left/right on click
- Price blocks cross-fade: outgoing scales down + fades, incoming scales up + fades in
- Duration: 300ms, easing: cubic-bezier(0.16, 1, 0.3, 1)

### Card Hover
- translateY(-4px)
- Border color brightens
- Pro card: glow shadow intensifies slightly

### CTA Buttons
- Starter: outline button, hover fills with subtle gradient
- Pro: gradient primary button, hover scales slightly (1.02) with brighter glow

### Page Load
- Cards fade-in with stagger (card 1: 0.1s delay, card 2: 0.2s)
- Toggle fades in first (0s)

## Responsive Design
- Desktop (>768px): 2-column grid
- Mobile (<=768px): single column, Pro card first (featured), max-width 400px centered
- Toggle stays centered, same size
- FAQ full-width

## Technical Approach

### Files to modify
- `src/pages/[locale]/pricing.astro` — complete rewrite of template + styles
- `src/pages/pricing.astro` — mirror changes (non-locale version)

### Implementation notes
- Toggle state managed via vanilla JS (no framework needed)
- `data-billing="monthly"` / `data-billing="annual"` attribute on section root
- CSS hides/shows price blocks based on parent data attribute
- FAQ accordion via JS toggling `.open` class
- All animations via CSS transitions (no JS animation libraries)
- Keep existing Astro frontmatter logic (subscription checks, price ID mappings, error banners)
- Keep existing form POST to `/api/checkout` with plan hidden input
- Translations: hardcode FR content for now (matching existing pattern), update i18n keys later

## Verification
- Toggle switches prices correctly between monthly and annual
- Checkout forms submit correct plan value (monthly/annual/quarterly/halfyearly)
- Current plan shows "Plan actuel" disabled button
- Error banners still display correctly
- Responsive layout works on mobile
- Hover animations are smooth
- Page loads fast (no external dependencies)
