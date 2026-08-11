# Git Maintenance System

A full-stack PERN application for managing maintenance requests, faculty indents, and college IT infrastructure.

## Project Structure

- `backend/`: Node.js/Express server with PostgreSql.
- `frontend/`: React/Vite application with responsive design.

## Setup Instructions

Detailed setup instructions will be added here by the college IT team.



ALTER TABLE hall_bookings
ADD COLUMN booked_by_email VARCHAR(255) NOT NULL;


Bugs to Resolve Before Pushing to the Live Server


1)Currently, when a department staff member creates an indent, the notification **“Approval Required”** is being shown in the **Department HOD login**.
This is incorrect. The notification should be shown in the **Maintenance HOD In-Charge login**, not in the Department HOD login.


2)In the Faculty and Non-Teaching Staff login, the boxes are still showing the **“Approved by Dept HOD”** label. Kindly check and resolve this issue. Also, the statistics are not displaying correctly. Please check and fix the statistics as well.


3)in Faculty and Non-Teaching staff login,Calendar tab showing instead of that show calendar not tab.


4)In the Receptionist login, when the Receptionist approved or rejects a hall or vehicle booking, the modal does not close automatically. Kindly check and fix this issue.


5)In the Stationery Coordinator login, the **View** modal has a layout issue. When there are many items in the list, the **Close** and **Print** buttons are not visible. Please fix the modal layout properly by making the content scrollable while keeping the **Close** and **Print** buttons always visible.


6)The same modal layout issue is present in the **Office Stationery login** as well. When there are many items in the list, the **Close** and **Print** buttons are not visible. Please check and fix the modal layout properly by making the content scrollable while keeping the action buttons always visible.

Also, in the **Office Stationery login**, the **Given Date** make required feild.

