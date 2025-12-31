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
const org = getArg("--org") || "your organization";
const month = getArg("--month") || "the selected month";
const email = getArg("--email") || "";
const temp = getArg("--temp") || "";
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

const subject = `Dashboard ready: ${org} - ${month}`;
const hasCredentials = Boolean(email && temp);
const textLines = [
  `Hi ${name},`,
  "",
  `Your ${org} dashboard for ${month} is now ready.`,
  "",
];
if (hasCredentials) {
  textLines.push(
    "Login details",
    `Email: ${email}`,
    `Temporary password: ${temp}`,
    ""
  );
}
if (link) {
  textLines.push(`Login link: ${link}`, "");
}
textLines.push(
  hasCredentials
    ? "Please sign in and change your password after your first login."
    : "Use your existing password to sign in."
);
const text = textLines.join("\n");

const html = `
  <div style="background:#f1f5f9;padding:32px 0;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg,#22d3ee,#0ea5e9);padding:24px 32px;color:#0b0f1b;">
        <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Dashboard update</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;">${org} - ${month}</h1>
      </div>
      <div style="padding:28px 32px;">
        <p style="margin:0 0 16px;">Hi ${name},</p>
        <p style="margin:0 0 20px;">Your ${org} dashboard for ${month} is now ready to view.</p>
        ${
          hasCredentials
            ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
                <p style="margin:0 0 8px;font-weight:600;">Login details</p>
                <p style="margin:0 0 6px;">Email: <strong>${email}</strong></p>
                <p style="margin:0;">Temporary password: <strong>${temp}</strong></p>
              </div>`
            : ""
        }
        ${
          link
            ? `<a href="${link}" style="display:inline-block;background:#19b5ea;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">Sign in to dashboard</a>`
            : ""
        }
        <p style="margin:20px 0 0;color:#475569;font-size:14px;">
          ${
            hasCredentials
              ? "Please sign in and change your password after your first login."
              : "Use your existing password to sign in."
          }
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
    console.log("Release email sent.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error?.message || "Failed to send email.");
    process.exit(1);
  });
