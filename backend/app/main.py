import calendar
import json
import uuid
import shutil
import subprocess
import tempfile
import os
import secrets
import string
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict, EmailStr

from .db import fetch_all, fetch_one, pool
from .employee_summary import register_employee_summary_routes
from .ai_summary import register_ai_summary_routes
from .auth import verify_password, hash_password
from .config import get_settings

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SERVER_DIR = PROJECT_ROOT / "server"
INGEST_SCRIPT_CMD = ["npm", "run", "ingest", "--"]
RESET_EMAIL_CMD = ["node", "src/sendResetEmail.js"]
RELEASE_EMAIL_CMD = ["node", "src/sendReleaseEmail.js"]
RENDER_PDF_CMD = ["node", "src/renderDashboardPdf.js"]
TEMPLATE_XLSX_CMD = ["node", "src/generateTemplate.js"]
TEMPLATE_EMAIL_CMD = ["node", "src/sendTemplateEmail.js"]
CONTACT_EMAIL_CMD = ["node", "src/sendContactEmail.js"]
ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}


class IngestStats(BaseModel):
    employees: int = 0
    educations: int = 0
    experiences: int = 0
    ltip: int = 0
    dashboards: int = 0
    skippedEducation: int = 0
    skippedExperience: int = 0
    skippedDashboard: int = 0
    skippedLtip: int = 0


class UploadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    upload_id: str = Field(..., alias="uploadId")
    stats: IngestStats
    raw_stdout: str | None = None
    raw_stderr: str | None = None


class OrganizationPayload(BaseModel):
    name: str
    code: str | None = None
    admin_name: str | None = None
    admin_email: str | None = None
    admin_password: str | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    code: str | None = None
    uploads: int = 0


class OrganizationDetailResponse(BaseModel):
    id: str
    name: str
    code: str | None = None
    admin_name: str | None = None
    admin_email: str | None = None


class OverviewSummaryItem(BaseModel):
    label: str
    value: int
    meta: str | None = None


class OverviewUpload(BaseModel):
    name: str
    org: str | None = None
    date: str
    rows: int = 0


class OverviewOrganization(BaseModel):
    name: str
    sector: str | None = None
    count: int = 0


class AdminOverviewResponse(BaseModel):
    summary: list[OverviewSummaryItem]
    uploads: list[OverviewUpload]
    organizations: list[OverviewOrganization]


class OrgMetricsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: str = Field(..., alias="organizationId")
    organization_name: str = Field(..., alias="organizationName")
    dashboards: int = 0
    reports: int = 0


class LatestDashboardMonthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: str = Field(..., alias="organizationId")
    month_key: str | None = Field(None, alias="monthKey")
    month_label: str | None = Field(None, alias="monthLabel")


class OrgDashboardMonthItem(BaseModel):
    month_key: str = Field(..., alias="monthKey")
    month_label: str = Field(..., alias="monthLabel")


class OrgDashboardMonthsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: str = Field(..., alias="organizationId")
    months: list[OrgDashboardMonthItem]


class DashboardConfigItem(BaseModel):
    key: str
    enabled: bool


class DashboardConfigResponse(BaseModel):
    organization_id: str = Field(..., alias="organizationId")
    charts: list[DashboardConfigItem]


class DashboardConfigPayload(BaseModel):
    organization_id: str = Field(..., alias="organizationId")
    charts: list[DashboardConfigItem]


class ReleaseDashboardPayload(BaseModel):
    organization_id: str = Field(..., alias="organizationId")
    month_key: str = Field(..., alias="monthKey")


class ReleaseDashboardResponse(BaseModel):
    message: str
    organization_id: str = Field(..., alias="organizationId")
    month_key: str = Field(..., alias="monthKey")
    admin_email: str = Field(..., alias="adminEmail")
    credentials_sent: bool = Field(..., alias="credentialsSent")


class DeleteDashboardPayload(BaseModel):
    organization_id: str = Field(..., alias="organizationId")
    month_key: str = Field(..., alias="monthKey")


class DeleteDashboardResponse(BaseModel):
    message: str
    organization_id: str = Field(..., alias="organizationId")
    month_key: str = Field(..., alias="monthKey")
    deleted_uploads: int = Field(..., alias="deletedUploads")

class LoginPayload(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    id: str
    name: str | None = None
    email: str
    role: str
    organization_id: str | None = Field(None, alias="organizationId")


class ForgotPasswordPayload(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordPayload(BaseModel):
    token: str
    password: str


class DemoLeadPayload(BaseModel):
    email: EmailStr
    source: str | None = None


class DemoLeadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    email: str
    source: str | None = None
    created_at: datetime = Field(..., alias="createdAt")


class DemoLeadListItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    email: str
    source: str | None = None
    created_at: datetime = Field(..., alias="createdAt")


class DemoLeadListResponse(BaseModel):
    leads: list[DemoLeadListItem]


class TemplateEmailPayload(BaseModel):
    organization_id: str = Field(..., alias="organizationId")


class TemplateEmailResponse(BaseModel):
    message: str


class ContactPayload(BaseModel):
    first_name: str = Field(..., min_length=1)
    last_name: str | None = None
    email: EmailStr
    company: str | None = None
    team_size: str | None = None
    message: str = Field(..., min_length=1)


class ContactResponse(BaseModel):
    message: str


def create_app() -> FastAPI:
    app = FastAPI(title="HR Automation API")
    settings = get_settings()
    frontend_base_url = (
        settings.frontend_base_url
        or (f"http://localhost:{settings.frontend_port}" if settings.frontend_port else None)
        or "http://localhost:5173"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_employee_summary_routes(app)
    register_ai_summary_routes(app)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/templates/upload", tags=["templates"])
    def download_upload_template() -> FileResponse:
        if not SERVER_DIR.exists():
            raise HTTPException(status_code=500, detail="Template service missing.")

        tmp_dir = Path(tempfile.mkdtemp(prefix="hr-template-"))
        out_path = tmp_dir / "hr_upload_template.xlsx"
        try:
            cmd = [*TEMPLATE_XLSX_CMD, "--out", str(out_path.resolve())]
            proc = subprocess.run(
                cmd,
                cwd=str(SERVER_DIR),
                capture_output=True,
                text=True,
            )
            stdout = proc.stdout.strip()
            stderr = proc.stderr.strip()
            if proc.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Template generation failed. {stderr or stdout}",
                )
            if not out_path.exists():
                raise HTTPException(
                    status_code=500, detail="Template generation failed."
                )
            return FileResponse(
                out_path,
                filename="hr_upload_template.xlsx",
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                background=BackgroundTask(shutil.rmtree, tmp_dir, ignore_errors=True),
            )
        except HTTPException:
            raise
        except Exception as err:
            raise HTTPException(
                status_code=500, detail=f"Template generation failed. {err}"
            )

    @app.post("/templates/upload/email", response_model=TemplateEmailResponse, tags=["templates"])
    def send_upload_template(payload: TemplateEmailPayload) -> TemplateEmailResponse:
        organization_id = payload.organization_id
        org_row = fetch_one(
            """
            SELECT "name"
            FROM "Organization"
            WHERE "id" = %(organization_id)s
            LIMIT 1;
            """,
            {"organization_id": organization_id},
        )
        if not org_row:
            raise HTTPException(status_code=404, detail="Organization not found.")
        user_row = fetch_one(
            """
            SELECT "email", "name"
            FROM "User"
            WHERE "organizationId" = %(organization_id)s
              AND "role" = 'ORG_ADMIN'
            ORDER BY "createdAt" DESC NULLS LAST
            LIMIT 1;
            """,
            {"organization_id": organization_id},
        )
        if not user_row or not user_row.get("email"):
            raise HTTPException(
                status_code=404, detail="Org admin email not found."
            )

        cmd = [
            *TEMPLATE_EMAIL_CMD,
            "--to",
            user_row["email"],
            "--name",
            user_row.get("name") or "there",
            "--org",
            org_row["name"],
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(SERVER_DIR),
            capture_output=True,
            text=True,
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Email send failed. {stderr or stdout}",
            )
        return TemplateEmailResponse(message="Template email sent.")

    @app.post("/contact", response_model=ContactResponse, tags=["contact"])
    def submit_contact(payload: ContactPayload) -> ContactResponse:
        if not SERVER_DIR.exists():
            raise HTTPException(status_code=500, detail="Email service missing.")

        contact_email = settings.contact_email or "insights@zarohr.com"
        first_name = payload.first_name.strip()
        last_name = payload.last_name.strip() if payload.last_name else ""
        full_name = " ".join(part for part in [first_name, last_name] if part) or "there"
        company = payload.company.strip() if payload.company else ""
        team_size = payload.team_size.strip() if payload.team_size else ""
        message = payload.message.strip()

        cmd = [
            *CONTACT_EMAIL_CMD,
            "--to",
            contact_email,
            "--name",
            full_name,
            "--email",
            payload.email,
            "--company",
            company,
            "--team-size",
            team_size,
            "--message",
            message,
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(SERVER_DIR),
            capture_output=True,
            text=True,
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Contact email failed. {stderr or stdout}",
            )
        return ContactResponse(message="Contact request sent.")

    @app.post("/leads/demo", response_model=DemoLeadResponse, tags=["leads"])
    def capture_demo_lead(payload: DemoLeadPayload) -> DemoLeadResponse:
        email = payload.email.strip().lower()
        source = payload.source.strip() if payload.source else None
        row = fetch_one(
            """
            INSERT INTO "DemoLead" ("id", "email", "source")
            VALUES (%(id)s, %(email)s, %(source)s)
            ON CONFLICT ("email")
            DO UPDATE SET "source" = COALESCE(EXCLUDED."source", "DemoLead"."source")
            RETURNING "id", "email", "source", "createdAt";
            """,
            {
                "id": str(uuid.uuid4()),
                "email": email,
                "source": source,
            },
        )
        if not row:
            raise HTTPException(status_code=500, detail="Unable to store demo lead.")
        return DemoLeadResponse(**row)

    @app.get("/leads/demo", response_model=DemoLeadListResponse, tags=["leads"])
    def list_demo_leads(
        limit: int | None = Query(None, ge=1, le=10000)
    ) -> DemoLeadListResponse:
        params: dict[str, Any] = {}
        limit_clause = ""
        if limit is not None:
            params["limit"] = limit
            limit_clause = 'LIMIT %(limit)s'

        rows = fetch_all(
            f"""
            SELECT "id", "email", "source", "createdAt"
            FROM "DemoLead"
            ORDER BY "createdAt" DESC
            {limit_clause};
            """,
            params,
        )
        return DemoLeadListResponse(leads=rows or [])

    @app.post("/uploads", response_model=UploadResponse, tags=["uploads"])
    async def ingest_excel(
        file: UploadFile = File(...),
        organization_name: str | None = Form(None),
        organization_code: str | None = Form(None),
        month_key: str | None = Form(None),
        month_label: str | None = Form(None),
    ) -> UploadResponse:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Invalid file type")

        if not SERVER_DIR.exists():
            raise HTTPException(status_code=500, detail="Ingestion service missing.")

        tmp_dir = Path(tempfile.mkdtemp(prefix="hr-upload-"))
        tmp_path = tmp_dir / file.filename

        try:
            with tmp_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            cmd = [*INGEST_SCRIPT_CMD, str(tmp_path.resolve())]
            if organization_name:
                cmd.extend(["--org-name", organization_name])
            if organization_code:
                cmd.extend(["--org-code", organization_code])
            if month_key:
                cmd.extend(["--month-key", month_key])
            if month_label:
                cmd.extend(["--month-label", month_label])
            proc = subprocess.run(
                cmd,
                cwd=str(SERVER_DIR),
                capture_output=True,
                text=True,
            )

            stdout = proc.stdout.strip()
            stderr = proc.stderr.strip()

            if proc.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Ingestion failed. {stderr or stdout}",
                )

            payload = _parse_ingest_output(stdout)
            if not payload:
                raise HTTPException(
                    status_code=500,
                    detail="Ingestion succeeded but returned empty output.",
                )

            return UploadResponse(
                upload_id=payload.get("uploadId", ""),
                stats=IngestStats(**payload.get("stats", {})),
                raw_stdout=stdout,
                raw_stderr=stderr or None,
            )
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @app.get("/analytics/entities", tags=["analytics"])
    def list_entities(
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
    ) -> dict[str, list[str]]:
        org_id, dashboard_month_id, _ = _resolve_org_month_scope(
            organization_id, month_key
        )
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        rows = fetch_all(
            f"""
            {_build_snapshot_cte(filter_org, filter_month)}
            SELECT DISTINCT COALESCE(latest."Entity", '') AS entity
            FROM latest
            WHERE latest."Entity" IS NOT NULL
            ORDER BY entity;
            """,
            {
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        return {"entities": [row["entity"] for row in rows]}

    @app.get("/organizations", tags=["organizations"])
    def list_organizations() -> dict[str, list[OrganizationResponse]]:
        rows = fetch_all(
            """
            SELECT
                o."id",
                o."name",
                o."code",
                COUNT(u.id)::int AS uploads
            FROM "Organization" o
            LEFT JOIN "Upload" u ON u."organizationId" = o."id"
            GROUP BY o."id"
            ORDER BY o."name";
            """,
            {},
        )
        return {"organizations": [OrganizationResponse(**row) for row in rows]}

    @app.get(
        "/organizations/{organization_id}",
        response_model=OrganizationDetailResponse,
        tags=["organizations"],
    )
    def get_organization(organization_id: str) -> OrganizationDetailResponse:
        row = fetch_one(
            """
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
            """,
            {"organization_id": organization_id},
        )
        if not row:
            raise HTTPException(status_code=404, detail="Organization not found.")
        return OrganizationDetailResponse(**row)

    @app.post("/organizations", response_model=OrganizationResponse, tags=["organizations"])
    def create_organization(payload: OrganizationPayload) -> OrganizationResponse:
        organization_id = str(uuid.uuid4())
        row = fetch_one(
            """
            INSERT INTO "Organization" ("id", "name", "code")
            VALUES (%(id)s, %(name)s, %(code)s)
            ON CONFLICT ("name")
            DO UPDATE SET "code" = COALESCE(EXCLUDED."code", "Organization"."code")
            RETURNING "id", "name", "code";
            """,
            {
                "id": organization_id,
                "name": payload.name.strip(),
                "code": payload.code or None,
            },
        )
        if not row:
            raise HTTPException(status_code=500, detail="Unable to save organization.")
        if payload.admin_email:
            admin_name = (payload.admin_name or "").strip() or None
            temp_password = payload.admin_password or _generate_temp_password()
            password_hash = hash_password(temp_password)
            fetch_one(
                """
                INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "organizationId")
                VALUES (%(id)s, %(name)s, %(email)s, %(password_hash)s, 'ORG_ADMIN', %(organization_id)s)
                ON CONFLICT ("email")
                DO UPDATE SET
                  "name" = EXCLUDED."name",
                  "passwordHash" = EXCLUDED."passwordHash",
                  "role" = EXCLUDED."role",
                  "organizationId" = EXCLUDED."organizationId"
                RETURNING "id";
                """,
                {
                    "id": str(uuid.uuid4()),
                    "name": admin_name,
                    "email": payload.admin_email.strip().lower(),
                    "password_hash": password_hash,
                    "organization_id": row["id"],
                },
            )
        return OrganizationResponse(**row, uploads=0)

    @app.put("/organizations/{organization_id}", response_model=OrganizationResponse, tags=["organizations"])
    def update_organization(
        organization_id: str, payload: OrganizationPayload
    ) -> OrganizationResponse:
        row = fetch_one(
            """
            UPDATE "Organization"
            SET "name" = %(name)s,
                "code" = %(code)s
            WHERE "id" = %(organization_id)s
            RETURNING "id", "name", "code";
            """,
            {
                "organization_id": organization_id,
                "name": payload.name.strip(),
                "code": payload.code or None,
            },
        )
        if not row:
            raise HTTPException(status_code=404, detail="Organization not found.")
        if payload.admin_email:
            admin_name = (payload.admin_name or "").strip() or None
            temp_password = payload.admin_password or _generate_temp_password()
            password_hash = hash_password(temp_password)
            fetch_one(
                """
                INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "organizationId")
                VALUES (%(id)s, %(name)s, %(email)s, %(password_hash)s, 'ORG_ADMIN', %(organization_id)s)
                ON CONFLICT ("email")
                DO UPDATE SET
                  "name" = EXCLUDED."name",
                  "passwordHash" = EXCLUDED."passwordHash",
                  "role" = EXCLUDED."role",
                  "organizationId" = EXCLUDED."organizationId"
                RETURNING "id";
                """,
                {
                    "id": str(uuid.uuid4()),
                    "name": admin_name,
                    "email": payload.admin_email.strip().lower(),
                    "password_hash": password_hash,
                    "organization_id": row["id"],
                },
            )
        uploads_row = fetch_one(
            """
            SELECT COUNT(u.id)::int AS uploads
            FROM "Upload" u
            WHERE u."organizationId" = %(organization_id)s;
            """,
            {"organization_id": row["id"]},
        )
        uploads = uploads_row["uploads"] if uploads_row else 0
        return OrganizationResponse(**row, uploads=uploads)

    @app.delete("/organizations/{organization_id}", response_model=OrganizationResponse, tags=["organizations"])
    def delete_organization(organization_id: str) -> OrganizationResponse:
        org_row = fetch_one(
            """
            SELECT "id", "name", "code"
            FROM "Organization"
            WHERE "id" = %(organization_id)s
            LIMIT 1;
            """,
            {"organization_id": organization_id},
        )
        if not org_row:
            raise HTTPException(status_code=404, detail="Organization not found.")

        params = {"organization_id": organization_id}
        with pool.connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        DELETE FROM "PasswordReset"
                        WHERE "userId" IN (
                            SELECT "id" FROM "User" WHERE "organizationId" = %(organization_id)s
                        );
                        """,
                        params,
                    )
                    cursor.execute(
                        'DELETE FROM "DashboardRelease" WHERE "organizationId" = %(organization_id)s;',
                        params,
                    )
                    cursor.execute(
                        'DELETE FROM "DashboardConfig" WHERE "organizationId" = %(organization_id)s;',
                        params,
                    )
                    cursor.execute(
                        'DELETE FROM "User" WHERE "organizationId" = %(organization_id)s;',
                        params,
                    )
                    cursor.execute(
                        'DELETE FROM "employee_dashboard_master" WHERE "organizationId" = %(organization_id)s;',
                        params,
                    )
                    cursor.execute(
                        """
                        DELETE FROM "LTIP"
                        WHERE "uploadId" IN (
                            SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
                        );
                        """,
                        params,
                    )
                    cursor.execute(
                        """
                        DELETE FROM "Experience"
                        WHERE "uploadId" IN (
                            SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
                        );
                        """,
                        params,
                    )
                    cursor.execute(
                        """
                        DELETE FROM "Education"
                        WHERE "uploadId" IN (
                            SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
                        );
                        """,
                        params,
                    )
                    cursor.execute(
                        """
                        DELETE FROM "Employee"
                        WHERE "uploadId" IN (
                            SELECT "id" FROM "Upload" WHERE "organizationId" = %(organization_id)s
                        );
                        """,
                        params,
                    )
                    cursor.execute(
                        'DELETE FROM "Upload" WHERE "organizationId" = %(organization_id)s;',
                        params,
                    )
                    cursor.execute(
                        'DELETE FROM "Organization" WHERE "id" = %(organization_id)s;',
                        params,
                    )

        return OrganizationResponse(**org_row, uploads=0)

    @app.get("/admin/overview", response_model=AdminOverviewResponse, tags=["admin"])
    def admin_overview() -> AdminOverviewResponse:
        org_count_row = fetch_one('SELECT COUNT(*)::int AS count FROM "Organization";', {})
        demo_lead_count_row = fetch_one('SELECT COUNT(*)::int AS count FROM "DemoLead";', {})
        employee_count_row = fetch_one(
            """
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
            """,
            {},
        )
        dashboard_count_row = fetch_one(
            """
            SELECT COUNT(DISTINCT (u."organizationId", u."dashboardMonthId"))::int AS count
            FROM "Upload" u
            WHERE u."organizationId" IS NOT NULL AND u."dashboardMonthId" IS NOT NULL;
            """,
            {},
        )
        uploads = fetch_all(
            """
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
            """,
            {},
        )
        organizations = fetch_all(
            """
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
            """,
            {},
        )

        summary = [
            OverviewSummaryItem(label="Total Organizations", value=org_count_row["count"] if org_count_row else 0),
            OverviewSummaryItem(label="Total Employees", value=employee_count_row["count"] if employee_count_row else 0),
            OverviewSummaryItem(label="Contact Leads", value=demo_lead_count_row["count"] if demo_lead_count_row else 0),
            OverviewSummaryItem(label="Active Dashboards", value=dashboard_count_row["count"] if dashboard_count_row else 0),
        ]

        return AdminOverviewResponse(
            summary=summary,
            uploads=[
                OverviewUpload(
                    name=row["name"] or "Untitled upload",
                    org=row["org"],
                    date=row["uploaded_at"].date().isoformat() if row["uploaded_at"] else "",
                    rows=row["rows"],
                )
                for row in uploads
            ],
            organizations=[
                OverviewOrganization(
                    name=row["name"],
                    sector=row["sector"],
                    count=row["count"],
                )
                for row in organizations
            ],
        )

    @app.get("/org/metrics", response_model=OrgMetricsResponse, tags=["org-admin"])
    def org_metrics(
        organization_id: str = Query(..., alias="organizationId"),
    ) -> OrgMetricsResponse:
        org_row = fetch_one(
            """
            SELECT o."name"
            FROM "Organization" o
            WHERE o."id" = %(organization_id)s
            LIMIT 1;
            """,
            {"organization_id": organization_id},
        )
        if not org_row:
            raise HTTPException(status_code=404, detail="Organization not found.")

        dashboards_row = fetch_one(
            """
            SELECT COUNT(*)::int AS count
            FROM "DashboardRelease" dr
            WHERE dr."organizationId" = %(organization_id)s;
            """,
            {"organization_id": organization_id},
        )
        uploads_row = fetch_one(
            """
            SELECT COUNT(*)::int AS count
            FROM "Upload" u
            WHERE u."organizationId" = %(organization_id)s;
            """,
            {"organization_id": organization_id},
        )
        dashboards_count = dashboards_row["count"] if dashboards_row else 0
        uploads_count = uploads_row["count"] if uploads_row else 0

        return OrgMetricsResponse(
            organizationId=organization_id,
            organizationName=org_row["name"],
            dashboards=dashboards_count,
            reports=uploads_count,
        )

    @app.get(
        "/org/latest-dashboard-month",
        response_model=LatestDashboardMonthResponse,
        tags=["org-admin"],
    )
    def latest_dashboard_month(
        organization_id: str = Query(..., alias="organizationId"),
    ) -> LatestDashboardMonthResponse:
        row = fetch_one(
            """
            SELECT dr."organizationId" AS organization_id, dm."monthKey" AS month_key
            FROM "DashboardRelease" dr
            JOIN "DashboardMonth" dm ON dm."id" = dr."dashboardMonthId"
            WHERE dr."organizationId" = %(organization_id)s
            ORDER BY dr."releasedAt" DESC, dm."monthKey" DESC
            LIMIT 1;
            """,
            {"organization_id": organization_id},
        )
        if not row:
            raise HTTPException(status_code=404, detail="No released dashboards.")
        return LatestDashboardMonthResponse(
            organizationId=row["organization_id"],
            monthKey=row["month_key"],
            monthLabel=_format_month_label(row["month_key"])
            if row["month_key"]
            else None,
        )

    @app.get(
        "/org/dashboard-months",
        response_model=OrgDashboardMonthsResponse,
        tags=["org-admin"],
    )
    def org_dashboard_months(
        organization_id: str = Query(..., alias="organizationId"),
    ) -> OrgDashboardMonthsResponse:
        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization is required.")
        rows = fetch_all(
            """
            SELECT DISTINCT dm."monthKey" AS month_key
            FROM "DashboardRelease" dr
            JOIN "DashboardMonth" dm ON dm."id" = dr."dashboardMonthId"
            WHERE dr."organizationId" = %(organization_id)s
            ORDER BY dm."monthKey" DESC;
            """,
            {"organization_id": organization_id},
        )
        months = [
            OrgDashboardMonthItem(
                monthKey=row["month_key"],
                monthLabel=_format_month_label(row["month_key"]),
            )
            for row in rows
            if row.get("month_key")
        ]
        return OrgDashboardMonthsResponse(
            organizationId=organization_id,
            months=months,
        )

    @app.get(
        "/admin/dashboard-months",
        response_model=OrgDashboardMonthsResponse,
        tags=["admin"],
    )
    def admin_dashboard_months(
        organization_id: str = Query(..., alias="organizationId"),
    ) -> OrgDashboardMonthsResponse:
        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization is required.")
        rows = fetch_all(
            """
            SELECT DISTINCT dm."monthKey" AS month_key
            FROM "Upload" u
            JOIN "DashboardMonth" dm ON dm."id" = u."dashboardMonthId"
            WHERE u."organizationId" = %(organization_id)s
              AND u."dashboardMonthId" IS NOT NULL
            ORDER BY dm."monthKey" DESC;
            """,
            {"organization_id": organization_id},
        )
        months = [
            OrgDashboardMonthItem(
                monthKey=row["month_key"],
                monthLabel=_format_month_label(row["month_key"]),
            )
            for row in rows
            if row.get("month_key")
        ]
        return OrgDashboardMonthsResponse(
            organizationId=organization_id,
            months=months,
        )

    @app.get("/admin/dashboard-config", response_model=DashboardConfigResponse, tags=["admin"])
    def get_dashboard_config(organization_id: str = Query(..., alias="organizationId")) -> DashboardConfigResponse:
        rows = fetch_all(
            """
            SELECT "chartKey" AS key, "enabled"
            FROM "DashboardConfig"
            WHERE "organizationId" = %(organization_id)s
            ORDER BY "chartKey";
            """,
            {"organization_id": organization_id},
        )
        return DashboardConfigResponse(
            organizationId=organization_id,
            charts=[DashboardConfigItem(**row) for row in rows],
        )

    @app.post("/admin/dashboard-config", response_model=DashboardConfigResponse, tags=["admin"])
    def save_dashboard_config(payload: DashboardConfigPayload) -> DashboardConfigResponse:
        for item in payload.charts:
            fetch_one(
                """
                INSERT INTO "DashboardConfig" ("id", "organizationId", "chartKey", "enabled", "updatedAt")
                VALUES (%(id)s, %(organization_id)s, %(chart_key)s, %(enabled)s, NOW())
                ON CONFLICT ("organizationId", "chartKey")
                DO UPDATE SET "enabled" = EXCLUDED."enabled", "updatedAt" = NOW()
                RETURNING "id";
                """,
                {
                    "id": str(uuid.uuid4()),
                    "organization_id": payload.organization_id,
                    "chart_key": item.key,
                    "enabled": item.enabled,
                },
            )
        return DashboardConfigResponse(
            organizationId=payload.organization_id,
            charts=payload.charts,
        )

    @app.post("/admin/release-dashboard", response_model=ReleaseDashboardResponse, tags=["admin"])
    def release_dashboard(payload: ReleaseDashboardPayload) -> ReleaseDashboardResponse:
        org_id, _, resolved_month_key = _resolve_org_month_scope(
            payload.organization_id, payload.month_key
        )
        if not org_id or not resolved_month_key:
            raise HTTPException(status_code=400, detail="Invalid organization or month.")
        org_row = fetch_one(
            """
            SELECT "name"
            FROM "Organization"
            WHERE "id" = %(organization_id)s
            LIMIT 1;
            """,
            {"organization_id": org_id},
        )
        if not org_row:
            raise HTTPException(status_code=404, detail="Organization not found.")
        admin_row = fetch_one(
            """
            SELECT "id", "name", "email", "passwordChangedAt"
            FROM "User"
            WHERE "organizationId" = %(organization_id)s
              AND "role" = 'ORG_ADMIN'
            ORDER BY "email"
            LIMIT 1;
            """,
            {"organization_id": org_id},
        )
        if not admin_row:
            raise HTTPException(
                status_code=404,
                detail="Organization admin not found for this organization.",
            )
        credentials_sent = admin_row["passwordChangedAt"] is None
        temp_password = ""
        if credentials_sent:
            temp_password = _generate_temp_password()
            password_hash = hash_password(temp_password)
            fetch_one(
                """
                UPDATE "User"
                SET "passwordHash" = %(password_hash)s
                WHERE "id" = %(user_id)s
                RETURNING "id";
                """,
                {"password_hash": password_hash, "user_id": admin_row["id"]},
            )
        month_label = _format_month_label(resolved_month_key)
        login_link = f"{frontend_base_url}/?view=login"
        cmd = [
            *RELEASE_EMAIL_CMD,
            "--to",
            admin_row["email"],
            "--name",
            admin_row.get("name") or "there",
            "--org",
            org_row["name"],
            "--month",
            month_label,
            "--link",
            login_link,
        ]
        if credentials_sent:
            cmd.extend(["--email", admin_row["email"], "--temp", temp_password])
        proc = subprocess.run(
            cmd,
            cwd=str(SERVER_DIR),
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=proc.stderr.strip() or "Unable to send release email.",
            )
        fetch_one(
            """
            INSERT INTO "DashboardRelease" ("id", "organizationId", "dashboardMonthId", "releasedAt")
            SELECT %(id)s, %(organization_id)s, dm."id", NOW()
            FROM "DashboardMonth" dm
            WHERE dm."monthKey" = %(month_key)s
            ON CONFLICT ("organizationId", "dashboardMonthId")
            DO UPDATE SET "releasedAt" = NOW()
            RETURNING "id";
            """,
            {
                "id": str(uuid.uuid4()),
                "organization_id": org_id,
                "month_key": resolved_month_key,
            },
        )
        return ReleaseDashboardResponse(
            message="Dashboard released to organization admin.",
            organizationId=org_id,
            monthKey=resolved_month_key,
            adminEmail=admin_row["email"],
            credentialsSent=credentials_sent,
        )

    @app.post("/admin/dashboard/delete", response_model=DeleteDashboardResponse, tags=["admin"])
    def delete_dashboard(payload: DeleteDashboardPayload) -> DeleteDashboardResponse:
        org_id, dashboard_month_id, resolved_month_key = _resolve_org_month_scope(
            payload.organization_id, payload.month_key
        )
        if not org_id or not dashboard_month_id or not resolved_month_key:
            raise HTTPException(status_code=400, detail="Invalid organization or month.")

        params = {
            "organization_id": org_id,
            "dashboard_month_id": dashboard_month_id,
        }
        upload_ids: list[str] = []
        with pool.connection() as conn:
            with conn.transaction():
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
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
                        """,
                        params,
                    )
                    upload_ids = [row[0] for row in cursor.fetchall()]
                    cursor.execute(
                        """
                        DELETE FROM "DashboardRelease"
                        WHERE "organizationId" = %(organization_id)s
                          AND "dashboardMonthId" = %(dashboard_month_id)s;
                        """,
                        params,
                    )
                    cursor.execute(
                        """
                        DELETE FROM "employee_dashboard_master"
                        WHERE "organizationId" = %(organization_id)s
                          AND "dashboardMonthId" = %(dashboard_month_id)s;
                        """,
                        params,
                    )
                    if upload_ids:
                        cursor.execute(
                            """
                            DELETE FROM "LTIP"
                            WHERE "uploadId" = ANY(%(upload_ids)s);
                            """,
                            {"upload_ids": upload_ids},
                        )
                        cursor.execute(
                            """
                            DELETE FROM "Experience"
                            WHERE "uploadId" = ANY(%(upload_ids)s);
                            """,
                            {"upload_ids": upload_ids},
                        )
                        cursor.execute(
                            """
                            DELETE FROM "Education"
                            WHERE "uploadId" = ANY(%(upload_ids)s);
                            """,
                            {"upload_ids": upload_ids},
                        )
                        cursor.execute(
                            """
                            DELETE FROM "Employee"
                            WHERE "uploadId" = ANY(%(upload_ids)s);
                            """,
                            {"upload_ids": upload_ids},
                        )
                        cursor.execute(
                            """
                            DELETE FROM "employee_dashboard_master"
                            WHERE "uploadId" = ANY(%(upload_ids)s);
                            """,
                            {"upload_ids": upload_ids},
                        )
                        cursor.execute(
                            """
                            DELETE FROM "Upload"
                            WHERE "id" = ANY(%(upload_ids)s);
                            """,
                            {"upload_ids": upload_ids},
                        )

        return DeleteDashboardResponse(
            message="Dashboard data deleted.",
            organizationId=org_id,
            monthKey=resolved_month_key,
            deletedUploads=len(upload_ids),
        )

    @app.post("/auth/login", response_model=LoginResponse, tags=["auth"])
    def login(payload: LoginPayload) -> LoginResponse:
        row = fetch_one(
            """
            SELECT "id", "name", "email", "passwordHash", "role", "organizationId"
            FROM "User"
            WHERE LOWER("email") = LOWER(%(email)s)
            LIMIT 1;
            """,
            {"email": payload.email.strip()},
        )
        if not row or not verify_password(payload.password, row["passwordHash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        return LoginResponse(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            role=row["role"],
            organizationId=row["organizationId"],
        )

    @app.post("/auth/forgot", response_model=ForgotPasswordResponse, tags=["auth"])
    def forgot_password(payload: ForgotPasswordPayload) -> ForgotPasswordResponse:
        row = fetch_one(
            """
            SELECT "id", "name", "email"
            FROM "User"
            WHERE LOWER("email") = LOWER(%(email)s)
            LIMIT 1;
            """,
            {"email": payload.email.strip()},
        )
        if row:
            reset_token = str(uuid.uuid4())
            expires_at = datetime.utcnow() + timedelta(hours=2)
            fetch_one(
                """
                INSERT INTO "PasswordReset" ("id", "token", "userId", "expiresAt")
                VALUES (%(id)s, %(token)s, %(user_id)s, %(expires_at)s)
                RETURNING "id";
                """,
                {
                    "id": str(uuid.uuid4()),
                    "token": reset_token,
                    "user_id": row["id"],
                    "expires_at": expires_at,
                },
            )
            reset_link = f"{frontend_base_url}/?view=reset&token={reset_token}"
            proc = subprocess.run(
                [
                    *RESET_EMAIL_CMD,
                    "--to",
                    row["email"],
                    "--name",
                    row.get("name") or "there",
                    "--link",
                    reset_link,
                ],
                cwd=str(SERVER_DIR),
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=proc.stderr.strip() or "Unable to send reset email.",
                )

        return ForgotPasswordResponse(
            message="If the account exists, a reset link has been sent."
        )

    @app.post("/auth/reset", response_model=ForgotPasswordResponse, tags=["auth"])
    def reset_password(payload: ResetPasswordPayload) -> ForgotPasswordResponse:
        reset_row = fetch_one(
            """
            UPDATE "PasswordReset"
            SET "usedAt" = NOW()
            WHERE "token" = %(token)s
              AND "usedAt" IS NULL
              AND "expiresAt" >= NOW()
            RETURNING "userId";
            """,
            {"token": payload.token},
        )
        if not reset_row:
            raise HTTPException(status_code=400, detail="Reset link is invalid or expired.")

        password_hash = hash_password(payload.password)
        fetch_one(
            """
            UPDATE "User"
            SET "passwordHash" = %(password_hash)s,
                "passwordChangedAt" = NOW()
            WHERE "id" = %(user_id)s
            RETURNING "id";
            """,
            {"password_hash": password_hash, "user_id": reset_row["userId"]},
        )
        return ForgotPasswordResponse(message="Password updated.")

    @app.get("/reports/dashboard.pdf", tags=["reports"])
    def render_dashboard_pdf(url: str) -> FileResponse:
        if not url:
            raise HTTPException(status_code=400, detail="Missing dashboard URL.")
        tmp_dir = Path(tempfile.mkdtemp(prefix="hr-pdf-"))
        output_path = tmp_dir / "dashboard.pdf"
        keep_dir = bool(int(os.getenv("KEEP_PDF_TEMP", "0")))
        try:
            proc = subprocess.run(
                [*RENDER_PDF_CMD, "--url", url, "--output", str(output_path)],
                cwd=str(SERVER_DIR),
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0 or not output_path.exists():
                raise HTTPException(
                    status_code=500,
                    detail=proc.stderr.strip() or "Unable to generate PDF.",
                )
            response = FileResponse(
                str(output_path),
                media_type="application/pdf",
                filename="dashboard.pdf",
            )
            if not keep_dir:
                response.background = BackgroundTask(
                    shutil.rmtree, tmp_dir, ignore_errors=True
                )
            return response
        finally:
            if keep_dir:
                return

    @app.get("/analytics/manpower-rampup", tags=["analytics"])
    def manpower_rampup(
        granularity: Literal["monthly", "quarterly", "yearly"] = "monthly",
        start: date | None = Query(None),
        end: date | None = Query(None),
        entities: list[str] | None = Query(None),
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
    ) -> dict[str, Any]:
        period, org_id, dashboard_month_id, resolved_month_key = _resolve_analytics_scope(
            granularity, start, end, organization_id, month_key
        )
        entity_filter = [entity for entity in (entities or []) if entity]
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        rows = fetch_all(
            _build_manpower_sql(
                granularity, bool(entity_filter), filter_org, filter_month
            ),
            {
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        return {
            "granularity": granularity,
            "start": period["start"].isoformat(),
            "end": period["end"].isoformat(),
            "monthKey": resolved_month_key,
            "points": [
                {
                    "periodStart": row["period_start"].isoformat(),
                    "headcount": row["headcount"],
                    "openingHeadcount": row["opening_headcount"],
                    "rampChange": row["ramp_change"],
                    "rampPct": row["ramp_pct"],
                }
                for row in rows
            ],
        }

    @app.get("/analytics/hires-exits", tags=["analytics"])
    def hires_exits(
        granularity: Literal["monthly", "quarterly", "yearly"] = "monthly",
        start: date | None = Query(None),
        end: date | None = Query(None),
        entities: list[str] | None = Query(None),
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
    ) -> dict[str, Any]:
        period, org_id, dashboard_month_id, resolved_month_key = _resolve_analytics_scope(
            granularity, start, end, organization_id, month_key
        )
        entity_filter = [entity for entity in (entities or []) if entity]
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        rows = fetch_all(
            _build_hires_sql(granularity, bool(entity_filter), filter_org, filter_month),
            {
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        return {
            "granularity": granularity,
            "start": period["start"].isoformat(),
            "end": period["end"].isoformat(),
            "monthKey": resolved_month_key,
            "points": [
                {
                    "periodStart": row["period_start"].isoformat(),
                    "hires": row["hires"],
                    "exits": row["exits"],
                }
                for row in rows
            ],
        }

    @app.get("/analytics/demographics", tags=["analytics"])
    def demographics_overview(
        granularity: Literal["monthly", "quarterly", "yearly"] = "monthly",
        start: date | None = Query(None),
        end: date | None = Query(None),
        entities: list[str] | None = Query(None),
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
    ) -> dict[str, Any]:
        period, org_id, dashboard_month_id, resolved_month_key = _resolve_analytics_scope(
            granularity, start, end, organization_id, month_key
        )
        apply_range = start is not None or end is not None
        entity_filter = [entity for entity in (entities or []) if entity]
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        rows = fetch_all(
            _build_demographics_sql(
                bool(entity_filter), filter_org, filter_month, apply_range
            ),
            {
                "cutoff": period["end"].isoformat(),
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        if not rows:
            return {
                "granularity": granularity,
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                "monthKey": resolved_month_key,
                "averages": {"ctc": None, "age": None, "tenure": None},
                "genderRatio": {"male": 0.0, "female": 0.0, "other": 0.0},
                "worklevels": [],
            }

        totals = next((row for row in rows if row["worklevel"] is None), None) or {
            "headcount": 0,
            "total_ctc": 0,
            "avg_ctc": None,
            "avg_age": None,
            "avg_tenure": None,
            "female_count": 0,
            "male_count": 0,
        }
        total_headcount = totals["headcount"] or 0
        total_cost = totals["total_ctc"] or 0.0
        female_count = totals["female_count"] or 0
        male_count = totals["male_count"] or 0
        other_count = max(total_headcount - female_count - male_count, 0)

        def _pct(value: float | int, denom: float | int) -> float:
            return float(value) / denom if denom else 0.0

        worklevels = []
        for row in rows:
            worklevel = row["worklevel"]
            if worklevel is None:
                continue
            headcount = row["headcount"] or 0
            level_cost = row["total_ctc"] or 0.0
            worklevels.append(
                {
                    "worklevel": worklevel or "Unspecified",
                    "headcount": headcount,
                    "headcountPct": _pct(headcount, total_headcount),
                    "costPct": _pct(level_cost, total_cost),
                    "femalePct": _pct(row["female_count"] or 0, headcount),
                    "avgTenure": row["avg_tenure"],
                    "avgAge": row["avg_age"],
                    "isTotal": False,
                }
            )
        worklevels.append(
            {
                "worklevel": "Total",
                "headcount": total_headcount,
                "headcountPct": 1.0 if total_headcount else 0.0,
                "costPct": 1.0 if total_cost else 0.0,
                "femalePct": _pct(female_count, total_headcount),
                "avgTenure": totals["avg_tenure"],
                "avgAge": totals["avg_age"],
                "isTotal": True,
            }
        )

        return {
            "granularity": granularity,
            "start": period["start"].isoformat(),
            "end": period["end"].isoformat(),
            "monthKey": resolved_month_key,
            "averages": {
                "ctc": totals["avg_ctc"],
                "age": totals["avg_age"],
                "tenure": totals["avg_tenure"],
            },
            "genderRatio": {
                "male": _pct(male_count, total_headcount),
                "female": _pct(female_count, total_headcount),
                "other": _pct(other_count, total_headcount),
            },
            "worklevels": worklevels,
        }

    @app.get("/analytics/demographics/entities", tags=["analytics"])
    def entity_demographics(
        granularity: Literal["monthly", "quarterly", "yearly"] = "monthly",
        start: date | None = Query(None),
        end: date | None = Query(None),
        entities: list[str] | None = Query(None),
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
    ) -> dict[str, Any]:
        period, org_id, dashboard_month_id, resolved_month_key = _resolve_analytics_scope(
            granularity, start, end, organization_id, month_key
        )
        apply_range = start is not None or end is not None
        entity_filter = [entity for entity in (entities or []) if entity]
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        rows = fetch_all(
            _build_entity_demographics_sql(
                bool(entity_filter), filter_org, filter_month, apply_range
            ),
            {
                "cutoff": period["end"].isoformat(),
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        if not rows:
            return {
                "granularity": granularity,
                "start": period["start"].isoformat(),
                "end": period["end"].isoformat(),
                "entities": [],
            }

        totals = next((row for row in rows if row["entity"] is None), None) or {
            "headcount": 0,
            "total_ctc": 0,
            "female_count": 0,
            "male_count": 0,
        }

        total_headcount = totals["headcount"] or 0
        total_cost = totals["total_ctc"] or 0.0

        def _pct(value: float | int, denom: float | int) -> float:
            return float(value) / denom if denom else 0.0

        entities_payload = []
        for row in rows:
            entity = row["entity"]
            if entity is None:
                continue
            headcount = row["headcount"] or 0
            level_cost = row["total_ctc"] or 0.0
            entities_payload.append(
                {
                    "entity": entity or "Unspecified",
                    "headcount": headcount,
                    "headcountPct": _pct(headcount, total_headcount),
                    "costPct": _pct(level_cost, total_cost),
                    "femalePct": _pct(row["female_count"] or 0, headcount),
                    "avgTenure": row["avg_tenure"],
                    "avgAge": row["avg_age"],
                }
            )

        return {
            "granularity": granularity,
            "start": period["start"].isoformat(),
            "end": period["end"].isoformat(),
            "monthKey": resolved_month_key,
            "entities": entities_payload,
        }

    @app.get("/analytics/location-headcount", tags=["analytics"])
    def location_headcount(
        location_type: Literal["physical", "entity", "payroll"] = "physical",
        cutoff: date | None = Query(None),
        entities: list[str] | None = Query(None),
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
    ) -> dict[str, Any]:
        column_lookup = {
            "physical": 'ed."Employee Physical Location"',
            "entity": 'ed."Entity"',
            "payroll": 'ed."Entity Location as per Payroll"',
        }
        column_expr = column_lookup.get(location_type)
        if column_expr is None:
            raise HTTPException(
                status_code=400,
                detail="Unsupported location type. Use physical, entity, or payroll.",
            )
        org_id, dashboard_month_id, resolved_month_key = _resolve_org_month_scope(
            organization_id, month_key
        )
        resolved_cutoff = cutoff or date.today()
        entity_filter = [entity for entity in (entities or []) if entity]
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        rows = fetch_all(
            _build_location_headcount_sql(
                column_expr, bool(entity_filter), filter_org, filter_month
            ),
            {
                "cutoff": resolved_cutoff.isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        total = sum((row["headcount"] or 0) for row in rows)
        payload = [
            {
                "location": row["location"] or "Unspecified",
                "headcount": row["headcount"] or 0,
                "percentage": ((row["headcount"] or 0) / total) if total else 0.0,
            }
            for row in rows
        ]
        return {
            "locationType": location_type,
            "cutoff": resolved_cutoff.isoformat(),
            "monthKey": resolved_month_key,
            "total": total,
            "locations": payload,
        }

    @app.get("/analytics/attrition", tags=["analytics"])
    def attrition_overview(
        entities: list[str] | None = Query(None),
        organization_id: str | None = Query(None),
        month_key: str | None = Query(None),
        granularity: Literal["monthly", "quarterly", "yearly"] = "monthly",
        start: date | None = Query(None),
        end: date | None = Query(None),
    ) -> dict[str, Any]:
        period, org_id, dashboard_month_id, resolved_month_key = _resolve_analytics_scope(
            granularity, start, end, organization_id, month_key
        )
        cutoff = period["end"]
        entity_filter = [entity for entity in (entities or []) if entity]
        filter_org = org_id is not None
        filter_month = dashboard_month_id is not None
        overall_rows = fetch_all(
            _build_attrition_sql(
                by_entity=False,
                filter_entities=bool(entity_filter),
                filter_org=filter_org,
                filter_month=filter_month,
            ),
            {
                "cutoff": cutoff.isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        entity_rows = fetch_all(
            _build_attrition_sql(
                by_entity=True,
                filter_entities=bool(entity_filter),
                filter_org=filter_org,
                filter_month=filter_month,
            ),
            {
                "cutoff": cutoff.isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        age_gender_rows = fetch_all(
            _build_age_gender_sql(
                filter_entities=bool(entity_filter),
                filter_org=filter_org,
                filter_month=filter_month,
            ),
            {
                "cutoff": cutoff.isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        age_trend = []
        gender_trend = []
        tenure_rows = fetch_all(
            _build_tenure_sql(
                filter_entities=bool(entity_filter),
                filter_org=filter_org,
                filter_month=filter_month,
            ),
            {
                "cutoff": cutoff.isoformat(),
                "entities": entity_filter,
                "organization_id": org_id,
                "dashboard_month_id": dashboard_month_id,
            },
        )
        tenure_trend = []
        def _months_covered(row: dict[str, Any]) -> float:
            raw_months = row.get("months_covered")
            try:
                months_value = float(raw_months)
            except (TypeError, ValueError):
                return 12.0
            if months_value <= 0:
                return 12.0
            return min(months_value, 12.0)
        def _average_headcount(
            row: dict[str, Any],
            start_key: str,
            end_key: str,
            monthly_sum_key: str | None = None,
        ) -> float:
            start = row.get(start_key) or 0
            end = row.get(end_key) or 0
            base_avg = (start + end) / 2.0
            if monthly_sum_key:
                months = _months_covered(row)
                monthly_sum = row.get(monthly_sum_key)
                try:
                    monthly_value = float(monthly_sum)
                except (TypeError, ValueError):
                    monthly_value = 0.0
                if monthly_value > 0 and months > 0:
                    return monthly_value / months
            return base_avg
        def _attrition(
            row: dict[str, Any],
            start_key: str,
            end_key: str,
            exit_key: str,
            monthly_sum_key: str | None = None,
        ) -> float:
            exits = row.get(exit_key) or 0
            denom = _average_headcount(row, start_key, end_key, monthly_sum_key)
            return float(exits) / denom if denom else 0.0
        def _annualized_attrition(
            row: dict[str, Any],
            start_key: str,
            end_key: str,
            exit_key: str,
            monthly_sum_key: str | None = None,
        ) -> float:
            rate = _attrition(row, start_key, end_key, exit_key, monthly_sum_key)
            months = _months_covered(row)
            if months >= 12.0:
                return rate
            return rate * (12.0 / months)

        for row in age_gender_rows:
            age_trend.append(
                {
                    "label": row["label"],
                    "twentyPct": _annualized_attrition(
                        row, "start_twenty", "end_twenty", "exits_twenty", "monthly_twenty_sum"
                    ),
                    "thirtyPct": _annualized_attrition(
                        row, "start_thirty", "end_thirty", "exits_thirty", "monthly_thirty_sum"
                    ),
                    "fortyPct": _annualized_attrition(
                        row, "start_forty", "end_forty", "exits_forty", "monthly_forty_sum"
                    ),
                    "fiftyPct": _annualized_attrition(
                        row, "start_fifty", "end_fifty", "exits_fifty", "monthly_fifty_sum"
                    ),
                }
            )
            gender_trend.append(
                {
                    "label": row["label"],
                    "malePct": _annualized_attrition(
                        row, "start_male", "end_male", "exits_male", "monthly_male_sum"
                    ),
                    "femalePct": _annualized_attrition(
                        row, "start_female", "end_female", "exits_female", "monthly_female_sum"
                    ),
                }
            )
        for row in tenure_rows:
            tenure_trend.append(
                {
                    "label": row["label"],
                    "zeroSixPct": _annualized_attrition(
                        row, "start_zero_six", "end_zero_six", "exits_zero_six", "monthly_zero_six_sum"
                    ),
                    "sixTwelvePct": _annualized_attrition(
                        row, "start_six_twelve", "end_six_twelve", "exits_six_twelve", "monthly_six_twelve_sum"
                    ),
                    "oneTwoPct": _annualized_attrition(
                        row, "start_one_two", "end_one_two", "exits_one_two", "monthly_one_two_sum"
                    ),
                    "twoFourPct": _annualized_attrition(
                        row, "start_two_four", "end_two_four", "exits_two_four", "monthly_two_four_sum"
                    ),
                    "fourTenPct": _annualized_attrition(
                        row, "start_four_ten", "end_four_ten", "exits_four_ten", "monthly_four_ten_sum"
                    ),
                    "tenPlusPct": _annualized_attrition(
                        row, "start_ten_plus", "end_ten_plus", "exits_ten_plus", "monthly_ten_plus_sum"
                    ),
                }
            )
        overall_attrition = [
            {
                "label": row["label"],
                "attritionPct": _annualized_attrition(
                    row,
                    "headcount_start",
                    "headcount_end",
                    "exits",
                    "monthly_headcount_sum",
                ),
            }
            for row in overall_rows
        ]
        entity_attrition = [
            {
                "entity": row["entity"],
                "label": row["label"],
                "attritionPct": _annualized_attrition(
                    row,
                    "headcount_start",
                    "headcount_end",
                    "exits",
                    "monthly_headcount_sum",
                ),
            }
            for row in entity_rows
            if row["entity"] is not None
        ]
        return {
            "overall": overall_attrition,
            "entities": entity_attrition,
            "ageTrend": age_trend,
            "genderTrend": gender_trend,
            "tenureTrend": tenure_trend,
            "monthKey": resolved_month_key,
        }

    return app


app = create_app()


def _parse_ingest_output(stdout: str) -> dict[str, Any] | None:
    """
    Extract the JSON payload produced by the Node ingestion script.
    """
    for line in reversed(stdout.splitlines()):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            continue
    return None


def _resolve_period(
    granularity: Literal["monthly", "quarterly", "yearly"],
    start: date | None,
    end: date | None,
) -> dict[str, date]:
    today = date.today()
    floor_funcs = {
        "monthly": _month_floor,
        "quarterly": _quarter_floor,
        "yearly": _year_floor,
    }
    step_lookup = {"monthly": -11, "quarterly": -15, "yearly": -9}
    start_default = floor_funcs[granularity](today)
    if granularity == "monthly":
        start_default = _shift_months(start_default, step_lookup[granularity])
    elif granularity == "quarterly":
        start_default = _shift_months(start_default, step_lookup[granularity] * 3)
    else:
        start_default = start_default.replace(year=start_default.year + step_lookup[granularity])

    end_default = floor_funcs[granularity](today)

    resolved_start = start or start_default
    resolved_end = end or end_default
    if resolved_end < resolved_start:
        raise HTTPException(status_code=400, detail="End date must be after start date.")
    return {"start": resolved_start, "end": resolved_end}


def _month_range_from_key(month_key: str) -> tuple[date, date]:
    try:
        year_str, month_str = month_key.split("-", 1)
        year = int(year_str)
        month = int(month_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid month key format.")
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month key value.")
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _format_month_label(month_key: str) -> str:
    try:
        year_str, month_str = month_key.split("-", 1)
        year = int(year_str)
        month = int(month_str)
    except (ValueError, TypeError):
        return month_key
    if month < 1 or month > 12:
        return month_key
    month_names = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    return f"{month_names[month - 1]} {year}"


def _generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _resolve_org_month_scope(
    organization_id: str | None,
    month_key: str | None,
) -> tuple[str | None, str | None, str | None]:
    org_id = organization_id or None
    resolved_month_key = month_key or None
    dashboard_month_id = None

    if resolved_month_key:
        row = fetch_one(
            'SELECT "id", "monthKey" FROM "DashboardMonth" WHERE "monthKey" = %(key)s;',
            {"key": resolved_month_key},
        )
        if not row:
            raise HTTPException(status_code=404, detail="Dashboard month not found.")
        dashboard_month_id = row["id"]
    elif org_id:
        row = fetch_one(
            """
            SELECT u."dashboardMonthId" AS month_id, dm."monthKey" AS month_key
            FROM "Upload" u
            LEFT JOIN "DashboardMonth" dm ON dm."id" = u."dashboardMonthId"
            WHERE u."organizationId" = %(org_id)s
              AND u."dashboardMonthId" IS NOT NULL
            ORDER BY u."uploadedAt" DESC
            LIMIT 1;
            """,
            {"org_id": org_id},
        )
        if row:
            dashboard_month_id = row["month_id"]
            resolved_month_key = row["month_key"]

    return org_id, dashboard_month_id, resolved_month_key


def _build_snapshot_cte(filter_org: bool, filter_month: bool) -> str:
    org_clause = (
        'AND u."organizationId" = %(organization_id)s'
        if filter_org
        else ""
    )
    month_clause = (
        'AND u."dashboardMonthId" = %(dashboard_month_id)s'
        if filter_month
        else ""
    )
    return f"""
WITH ranked AS (
    SELECT
        ed.*,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(ed."New Emp ID", ed."Emp ID", ed.id::text)
            ORDER BY u."uploadedAt" DESC, ed.id DESC
        ) AS rn
    FROM employee_dashboard_master ed
    JOIN "Upload" u ON u.id = ed."uploadId"
    WHERE 1 = 1
      {org_clause}
      {month_clause}
),
joined_first AS (
    SELECT
        ed."New Emp ID",
        ed."Emp ID",
        ed."Employee Name",
        ed."DOJ",
        ed."Entity",
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(ed."New Emp ID", ed."Emp ID", ed.id::text)
            ORDER BY ed."DOJ" ASC NULLS LAST, ed.id ASC
        ) AS rn
    FROM employee_dashboard_master ed
    JOIN "Upload" u ON u.id = ed."uploadId"
    WHERE ed."DOJ" IS NOT NULL
      {org_clause}
      {month_clause}
),
latest AS (
    SELECT *
    FROM ranked
    WHERE rn = 1
),
earliest_join AS (
    SELECT *
    FROM joined_first
    WHERE rn = 1 AND "DOJ" IS NOT NULL
)
"""


def _resolve_analytics_scope(
    granularity: Literal["monthly", "quarterly", "yearly"],
    start: date | None,
    end: date | None,
    organization_id: str | None,
    month_key: str | None,
) -> tuple[dict[str, date], str | None, str | None, str | None]:
    org_id, dashboard_month_id, resolved_month_key = _resolve_org_month_scope(
        organization_id, month_key
    )
    period = _resolve_period(granularity, start, end)
    return period, org_id, dashboard_month_id, resolved_month_key


def _build_manpower_sql(
    granularity: str,
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
) -> str:
    grain = {"monthly": "month", "quarterly": "quarter", "yearly": "year"}[granularity]
    step = {"monthly": "1 month", "quarterly": "3 months", "yearly": "1 year"}[granularity]
    entity_clause = (
        'AND ed."Entity" = ANY(%(entities)s)'
        if filter_entities
        else ""
    )
    step_interval = step
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , bounds AS (
        SELECT
            date_trunc('{grain}', %(start)s::timestamp) AS start_period,
            date_trunc('{grain}', %(end)s::timestamp) AS end_period
    )
    , series AS (
        SELECT generate_series(
            (SELECT start_period FROM bounds) - INTERVAL '{step_interval}',
            (SELECT end_period FROM bounds),
            INTERVAL '{step_interval}'
        ) AS period_start
    )
    , actuals AS (
        SELECT
            s.period_start,
            (
                SELECT COUNT(*)
                FROM latest ed
                WHERE ed."DOJ" IS NOT NULL
                  AND ed."DOJ" <= s.period_start
                  AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= s.period_start + INTERVAL '{step_interval}'
                  )
                  {entity_clause}
            )::int AS headcount
        FROM series s
    )
    , enriched AS (
        SELECT
            period_start,
            headcount,
            LAG(headcount) OVER (ORDER BY period_start) AS opening_headcount
        FROM actuals
    )
    SELECT
        e.period_start,
        e.headcount,
        COALESCE(e.opening_headcount, 0) AS opening_headcount,
        e.headcount - COALESCE(e.opening_headcount, 0) AS ramp_change,
        CASE
            WHEN COALESCE(e.opening_headcount, 0) = 0 THEN 0
            ELSE (e.headcount - e.opening_headcount)::float / NULLIF(e.opening_headcount, 0)
        END AS ramp_pct
    FROM enriched e
    JOIN bounds b ON TRUE
    WHERE e.period_start >= b.start_period
    ORDER BY e.period_start;
    """


def _build_hires_sql(
    granularity: str,
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
) -> str:
    grain = {"monthly": "month", "quarterly": "quarter", "yearly": "year"}[granularity]
    step = {"monthly": "1 month", "quarterly": "3 months", "yearly": "1 year"}[granularity]
    entity_clause = (
        'AND ed."Entity" = ANY(%(entities)s)'
        if filter_entities
        else ""
    )
    entity_clause_join = (
        'AND ej."Entity" = ANY(%(entities)s)'
        if filter_entities
        else ""
    )
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , series AS (
        SELECT generate_series(
            date_trunc('{grain}', %(start)s::timestamp),
            date_trunc('{grain}', %(end)s::timestamp),
            INTERVAL '{step}'
        ) AS period_start
    )
    SELECT
        period_start,
        (
            SELECT COUNT(*)
            FROM earliest_join ej
            WHERE date_trunc('{grain}', ej."DOJ") = period_start
              {entity_clause_join}
        ) AS hires,
        (
            SELECT COUNT(*)
            FROM latest ed
            WHERE ed."Final LWD" IS NOT NULL
              AND date_trunc('{grain}', ed."Final LWD") = period_start
              {entity_clause}
        ) AS exits
    FROM series
    ORDER BY period_start;
    """


def _build_demographics_sql(
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
    apply_range: bool,
) -> str:
    entity_clause = (
        'AND ed."Entity" = ANY(%(entities)s)'
        if filter_entities
        else ""
    )
    range_clause = (
        """
          AND date_trunc('day', ed."DOJ") <= %(end)s::date
          AND (
            ed."Final LWD" IS NULL
            OR date_trunc('day', ed."Final LWD") >= %(start)s::date
          )
        """
        if apply_range
        else """
          AND date_trunc('day', ed."DOJ") <= %(cutoff)s::date
          AND (
            ed."Final LWD" IS NULL
            OR %(cutoff)s::date < date_trunc('day', ed."Final LWD")
          )
        """
    )
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , active AS (
        SELECT
            ed."Worklevel" AS worklevel,
            ed."Gender" AS gender,
            ed."CTC" AS ctc,
            ed."Age" AS age,
            ed."Tenure" AS tenure
        FROM latest ed
        WHERE ed."DOJ" IS NOT NULL
          {range_clause}
          {entity_clause}
    )
    SELECT
        worklevel,
        COUNT(*)::int AS headcount,
        AVG(ctc)::float AS avg_ctc,
        AVG(age)::float AS avg_age,
        AVG(tenure)::float AS avg_tenure,
        SUM(ctc)::float AS total_ctc,
        SUM(CASE WHEN gender ILIKE 'F%%' THEN 1 ELSE 0 END)::int AS female_count,
        SUM(CASE WHEN gender ILIKE 'M%%' THEN 1 ELSE 0 END)::int AS male_count
    FROM active
    GROUP BY ROLLUP(worklevel)
    ORDER BY CASE WHEN worklevel IS NULL THEN 1 ELSE 0 END, worklevel;
    """


def _build_entity_demographics_sql(
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
    apply_range: bool,
) -> str:
    entity_clause = (
        'AND ed."Entity" = ANY(%(entities)s)'
        if filter_entities
        else ""
    )
    range_clause = (
        """
          AND date_trunc('day', ed."DOJ") <= %(end)s::date
          AND (
            ed."Final LWD" IS NULL
            OR date_trunc('day', ed."Final LWD") >= %(start)s::date
          )
        """
        if apply_range
        else """
          AND date_trunc('day', ed."DOJ") <= %(cutoff)s::date
          AND (
            ed."Final LWD" IS NULL
            OR %(cutoff)s::date < date_trunc('day', ed."Final LWD")
          )
        """
    )
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , active AS (
        SELECT
            ed."Entity" AS entity,
            ed."Gender" AS gender,
            ed."CTC" AS ctc,
            ed."Age" AS age,
            ed."Tenure" AS tenure
        FROM latest ed
        WHERE ed."DOJ" IS NOT NULL
          {range_clause}
          {entity_clause}
    )
    SELECT
        entity,
        COUNT(*)::int AS headcount,
        AVG(ctc)::float AS avg_ctc,
        AVG(age)::float AS avg_age,
        AVG(tenure)::float AS avg_tenure,
        SUM(ctc)::float AS total_ctc,
        SUM(CASE WHEN gender ILIKE 'F%%' THEN 1 ELSE 0 END)::int AS female_count,
        SUM(CASE WHEN gender ILIKE 'M%%' THEN 1 ELSE 0 END)::int AS male_count
    FROM active
    GROUP BY ROLLUP(entity)
    ORDER BY CASE WHEN entity IS NULL THEN 1 ELSE 0 END, entity;
    """


def _build_location_headcount_sql(
    location_column: str,
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
) -> str:
    entity_clause = (
        'AND ed."Entity" = ANY(%(entities)s)'
        if filter_entities
        else ""
    )
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    SELECT
        COALESCE(NULLIF(TRIM({location_column}), ''), 'Unspecified') AS location,
        COUNT(*)::int AS headcount
    FROM latest ed
    WHERE ed."DOJ" IS NOT NULL
      AND ed."DOJ" <= %(cutoff)s::date
      AND (
        ed."Final LWD" IS NULL
        OR %(cutoff)s::date < ed."Final LWD"
      )
      {entity_clause}
    GROUP BY location
    ORDER BY headcount DESC, location;
    """


def _build_attrition_sql(
    by_entity: bool,
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
) -> str:
    entity_expr = 'COALESCE(ed."Entity", \'Unspecified\')'
    entity_select = f"{entity_expr} AS entity," if by_entity else ""
    entity_group = entity_expr if by_entity else ""
    entity_group_clause = f", {entity_group}" if by_entity else ""
    entity_output = "a.entity AS entity," if by_entity else ""
    entity_order_clause = ", a.entity" if by_entity else ""
    entity_filter_clause = (
        'AND ed."Entity" = ANY(%(entities)s)' if filter_entities else ""
    )
    entity_join_clause = "AND a.entity = ms.entity" if by_entity else ""
    entity_summary_select = "entity," if by_entity else ""
    entity_summary_group = ", entity" if by_entity else ""
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , params AS (
        SELECT
            %(cutoff)s::date AS cutoff,
            CASE
                WHEN EXTRACT(MONTH FROM %(cutoff)s::date) >= 4
                    THEN make_date(EXTRACT(YEAR FROM %(cutoff)s::date)::int, 4, 1)
                ELSE make_date((EXTRACT(YEAR FROM %(cutoff)s::date)::int) - 1, 4, 1)
            END AS current_fy_start
    ),
    year_bounds AS (
        SELECT
            bounds.year_start,
            bounds.year_end,
            bounds.fy_year_end,
            GREATEST(
                1,
                LEAST(
                    12,
                    (
                        DATE_PART('year', age(bounds.year_end, bounds.year_start)) * 12
                        + DATE_PART('month', age(bounds.year_end, bounds.year_start))
                        + CASE
                            WHEN DATE_PART('day', age(bounds.year_end, bounds.year_start)) > 0
                                THEN 1
                            ELSE 0
                        END
                    )::int
                )
            ) AS months_covered
        FROM (
            SELECT
                (p.current_fy_start + make_interval(years => g.offset))::date AS year_start,
                LEAST(
                    (p.current_fy_start + make_interval(years => g.offset + 1))::date,
                    (p.cutoff + INTERVAL '1 day')::date
                ) AS year_end,
                (p.current_fy_start + make_interval(years => g.offset + 1))::date AS fy_year_end
            FROM params p
            CROSS JOIN LATERAL (
                SELECT generate_series(-3, 0) AS offset
            ) AS g
        ) AS bounds
    ),
    month_series AS (
        SELECT
            y.year_start,
            y.year_end,
            y.fy_year_end,
            y.months_covered,
            (y.year_start + make_interval(months => g.offset))::date AS month_start
        FROM year_bounds y
        JOIN LATERAL (
            SELECT
                generate_series(0, GREATEST(y.months_covered, 0) - 1) AS offset
        ) AS g ON TRUE
    ),
    monthly_counts AS (
        SELECT
            ms.year_start,
            ms.year_end,
            ms.fy_year_end,
            ms.months_covered,
            {entity_select}
            COUNT(*)::int AS month_headcount
        FROM month_series ms
        JOIN latest ed ON
            ed."DOJ" IS NOT NULL
            AND ed."DOJ" <= ms.month_start
            AND (
                ed."Final LWD" IS NULL
                OR ed."Final LWD" >= ms.month_start + INTERVAL '1 month'
            )
        WHERE TRUE
          {entity_filter_clause}
        GROUP BY ms.year_start, ms.year_end, ms.fy_year_end, ms.months_covered{entity_group_clause}, ms.month_start
    ),
    monthly_summary AS (
        SELECT
            year_start,
            year_end,
            fy_year_end,
            months_covered,
            {entity_summary_select}
            SUM(month_headcount)::float AS monthly_headcount_sum
        FROM monthly_counts
        GROUP BY year_start, year_end, fy_year_end, months_covered{entity_summary_group}
    ),
    attrition AS (
        SELECT
            y.year_start,
            y.year_end,
            y.fy_year_end,
            y.months_covered,
            {entity_select}
            COUNT(*) FILTER (
                WHERE ed."DOJ" IS NOT NULL
                  AND ed."DOJ" < y.year_start
                  AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_start
                  )
            ) AS headcount_start,
            COUNT(*) FILTER (
                WHERE ed."DOJ" IS NOT NULL
                  AND ed."DOJ" < y.year_end
                  AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_end
                  )
            ) AS headcount_end,
            COUNT(*) FILTER (
                WHERE ed."Final LWD" IS NOT NULL
                  AND ed."Final LWD" >= y.year_start
                  AND ed."Final LWD" < y.year_end
            ) AS exits
        FROM year_bounds y
        JOIN latest ed ON TRUE
        WHERE TRUE
          {entity_filter_clause}
        GROUP BY y.year_start, y.year_end, y.fy_year_end, y.months_covered{entity_group_clause}
    )
    SELECT
        CASE
            WHEN a.year_end < a.fy_year_end
                THEN 'YTD FY' || TO_CHAR(a.fy_year_end, 'YY')
            ELSE 'FY' || TO_CHAR(a.fy_year_end, 'YY')
        END AS label,
        {entity_output}
        a.headcount_start,
        a.headcount_end,
        a.exits,
        a.months_covered,
        COALESCE(ms.monthly_headcount_sum, 0) AS monthly_headcount_sum
    FROM attrition a
    LEFT JOIN monthly_summary ms
      ON a.year_start = ms.year_start
     AND a.year_end = ms.year_end
     AND a.fy_year_end = ms.fy_year_end
     AND a.months_covered = ms.months_covered
     {entity_join_clause}
    ORDER BY a.year_start{entity_order_clause};
    """


def _build_age_gender_sql(
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
) -> str:
    entity_filter_clause = (
        'AND ed."Entity" = ANY(%(entities)s)' if filter_entities else ""
    )
    start_condition = """
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_start
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_start
                )
    """
    end_condition = """
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_end
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_end
                )
    """
    exit_condition = """
                ed."Final LWD" IS NOT NULL
                AND ed."Final LWD" >= y.year_start
                AND ed."Final LWD" < y.year_end
    """
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , params AS (
        SELECT
            %(cutoff)s::date AS cutoff,
            CASE
                WHEN EXTRACT(MONTH FROM %(cutoff)s::date) >= 4
                    THEN make_date(EXTRACT(YEAR FROM %(cutoff)s::date)::int, 4, 1)
                ELSE make_date((EXTRACT(YEAR FROM %(cutoff)s::date)::int) - 1, 4, 1)
            END AS current_fy_start
    ),
    year_bounds AS (
        SELECT
            bounds.year_start,
            bounds.year_end,
            bounds.fy_year_end,
            GREATEST(
                1,
                LEAST(
                    12,
                    (
                        DATE_PART('year', age(bounds.year_end, bounds.year_start)) * 12
                        + DATE_PART('month', age(bounds.year_end, bounds.year_start))
                        + CASE
                            WHEN DATE_PART('day', age(bounds.year_end, bounds.year_start)) > 0
                                THEN 1
                            ELSE 0
                        END
                    )::int
                )
            ) AS months_covered
        FROM (
            SELECT
                (p.current_fy_start + make_interval(years => g.offset))::date AS year_start,
                LEAST(
                    (p.current_fy_start + make_interval(years => g.offset + 1))::date,
                    (p.cutoff + INTERVAL '1 day')::date
                ) AS year_end,
                (p.current_fy_start + make_interval(years => g.offset + 1))::date AS fy_year_end
            FROM params p
            CROSS JOIN LATERAL (
                SELECT generate_series(-3, 0) AS offset
            ) AS g
        ) AS bounds
    ),
    month_series AS (
        SELECT
            y.year_start,
            y.year_end,
            y.fy_year_end,
            y.months_covered,
            (y.year_start + make_interval(months => gs.offset))::date AS month_start,
            ((y.year_start + make_interval(months => gs.offset + 1))::date - INTERVAL '1 day') AS month_end
        FROM year_bounds y
        JOIN LATERAL (
            SELECT
                generate_series(0, GREATEST(y.months_covered, 0) - 1) AS offset
        ) AS gs ON TRUE
    ),
    monthly_counts AS (
        SELECT
            ms.year_start,
            ms.year_end,
            ms.fy_year_end,
            ms.months_covered,
            ms.month_start,
            COUNT(*) FILTER (
                WHERE COALESCE(ed."Age", 0) >= 20
                  AND COALESCE(ed."Age", 0) < 30
            )::int AS month_twenty,
            COUNT(*) FILTER (
                WHERE COALESCE(ed."Age", 0) >= 30
                  AND COALESCE(ed."Age", 0) < 40
            )::int AS month_thirty,
            COUNT(*) FILTER (
                WHERE COALESCE(ed."Age", 0) >= 40
                  AND COALESCE(ed."Age", 0) < 50
            )::int AS month_forty,
            COUNT(*) FILTER (
                WHERE COALESCE(ed."Age", 0) >= 50
            )::int AS month_fifty,
            COUNT(*) FILTER (WHERE ed."Gender" ILIKE 'M%%')::int AS month_male,
            COUNT(*) FILTER (WHERE ed."Gender" ILIKE 'F%%')::int AS month_female
        FROM month_series ms
        JOIN latest ed ON
            ed."DOJ" IS NOT NULL
            AND ed."DOJ" <= ms.month_start
            AND (
                ed."Final LWD" IS NULL
                OR ed."Final LWD" >= ms.month_start + INTERVAL '1 month'
            )
        WHERE TRUE
          {entity_filter_clause}
        GROUP BY ms.year_start, ms.year_end, ms.fy_year_end, ms.months_covered, ms.month_start
    ),
    monthly_summary AS (
        SELECT
            year_start,
            year_end,
            fy_year_end,
            months_covered,
            SUM(month_twenty)::float AS monthly_twenty_sum,
            SUM(month_thirty)::float AS monthly_thirty_sum,
            SUM(month_forty)::float AS monthly_forty_sum,
            SUM(month_fifty)::float AS monthly_fifty_sum,
            SUM(month_male)::float AS monthly_male_sum,
            SUM(month_female)::float AS monthly_female_sum
        FROM monthly_counts
        GROUP BY year_start, year_end, fy_year_end, months_covered
    )
    SELECT
        CASE
            WHEN y.year_end < y.fy_year_end
                THEN 'YTD FY' || TO_CHAR(y.fy_year_end, 'YY')
            ELSE 'FY' || TO_CHAR(y.fy_year_end, 'YY')
        END AS label,
        y.months_covered,
        COUNT(*) FILTER (
            WHERE {start_condition}
              AND COALESCE(ed."Age", 0) >= 20
              AND COALESCE(ed."Age", 0) < 30
        )::int AS start_twenty,
        COUNT(*) FILTER (
            WHERE {end_condition}
              AND COALESCE(ed."Age", 0) >= 20
              AND COALESCE(ed."Age", 0) < 30
        )::int AS end_twenty,
        COUNT(*) FILTER (
            WHERE {exit_condition}
              AND COALESCE(ed."Age", 0) >= 20
              AND COALESCE(ed."Age", 0) < 30
        )::int AS exits_twenty,
        COUNT(*) FILTER (
            WHERE {start_condition}
              AND COALESCE(ed."Age", 0) >= 30
              AND COALESCE(ed."Age", 0) < 40
        )::int AS start_thirty,
        COUNT(*) FILTER (
            WHERE {end_condition}
              AND COALESCE(ed."Age", 0) >= 30
              AND COALESCE(ed."Age", 0) < 40
        )::int AS end_thirty,
        COUNT(*) FILTER (
            WHERE {exit_condition}
              AND COALESCE(ed."Age", 0) >= 30
              AND COALESCE(ed."Age", 0) < 40
        )::int AS exits_thirty,
        COUNT(*) FILTER (
            WHERE {start_condition}
              AND COALESCE(ed."Age", 0) >= 40
              AND COALESCE(ed."Age", 0) < 50
        )::int AS start_forty,
        COUNT(*) FILTER (
            WHERE {end_condition}
              AND COALESCE(ed."Age", 0) >= 40
              AND COALESCE(ed."Age", 0) < 50
        )::int AS end_forty,
        COUNT(*) FILTER (
            WHERE {exit_condition}
              AND COALESCE(ed."Age", 0) >= 40
              AND COALESCE(ed."Age", 0) < 50
        )::int AS exits_forty,
        COUNT(*) FILTER (
            WHERE {start_condition}
              AND COALESCE(ed."Age", 0) >= 50
        )::int AS start_fifty,
        COUNT(*) FILTER (
            WHERE {end_condition}
              AND COALESCE(ed."Age", 0) >= 50
        )::int AS end_fifty,
        COUNT(*) FILTER (
            WHERE {exit_condition}
              AND COALESCE(ed."Age", 0) >= 50
        )::int AS exits_fifty,
        COUNT(*) FILTER (WHERE {start_condition} AND ed."Gender" ILIKE 'M%%')::int AS start_male,
        COUNT(*) FILTER (WHERE {end_condition} AND ed."Gender" ILIKE 'M%%')::int AS end_male,
        COUNT(*) FILTER (WHERE {exit_condition} AND ed."Gender" ILIKE 'M%%')::int AS exits_male,
        COUNT(*) FILTER (WHERE {start_condition} AND ed."Gender" ILIKE 'F%%')::int AS start_female,
        COUNT(*) FILTER (WHERE {end_condition} AND ed."Gender" ILIKE 'F%%')::int AS end_female,
        COUNT(*) FILTER (WHERE {exit_condition} AND ed."Gender" ILIKE 'F%%')::int AS exits_female,
        COALESCE(ms.monthly_twenty_sum, 0) AS monthly_twenty_sum,
        COALESCE(ms.monthly_thirty_sum, 0) AS monthly_thirty_sum,
        COALESCE(ms.monthly_forty_sum, 0) AS monthly_forty_sum,
        COALESCE(ms.monthly_fifty_sum, 0) AS monthly_fifty_sum,
        COALESCE(ms.monthly_male_sum, 0) AS monthly_male_sum,
        COALESCE(ms.monthly_female_sum, 0) AS monthly_female_sum
    FROM year_bounds y
    JOIN latest ed ON TRUE
    LEFT JOIN monthly_summary ms
      ON y.year_start = ms.year_start
     AND y.year_end = ms.year_end
     AND y.fy_year_end = ms.fy_year_end
     AND y.months_covered = ms.months_covered
    WHERE TRUE
      {entity_filter_clause}
    GROUP BY y.year_start, y.year_end, y.fy_year_end, y.months_covered,
             ms.monthly_twenty_sum, ms.monthly_thirty_sum, ms.monthly_forty_sum,
             ms.monthly_fifty_sum, ms.monthly_male_sum, ms.monthly_female_sum
    ORDER BY y.year_start;
    """


def _build_tenure_sql(
    filter_entities: bool,
    filter_org: bool,
    filter_month: bool,
) -> str:
    entity_filter_clause = (
        'AND ed."Entity" = ANY(%(entities)s)' if filter_entities else ""
    )
    start_condition = """
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_start
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_start
                )
    """
    end_condition = """
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_end
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_end
                )
    """
    exit_condition = """
                ed."Final LWD" IS NOT NULL
                AND ed."Final LWD" >= y.year_start
                AND ed."Final LWD" < y.year_end
    """
    monthly_condition = """
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" <= ms.month_end
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" > ms.month_end
                )
    """
    def tenure_months_expr(ref: str) -> str:
        return (
            "GREATEST("
            "(EXTRACT(YEAR FROM {ref}) - EXTRACT(YEAR FROM ed.\"DOJ\")) * 12 "
            "+ (EXTRACT(MONTH FROM {ref}) - EXTRACT(MONTH FROM ed.\"DOJ\")) "
            "+ CASE WHEN EXTRACT(DAY FROM {ref}) >= EXTRACT(DAY FROM ed.\"DOJ\") THEN 0 ELSE -1 END"
            ", 0)"
        ).format(ref=ref)

    buckets = [
        ("zero_six", 0, 6),
        ("six_twelve", 6, 12),
        ("one_two", 12, 24),
        ("two_four", 24, 48),
        ("four_ten", 48, 120),
        ("ten_plus", 120, None),
    ]

    def bucket_clause(base_condition: str, ref: str, lower: float, upper: float | None) -> str:
        expr = tenure_months_expr(ref)
        clauses = [base_condition, f"AND {expr} >= {lower}"]
        if upper is not None:
            clauses.append(f"AND {expr} < {upper}")
        return "WHERE " + " ".join(clauses)

    select_clauses = []
    monthly_count_clauses = []
    monthly_sum_clauses = []
    monthly_aliases: list[str] = []
    for key, lower, upper in buckets:
        start_alias = f"start_{key}"
        end_alias = f"end_{key}"
        exit_alias = f"exits_{key}"
        month_alias = f"month_{key}"
        monthly_sum_alias = f"monthly_{key}_sum"
        start_clause = bucket_clause(start_condition, "y.year_start", lower, upper)
        end_clause = bucket_clause(end_condition, "y.year_end", lower, upper)
        exit_clause = bucket_clause(exit_condition, "ed.\"Final LWD\"", lower, upper)
        monthly_clause = bucket_clause(monthly_condition, "ms.month_end", lower, upper)
        select_clauses.append(
            f"        COUNT(*) FILTER ({start_clause})::int AS {start_alias},\n"
            f"        COUNT(*) FILTER ({end_clause})::int AS {end_alias},\n"
            f"        COUNT(*) FILTER ({exit_clause})::int AS {exit_alias},"
        )
        monthly_count_clauses.append(
            f"        COUNT(*) FILTER ({monthly_clause})::int AS {month_alias},"
        )
        monthly_sum_clauses.append(
            f"            SUM({month_alias})::float AS {monthly_sum_alias},"
        )
        monthly_aliases.append(monthly_sum_alias)

    select_sql = "\n".join(select_clauses)
    monthly_counts_sql = "\n".join(monthly_count_clauses).rstrip(',')
    monthly_summary_sql = "\n".join(monthly_sum_clauses).rstrip(',')
    monthly_output_sql = ""
    if monthly_aliases:
        monthly_output_sql = ",\n" + ",\n".join(
            f"        COALESCE(ms.{alias}, 0) AS {alias}"
            for alias in monthly_aliases
        )
    monthly_group_by = ""
    if monthly_aliases:
        monthly_group_by = ", " + ", ".join(f"ms.{alias}" for alias in monthly_aliases)
    return f"""
    {_build_snapshot_cte(filter_org, filter_month)}
    , params AS (
        SELECT
            %(cutoff)s::date AS cutoff,
            CASE
                WHEN EXTRACT(MONTH FROM %(cutoff)s::date) >= 4
                    THEN make_date(EXTRACT(YEAR FROM %(cutoff)s::date)::int, 4, 1)
                ELSE make_date((EXTRACT(YEAR FROM %(cutoff)s::date)::int) - 1, 4, 1)
            END AS current_fy_start
    ),
    year_bounds AS (
        SELECT
            bounds.year_start,
            bounds.year_end,
            bounds.fy_year_end,
            GREATEST(
                1,
                LEAST(
                    12,
                    (
                        DATE_PART('year', age(bounds.year_end, bounds.year_start)) * 12
                        + DATE_PART('month', age(bounds.year_end, bounds.year_start))
                        + CASE
                            WHEN DATE_PART('day', age(bounds.year_end, bounds.year_start)) > 0
                                THEN 1
                            ELSE 0
                        END
                    )::int
                )
            ) AS months_covered
        FROM (
            SELECT
                (p.current_fy_start + make_interval(years => g.offset))::date AS year_start,
                LEAST(
                    (p.current_fy_start + make_interval(years => g.offset + 1))::date,
                    (p.cutoff + INTERVAL '1 day')::date
                ) AS year_end,
                (p.current_fy_start + make_interval(years => g.offset + 1))::date AS fy_year_end
            FROM params p
            CROSS JOIN LATERAL (
                SELECT generate_series(-3, 0) AS offset
            ) AS g
        ) AS bounds
    ),
    month_series AS (
        SELECT
            y.year_start,
            y.year_end,
            y.fy_year_end,
            y.months_covered,
            (y.year_start + make_interval(months => gs.offset))::date AS month_start,
            ((y.year_start + make_interval(months => gs.offset + 1))::date - INTERVAL '1 day') AS month_end
        FROM year_bounds y
        JOIN LATERAL (
            SELECT
                generate_series(0, GREATEST(y.months_covered, 0) - 1) AS offset
        ) AS gs ON TRUE
    ),
    monthly_counts AS (
        SELECT
            ms.year_start,
            ms.year_end,
            ms.fy_year_end,
            ms.months_covered,
            ms.month_start,
            ms.month_end,
{monthly_counts_sql}
        FROM month_series ms
        JOIN latest ed ON TRUE
        WHERE TRUE
          {entity_filter_clause}
        GROUP BY ms.year_start, ms.year_end, ms.fy_year_end, ms.months_covered, ms.month_start, ms.month_end
    ),
    monthly_summary AS (
        SELECT
            year_start,
            year_end,
            fy_year_end,
            months_covered,
{monthly_summary_sql}
        FROM monthly_counts
        GROUP BY year_start, year_end, fy_year_end, months_covered
    )
    SELECT
        CASE
            WHEN y.year_end < y.fy_year_end
                THEN 'YTD FY' || TO_CHAR(y.fy_year_end, 'YY')
            ELSE 'FY' || TO_CHAR(y.fy_year_end, 'YY')
        END AS label,
        y.months_covered,
{select_sql.rstrip(',')}
{monthly_output_sql}
    FROM year_bounds y
    JOIN latest ed ON TRUE
    LEFT JOIN monthly_summary ms
      ON y.year_start = ms.year_start
     AND y.year_end = ms.year_end
     AND y.fy_year_end = ms.fy_year_end
     AND y.months_covered = ms.months_covered
    WHERE TRUE
      {entity_filter_clause}
    GROUP BY y.year_start, y.year_end, y.fy_year_end, y.months_covered{monthly_group_by}
    ORDER BY y.year_start;
    """


def _month_floor(value: date) -> date:
    return value.replace(day=1)


def _quarter_floor(value: date) -> date:
    month = ((value.month - 1) // 3) * 3 + 1
    return value.replace(month=month, day=1)


def _year_floor(value: date) -> date:
    return value.replace(month=1, day=1)


def _shift_months(value: date, months: int) -> date:
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    day = min(
        value.day,
        _days_in_month(year, month),
    )
    return value.replace(year=year, month=month, day=day)


def _days_in_month(year: int, month: int) -> int:
    if month in {1, 3, 5, 7, 8, 10, 12}:
        return 31
    if month in {4, 6, 9, 11}:
        return 30
    # February
    if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
        return 29
    return 28
