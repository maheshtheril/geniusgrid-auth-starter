import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

export async function sendVerificationEmail({ to, verifyUrl }) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEV] Verify URL:', verifyUrl);
  }
  const html = `
    <p>Verify your email to activate your GeniusGrid account.</p>
    <p><a href="${verifyUrl}">Click to verify</a> (valid for 24 hours)</p>
  `;
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@geniusgrid.app',
    to,
    subject: 'Verify your email',
    html,
  });
}
