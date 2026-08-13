// Minimum password strength for anywhere a real password is chosen (registration,
// password reset/change, and admin/HOD-created accounts). Deliberately NOT applied
// to the bulk-user-creation default password — that stays as-is by design.
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.';

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const isPasswordValid = (password) => typeof password === 'string' && PASSWORD_POLICY_REGEX.test(password);

module.exports = { PASSWORD_POLICY_MESSAGE, isPasswordValid };
