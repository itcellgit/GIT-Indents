-- Server-side registry for the Admin "Impersonate User" feature.
--
-- Every impersonation JWT carries a session id (`imp.sid`). `protect` looks the
-- row up on each request that presents an impersonation token and rejects the
-- token unless the session is still open and unexpired. This makes "Stop
-- Impersonation" a real, immediate server-side revocation rather than a
-- client-only discard, and also serves as the audit trail (who impersonated
-- whom, from where, when it started and ended).
--
-- Additive only: nothing in the existing auth flow reads or writes this table.
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id          UUID        PRIMARY KEY,
    admin_id    TEXT        NOT NULL,
    admin_name  TEXT,
    target_id   TEXT        NOT NULL,
    target_name TEXT,
    target_role TEXT,
    ip          TEXT,
    user_agent  TEXT,
    started_at  TIMESTAMP   NOT NULL DEFAULT now(),
    expires_at  TIMESTAMP   NOT NULL,
    ended_at    TIMESTAMP,                       -- set when the admin stops (or it is force-ended)
    end_reason  VARCHAR(20),                     -- 'stopped' | 'admin_invalid'

    CONSTRAINT fk_impersonation_sessions_admin
        FOREIGN KEY (admin_id) REFERENCES "User"(id) ON DELETE CASCADE,
    CONSTRAINT fk_impersonation_sessions_target
        FOREIGN KEY (target_id) REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin
    ON public.impersonation_sessions (admin_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_open
    ON public.impersonation_sessions (target_id) WHERE ended_at IS NULL;
