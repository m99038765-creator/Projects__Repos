# Implementation Plan - N+1 Log Count Badge & CSV Columns Search Filter

This implementation plan details the addition of a clickable N+1 log count badge in the latency alert banner to scroll and highlight the serialization error log panel, and the addition of a live search input in the Configure CSV Columns modal for filtering long metric lists.

## 1. Overview & Core Features

- **N+1 Log Count Badge in Banner**:
  - Display a clickable badge within `#banner-batch-eager-loading-latency` showing the total count of N+1 cascade logs (`n1LogsCount`).
  - Clicking the badge smoothly scrolls the window to `#serialization-error-log-panel` (or the serialization error log section) and triggers a focus/highlight effect.
- **Configure CSV Columns Modal Search Filter**:
  - Add a clean search input field at the top of the 'Configure CSV Columns' modal.
  - Instantly filters available metric columns as the user types by name or description.

## 2. User Experience & Visual Design

- **N+1 Log Count Badge**:
  - Styled as an interactive pill/button within the latency alert banner (`bg-rose-800/80 hover:bg-rose-700 text-rose-100 border border-rose-400/50`).
  - Displays icon (`Layers` or `AlertTriangle`) and label e.g., `⚡ 3 N+1 Cascade Logs`.
  - On click, executes smooth scroll (`scrollIntoView({ behavior: 'smooth' })`) to the serialization log component and flashes/highlights it.
- **Configure CSV Columns Search Input**:
  - Search box with search icon (`Search`), placeholder `"Search metric columns..."`, and clear button (`X`).
  - Filtered list items maintain smooth transition and keyboard accessibility.

## 3. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────┐
│ App.tsx State & Handlers                               │
│ - n1LogsCount calculation                              │
│ - handleScrollToSerializationLogs()                    │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Latency Alert Banner         │    │ Configure CSV Columns Modal  │
│ (#banner-batch-eager-loading-│    │ - Search input state         │
│  latency)                    │    │ - Filtered columns list      │
│ - Clickable N+1 logs badge   │    │ - Select / Deselect All      │
└──────────────────────────────┘    └──────────────────────────────┘
```

## 4. Verification Plan

- **Automated Verification**:
  - Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
  - Run `compile_applet` to verify successful Vite build.
- **Manual Verification**:
  - Verify N+1 log count badge appears in `#banner-batch-eager-loading-latency` when `n1LogsCount > 0`.
  - Click the badge and confirm smooth scroll to the Serialization Error Log Panel.
  - Open 'Configure CSV Columns' modal, type in search filter, and confirm list updates instantly.
