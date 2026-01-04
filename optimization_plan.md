# Frontend Optimization Plan

## Completed Improvements

### 1. Performance
- **Virtual Scrolling:** Implemented `react-virtuoso` in `MessageList.tsx`. This replaces the standard `.map()` rendering.
    - **Benefit:** Only renders visible messages + a small buffer. Handles 10,000+ messages without DOM bloat.
    - **Feature:** Auto-scrolling to bottom (stickiness) is handled efficiently.
- **Component Splitting:** Refactored `ChatWindow.tsx` (originally ~1200 lines) into:
    - `ChatHeader.tsx` (Memoized)
    - `ChatInput.tsx` (Memoized)
    - `MessageList.tsx` (Memoized, Virtualized)
    - `MessageItem.tsx` (Memoized)
- **Lazy Loading:** `ImageModal` is now lazy-loaded using `React.lazy` and `Suspense`, reducing the initial bundle size loaded for the chat view.
- **Memoization:** Extensive use of `React.memo` and `useCallback` to prevent unnecessary re-renders of the Input and Header when messages update.

### 2. UI/UX
- **Smoothness:** Removed jank caused by heavy rendering.
- **Feedback:** "Send" button state transitions and loading spinners are clearer.
- **Structure:** Cleaned up the layout logic for mobile/desktop split.

### 3. Accessibility (A11y)
- **Labels:** Added `aria-label` to all icon-only buttons (Send, Attach, Call, Back, Options).
- **Semantics:** Improved structure of the message list.

### 4. Mobile Experience
- **Keyboard Handling:** Refined the logic for `keyboardHeight` and `visualViewport` to adjust padding dynamically, preventing content from being hidden behind the keyboard on iOS.
- **Touch Targets:** Ensured buttons have appropriate spacing.

---

## Future Improvements (Medium/Long Term)

1.  **Network & Caching (Service Worker):**
    -   Implement a Service Worker to cache image attachments and standard assets for offline viewing.
    -   Use `TanStack Query` (React Query) more aggressively for caching conversation lists and message history, rather than just bespoke `useEffect` calls.

2.  **Advanced Image Handling:**
    -   Implement `blurhash` for images to show a blurry placeholder immediately while the full image loads.
    -   Optimize the backend to serve multiple image sizes (thumbnail vs full).

3.  **Search Functionality:**
    -   Add client-side search within the loaded messages.
    -   Add server-side search API integration for history search.

4.  **Testing:**
    -   Add Unit Tests (Jest/Vitest) for `ChatInput` logic (state updates, file selection).
    -   Add E2E Tests (Playwright) for the critical "Send Message" flow.

## Component Usage Guide

### `MessageList`
Usage:
```tsx
<MessageList
  messages={messages}
  isLoading={false}
  onImageClick={handleImageClick}
  // ... other handlers
/>
```
**Note:** The parent container of `MessageList` **must** have a defined height (e.g., `flex-1`, `h-full`) for virtualization to work.

### `ChatInput`
Handles text input, file selection (drag & drop logic remains in parent `ChatWindow` for full-screen drop, but input specific logic is here), and sticker toggling.
