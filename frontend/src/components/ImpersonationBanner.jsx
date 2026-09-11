import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Global, always-on-top bar shown ONLY while an admin is impersonating another
// user. Rendered once in App.jsx so it follows the admin across whatever
// dashboard the impersonated role lands on. The "Stop Impersonation" button is
// the single, unmistakable way back to the original admin session.
const ImpersonationBanner = () => {
  const { user, impersonation, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!impersonation?.active) return null;

  const handleStop = async () => {
    setError('');
    setBusy(true);
    try {
      await stopImpersonation();
      navigate('/admin-dashboard', { replace: true });
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(err.response?.data?.message || 'Failed to stop impersonation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-[100] bg-amber-500 text-amber-950 shadow-md no-print">
      <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="font-semibold truncate">
            Impersonating {user?.name}{user?.role ? ` (${user.role})` : ''}
          </span>
          <span className="hidden sm:inline opacity-80 truncate">
            &mdash; signed in as {impersonation.impersonator?.name || 'Administrator'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && <span className="hidden md:inline text-red-900 font-medium">{error}</span>}
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-amber-950 text-amber-50 hover:bg-amber-900 font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Stop Impersonation
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
