import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARDS } from '../constants/roles';

// Header control that lets a user holding more than one role switch their active
// context (dashboard + permissions) without logging out. Renders nothing for
// single-role users. Mirrors the Role Switch control on the Profile page.
const RoleSwitcher = ({ className = '' }) => {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState('');

  const assignedRoles = useMemo(() => {
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      return user.roles;
    }
    return user?.role ? [user.role] : [];
  }, [user]);

  if (assignedRoles.length < 2) {
    return null;
  }

  const handleChange = async (event) => {
    const nextRole = event.target.value;
    if (!nextRole || nextRole === user?.role) return;

    setError('');
    setIsSwitching(true);
    try {
      const updated = await switchRole(nextRole);
      if (updated?.role) {
        navigate(ROLE_DASHBOARDS[updated.role] || '/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to switch role');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className={`relative ${className}`} title="Switch active role">
      <RefreshCw className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <select
        value={user?.role || assignedRoles[0] || ''}
        onChange={handleChange}
        disabled={isSwitching}
        aria-label="Switch active role"
        className="appearance-none pl-8 pr-7 py-2 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
      >
        {assignedRoles.map((role) => (
          <option key={role} value={role}>{role}</option>
        ))}
      </select>
      {error && (
        <p className="absolute right-0 top-full mt-1 text-xs text-red-500 whitespace-nowrap">{error}</p>
      )}
    </div>
  );
};

export default RoleSwitcher;
