// Manual control for the monthly indent statistics email.
//
//   node sendMonthlyReport.js                      -> preview last month to monthly-report-YYYY-MM.html
//   node sendMonthlyReport.js 2026-10              -> preview a specific month
//   node sendMonthlyReport.js 2026-10 --to a@b.com -> send only to the given address(es) (testing)
//   node sendMonthlyReport.js --send               -> send last month to all active Principals now
//   node sendMonthlyReport.js 2026-10 --send       -> same, for a specific month
//   node sendMonthlyReport.js --auto               -> send last month only if not already sent (for cron)
//
// --send always sends (even if already sent) and then records the month in
// monthly_report_runs, so the automatic check won't send it a second time.
// --to is a test send and records nothing.
require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const fs = require('fs');
const path = require('path');
const prisma = require('./prismaClient');
const { collectMonthlyStats, buildMonthlyReportHtml, getPreviousPeriod, parsePeriod, periodKey } = require('./utils/monthlyIndentReport');
const { sendMonthlyReport, checkAndSendMonthlyReport } = require('./utils/monthlyReportScheduler');

(async () => {
  const args = process.argv.slice(2);
  if (args.includes('--auto')) {
    await checkAndSendMonthlyReport();
    return;
  }

  const monthArg = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  const period = monthArg ? parsePeriod(monthArg) : getPreviousPeriod();
  if (!period) throw new Error(`Invalid month "${monthArg}", expected YYYY-MM`);

  const toIdx = args.indexOf('--to');
  const to = toIdx >= 0 ? String(args[toIdx + 1] || '').split(',').map((a) => a.trim()).filter(Boolean) : [];

  if (args.includes('--send') || to.length) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP_USER / SMTP_PASS are not set; nothing can be sent.');
    const result = await sendMonthlyReport(period, { to });
    console.log(`Report for ${periodKey(period)}: sent=${result.sent}, failed=${result.failed}, recipients=${result.recipients}`);
    if (!to.length && result.sent > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.monthly_report_runs (period, status, recipients, sent_at)
         VALUES ($1, 'sent', $2, NOW())
         ON CONFLICT (period) DO UPDATE SET status = 'sent', recipients = EXCLUDED.recipients, sent_at = NOW()`,
        periodKey(period),
        result.sent
      );
    }
    if (result.sent === 0) process.exitCode = 1;
  } else {
    const stats = await collectMonthlyStats(period);
    const file = path.join(__dirname, `monthly-report-${periodKey(period)}.html`);
    fs.writeFileSync(file, buildMonthlyReportHtml(stats, { recipientName: 'Principal' }));
    console.log(`Preview written to ${file}`);
  }
})()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
