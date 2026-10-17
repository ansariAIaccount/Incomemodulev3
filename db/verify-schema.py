#!/usr/bin/env python3
"""
verify-schema.py — prove a generated schema.sql matches the live database.

    psql "$SRC" -At -f fingerprint.sql > /tmp/db.fp
    python3 verify-schema.py schema.sql /tmp/db.fp

WHY THIS EXISTS

`psql -v ON_ERROR_STOP=1 -f schema.sql` tells you the file PARSES. It does not
tell you the file is RIGHT. A column declared numeric(20,2) where the source
has numeric(20,4) restores perfectly and silently rounds money differently
for the rest of the system's life. Counting tables does not catch it either.

So: fingerprint every table's full column list — name, type (with precision),
default expression, NOT NULL — on both sides and compare. Any difference in
any of those four, on any column, changes the hash.

Companion query, run against the source database:

    select nm || ' ' || h from (
      select c.relname nm,
             md5(string_agg(a.attname||'|'||format_type(a.atttypid,a.atttypmod)
                 ||'|'||coalesce(pg_get_expr(ad.adbin,ad.adrelid),'-')
                 ||'|'||a.attnotnull::text, ',' order by a.attnum)) h
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
      join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum
      where c.relkind='r'
      group by c.relname) x order by nm;

Exit 0 = every table matches. Exit 1 = at least one does not.
"""
import hashlib
import re
import sys


def fingerprint_sql(path):
    """Parse CREATE TABLE statements and hash each table's column list the
    same way the SQL query above does."""
    src = open(path, encoding="utf-8").read()
    out = {}
    for m in re.finditer(
        r"create table if not exists public\.(\w+)\s*\((.*?)\n\);", src, re.S | re.I
    ):
        name, body = m.group(1), m.group(2)
        cols = []
        for line in body.strip().split("\n"):
            line = line.strip().rstrip(",")
            if not line or line.startswith("--"):
                continue
            mm = re.match(r"^(\w+)\s+(.*)$", line)
            if not mm:
                continue
            col, rest = mm.group(1), mm.group(2)
            # Order matters: strip NOT NULL before DEFAULT, because a default
            # expression can itself contain the word "null".
            notnull = rest.endswith(" not null")
            if notnull:
                rest = rest[: -len(" not null")]
            default = "-"
            dm = re.search(r"\s+default\s+(.*)$", rest)
            if dm:
                default = dm.group(1).strip()
                rest = rest[: dm.start()]
            cols.append(f"{col}|{rest.strip()}|{default}|{str(notnull).lower()}")
        out[name] = hashlib.md5(",".join(cols).encode()).hexdigest()
    return out


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    mine = fingerprint_sql(sys.argv[1])
    db = {}
    for line in open(sys.argv[2], encoding="utf-8"):
        parts = line.split()
        if len(parts) == 2:
            db[parts[0]] = parts[1]

    missing, extra, mismatch, ok = [], [], [], 0
    for t, h in sorted(db.items()):
        if t not in mine:
            missing.append(t)
        elif mine[t] != h:
            mismatch.append(t)
        else:
            ok += 1
    for t in sorted(mine):
        if t not in db:
            extra.append(t)

    print(f"{ok}/{len(db)} tables match")
    for t in missing:
        print(f"  MISSING from the SQL file : {t}")
    for t in mismatch:
        print(f"  DIFFERS from the database : {t}")
    for t in extra:
        print(f"  NOT IN the database       : {t}")

    if missing or mismatch or extra:
        print(
            "\nA mismatch means a column name, type, precision, default or "
            "NOT NULL differs.\nRegenerate rather than patching by hand."
        )
        return 1
    print("\nEvery table in the file is identical to the database.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
