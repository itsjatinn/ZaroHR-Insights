const path = require("path");
const dotenv = require("dotenv");

const envPaths = [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", "..", ".env"),
  path.join(__dirname, "..", "..", "backend", ".env"),
];

envPaths.forEach((envPath) => {
  dotenv.config({ path: envPath });
});
const nodemailer = require("nodemailer");

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const to = getArg("--to");
const name = getArg("--name") || "there";
const link = getArg("--link") || "";

if (!to) {
  console.error("Missing --to argument");
  process.exit(1);
}

const smtpUrl = process.env.SMTP_URL;
const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || "587");
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const fromName = process.env.FROM_NAME;
const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_FROM || user;
const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

if (!smtpUrl && (!host || !user || !pass)) {
  console.error("Missing SMTP configuration.");
  process.exit(1);
}

const transporter = smtpUrl
  ? nodemailer.createTransport(smtpUrl)
  : nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

const subject = "Reset your ZaroHR Insights password";
const text = [
  `Hi ${name},`,
  "",
  "We received a request to reset your password.",
  link ? `Reset link: ${link}` : "",
  "",
  "If you did not request this, you can ignore this email.",
].join("\n");

const html = `
  <div style="background:#f1f5f9;padding:32px 0;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg,#22d3ee,#0ea5e9);padding:24px 32px;color:#0b0f1b;">
        <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Password reset</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;">Reset your password</h1>
      </div>
      <div style="padding:28px 32px;">
        <p style="margin:0 0 16px;">Hi ${name},</p>
        <p style="margin:0 0 20px;">We received a request to reset your ZaroHR Insights password.</p>
        ${
          link
            ? `<a href="${link}" style="display:inline-block;background:#19b5ea;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">Reset password</a>`
            : ""
        }
        <p style="margin:20px 0 0;color:#475569;font-size:14px;">
          If you did not request this, you can ignore this email.
        </p>
      </div>
      <div style="padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px;">
        <p style="margin:0;">Need help? Reply to this email and our team will assist.</p>
      </div>
    </div>
  </div>
`;

transporter
  .sendMail({ from, to, subject, text, html })
  .then(() => {
    console.log("Reset email sent.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error?.message || "Failed to send email.");
    process.exit(1);
  });
