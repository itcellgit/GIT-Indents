# User Manual — Git Maintenance & Indent Management System

This manual explains how to use the application from an end-user's point of view: how to log in, how each role's dashboard works, and how to complete common tasks such as raising a maintenance request, booking a hall/vehicle/bus, requesting stationery, or requesting library books.

For a developer-oriented architecture overview, see [PROJECT_GUIDE.md](PROJECT_GUIDE.md). For a deep dive on the stationery workflow specifically, see [STATIONARY_MODULE.md](STATIONARY_MODULE.md).

## Table of Contents

1. [Getting Started](#getting-started)
2. [Roles in the System](#roles-in-the-system)
3. [Common Screen Elements](#common-screen-elements)
4. [Maintenance Indents (Core Workflow)](#maintenance-indents-core-workflow)
5. [Hall, Vehicle, and Bus Booking](#hall-vehicle-and-bus-booking)
6. [Book Indent (Library Requests)](#book-indent-library-requests)
7. [Stationery Requests](#stationery-requests)
8. [Role-by-Role Dashboard Guide](#role-by-role-dashboard-guide)
9. [Reports and Exports](#reports-and-exports)
10. [Profile and Account Settings](#profile-and-account-settings)
11. [Troubleshooting / FAQ](#troubleshooting--faq)

---

## Getting Started

### Logging In

1. Open the application and go to the **Login** page.
2. Enter your **Email** and **Password**.
3. Use the eye icon to show/hide your password.
4. Click **Login**.

You will be taken to the dashboard for your role automatically. If you tried to open a specific page before logging in, you will be sent there instead.

### Creating an Account (Self-Registration)

Self-registration is only available for **Faculty**, **Non-Teaching**, and **HOD** roles. All other roles (Admin, Principal, Maintainer, Receptionist, Office_Stationary, Transport) must be created for you — by an Admin from **User Management**, or in the case of Maintainer, by an HOD from **Manage Maintainers**.

1. Go to the **Register** page from the "Need an account? Register here" link on Login.
2. Fill in:
   - Full Name
   - Official Email
   - Role (Faculty, Non-Teaching, or HOD)
   - Department (start typing to search)
   - Password and Confirm Password (minimum 6 characters, must match)
3. Click **Create Account**.
4. A 6-digit OTP is emailed to you. Enter it on the verification screen and click **Verify & Register**.
5. If the OTP doesn't arrive in time, wait for the 60-second countdown to finish, then click **Resend OTP**.
6. Once verified, you're redirected to Login.

### Forgot Password

1. On the Login page, click **Forgot Password?**.
2. Enter your **Email Address** and click **Request OTP**. A 6-digit OTP is emailed to you.
3. Enter the OTP and your **New Password**, then click **Reset Password**.
4. You'll see a success message and be redirected to Login automatically.

### Changing Your Password (while logged in)

1. Click the **Change Password** icon in the dashboard header (available on every page).
2. Enter your Current Password, New Password (minimum 6 characters), and Confirm New Password.
3. Click **Update Password**.

---

## Roles in the System

| Role | Typical Use |
|---|---|
| **Faculty** | Raises maintenance indents, books halls/vehicles/buses, requests library books, may create stationery requests if designated Stationary Coordinator |
| **Non-Teaching** | Same as Faculty (indents, bookings), minus library Book Indent |
| **HOD** | Approves department indents, manages the maintenance queue for departments they're in charge of, manages maintainers and Stationary Coordinator; the designated "Library HOD" also manages library branches and book indent status |
| **Admin** | Manages departments, users, roles, coordinators, branches; views system-wide indents and reports (read-only on indents) |
| **Principal** | Oversight approvals, system-wide indent visibility, reports, and user management |
| **Maintainer** | Executes assigned maintenance work, logs materials/duration, marks work complete |
| **Office_Stationary** | Manages the stationery item catalog and processes stationery requests |
| **Receptionist** | Manages hall and vehicle inventory and bookings |
| **Transport** | Manages bus inventory and bookings |

A user can be assigned more than one role. If so, a **Role Switch** option appears on the Profile page to change which role's dashboard is active.

---

## Common Screen Elements

Every dashboard shares the same header elements:

- **Notification bell** — shows a red badge with your unread notification count. Click it to see a dropdown list of unread notifications. Click **Mark all read** to clear them, or click an individual notification to jump straight to the related indent.
- **Profile / your name** — opens your [Profile page](#profile-and-account-settings).
- **Change Password icon** — opens the change-password dialog.
- **Logout** — signs you out.
- **Back to Dashboard** — on sub-pages (bookings, stationery, book indents), returns you to your main dashboard.

---

## Maintenance Indents (Core Workflow)

This is the main workflow of the system: reporting a maintenance issue or requesting new work, and tracking it through approval, assignment, and completion.

### Raising a New Indent

Available to Faculty, Non-Teaching, HOD, and Principal.

1. Click **Raise New Indent** on your dashboard.
2. Fill in the form:
   - **Maintenance Department** — the department that should handle this (dropdown)
   - **Location** — where the issue is
   - **Nature of Work** — "Maintenance/Repair" or "New Work"
   - **Description of Issue** — required, explain the problem
   - **Additional Details** — optional
   - **Attach Image** — optional, PNG/JPG/GIF up to 5MB
3. Click **Submit Indent**.

Your new indent appears in your indent list with status **Indent Created**.

### Status Flow

An indent moves through these statuses as it's processed:

```
Indent Created
   → Approved by Dept HOD  (or Rejected by Dept HOD)
   → Approved by Maintenance HOD  (or Rejected by Maintenance HOD)
   → Approved by Principal  (or Rejected by Principal, at Principal's discretion)
   → In Progress
   → Completed
```

Step by step:

1. **Department HOD review** — Your own department's HOD sees the request in their Approval Queue. They can edit details, **Approve Indent**, or **Reject Indent** (a rejection reason is required).
2. **Maintenance department review** — The HOD in charge of the target maintenance department reviews it next, and can likewise Approve or Reject (with remarks).
3. **Principal oversight** (optional stage) — The Principal can also approve/reject indents system-wide.
4. **Assignment** — Once approved, the maintenance department's HOD/Incharge either:
   - **Starts an in-house assignment**: adds worker names, an estimated duration, remarks, and an optional material usage log, then clicks **Finalize Assignment & Save** — status becomes **In Progress**; or
   - **Assigns to a Maintainer**: selects a maintainer and clicks **Confirm Assignment**.
5. **Maintainer executes the work** — The Maintainer records workers, duration, remarks, and materials used, and can **Save Progress** along the way. When done, they click **Complete Work** (optionally attaching a completion photo). This marks the work as pending HOD verification.
6. **HOD verifies and closes** — The HOD reviews the completed work log and finalizes it — status becomes **Completed**.

At each stage a notification is sent to the relevant people, and a **Status Timeline** in the Indent Details view shows every step with a timestamp. You can click the **Print** icon on any indent to print/export a formatted report of it.

### Tracking Your Indents

Your dashboard's indent table lets you:

- **Search** by ID or location
- **Filter by status** using the dropdown (All Status / Indent Created / Approved by Dept HOD / In Progress / Completed / Rejected by Dept HOD / Rejected by Maintenance HOD / Rejected by Principal)
- Click any row to open full details, including the status timeline

Summary cards above the table (Indent Created, Approved by Dept HOD, In Progress, etc.) can be clicked to quickly filter the table.

---

## Hall, Vehicle, and Bus Booking

Faculty and Non-Teaching users can book shared resources; Receptionist manages Halls and Vehicles, Transport manages Buses.

### Requesting a Booking

1. From your dashboard, click **Hall Booking**, **Vehicle Booking**, or **Bus Booking**.
2. Use the month calendar to navigate, or check the **Today** / **Tomorrow** panels (grouped by Morning/Afternoon/Evening/Night).
3. Click a date to open the booking form:
   - Resource (Hall/Vehicle/Bus) — hidden for regular users on Vehicle/Bus (it's assigned by the Receptionist/Transport team)
   - Booked By (name) and Booked By Email
   - Purpose
   - For Vehicle/Bus: Destination, Passenger Count, Booking Period (Morning / Second Half / Full Day / Custom), Start/End Time
   - Start and End Date
   - Remarks
4. Click **Save Booking**.

If two bookings for the same resource overlap in time, a **conflict alert** banner appears.

### Booking Statuses

- **PENDING** — awaiting approval
- **APPROVED** — confirmed
- **REJECTED** — declined
- **CANCELLED** — withdrawn

As a regular user, you can cancel your own pending booking, but cannot edit or delete a booking once it's Approved.

### Managing Bookings (Receptionist / Transport / Admin)

From the same page, managers additionally get:

- **Add Hall / Add Vehicle / Add Bus** — add a new resource to the inventory (with fields like Name/Number/Type and Active/Available status)
- Edit/Delete icons on each resource
- **Approve** and **Reject** icon buttons on each booking in the day list, plus full edit/delete rights regardless of status

---

## Book Indent (Library Requests)

Available to Faculty for requesting library books.

1. Go to **Book Indent** from your dashboard.
2. Click to create a new request, fill in the required book/branch details, and submit.
3. Your requests are listed on the same page; you can edit them while still pending.

The designated **Library HOD** (the HOD account for `librarian@git.edu`) sees an extra **Branches** and **Book Indents** tab on their HOD dashboard, where they:

- Manage library **Branches** (add/edit/delete)
- Review all Faculty book indents and update each one's status via a dropdown: **Pending → Approved → Ordered → Received**, or **Rejected**

---

## Stationery Requests

Full details are in [STATIONARY_MODULE.md](STATIONARY_MODULE.md). In short:

- Faculty/Non-Teaching users designated as **Stationary Coordinator**, plus HOD and Office_Stationary, can open **Stationary Indent** to create a request: enter a reason, add one or more items with quantities, and submit.
- Requests can be edited or deleted while still pending, and tracked by status (Pending / Received) from the same page.
- The **Office_Stationary** role processes these requests: reviewing each one, entering a Given Date and Grant Quantity per item, and clicking **Grant Request**. They also maintain the stationery item catalog under **Stationery Master** (Add/Edit/Delete items).

---

## Role-by-Role Dashboard Guide

### Faculty / Non-Teaching

- Summary cards: Indent Created, Approved by Dept HOD, In Progress (click to filter)
- **Your Indents** table with search and status filter
- Quick links: Hall Booking, Vehicle Booking, Bus Booking, Book Indent (Faculty only), Stationary Indent (if Stationary Coordinator)
- **Raise New Indent** button

### HOD

Tabs on the dashboard:

- **Approval Queue** — indents awaiting your decision as department HOD or maintenance incharge
- **Maintenance Queue** — indents assigned to your maintenance department, with Pending Assignment / In Progress / Completed stats
- **Raised Indents** — tracking for indents raised by your own department
- **My Raised Indents** — requests you personally raised
- **Manage Maintainers** — add a maintainer (Name/Email/Password) or remove one (they revert to Faculty)
- **Stationary Coordinator** — assign Faculty/Non-Teaching staff in your department as Stationary Coordinator (with Start/End Date and Level: Departmental/Central)
- **Branches** and **Book Indents** — Library HOD only, as described above

### Admin

Dark-themed "System Control Panel" with tabs:

- **Departments** — create/edit maintenance departments (name, description, and an assigned Incharge, searched by email)
- **Indents** — system-wide Analytics (charts) and indent table; view-only, no approve/reject actions here
- **Reports** — generate and export indent reports (see [Reports and Exports](#reports-and-exports))
- **Users** — add/edit/enable/disable users, bulk-upload users from Excel/CSV
- **Stationary Coordinator** — manage coordinators and their staff assignments
- **Role MGT** — manage the list of role names available in the system
- **Branch MGT** — manage library branches

### Principal

Tabs: **Global Queue** (system-wide, with full approve/reject/resolve actions), **Review Queue** (awaiting Principal decision), **My Raised Indents**, **System Reports**, **User Management**. Also has a **Raise Indent** button.

### Maintainer

Tabs: **Approval Queue** and **Your Tasks**, with stats for In Progress / Pending Verification / Completed. Includes an **Order Items (E-Tendering)** button linking to the college's e-tendering portal. Opening a task lets you log workers, materials, duration, and remarks, then **Save Progress** or **Complete Work**.

### Office_Stationary

Tabs: **Stationery Master** (item catalog CRUD) and **Processing Requests** (review and grant incoming stationery requests).

### Receptionist

Landing page with quick links to **Hall Bookings** and **Vehicle Bookings**, where you get full inventory and booking management (see above).

### Transport

Landing page with a quick link to **Bus Bookings**, with full bus inventory and booking management.

---

## Reports and Exports

Available to Admin (**Reports** tab) and Principal (**System Reports** tab):

1. Choose filters: Month(s), Year(s), Department(s), Status(es).
2. Click **Generate Preview** to see the matching indents in a table (Indent ID, Date, Generated By, Assigned Department, Status, Description).
3. Export the results:
   - **Excel** — downloads an `.xlsx` file
   - **PDF** — downloads a formatted landscape PDF report

User Management also offers a **Download Sample Template** for bulk user uploads, and a single indent can always be printed from its details view using the **Print** icon.

---

## Profile and Account Settings

Open **Profile** from your dashboard header.

- **Full Name** and **Email Address** — editable
- **Department** — editable via search, except for Admin and Principal accounts where it is fixed
- **Assigned Role** — read-only
- **Role Switch** — appears only if you have more than one role assigned; pick a role to switch your active dashboard
- Click **Edit Profile** to make changes, then **Save Changes** (or **Cancel** to discard)

Password changes are handled separately via the **Change Password** icon in the header, not on the Profile page itself.

---

## Troubleshooting / FAQ

**I can't submit my indent/request.**
Make sure all required fields are filled in (description, at least one item for stationery requests, etc.), and that any attached file is under the size limit. Try refreshing the page and submitting again.

**I don't see the option to raise an indent / access a page.**
Access is controlled by your role. If you believe you should have access, contact your Admin or HOD.

**I didn't receive my OTP email.**
Check your spam folder. Wait for the countdown to finish and use **Resend OTP**.

**A booking I want is already taken.**
Check the calendar for a conflict alert and choose a different time or resource, or contact the Receptionist/Transport team.

**My maintenance request seems stuck.**
Check its status and timeline in the Indent Details view — it may be waiting on Dept HOD, Maintenance HOD, or Principal approval. Contact the relevant approver if it's been pending a long time.

**Still stuck?**
Contact your system administrator.
