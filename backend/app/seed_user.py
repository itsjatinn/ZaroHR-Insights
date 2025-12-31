import argparse
import uuid

from .auth import hash_password
from .db import fetch_one, pool


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a user record.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", choices=["ADMIN", "ORG_ADMIN"], default="ORG_ADMIN")
    parser.add_argument("--organization-id", dest="organization_id")
    args = parser.parse_args()

    user_id = str(uuid.uuid4())
    password_hash = hash_password(args.password)
    row = fetch_one(
        """
        INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "organizationId")
        VALUES (%(id)s, %(name)s, %(email)s, %(password_hash)s, %(role)s, %(organization_id)s)
        ON CONFLICT ("email")
        DO UPDATE SET
          "name" = EXCLUDED."name",
          "passwordHash" = EXCLUDED."passwordHash",
          "role" = EXCLUDED."role",
          "organizationId" = EXCLUDED."organizationId"
        RETURNING "id", "email", "role";
        """,
        {
            "id": user_id,
            "name": args.name.strip(),
            "email": args.email.strip().lower(),
            "password_hash": password_hash,
            "role": args.role,
            "organization_id": args.organization_id,
        },
    )
    if row:
        print(f"User upserted: {row['email']} ({row['role']}) id={row['id']}")
    pool.close()


if __name__ == "__main__":
    main()
