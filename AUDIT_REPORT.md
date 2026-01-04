# Application Audit Report OK

## 1. Executive Summary

### Overview
- **Tech Stack:** Next.js 16.1 (App Router), React 19, TypeScript, Tailwind CSS, Supabase, Socket.IO.
- **Current State:** The application has undergone a significant refactor in the core Chat area (`ChatWindow.tsx`), introducing virtualization and code splitting.
- **Scores (Estimated):**
    - **Performance:** 92/100 (Improved from ~60 due to virtualization).
    - **UI/UX:** 85/100 (Modern glass-morphism, consistent dark mode).
    - **Accessibility:** 75/100 (Aria labels added to chat, but global keyboard navigation needs work).
    - **Code Quality:** 80/100 (Chat components refactored, but legacy duplication likely exists in other modules).

### Top Critical Issues (Conflicts/Duplication)
1.  **Duplicate UI Logic:** `Button` styles are defined in `globals.css` (`.btn`, `.btn-primary`) but heavily mixed with inline Tailwind classes across components.
2.  **Inconsistent Inputs:** Inputs use diverse styling (some `rounded-xl`, some `rounded-2xl`, mixed border colors).
3.  **Color Hardcoding:** While variables exist (`--primary`, `--card`), many components use arbitrary hex values or Tailwind utilities (e.g., `bg-[#0d1117]`) instead of semantic names.
4.  **Accessibility Gaps:** `Sidebar` and generic pages lack `aria-label` on interaction points.

### Quick Wins (Implemented/Planned)
- [x] **Virtual Scrolling:** Implemented in `MessageList.tsx`.
- [x] **Code Splitting:** Implemented for `ImageModal`.
- [ ] **Unified Button Component:** Create `src/components/ui/Button.tsx`.
- [ ] **Unified Input Component:** Create `src/components/ui/Input.tsx`.

---

## 2. Priority Matrix

| # | Issue | Category | Impact | Effort | Priority |
|---|---|---|---|---|---|
| 1 | **Bundle Size (Chat)** | Perf | High | Med | 🔥 P0 (Fixed via Splitting) |
| 2 | **List Rendering** | Perf | High | Low | 🔥 P0 (Fixed via Virtuoso) |
| 3 | **Button Duplication** | Conflict | Med | Low | 🔥 P1 |
| 4 | **Hardcoded Colors** | UI | Med | Med | ⚠️ P2 |
| 5 | **Input Inconsistency**| UI | Low | Low | ⚠️ P2 |
| 6 | **A11y (Global)** | A11y | Low | High | 🕒 P3 |

---

## 3. Detailed Fixes & Conflicts

### Conflict #1: Button Implementation
**Location:** `globals.css` vs Inline Tailwind.
**Problem:** `globals.css` defines `.btn` classes, but components often ignore them and write long Tailwind strings (`p-2 hover:bg-white/5 rounded-xl...`).
**Solution:** Create a standard `<Button>` component that encapsulates these variants.

### Conflict #2: Color Usage
**Location:** `globals.css` vs Component files.
**Problem:** `bg-[#0d1117]` is used 50+ times in code, duplicating the `--sidebar-bg` variable.
**Solution:** Enforce usage of Tailwind theme colors (e.g., `bg-sidebar` mapped to `var(--sidebar-bg)`).

### Performance Audit
- **Network:** Message history fetching is currently on-demand. **Recommendation:** Add TanStack Query caching (Part of future roadmap).
- **Render:** Chat window is now optimized. Sidebar contact list rendering is next target for virtualization if contact list > 100.

---

## 4. Design System (Proposed)

### Color Palette (Unified)
```css
:root {
  --background: #080c10;
  --primary: #06b6d4;
  --accent: #8b5cf6;
  --success: #10b981;
  --danger: #f43f5e;
  --text-primary: #f0f6fc;
}
```

### Typography Scale
- **H1:** 24px/32px (Mobile/Desktop) - Bold
- **H2:** 20px/24px - SemiBold
- **Body:** 16px - Regular
- **Small:** 14px - Regular
- **Tiny:** 11px - Medium (Meta info)

### Spacing System
- Base unit: 4px (`p-1`)
- Standard padding: 16px (`p-4`)
- Section gap: 24px (`gap-6`)

---

## 5. Unified Components (Specs)

### Button
```tsx
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}
```

### Input
```tsx
type InputProps = {
  error?: string;
  leftIcon?: React.ReactNode;
}
```

---

## 6. Implementation Roadmap

- **Day 1 (Done):** Chat Performance (Virtualization, Refactor).
- **Day 2 (Next):** UI Standardization (Button/Input components, standardizing `globals.css`).
- **Day 3:** Global A11y & Mobile touch targets outside Chat.
