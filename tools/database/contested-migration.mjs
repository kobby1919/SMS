import assert from "node:assert/strict";

export function migrationContest({ holder, observer, waitForBlocked, pid }) {
  return async (table, id, work) => {
    const requests = [];
    const failures = [];
    const start = (promise) => {
      requests.push(promise);
      promise.catch((error) => { failures.push(error); });
      return promise;
    };
    await holder.query("BEGIN");
    try {
      assert.ok(["School", "MigrationStagedUpload"].includes(table));
      // School NO KEY UPDATE permits foreign-key audit inserts while fencing SHARE/UPDATE.
      const lock = table === "School" ? "FOR NO KEY UPDATE" : "FOR UPDATE";
      await holder.query(`SELECT id FROM public."${table}" WHERE id=$1 ${lock}`, [id]);
      await work(start, (count) => waitForBlocked(observer, pid, count, failures));
    } finally {
      try { await holder.query("ROLLBACK"); }
      finally { await Promise.allSettled(requests); }
    }
    return Promise.allSettled(requests);
  };
}
