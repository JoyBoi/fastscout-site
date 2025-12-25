# FastScout UI Style Guide

## Design Tokens
- Colors: `--color-primary: #3b82f6`, `--color-primary-600: #2563eb`, `--color-text`, `--color-muted`, `--color-bg`, `--color-border`
- Radius: `--radius: 12px`
- Shadow: `--shadow: 0 6px 18px rgba(17, 24, 39, 0.08)`
- Spacing scale: `--space-1..5` = 8, 12, 16, 24, 32px

## Layout
- Container: centered, `max-width: 1120px`, `padding: var(--space-4)`
- Sections: use `.section` with vertical spacing
- Grid: `.grid`, `.grid-2`, `.grid-3` with responsive collapse at 960px
- Header: sticky, blurred background, brand link `.logo`

## Typography
- Headings: large hero `h1` 38px desktop / 32px mobile
- Lead text: `.lead` for secondary emphasis
- Links: inherit color, clear hover without underline by default

## Components
- Buttons: `.btn`, `.btn-primary`, `.btn-outline`
- Cards: `.card` with border, radius, shadow; used for pricing/features
- Feature item: `.feature` with icon badge and text
- Actions group: `.hero-actions` for consistent button spacing

## Accessibility
- Focus: `:focus-visible` 3px outline using primary color mix
- Contrast: dark mode variables ensure AA contrast
- Motion: `@media (prefers-reduced-motion: reduce)` disables transitions and animations
- Target sizes: button padding ≥ 10px, spacing ≥ 12px

## Interactions
- Transitions: buttons and links use `transition: 200ms ease`
- Animations: `.fade-in` for hero/cards; disabled when reduced motion is set

## Information Architecture
- Hero: headline, lead, main CTAs
- Features grid: 4 items mirroring AdGuard’s clarity in grouping
- Pricing: two cards, clear plan details and CTAs
- Dashboard: status, next billing, billing actions, invoices block

## Responsive Rules
- ≤960px: grid stacks to single column, headings scale to 32px, spacing maintained
- Sticky header remains usable with finger targets and spacing

## Reference
- Visual inspiration: AdGuard welcome page layout hierarchy and polish
- Color scheme: FastScout brand primary kept; no green from reference

