const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hr-template-"));
const templatePath = path.join(tmpDir, "hr_upload_template.xlsx");
const templateScript = path.join(__dirname, "generateTemplate.js");
const templateResult = spawnSync(
  "node",
  [templateScript, "--out", templatePath],
  { encoding: "utf-8" }
);

if (templateResult.status !== 0) {
  console.error(templateResult.stderr || "Failed to generate template.");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

const subject = `HR data template for ${org}`;
const text = [
  `Hi ${name},`,
  "",
  `Please fill the attached HR data template for ${org}.`,
  "Once completed, reply to this email with the updated file attached.",
  "",
  "Need help? Reply to this email and we'll assist you.",
].join("\n");

const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <h2 style="margin: 0 0 12px; color: #0f172a;">HR Data Template</h2>
      <p>Hi ${name},</p>
      <p>
        Please fill the attached HR data template for <strong>${org}</strong>.
      </p>
      <p>
        Once completed, reply to this email with the updated file attached.
      </p>
      <div style="margin-top: 18px; padding: 14px 16px; background: #e0f2fe; border-radius: 10px;">
        <strong>Tip:</strong> Keep the header row unchanged so the upload can map fields correctly.
      </div>
      <p style="margin-top: 18px;">Need help? Reply to this email and we'll assist you.</p>
    </div>
  </div>
`;

transporter
  .sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: "hr_upload_template.xlsx",
        path: templatePath,
      },
    ],
  })
  .then(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log("Template email sent.");
    process.exit(0);
  })
  .catch((error) => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error(error?.message || "Failed to send email.");
    process.exit(1);
  });
