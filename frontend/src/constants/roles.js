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
