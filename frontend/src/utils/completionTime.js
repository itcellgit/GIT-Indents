// When the indent was actually completed. The backend writes a { status: 'Completed', timestamp }
// statusHistory row at the moment the Maintainer completes the work; updatedAt is NOT reliable
// because a completed indent can still be edited later (remarks etc.), which bumps updatedAt.
// Falls back to updatedAt only for old indents that pre-date the history row.
export const getCompletedAt = (complaint) => {
  if (complaint.status !== 'Completed') return null;
  const history = Array.isArray(complaint.statusHistory) ? complaint.statusHistory : [];
  const completedEntries = history.filter((h) => h.status === 'Completed' && h.timestamp);
  const last = completedEntries[completedEntries.length - 1];
  return new Date(last ? last.timestamp : complaint.updatedAt);
};

// Turnaround time in hours: raised (createdAt) -> completed. Includes approval wait time.
export const getCompletionHours = (complaint) => {
  const end = getCompletedAt(complaint);
  if (!end) return null;
  const diffTime = end - new Date(complaint.createdAt);
  if (Number.isNaN(diffTime) || diffTime < 0) return null; // bad/missing dates: exclude rather than guess
  return diffTime / (1000 * 60 * 60);
};

// Picks the largest sensible unit instead of mixing days+hours (e.g. avoids "1 Day (0.8 hrs)" for a 48-minute job).
export const formatDuration = (hours) => {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} Days`;
};

// Average over the Completed indents in the list; hours is null when none are completed.
export const getAverageCompletion = (complaints) => {
  const completionHours = complaints.map(getCompletionHours).filter((h) => h !== null);
  const hours = completionHours.length > 0
    ? completionHours.reduce((sum, h) => sum + h, 0) / completionHours.length
    : null;
  return { hours, count: completionHours.length };
};
