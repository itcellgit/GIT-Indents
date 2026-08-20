const prisma = require('../prismaClient');
const nodemailer = require('nodemailer');
const { ROLES } = require('./roles');

// Setup Nodemailer transporter
// It uses environment variables that the user will configure in .env
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'gmail',
  auth: {
    user: process.env.SMTP_USER, // e.g. your_email@gmail.com
    pass: process.env.SMTP_PASS, // e.g. your_app_password
  },
});

// Email bodies interpolate user-controlled data (registered names, booking
// purposes/remarks, rejection reasons, ...). Without escaping, a malicious
// value (e.g. a registration name containing an <img onerror=...> tag) would
// render as live HTML in every recipient's inbox — see TECHNICAL_AUDIT_REPORT.md 6.3.
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// `message` is intentionally exempt from escaping here: every caller builds it
// as pre-formatted HTML (<br>, <strong> for layout). Callers are responsible for
// escaping any user-controlled substring *before* splicing it into `message` —
// use the exported `escapeHtml` above at that point, not here.
// `en-GB` gives day-first ordering ("19 Aug 2026") to match the rest of the
// system's date display, rather than the US-style month-first default.
const formatEmailDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatEmailTime = (value) => {
  if (!value) return 'N/A';
  // Plain "HH:MM[:SS]" strings (Postgres TIME columns) aren't valid Date
  // input on their own, so anchor them to an arbitrary date first.
  const date = /^\d{1,2}:\d{2}/.test(String(value)) ? new Date(`2000-01-01T${value}`) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
};

const formatEmailDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return `${formatEmailDate(date)}, ${formatEmailTime(date)}`;
};

const buildMailTemplate = ({ title, recipientName, message, actionUrl, label, footerNote, portalName }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${escapeHtml(portalName || 'Indents Management Portal')}</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">${escapeHtml(title)}</h2>
      ${label ? `<p style="display: inline-block; background-color: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: bold; margin-bottom: 16px;">${escapeHtml(label)}</p>` : ''}
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        ${recipientName ? `Dear ${escapeHtml(recipientName)},` : 'Hello,'}
        <br><br>
        ${message}
      </p>
    </div>
    <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">${escapeHtml(footerNote || 'This is an automated notification. Please do not reply to this email.')}</p>
    </div>
  </div>
`;

const sendEmailSafely = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !to) {
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Indents Management System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error('Email delivery failed:', error.message);
    return false;
  }
};

const getUsersByRole = async (roleName) => {
  return prisma.$queryRawUnsafe(
    `SELECT
       u.id,
       u.name,
       u.email
     FROM "User" u
     INNER JOIN public.user_roles ur ON ur.user_id = u.id
     INNER JOIN public.roles r ON r.id = ur.role_id
     WHERE r.role_name = $1
       AND u."isActive" = true
     ORDER BY u.name ASC`,
    roleName
  );
};

/**
 * Creates an in-app notification and sends an email to the user.
 * 
 * @param {string} recipientId - The ID of the user to notify
 * @param {string} message - The body of the notification
 * @param {string} [senderId] - Optional ID of the user who triggered the notification
 * @param {string} [indentId] - Optional associated indent/complaint ID
 * @param {string} [indentNumber] - Optional indent number to display in email
 */
const sendNotification = async (recipientId, message, senderId = null, indentId = null, indentNumber = null) => {
  try {
    // 1. Create In-App Notification
    const notificationData = {
      recipientId,
      message,
    };
    if (senderId) notificationData.senderId = senderId;
    if (indentId) notificationData.indentId = indentId;

    const notification = await prisma.notification.create({
      data: notificationData
    });

    // 2. Fetch User to get their Email
    const user = await prisma.user.findUnique({
      where: { id: recipientId }
    });

    if (user && user.email) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const actionUrl = indentId ? `${frontendUrl}/?indentId=${indentId}` : frontendUrl;
      const emailTitle = 'New Notification from Indents Management Portal';
      const emailTemplate = buildMailTemplate({
        title: emailTitle,
        recipientName: user.name,
        message,
        actionUrl,
        label: indentNumber ? `Indent #${indentNumber}` : '',
      });

      await sendEmailSafely({
        to: user.email,
        subject: `Indents Management Portal Notification ${indentNumber ? '- Indent #' + indentNumber : ''}`,
        html: emailTemplate,
      });
    }

    return notification;
  } catch (error) {
    console.error('sendNotification error:', error);
    return null;
  }
};

const sendRoleNotification = async ({
  roleName,
  message,
  title,
  subject,
  actionUrl,
  label,
  senderId = null,
  indentId = null,
  portalName,
}) => {
  try {
    const recipients = await getUsersByRole(roleName);

    if (!recipients.length) {
      return { success: true, recipients: 0, notifications: [] };
    }

    const notifications = [];
    const emailTitle = title || 'New Notification from Indents Management Portal';

    for (const recipient of recipients) {
      try {
        const notificationData = {
          recipientId: recipient.id,
          message,
        };

        if (senderId) notificationData.senderId = senderId;
        if (indentId) notificationData.indentId = indentId;

        const notification = await prisma.notification.create({ data: notificationData });
        notifications.push(notification);

        const html = buildMailTemplate({
          title: emailTitle,
          recipientName: recipient.name,
          message,
          actionUrl,
          label,
          portalName,
        });

        await sendEmailSafely({
          to: recipient.email,
          subject,
          html,
        });
      } catch (error) {
        console.error(`Failed to notify recipient ${recipient.id}:`, error.message);
      }
    }

    return { success: true, recipients: recipients.length, notifications };
  } catch (error) {
    console.error('Role notification failed:', error.message);
    return { success: false, recipients: 0, notifications: [] };
  }
};

const sendEmailNotificationToRecipients = async ({
  recipients = [],
  message,
  title,
  subject,
  actionUrl,
  label,
  portalName,
  recipientName,
}) => {
  try {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return { success: true, recipients: 0 };
    }

    const normalizedRecipients = recipients
      .map((recipient) => String(recipient || '').trim())
      .filter(Boolean);

    if (normalizedRecipients.length === 0) {
      return { success: true, recipients: 0 };
    }

    const emailTitle = title || 'New Notification from Indents Management Portal';
    let sentCount = 0;
    let failedCount = 0;

    for (const recipientEmail of normalizedRecipients) {
      const html = buildMailTemplate({
        title: emailTitle,
        recipientName,
        message,
        actionUrl,
        label,
        portalName,
      });

      const delivered = await sendEmailSafely({
        to: recipientEmail,
        subject,
        html,
      });

      if (delivered) {
        sentCount += 1;
      } else {
        failedCount += 1;
        console.error(`Email not delivered to ${recipientEmail}`);
      }
    }

    if (failedCount > 0) {
      console.error(`Email delivery summary: sent=${sentCount}, failed=${failedCount}`);
    }

    return { success: failedCount === 0, recipients: normalizedRecipients.length, sentCount, failedCount };
  } catch (error) {
    console.error('Recipient email notification failed:', error.message);
    return { success: false, recipients: 0, sentCount: 0, failedCount: 0 };
  }
};

module.exports = {
  sendNotification,
  sendRoleNotification,
  sendEmailNotificationToRecipients,
  escapeHtml,
  formatEmailDate,
  formatEmailTime,
  formatEmailDateTime,
  ROLES,
};
