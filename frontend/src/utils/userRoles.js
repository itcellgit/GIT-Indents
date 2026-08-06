// Users no longer carry a single `role` field from the API - the backend now
// returns a `roles` array (from the user_roles/roles tables) for endpoints
// like /admin/users. These helpers normalize that into a primary role string.

export const getUserRoles = (user) => {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles
      .map((role) => (typeof role === 'string' ? role : role?.roleName))
      .filter(Boolean);
  }

  return [];
};

export const getPrimaryRole = (user) => getUserRoles(user)[0] || '';
