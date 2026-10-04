import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migration = "supabase/migrations/0025_ledger.sql";

test("the SQL commission rate matches COMMISSION_RATE in code", () => {
  const sql = readFileSync(migration, "utf8");
  const ts = readFileSync("src/lib/commission.ts", "utf8");
  const bps = Number(/select (\d+)\s*\$\$/.exec(sql)?.[1]);
  const rate = Number(/COMMISSION_RATE = ([0-9.]+)/.exec(ts)?.[1]);
  assert.equal(bps, Math.round(rate * 10000));
});

// Runs the migration and scenarios in a scratch Postgres. Set LEDGER_PG_URL to a database you
// do not mind being wiped (the public schema is dropped), e.g. postgres://test@localhost:5544/postgres.
test("ledger scenarios", { skip: !process.env.LEDGER_PG_URL && "set LEDGER_PG_URL to run" }, () => {
  const run = spawnSync("psql", [process.env.LEDGER_PG_URL, "-v", "ON_ERROR_STOP=1", "-q",
    "-f", "tests/ledger.stub.sql", "-f", migration, "-f", "tests/ledger.sql"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
});
