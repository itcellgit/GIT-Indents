# Stationary Module User Manual

## What This Module Does

The Stationary Module lets users request office stationery items from their department or role workspace. It is used to submit new stationery requests, review past requests, update a request before it is finalized, remove a request, and check whether the request has been received.

## Who Can Use It

This module is available to:

- Admin
- Faculty
- HOD
- Non-Teaching
- Office_Stationary

## When to Use It

Use this module when you need items such as paper, registers, pens, folders, or other office stationery for departmental work.

## Main Actions

- Create a new stationery request.
- Add more than one stationery item in a single request.
- View your recent stationery requests.
- Edit a request before it is completed.
- Delete a request if it is no longer needed.
- Mark a request as received after items are handed over.

## How to Create a Request

1. Open the Stationary Indent page.
2. Select **Create New Request**.
3. Enter the reason for the request.
4. Add one or more stationery items.
5. Choose each item and enter the required quantity.
6. Submit the form.

After submission, the request appears in the recent requests list.

## How to Add Multiple Items

If you need several stationery items in one request, add each item row separately.

For each row:

- Select the stationery item.
- Enter the quantity needed.
- Use the add button to insert another row if required.

## How to View Requests

The Recent Requests table shows:

- Request reason
- Number of items
- Request date
- Status
- Available actions

Select a request to open its details and review the item list.

## How to Edit a Request

1. Find the request in the Recent Requests list.
2. Select the edit action.
3. Update the reason or item list.
4. Save the changes.

Only requests that are still editable should be changed. If a request has already been processed, editing may not be available.

## How to Delete a Request

1. Find the request you no longer need.
2. Select the delete action.
3. Confirm the removal if prompted.

Deleting a request removes it from the request list.

## How to Mark a Request as Received

Once the stationery items are handed over, open the request and use the receive action.

This helps indicate that the request has been completed.

## What You See in the Page Header

The page header includes:

- Your profile access
- Notification bell
- Change password option
- Logout option
- Back to dashboard link

## Request Details

Each request may show:

- Reason
- Requested item names
- Requested quantities
- Granted quantities, if available
- Request date
- Current status

## Common Status Labels

You may see statuses such as:

- Pending
- Received

## Tips for Filling the Form

- Enter a clear reason so the request is easy to understand.
- Add only items that are actually needed.
- Make sure every item row has both an item and a quantity.
- Review the request before submitting.

## If Something Goes Wrong

If the request does not save:

- Check that the reason is filled in.
- Check that at least one item has been added.
- Check that each item has a quantity.
- Try refreshing the page and submitting again.

If the page still does not work, contact the system administrator or office stationery team.

## Related Pages

- Stationary request screen: [frontend/src/pages/StationaryIndentCreate.jsx](frontend/src/pages/StationaryIndentCreate.jsx)
- Login screen: [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx)
- Dashboard area: [frontend/src/App.jsx](frontend/src/App.jsx)

## Short Example

Example request:

- Reason: Need stationery for exam preparation
- Items: 2 registers, 10 pens, 1 file bundle

## Summary

The Stationary Module is a simple request-and-review workflow for stationery needs. Users create a request, add the required items, submit it, and later track its status from the same page.
