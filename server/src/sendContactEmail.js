const path = require("path");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

const envPaths = [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, "..", "..", ".env"),
  path.join(__dirname, "..", "..", "backend", ".env"),
];

envPaths.forEach((envPath) => {
  dotenv.config({ path: envPath });
});

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const to = getArg("--to");
const name = getArg("--name") || "there";
const email = getArg("--email") || "";
const company = getArg("--company") || "";
const teamSize = getArg("--team-size") || "";
const message = getArg("--message") || "";

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

const subject = `New contact request from ${name}`;
const text = [
  `Name: ${name}`,
  `Email: ${email || "Not provided"}`,
  company ? `Company: ${company}` : null,
  teamSize ? `Team size: ${teamSize}` : null,
  "",
  "Message:",
  message || "No message provided.",
].filter(Boolean).join("\n");

const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email || "Not provided"}</p>
    ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
    ${teamSize ? `<p><strong>Team size:</strong> ${teamSize}</p>` : ""}
    <p><strong>Message:</strong></p>
    <p style="white-space: pre-wrap;">${message || "No message provided."}</p>
  </div>
`;

transporter
  .sendMail({
    from,
    to,
    subject,
    text,
    html,
    replyTo: email || undefined,
  })
  .then(() => {
    console.log("Contact email sent.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error?.message || "Failed to send email.");
    process.exit(1);
  });
