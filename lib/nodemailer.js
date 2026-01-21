/**
 * Nodemailer Configuration
 * Email sending utilities for notifications
 *
 * Setup instructions:
 * 1. npm install nodemailer
 * 2. Add to .env.local:
 *    EMAIL_HOST=smtp.gmail.com
 *    EMAIL_PORT=587
 *    EMAIL_USER=your-email@gmail.com
 *    EMAIL_PASSWORD=your-app-password
 *    EMAIL_FROM=NREP PMS <noreply@nrep.com>
 */

import nodemailer from 'nodemailer';

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASSWORD,
    EMAIL_FROM,
    NODE_ENV
  } = process.env;

  console.log('[Nodemailer] Configuring transporter with:', {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASSWORD: EMAIL_PASSWORD ? '****' + EMAIL_PASSWORD.slice(-4) : 'NOT SET',
    EMAIL_FROM,
    NODE_ENV
  });

  // If credentials missing, log emails instead of sending
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASSWORD) {
    console.warn('[Nodemailer] Email credentials not configured. Emails will be logged only.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT || '587'),
    secure: EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });

  return transporter;
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} Email send result
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    console.log('[Email] Preparing to send email to:', to);
    const transport = getTransporter();

    if (!transport) {
      // Log email instead of sending in development
      console.log('[Email] Would send email:', { to, subject, text: text?.substring(0, 100) });
      return { success: true, mode: 'development', messageId: 'dev-' + Date.now() };
    }

    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'NREP PMS <project@nrep.com>',
      to,
      subject,
      text,
      html,
    });

    console.log('[Email] Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    throw error;
  }
}

/**
 * Send timesheet submission notification to managers
 */
async function sendTimesheetSubmittedEmail({ to, employeeName, weekStart, totalHours, approvalUrl }) {
  const subject = `Timesheet Submitted for Approval - ${employeeName}`;

  const text = `
Hello,

${employeeName} has submitted their timesheet for the week of ${weekStart}.

Total Hours: ${totalHours}

Please review and approve this timesheet at your earliest convenience.

Review Timesheet: ${approvalUrl}

Best regards,
NREP Project Management System
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Timesheet Submitted for Approval</h2>
      <p>Hello,</p>
      <p><strong>${employeeName}</strong> has submitted their timesheet for the week of <strong>${weekStart}</strong>.</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Total Hours:</strong> ${totalHours}</p>
      </div>

      <p>Please review and approve this timesheet at your earliest convenience.</p>

      <a href="${approvalUrl}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 15px 0;">
        Review Timesheet
      </a>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Best regards,<br/>
        NREP Project Management System
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

/**
 * Send timesheet approval notification to employee
 */
async function sendTimesheetApprovedEmail({ to, employeeName, weekStart, approvedBy }) {
  const subject = `Timesheet Approved - Week of ${weekStart}`;

  const text = `
Hello ${employeeName},

Good news! Your timesheet for the week of ${weekStart} has been approved by ${approvedBy}.

You can view your approved timesheet in the system.

Best regards,
NREP Project Management System
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">Timesheet Approved</h2>
      <p>Hello ${employeeName},</p>
      <p>Good news! Your timesheet for the week of <strong>${weekStart}</strong> has been approved.</p>

      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #155724;">
          <strong>Status:</strong> Approved<br/>
          <strong>Approved By:</strong> ${approvedBy}
        </p>
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Best regards,<br/>
        NREP Project Management System
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

/**
 * Send timesheet rejection notification to employee
 */
async function sendTimesheetRejectedEmail({ to, employeeName, weekStart, rejectedBy, comments }) {
  const subject = `Timesheet Rejected - Week of ${weekStart}`;

  const text = `
Hello ${employeeName},

Your timesheet for the week of ${weekStart} has been rejected by ${rejectedBy}.

Rejection Reason:
${comments}

Please review the feedback, make the necessary corrections, and resubmit your timesheet.

Best regards,
NREP Project Management System
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">Timesheet Rejected</h2>
      <p>Hello ${employeeName},</p>
      <p>Your timesheet for the week of <strong>${weekStart}</strong> has been rejected.</p>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #721c24;">
          <strong>Rejected By:</strong> ${rejectedBy}
        </p>
        <p style="margin: 10px 0 5px 0; color: #721c24;"><strong>Feedback:</strong></p>
        <p style="margin: 5px 0; color: #721c24;">${comments}</p>
      </div>

      <p>Please review the feedback, make the necessary corrections, and resubmit your timesheet.</p>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Best regards,<br/>
        NREP Project Management System
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export {
  sendTimesheetSubmittedEmail,
  sendTimesheetApprovedEmail,
  sendTimesheetSupervisorApprovedEmail,
  sendTimesheetRejectedEmail,
  sendAccountCreatedEmail,
};

/**
 * Send supervisor approval notification to admins
 */
async function sendTimesheetSupervisorApprovedEmail({ to, employeeName, weekStart, supervisorName, approvalUrl }) {
  const subject = `Supervisor Approved: ${employeeName} - Pending Final Approval`;

  const text = `
Hello,

${employeeName}'s timesheet for the week of ${weekStart} has been approved by supervisor ${supervisorName} and is now pending your final approval.

Please review and finalize this timesheet.

Review Timesheet: ${approvalUrl}

Best regards,
NREP Project Management System
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Supervisor Approved: Pending Final Approval</h2>
      <p>Hello,</p>
      <p><strong>${employeeName}</strong>'s timesheet for the week of <strong>${weekStart}</strong> has been approved by supervisor <strong>${supervisorName}</strong>.</p>
      <p>It is now pending your final approval.</p>

      <a href="${approvalUrl}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 15px 0;">
        Review Timesheet
      </a>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Best regards,<br/>
        NREP Project Management System
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

/**
 * Send account creation notification to new user
 */
async function sendAccountCreatedEmail({ to, name, username, password, loginUrl, organizationName }) {
  const subject = `Welcome to ${organizationName || 'NREP PMS'} - Account Created`;

  const text = `
Hello ${name},

Welcome to ${organizationName || 'NREP Project Management System'}!

Your account has been successfully created. Here are your login details:

Username/Email: ${username}
Password: ${password}

You can log in at: ${loginUrl}

Please change your password after your first login.

Best regards,
NREP Project Management System
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0056b3;">Welcome to ${organizationName || 'NREP PMS'}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Welcome to ${organizationName || 'NREP Project Management System'}! Your account has been successfully created.</p>

      <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Login Details</h3>
        <p style="margin: 10px 0;"><strong>Username:</strong> ${username}</p>
        <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${password}</code></p>
      </div>

      <p>You can log in by clicking the button below:</p>

      <a href="${loginUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 15px 0; font-weight: bold;">
        Login to Dashboard
      </a>

      <p style="margin-top: 20px;"><em>For security reasons, please change your password after your first login.</em></p>

      <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        Best regards,<br/>
        NREP Project Management System
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}
