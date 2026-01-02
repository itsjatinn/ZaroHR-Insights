const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const formidable = require("formidable");

const { fetchAll, fetchOne, withTransaction, replaceParams } = require("./_lib/db");
const {
  buildAgeGenderSql,
  buildAttritionSql,
  buildDemographicsSql,
  buildEntityDemographicsSql,
  buildHiresSql,
  buildLocationHeadcountSql,
  buildManpowerSql,
  buildSnapshotCte,
  buildTenureSql,
  formatMonthLabel,
  parseDateParam,
  resolveAnalyticsScope,
  resolveOrgMonthScope,
  toDateString,
} = require("./_lib/analytics");
const { hashPassword, verifyPassword } = require("./_lib/password");
const { runIngest, runNodeScript } = require("./_lib/scripts");

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const jsonResponse = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const textResponse = (res, status, message) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain");
  res.end(message);
};

const handleCors = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf-8");
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON payload.");
  }
};

const getPayloadValue = (payload, key, fallbackKey) => {
  if (payload && Object.prototype.hasOwnProperty.call(payload, key)) {
    return payload[key];
  }
  if (fallbackKey && payload && Object.prototype.hasOwnProperty.call(payload, fallbackKey)) {
    return payload[fallbackKey];
  }
  return undefined;
};

const createForm = (options) => {
  if (typeof formidable === "function") {
    return formidable(options);
  }
  if (formidable?.default && typeof formidable.default === "function") {
    return formidable.default(options);
  }
  const IncomingForm =
    formidable?.IncomingForm || formidable?.Formidable || formidable?.formidable;
  if (typeof IncomingForm === "function") {
    return new IncomingForm(options);
  }
  throw new Error("Formidable is not available.");
};

const parseForm = (req) =>
  new Promise((resolve, reject) => {
    const form = createForm({ multiples: false, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

const resolveField = (value) =>
  Array.isArray(value) ? value[0] : value;

const parseEntities = (url) => {
  const values = url.searchParams.getAll("entities").flatMap((entry) => {
    if (!entry) return [];
    if (entry.includes(",")) {
      return entry.split(",").map((item) => item.trim());
    }
    return [entry.trim()];
  });
  return values.filter(Boolean);
};

const getQueryParam = (url, key, altKey) =>
  url.searchParams.get(key) ?? (altKey ? url.searchParams.get(altKey) : null);

const toIsoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeGranularity = (value) => {
  const allowed = new Set(["monthly", "quarterly", "yearly"]);
  return allowed.has(value) ? value : "monthly";
};

const frontendBaseUrl = () => {
  if (process.env.FRONTEND_BASE_URL) {
    return process.env.FRONTEND_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:5173";
};

const parseIngestOutput = (stdout) => {
  const lines = stdout.split("\n").reverse();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      continue;
    }
  }
  return null;
};

const generateTempPassword = (length = 10) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
};

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname.replace(/^\/api/, "") || "/";
  const method = req.method || "GET";

  try {
    if (method === "GET" && pathname === "/health") {
      return jsonResponse(res, 200, { status: "ok" });
    }

    if (method === "POST" && pathname === "/auth/login") {
      const payload = await readJson(req);
      const email = (payload.email || "").trim();
      const row = await fetchOne(
        `
        SELECT "id", "name", "email", "passwordHash", "role", "organizationId"
        FROM "User"
        WHERE LOWER("email") = LOWER(%(email)s)
        LIMIT 1;
        `,
        { email }
      );
      if (!row || !verifyPassword(payload.password || "", row.passwordHash)) {
        return textResponse(res, 401, "Invalid credentials.");
      }
      return jsonResponse(res, 200, {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        organizationId: row.organizationId,
      });
    }

    if (method === "POST" && pathname === "/auth/forgot") {
      const payload = await readJson(req);
      const email = (payload.email || "").trim();
      const row = await fetchOne(
        `
        SELECT "id", "name", "email"
        FROM "User"
        WHERE LOWER("email") = LOWER(%(email)s)
        LIMIT 1;
        `,
        { email }
      );
      if (row) {
        const resetToken = randomUUID();
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await fetchOne(
          `
          INSERT INTO "PasswordReset" ("id", "token", "userId", "expiresAt")
          VALUES (%(id)s, %(token)s, %(user_id)s, %(expires_at)s)
          RETURNING "id";
          `,
          {
            id: randomUUID(),
            token: resetToken,
            user_id: row.id,
            expires_at: expiresAt,
          }
        );
        const resetLink = `${frontendBaseUrl()}/?view=reset&token=${resetToken}`;
        const result = await runNodeScript("src/sendResetEmail.js", [
          "--to",
          row.email,
          "--name",
          row.name || "there",
          "--link",
          resetLink,
        ]);
        if (result.code !== 0) {
          return textResponse(
            res,
            500,
            result.stderr || "Unable to send reset email."
          );
        }
      }
      return jsonResponse(res, 200, {
        message: "If the account exists, a reset link has been sent.",
      });
    }

    if (method === "POST" && pathname === "/auth/reset") {
      const payload = await readJson(req);
      const resetRow = await fetchOne(
        `
        UPDATE "PasswordReset"
        SET "usedAt" = NOW()
        WHERE "token" = %(token)s
          AND "usedAt" IS NULL
          AND "expiresAt" >= NOW()
        RETURNING "userId";
        `,
        { token: payload.token }
      );
      if (!resetRow) {
        return textResponse(res, 400, "Reset link is invalid or expired.");
      }
      const passwordHash = hashPassword(payload.password || "");
      await fetchOne(
        `
        UPDATE "User"
        SET "passwordHash" = %(password_hash)s,
            "passwordChangedAt" = NOW()
        WHERE "id" = %(user_id)s
        RETURNING "id";
        `,
        { password_hash: passwordHash, user_id: resetRow.userId }
      );
      return jsonResponse(res, 200, { message: "Password updated." });
    }

    if (method === "POST" && pathname === "/contact") {
      const payload = await readJson(req);
      const contactEmail = process.env.CONTACT_EMAIL || "insights@zarohr.com";
      const firstName = (getPayloadValue(payload, "firstName", "first_name") || "").trim();
      const lastName = (getPayloadValue(payload, "lastName", "last_name") || "").trim();
      const fullName = `${firstName} ${lastName}`.trim() || "there";
      const company = (payload.company || "").trim();
      const teamSize = (getPayloadValue(payload, "teamSize", "team_size") || "").trim();
      const message = (payload.message || "").trim();

      const result = await runNodeScript("src/sendContactEmail.js", [
        "--to",
        contactEmail,
        "--name",
        fullName,
        "--email",
        payload.email,
        "--company",
        company,
        "--team-size",
        teamSize,
        "--message",
        message,
      ]);
      if (result.code !== 0) {
        return textResponse(
          res,
          500,
          `Contact email failed. ${result.stderr || result.stdout}`.trim()
        );
      }
      return jsonResponse(res, 200, { message: "Contact request sent." });
    }

    if (method === "POST" && pathname === "/leads/demo") {
      const payload = await readJson(req);
      const email = (payload.email || "").trim().toLowerCase();
      const source = payload.source ? payload.source.trim() : null;
      const row = await fetchOne(
        `
        INSERT INTO "DemoLead" ("id", "email", "source")
        VALUES (%(id)s, %(email)s, %(source)s)
        ON CONFLICT ("email")
        DO UPDATE SET "source" = COALESCE(EXCLUDED."source", "DemoLead"."source")
        RETURNING "id", "email", "source", "createdAt";
        `,
        { id: randomUUID(), email, source }
      );
      if (!row) {
        return textResponse(res, 500, "Unable to store demo lead.");
      }
      return jsonResponse(res, 200, {
        id: row.id,
        email: row.email,
        source: row.source,
        createdAt: row.createdAt,
      });
    }

    if (method === "GET" && pathname === "/leads/demo") {
      const limit = url.searchParams.get("limit");
      const params = {};
      let limitClause = "";
      if (limit) {
        params.limit = Number(limit);
        limitClause = "LIMIT %(limit)s";
      }
      const rows = await fetchAll(
        `
        SELECT "id", "email", "source", "createdAt"
        FROM "DemoLead"
        ORDER BY "createdAt" DESC
        ${limitClause};
        `,
        params
      );
      return jsonResponse(res, 200, { leads: rows || [] });
    }

    if (method === "POST" && pathname === "/uploads") {
      const { fields, files } = await parseForm(req);
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) {
        return textResponse(res, 400, "Missing file.");
      }
      const fileMime = file.mimetype || file.type || "";
      const originalName = file.originalFilename || file.newFilename || "";
      const extension = path.extname(originalName).toLowerCase();
      const isAllowedMime = ALLOWED_MIME_TYPES.has(fileMime);
      const isAllowedExt = extension === ".xlsx" || extension === ".xls";
      if (!isAllowedMime && !isAllowedExt) {
        return textResponse(res, 400, "Invalid file type");
      }
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hr-upload-"));
      const tmpPath = path.join(tmpDir, file.originalFilename || file.newFilename);
      fs.copyFileSync(file.filepath, tmpPath);
      try {
        const result = await runIngest(tmpPath, {
          organizationName: resolveField(fields.organization_name),
          organizationCode: resolveField(fields.organization_code),
          monthKey: resolveField(fields.month_key),
          monthLabel: resolveField(fields.month_label),
        });
        if (result.code !== 0) {
          return textResponse(
            res,
            500,
            `Ingestion failed. ${result.stderr || result.stdout}`.trim()
          );
        }
        const payload = parseIngestOutput(result.stdout || "");
        if (!payload) {
          return textResponse(res, 500, "Ingestion succeeded but returned empty output.");
        }
        return jsonResponse(res, 200, {
          uploadId: payload.uploadId || "",
          stats: payload.stats || {},
          raw_stdout: result.stdout || "",
          raw_stderr: result.stderr || null,
        });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    if (method === "GET" && pathname === "/templates/upload") {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hr-template-"));
      const outputPath = path.join(tmpDir, "hr_upload_template.xlsx");
      const result = await runNodeScript("src/generateTemplate.js", [
        "--out",
        outputPath,
      ]);
      if (result.code !== 0 || !fs.existsSync(outputPath)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return textResponse(res, 500, "Template generation failed.");
      }
      const fileBuffer = fs.readFileSync(outputPath);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      res.statusCode = 200;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="hr_upload_template.xlsx"'
      );
      res.end(fileBuffer);
      return;
    }

    if (method === "POST" && pathname === "/templates/upload/email") {
      const payload = await readJson(req);
      const orgRow = await fetchOne(
        `
        SELECT o."name", u."email" AS admin_email, u."name" AS admin_name
        FROM "Organization" o
        LEFT JOIN "User" u
          ON u."organizationId" = o."id"
         AND u."role" = 'ORG_ADMIN'
        WHERE o."id" = %(organization_id)s
        ORDER BY u."createdAt" DESC
        LIMIT 1;
        `,
        { organization_id: payload.organizationId }
      );
      if (!orgRow || !orgRow.admin_email) {
        return textResponse(res, 404, "Organization admin not found.");
      }
      const result = await runNodeScript("src/sendTemplateEmail.js", [
        "--to",
        orgRow.admin_email,
        "--name",
        orgRow.admin_name || "there",
        "--org",
        orgRow.name,
      ]);
      if (result.code !== 0) {
        return textResponse(
          res,
          500,
          result.stderr || "Unable to send template email."
        );
      }
      return jsonResponse(res, 200, { message: "Template email sent." });
    }

    if (method === "GET" && pathname === "/organizations") {
      const rows = await fetchAll(
        `
        SELECT
            o."id",
            o."name",
            o."code",
            COUNT(u.id)::int AS uploads
        FROM "Organization" o
        LEFT JOIN "Upload" u ON u."organizationId" = o."id"
        GROUP BY o."id"
        ORDER BY o."name";
        `,
        {}
      );
      return jsonResponse(res, 200, { organizations: rows || [] });
    }

    if (method === "GET" && pathname.startsWith("/organizations/")) {
      const organizationId = pathname.split("/")[2];
      const row = await fetchOne(
        `
        SELECT
            o."id",
            o."name",
            o."code",
            u."name" AS admin_name,
            u."email" AS admin_email
        FROM "Organization" o
        LEFT JOIN "User" u
          ON u."organizationId" = o."id"
         AND u."role" = 'ORG_ADMIN'
        WHERE o."id" = %(organization_id)s
        ORDER BY u."createdAt" DESC
        LIMIT 1;
        `,
        { organization_id: organizationId }
      );
      if (!row) {
        return textResponse(res, 404, "Organization not found.");
      }
      return jsonResponse(res, 200, {
        id: row.id,
        name: row.name,
        code: row.code,
        adminName: row.admin_name,
        adminEmail: row.admin_email,
      });
    }

    if (method === "POST" && pathname === "/organizations") {
      const payload = await readJson(req);
      const row = await fetchOne(
        `
        INSERT INTO "Organization" ("id", "name", "code")
        VALUES (%(id)s, %(name)s, %(code)s)
        ON CONFLICT ("name")
        DO UPDATE SET "code" = COALESCE(EXCLUDED."code", "Organization"."code")
        RETURNING "id", "name", "code";
        `,
        {
          id: randomUUID(),
          name: payload.name.trim(),
          code: payload.code || null,
        }
      );
      if (!row) {
        return textResponse(res, 500, "Unable to save organization.");
      }
      const adminEmail = getPayloadValue(payload, "adminEmail", "admin_email");
      const adminNameValue = getPayloadValue(payload, "adminName", "admin_name");
      const adminPassword = getPayloadValue(payload, "adminPassword", "admin_password");
      if (adminEmail) {
        const adminName = (adminNameValue || "").trim() || null;
        const tempPassword = adminPassword || generateTempPassword();
        const passwordHash = hashPassword(tempPassword);
        await fetchOne(
          `
          INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "organizationId")
          VALUES (%(id)s, %(name)s, %(email)s, %(password_hash)s, 'ORG_ADMIN', %(organization_id)s)
          ON CONFLICT ("email")
          DO UPDATE SET
            "name" = EXCLUDED."name",
            "passwordHash" = EXCLUDED."passwordHash",
            "role" = EXCLUDED."role",
            "organizationId" = EXCLUDED."organizationId"
          RETURNING "id";
          `,
          {
            id: randomUUID(),
            name: adminName,
            email: adminEmail.trim().toLowerCase(),
            password_hash: passwordHash,
            organization_id: row.id,
          }
        );
      }
      return jsonResponse(res, 200, { ...row, uploads: 0 });
    }

    if (method === "PUT" && pathname.startsWith("/organizations/")) {
      const payload = await readJson(req);
      const organizationId = pathname.split("/")[2];
      const row = await fetchOne(
        `
        UPDATE "Organization"
        SET "name" = %(name)s,
            "code" = %(code)s
        WHERE "id" = %(organization_id)s
        RETURNING "id", "name", "code";
        `,
        {
          organization_id: organizationId,
          name: payload.name.trim(),
          code: payload.code || null,
        }
      );
      if (!row) {
        return textResponse(res, 404, "Organization not found.");
      }
      const adminEmail = getPayloadValue(payload, "adminEmail", "admin_email");
      const adminNameValue = getPayloadValue(payload, "adminName", "admin_name");
      const adminPassword = getPayloadValue(payload, "adminPassword", "admin_password");
      if (adminEmail) {
        const adminName = (adminNameValue || "").trim() || null;
        const tempPassword = adminPassword || generateTempPassword();
        const passwordHash = hashPassword(tempPassword);
        await fetchOne(
          `
          INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "organizationId")
          VALUES (%(id)s, %(name)s, %(email)s, %(password_hash)s, 'ORG_ADMIN', %(organization_id)s)
          ON CONFLICT ("email")
          DO UPDATE SET
            "name" = EXCLUDED."name",
            "passwordHash" = EXCLUDED."passwordHash",
            "role" = EXCLUDED."role",
            "organizationId" = EXCLUDED."organizationId"
          RETURNING "id";
          `,
          {
            id: randomUUID(),
            name: adminName,
            email: adminEmail.trim().toLowerCase(),
            password_hash: passwordHash,
            organization_id: row.id,
          }
        );
      }
      const uploadsRow = await fetchOne(
        `
        SELECT COUNT(u.id)::int AS uploads
        FROM "Upload" u
        WHERE u."organizationId" = %(organization_id)s;
        `,
        { organization_id: row.id }
      );
      return jsonResponse(res, 200, {
        ...row,
        uploads: uploadsRow ? uploadsRow.uploads : 0,
      });
    }

    if (method === "DELETE" && pathname.startsWith("/organizations/")) {
      const organizationId = pathname.split("/")[2];
      const orgRow = await fetchOne(
        `
        SELECT "id", "name", "code"
        FROM "Organization"
        WHERE "id" = %(organization_id)s
        LIMIT 1;
        `,
        { organization_id: organizationId }
      );
      if (!orgRow) {
        return textResponse(res, 404, "Organization not found.");
      }
      await withTransaction(async (client) => {
        const exec = async (query, params) => {
          const prepared = replaceParams(query, params);
          await client.query(prepared.text, prepared.values);
        };
        await exec(
          `
          DELETE FROM "PasswordReset"
          WHERE "userId" IN (
              SELECT "id" FROM "User" WHERE "organizationId" = %(organization_id)s
          );
          `,
          { organization_id: organizationId }
        );
        await exec(
          'DELETE FROM "DashboardRelease" WHERE "organizationId" = %(organization_id)s;',
          { organization_id: organizationId }
        );
        await exec(
          'DELETE FROM "DashboardConfig" WHERE "organizationId" = %(organization_id)s;',
          { organization_id: organizationId }
        );
        await exec(
          'DELETE FROM "User" WHERE "organizationId" = %(organization_id)s;',
          { organization_id: organizationId }
        );
        await exec(
          'DELETE FROM "employee_dashboard_master" WHERE "organizationId" = %(organization_id)s;',
          { organization_id: organizationId }
        );
        await exec(
          `
          DELETE FROM "LTIP"
          WHERE "uploadId" IN (
              SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
          );
          `,
          { organization_id: organizationId }
        );
        await exec(
          `
          DELETE FROM "Experience"
          WHERE "uploadId" IN (
              SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
          );
          `,
          { organization_id: organizationId }
        );
        await exec(
          `
          DELETE FROM "Education"
          WHERE "uploadId" IN (
              SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
          );
          `,
          { organization_id: organizationId }
        );
        await exec(
          `
          DELETE FROM "Employee"
          WHERE "uploadId" IN (
              SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
          );
          `,
          { organization_id: organizationId }
        );
        await exec(
          'DELETE FROM "Upload" WHERE "organizationId" = %(organization_id)s;',
          { organization_id: organizationId }
        );
        await exec(
          'DELETE FROM "Organization" WHERE "id" = %(organization_id)s;',
          { organization_id: organizationId }
        );
      });
      return jsonResponse(res, 200, { ...orgRow, uploads: 0 });
    }

    if (method === "GET" && pathname === "/admin/overview") {
      const orgCount = await fetchOne(
        'SELECT COUNT(*)::int AS count FROM "Organization";',
        {}
      );
      const demoLeadCount = await fetchOne(
        'SELECT COUNT(*)::int AS count FROM "DemoLead";',
        {}
      );
      const employeeCount = await fetchOne(
        `
        WITH latest_upload AS (
            SELECT DISTINCT ON (u."organizationId")
                u."organizationId",
                u."id" AS upload_id
            FROM "Upload" u
            WHERE u."organizationId" IS NOT NULL
            ORDER BY u."organizationId", u."uploadedAt" DESC NULLS LAST
        ),
        per_org AS (
            SELECT
                o."id" AS org_id,
                COUNT(DISTINCT COALESCE(ed."New Emp ID", ed."Emp ID", ed.id::text))::int AS count
            FROM "Organization" o
            LEFT JOIN latest_upload lu ON lu."organizationId" = o."id"
            LEFT JOIN employee_dashboard_master ed ON ed."uploadId" = lu.upload_id
                AND ed."Final LWD" IS NULL
            GROUP BY o."id"
        )
        SELECT COALESCE(SUM(count), 0)::int AS count
        FROM per_org;
        `,
        {}
      );
      const dashboardCount = await fetchOne(
        `
        SELECT COUNT(DISTINCT (u."organizationId", u."dashboardMonthId"))::int AS count
        FROM "Upload" u
        WHERE u."organizationId" IS NOT NULL AND u."dashboardMonthId" IS NOT NULL;
        `,
        {}
      );
      const uploads = await fetchAll(
        `
        SELECT
            u."filename" AS name,
            o."name" AS org,
            u."uploadedAt" AS uploaded_at,
            COUNT(ed.id)::int AS rows
        FROM "Upload" u
        LEFT JOIN "Organization" o ON o."id" = u."organizationId"
        LEFT JOIN employee_dashboard_master ed ON ed."uploadId" = u."id"
        GROUP BY u."id", o."name"
        ORDER BY u."uploadedAt" DESC NULLS LAST
        LIMIT 5;
        `,
        {}
      );
      const organizations = await fetchAll(
        `
        WITH latest_upload AS (
            SELECT DISTINCT ON (u."organizationId")
                u."organizationId",
                u."id" AS upload_id
            FROM "Upload" u
            WHERE u."organizationId" IS NOT NULL
            ORDER BY u."organizationId", u."uploadedAt" DESC NULLS LAST
        )
        SELECT
            o."name" AS name,
            o."code" AS sector,
            COUNT(DISTINCT COALESCE(ed."New Emp ID", ed."Emp ID", ed.id::text))::int AS count
        FROM "Organization" o
        LEFT JOIN latest_upload lu ON lu."organizationId" = o."id"
        LEFT JOIN employee_dashboard_master ed ON ed."uploadId" = lu.upload_id
            AND ed."Final LWD" IS NULL
        GROUP BY o."id"
        ORDER BY count DESC NULLS LAST, o."name"
        LIMIT 6;
        `,
        {}
      );
      return jsonResponse(res, 200, {
        summary: [
          { label: "Total Organizations", value: orgCount?.count || 0 },
          { label: "Total Employees", value: employeeCount?.count || 0 },
          { label: "Contact Leads", value: demoLeadCount?.count || 0 },
          { label: "Active Dashboards", value: dashboardCount?.count || 0 },
        ],
        uploads: uploads.map((row) => ({
          name: row.name || "Untitled upload",
          org: row.org,
          date: row.uploaded_at ? row.uploaded_at.toISOString().slice(0, 10) : "",
          rows: row.rows,
        })),
        organizations: organizations.map((row) => ({
          name: row.name,
          sector: row.sector,
          count: row.count,
        })),
      });
    }

    if (method === "GET" && pathname === "/org/metrics") {
      const organizationId = url.searchParams.get("organizationId");
      const orgRow = await fetchOne(
        `
        SELECT o."name"
        FROM "Organization" o
        WHERE o."id" = %(organization_id)s
        LIMIT 1;
        `,
        { organization_id: organizationId }
      );
      if (!orgRow) {
        return textResponse(res, 404, "Organization not found.");
      }
      const dashboardsRow = await fetchOne(
        `
        SELECT COUNT(*)::int AS count
        FROM "DashboardRelease" dr
        WHERE dr."organizationId" = %(organization_id)s;
        `,
        { organization_id: organizationId }
      );
      const uploadsRow = await fetchOne(
        `
        SELECT COUNT(*)::int AS count
        FROM "Upload" u
        WHERE u."organizationId" = %(organization_id)s;
        `,
        { organization_id: organizationId }
      );
      return jsonResponse(res, 200, {
        organizationId,
        organizationName: orgRow.name,
        dashboards: dashboardsRow?.count || 0,
        reports: uploadsRow?.count || 0,
      });
    }

    if (method === "GET" && pathname === "/admin/dashboard-months") {
      const organizationId = url.searchParams.get("organizationId");
      if (!organizationId) {
        return textResponse(res, 400, "Organization is required.");
      }
      const rows = await fetchAll(
        `
        SELECT DISTINCT dm."monthKey" AS month_key
        FROM "Upload" u
        JOIN "DashboardMonth" dm ON dm."id" = u."dashboardMonthId"
        WHERE u."organizationId" = %(organization_id)s
          AND u."dashboardMonthId" IS NOT NULL
        ORDER BY dm."monthKey" DESC;
        `,
        { organization_id: organizationId }
      );
      return jsonResponse(res, 200, {
        organizationId,
        months: rows
          .filter((row) => row.month_key)
          .map((row) => ({
            monthKey: row.month_key,
            monthLabel: formatMonthLabel(row.month_key),
          })),
      });
    }

    if (method === "GET" && pathname === "/org/dashboard-months") {
      const organizationId = url.searchParams.get("organizationId");
      if (!organizationId) {
        return textResponse(res, 400, "Organization is required.");
      }
      const rows = await fetchAll(
        `
        SELECT DISTINCT dm."monthKey" AS month_key
        FROM "DashboardRelease" dr
        JOIN "DashboardMonth" dm ON dm."id" = dr."dashboardMonthId"
        WHERE dr."organizationId" = %(organization_id)s
        ORDER BY dm."monthKey" DESC;
        `,
        { organization_id: organizationId }
      );
      return jsonResponse(res, 200, {
        organizationId,
        months: rows
          .filter((row) => row.month_key)
          .map((row) => ({
            monthKey: row.month_key,
            monthLabel: formatMonthLabel(row.month_key),
          })),
      });
    }

    if (method === "GET" && pathname === "/org/latest-dashboard-month") {
      const organizationId = url.searchParams.get("organizationId");
      if (!organizationId) {
        return textResponse(res, 400, "Organization is required.");
      }
      const row = await fetchOne(
        `
        SELECT dr."organizationId" AS organization_id, dm."monthKey" AS month_key
        FROM "DashboardRelease" dr
        JOIN "DashboardMonth" dm ON dm."id" = dr."dashboardMonthId"
        WHERE dr."organizationId" = %(organization_id)s
        ORDER BY dr."releasedAt" DESC, dm."monthKey" DESC
        LIMIT 1;
        `,
        { organization_id: organizationId }
      );
      if (!row) {
        return textResponse(res, 404, "No released dashboards.");
      }
      return jsonResponse(res, 200, {
        organizationId: row.organization_id,
        monthKey: row.month_key,
        monthLabel: row.month_key ? formatMonthLabel(row.month_key) : null,
      });
    }

    if (method === "GET" && pathname === "/org/employees/search") {
      const organizationId = url.searchParams.get("organizationId");
      const query = url.searchParams.get("query");
      const limit = Number(url.searchParams.get("limit") || "25");
      if (!organizationId) {
        return textResponse(res, 400, "Organization is required.");
      }
      if (!query || !query.trim()) {
        return jsonResponse(res, 200, {
          organizationId,
          query,
          results: [],
        });
      }
      const rows = await fetchAll(
        `
        SELECT *
        FROM (
            SELECT
                e."id",
                e."Employee Name" AS name,
                e."Old Emp ID" AS emp_id,
                e."New Emp ID" AS new_emp_id,
                e."Official Email Id" AS email,
                COALESCE(
                    e."Internal Designation",
                    e."External Designation",
                    e."position"
                ) AS designation,
                e."Entity" AS entity,
                ROW_NUMBER() OVER (
                    PARTITION BY COALESCE(e."New Emp ID", e."Old Emp ID", e."id")
                    ORDER BY e."id" DESC
                ) AS row_rank
            FROM "Employee" e
            JOIN "Upload" u ON u."id" = e."uploadId"
            WHERE u."organizationId" = %(organization_id)s
              AND (
                e."Employee Name" ILIKE ('%%' || %(query)s || '%%')
                OR e."Old Emp ID" ILIKE ('%%' || %(query)s || '%%')
                OR e."New Emp ID" ILIKE ('%%' || %(query)s || '%%')
                OR e."Official Email Id" ILIKE ('%%' || %(query)s || '%%')
              )
        ) ranked
        WHERE ranked.row_rank = 1
        ORDER BY ranked.name ASC
        LIMIT %(limit)s;
        `,
        {
          organization_id: organizationId,
          query: query.trim(),
          limit: Math.min(Math.max(limit || 25, 1), 100),
        }
      );
      return jsonResponse(res, 200, {
        organizationId,
        query,
        results: rows.map((row) => ({
          id: row.id,
          name: row.name,
          empId: row.emp_id,
          newEmpId: row.new_emp_id,
          email: row.email,
          designation: row.designation,
          entity: row.entity,
        })),
      });
    }

    if (method === "GET" && pathname.startsWith("/org/employees/")) {
      const employeeId = pathname.split("/")[3];
      const organizationId = url.searchParams.get("organizationId");
      if (!organizationId) {
        return textResponse(res, 400, "Organization is required.");
      }
      const employeeRow = await fetchOne(
        `
        SELECT
            e."id",
            e."Employee Name" AS name,
            e."Old Emp ID" AS emp_id,
            e."New Emp ID" AS new_emp_id,
            e."Status" AS status,
            COALESCE(
                e."Internal Designation",
                e."External Designation",
                e."position"
            ) AS designation,
            e."Role" AS role,
            e."Function" AS function,
            e."Department 1" AS department_1,
            e."Department 2" AS department_2,
            e."SBU(Bussines Unit)" AS sbu,
            e."Entity" AS entity,
            e."Employee Physical Location" AS location,
            e."Entity Location as per Payroll" AS payroll_location,
            e."Official Email Id" AS email,
            e."Gender" AS gender,
            e."DOB" AS dob,
            e."DOJ" AS doj,
            CASE
              WHEN e."DOJ" IS NULL THEN NULL
              ELSE ROUND(
                (DATE_PART(
                  'day',
                  COALESCE(e."LWD (Last working day)", CURRENT_DATE) - e."DOJ"
                ) / 365.25)::numeric,
                2
              )::float
            END AS tenure,
            CASE
              WHEN e."DOB" IS NULL THEN NULL
              ELSE DATE_PART('year', AGE(CURRENT_DATE, e."DOB"))
            END AS age,
            e."Reporting manager" AS reporting_manager,
            e."Internal Grade" AS internal_grade,
            e."Internal Designation" AS internal_designation,
            e."External Designation" AS external_designation,
            e."position" AS position
        FROM "Employee" e
        JOIN "Upload" u ON u."id" = e."uploadId"
        WHERE e."id" = %(employee_id)s
          AND u."organizationId" = %(organization_id)s
        LIMIT 1;
        `,
        { employee_id: employeeId, organization_id: organizationId }
      );
      if (!employeeRow) {
        return textResponse(res, 404, "Employee not found.");
      }
      const educationRows = await fetchAll(
        `
        SELECT
            "Highest Qualification" AS qualification,
            "Institute/College" AS institute,
            "Year of Passing" AS year_of_passing
        FROM "Education"
        WHERE "employeeId" = %(employee_id)s
        ORDER BY "Year of Passing" DESC NULLS LAST;
        `,
        { employee_id: employeeId }
      );
      const experienceRows = await fetchAll(
        `
        SELECT
            "Name of Previous Organization_Latest" AS organization,
            "Role/Designation" AS role,
            "From Date" AS from_date,
            "To Date" AS to_date
        FROM "Experience"
        WHERE "employeeId" = %(employee_id)s
        ORDER BY "From Date" DESC NULLS LAST;
        `,
        { employee_id: employeeId }
      );
      const ltipRow = await fetchOne(
        `
        SELECT
            "LTIP" AS amount,
            "LTIP DATE" AS ltip_date,
            "Recovery Date" AS recovery_date
        FROM "LTIP"
        WHERE "employeeId" = %(employee_id)s
        LIMIT 1;
        `,
        { employee_id: employeeId }
      );
      return jsonResponse(res, 200, {
        organizationId,
        employee: {
          id: employeeRow.id,
          name: employeeRow.name,
          empId: employeeRow.emp_id,
          newEmpId: employeeRow.new_emp_id,
          status: employeeRow.status,
          designation: employeeRow.designation,
          role: employeeRow.role,
          function: employeeRow.function,
          department1: employeeRow.department_1,
          department2: employeeRow.department_2,
          sbu: employeeRow.sbu,
          entity: employeeRow.entity,
          location: employeeRow.location,
          payrollLocation: employeeRow.payroll_location,
          email: employeeRow.email,
          gender: employeeRow.gender,
          dob: toIsoDate(employeeRow.dob),
          doj: toIsoDate(employeeRow.doj),
          tenure: employeeRow.tenure,
          age: employeeRow.age,
          reportingManager: employeeRow.reporting_manager,
          internalGrade: employeeRow.internal_grade,
          internalDesignation: employeeRow.internal_designation,
          externalDesignation: employeeRow.external_designation,
          position: employeeRow.position,
        },
        education: educationRows.map((row) => ({
          qualification: row.qualification,
          institute: row.institute,
          yearOfPassing: row.year_of_passing,
        })),
        experience: experienceRows.map((row) => ({
          organization: row.organization,
          role: row.role,
          fromDate: toIsoDate(row.from_date),
          toDate: toIsoDate(row.to_date),
        })),
        ltip: ltipRow
          ? {
              amount: ltipRow.amount,
              ltipDate: toIsoDate(ltipRow.ltip_date),
              recoveryDate: toIsoDate(ltipRow.recovery_date),
            }
          : null,
      });
    }

    if (method === "GET" && pathname === "/analytics/entities") {
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const [orgId, dashboardMonthId] = await resolveOrgMonthScope(
        organizationId,
        monthKey
      );
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const rows = await fetchAll(
        `
        ${buildSnapshotCte(filterOrg, filterMonth)}
        SELECT DISTINCT COALESCE(latest."Entity", '') AS entity
        FROM latest
        WHERE latest."Entity" IS NOT NULL
        ORDER BY entity;
        `,
        {
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      return jsonResponse(res, 200, {
        entities: rows.map((row) => row.entity),
      });
    }

    if (method === "GET" && pathname === "/analytics/manpower-rampup") {
      const granularity = normalizeGranularity(url.searchParams.get("granularity"));
      const start = parseDateParam(url.searchParams.get("start"));
      const end = parseDateParam(url.searchParams.get("end"));
      const entities = parseEntities(url);
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const { period, orgId, dashboardMonthId, resolvedMonthKey } =
        await resolveAnalyticsScope(granularity, start, end, organizationId, monthKey);
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const rows = await fetchAll(
        buildManpowerSql(granularity, entities.length > 0, filterOrg, filterMonth),
        {
          start: toDateString(period.start),
          end: toDateString(period.end),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      return jsonResponse(res, 200, {
        granularity,
        start: toDateString(period.start),
        end: toDateString(period.end),
        monthKey: resolvedMonthKey,
        points: rows.map((row) => ({
          periodStart: toIsoDate(row.period_start),
          headcount: row.headcount,
          openingHeadcount: row.opening_headcount,
          rampChange: row.ramp_change,
          rampPct: row.ramp_pct,
        })),
      });
    }

    if (method === "GET" && pathname === "/analytics/hires-exits") {
      const granularity = normalizeGranularity(url.searchParams.get("granularity"));
      const start = parseDateParam(url.searchParams.get("start"));
      const end = parseDateParam(url.searchParams.get("end"));
      const entities = parseEntities(url);
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const { period, orgId, dashboardMonthId, resolvedMonthKey } =
        await resolveAnalyticsScope(granularity, start, end, organizationId, monthKey);
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const rows = await fetchAll(
        buildHiresSql(granularity, entities.length > 0, filterOrg, filterMonth),
        {
          start: toDateString(period.start),
          end: toDateString(period.end),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      return jsonResponse(res, 200, {
        granularity,
        start: toDateString(period.start),
        end: toDateString(period.end),
        monthKey: resolvedMonthKey,
        points: rows.map((row) => ({
          periodStart: toIsoDate(row.period_start),
          hires: row.hires,
          exits: row.exits,
        })),
      });
    }

    if (method === "GET" && pathname === "/analytics/demographics") {
      const granularity = normalizeGranularity(url.searchParams.get("granularity"));
      const start = parseDateParam(url.searchParams.get("start"));
      const end = parseDateParam(url.searchParams.get("end"));
      const entities = parseEntities(url);
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const { period, orgId, dashboardMonthId, resolvedMonthKey } =
        await resolveAnalyticsScope(granularity, start, end, organizationId, monthKey);
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const applyRange = Boolean(start || end);
      const rows = await fetchAll(
        buildDemographicsSql(
          entities.length > 0,
          filterOrg,
          filterMonth,
          applyRange
        ),
        {
          cutoff: toDateString(period.end),
          start: toDateString(period.start),
          end: toDateString(period.end),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      if (!rows.length) {
        return jsonResponse(res, 200, {
          granularity,
          start: toDateString(period.start),
          end: toDateString(period.end),
          monthKey: resolvedMonthKey,
          averages: { ctc: null, age: null, tenure: null },
          genderRatio: { male: 0.0, female: 0.0, other: 0.0 },
          worklevels: [],
        });
      }
      const totals =
        rows.find((row) => row.worklevel == null) || {
          headcount: 0,
          total_ctc: 0,
          avg_ctc: null,
          avg_age: null,
          avg_tenure: null,
          female_count: 0,
          male_count: 0,
        };
      const totalHeadcount = totals.headcount || 0;
      const totalCost = totals.total_ctc || 0;
      const femaleCount = totals.female_count || 0;
      const maleCount = totals.male_count || 0;
      const otherCount = Math.max(totalHeadcount - femaleCount - maleCount, 0);
      const pct = (value, denom) => (denom ? Number(value) / denom : 0.0);
      const worklevels = rows
        .filter((row) => row.worklevel != null)
        .map((row) => ({
          worklevel: row.worklevel || "Unspecified",
          headcount: row.headcount || 0,
          headcountPct: pct(row.headcount || 0, totalHeadcount),
          costPct: pct(row.total_ctc || 0, totalCost),
          femalePct: pct(row.female_count || 0, row.headcount || 0),
          avgTenure: row.avg_tenure,
          avgAge: row.avg_age,
          isTotal: false,
        }));
      worklevels.push({
        worklevel: "Total",
        headcount: totalHeadcount,
        headcountPct: totalHeadcount ? 1.0 : 0.0,
        costPct: totalCost ? 1.0 : 0.0,
        femalePct: pct(femaleCount, totalHeadcount),
        avgTenure: totals.avg_tenure,
        avgAge: totals.avg_age,
        isTotal: true,
      });
      return jsonResponse(res, 200, {
        granularity,
        start: toDateString(period.start),
        end: toDateString(period.end),
        monthKey: resolvedMonthKey,
        averages: {
          ctc: totals.avg_ctc,
          age: totals.avg_age,
          tenure: totals.avg_tenure,
        },
        genderRatio: {
          male: pct(maleCount, totalHeadcount),
          female: pct(femaleCount, totalHeadcount),
          other: pct(otherCount, totalHeadcount),
        },
        worklevels,
      });
    }

    if (method === "GET" && pathname === "/analytics/demographics/entities") {
      const granularity = normalizeGranularity(url.searchParams.get("granularity"));
      const start = parseDateParam(url.searchParams.get("start"));
      const end = parseDateParam(url.searchParams.get("end"));
      const entities = parseEntities(url);
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const { period, orgId, dashboardMonthId, resolvedMonthKey } =
        await resolveAnalyticsScope(granularity, start, end, organizationId, monthKey);
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const applyRange = Boolean(start || end);
      const rows = await fetchAll(
        buildEntityDemographicsSql(
          entities.length > 0,
          filterOrg,
          filterMonth,
          applyRange
        ),
        {
          cutoff: toDateString(period.end),
          start: toDateString(period.start),
          end: toDateString(period.end),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      if (!rows.length) {
        return jsonResponse(res, 200, {
          granularity,
          start: toDateString(period.start),
          end: toDateString(period.end),
          entities: [],
        });
      }
      const totals =
        rows.find((row) => row.entity == null) || {
          headcount: 0,
          total_ctc: 0,
          female_count: 0,
          male_count: 0,
        };
      const totalHeadcount = totals.headcount || 0;
      const totalCost = totals.total_ctc || 0;
      const pct = (value, denom) => (denom ? Number(value) / denom : 0.0);
      const entitiesPayload = rows
        .filter((row) => row.entity != null)
        .map((row) => ({
          entity: row.entity || "Unspecified",
          headcount: row.headcount || 0,
          headcountPct: pct(row.headcount || 0, totalHeadcount),
          costPct: pct(row.total_ctc || 0, totalCost),
          femalePct: pct(row.female_count || 0, row.headcount || 0),
          avgTenure: row.avg_tenure,
          avgAge: row.avg_age,
        }));
      return jsonResponse(res, 200, {
        granularity,
        start: toDateString(period.start),
        end: toDateString(period.end),
        monthKey: resolvedMonthKey,
        entities: entitiesPayload,
      });
    }

    if (method === "GET" && pathname === "/analytics/location-headcount") {
      const locationType = url.searchParams.get("location_type") || "physical";
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const cutoff = parseDateParam(url.searchParams.get("cutoff"));
      const entities = parseEntities(url);
      const [orgId, dashboardMonthId, resolvedMonthKey] = await resolveOrgMonthScope(
        organizationId,
        monthKey
      );
      const columnLookup = {
        physical: 'ed."Employee Physical Location"',
        entity: 'ed."Entity"',
        payroll: 'ed."Entity Location as per Payroll"',
      };
      const columnExpr = columnLookup[locationType];
      if (!columnExpr) {
        return textResponse(
          res,
          400,
          "Unsupported location type. Use physical, entity, or payroll."
        );
      }
      const resolvedCutoff = cutoff || new Date();
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const rows = await fetchAll(
        buildLocationHeadcountSql(
          columnExpr,
          entities.length > 0,
          filterOrg,
          filterMonth
        ),
        {
          cutoff: toDateString(resolvedCutoff),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      const total = rows.reduce((sum, row) => sum + (row.headcount || 0), 0);
      return jsonResponse(res, 200, {
        locationType,
        cutoff: toDateString(resolvedCutoff),
        monthKey: resolvedMonthKey,
        total,
        locations: rows.map((row) => ({
          location: row.location || "Unspecified",
          headcount: row.headcount || 0,
          percentage: total ? (row.headcount || 0) / total : 0.0,
        })),
      });
    }

    if (method === "GET" && pathname === "/analytics/attrition") {
      const granularity = normalizeGranularity(url.searchParams.get("granularity"));
      const start = parseDateParam(url.searchParams.get("start"));
      const end = parseDateParam(url.searchParams.get("end"));
      const entities = parseEntities(url);
      const organizationId = getQueryParam(url, "organization_id", "organizationId");
      const monthKey = getQueryParam(url, "month_key", "monthKey");
      const { period, orgId, dashboardMonthId, resolvedMonthKey } =
        await resolveAnalyticsScope(granularity, start, end, organizationId, monthKey);
      const cutoff = period.end;
      const filterOrg = orgId != null;
      const filterMonth = dashboardMonthId != null;
      const overallRows = await fetchAll(
        buildAttritionSql(false, entities.length > 0, filterOrg, filterMonth),
        {
          cutoff: toDateString(cutoff),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      const entityRows = await fetchAll(
        buildAttritionSql(true, entities.length > 0, filterOrg, filterMonth),
        {
          cutoff: toDateString(cutoff),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      const ageGenderRows = await fetchAll(
        buildAgeGenderSql(entities.length > 0, filterOrg, filterMonth),
        {
          cutoff: toDateString(cutoff),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );
      const tenureRows = await fetchAll(
        buildTenureSql(entities.length > 0, filterOrg, filterMonth),
        {
          cutoff: toDateString(cutoff),
          entities,
          organization_id: orgId,
          dashboard_month_id: dashboardMonthId,
        }
      );

      const monthsCovered = (row) => {
        const raw = row.months_covered;
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) return 12.0;
        return Math.min(value, 12.0);
      };
      const averageHeadcount = (row, startKey, endKey, monthlySumKey) => {
        const startVal = row[startKey] || 0;
        const endVal = row[endKey] || 0;
        const baseAvg = (startVal + endVal) / 2.0;
        if (monthlySumKey) {
          const months = monthsCovered(row);
          const monthlyVal = Number(row[monthlySumKey] || 0);
          if (monthlyVal > 0 && months > 0) {
            return monthlyVal / months;
          }
        }
        return baseAvg;
      };
      const attritionRate = (row, startKey, endKey, exitKey, monthlySumKey) => {
        const exits = row[exitKey] || 0;
        const denom = averageHeadcount(row, startKey, endKey, monthlySumKey);
        return denom ? Number(exits) / denom : 0.0;
      };
      const annualizedAttrition = (row, startKey, endKey, exitKey, monthlySumKey) => {
        const rate = attritionRate(row, startKey, endKey, exitKey, monthlySumKey);
        const months = monthsCovered(row);
        if (months >= 12.0) return rate;
        return rate * (12.0 / months);
      };

      const ageTrend = ageGenderRows.map((row) => ({
        label: row.label,
        twentyPct: annualizedAttrition(
          row,
          "start_twenty",
          "end_twenty",
          "exits_twenty",
          "monthly_twenty_sum"
        ),
        thirtyPct: annualizedAttrition(
          row,
          "start_thirty",
          "end_thirty",
          "exits_thirty",
          "monthly_thirty_sum"
        ),
        fortyPct: annualizedAttrition(
          row,
          "start_forty",
          "end_forty",
          "exits_forty",
          "monthly_forty_sum"
        ),
        fiftyPct: annualizedAttrition(
          row,
          "start_fifty",
          "end_fifty",
          "exits_fifty",
          "monthly_fifty_sum"
        ),
      }));
      const genderTrend = ageGenderRows.map((row) => ({
        label: row.label,
        malePct: annualizedAttrition(
          row,
          "start_male",
          "end_male",
          "exits_male",
          "monthly_male_sum"
        ),
        femalePct: annualizedAttrition(
          row,
          "start_female",
          "end_female",
          "exits_female",
          "monthly_female_sum"
        ),
      }));
      const tenureTrend = tenureRows.map((row) => ({
        label: row.label,
        zeroSixPct: annualizedAttrition(
          row,
          "start_zero_six",
          "end_zero_six",
          "exits_zero_six",
          "monthly_zero_six_sum"
        ),
        sixTwelvePct: annualizedAttrition(
          row,
          "start_six_twelve",
          "end_six_twelve",
          "exits_six_twelve",
          "monthly_six_twelve_sum"
        ),
        oneTwoPct: annualizedAttrition(
          row,
          "start_one_two",
          "end_one_two",
          "exits_one_two",
          "monthly_one_two_sum"
        ),
        twoFourPct: annualizedAttrition(
          row,
          "start_two_four",
          "end_two_four",
          "exits_two_four",
          "monthly_two_four_sum"
        ),
        fourTenPct: annualizedAttrition(
          row,
          "start_four_ten",
          "end_four_ten",
          "exits_four_ten",
          "monthly_four_ten_sum"
        ),
        tenPlusPct: annualizedAttrition(
          row,
          "start_ten_plus",
          "end_ten_plus",
          "exits_ten_plus",
          "monthly_ten_plus_sum"
        ),
      }));
      const overall = overallRows.map((row) => ({
        label: row.label,
        attritionPct: annualizedAttrition(
          row,
          "headcount_start",
          "headcount_end",
          "exits",
          "monthly_headcount_sum"
        ),
      }));
      const entityAttrition = entityRows
        .filter((row) => row.entity != null)
        .map((row) => ({
          entity: row.entity,
          label: row.label,
          attritionPct: annualizedAttrition(
            row,
            "headcount_start",
            "headcount_end",
            "exits",
            "monthly_headcount_sum"
          ),
        }));
      return jsonResponse(res, 200, {
        overall,
        entities: entityAttrition,
        ageTrend,
        genderTrend,
        tenureTrend,
        monthKey: resolvedMonthKey,
      });
    }

    if (method === "GET" && pathname === "/ai/models") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return textResponse(res, 500, "Missing GEMINI_API_KEY configuration.");
      }
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const response = await genAI.listModels();
      const models = Array.isArray(response) ? response : response?.models || [];
      return jsonResponse(res, 200, models.map((model) => {
        const name = model.name || "";
        return {
          name,
          shortName: name.replace("models/", ""),
          displayName: model.displayName || null,
          supportedMethods: model.supportedGenerationMethods || [],
        };
      }));
    }

    if (method === "POST" && pathname === "/ai/summary") {
      const payload = await readJson(req);
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return textResponse(res, 500, "Missing GEMINI_API_KEY configuration.");
      }
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const normalizedModel = modelName.replace("models/", "");
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: normalizedModel });
      const data = {
        dashboardTitle: payload.dashboardTitle ?? payload.dashboard_title ?? null,
        organization: payload.organization ?? null,
        period: payload.period ?? null,
        charts: payload.charts ?? [],
      };
      const prompt = [
        "You are an HR analytics assistant. Analyze the dashboard chart data and ",
        'return a JSON object with keys "dashboardSummary" and "chartSummaries". ',
        '"dashboardSummary" should be a detailed, section-wise narrative (4-6 sentences). ',
        '"chartSummaries" should map chart ids to 2-4 sentence summaries. ',
        "Use only the provided data. When values represent fractions, format as percentages ",
        'with one decimal. Call out peaks, dips, latest period changes, and differences ',
        'across groups where applicable. Return ONLY valid JSON.\n\n',
        `INPUT_DATA=${JSON.stringify(data)}`,
      ].join("");
      let text = "";
      try {
        const result = await model.generateContent(prompt);
        text = result.response.text() || "";
      } catch (error) {
        return textResponse(res, 502, `Gemini request failed: ${error.message || error}`);
      }

      const extractJson = (input) => {
        let cleaned = (input || "").trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
          if (cleaned.startsWith("json")) {
            cleaned = cleaned.slice(4).trim();
          }
        }
        if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
          try {
            return JSON.parse(cleaned);
          } catch (error) {
            return null;
          }
        }
        const startIndex = cleaned.indexOf("{");
        const endIndex = cleaned.lastIndexOf("}");
        if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
          return null;
        }
        try {
          return JSON.parse(cleaned.slice(startIndex, endIndex + 1));
        } catch (error) {
          return null;
        }
      };

      const parsed = extractJson(text);
      if (!parsed) {
        return jsonResponse(res, 200, {
          dashboardSummary: text.trim() || "No summary available.",
          chartSummaries: {},
        });
      }
      const dashboardSummary = parsed.dashboardSummary || "No summary available.";
      const chartSummaries = parsed.chartSummaries || {};
      const sanitized = {};
      if (chartSummaries && typeof chartSummaries === "object") {
        Object.keys(chartSummaries).forEach((key) => {
          sanitized[String(key)] = String(chartSummaries[key]);
        });
      }
      return jsonResponse(res, 200, {
        dashboardSummary: String(dashboardSummary),
        chartSummaries: sanitized,
      });
    }

    if (method === "GET" && pathname === "/admin/dashboard-config") {
      const organizationId = url.searchParams.get("organizationId");
      const rows = await fetchAll(
        `
        SELECT "chartKey" AS key, "enabled"
        FROM "DashboardConfig"
        WHERE "organizationId" = %(organization_id)s
        ORDER BY "chartKey";
        `,
        { organization_id: organizationId }
      );
      return jsonResponse(res, 200, { organizationId, charts: rows || [] });
    }

    if (method === "POST" && pathname === "/admin/dashboard-config") {
      const payload = await readJson(req);
      for (const item of payload.charts || []) {
        await fetchOne(
          `
          INSERT INTO "DashboardConfig" ("id", "organizationId", "chartKey", "enabled", "updatedAt")
          VALUES (%(id)s, %(organization_id)s, %(chart_key)s, %(enabled)s, NOW())
          ON CONFLICT ("organizationId", "chartKey")
          DO UPDATE SET "enabled" = EXCLUDED."enabled", "updatedAt" = NOW()
          RETURNING "id";
          `,
          {
            id: randomUUID(),
            organization_id: payload.organizationId,
            chart_key: item.key,
            enabled: item.enabled,
          }
        );
      }
      return jsonResponse(res, 200, {
        organizationId: payload.organizationId,
        charts: payload.charts || [],
      });
    }

    if (method === "POST" && pathname === "/admin/release-dashboard") {
      const payload = await readJson(req);
      const [orgId, , resolvedMonthKey] = await resolveOrgMonthScope(
        payload.organizationId,
        payload.monthKey
      );
      if (!orgId || !resolvedMonthKey) {
        return textResponse(res, 400, "Invalid organization or month.");
      }
      const orgRow = await fetchOne(
        `
        SELECT "name"
        FROM "Organization"
        WHERE "id" = %(organization_id)s
        LIMIT 1;
        `,
        { organization_id: orgId }
      );
      if (!orgRow) {
        return textResponse(res, 404, "Organization not found.");
      }
      const adminRow = await fetchOne(
        `
        SELECT "id", "name", "email", "passwordChangedAt"
        FROM "User"
        WHERE "organizationId" = %(organization_id)s
          AND "role" = 'ORG_ADMIN'
        ORDER BY "email"
        LIMIT 1;
        `,
        { organization_id: orgId }
      );
      if (!adminRow) {
        return textResponse(
          res,
          404,
          "Organization admin not found for this organization."
        );
      }
      const credentialsSent = adminRow.passwordChangedAt == null;
      let tempPassword = "";
      if (credentialsSent) {
        tempPassword = generateTempPassword();
        const passwordHash = hashPassword(tempPassword);
        await fetchOne(
          `
          UPDATE "User"
          SET "passwordHash" = %(password_hash)s
          WHERE "id" = %(user_id)s
          RETURNING "id";
          `,
          { password_hash: passwordHash, user_id: adminRow.id }
        );
      }
      const loginLink = `${frontendBaseUrl()}/?view=login`;
      const args = [
        "--to",
        adminRow.email,
        "--name",
        adminRow.name || "there",
        "--org",
        orgRow.name,
        "--month",
        formatMonthLabel(resolvedMonthKey),
        "--link",
        loginLink,
      ];
      if (credentialsSent) {
        args.push("--email", adminRow.email, "--temp", tempPassword);
      }
      const result = await runNodeScript("src/sendReleaseEmail.js", args);
      if (result.code !== 0) {
        return textResponse(
          res,
          500,
          result.stderr || "Unable to send release email."
        );
      }
      await fetchOne(
        `
        INSERT INTO "DashboardRelease" ("id", "organizationId", "dashboardMonthId", "releasedAt")
        SELECT %(id)s, %(organization_id)s, dm."id", NOW()
        FROM "DashboardMonth" dm
        WHERE dm."monthKey" = %(month_key)s
        ON CONFLICT ("organizationId", "dashboardMonthId")
        DO UPDATE SET "releasedAt" = NOW()
        RETURNING "id";
        `,
        {
          id: randomUUID(),
          organization_id: orgId,
          month_key: resolvedMonthKey,
        }
      );
      return jsonResponse(res, 200, {
        message: "Dashboard released to organization admin.",
        organizationId: orgId,
        monthKey: resolvedMonthKey,
        adminEmail: adminRow.email,
        credentialsSent,
      });
    }

    if (method === "POST" && pathname === "/admin/dashboard/delete") {
      const payload = await readJson(req);
      const [orgId, dashboardMonthId, resolvedMonthKey] =
        await resolveOrgMonthScope(payload.organizationId, payload.monthKey);
      if (!orgId || !dashboardMonthId || !resolvedMonthKey) {
        return textResponse(res, 400, "Invalid organization or month.");
      }
      let uploadIds = [];
      await withTransaction(async (client) => {
        const { text, values } = replaceParams(
          `
          SELECT DISTINCT u."id"
          FROM "Upload" u
          WHERE u."organizationId" = %(organization_id)s
            AND u."dashboardMonthId" = %(dashboard_month_id)s
          UNION
          SELECT DISTINCT edm."uploadId"
          FROM "employee_dashboard_master" edm
          WHERE edm."organizationId" = %(organization_id)s
            AND edm."dashboardMonthId" = %(dashboard_month_id)s
            AND edm."uploadId" IS NOT NULL;
          `,
          {
            organization_id: orgId,
            dashboard_month_id: dashboardMonthId,
          }
        );
        const uploadResult = await client.query(text, values);
        uploadIds = uploadResult.rows.map((row) => row.id);
        const exec = async (query, params) => {
          const prepared = replaceParams(query, params);
          await client.query(prepared.text, prepared.values);
        };
        await exec(
          `
          DELETE FROM "DashboardRelease"
          WHERE "organizationId" = %(organization_id)s
            AND "dashboardMonthId" = %(dashboard_month_id)s;
          `,
          { organization_id: orgId, dashboard_month_id: dashboardMonthId }
        );
        await exec(
          `
          DELETE FROM "employee_dashboard_master"
          WHERE "organizationId" = %(organization_id)s
            AND "dashboardMonthId" = %(dashboard_month_id)s;
          `,
          { organization_id: orgId, dashboard_month_id: dashboardMonthId }
        );
        if (uploadIds.length) {
          await exec(
            `
            DELETE FROM "LTIP"
            WHERE "uploadId" = ANY(%(upload_ids)s);
            `,
            { upload_ids: uploadIds }
          );
          await exec(
            `
            DELETE FROM "Experience"
            WHERE "uploadId" = ANY(%(upload_ids)s);
            `,
            { upload_ids: uploadIds }
          );
          await exec(
            `
            DELETE FROM "Education"
            WHERE "uploadId" = ANY(%(upload_ids)s);
            `,
            { upload_ids: uploadIds }
          );
          await exec(
            `
            DELETE FROM "Employee"
            WHERE "uploadId" = ANY(%(upload_ids)s);
            `,
            { upload_ids: uploadIds }
          );
          await exec(
            `
            DELETE FROM "employee_dashboard_master"
            WHERE "uploadId" = ANY(%(upload_ids)s);
            `,
            { upload_ids: uploadIds }
          );
          await exec(
            `
            DELETE FROM "Upload"
            WHERE "id" = ANY(%(upload_ids)s);
            `,
            { upload_ids: uploadIds }
          );
        }
      });
      return jsonResponse(res, 200, {
        message: "Dashboard data deleted.",
        organizationId: orgId,
        monthKey: resolvedMonthKey,
        deletedUploads: uploadIds.length,
      });
    }

    if (method === "GET" && pathname === "/reports/dashboard.pdf") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return textResponse(res, 400, "Missing dashboard URL.");
      }
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hr-pdf-"));
      const outputPath = path.join(tmpDir, "dashboard.pdf");
      const result = await runNodeScript("src/renderDashboardPdf.js", [
        "--url",
        targetUrl,
        "--output",
        outputPath,
      ]);
      if (result.code !== 0 || !fs.existsSync(outputPath)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return textResponse(res, 500, result.stderr || "Unable to generate PDF.");
      }
      const fileBuffer = fs.readFileSync(outputPath);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="dashboard.pdf"');
      res.end(fileBuffer);
      return;
    }

    return textResponse(res, 404, "Not found.");
  } catch (error) {
    const status = error.status || 500;
    return textResponse(res, status, error.message || "Server error.");
  }
};
