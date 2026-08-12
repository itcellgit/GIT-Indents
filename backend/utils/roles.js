const ROLES = Object.freeze({
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

const ROLE_DASHBOARDS = Object.freeze({
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

const ROLE_ALIASES = Object.freeze({
  admin: ROLES.ADMIN,
  principal: ROLES.PRINCIPAL,
  hod: ROLES.HOD,
  'facility provider': ROLES.FACILITY_PROVIDER,
  facilityprovider: ROLES.FACILITY_PROVIDER,
  faculty: ROLES.FACULTY,
  'non-teaching': ROLES.NON_TEACHING,
  'non teaching': ROLES.NON_TEACHING,
  nonteaching: ROLES.NON_TEACHING,
  office_stationary: ROLES.OFFICE_STATIONARY,
  'office stationary': ROLES.OFFICE_STATIONARY,
  officestationary: ROLES.OFFICE_STATIONARY,
  maintainer: ROLES.MAINTAINER,
  'maintain er': ROLES.MAINTAINER,
  receptionist: ROLES.RECEPTIONIST,
  transport: ROLES.TRANSPORT
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

const normalizeRole = (role) => {
  if (!role) return ROLES.FACULTY;
  const normalized = String(role).toLowerCase().trim();
  return ROLE_ALIASES[normalized] || ROLE_VALUES.find((value) => value.toLowerCase() === normalized) || ROLES.FACULTY;
};

module.exports = {
  ROLES,
  ROLE_VALUES,
  ROLE_DASHBOARDS,
  ROLE_ALIASES,
  normalizeRole
};
