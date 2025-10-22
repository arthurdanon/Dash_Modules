// src/lib/mailer.js
const nodemailer = require('nodemailer');

const hasSmtp = !!process.env.SMTP_HOST;

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      pool: true,
    })
  : nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });

async function verifyConnection() {
  if (!hasSmtp) return true;
  try {
    await transporter.verify();
    return true;
  } catch (err) {
    console.error('[mail] smtp verify failed:', err.message);
    return false;
  }
}

async function sendMail(to, subject, html, opts = {}) {
  const { text, reason } = opts;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const hostname = (() => { try { return new URL(appUrl).hostname; } catch { return 'localhost'; } })();
  const from = process.env.SMTP_FROM || `Taskflow <no-reply@${hostname}>`;
  const fromAddr = /<([^>]+)>/.exec(from)?.[1] || from;

  console.log(`[mail] to=${to} reason="${reason || subject}"`);

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
      envelope: { from: fromAddr, to },
    });
    return info;
  } catch (err) {
    console.error(`[mail] failed to=${to} reason="${reason || subject}" err=${err.message}`);
    throw err;
  }
}

module.exports = { sendMail, verifyConnection, isSmtpEnabled: hasSmtp };
