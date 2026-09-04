# Stationary Module User Manual

## What This Module Does

The Stationary Module lets departments request office stationery items and lets the Office_Stationary team fulfill those requests. It covers two sides of one workflow:

- **Requesting** — submit a new stationery request, review past requests, edit or delete a request before it is granted, and mark a request as received once items are handed over.
- **Processing** — Office_Stationary maintains the catalog of available stationery items and reviews incoming requests, recording a given date and a granted quantity per item.

## Who Can Use It

| Role | What they can do |
|---|---|
| **Faculty / Non-Teaching** (only if designated **Stationary Coordinator** by their HOD) | Create, view, edit, delete requests for their account (only while still Pending); mark requests as received |
| **HOD** | See every stationery request raised inside their own department and **approve or reject** it. Office_Stationary cannot grant a request until the HOD approves it. Rejection is final (a remark is required) — the coordinator must raise a fresh request. |
| **Office_Stationary** | Manage the stationery item catalog; grant HOD-approved requests from every department |

Faculty and Non-Teaching users only see the **Stationary Indent** link on their dashboard once their HOD has added them as a Stationary Coordinator (via **Manage Coordinator Staffs** on the HOD dashboard, or by Admin via **Stationary Coordinator** management). Without that designation, the link and page are not available.

## When to Use It

Use this module when you need items such as paper, registers, pens, folders, or other office stationery for departmental work.

## Main Actions

- Create a new stationery request with one or more items.
- View recent stationery requests and open one to see full details.
- Print a request as a formal indent letter addressed to the Principal.
- Edit a request — only while it is still pending and no item has been granted a quantity yet.
- Delete a request — same condition as editing.
- Mark a request as received, once Office_Stationary has recorded granted quantities.

## How to Create a Request

1. Open the Stationary Indent page (**Stationary Indent** link on the Faculty/Non-Teaching dashboard).
2. Select **Create New Request**.
3. Enter the reason for the request.
4. Add one or more stationery items, each with a quantity.
5. Submit the form.

After submission, the request appears at the top of the Recent Requests table with status **Pending** and is sent to the department HOD for approval.

## HOD Approval

The department HOD opens the **Stationary Indents** tab on their dashboard, which lists every request raised by their department's coordinators. For a Pending request the HOD selects **Review**, checks the items, and either:

- **Approve** — the request moves to **HOD Approved** and Office_Stationary can now record grant quantities.
- **Reject** — a remark is mandatory; the request moves to **HOD Rejected** and is closed. The coordinator sees the remark and must raise a new request.

Office_Stationary cannot enter grant quantities for a request that is still Pending or was Rejected.

## How to Add Multiple Items

Use the **+** button next to the Reason field to add another item row. Each row needs:

- An item selected from the stationery catalog (populated by Office_Stationary).
- A request quantity greater than 0.

Rows beyond the first can be removed individually with the minus button.

## How to View Requests

The Recent Requests table shows, per request:

- Reason
- Number of items
- Request date
- Status (Pending / Received)
- Available actions (View, and — depending on state — Edit, Delete, Mark as received)

Selecting the **eye** icon opens a details view formatted as a printable indent (addressed to "The Principal, Gogte Institute Of Technology"), listing every item and its requested quantity, plus department and date. Use the **Print** button in that view to print or save it.

## How to Edit or Delete a Request

Edit and Delete are only available while a request is still **Pending** (not yet reviewed by the HOD). Once the HOD approves or rejects it, the request can no longer be edited or deleted from this page.

1. Find the request in the Recent Requests list.
2. Select **Edit** to change the reason or item list, or **Delete** to remove the request (with a confirmation prompt).

## How to Mark a Request as Received

The **Mark as received** action appears only after Office_Stationary has entered a granted quantity for at least one item on the request. Selecting it sets the request status to **Received**.

## Office_Stationary: Processing Requests

Office_Stationary users get a dedicated dashboard (**Office Stationary Dashboard**) with two tabs:

### Stationery Master
Manage the catalog of stationery items available to requesters:
- **Add Item** — enter an item name and specification.
- **Edit** / **Delete** an existing item.
- Search the catalog by name or specification; results are paginated (10 per page).

### Processing Requests
Lists every stationery request from every department, showing reason, request date, department name, and status. Selecting **Review** on a request opens a modal where Office_Stationary:

1. Enters a **Given Date** (required) — applied to every item in the request.
2. Enters a **Grant Quantity** for each requested item (visible only while the request is still Pending).
3. Selects **Grant Request** to save.

Once a request has at least one granted quantity, the requester can mark it received from their own page; the review modal for an already-processed request shows the granted quantities read-only (no grant-quantity column).

## What You See in the Page Header

The page header includes:

- Your profile access
- Notification bell
- Change password option
- Logout option
- Back to dashboard link (requester page only)

## Request Details

Each request may show:

- Reason
- Requested item names
- Requested quantities
- Granted quantities and given date, once processed
- Request date
- Current status

## Common Status Labels

- **Pending** — waiting for the department HOD to approve or reject.
- **HOD Approved** — the HOD approved it; Office_Stationary can now grant quantities. Once any item has a granted quantity, the requester sees a **Mark as received** action while the label still reads HOD Approved until they use it.
- **HOD Rejected** — the HOD rejected it (see the HOD remark). The request is closed; raise a new one.
- **Received** — the requester has confirmed the items were handed over.

## Tips for Filling the Form

- Enter a clear reason so the request is easy to understand.
- Add only items that are actually needed.
- Make sure every item row has both an item and a quantity greater than 0.
- Review the request (use the eye icon) before submitting further changes.

## If Something Goes Wrong

If the request does not save:

- Check that the reason is filled in.
- Check that at least one item has been added with a quantity.
- Check whether the request has already been granted — if so, editing is disabled by design.
- Try refreshing the page and submitting again.

If the page still does not work, contact the system administrator or Office_Stationary team.

## Related Pages

- Stationary request screen (requester): [frontend/src/pages/StationaryIndentCreate.jsx](frontend/src/pages/StationaryIndentCreate.jsx)
- HOD approval screen: [frontend/src/pages/HODDashboard/StationaryIndents.jsx](frontend/src/pages/HODDashboard/StationaryIndents.jsx)
- Office Stationary Dashboard (processing + catalog): [frontend/src/pages/OfficeStationaryDashboard/index.jsx](frontend/src/pages/OfficeStationaryDashboard/index.jsx)
- Coordinator assignment (HOD side): [frontend/src/pages/HODDashboard/ManageCoordinatorStaffs.jsx](frontend/src/pages/HODDashboard/ManageCoordinatorStaffs.jsx)
- Coordinator assignment (Admin side): [frontend/src/pages/AdminDashboard/CoordinatorManager.jsx](frontend/src/pages/AdminDashboard/CoordinatorManager.jsx)
- Backend routes: [backend/routes/stationaryIndentRoutes.js](backend/routes/stationaryIndentRoutes.js)
- Backend controller: [backend/controllers/stationaryIndentController.js](backend/controllers/stationaryIndentController.js)
- Login screen: [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx)
- Route definitions: [frontend/src/App.jsx](frontend/src/App.jsx)

## Short Example

Example request:

- Reason: Need stationery for exam preparation
- Items: 2 registers, 10 pens, 1 file bundle

## Summary

The Stationary Module is a request-and-fulfillment workflow. A designated Stationary Coordinator (Faculty or Non-Teaching) raises a request with one or more items; Office_Stationary reviews it against their catalog, records a given date and granted quantity per item, and the requester confirms receipt to close it out.
