"""Local rehearsal of the n8n ↔ CRM link (workflows 12 and 21) against a CRM running on this PC.

Prereqs: local CRM on http://localhost:3100 started with CONTACT_PROVIDER=crm, local Postgres (auvetric-crm-db),
auvetric-n8n container running. Run from the repo root:  python automation/test/e2e_crm_link.py

What it does (and undoes):
  - creates a local integration token (hash in the LOCAL CRM db) and imports it into n8n as credential auvCrmIngest001
  - imports test copies of workflows 12/21 pointing at http://host.docker.internal:3100, the Anthropic API replaced by a mock on :11435 (no real key is used),
    with "Email partners" DISABLED (no mail is sent), empty cursors (full backfill)
  - submits a website enquiry, triggers both workflows, checks the CRM database
Afterwards re-import the production workflows (README → "CRM link").
"""
from __future__ import annotations

import hashlib, http.server, json, secrets, sqlite3, subprocess, sys, tempfile, threading, time, urllib.parse, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "automation"))
import build_workflows as bw  # noqa: E402

CTR = "auvetric-n8n"
CRM = "http://localhost:3100"
MOCK_PORT = 11435
RUN = uuid.uuid4().hex[:6]


def sh(*args, check=True, input=None):
    r = subprocess.run(list(args), capture_output=True, text=True, input=input)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(args)}\n{r.stdout}\n{r.stderr}")
    return r.stdout


def psql(q: str) -> str:
    return sh("docker", "exec", "auvetric-crm-db", "psql", "-U", "auvetric", "-d", "auvetric_crm", "-tAc", q).strip()


SEEN = {}


class MockAnthropic(http.server.BaseHTTPRequestHandler):
    """Stands in for POST /v1/messages: checks auth/version headers and the forced tool, answers with tool_use."""
    def do_POST(self):  # noqa: N802
        req = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        SEEN.update(path=self.path, key=bool(self.headers.get("x-api-key")), version=self.headers.get("anthropic-version"),
                    tool=req.get("tool_choice", {}).get("name"), schema="properties" in (req.get("tools") or [{}])[0].get("input_schema", {}),
                    system=bool(req.get("system")), model=req.get("model"))
        content = ({"who_is_selling": "sender_wants_our_services", "summary": f"MOCK triage {RUN}: telemetry for 40 pumps.",
                              "key_requirements": ["MQTT", "Alarms"], "questions_to_ask": ["Which PLCs?"], "category": "project",
                              "practice": "engineering", "priority": "high", "spam_score": 2, "suggested_reply": "Thank you (mock)."})
        body = json.dumps({"id": "msg_mock", "type": "message", "role": "assistant", "model": req.get("model"), "stop_reason": "tool_use",
                           "content": [{"type": "tool_use", "id": "toolu_mock", "name": "record_result", "input": content}],
                           "usage": {"input_tokens": 1, "output_tokens": 1}}).encode()
        self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers(); self.wfile.write(body)

    def log_message(self, *a):
        pass


def n8n_db() -> sqlite3.Connection:
    tmp = Path(tempfile.mkdtemp())
    for f in ("database.sqlite", "database.sqlite-wal", "database.sqlite-shm"):
        subprocess.run(["docker", "cp", f"{CTR}:/home/node/.n8n/{f}", str(tmp / f)], capture_output=True)
    con = sqlite3.connect(tmp / "database.sqlite"); con.row_factory = sqlite3.Row
    return con


def import_json(obj, name: str, kind: str):
    tmp = Path(tempfile.mkdtemp()) / name
    tmp.write_text(json.dumps(obj), encoding="utf-8")
    sh("docker", "cp", str(tmp), f"{CTR}:/tmp/{name}")
    sh("docker", "exec", "-e", "N8N_RUNNERS_BROKER_PORT=5691", CTR, "n8n", f"import:{kind}", f"--input=/tmp/{name}")
    sh("docker", "exec", "-u", "root", CTR, "rm", "-f", f"/tmp/{name}")


def wait_http(url, timeout=90):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=3); return
        except Exception:
            time.sleep(2)
    raise RuntimeError(f"{url} not up")


def backup_credential():
    """Keep the production CRM credential: the rehearsal temporarily replaces it with a local token."""
    sh("docker", "exec", "-e", "N8N_RUNNERS_BROKER_PORT=5691", CTR, "n8n", "export:credentials", "--id=auvCrmIngest001", "--decrypted", "--output=/tmp/crm-cred-backup.json")


def restore_credential():
    sh("docker", "exec", "-e", "N8N_RUNNERS_BROKER_PORT=5691", CTR, "n8n", "import:credentials", "--input=/tmp/crm-cred-backup.json")
    sh("docker", "exec", "-u", "root", CTR, "rm", "-f", "/tmp/crm-cred-backup.json")
    print("production CRM credential restored")


def main():
    # 1 · local token
    token = "auvi_" + secrets.token_urlsafe(32)
    psql("delete from integration_tokens where name = 'E2E n8n (local)'")
    psql(f"insert into integration_tokens (name, token_hash, prefix) values ('E2E n8n (local)', '{hashlib.sha256(token.encode()).hexdigest()}', '{token[:10]}')")
    import_json([{"id": "auvCrmIngest001", "name": "Auvetric CRM (ingest token)", "type": "httpHeaderAuth",
                  "data": {"name": "Authorization", "value": f"Bearer {token}"}}], "crm-cred.json", "credentials")
    print("token + credential imported")

    # 2 · test copies of 12 and 21
    wfs = []
    for wf in (bw.crm_sync(), bw.crm_triage()):
        for n in wf["nodes"]:
            if n["name"] == "Config":
                n["parameters"]["jsCode"] = (n["parameters"]["jsCode"]
                                             .replace("crmUrl: 'https://auvetric.com'", "crmUrl: 'http://host.docker.internal:3100'")
                                             .replace("aiProvider: 'anthropic'", "aiProvider: 'anthropic'")
                                             .replace("anthropicUrl: 'https://api.anthropic.com'", f"anthropicUrl: 'http://host.docker.internal:{MOCK_PORT}'"))
            if n["name"] == "Email partners":
                n["disabled"] = True
        wf["staticData"] = {}
        wfs.append(wf)
    for wf in wfs:
        import_json(wf, f"{wf['id']}.json", "workflow")
        sh("docker", "exec", "-e", "N8N_RUNNERS_BROKER_PORT=5691", CTR, "n8n", "publish:workflow", f"--id={wf['id']}")
    sh("docker", "restart", CTR)
    wait_http("http://127.0.0.1:5678/healthz")
    time.sleep(8)
    print("workflows imported, published, n8n restarted")

    # 3 · mock Ollama
    srv = http.server.ThreadingHTTPServer(("0.0.0.0", MOCK_PORT), MockAnthropic)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    # 4 · push (backfill) jobs + relay enquiries
    t0 = time.time()
    urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5678/webhook/auvetric-crm-sync", method="POST", data=b"{}"), timeout=30)
    for _ in range(30):
        n_opp = int(psql("select count(*) from opportunities where job_key like 'upwork:~0218%' or job_key like 'linkedin:40%'"))
        n_enq = int(psql("select count(*) from enquiries where source = 'relay' and (submission_id like 'test-%' or submission_id like 'roundtrip-%')"))
        if n_opp >= 25 and n_enq >= 16:
            break
        time.sleep(2)
    print(f"sync: {n_opp} opportunities, {n_enq} relay enquiries in the CRM ({time.time() - t0:.0f}s)")
    assert n_opp >= 25 and n_enq >= 16, "backfill incomplete"
    pre = psql("select count(*) from opportunities")
    urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5678/webhook/auvetric-crm-sync", method="POST", data=b"{}"), timeout=30)
    time.sleep(6)
    assert psql("select count(*) from opportunities") == pre, "second run must not duplicate"
    print("sync: second run idempotent")

    # 5 · website enquiry → claimed → triaged by (mock) model → saved
    psql("update enquiries set triage_status = 'done' where triage_status in ('pending','claimed')")  # isolate
    form = urllib.parse.urlencode({"intent": "project", "name": f"E2E Person {RUN}", "organisation": f"ZZ Test E2E {RUN}", "email": f"e2e+{RUN}@crm-test.invalid",
                                   "interest": "Engineering & Development", "description": "We need a telemetry dashboard for 40 pumps with MQTT alarms.",
                                   "consent": "on", "website": "", "started": str(int(time.time() * 1000) - 10000)}).encode()
    r = urllib.request.urlopen(urllib.request.Request(f"{CRM}/api/contact", data=form, headers={"origin": CRM, "x-forwarded-for": f"10.99.{int(RUN[:2], 16)}.1",
                                                                                                "content-type": "application/x-www-form-urlencoded"}), timeout=30)
    ref = json.loads(r.read())["ref"]
    eid = int(ref.split("-")[1])
    print("enquiry stored:", ref)
    urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5678/webhook/auvetric-crm-triage", method="POST", data=b"{}"), timeout=30)
    for _ in range(40):
        st = psql(f"select triage_status || '|' || status || '|' || coalesce(ai->>'summary','') from enquiries where id = {eid}")
        if st.startswith("done"):
            break
        time.sleep(2)
    print("triage:", st)
    print("mock Anthropic saw:", SEEN)
    assert SEEN.get("path") == "/v1/messages" and SEEN.get("key") and SEEN.get("version") == "2023-06-01" and SEEN.get("tool") == "record_result" and SEEN.get("schema") and SEEN.get("system"), SEEN
    assert st.startswith("done|new|MOCK triage"), st

    # 6 · n8n execution check: alert composed with CRM link, email node disabled
    time.sleep(3)
    con = n8n_db()
    row = con.execute("select e.status, d.data from execution_entity e join execution_data d on d.executionId = e.id "
                      "where e.workflowId = 'auvCrmTriage0001' and e.mode = 'webhook' order by e.id desc limit 1").fetchone()
    assert row["status"] == "success", row["status"]
    assert f"/crm/enquiries?open={eid}" in row["data"], "alert must link to the CRM enquiry"
    sync = con.execute("select staticData from workflow_entity where id = 'auvCrmSync00001'").fetchone()["staticData"]
    print("triage execution: success, alert composed with CRM link (email disabled in test)")
    print("sync cursor:", sync)
    srv.shutdown()
    print("\nE2E CRM link: all checks passed.")


if __name__ == "__main__":
    backup_credential()
    try:
        main()
    finally:
        restore_credential()
        print("Re-import the production workflows 12 and 21 now (README → CRM link); the test copies point at this PC.")
