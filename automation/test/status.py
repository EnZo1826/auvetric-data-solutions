"""Quick status: recent n8n executions (with failing node + error) and data-table row counts."""
import json, shutil, sqlite3, subprocess, tempfile
from pathlib import Path

tmp = Path(tempfile.mkdtemp())
for f in ("database.sqlite", "database.sqlite-wal", "database.sqlite-shm"):
    subprocess.run(["docker", "cp", f"auvetric-n8n:/home/node/.n8n/{f}", str(tmp / f)], capture_output=True)
con = sqlite3.connect(tmp / "database.sqlite"); con.row_factory = sqlite3.Row
names = {r["id"]: r["name"] for r in con.execute("select id,name from workflow_entity")}
for r in con.execute("select e.id, e.workflowId, e.status, e.startedAt, e.stoppedAt, d.data from execution_entity e left join execution_data d on d.executionId=e.id order by e.id desc limit 12"):
    err = ""
    if r["status"] != "success" and r["data"]:
        blob = r["data"]
        i = blob.find('"message"')
        err = blob[i:i + 300] if i >= 0 else ""
    print(f'#{r["id"]:<4} {r["status"]:<9} {names.get(r["workflowId"], r["workflowId"])[:32]:<32} {r["startedAt"]} {err}')
tabs = {r["name"]: r["id"] for r in con.execute("select id,name from data_table")}
all_t = [x[0] for x in con.execute("select name from sqlite_master where type='table'")]
for n, i in tabs.items():
    t = next((x for x in all_t if i in x), None)
    print(n, con.execute(f'select count(*) from "{t}"').fetchone()[0] if t else "no table")
con.close(); shutil.rmtree(tmp, ignore_errors=True)
