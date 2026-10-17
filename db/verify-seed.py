#!/usr/bin/env python3
"""verify-seed.py — lint seed-reference.sql without a database.

    python3 verify-seed.py seed-reference.sql

WHY THIS EXISTS

A seed file is a wall of INSERT rows. The errors that actually happen in one
are a dropped comma, a value too many or too few in one row out of 900, or a
quote that closes early and swallows the rest of the statement. All three
produce a file that looks fine and fails at restore time — after some of the
other statements have already committed.

So: walk the file with a real string-aware scanner (SQL escapes a quote by
doubling it, and -- comments do not apply inside a literal), split into
statements at top-level semicolons only, and check every row's value count
against its own column list.

What this does NOT check is whether the VALUES are right. For that there is
verify-presets.py, which hashes each build_definition against the database.

Exit 0 = clean. Exit 1 = at least one problem, each one printed.
"""
import re
import sys


def scan(s):
    """Walk s yielding (text, in_string). Handles '' escapes; drops -- comments."""
    i, inq = 0, False
    while i < len(s):
        c = s[i]
        if inq:
            if c == "'":
                if i + 1 < len(s) and s[i + 1] == "'":
                    yield ("''", True)
                    i += 2
                    continue
                inq = False
                yield (c, True)
                i += 1
                continue
            yield (c, True)
            i += 1
            continue
        if c == "'":
            inq = True
            yield (c, True)
            i += 1
            continue
        if s[i:i + 2] == "--":
            j = s.find("\n", i)
            i = len(s) if j < 0 else j + 1
            continue
        yield (c, False)
        i += 1
    if inq:
        raise SystemExit("FAIL: unterminated string literal")


def split_statements(src):
    stmts, cur = [], ""
    for c, inq in scan(src):
        if c == ";" and not inq:
            stmts.append(cur.strip())
            cur = ""
        else:
            cur += c
    if cur.strip():
        stmts.append(cur.strip())
    return [s for s in stmts if s]


def toplevel_tuples(body):
    """Split a VALUES body into its top-level ( ... ) row tuples."""
    rows, depth, cur, q, k = [], 0, "", False, 0
    while k < len(body):
        ch = body[k]
        if q:
            if ch == "'":
                if k + 1 < len(body) and body[k + 1] == "'":
                    cur += "''"
                    k += 2
                    continue
                q = False
            cur += ch
            k += 1
            continue
        if ch == "'":
            q = True
            cur += ch
            k += 1
            continue
        if ch == "(":
            depth += 1
            if depth == 1:
                cur = ""
                k += 1
                continue
        if ch == ")":
            depth -= 1
            if depth == 0:
                rows.append(cur)
                k += 1
                continue
        if depth >= 1:
            cur += ch
        k += 1
    return rows


def count_values(r):
    """Count top-level comma-separated items, ignoring commas in strings/nests."""
    d, q, n, k = 0, False, 1, 0
    while k < len(r):
        ch = r[k]
        if q:
            if ch == "'":
                if k + 1 < len(r) and r[k + 1] == "'":
                    k += 2
                    continue
                q = False
            k += 1
            continue
        if ch == "'":
            q = True
            k += 1
            continue
        if ch in "([{":
            d += 1
        elif ch in ")]}":
            d -= 1
        elif ch == "," and d == 0:
            n += 1
        k += 1
    return n


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    stmts = split_statements(open(sys.argv[1], encoding="utf-8").read())
    print(f"{len(stmts)} statements")

    bad, total = 0, 0
    for s in stmts:
        if s.split()[0].lower() not in ("begin", "commit", "set", "insert"):
            print(f"  unexpected statement start: {s[:70]!r}")
            bad += 1

    for s in stmts:
        if not s.lower().startswith("insert"):
            continue
        m = re.match(r"insert into public\.(\w+)\s*\((.*?)\)\s*values(.*)$", s, re.S)
        if not m:
            print(f"  unparsed insert: {s[:70]!r}")
            bad += 1
            continue
        tbl, cols, body = m.group(1), m.group(2), m.group(3)
        ncol = count_values(cols)
        body = re.sub(r"on conflict do nothing\s*$", "", body, flags=re.S | re.I)
        rows = toplevel_tuples(body)
        errs = 0
        for idx, r in enumerate(rows):
            n = count_values(r)
            if n != ncol:
                print(f"  {tbl} row {idx + 1}: {n} values vs {ncol} columns")
                errs += 1
                bad += 1
        total += len(rows)
        print(f"  {tbl:24} {ncol:2} cols x {len(rows):4} rows "
              f"{'ok' if not errs else 'MISMATCH'}")

    print(f"\ntotal rows: {total}")
    if bad:
        print("LINT FAILED")
        return 1
    print("Lint clean: statements well-formed, every row's value count "
          "matches its column list.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
