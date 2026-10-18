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
- **'Sync Scroll' Toggle**:
  - Added 'Sync Scroll' toggle button (`#btn-toggle-sync-scroll`) in the `SerializationErrorLogPanel` header.
  - When active (ON), automatically locks the vertical scroll position of the log container to the most recently added entry, ensuring developers never miss new N+1 events.
- **Export Profile Saved Toast Confirmation**:
  - Added an in-modal success toast notification banner (`#toast-csv-profile-saved`) that appears instantly after successfully saving a new Export Configuration Profile in the Configure CSV Columns modal.
  - Displays the saved profile name and included column count with auto-dismiss and manual dismiss controls.
- **CSV Columns 'Matches found: X' Search Count Label**:
  - Updated the Configure CSV Columns modal search input to display a dynamic `'Matches found: X' of Y` count label directly below the search bar, reflecting currently matching columns in real time.
- **'Show Hidden' Toggle**:
  - Added a 'Show Hidden' toggle button (`#btn-toggle-show-hidden-csv`) in the Configure CSV Columns modal toolbar that filters the view to show only previously deselected (hidden) columns, enabling quick re-adding of hidden metrics.
- **Column Hover-able Tooltips (N+1 Relevance Explanations)**:
  - Added a hover-able info tooltip (`Info` icon with floating description card) for each column item in the Configure CSV Columns modal.
  - Explains the underlying database metric and provides detailed context on why it is relevant to N+1 query cascade bottleneck analysis.
- **SerializationErrorLogPanel Search Bar**:
  - Added a search input (`#input-search-error-logs`) to the `SerializationErrorLogPanel` header.
  - Allows developers to filter audit log entries by component name, table name, error message text, or cause description in real time.
- **CSV 'Preview Export' Structure Area**:
  - Added a 'Preview Export' area (`#preview-export-csv-section`) to the Configure CSV Columns modal.
  - Displays a static 3-row sample table showing exactly how the exported CSV structure and column headers appear in real time with the current column selection and order.
- **Alt+Up/Down Keyboard Shortcuts for Column Reordering**:
  - Added `Alt+Up` and `Alt+Down` keyboard shortcut listeners to focusable column items in the Configure CSV Columns modal, allowing users to reorder columns instantly without relying on the drag-and-drop mouse interface.
- **Modal Footer Progress Indicator**:
  - Added a progress-style indicator bar (`#progress-csv-columns`) in the Configure CSV Columns modal footer that dynamically fills based on the ratio of currently selected columns to the total available columns.
- **Shortcuts Modal 'Overview' Tab**:
  - Created an 'Overview' tab in the Keyboard Shortcuts modal that visually groups keyboard shortcuts by functionality into categorized sections ('Optimization Toggles', 'Navigation & Global Actions', 'Exporting & Reporting') for effortless scanning.
- **Profile Comparison Diff View**:
  - Added a 'Compare Profile' button (`#btn-compare-profile-builtin`) to the Configure CSV Columns modal profile section.
  - Displays a detailed diff modal (`#modal-compare-profile-diff`) showing shared active columns, custom/added columns, and missing columns relative to the built-in 'Full Diagnostics' profile.
- **Banner 'Simulate N+1 Event' Button**:
  - Added a 'Simulate N+1 Event' button (`#btn-simulate-n1-event-badge`) next to the N+1 log badge in the top status banner.
  - Manually triggers a new N+1 query cascade log entry for testing telemetry, sparklines, and badge breathing pulse animations.
- **CSV Columns Auto-Save Mechanism**:
  - Implemented persistent `useEffect` auto-save hooks in `App.tsx` that instantly synchronize `selectedCsvMetrics` and `csvColumnOrder` to `localStorage` immediately upon any user modification (selection, drag-and-drop, reordering, profile application, or resetting).
- **Primary 'Export CSV Now' Modal Button**:
  - Added a primary 'Export CSV Now' button (`#btn-export-csv-now`) to the `#modal-configure-csv-columns` footer.
  - Directly triggers CSV download serialization adhering to the ordered column configuration without requiring users to navigate away or close the modal.
- **Export Configuration Profiles Breakdown Info Tooltips**:
  - Added small info icons (`<Info>`) next to profile names in both the active dropdown selector, custom Profiles Menu dropdown, and quick-switch profile badges (`#btn-profile-info-badge-${p.id}`, `#btn-dropdown-profile-info-${p.id}`, and `#btn-profile-info-${activeProf.id}`).
  - Hovering displays an accessible tooltip card with the full breakdown of included columns for that profile.
- **'Copy Profile JSON' Modal Button**:
  - Added a dedicated 'Copy Profile JSON' button (`#btn-copy-profile-json`) in the `#modal-configure-csv-columns` footer.
  - Serializes active profile name, selected columns list, ordered sequence, and timestamp into a formatted JSON string, writing it directly to the clipboard with real-time visual feedback ("Profile JSON Copied!").
- **'Export as JSON' Download Button**:
  - Added an 'Export as JSON' button (`#btn-export-profile-json`) in the `#modal-configure-csv-columns` footer.
  - Serializes current profile metadata, selected columns, ordered sequence, and column definitions into a downloadable JSON file (`csv_profile_<name>_<timestamp>.json`), complementing clipboard sharing with file-based persistence.
- **'Restore Default Columns' Modal Button**:
  - Added a 'Restore Default Columns' button (`#btn-restore-default-columns`) in the `#modal-configure-csv-columns` footer.
  - Immediately restores both `csvColumnOrder` and `selectedCsvMetrics` back to the application's initial default configuration (`DEFAULT_CSV_COLUMNS`), persists changes to `localStorage`, and displays a toast notification.

## 2. User Experience & Visual Design

- **N+1 Log Count Badge & Breathing Pulse Animation**:
  - Styled as an interactive pill/button within the latency alert banner (`bg-rose-950/90 text-rose-200 border-rose-500/60`).
  - Displays icon (`Layers`) and active cascade count with 15-minute density histogram.
  - On log count increase, triggers a subtle 'breathing' pulse animation (`.animate-badge-breathing`) featuring smooth cubic-bezier scaling (1.0 -> 1.06 -> 1.0) and glowing rose box-shadow, alongside an animated ping dot indicator.
  - On click, executes smooth scroll (`scrollIntoView({ behavior: 'smooth' })`) to the serialization log component and triggers a shake-and-glow effect.
- **Configure CSV Columns Search Input & Shortcuts Discovery**:
  - Prominent search box with 2px solid border (`border-2 border-zinc-700`), hover accentuation, and indigo glow focus state (`focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30`).
  - Search icon (`Search`), placeholder `"Search metric columns (e.g. latency, cache, records)..."`, and clear button (`#btn-clear-csv-search-icon`) with `X` icon inside the input field to immediately reset `csvColumnsSearchQuery`.
  - In-place helper text and tooltip (`#helper-csv-reorder-shortcut`) below the input informing users: "Tip: Use Alt+Up/Down to reorder columns in the list."
- **Configure CSV Columns Row Highlight Transitions**:
  - Applied subtle `transition-all duration-300 ease-in-out` animation to reorderable column row containers, enabling smooth background highlight shifts between neutral dark zinc (`bg-zinc-950/50`) and glowing indigo (`bg-indigo-950/60 border-indigo-500/60`) upon toggling.
  - Added micro-interaction scale and focus transitions to individual checkboxes (`transition-all duration-300 ease-in-out hover:scale-110 active:scale-95 focus:ring-2 focus:ring-indigo-500/40`) and labels.
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
