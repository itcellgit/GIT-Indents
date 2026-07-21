const prisma = require('../prismaClient');
const nodemailer = require('nodemailer');

// Setup Nodemailer transporter
// It uses environment variables that the user will configure in .env
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER, // e.g. your_email@gmail.com
    pass: process.env.SMTP_PASS, // e.g. your_app_password
  },
});

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
      // 3. Prepare Email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const actionUrl = indentId ? `${frontendUrl}/?indentId=${indentId}` : frontendUrl;
      const emailTitle = 'New Notification from Indents Management Portal';
      
      const emailTemplate = `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Indents Management Portal</h1>
            <h2 style="color: #ffffff; margin: 8px 0 0; font-size: 16px; font-weight: normal;">Kindly Ignore this email, As the software application is under testing</h2>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">${emailTitle}</h2>
            ${indentNumber ? `<p style="display: inline-block; background-color: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: bold; margin-bottom: 16px;">Indent #${indentNumber}</p>` : ''}
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Hello ${user.name},
              <br><br>
              ${message}
            </p>
            <div style="text-align: center; margin-top: 32px;">
              <a href="${actionUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;">View in Application</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      `;

      // 4. Send Email
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: `"Indents Management System" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: `Indents Management Portal Notification ${indentNumber ? '- Indent #' + indentNumber : ''}`,
          html: emailTemplate,
        });
      } else {
      }
    }

    return notification;
  } catch (error) {
    // Don't throw the error, we don't want to crash the main request if email fails
  }
};

module.exports = {
  sendNotification
};
