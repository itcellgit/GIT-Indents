const prisma = require('../prismaClient');
const { escapeHtml, formatEmailDate } = require('./notificationService');

// Builds the "previous month" indent statistics email sent to the Principal on
// the 1st of every month (see monthlyReportScheduler.js). Charts are plain HTML
// tables with inline styles rather than images/SVG/JS: Gmail strips SVG and
// scripts, and rendering PNGs server-side would need a native canvas/font
// stack on the VPS. Table bars render in every mail client with no new deps.

// Mirrors the frontend's Rejected/Completed checks (getSystemStats, Analytics).
const isRejected = (status) => String(status || '').startsWith('Rejected');
const isCompleted = (status) => status === 'Completed';
const isOpen = (status) => !isCompleted(status) && !isRejected(status);

// Status is a state, so it gets the reserved status palette (with a text label
// beside every swatch). Order keeps green and red apart for red/green CVD.
const STATUS_GROUPS = [
  { key: 'completed', label: 'Completed', color: '#0ca30c', match: isCompleted },
  { key: 'progress', label: 'Approved / In progress', color: '#2a78d6', match: (s) => isOpen(s) && s !== 'Indent Created' },
  { key: 'awaiting', label: 'Awaiting approval', color: '#fab219', match: (s) => s === 'Indent Created' },
  { key: 'rejected', label: 'Rejected', color: '#d03b3b', match: isRejected },
];

// Categorical slots 1 & 2 of the validated palette (blue, orange).
const SERIES_RAISED = '#2a78d6';
const SERIES_COMPLETED = '#eb6834';

const INK = '#0b0b0b';
const INK_2 = '#52514e';
const INK_MUTED = '#8a8984';
const GRID = '#ececea';

// ---------- period helpers (process TZ is pinned to Asia/Kolkata in server.js) ----------

const getPreviousPeriod = (now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

const parsePeriod = (value) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value || '').trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1 };
};

const periodKey = ({ year, month }) => `${year}-${String(month + 1).padStart(2, '0')}`;
const monthStart = (year, month, offset = 0) => new Date(year, month + offset, 1);
const monthLabel = (date, long = false) => date.toLocaleDateString('en-GB', { month: long ? 'long' : 'short', year: 'numeric' });
const ymKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

// Same rule as frontend/src/utils/completionTime.js: the last 'Completed'
// statusHistory row, falling back to updatedAt only for legacy indents.
const getCompletedAt = (indent) => {
  if (!isCompleted(indent.status)) return null;
  const history = indent.statusHistory || [];
  const last = history[history.length - 1];
  return new Date(last ? last.timestamp : indent.updatedAt);
};

const formatDuration = (hours) => {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
};

const countBy = (items, keyFn) => {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

// Long tails fold into "Other" rather than growing the chart indefinitely.
const topWithOther = (rows, limit) => {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1).reduce((sum, r) => sum + r.value, 0);
  return [...head, { label: `Other (${rows.length - limit + 1})`, value: rest }];
};

// Raw-SQL modules (stationery, library) are optional extras: a missing table or
// column must never stop the main report from going out.
const safeGroupCount = async (sql, params) => {
  try {
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    return rows.map((r) => ({ label: r.label || 'Unknown', value: Number(r.value) || 0 }));
  } catch (err) {
    console.error('Monthly report: optional section skipped:', err.message);
    return null;
  }
};

// ---------- data ----------

const collectMonthlyStats = async (period) => {
  const { year, month } = period;
  const start = monthStart(year, month);
  const end = monthStart(year, month, 1);
  const prevStart = monthStart(year, month, -1);
  const trendStart = monthStart(year, month, -5);

  const completedHistory = {
    where: { status: 'Completed' },
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' },
  };

  const [raisedRecent, completedRecent, openBacklog, oldestOpen] = await Promise.all([
    prisma.indent.findMany({
      where: { createdAt: { gte: trendStart, lt: end } },
      select: {
        status: true,
        createdAt: true,
        category: { select: { name: true } },
        requester: { select: { department: true } },
      },
    }),
    prisma.indent.findMany({
      where: {
        status: 'Completed',
        OR: [
          { statusHistory: { some: { status: 'Completed', timestamp: { gte: trendStart, lt: end } } } },
          { statusHistory: { none: { status: 'Completed' } }, updatedAt: { gte: trendStart, lt: end } },
        ],
      },
      select: { status: true, createdAt: true, updatedAt: true, statusHistory: completedHistory },
    }),
    prisma.indent.count({
      where: { status: { not: 'Completed' }, NOT: { status: { startsWith: 'Rejected' } } },
    }),
    prisma.indent.findMany({
      where: { createdAt: { lt: end }, status: { not: 'Completed' }, NOT: { status: { startsWith: 'Rejected' } } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: {
        indentNumber: true,
        status: true,
        createdAt: true,
        natureOfWork: true,
        category: { select: { name: true } },
        requester: { select: { department: true } },
      },
    }),
  ]);

  const inRange = (d, from, to) => d >= from && d < to;
  const raised = raisedRecent.filter((i) => inRange(i.createdAt, start, end));
  const raisedPrev = raisedRecent.filter((i) => inRange(i.createdAt, prevStart, start));

  const completions = completedRecent
    .map((i) => ({ ...i, completedAt: getCompletedAt(i) }))
    .filter((i) => i.completedAt && inRange(i.completedAt, trendStart, end));
  const completedInMonth = completions.filter((i) => inRange(i.completedAt, start, end));
  const completedPrev = completions.filter((i) => inRange(i.completedAt, prevStart, start)).length;

  const durations = completedInMonth
    .map((i) => (i.completedAt - i.createdAt) / 36e5)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const avgCompletionHours = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const statusGroups = STATUS_GROUPS.map((g) => ({
    ...g,
    value: raised.filter((i) => g.match(i.status)).length,
  }));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, idx) => ({ day: idx + 1, value: 0 }));
  raised.forEach((i) => { daily[i.createdAt.getDate() - 1].value += 1; });

  const trend = Array.from({ length: 6 }, (_, idx) => {
    const d = monthStart(year, month, idx - 5);
    return { label: monthLabel(d), key: ymKey(d), raised: 0, completed: 0 };
  });
  const trendIndex = new Map(trend.map((t) => [t.key, t]));
  raisedRecent.forEach((i) => { const t = trendIndex.get(ymKey(i.createdAt)); if (t) t.raised += 1; });
  completions.forEach((i) => { const t = trendIndex.get(ymKey(i.completedAt)); if (t) t.completed += 1; });

  const startSql = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endSql = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`;
  const [stationery, library] = await Promise.all([
    safeGroupCount(
      `SELECT COALESCE(status, 'Pending') AS label, COUNT(*)::int AS value
       FROM public.dept_stationary_indents
       WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
       GROUP BY 1 ORDER BY 2 DESC`,
      [startSql, endSql]
    ),
    safeGroupCount(
      `SELECT status AS label, COUNT(*)::int AS value
       FROM public.faculty_book_indent_forms
       WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
       GROUP BY 1 ORDER BY 2 DESC`,
      [startSql, endSql]
    ),
  ]);

  return {
    period,
    periodLabel: monthLabel(start, true),
    prevLabel: monthLabel(prevStart, true),
    totals: {
      raised: raised.length,
      raisedPrev: raisedPrev.length,
      completedInMonth: completedInMonth.length,
      completedPrev,
      openFromMonth: raised.filter((i) => isOpen(i.status)).length,
      rejectedFromMonth: raised.filter((i) => isRejected(i.status)).length,
      openBacklog,
      avgCompletionHours,
    },
    statusGroups,
    byStatus: countBy(raised, (i) => i.status || 'Unknown'),
    byCategory: topWithOther(countBy(raised, (i) => i.category?.name || 'Unassigned'), 10),
    byRequesterDept: topWithOther(countBy(raised, (i) => i.requester?.department || 'Not set'), 10),
    daily,
    trend,
    oldestOpen,
    stationery,
    library,
  };
};

// ---------- email-safe chart primitives ----------

const sectionTitle = (title, subtitle) => `
  <tr><td style="padding:28px 0 10px;">
    <div style="font-size:16px;font-weight:bold;color:${INK};">${escapeHtml(title)}</div>
    ${subtitle ? `<div style="font-size:12px;color:${INK_2};margin-top:2px;">${escapeHtml(subtitle)}</div>` : ''}
  </td></tr>`;

const emptyNote = (text) => `<div style="font-size:13px;color:${INK_MUTED};padding:12px 0;">${escapeHtml(text)}</div>`;

const deltaText = (current, previous) => {
  if (!previous) return current ? 'new this month' : 'no change';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'same as last month';
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last month (${previous})`;
};

const kpiTiles = (tiles) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin:0 -6px;">
    <tr>
      ${tiles.map((t) => `
        <td width="${Math.floor(100 / tiles.length)}%" valign="top" style="background:#f6f6f4;border-radius:10px;padding:14px 12px;">
          <div style="font-size:11px;color:${INK_2};text-transform:uppercase;letter-spacing:.4px;">${escapeHtml(t.label)}</div>
          <div style="font-size:26px;font-weight:bold;color:${INK};line-height:1.2;margin-top:4px;">${escapeHtml(t.value)}</div>
          ${t.note ? `<div style="font-size:11px;color:${INK_MUTED};margin-top:4px;">${escapeHtml(t.note)}</div>` : ''}
        </td>`).join('')}
    </tr>
  </table>`;

// Horizontal bar chart: label | bar | value. Single series, so no legend box.
const horizontalBars = (rows, color) => {
  if (!rows.length) return emptyNote('No indents in this period.');
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${rows.map((r) => {
      const pct = Math.max(r.value > 0 ? 1 : 0, Math.round((r.value / max) * 100));
      return `
      <tr>
        <td width="34%" style="font-size:12px;color:${INK_2};padding:4px 8px 4px 0;">${escapeHtml(r.label)}</td>
        <td style="padding:4px 0;">
          <table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0"><tr>
            <td height="14" style="height:14px;background:${color};border-radius:0 4px 4px 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td>
        <td width="40" align="right" style="font-size:12px;font-weight:bold;color:${INK};padding:4px 0 4px 8px;">${r.value}</td>
      </tr>`;
    }).join('')}
  </table>`;
};

// Vertical column chart. `series` = [{ name, color, field }]; each column is
// { label, ...fields }. Bars are table cells (Outlook honours td height).
const columnChart = ({ columns, series, height = 120, labelEvery = 1, valueRow = false }) => {
  const max = Math.max(1, ...columns.flatMap((c) => series.map((s) => c[s.field])));
  const bar = (value, color) => {
    const h = value > 0 ? Math.max(2, Math.round((value / max) * height)) : 0;
    return h
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td height="${h}" style="height:${h}px;background:${color};border-radius:4px 4px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
      : '';
  };
  const legend = series.length > 1 ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
      ${series.map((s) => `
        <td style="padding-right:14px;font-size:12px;color:${INK_2};">
          <span style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:2px;vertical-align:middle;"></span>
          &nbsp;${escapeHtml(s.name)}
        </td>`).join('')}
    </tr></table>` : '';

  return `
  ${legend}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${GRID};">
    <tr>
      ${columns.map((c) => `
        <td valign="bottom" height="${height}" style="height:${height}px;padding:0 1px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${series.map((s) => `<td valign="bottom" style="padding:0 1px;">${bar(c[s.field], s.color)}</td>`).join('')}
          </tr></table>
        </td>`).join('')}
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${columns.map((c, idx) => `
        <td align="center" style="font-size:10px;color:${INK_MUTED};padding-top:4px;">${idx % labelEvery === 0 || idx === columns.length - 1 ? escapeHtml(c.label) : '&nbsp;'}</td>`).join('')}
    </tr>
    ${valueRow ? `
    <tr>
      ${columns.map((c) => `
        <td align="center" style="font-size:11px;color:${INK};padding-top:2px;">${series.map((s) => c[s.field]).join(' / ')}</td>`).join('')}
    </tr>` : ''}
  </table>`;
};

// 100% stacked bar with a 2px surface gap between segments, plus a legend table
// that carries label + count + share for every segment (never colour alone).
const stackedShareBar = (groups) => {
  const total = groups.reduce((sum, g) => sum + g.value, 0);
  if (!total) return emptyNote('No indents in this period.');
  const visible = groups.filter((g) => g.value > 0);
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${visible.map((g, idx) => `
      <td width="${((g.value / total) * 100).toFixed(2)}%" height="22" style="height:22px;background:${g.color};${idx ? 'border-left:2px solid #ffffff;' : ''}${idx === 0 ? 'border-radius:4px 0 0 4px;' : ''}${idx === visible.length - 1 ? 'border-radius:0 4px 4px 0;' : ''}font-size:0;line-height:0;">&nbsp;</td>`).join('')}
  </tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
    ${groups.map((g) => `
      <tr>
        <td width="18" style="padding:3px 0;"><span style="display:inline-block;width:10px;height:10px;background:${g.color};border-radius:2px;"></span></td>
        <td style="font-size:13px;color:${INK_2};padding:3px 0;">${escapeHtml(g.label)}</td>
        <td align="right" style="font-size:13px;font-weight:bold;color:${INK};padding:3px 0;">${g.value}</td>
        <td align="right" width="60" style="font-size:12px;color:${INK_MUTED};padding:3px 0;">${Math.round((g.value / total) * 100)}%</td>
      </tr>`).join('')}
  </table>`;
};

const dataTable = (headers, rows, aligns = []) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;">
    <tr>
      ${headers.map((h, i) => `<td align="${aligns[i] || 'left'}" style="color:${INK_MUTED};font-weight:bold;padding:6px 6px 6px 0;border-bottom:1px solid ${GRID};">${escapeHtml(h)}</td>`).join('')}
    </tr>
    ${rows.map((r) => `
      <tr>
        ${r.map((cell, i) => `<td align="${aligns[i] || 'left'}" valign="top" style="color:${INK};padding:6px 6px 6px 0;border-bottom:1px solid ${GRID};">${escapeHtml(cell)}</td>`).join('')}
      </tr>`).join('')}
  </table>`;

// ---------- full email ----------

const buildMonthlyReportHtml = (stats, { recipientName } = {}) => {
  const t = stats.totals;
  const frontendUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim();
  const peakDay = stats.daily.reduce((best, d) => (d.value > best.value ? d : best), { day: null, value: 0 });
  const now = new Date();
  const daysOpen = (d) => Math.max(0, Math.floor((now - d) / 864e5));

  const otherIndentsSection = (title, rows) => {
    if (rows === null) return '';
    const total = rows.reduce((s, r) => s + r.value, 0);
    return `
      ${sectionTitle(title, `${total} raised in ${stats.periodLabel}, by current status`)}
      <tr><td>${total ? dataTable(['Status', 'Count'], rows.map((r) => [r.label, r.value]), ['left', 'right']) : emptyNote('None raised in this period.')}</td></tr>`;
  };

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Indent statistics — ${escapeHtml(stats.periodLabel)}</title></head>
<body style="margin:0;padding:0;background:#f1f1ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1ef;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#fcfcfb;border:1px solid #e2e2df;border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="background:#4f46e5;padding:22px 28px;border-radius:12px 12px 0 0;">
    <div style="color:#ffffff;font-size:20px;font-weight:bold;">Monthly Indent Statistics</div>
    <div style="color:#e0e7ff;font-size:14px;margin-top:4px;">${escapeHtml(stats.periodLabel)} · Indents Management Portal</div>
  </td></tr>
  <tr><td style="padding:8px 28px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding-top:20px;font-size:14px;color:${INK_2};line-height:1.6;">
        ${recipientName ? `Dear ${escapeHtml(recipientName)},` : 'Hello,'}<br>
        Here is the summary of maintenance indents for <strong style="color:${INK};">${escapeHtml(stats.periodLabel)}</strong>.
      </td></tr>

      <tr><td style="padding-top:18px;">
        ${kpiTiles([
          { label: 'Indents raised', value: t.raised, note: deltaText(t.raised, t.raisedPrev) },
          { label: 'Completed', value: t.completedInMonth, note: `in the month · ${deltaText(t.completedInMonth, t.completedPrev)}` },
          { label: 'Avg completion', value: formatDuration(t.avgCompletionHours), note: 'raised → completed' },
          { label: 'Open backlog', value: t.openBacklog, note: 'all months, as of today' },
        ])}
      </td></tr>

      ${sectionTitle('Status of indents raised this month', `${t.raised} raised · ${t.openFromMonth} still open · ${t.rejectedFromMonth} rejected (current status)`)}
      <tr><td>${stackedShareBar(stats.statusGroups)}</td></tr>

      ${sectionTitle('Daily indents raised', peakDay.value ? `Busiest day: ${peakDay.day} ${stats.periodLabel} (${peakDay.value} indents)` : '')}
      <tr><td>${t.raised ? columnChart({
        columns: stats.daily.map((d) => ({ label: String(d.day), value: d.value })),
        series: [{ name: 'Indents raised', color: SERIES_RAISED, field: 'value' }],
        height: 100,
        labelEvery: 5,
      }) : emptyNote('No indents raised in this period.')}</td></tr>

      ${sectionTitle('Indents by department', 'Maintenance department the indent was raised to')}
      <tr><td>${horizontalBars(stats.byCategory, SERIES_RAISED)}</td></tr>

      ${sectionTitle('Indents by requesting department', "Requester's own department")}
      <tr><td>${horizontalBars(stats.byRequesterDept, SERIES_RAISED)}</td></tr>

      ${sectionTitle('Six-month trend', 'Indents raised vs completed per month (values: raised / completed)')}
      <tr><td>${columnChart({
        columns: stats.trend,
        series: [
          { name: 'Raised', color: SERIES_RAISED, field: 'raised' },
          { name: 'Completed', color: SERIES_COMPLETED, field: 'completed' },
        ],
        height: 120,
        valueRow: true,
      })}</td></tr>

      ${sectionTitle('Detailed status breakdown', `Indents raised in ${stats.periodLabel}`)}
      <tr><td>${stats.byStatus.length ? dataTable(['Status', 'Count'], stats.byStatus.map((r) => [r.label, r.value]), ['left', 'right']) : emptyNote('No indents in this period.')}</td></tr>

      ${sectionTitle('Oldest open indents', 'Not yet completed or rejected, as of today')}
      <tr><td>${stats.oldestOpen.length ? dataTable(
        ['Indent #', 'Department', 'Raised', 'Days open', 'Status'],
        stats.oldestOpen.map((i) => [i.indentNumber || '-', i.category?.name || '-', formatEmailDate(i.createdAt), daysOpen(i.createdAt), i.status]),
        ['left', 'left', 'left', 'right', 'left']
      ) : emptyNote('No open indents. 🎉')}</td></tr>

      ${otherIndentsSection('Stationery indents', stats.stationery)}
      ${otherIndentsSection('Library book indents', stats.library)}

      ${frontendUrl ? `
      <tr><td style="padding-top:28px;">
        <a href="${escapeHtml(frontendUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 18px;border-radius:8px;">Open the portal</a>
      </td></tr>` : ''}
    </table>
  </td></tr>
  <tr><td style="background:#f6f6f4;padding:14px 28px;border-top:1px solid #e2e2df;border-radius:0 0 12px 12px;font-size:11px;color:${INK_MUTED};text-align:center;">
    Automated monthly report generated ${escapeHtml(formatEmailDate(now))}. Please do not reply to this email.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
};

module.exports = {
  collectMonthlyStats,
  buildMonthlyReportHtml,
  getPreviousPeriod,
  parsePeriod,
  periodKey,
};
