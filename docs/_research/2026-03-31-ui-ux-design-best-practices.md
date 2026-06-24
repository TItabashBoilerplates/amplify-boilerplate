# UI/UX Design Best Practices Research Report

## Research Information
- **Date**: 2026-03-31
- **Researcher**: spec agent
- **Scope**: Comprehensive UI/UX design guidelines covering visual design, interaction design, accessibility, responsive design, UX principles, modern patterns, and design systems

## Sources
- [Nielsen Norman Group - 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C - What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [Google Material Design 3](https://m3.material.io/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Cieden - Spacing Best Practices](https://cieden.com/book/sub-atomic/spacing/spacing-best-practices)
- [BrowserStack - Responsive Design Breakpoints 2025](https://www.browserstack.com/guide/responsive-design-breakpoints)
- [UX Playbook - UI Best Practices](https://uxplaybook.org/articles/ui-fundamentals-best-practices-for-ux-designers)
- [UXness - 31 Laws of UX](https://www.uxness.in/2024/03/12-laws-of-ux-designing-with-principles.html)
- [NN/G - Form Error Guidelines](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [web.dev - Animation & Motion Accessibility](https://web.dev/learn/accessibility/motion)
- [Brad Frost - Atomic Design](https://atomicdesign.bradfrost.com/chapter-2/)
- [Design Systems Collective - Design Tokens 2025](https://www.designsystemscollective.com/the-evolution-of-design-system-tokens-a-2025-deep-dive-into-next-generation-figma-structures-969be68adfbe)
- [Dark Mode Best Practices 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/)
- [AI UX Design Patterns](https://www.aiuxdesign.guide/patterns/progressive-disclosure)

---

## 1. Visual Design Principles

### 1.1 Typography Hierarchy and Readability

#### Type Scale
| Level | Recommended Size | Weight | Use Case |
|-------|-----------------|--------|----------|
| Display / H1 | 32-48px | Bold (700) | Page titles, hero sections |
| H2 | 24-32px | Semi-bold (600) | Section headings |
| H3 | 20-24px | Semi-bold (600) | Subsection headings |
| H4 | 18-20px | Medium (500) | Card titles, subheadings |
| Body | 16px (base) | Regular (400) | Paragraph text |
| Small / Caption | 12-14px | Regular (400) | Labels, captions, metadata |

#### Typography Rules Checklist
- [ ] Use a consistent type scale ratio (1.2 "Minor Third" or 1.25 "Major Third")
- [ ] Maximum 2 typefaces per project (1 primary + 1 accent)
- [ ] Body text minimum 16px on web, 14px on mobile
- [ ] Line height: 1.4-1.6x font size for body text (aim for multiples of 4 or 8)
- [ ] Line length: 45-85 characters per line (optimal: 65-75)
- [ ] Paragraph spacing > line spacing (internal < external rule)
- [ ] Contrast ratio: minimum 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+)
- [ ] Avoid justified text on web (causes uneven word spacing)
- [ ] Use `font-display: swap` for web fonts to prevent FOIT

### 1.2 Color Theory and Accessibility

#### Color Palette Structure
```
Primary:     1 primary brand color + 5-9 tints/shades
Secondary:   1 accent color + 5-9 tints/shades
Neutrals:    8-12 grays (from near-white to near-black)
Semantic:
  - Success:  Green (#16A34A or similar)
  - Warning:  Amber/Orange (#F59E0B or similar)
  - Error:    Red (#DC2626 or similar)
  - Info:     Blue (#2563EB or similar)
```

#### WCAG Contrast Requirements
| Element | AA Minimum | AAA Minimum |
|---------|-----------|-------------|
| Normal text (<18px bold / <24px) | 4.5:1 | 7:1 |
| Large text (>=18px bold / >=24px) | 3:1 | 4.5:1 |
| UI components & graphical objects | 3:1 | 3:1 |
| Focus indicators | 3:1 | 3:1 |

#### Color Checklist
- [ ] Never rely on color alone to convey information
- [ ] Pair color with icons, text, or patterns for states and alerts
- [ ] Test with color blindness simulators (protanopia, deuteranopia, tritanopia)
- [ ] Provide sufficient contrast for all interactive states (hover, focus, active, disabled)
- [ ] Use APCA (Advanced Perceptual Contrast Algorithm) for modern contrast evaluation

### 1.3 Spacing and Layout Systems (8px Grid)

#### Spacing Scale (8px Base)
| Token | Value | Use Case |
|-------|-------|----------|
| space-1 | 4px | Inline icon gaps, tight internal padding |
| space-2 | 8px | Default internal padding, compact spacing |
| space-3 | 12px | Small gaps between related items |
| space-4 | 16px | Standard padding, form field gaps |
| space-5 | 24px | Section internal padding |
| space-6 | 32px | Card padding, inter-component spacing |
| space-7 | 40px | Section gaps |
| space-8 | 48px | Large section gaps |
| space-9 | 64px | Page section separators |
| space-10 | 80px | Major layout spacing |
| space-11 | 96px | Hero/banner padding |

#### Spacing Rules Checklist
- [ ] Use 8px as the base unit (4px for fine adjustments)
- [ ] Internal spacing (padding) <= External spacing (margin) for grouped elements
- [ ] Related elements: closer together; unrelated: farther apart (Gestalt Proximity)
- [ ] Consistent padding within component variants
- [ ] Container side margins: 16px (mobile), 24-32px (tablet), 48-80px (desktop)
- [ ] Grid gutter: 16px (mobile), 24px (tablet/desktop)

### 1.4 Visual Hierarchy and Information Architecture

#### Hierarchy Tools (in order of impact)
1. **Size** - Larger elements draw attention first
2. **Color/Contrast** - High contrast elements stand out
3. **Weight** - Bold text attracts more attention
4. **Position** - Top-left (LTR) is scanned first (F/Z pattern)
5. **Whitespace** - Isolation draws focus
6. **Depth** - Elevation/shadows suggest importance

#### Checklist
- [ ] One clear primary action per screen/section
- [ ] Visual weight decreasing from primary -> secondary -> tertiary content
- [ ] F-pattern or Z-pattern layout for scanning optimization
- [ ] Adequate whitespace between hierarchy levels
- [ ] Consistent heading levels (no skipping H2 to H4)

---

## 2. Interaction Design

### 2.1 Navigation Patterns

#### Checklist
- [ ] Persistent global navigation on all pages
- [ ] Current location clearly indicated (active state, breadcrumbs)
- [ ] Maximum 7 (+/-2) top-level navigation items (Miller's Law)
- [ ] Mobile: bottom navigation for 3-5 primary actions, hamburger for secondary
- [ ] Breadcrumbs for hierarchies deeper than 2 levels
- [ ] Search accessible from all pages for content-heavy sites
- [ ] Consistent navigation position across pages (WCAG 3.2.3)
- [ ] Back button behavior matches user expectation

### 2.2 Micro-interactions and Feedback

#### Animation Timing
| Type | Duration | Use Case |
|------|----------|----------|
| Instant | 0-100ms | Button press, toggle, checkbox |
| Quick | 100-200ms | Tooltip, dropdown, color change |
| Standard | 200-300ms | Modal open/close, slide transitions |
| Emphasis | 300-500ms | Page transitions, complex animations |
| Maximum | 500ms | Loading indicators, elaborate effects |

#### Feedback Checklist
- [ ] Every user action receives visible feedback within 100ms
- [ ] Button states: default, hover, focus, active, disabled, loading
- [ ] Use easing functions (ease-out for enter, ease-in for exit)
- [ ] Respect `prefers-reduced-motion` media query
- [ ] Haptic feedback for mobile interactions where appropriate
- [ ] Sound feedback optional and disabled by default
- [ ] Progress indication for operations >1 second
- [ ] Success/error confirmation for destructive or important actions

### 2.3 Form Design Best Practices

#### Checklist
- [ ] Single-column layout (vertical scanning)
- [ ] Labels above inputs (not inline placeholder-only)
- [ ] Group related fields with fieldsets and legends
- [ ] Inline validation after field blur (not on every keystroke)
- [ ] Error messages: specific, human-readable, positioned near the field
- [ ] Error icon + red color (not color alone) for error indication
- [ ] Required field indicator (asterisk * with legend explaining it)
- [ ] Smart defaults and autofill support
- [ ] Input type matching data (email, tel, number, date)
- [ ] Submit button always enabled (show errors on submit if invalid)
- [ ] Multi-step forms: progress indicator, save state between steps
- [ ] Do not re-ask information already provided (WCAG 3.3.7 Redundant Entry)
- [ ] Break long forms into 4-7 steps maximum
- [ ] Provide clear success confirmation on completion

#### Error Message Format
```
[Icon] [Specific problem]. [How to fix it].

Example:
[!] Password must be at least 8 characters. Add 3 more characters.
```

### 2.4 Error Handling and Validation UX

#### Error Types and Responses
| Error Type | Timing | Presentation |
|------------|--------|-------------|
| Field validation | On blur / after first submit | Inline below field |
| Form submission | On submit | Summary at top + inline highlights |
| Server error | After API response | Toast/banner notification |
| Network error | On detection | Persistent banner with retry |
| 404 / Not found | On navigation | Full page with search/nav options |

#### Checklist
- [ ] Prevent errors before they occur (input masks, constraints, confirmations)
- [ ] Error summary with anchor links to each error field
- [ ] Focus first error field automatically after submit
- [ ] Errors persist until corrected (no auto-dismiss for form errors)
- [ ] Use `aria-invalid`, `aria-describedby`, and `aria-live` for screen readers
- [ ] Differentiate between client-side and server-side errors
- [ ] Provide recovery paths for all error states

### 2.5 Loading States and Skeleton Screens

#### Loading Strategy by Duration
| Duration | Strategy |
|----------|----------|
| 0-300ms | No indicator (perceived as instant) |
| 300ms-1s | Subtle indicator (spinner on button, progress bar) |
| 1-3s | Skeleton screen matching content layout |
| 3-10s | Skeleton + progress percentage or status text |
| >10s | Background processing with notification on completion |

#### Skeleton Screen Checklist
- [ ] Match the actual content layout (shapes, positions, sizes)
- [ ] Use subtle pulse/shimmer animation (not static gray blocks)
- [ ] Progressively reveal content as it loads (not all-at-once)
- [ ] Maintain page structure to prevent layout shift (CLS)
- [ ] Respect `prefers-reduced-motion` (static gray for reduced motion)
- [ ] Include aria-label="Loading" or aria-busy="true" for accessibility
- [ ] Avoid spinners for full-page content loads (use skeletons instead)

---

## 3. Accessibility (a11y) - WCAG 2.2

### 3.1 WCAG 2.2 Four Principles (POUR)

1. **Perceivable** - Information presentable in ways all users can perceive
2. **Operable** - UI components and navigation operable by all users
3. **Understandable** - Information and UI operation understandable
4. **Robust** - Content interpretable by assistive technologies

### 3.2 New in WCAG 2.2 (Published October 2023)

#### Level A (Minimum)
- **3.2.6 Consistent Help**: Help mechanisms in the same relative position on every page
- **3.3.7 Redundant Entry**: Don't ask for the same information twice in one session

#### Level AA (Standard Target)
- **2.4.11 Focus Not Obscured (Minimum)**: Focused element at least partially visible
- **2.5.7 Dragging Movements**: Provide single-pointer alternative for all drag operations
- **2.5.8 Target Size (Minimum)**: Interactive targets at least 24x24 CSS pixels (or sufficient spacing)
- **3.3.8 Accessible Authentication (Minimum)**: No cognitive function tests for login

#### Level AAA (Enhanced)
- **2.4.12 Focus Not Obscured (Enhanced)**: Focused element fully visible
- **2.4.13 Focus Appearance**: Focus indicator >= 2px, 3:1 contrast ratio
- **3.3.9 Accessible Authentication (Enhanced)**: No object recognition tests for login

### 3.3 Color Contrast Checklist
- [ ] Normal text: minimum 4.5:1 contrast ratio (AA)
- [ ] Large text (18px bold / 24px regular): minimum 3:1 (AA)
- [ ] UI components and graphical objects: minimum 3:1
- [ ] Focus indicators: minimum 3:1 contrast against adjacent colors
- [ ] Disabled elements: exempt from contrast requirements but should be distinguishable
- [ ] Test in both light and dark modes
- [ ] Verify with tools: WebAIM Contrast Checker, Stark, axe DevTools

### 3.4 Keyboard Navigation Checklist
- [ ] All interactive elements focusable via Tab key
- [ ] Logical tab order matching visual layout
- [ ] Visible focus indicator on all focusable elements (2px+ outline, 3:1 contrast)
- [ ] Focus not trapped (except in modals with Escape to close)
- [ ] Skip-to-content link as first focusable element
- [ ] Custom components support expected keyboard patterns (Arrow keys for menus, Space/Enter for buttons)
- [ ] No keyboard shortcuts conflicting with OS/browser/screen reader shortcuts
- [ ] Focus managed on route changes (focus moved to main content or heading)
- [ ] Focus returned to trigger element when modal/dialog closes

### 3.5 Screen Reader Compatibility Checklist
- [ ] Semantic HTML elements (nav, main, header, footer, section, article)
- [ ] ARIA landmarks where semantic HTML is insufficient
- [ ] All images have `alt` text (decorative: `alt=""`)
- [ ] Form inputs associated with labels (`<label for="...">` or `aria-label`)
- [ ] Error messages linked via `aria-describedby`
- [ ] Dynamic content updates use `aria-live` regions
- [ ] Tables have proper `<th>`, `scope`, and `<caption>`
- [ ] Heading hierarchy is logical (H1 > H2 > H3, no skips)
- [ ] Custom components use appropriate ARIA roles and states
- [ ] Page title reflects current content/location
- [ ] Language attribute set on `<html>` element

### 3.6 Focus Management Checklist
- [ ] Focus indicator: minimum 2 CSS pixels, 3:1 contrast (WCAG 2.4.13)
- [ ] Focus not obscured by sticky headers/footers (WCAG 2.4.11)
- [ ] Focus moves into modal on open; returns to trigger on close
- [ ] Focus moves to new content on SPA route change
- [ ] Toast/notification focus management (don't steal focus for non-critical)
- [ ] Dropdown/menu: focus trapped within while open, Arrow key navigation

---

## 4. Responsive Design

### 4.1 Breakpoint Strategy

#### Recommended Content-Based Breakpoints
| Name | Min Width | Typical Device |
|------|-----------|---------------|
| xs (mobile) | 0 | Small phones |
| sm | 640px (40rem) | Large phones |
| md | 768px (48rem) | Tablets portrait |
| lg | 1024px (64rem) | Tablets landscape / small laptops |
| xl | 1280px (80rem) | Desktops |
| 2xl | 1536px (96rem) | Large desktops |

#### Modern Approach (2025-2026)
- [ ] Use `rem`-based breakpoints for accessibility (respects user font-size preference)
- [ ] Prefer content-based breakpoints over device-specific breakpoints
- [ ] Use CSS Container Queries for component-level responsiveness
- [ ] Use `clamp()` for fluid typography and spacing
- [ ] Avoid fixed pixel widths; use relative units (%, rem, vw, vh, dvh)

### 4.2 Touch Targets and Gestures

| Standard | Minimum Touch Target |
|----------|---------------------|
| Apple HIG | 44 x 44 px |
| Google Material Design | 48 x 48 dp |
| WCAG 2.5.8 (AA) | 24 x 24 CSS px (or sufficient spacing) |

#### Checklist
- [ ] Interactive elements minimum 44x44px (48x48 recommended)
- [ ] Minimum 8px spacing between touch targets
- [ ] Tap areas extend beyond visual element if needed (padding)
- [ ] Gesture alternatives: swipe actions have button alternatives
- [ ] No hover-dependent functionality on touch devices
- [ ] Drag operations have single-pointer alternatives (WCAG 2.5.7)

### 4.3 Mobile-First Approach Checklist
- [ ] Design for smallest screen first, enhance progressively
- [ ] Core content and functionality accessible on all screen sizes
- [ ] Images: responsive (`srcset`, `sizes`, or `<picture>`)
- [ ] Fonts: fluid scaling with `clamp()`
- [ ] Inputs: native mobile keyboard types (email, tel, number)
- [ ] No horizontal scrolling on any viewport
- [ ] Test on actual devices (not just browser resize)
- [ ] Consider thumb zone for bottom-placed primary actions

---

## 5. UX Principles

### 5.1 Nielsen's 10 Usability Heuristics

| # | Heuristic | Key Checklist Item |
|---|-----------|-------------------|
| 1 | **Visibility of System Status** | System always tells user what's happening (loading, saving, error) |
| 2 | **Match Between System and Real World** | Uses familiar language, not technical jargon |
| 3 | **User Control and Freedom** | Undo/redo available; easy to exit/cancel any flow |
| 4 | **Consistency and Standards** | Same word/icon = same meaning everywhere; follows platform conventions |
| 5 | **Error Prevention** | Confirmations for destructive actions; constraints prevent invalid input |
| 6 | **Recognition Rather than Recall** | Options visible; recent items shown; no memorization required |
| 7 | **Flexibility and Efficiency of Use** | Keyboard shortcuts, customizable, accelerators for experts |
| 8 | **Aesthetic and Minimalist Design** | Only relevant information shown; no visual clutter |
| 9 | **Help Users Recover from Errors** | Plain language errors with constructive solutions |
| 10 | **Help and Documentation** | Context-sensitive help; searchable documentation |

### 5.2 Gestalt Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Proximity** | Elements close together are perceived as related | Group related form fields, navigation items |
| **Similarity** | Similar elements are perceived as belonging together | Consistent styling for same-type elements |
| **Continuity** | Eye follows lines and curves | Alignment, grid layouts, flow direction |
| **Closure** | Mind completes incomplete shapes | Icon design, progress indicators |
| **Figure/Ground** | Distinguish foreground from background | Modal overlays, card elevation, focus states |
| **Common Region** | Elements in the same bounded area are grouped | Cards, bordered sections, background colors |

### 5.3 Cognitive Laws

#### Fitts's Law
> Time to reach a target = f(distance / target size)

- [ ] Important actions: large and close to expected cursor/thumb position
- [ ] Primary buttons: larger than secondary buttons
- [ ] Edge/corner placement for desktop (infinite edge target)
- [ ] Bottom navigation for mobile (thumb-friendly zone)

#### Hick's Law
> Decision time = f(number of choices)

- [ ] Limit choices per view (5-7 options ideal)
- [ ] Use progressive disclosure for complex features
- [ ] Categorize and group options to reduce perceived complexity
- [ ] Provide smart defaults to reduce decisions
- [ ] Highlight recommended/most popular option

#### Miller's Law
> Working memory holds ~7 (+/-2) items

- [ ] Chunk information into groups of 3-5 items
- [ ] Use visual grouping (cards, sections, dividers)
- [ ] Phone numbers: format as (XXX) XXX-XXXX, not XXXXXXXXXX
- [ ] Navigation items: 5-7 maximum at top level
- [ ] Step indicators: 3-7 steps per wizard

### 5.4 Cognitive Load Reduction

#### Checklist
- [ ] One primary action per screen
- [ ] Progressive disclosure: show minimum needed, reveal depth on demand
- [ ] Sensible defaults reduce required decisions
- [ ] Consistent patterns reduce learning curve
- [ ] Clear visual hierarchy guides attention automatically
- [ ] Inline help over separate documentation
- [ ] Autosave to reduce "remember to save" burden
- [ ] Familiar UI patterns over novel inventions

---

## 6. Modern Design Patterns (2024-2026)

### 6.1 Design Tokens and Systems

#### Token Architecture (3-Layer)
```
Layer 1: Primitive Tokens (raw values)
  --color-blue-500: #3B82F6
  --font-size-16: 1rem
  --space-4: 16px

Layer 2: Semantic Tokens (meaning)
  --color-primary: var(--color-blue-500)
  --color-text-body: var(--color-gray-900)
  --color-bg-surface: var(--color-white)

Layer 3: Component Tokens (specific)
  --button-bg: var(--color-primary)
  --button-text: var(--color-white)
  --card-padding: var(--space-6)
```

#### Design Token Checklist
- [ ] Define primitive, semantic, and component token layers
- [ ] All colors referenced via semantic tokens (never hardcoded hex)
- [ ] Dark mode via semantic token remapping (not separate component styles)
- [ ] Typography tokens: font-family, size, weight, line-height, letter-spacing
- [ ] Spacing tokens following 8px grid
- [ ] Border radius tokens for consistency
- [ ] Shadow/elevation tokens for depth hierarchy
- [ ] Motion/duration tokens for consistent animations
- [ ] Token documentation with use cases and contrast ratios
- [ ] Version-controlled, synced between design and code

### 6.2 Dark Mode Best Practices

#### Color Rules
| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background (surface-0) | #FFFFFF | #121212 - #1C1C1C (NOT pure #000) |
| Background (surface-1) | #F9FAFB | #1E1E1E - #232323 |
| Background (surface-2) | #F3F4F6 | #2A2A2A - #2E2E2E |
| Text primary | #111827 (gray-900) | #E5E7EB (gray-200) |
| Text secondary | #6B7280 (gray-500) | #9CA3AF (gray-400) |
| Borders | #E5E7EB (gray-200) | #374151 (gray-700) |

#### Dark Mode Checklist
- [ ] Never use pure black (#000000) for backgrounds
- [ ] Reduce saturation of accent colors for dark mode
- [ ] Text contrast: minimum 4.5:1 (avoid excessive contrast causing eye strain)
- [ ] Provide 3 theme options: Light, Dark, System (default: System)
- [ ] Use `prefers-color-scheme` CSS media query for system detection
- [ ] Allow manual override that persists across sessions
- [ ] Shadows replaced by lighter surface elevations in dark mode
- [ ] Images: consider dark-mode variants or reduced brightness overlay
- [ ] Test with both WCAG contrast ratios and readability

### 6.3 Motion and Animation Guidelines

#### Principles
- Purposeful: every animation serves a function (feedback, orientation, delight)
- Quick: 200-500ms for most transitions
- Natural: use easing curves (ease-out for enter, ease-in for exit)
- Consistent: same type of animation for same type of action

#### Accessibility Requirements
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

#### Checklist
- [ ] All decorative animations respect `prefers-reduced-motion`
- [ ] Functional animations: reduce/simplify rather than remove for reduced-motion
- [ ] No auto-playing animations longer than 5 seconds without pause control (WCAG 2.2.2)
- [ ] No flashing content >3 flashes per second (WCAG 2.3.1)
- [ ] Parallax scrolling has reduced-motion alternative
- [ ] Page transitions: max 300ms, with content visible during transition
- [ ] Loading animations: accessible alternative text

### 6.4 AI-Assisted UI Patterns (2025-2026)

#### Emerging Patterns
- **Ambient AI**: AI as invisible layer, surfacing only when helpful
- **Progressive AI Disclosure**: Simple features first, AI capabilities revealed contextually
- **Confidence Indicators**: Show AI certainty level for generated content
- **Human-in-the-Loop**: Confirm/edit AI suggestions before applying
- **Explainable UI**: "Why did AI suggest this?" accessible to users

#### Checklist
- [ ] AI features opt-in or easily dismissable
- [ ] Clear indication when content is AI-generated
- [ ] User can always override/edit AI suggestions
- [ ] AI errors fail gracefully with manual fallback
- [ ] Privacy: transparent about data used for AI features
- [ ] Loading states specific to AI processing (not generic spinners)

---

## 7. Design System Best Practices

### 7.1 Atomic Design Methodology (2025 Evolution)

| Level | Description | Examples |
|-------|-------------|---------|
| **Tokens** | Design decisions (colors, spacing, typography) | `--color-primary`, `--space-4` |
| **Atoms** | Smallest UI elements | Button, Input, Label, Icon, Badge |
| **Molecules** | Groups of atoms functioning together | Search bar, Form field (label + input + error) |
| **Organisms** | Complex UI sections | Navigation bar, Card with content, Data table |
| **Templates** | Page-level layout structures | Dashboard layout, Settings page layout |
| **Pages** | Specific template instances with real content | User Dashboard, Settings > Profile |

#### 2025-2026 Evolution
- Design tokens as the foundational layer (replaces rigid "atom" definitions)
- Semantic naming over categorical (what it does > where it fits)
- Component variants over separate components
- Compound components for complex interactions

### 7.2 Component Documentation Checklist

Each component should document:
- [ ] **Description**: What the component is and when to use it
- [ ] **Props/API**: All configurable properties with types and defaults
- [ ] **Variants**: All visual and behavioral variants
- [ ] **States**: Default, hover, focus, active, disabled, loading, error
- [ ] **Accessibility**: ARIA attributes, keyboard behavior, screen reader behavior
- [ ] **Do/Don't**: Usage guidelines with examples
- [ ] **Responsive behavior**: How it adapts at different breakpoints
- [ ] **Dark mode**: Appearance in both themes
- [ ] **Related components**: Alternatives and composition patterns

### 7.3 Consistency and Reusability Checklist

- [ ] Single source of truth for each design decision (token)
- [ ] Component library used across all products/platforms
- [ ] Consistent naming conventions (design file = code file)
- [ ] Shared component states and interaction patterns
- [ ] Centralized icon library with consistent sizing and style
- [ ] Typography system enforced through tokens (no arbitrary sizes)
- [ ] Color system enforced through semantic tokens
- [ ] Spacing system enforced through tokens (no magic numbers)
- [ ] Regular design system audits for consistency
- [ ] Contribution guidelines for adding/modifying components

---

## 8. Master Checklist Summary

### Before Design
- [ ] Define design tokens (color, typography, spacing, motion)
- [ ] Choose type scale and spacing system (8px grid)
- [ ] Establish component naming conventions
- [ ] Define breakpoints and responsive strategy
- [ ] Plan accessibility requirements (target WCAG 2.2 AA minimum)

### During Design
- [ ] Visual hierarchy: one primary action per screen
- [ ] Typography: max 2 fonts, consistent scale, readable sizes
- [ ] Color: limited palette, semantic usage, contrast compliant
- [ ] Spacing: 8px grid, internal < external, consistent tokens
- [ ] Forms: labels above, inline validation, specific error messages
- [ ] Navigation: consistent, < 7 items, current location indicated
- [ ] Loading: skeleton screens for >1s, progress for >3s
- [ ] Dark mode: no pure black, reduced saturation, 3 theme options
- [ ] Motion: purposeful, 200-500ms, respect prefers-reduced-motion

### Accessibility Review
- [ ] Color contrast: 4.5:1 text, 3:1 UI elements
- [ ] Keyboard: all interactive elements reachable, visible focus
- [ ] Screen reader: semantic HTML, ARIA labels, live regions
- [ ] Touch: 44x44px minimum targets, 8px spacing
- [ ] Focus: not obscured, managed on route/modal changes
- [ ] Authentication: no cognitive function tests
- [ ] Redundant entry: don't re-ask information

### Before Handoff
- [ ] All states documented (default, hover, focus, active, disabled, loading, error, empty)
- [ ] Responsive variants specified
- [ ] Animation/interaction specifications included
- [ ] Accessibility annotations added
- [ ] Design tokens mapped to code variables
- [ ] Edge cases addressed (long text, empty data, error states)
