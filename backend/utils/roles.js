const ROLES = Object.freeze({
  ADMIN: 'Admin',
  PRINCIPAL: 'Principal',
  HOD: 'HOD',
  MAINTAINER: 'Maintainer',
  RECEPTIONIST: 'Receptionist',
  FACULTY: 'Faculty',
  NON_TEACHING: 'Non-Teaching',
  OFFICE_STATIONARY: 'Office_Stationary'
});

const ROLE_DASHBOARDS = Object.freeze({
  [ROLES.ADMIN]: '/admin-dashboard',
  [ROLES.PRINCIPAL]: '/principal-dashboard',
  [ROLES.HOD]: '/hod-dashboard',
  [ROLES.MAINTAINER]: '/maintainer-dashboard',
  [ROLES.FACULTY]: '/dashboard',
  [ROLES.NON_TEACHING]: '/non-teaching-dashboard',
  [ROLES.OFFICE_STATIONARY]: '/office-stationary-dashboard'
});

const ROLE_ALIASES = Object.freeze({
  admin: ROLES.ADMIN,
  principal: ROLES.PRINCIPAL,
  hod: ROLES.HOD,
  faculty: ROLES.FACULTY,
  'non-teaching': ROLES.NON_TEACHING,
  'non teaching': ROLES.NON_TEACHING,
  nonteaching: ROLES.NON_TEACHING,
  office_stationary: ROLES.OFFICE_STATIONARY,
  'office stationary': ROLES.OFFICE_STATIONARY,
  officestationary: ROLES.OFFICE_STATIONARY,
  maintainer: ROLES.MAINTAINER,
  'maintain er': ROLES.MAINTAINER,
  receptionist: ROLES.RECEPTIONIST
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
