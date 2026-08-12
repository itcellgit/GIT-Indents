export const ROLES = Object.freeze({
  ADMIN: 'Admin',
  PRINCIPAL: 'Principal',
  HOD: 'HOD',
  FACILITY_PROVIDER: 'Facility Provider',
  MAINTAINER: 'Maintainer',
  RECEPTIONIST: 'Receptionist',
  FACULTY: 'Faculty',
  NON_TEACHING: 'Non-Teaching',
  OFFICE_STATIONARY: 'Office_Stationary',
  TRANSPORT: 'Transport'
});

export const ROLE_DASHBOARDS = Object.freeze({
  [ROLES.ADMIN]: '/admin-dashboard',
  [ROLES.PRINCIPAL]: '/principal-dashboard',
  [ROLES.HOD]: '/hod-dashboard',
  [ROLES.FACILITY_PROVIDER]: '/hod-dashboard',
  [ROLES.MAINTAINER]: '/maintainer-dashboard',
  [ROLES.RECEPTIONIST]: '/receptionist-dashboard',
  [ROLES.FACULTY]: '/dashboard',
  [ROLES.NON_TEACHING]: '/non-teaching-dashboard',
  [ROLES.OFFICE_STATIONARY]: '/office-stationary-dashboard',
  [ROLES.TRANSPORT]: '/transportation-dashboard'
});

export const PUBLIC_REGISTRATION_ROLES = [
  ROLES.FACULTY,
  ROLES.NON_TEACHING,
  ROLES.HOD
];

// Shared badge color per role so every "role pill" in the UI (User Manager,
// Department Manager, etc.) stays visually consistent without re-declaring
// the color mapping in each component.
export const ROLE_BADGE_STYLES = Object.freeze({
  [ROLES.ADMIN]: 'bg-purple-100 text-purple-800',
  [ROLES.PRINCIPAL]: 'bg-indigo-100 text-indigo-800',
  [ROLES.HOD]: 'bg-blue-100 text-blue-800',
  [ROLES.FACILITY_PROVIDER]: 'bg-emerald-100 text-emerald-800',
  [ROLES.NON_TEACHING]: 'bg-orange-100 text-orange-800',
  [ROLES.MAINTAINER]: 'bg-cyan-100 text-cyan-800',
  [ROLES.RECEPTIONIST]: 'bg-pink-100 text-pink-800',
  [ROLES.OFFICE_STATIONARY]: 'bg-amber-100 text-amber-800',
  [ROLES.TRANSPORT]: 'bg-teal-100 text-teal-800',
});

export const getRoleBadgeStyle = (role) => ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-800';
