# Implementation Plan - N+1 Log Count Badge & CSV Columns Search Filter

This implementation plan details the addition of a clickable N+1 log count badge in the latency alert banner to scroll and highlight the serialization error log panel, and the addition of a live search input in the Configure CSV Columns modal for filtering long metric lists.

## 1. Overview & Core Features

- **N+1 Log Count Badge in Banner**:
  - Display a clickable badge within `#banner-batch-eager-loading-latency` showing the total count of N+1 cascade logs (`n1LogsCount`).
  - Clicking the badge smoothly scrolls the window to `#serialization-error-log-panel` (or the serialization error log section) and triggers a focus/highlight effect.
- **Configure CSV Columns Modal Search Filter**:
  - Add a clean search input field at the top of the 'Configure CSV Columns' modal.
  - Instantly filters available metric columns as the user types by name or description.
- **CSV Column Configuration Shareable Deep-Link**:
  - Add a dedicated button (`#btn-share-csv-deep-link`) in the Configure CSV Columns modal.
  - Generates a base64-encoded URL containing active column selections, custom sequence, and active profile metadata (`#csvConfig=...`).
  - Auto-copies the link to clipboard with visual copy feedback.
  - Listens for incoming deep-link parameters on mount and hashchange to replicate configuration across developer sessions.
- **Reset Column Order Action**:
  - Add 'Reset Column Order' buttons (`#btn-reset-column-order` in the modal footer and `#btn-reset-column-order-top` in the bulk selection toolbar).
  - Restores the diagnostic column sequence to the application default order (`latency` -> `totalRecords` -> `cacheHit` -> `queryCount` -> `errorStatus` -> `flags`), clearing unintended drag-and-drop rearrangements.
  - Persists the restored default sequence to local storage and alerts user via confirmation toast.
- **Export Only N+1 Logs Action**:
  - Add 'Export Only N+1 Logs' button (`#btn-export-only-n1-logs`) in the `SerializationErrorLogPanel` header.
  - Automatically filters the log view to N+1 cascade entries and triggers a download of a specialized JSON export (`n1_cascade_logs_export_<timestamp>.json`).
  - The export includes full N+1 telemetry, summary statistics (total unbatched subqueries, average cascade latency), optimization flag context, and top N+1 query patterns.
- **Filter by Severity Header Dropdown**:
  - Add a dedicated 'Filter by Severity' dropdown (`#select-severity-filter`, wrapper `#filter-by-severity-dropdown`) in the `SerializationErrorLogPanel` header.
  - Supports toggling between 'All', 'Error', 'Anomaly', and 'Warning' severity levels with instantaneous log view filtering and synchronization with the errors tab filter state.
- **Copy Log Summary Action**:
  - Add 'Copy Summary' button (`#btn-copy-log-summary`) in the `SerializationErrorLogPanel` header.
  - Formats a concise, structured text-based summary of current logs (total N+1 counts, percentage of workload, 10-minute density/frequency, most impacted tables/components, and active engine optimization flags) and copies it to the system clipboard with visual confirmation feedback.
- **N+1 Anomaly Detected Toast Notification**:
  - Automatically triggers whenever a new 'Anomaly' severity N+1 cascade log is detected in the serialization logs stream.
  - Renders a high-visibility toast banner (`#toast-n1-anomaly`) with unbatched subquery metrics, latency impact, and audio chime.
  - Features a dedicated 'Jump to Log in Panel' button (`#btn-jump-to-n1-log`) that smoothly scrolls to the error log panel, auto-expands the matching log entry, and highlights it with an animated shake-and-glow effect.
- **Export Selected CSV & Global Shortcut (`Ctrl+Shift+E` / `Cmd+Shift+E`)**:
  - Enabled a global `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac) keyboard shortcut that triggers bulk CSV export of selected or filtered logs from `SerializationErrorLogPanel`.
  - Added dedicated 'Export Selected' buttons (`#btn-export-selected-logs` in header, `#btn-export-selected-inline` in the error stream) and row-level selection checkboxes with a 'Select All Visible' toggle.
  - Displays instant shortcut toast feedback and in-panel toast with export count confirmation.

## 2. User Experience & Visual Design

- **N+1 Log Count Badge & Breathing Pulse Animation**:
  - Styled as an interactive pill/button within the latency alert banner (`bg-rose-950/90 text-rose-200 border-rose-500/60`).
  - Displays icon (`Layers`) and active cascade count with 15-minute density histogram.
  - On log count increase, triggers a subtle 'breathing' pulse animation (`.animate-badge-breathing`) featuring smooth cubic-bezier scaling (1.0 -> 1.06 -> 1.0) and glowing rose box-shadow, alongside an animated ping dot indicator.
  - On click, executes smooth scroll (`scrollIntoView({ behavior: 'smooth' })`) to the serialization log component and triggers a shake-and-glow effect.
- **Configure CSV Columns Search Input**:
  - Search box with search icon (`Search`), placeholder `"Search metric columns..."`, and clear button (`X`).
  - Filtered list items maintain smooth transition and keyboard accessibility.
- **Share Deep-Link URL Button & Banner**:
  - Prominent button (`#btn-share-csv-deep-link`) in the modal footer with `Link2` icon and interactive feedback states.
  - Interactive deep-link banner (`#banner-csv-deep-link-url`) with read-only select-all input and quick copy button.
  - Quick share link button in the bulk toolbar (`#btn-share-csv-deep-link-top`).
  - Toast confirmation notifying developers of successful deep-link creation and replicated configurations upon loading.

## 3. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────┐
│ App.tsx State & Handlers                               │
│ - n1LogsCount calculation                              │
│ - handleScrollToSerializationLogs()                    │
│ - handleGenerateCsvDeepLink()                          │
│ - parseUrlDeepLinks() listener on hashchange / mount   │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Latency Alert Banner         │    │ Configure CSV Columns Modal  │
│ (#banner-batch-eager-loading-│    │ - Search input state         │
│  latency)                    │    │ - Filtered columns list      │
│ - Clickable N+1 logs badge   │    │ - Select / Deselect All      │
│                              │    │ - Share Deep-Link Button     │
│                              │    │ - Deep-Link Banner & URL     │
└──────────────────────────────┘    └──────────────────────────────┘
```

## 4. Verification Plan

- **Automated Verification**:
  - Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
  - Run `compile_applet` to verify successful Vite build.
- **Manual Verification**:
  - Open 'Configure CSV Columns' modal and click 'Share Deep-Link URL'.
  - Verify deep-link URL is copied to clipboard and visible in the link banner.
  - Navigate to or load the generated `#csvConfig=...` URL in the browser and verify the active CSV columns and ordering are accurately restored with a success toast notification.
