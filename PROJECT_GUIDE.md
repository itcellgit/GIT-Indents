# Git Maintenance System Project Guide

## Overview

Git Maintenance System is a full-stack PERN application for managing college requests and workflows. The project is split into a Node.js/Express backend with Prisma and PostgreSQL, and a React/Vite frontend with role-based dashboards.

The system currently covers:

- Authentication and password recovery
- Role-based dashboards and protected routes
- Faculty, HOD, admin, principal, maintainer, and office stationery workflows
- Stationery indent creation and review
- Notifications and profile management

## Tech Stack

### Backend

- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- Cookie-based sessions
- Multer for uploads
- Nodemailer for email flows

### Frontend

- React 18
- Vite
- React Router
- Tailwind CSS
- Axios
- Recharts
- Lucide icons
- jsPDF and xlsx for exports

## Repository Structure

### Root

- [README.md](README.md) - short top-level project summary
- [STATIONARY_MODULE.md](STATIONARY_MODULE.md) - user manual for stationery requests
- [PROJECT_GUIDE.md](PROJECT_GUIDE.md) - this document

### Backend

- [backend/server.js](backend/server.js) - Express app entry point
- [backend/package.json](backend/package.json) - backend dependencies and scripts
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) - Prisma schema
- [backend/routes/](backend/routes) - API route definitions
- [backend/controllers/](backend/controllers) - request handling logic
- [backend/middleware/](backend/middleware) - auth and upload middleware
- [backend/utils/](backend/utils) - shared helpers
- [backend/config/db.js](backend/config/db.js) - database configuration

### Frontend

- [frontend/src/App.jsx](frontend/src/App.jsx) - application routing
- [frontend/src/main.jsx](frontend/src/main.jsx) - React bootstrap
- [frontend/src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx) - auth state
- [frontend/src/components/](frontend/src/components) - reusable UI pieces
- [frontend/src/pages/](frontend/src/pages) - screens and dashboards
- [frontend/src/api/axios.js](frontend/src/api/axios.js) - API client setup

## How The App Works

### Backend Flow

The backend starts from [backend/server.js](backend/server.js), configures security middleware, enables CORS with credential support, serves uploaded files, applies rate limiting to API traffic, and mounts the route modules under `/api`.

Mounted route groups include:

- `/api/auth`
- `/api/faculty`
- `/api/admin`
- `/api/categories`
- `/api/hod`
- `/api/notifications`
- `/api/maintainer`
- `/api/stationary-indents`

### Frontend Flow

The frontend starts from [frontend/src/App.jsx](frontend/src/App.jsx), wraps the app in `AuthProvider`, and uses `ProtectedRoute` to enforce role-based access.

Important route groups include:

- Login, register, and forgot-password screens
- Faculty dashboard
- Non-teaching dashboard
- Office stationery dashboard
- Stationary indent create page
- Admin dashboard and coordinator details
- HOD dashboard
- Principal dashboard
- Maintainer dashboard
- Profile page

## Roles And Access

The application currently supports these roles:

- Admin
- Faculty
- HOD
- Principal
- Maintainer
- Non-Teaching
- Office_Stationary

Access to screens is controlled in [frontend/src/App.jsx](frontend/src/App.jsx) through role-specific protected routes.

## Main Functional Areas

### Authentication

Users can log in, register, and recover forgotten passwords. The app also supports protected navigation so users can only open pages allowed for their role.

### Dashboards

Each role has a dedicated dashboard area. These dashboards provide summaries, workflow actions, and access to the relevant administrative or request screens.

### Stationery Indents

The stationery module allows users to create a request, add multiple stationery items, edit or delete a request when allowed, and track request status. The detailed user-facing instructions for this flow are in [STATIONARY_MODULE.md](STATIONARY_MODULE.md).

### Notifications

Notification handling is centralized through dedicated routes and UI components so users can stay aware of request and workflow changes.

### Profile Management

Authenticated users can open the profile area to update or review personal account information.

## Backend Notes

The backend server:

- Reads environment variables through `dotenv`
- Serves uploaded files from the configured upload directory
- Uses `helmet` for security headers
- Uses `cors` with credential support
- Limits API request volume with `express-rate-limit`
- Parses JSON payloads and cookies

The default server entry point listens on port `5000` unless `PORT` is set in the environment.

## Frontend Notes

The frontend uses Vite for development and build output. Routing is handled by React Router, and protected screens are wrapped so unauthorized access falls back to role checks instead of exposing dashboard content directly.

## Development Setup

### Backend

1. Install dependencies inside `backend/`.
2. Configure environment variables for the database, auth, and upload settings.
3. Run Prisma generation or migrations as needed.
4. Start the server with the development script.

### Frontend

1. Install dependencies inside `frontend/`.
2. Start the Vite dev server.
3. Open the app in the browser and sign in with a valid role.

## Useful Entry Points

- [backend/server.js](backend/server.js)
- [backend/routes/authRoutes.js](backend/routes/authRoutes.js)
- [backend/routes/stationaryIndentRoutes.js](backend/routes/stationaryIndentRoutes.js)
- [frontend/src/App.jsx](frontend/src/App.jsx)
- [frontend/src/pages/StationaryIndentCreate.jsx](frontend/src/pages/StationaryIndentCreate.jsx)
- [frontend/src/components/ProtectedRoute.jsx](frontend/src/components/ProtectedRoute.jsx)

## Related Documentation

- [README.md](README.md)
- [STATIONARY_MODULE.md](STATIONARY_MODULE.md)

## Summary

This project is a role-based college workflow system with a structured Express/Prisma backend and a React/Vite frontend. Use this guide as the main high-level reference, and the stationery module manual for the detailed request workflow.