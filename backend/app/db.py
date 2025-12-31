from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_settings

settings = get_settings()

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=5,
    kwargs={"target_session_attrs": "read-write"},
)


def fetch_all(query: str, params: dict[str, object]) -> list[dict]:
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def fetch_one(query: str, params: dict[str, object]) -> dict | None:
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()
