#!/usr/bin/env python3
"""verify-presets.py — prove the JSONB in seed-reference.sql matches the source.

    # against the source database:
    psql "$SRC" -At -c "select preset_key || ' ' || md5(build_definition::text)
                          from preset_catalog" > /tmp/preset.fp
    python3 verify-presets.py seed-reference.sql /tmp/preset.fp

WHY THIS EXISTS

preset_catalog.build_definition holds 37 kB of nested JSON across 17 rows —
whole deals, with tranches, spreads, ratchet tiers and fees. verify-seed.py
proves the file is well-formed SQL; it cannot tell you a brace moved or a
numeric lost a digit. This can: md5 the canonical JSON text on both sides.

A mismatch means the row in the file is not the row in the database.
Regenerate it rather than hunting for the character by eye.

Exit 0 = every preset in the fingerprint file matches. Exit 1 = at least one
does not, or is not valid JSON.
"""
import hashlib
import json
import re
import sys


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    sql_path, fp_path = sys.argv[1], sys.argv[2]
    src = open(sql_path, encoding="utf-8").read()

    # Isolate the preset_catalog statement FIRST. Scanning the whole file for
    # row-shaped text does not work: holiday_calendars has rows beginning
    # ('<uuid>', 'none', ... and a non-greedy .*? will happily run from there
    # into the first preset's JSON, filing it under the key 'none' and leaving
    # the real preset looking absent. An earlier version of this script did
    # exactly that and reported 16/17 on a file that was entirely correct.
    stmt = re.search(
        r"insert into public\.preset_catalog\s*\(.*?\)\s*values(.*?)on conflict",
        src, re.S | re.I,
    )
    if not stmt:
        print("FAIL: no insert into public.preset_catalog found in " + sql_path)
        return 1
    block = stmt.group(1)

    # Each row is: ('<uuid>', '<key>', ..., '<json>', '<timestamp>')
    # SQL doubles a single quote inside a literal, so undo that to recover the
    # JSON exactly as the database rendered it.
    rows = {}
    for m in re.finditer(
        r"\(\s*'[0-9a-f-]{36}',\s*'([a-z0-9-]+)',.*?'(\{.*?\})',\s*'[0-9 :.+-]+'\s*\)",
        block, re.S,
    ):
        rows[m.group(1)] = m.group(2).replace("''", "'")

    db = {}
    for line in open(fp_path, encoding="utf-8"):
        p = line.split()
        if len(p) == 2:
            db[p[0]] = p[1]

    ok = bad = 0
    missing = []
    for key, h in sorted(db.items()):
        if key not in rows:
            missing.append(key)
            continue
        text = rows[key]
        try:
            json.loads(text)
        except Exception as e:
            print(f"  INVALID JSON : {key}: {e}")
            bad += 1
            continue
        mine = hashlib.md5(text.encode()).hexdigest()
        if mine == h:
            ok += 1
        else:
            print(f"  HASH MISMATCH: {key}")
            print(f"                 file {mine}")
            print(f"                 db   {h}")
            bad += 1

    print(f"{ok}/{len(db)} presets match the database")
    if missing:
        print(f"not in the file ({len(missing)}): {', '.join(missing)}")
        bad += len(missing)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
