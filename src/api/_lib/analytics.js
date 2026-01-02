const { fetchOne } = require("./db");

const toDateString = (value) => {
  if (!value) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateParam = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const utcDate = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day));

const daysInMonth = (year, month) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const monthFloor = (value) =>
  utcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, 1);

const quarterFloor = (value) => {
  const month = Math.floor(value.getUTCMonth() / 3) * 3 + 1;
  return utcDate(value.getUTCFullYear(), month, 1);
};

const yearFloor = (value) => utcDate(value.getUTCFullYear(), 1, 1);

const shiftMonths = (value, months) => {
  const year = value.getUTCFullYear();
  const monthIndex = value.getUTCMonth();
  const nextIndex = monthIndex + months;
  const nextYear = year + Math.floor(nextIndex / 12);
  const nextMonthIndex = ((nextIndex % 12) + 12) % 12;
  const nextMonth = nextMonthIndex + 1;
  const day = Math.min(value.getUTCDate(), daysInMonth(nextYear, nextMonth));
  return utcDate(nextYear, nextMonth, day);
};

const resolvePeriod = (granularity, start, end) => {
  const today = new Date();
  const floors = {
    monthly: monthFloor,
    quarterly: quarterFloor,
    yearly: yearFloor,
  };
  const stepLookup = { monthly: -11, quarterly: -15, yearly: -9 };
  let startDefault = floors[granularity](today);
  if (granularity === "monthly") {
    startDefault = shiftMonths(startDefault, stepLookup[granularity]);
  } else if (granularity === "quarterly") {
    startDefault = shiftMonths(startDefault, stepLookup[granularity] * 3);
  } else {
    startDefault = utcDate(
      startDefault.getUTCFullYear() + stepLookup[granularity],
      1,
      1
    );
  }
  const endDefault = floors[granularity](today);
  const resolvedStart = start || startDefault;
  const resolvedEnd = end || endDefault;
  if (resolvedEnd < resolvedStart) {
    const error = new Error("End date must be after start date.");
    error.status = 400;
    throw error;
  }
  return { start: resolvedStart, end: resolvedEnd };
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return monthKey;
  const [yearStr, monthStr] = String(monthKey).split("-", 2);
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month || month < 1 || month > 12) return monthKey;
  const monthNames = [
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
  ];
  return `${monthNames[month - 1]} ${year}`;
};

const resolveOrgMonthScope = async (organizationId, monthKey) => {
  const orgId = organizationId || null;
  let resolvedMonthKey = monthKey || null;
  let dashboardMonthId = null;

  if (resolvedMonthKey) {
    const row = await fetchOne(
      'SELECT "id", "monthKey" FROM "DashboardMonth" WHERE "monthKey" = %(key)s;',
      { key: resolvedMonthKey }
    );
    if (!row) {
      const error = new Error("Dashboard month not found.");
      error.status = 404;
      throw error;
    }
    dashboardMonthId = row.id;
  } else if (orgId) {
    const row = await fetchOne(
      `
      SELECT u."dashboardMonthId" AS month_id, dm."monthKey" AS month_key
      FROM "Upload" u
      LEFT JOIN "DashboardMonth" dm ON dm."id" = u."dashboardMonthId"
      WHERE u."organizationId" = %(org_id)s
        AND u."dashboardMonthId" IS NOT NULL
      ORDER BY u."uploadedAt" DESC
      LIMIT 1;
      `,
      { org_id: orgId }
    );
    if (row) {
      dashboardMonthId = row.month_id;
      resolvedMonthKey = row.month_key;
    }
  }

  return [orgId, dashboardMonthId, resolvedMonthKey];
};

const resolveAnalyticsScope = async (
  granularity,
  start,
  end,
  organizationId,
  monthKey
) => {
  const [orgId, dashboardMonthId, resolvedMonthKey] = await resolveOrgMonthScope(
    organizationId,
    monthKey
  );
  const period = resolvePeriod(granularity, start, end);
  return { period, orgId, dashboardMonthId, resolvedMonthKey };
};

const buildSnapshotCte = (filterOrg, filterMonth) => {
  const orgClause = filterOrg ? 'AND u."organizationId" = %(organization_id)s' : "";
  const monthClause = filterMonth
    ? 'AND u."dashboardMonthId" = %(dashboard_month_id)s'
    : "";
  return `
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
      ${orgClause}
      ${monthClause}
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
      ${orgClause}
      ${monthClause}
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
`;
};

const buildManpowerSql = (
  granularity,
  filterEntities,
  filterOrg,
  filterMonth
) => {
  const grain = { monthly: "month", quarterly: "quarter", yearly: "year" }[
    granularity
  ];
  const step = { monthly: "1 month", quarterly: "3 months", yearly: "1 year" }[
    granularity
  ];
  const entityClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
    , bounds AS (
        SELECT
            date_trunc('${grain}', %(start)s::timestamp) AS start_period,
            date_trunc('${grain}', %(end)s::timestamp) AS end_period
    )
    , series AS (
        SELECT generate_series(
            (SELECT start_period FROM bounds) - INTERVAL '${step}',
            (SELECT end_period FROM bounds),
            INTERVAL '${step}'
        ) AS period_start
    )
    , actuals AS (
        SELECT
            period_start,
            (
                SELECT COUNT(*)
                FROM latest ed
                WHERE ed."DOJ" IS NOT NULL
                  AND ed."DOJ" <= s.period_start
                  AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= s.period_start + INTERVAL '${step}'
                  )
                  ${entityClause}
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
    `;
};

const buildHiresSql = (granularity, filterEntities, filterOrg, filterMonth) => {
  const grain = { monthly: "month", quarterly: "quarter", yearly: "year" }[
    granularity
  ];
  const step = { monthly: "1 month", quarterly: "3 months", yearly: "1 year" }[
    granularity
  ];
  const entityClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  const entityClauseJoin = filterEntities
    ? 'AND ej."Entity" = ANY(%(entities)s)'
    : "";
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
    , series AS (
        SELECT generate_series(
            date_trunc('${grain}', %(start)s::timestamp),
            date_trunc('${grain}', %(end)s::timestamp),
            INTERVAL '${step}'
        ) AS period_start
    )
    SELECT
        period_start,
        (
            SELECT COUNT(*)::int
            FROM earliest_join ej
            WHERE date_trunc('${grain}', ej."DOJ") = period_start
              ${entityClauseJoin}
        ) AS hires,
        (
            SELECT COUNT(*)::int
            FROM latest ed
            WHERE ed."Final LWD" IS NOT NULL
              AND date_trunc('${grain}', ed."Final LWD") = period_start
              ${entityClause}
        ) AS exits
    FROM series
    ORDER BY period_start;
    `;
};

const buildDemographicsSql = (
  filterEntities,
  filterOrg,
  filterMonth,
  applyRange
) => {
  const entityClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  const rangeClause = applyRange
    ? `
          AND date_trunc('day', ed."DOJ") <= %(end)s::date
          AND (
            ed."Final LWD" IS NULL
            OR date_trunc('day', ed."Final LWD") >= %(start)s::date
          )
        `
    : `
          AND date_trunc('day', ed."DOJ") <= %(cutoff)s::date
          AND (
            ed."Final LWD" IS NULL
            OR %(cutoff)s::date < date_trunc('day', ed."Final LWD")
          )
        `;
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
    , active AS (
        SELECT
            ed."Worklevel" AS worklevel,
            ed."Gender" AS gender,
            ed."CTC" AS ctc,
            ed."Age" AS age,
            ed."Tenure" AS tenure
        FROM latest ed
        WHERE ed."DOJ" IS NOT NULL
          ${rangeClause}
          ${entityClause}
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
    `;
};

const buildEntityDemographicsSql = (
  filterEntities,
  filterOrg,
  filterMonth,
  applyRange
) => {
  const entityClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  const rangeClause = applyRange
    ? `
          AND date_trunc('day', ed."DOJ") <= %(end)s::date
          AND (
            ed."Final LWD" IS NULL
            OR date_trunc('day', ed."Final LWD") >= %(start)s::date
          )
        `
    : `
          AND date_trunc('day', ed."DOJ") <= %(cutoff)s::date
          AND (
            ed."Final LWD" IS NULL
            OR %(cutoff)s::date < date_trunc('day', ed."Final LWD")
          )
        `;
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
    , active AS (
        SELECT
            ed."Entity" AS entity,
            ed."Gender" AS gender,
            ed."CTC" AS ctc,
            ed."Age" AS age,
            ed."Tenure" AS tenure
        FROM latest ed
        WHERE ed."DOJ" IS NOT NULL
          ${rangeClause}
          ${entityClause}
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
    `;
};

const buildLocationHeadcountSql = (
  locationColumn,
  filterEntities,
  filterOrg,
  filterMonth
) => {
  const entityClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
    SELECT
        COALESCE(NULLIF(TRIM(${locationColumn}), ''), 'Unspecified') AS location,
        COUNT(*)::int AS headcount
    FROM latest ed
    WHERE ed."DOJ" IS NOT NULL
      AND ed."DOJ" <= %(cutoff)s::date
      AND (
        ed."Final LWD" IS NULL
        OR %(cutoff)s::date < ed."Final LWD"
      )
      ${entityClause}
    GROUP BY location
    ORDER BY headcount DESC, location;
    `;
};

const buildAttritionSql = (byEntity, filterEntities, filterOrg, filterMonth) => {
  const entityExpr = 'COALESCE(ed."Entity", \'Unspecified\')';
  const entitySelect = byEntity ? `${entityExpr} AS entity,` : "";
  const entityGroup = byEntity ? entityExpr : "";
  const entityGroupClause = byEntity ? `, ${entityGroup}` : "";
  const entityOutput = byEntity ? "a.entity AS entity," : "";
  const entityOrderClause = byEntity ? ", a.entity" : "";
  const entityFilterClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  const entityJoinClause = byEntity ? "AND a.entity = ms.entity" : "";
  const entitySummarySelect = byEntity ? "entity," : "";
  const entitySummaryGroup = byEntity ? ", entity" : "";
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
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
            ${entitySelect}
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
          ${entityFilterClause}
        GROUP BY ms.year_start, ms.year_end, ms.fy_year_end, ms.months_covered${entityGroupClause}, ms.month_start
    ),
    monthly_summary AS (
        SELECT
            year_start,
            year_end,
            fy_year_end,
            months_covered,
            ${entitySummarySelect}
            SUM(month_headcount)::float AS monthly_headcount_sum
        FROM monthly_counts
        GROUP BY year_start, year_end, fy_year_end, months_covered${entitySummaryGroup}
    ),
    attrition AS (
        SELECT
            y.year_start,
            y.year_end,
            y.fy_year_end,
            y.months_covered,
            ${entitySelect}
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
          ${entityFilterClause}
        GROUP BY y.year_start, y.year_end, y.fy_year_end, y.months_covered${entityGroupClause}
    )
    SELECT
        CASE
            WHEN a.year_end < a.fy_year_end
                THEN 'YTD FY' || TO_CHAR(a.fy_year_end, 'YY')
            ELSE 'FY' || TO_CHAR(a.fy_year_end, 'YY')
        END AS label,
        ${entityOutput}
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
     ${entityJoinClause}
    ORDER BY a.year_start${entityOrderClause};
    `;
};

const buildAgeGenderSql = (filterEntities, filterOrg, filterMonth) => {
  const entityFilterClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  const startCondition = `
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_start
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_start
                )
    `;
  const endCondition = `
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_end
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_end
                )
    `;
  const exitCondition = `
                ed."Final LWD" IS NOT NULL
                AND ed."Final LWD" >= y.year_start
                AND ed."Final LWD" < y.year_end
    `;
  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
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
          ${entityFilterClause}
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
            WHERE ${startCondition}
              AND COALESCE(ed."Age", 0) >= 20
              AND COALESCE(ed."Age", 0) < 30
        )::int AS start_twenty,
        COUNT(*) FILTER (
            WHERE ${endCondition}
              AND COALESCE(ed."Age", 0) >= 20
              AND COALESCE(ed."Age", 0) < 30
        )::int AS end_twenty,
        COUNT(*) FILTER (
            WHERE ${exitCondition}
              AND COALESCE(ed."Age", 0) >= 20
              AND COALESCE(ed."Age", 0) < 30
        )::int AS exits_twenty,
        COUNT(*) FILTER (
            WHERE ${startCondition}
              AND COALESCE(ed."Age", 0) >= 30
              AND COALESCE(ed."Age", 0) < 40
        )::int AS start_thirty,
        COUNT(*) FILTER (
            WHERE ${endCondition}
              AND COALESCE(ed."Age", 0) >= 30
              AND COALESCE(ed."Age", 0) < 40
        )::int AS end_thirty,
        COUNT(*) FILTER (
            WHERE ${exitCondition}
              AND COALESCE(ed."Age", 0) >= 30
              AND COALESCE(ed."Age", 0) < 40
        )::int AS exits_thirty,
        COUNT(*) FILTER (
            WHERE ${startCondition}
              AND COALESCE(ed."Age", 0) >= 40
              AND COALESCE(ed."Age", 0) < 50
        )::int AS start_forty,
        COUNT(*) FILTER (
            WHERE ${endCondition}
              AND COALESCE(ed."Age", 0) >= 40
              AND COALESCE(ed."Age", 0) < 50
        )::int AS end_forty,
        COUNT(*) FILTER (
            WHERE ${exitCondition}
              AND COALESCE(ed."Age", 0) >= 40
              AND COALESCE(ed."Age", 0) < 50
        )::int AS exits_forty,
        COUNT(*) FILTER (
            WHERE ${startCondition}
              AND COALESCE(ed."Age", 0) >= 50
        )::int AS start_fifty,
        COUNT(*) FILTER (
            WHERE ${endCondition}
              AND COALESCE(ed."Age", 0) >= 50
        )::int AS end_fifty,
        COUNT(*) FILTER (
            WHERE ${exitCondition}
              AND COALESCE(ed."Age", 0) >= 50
        )::int AS exits_fifty,
        COUNT(*) FILTER (WHERE ${startCondition} AND ed."Gender" ILIKE 'M%%')::int AS start_male,
        COUNT(*) FILTER (WHERE ${endCondition} AND ed."Gender" ILIKE 'M%%')::int AS end_male,
        COUNT(*) FILTER (WHERE ${exitCondition} AND ed."Gender" ILIKE 'M%%')::int AS exits_male,
        COUNT(*) FILTER (WHERE ${startCondition} AND ed."Gender" ILIKE 'F%%')::int AS start_female,
        COUNT(*) FILTER (WHERE ${endCondition} AND ed."Gender" ILIKE 'F%%')::int AS end_female,
        COUNT(*) FILTER (WHERE ${exitCondition} AND ed."Gender" ILIKE 'F%%')::int AS exits_female,
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
      ${entityFilterClause}
    GROUP BY y.year_start, y.year_end, y.fy_year_end, y.months_covered,
             ms.monthly_twenty_sum, ms.monthly_thirty_sum, ms.monthly_forty_sum,
             ms.monthly_fifty_sum, ms.monthly_male_sum, ms.monthly_female_sum
    ORDER BY y.year_start;
    `;
};

const buildTenureSql = (filterEntities, filterOrg, filterMonth) => {
  const entityFilterClause = filterEntities
    ? 'AND ed."Entity" = ANY(%(entities)s)'
    : "";
  const startCondition = `
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_start
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_start
                )
    `;
  const endCondition = `
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" < y.year_end
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" >= y.year_end
                )
    `;
  const exitCondition = `
                ed."Final LWD" IS NOT NULL
                AND ed."Final LWD" >= y.year_start
                AND ed."Final LWD" < y.year_end
    `;
  const monthlyCondition = `
                ed."DOJ" IS NOT NULL
                AND ed."DOJ" <= ms.month_end
                AND (
                    ed."Final LWD" IS NULL
                    OR ed."Final LWD" > ms.month_end
                )
    `;
  const tenureMonthsExpr = (ref) =>
    [
      "GREATEST(",
      `(EXTRACT(YEAR FROM ${ref}) - EXTRACT(YEAR FROM ed."DOJ")) * 12 `,
      `+ (EXTRACT(MONTH FROM ${ref}) - EXTRACT(MONTH FROM ed."DOJ")) `,
      `+ CASE WHEN EXTRACT(DAY FROM ${ref}) >= EXTRACT(DAY FROM ed."DOJ") THEN 0 ELSE -1 END`,
      ", 0)",
    ].join("");

  const buckets = [
    ["zero_six", 0, 6],
    ["six_twelve", 6, 12],
    ["one_two", 12, 24],
    ["two_four", 24, 48],
    ["four_ten", 48, 120],
    ["ten_plus", 120, null],
  ];

  const bucketClause = (baseCondition, ref, lower, upper) => {
    const expr = tenureMonthsExpr(ref);
    const clauses = [baseCondition, `AND ${expr} >= ${lower}`];
    if (upper !== null) {
      clauses.push(`AND ${expr} < ${upper}`);
    }
    return `WHERE ${clauses.join(" ")}`;
  };

  const selectClauses = [];
  const monthlyCountClauses = [];
  const monthlySumClauses = [];
  const monthlyAliases = [];
  buckets.forEach(([key, lower, upper]) => {
    const startAlias = `start_${key}`;
    const endAlias = `end_${key}`;
    const exitAlias = `exits_${key}`;
    const monthAlias = `month_${key}`;
    const monthlySumAlias = `monthly_${key}_sum`;
    const startClause = bucketClause(startCondition, "y.year_start", lower, upper);
    const endClause = bucketClause(endCondition, "y.year_end", lower, upper);
    const exitClause = bucketClause(exitCondition, 'ed."Final LWD"', lower, upper);
    const monthlyClause = bucketClause(monthlyCondition, "ms.month_end", lower, upper);
    selectClauses.push(
      `        COUNT(*) FILTER (${startClause})::int AS ${startAlias},\n` +
        `        COUNT(*) FILTER (${endClause})::int AS ${endAlias},\n` +
        `        COUNT(*) FILTER (${exitClause})::int AS ${exitAlias},`
    );
    monthlyCountClauses.push(
      `        COUNT(*) FILTER (${monthlyClause})::int AS ${monthAlias},`
    );
    monthlySumClauses.push(
      `            SUM(${monthAlias})::float AS ${monthlySumAlias},`
    );
    monthlyAliases.push(monthlySumAlias);
  });

  const selectSql = selectClauses.join("\n");
  const monthlyCountsSql = monthlyCountClauses.join("\n").replace(/,\s*$/, "");
  const monthlySummarySql = monthlySumClauses.join("\n").replace(/,\s*$/, "");
  const monthlyOutputSql = monthlyAliases.length
    ? ",\n" +
      monthlyAliases
        .map((alias) => `        COALESCE(ms.${alias}, 0) AS ${alias}`)
        .join(",\n")
    : "";
  const monthlyGroupBy = monthlyAliases.length
    ? ", " + monthlyAliases.map((alias) => `ms.${alias}`).join(", ")
    : "";

  return `
    ${buildSnapshotCte(filterOrg, filterMonth)}
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
${monthlyCountsSql}
        FROM month_series ms
        JOIN latest ed ON TRUE
        WHERE TRUE
          ${entityFilterClause}
        GROUP BY ms.year_start, ms.year_end, ms.fy_year_end, ms.months_covered, ms.month_start, ms.month_end
    ),
    monthly_summary AS (
        SELECT
            year_start,
            year_end,
            fy_year_end,
            months_covered,
${monthlySummarySql}
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
${selectSql.replace(/,\s*$/, "")}
${monthlyOutputSql}
    FROM year_bounds y
    JOIN latest ed ON TRUE
    LEFT JOIN monthly_summary ms
      ON y.year_start = ms.year_start
     AND y.year_end = ms.year_end
     AND y.fy_year_end = ms.fy_year_end
     AND y.months_covered = ms.months_covered
    WHERE TRUE
      ${entityFilterClause}
    GROUP BY y.year_start, y.year_end, y.fy_year_end, y.months_covered${monthlyGroupBy}
    ORDER BY y.year_start;
    `;
};

module.exports = {
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
};
