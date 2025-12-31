from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict

from .db import fetch_all, fetch_one


class EmployeeSearchItem(BaseModel):
    id: str
    name: str
    emp_id: str | None = Field(None, alias="empId")
    new_emp_id: str | None = Field(None, alias="newEmpId")
    email: str | None = None
    designation: str | None = None
    entity: str | None = None


class EmployeeSearchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: str = Field(..., alias="organizationId")
    query: str | None = None
    results: list[EmployeeSearchItem]


class EducationItem(BaseModel):
    qualification: str | None = None
    institute: str | None = None
    year_of_passing: str | None = Field(None, alias="yearOfPassing")


class ExperienceItem(BaseModel):
    organization: str | None = None
    role: str | None = None
    from_date: str | None = Field(None, alias="fromDate")
    to_date: str | None = Field(None, alias="toDate")


class LtipItem(BaseModel):
    amount: float | None = None
    ltip_date: str | None = Field(None, alias="ltipDate")
    recovery_date: str | None = Field(None, alias="recoveryDate")


class EmployeeProfile(BaseModel):
    id: str
    name: str
    emp_id: str | None = Field(None, alias="empId")
    new_emp_id: str | None = Field(None, alias="newEmpId")
    status: str | None = None
    designation: str | None = None
    role: str | None = None
    function: str | None = None
    department_1: str | None = Field(None, alias="department1")
    department_2: str | None = Field(None, alias="department2")
    sbu: str | None = None
    entity: str | None = None
    location: str | None = None
    payroll_location: str | None = Field(None, alias="payrollLocation")
    email: str | None = None
    gender: str | None = None
    dob: str | None = None
    doj: str | None = None
    tenure: float | None = None
    age: float | None = None
    reporting_manager: str | None = Field(None, alias="reportingManager")
    internal_grade: str | None = Field(None, alias="internalGrade")
    internal_designation: str | None = Field(None, alias="internalDesignation")
    external_designation: str | None = Field(None, alias="externalDesignation")
    position: str | None = None


class EmployeeProfileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: str = Field(..., alias="organizationId")
    employee: EmployeeProfile
    education: list[EducationItem]
    experience: list[ExperienceItem]
    ltip: LtipItem | None = None


def register_employee_summary_routes(app: FastAPI) -> None:
    @app.get(
        "/org/employees/search",
        response_model=EmployeeSearchResponse,
        tags=["org-admin"],
    )
    def search_employees(
        organization_id: str = Query(..., alias="organizationId"),
        query: str | None = Query(None),
        limit: int = Query(25, ge=1, le=100),
    ) -> EmployeeSearchResponse:
        if not query or not query.strip():
            return EmployeeSearchResponse(
                organizationId=organization_id,
                query=query,
                results=[],
            )
        query_value = query.strip()
        rows = fetch_all(
            """
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
            """,
            {
                "organization_id": organization_id,
                "query": query_value,
                "limit": limit,
            },
        )
        return EmployeeSearchResponse(
            organizationId=organization_id,
            query=query,
            results=[
                EmployeeSearchItem(
                    id=row["id"],
                    name=row["name"],
                    empId=row["emp_id"],
                    newEmpId=row["new_emp_id"],
                    email=row["email"],
                    designation=row["designation"],
                    entity=row["entity"],
                )
                for row in rows
            ],
        )

    @app.get(
        "/org/employees/{employee_id}",
        response_model=EmployeeProfileResponse,
        tags=["org-admin"],
    )
    def employee_profile(
        employee_id: str,
        organization_id: str = Query(..., alias="organizationId"),
    ) -> EmployeeProfileResponse:
        employee_row = fetch_one(
            """
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
            """,
            {"employee_id": employee_id, "organization_id": organization_id},
        )
        if not employee_row:
            raise HTTPException(status_code=404, detail="Employee not found.")

        education_rows = fetch_all(
            """
            SELECT
                "Highest Qualification" AS qualification,
                "Institute/College" AS institute,
                "Year of Passing" AS year_of_passing
            FROM "Education"
            WHERE "employeeId" = %(employee_id)s
            ORDER BY "Year of Passing" DESC NULLS LAST;
            """,
            {"employee_id": employee_id},
        )
        experience_rows = fetch_all(
            """
            SELECT
                "Name of Previous Organization_Latest" AS organization,
                "Role/Designation" AS role,
                "From Date" AS from_date,
                "To Date" AS to_date
            FROM "Experience"
            WHERE "employeeId" = %(employee_id)s
            ORDER BY "From Date" DESC NULLS LAST;
            """,
            {"employee_id": employee_id},
        )
        ltip_row = fetch_one(
            """
            SELECT
                "LTIP" AS amount,
                "LTIP DATE" AS ltip_date,
                "Recovery Date" AS recovery_date
            FROM "LTIP"
            WHERE "employeeId" = %(employee_id)s
            LIMIT 1;
            """,
            {"employee_id": employee_id},
        )

        return EmployeeProfileResponse(
            organizationId=organization_id,
            employee=EmployeeProfile(
                id=employee_row["id"],
                name=employee_row["name"],
                empId=employee_row["emp_id"],
                newEmpId=employee_row["new_emp_id"],
                status=employee_row["status"],
                designation=employee_row["designation"],
                role=employee_row["role"],
                function=employee_row["function"],
                department1=employee_row["department_1"],
                department2=employee_row["department_2"],
                sbu=employee_row["sbu"],
                entity=employee_row["entity"],
                location=employee_row["location"],
                payrollLocation=employee_row["payroll_location"],
                email=employee_row["email"],
                gender=employee_row["gender"],
                dob=employee_row["dob"].isoformat() if employee_row["dob"] else None,
                doj=employee_row["doj"].isoformat() if employee_row["doj"] else None,
                tenure=employee_row["tenure"],
                age=employee_row["age"],
                reportingManager=employee_row["reporting_manager"],
                internalGrade=employee_row["internal_grade"],
                internalDesignation=employee_row["internal_designation"],
                externalDesignation=employee_row["external_designation"],
                position=employee_row["position"],
            ),
            education=[
                EducationItem(
                    qualification=row["qualification"],
                    institute=row["institute"],
                    yearOfPassing=row["year_of_passing"],
                )
                for row in education_rows
            ],
            experience=[
                ExperienceItem(
                    organization=row["organization"],
                    role=row["role"],
                    fromDate=row["from_date"].isoformat()
                    if row["from_date"]
                    else None,
                    toDate=row["to_date"].isoformat() if row["to_date"] else None,
                )
                for row in experience_rows
            ],
            ltip=LtipItem(
                amount=ltip_row["amount"],
                ltipDate=ltip_row["ltip_date"].isoformat()
                if ltip_row and ltip_row["ltip_date"]
                else None,
                recoveryDate=ltip_row["recovery_date"].isoformat()
                if ltip_row and ltip_row["recovery_date"]
                else None,
            )
            if ltip_row
            else None,
        )
