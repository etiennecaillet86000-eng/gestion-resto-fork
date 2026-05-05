# Design Brief

## Direction
Professional SaaS restaurant ERP — modular, data-focused interface with sidebar navigation and card-based content layout.

## Tone
Minimalist enterprise interface with refined typography and strategic use of amber accents; no decoration, function-first.

## Differentiation
Collapsible sidebar with hierarchical module navigation (Restaurant, RH, Finance) creates clear mental model for restaurant operations management.

## Color Palette

| Token | OKLCH | Role |
|-------|-------|------|
| background | 0.13 0.01 260 | Dark charcoal base |
| foreground | 0.92 0.008 260 | High-contrast light text |
| card | 0.16 0.012 260 | Elevated surface |
| primary | 0.68 0.165 55 | Amber action, active states |
| secondary | 0.2 0.015 260 | Subtle surface variation |
| muted | 0.2 0.015 260 | Disabled, secondary labels |
| border | 0.25 0.015 260 | Structural dividers |
| success | 0.65 0.18 145 | Positive feedback |
| destructive | 0.55 0.2 25 | Destructive actions |

## Typography
- Display: Fraunces — section headings, module titles
- Body: General Sans — body text, labels, form inputs
- Scale: hero `text-4xl md:text-5xl font-bold`, h2 `text-2xl md:text-3xl font-bold tracking-tight`, label `text-xs font-semibold uppercase`, body `text-sm md:text-base`

## Elevation & Depth
Muted shadows on cards and popovers; layered surface hierarchy through background lightness (background < card < popover) with strategic border usage for clarity.

## Structural Zones

| Zone | Background | Border | Notes |
|------|-----------|--------|-------|
| Header | card | border-b | Branding, user menu |
| Sidebar | sidebar | sidebar-border | Module navigation, collapsible |
| Content | background | — | Card-based layout, alternate muted/card |
| Footer | sidebar | border-t | Status, meta info |

## Spacing & Rhythm
Section gaps 6-8 (1.5-2rem), card padding 4-6 (1-1.5rem), micro-spacing 2-3 (0.5-0.75rem). Alternating background/card zones create rhythm.

## Component Patterns
- Buttons: amber primary on hover, dark border on secondary, full-width on mobile
- Cards: rounded-lg, bg-card, subtle shadow-card, padding-6
- Forms: input bg-muted, border-border, focus ring-primary, label text-xs uppercase
- Tables: card base, striped rows with muted-background alternation

## Motion
- Entrance: Sidebar slide 200ms ease, content fade 150ms
- Hover: Button amber shift 100ms, card shadow elevation 100ms
- Decorative: None; focus on smooth state transitions

## Constraints
- No gradients on backgrounds (use layered surfaces)
- No rounded corners > 8px except buttons (max-lg)
- Amber accent reserved for primary actions and active states only
- Mobile-first responsive; sidebar becomes drawer on sm

## Signature Detail
Dark sidebar with hierarchical module grouping (Restaurant/RH/Finance) provides instant navigation clarity and visual anchoring for complex enterprise workflows.
