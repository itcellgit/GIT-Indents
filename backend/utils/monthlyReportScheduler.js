const prisma = require('../prismaClient');
const { sendEmailSafely, getUsersByRole } = require('./notificationService');
const { ROLES } = require('./roles');
const {
  collectMonthlyStats,
  buildMonthlyReportHtml,
  getPreviousPeriod,
  periodKey,
} = require('./monthlyIndentReport');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
const STARTUP_DELAY_MS = 60 * 1000; // let the server settle before the first check

// Hour of day (IST) on/after which the report goes out. A server that was down
// on the 1st catches up on its next hourly check, any day of the month.
const SEND_HOUR = Number.isInteger(Number(process.env.MONTHLY_REPORT_SEND_HOUR))
  ? Number(process.env.MONTHLY_REPORT_SEND_HOUR)
  : 8;

const parseCc = () => String(process.env.MONTHLY_REPORT_CC || '')
  .split(',')
  .map((a) => a.trim())
  .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));

/**
 * Generates and emails one month's report.
 * @param {{year:number, month:number}} period - month to report on (month 0-based)
 * @param {{to?: string[]}} [options] - explicit recipients (testing); defaults to all active Principals + MONTHLY_REPORT_CC
 * @returns {Promise<{sent:number, failed:number, recipients:number}>}
 */
const sendMonthlyReport = async (period, { to } = {}) => {
  const stats = await collectMonthlyStats(period);
  const subject = `Monthly Indent Statistics — ${stats.periodLabel}`;

  const recipients = to && to.length
    ? to.map((email) => ({ email, name: null }))
    : (await getUsersByRole(ROLES.PRINCIPAL)).filter((u) => u.email);
  const cc = to && to.length ? [] : parseCc();

  let sent = 0;
  let failed = 0;
  for (const [idx, recipient] of recipients.entries()) {
    const delivered = await sendEmailSafely({
      to: recipient.email,
      // cc'd once, on the first email, rather than one copy per Principal
      cc: idx === 0 && cc.length ? cc.join(',') : undefined,
      subject,
      html: buildMonthlyReportHtml(stats, { recipientName: recipient.name }),
    });
    if (delivered) sent += 1; else failed += 1;
  }

  return { sent, failed, recipients: recipients.length };
};

// Atomically claims a period. Returns false if it was already sent, or another
// process/attempt is mid-send (a 'sending' claim older than 30 min is treated
// as a crashed attempt and can be taken over).
const claimPeriod = async (key) => {
  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO public.monthly_report_runs (period, status, claimed_at)
     VALUES ($1, 'sending', NOW())
     ON CONFLICT (period) DO UPDATE SET claimed_at = NOW()
       WHERE monthly_report_runs.status = 'sending'
         AND monthly_report_runs.claimed_at < NOW() - INTERVAL '30 minutes'
     RETURNING period`,
    key
  );
  return rows.length > 0;
};

const isEnabled = () => process.env.MONTHLY_REPORT_ENABLED !== 'false';

const checkAndSendMonthlyReport = async () => {
  try {
    // Also guards `sendMonthlyReport.js --auto` (cron), not just the in-process timer.
    if (!isEnabled()) return;
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() < SEND_HOUR) return;

    const period = getPreviousPeriod(now);
    const key = periodKey(period);
    if (!(await claimPeriod(key))) return;

    let result;
    try {
      result = await sendMonthlyReport(period);
    } catch (err) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.monthly_report_runs WHERE period = $1`, key);
      throw err;
    }

    if (result.sent > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.monthly_report_runs SET status = 'sent', recipients = $2, sent_at = NOW() WHERE period = $1`,
        key,
        result.sent
      );
      console.log(`Monthly indent report for ${key} emailed to ${result.sent} Principal(s)` +
        (result.failed ? `, ${result.failed} failed.` : '.'));
    } else {
      // Nothing delivered (SMTP not configured / down, or no active Principal):
      // release the claim so the next hourly check retries.
      await prisma.$executeRawUnsafe(`DELETE FROM public.monthly_report_runs WHERE period = $1`, key);
      console.error(`Monthly indent report for ${key} not delivered (recipients=${result.recipients}); will retry next hour.`);
    }
  } catch (err) {
    console.error('Monthly indent report check failed:', err.message);
  }
};

const startMonthlyReportScheduler = () => {
  if (!isEnabled()) {
    console.log('Monthly indent report email is disabled (MONTHLY_REPORT_ENABLED=false).');
    return;
  }
  setTimeout(checkAndSendMonthlyReport, STARTUP_DELAY_MS);
  setInterval(checkAndSendMonthlyReport, CHECK_INTERVAL_MS);
};

module.exports = { startMonthlyReportScheduler, sendMonthlyReport, checkAndSendMonthlyReport };
