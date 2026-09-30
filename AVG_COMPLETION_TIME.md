# Average Completion Time

Changed 2026-09-30. Frontend only: no backend, API, or database changes.

## What it measures

**Completion time** of one indent = the time from when it was **raised** (`createdAt`) to when it was **completed** (the `Completed` entry in `statusHistory`).

**Average Completion Time** = the average of that value over all **Completed** indents in the list. Indents that are pending, in progress, or rejected are not counted.

It's the full turnaround the requester sees, so it includes the time spent waiting for approval, not just the repair work. It's calendar time, so weekends and holidays count.

## Why the logic was changed

Before, the finish time was taken from `resolvedDetails.resolvedAt`. The backend never sends that field, so the code always fell back to `updatedAt`.

`updatedAt` is the last time the indent row changed **for any reason**. A completed indent can still be edited afterwards (for example, remarks added through the HOD/Facility Provider update endpoint), and every edit moves `updatedAt` forward. Example:

| | Old logic | New logic |
|---|---|---|
| Raised 1 Sep, completed 3 Sep, remark added 21 Sep | **20 days** (wrong) | **2 days** (correct) |

The correct finish time was already stored. When the Maintainer completes the work, `maintainerController.js` writes `statusHistory: { status: 'Completed', timestamp }`. Every dashboard's list of indents already includes `statusHistory` (Admin, HOD, Principal, Faculty, Non-Teaching, Maintainer), so the fix didn't need a backend change.

**Fallback:** if an old indent has no `Completed` row in `statusHistory` (it was completed before history was recorded), `updatedAt` is still used. Indents with missing or invalid dates are left out of the average rather than guessed.

## Where it's shown

### Avg Completion Time card (in the statistics row)

| Login | Tab / section |
|---|---|
| HOD | Maintenance Queue, Department Tracking, Department Facility Providers |
| Facility Provider / Category In-charge | Maintenance Queue |
| Principal | Global Queue |
| Admin | System Overview |
| Faculty | Dashboard |
| Non-Teaching | Dashboard |
| Maintainer | Your Tasks |

- The card is averaged over the whole list, **not** the filtered table, so it keeps its value when a status card or filter is selected. (The old line above the table used the filtered rows, so clicking "In Progress" made it disappear.)
- The card is for display only; clicking it doesn't filter the table.
- Shows `-` when nothing is completed yet, with a line underneath like "based on N completed indents".
- Where the card is shown, the old "Overall Average Completion Time" line above the table is hidden. It's still shown on tabs with no stats cards (Approval Queue, HOD's My Raised Indents).

### Other places now using the same logic
- The **Avg Time Resolved** column in every indent table.
- **Actual Duration / Actual Completion Time** in the indent details popups. These used to round up to whole days with a minimum of 1 (a 2-hour job showed "1 Day"). They now use the same format as the table.

## Display format

| Duration | Shown as |
|---|---|
| under 1 hour | `45 min` |
| under 24 hours | `5.5 hrs` |
| 24 hours or more | `2.3 Days` |

## Files

**New**
- `frontend/src/utils/completionTime.js`: the only place the logic lives.
  - `getCompletedAt(indent)`: completion timestamp (`statusHistory`, falling back to `updatedAt`)
  - `getCompletionHours(indent)`: raised → completed, in hours; `null` if the indent isn't completed or its dates are invalid
  - `formatDuration(hours)`: display formatting
  - `getAverageCompletion(indents)`: returns `{ hours, count }`

**Stats cards** (new Avg Completion Time card)
- `pages/HODDashboard/StatsCards.jsx`, `pages/HODDashboard/DeptStatsCards.jsx` (HOD, Principal)
- `pages/AdminDashboard/StatsCards.jsx`: optional `avgCompletion` prop
- `pages/FacultyDashboard/StatsCards.jsx`, `pages/NonTeachingDashboard/StatsCards.jsx` (Maintainer reuses Faculty's): optional `avgCompletion` prop

**Dashboards** (compute the average from the full list and pass it to the card)
- `pages/HODDashboard/index.jsx`, `pages/PrincipalDashboard/index.jsx`, `pages/AdminDashboard/index.jsx`, `pages/FacultyDashboard/index.jsx`, `pages/NonTeachingDashboard/index.jsx`, `pages/MaintainerDashboard/index.jsx`

**Tables** (local copies of the logic removed and the shared util used instead; new `showAverageBanner` prop, default `true`)
- `pages/HODDashboard/ComplaintTable.jsx`, `pages/AdminDashboard/ComplaintTable.jsx`, `pages/FacultyDashboard/IndentTable.jsx`, `pages/NonTeachingDashboard/IndentTable.jsx`, `pages/MaintainerDashboard/MaintainerIndentTable.jsx`

**Details popups**
- `components/complaint/ComplaintDetails.jsx`, `pages/FacultyDashboard/IndentDetailsModal.jsx`, `pages/NonTeachingDashboard/IndentDetailsModal.jsx`

## Verification
- `vite build` succeeds.
- Logic checked against sample indents:
  - completed in 2 days, edited 20 days later → **2.0 Days** (the old logic gave 20)
  - old indent with no history, 2 h → **2.0 hrs** (fallback works)
  - not completed → **-**
  - average of the two above → **1.0 Days over 2 indents** (the non-completed one is excluded)
- Not yet checked in the browser for each login.

## Possible future changes
- **Measure only the work time:** start from the approval timestamp in `statusHistory` instead of `createdAt`. That's a change in one function (`getCompletionHours`).
- **Business days only:** exclude weekends and holidays.
