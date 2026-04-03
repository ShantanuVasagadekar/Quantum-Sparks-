const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

if (env.emailUser && env.emailPass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.emailUser,
      pass: env.emailPass
    }
  });
}

/**
 * Send an email using Nodemailer
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - Optional HTML body
 * @param {Array} attachments - Optional attachments array for Nodemailer
 */
async function sendEmail({ to, subject, text, html, attachments }) {
  if (!transporter) {
    console.warn('[mailer.service] Email requested but EMAIL_USER/EMAIL_PASS not configured.');
    return false;
  }
  
  try {
    const info = await transporter.sendMail({
      from: `"${env.businessName || 'Invoice Management'}" <${env.emailUser}>`,
      to,
      subject,
      text,
      html,
      attachments
    });
    console.log('[mailer.service] Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('[mailer.service] Failed to send email:', error);
    throw error;
  }
}

module.exports = {
  sendEmail
};
