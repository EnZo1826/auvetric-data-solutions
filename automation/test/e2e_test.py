"""End-to-end test for the Auvetric n8n workflows against the local GreenMail server.

Sends synthetic Upwork / LinkedIn job-alert emails, website enquiries (normal + spam), a duplicate alert
and an unrelated newsletter to alerts@auvetric.test, then verifies:
  - jobs are split, extracted, scored, de-duplicated and stored
  - strong matches are emailed to partners@auvetric.test
  - enquiries are parsed from the AUV1 payload, triaged, stored and alerted (spam stored, not alerted)
  - the newsletter is ignored by both workflows

Run (n8n + mailtest containers up, workflows active):  python automation/test/e2e_test.py
All companies, people and jobs below are fictional test data.
"""
from __future__ import annotations

import base64
import email
import email.header
import imaplib
import json
import shutil
import smtplib
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
from email.message import EmailMessage
from pathlib import Path

SMTP = ("127.0.0.1", 3025)
IMAP = ("127.0.0.1", 3143)
INBOX = "alerts@auvetric.test"
PARTNERS = ("partners@auvetric.test", "testpass")
RUN = uuid.uuid4().hex[:6]  # unique job ids per run so dedupe doesn't hide a fresh run
RUN_NUM = str(int(RUN, 16)).zfill(8)  # numeric form for LinkedIn job ids (digits only)


def upwork_alert() -> EmailMessage:
    jobs = [
        (f"Node-RED-MQTT-dashboard-for-pump-station-telemetry_~02180{RUN}11111111", "Node-RED + MQTT dashboard for pump station telemetry",
         "Fixed-price · Intermediate · Est. budget: $1,500", "We run 6 remote pump stations with Modbus RTU PLCs and 4G routers. Need Node-RED flows to poll pressure and flow, publish over MQTT to our broker, and a dashboard with alarms when pressure exceeds limits. Must handle connectivity drops without losing readings. Skills: Node-RED, MQTT, Modbus, Grafana or Node-RED dashboard."),
        (f"Logo-and-brand-identity-for-bakery_~02180{RUN}22222222", "Logo and brand identity for artisan bakery",
         "Fixed-price · Entry level · Est. budget: $150", "Looking for a creative designer to make a logo, colour palette and Instagram templates for our new bakery. Please share your Behance portfolio."),
        (f"Power-BI-sales-dashboard-messy-Excel-data_~02180{RUN}33333333", "Power BI sales & margin dashboard (messy Excel data)",
         "Hourly: $25-$45 · Expert · Est. time: 1 to 3 months", "Retail chain with 12 stores. Our sales and cost data comes from three Excel exports with duplicate product codes and inconsistent pack sizes. We need the data cleaned and reconciled, then a Power BI dashboard for gross margin by store and category. Power Query skills essential."),
    ]
    rows = "".join(f"""
      <tr><td style="padding:16px 0;border-bottom:1px solid #eee">
        <a href="https://www.upwork.com/jobs/{slug}/?referrer_url_path=%2Fnx%2Fsearch&amp;source=job_alert" style="font-size:18px;color:#14a800">{title}</a>
        <p style="color:#5e6d55">{meta}</p><p>{desc}</p>
        <a href="https://www.upwork.com/jobs/{slug}/?source=job_alert&amp;utm_campaign=view_job">View job</a>
      </td></tr>""" for slug, title, meta, desc in jobs)
    m = EmailMessage()
    m["From"] = "Upwork <donotreply@upwork.com>"; m["To"] = INBOX
    m["Subject"] = "3 new jobs matching your saved search: Node-RED OR Power BI"
    m.set_content("View these jobs on Upwork.")
    m.add_alternative(f"<html><body><h2>New jobs for you</h2><table>{rows}</table><p><a href='https://www.upwork.com/nx/find-work/'>See more jobs</a> · <a href='https://www.upwork.com/ab/notification-settings/'>Unsubscribe</a></p></body></html>", subtype="html")
    return m


def linkedin_alert() -> EmailMessage:
    jobs = [
        (f"40{RUN_NUM}1", "ERPNext / Frappe Developer (Remote, 6-month contract)", "Kestrel Logistics Ltd · Remote (EMEA)",
         "Contract role to build custom doctypes, workflows and a REST integration between ERPNext v15 and our warehouse app. Python, Frappe framework, MariaDB."),
        (f"40{RUN_NUM}2", "Senior Data Engineer", "Northgate Defence Systems · London, United Kingdom (On-site)",
         "Full-time on-site. Must hold active UK security clearance and British citizenship. Spark, Databricks, Azure Synapse, 8+ years."),
    ]
    rows = "".join(f"""
      <table><tr><td>
        <a href="https://www.linkedin.com/comm/jobs/view/{jid}/?trackingId=abc%3D%3D&amp;refId=xyz&amp;lipi=urn">{title}</a>
        <p>{company}</p><p>{desc}</p>
        <a href="https://www.linkedin.com/comm/jobs/view/{jid}/?trk=eml-email_job_alert_digest_01-job_card-0-apply">Apply</a>
      </td></tr></table>""" for jid, title, company, desc in jobs)
    m = EmailMessage()
    m["From"] = "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>"; m["To"] = INBOX
    m["Subject"] = "“ERPNext developer”: 2 new jobs"
    m.set_content("Your job alert for ERPNext developer")
    m.add_alternative(f"<html><body><p>Your job alert for <b>ERPNext developer</b></p>{rows}<p><a href='https://www.linkedin.com/comm/jobs/search/'>See all jobs</a></p></body></html>", subtype="html")
    return m


def enquiry(spam: bool = False) -> EmailMessage:
    d = ({"submission_id": f"test-{RUN}-spam", "submitted_at": "2026-10-18T10:00:00Z", "intent": "general", "name": "Growth Team",
          "organisation": "RankBoost SEO Agency", "email": "offers@rankboost.example", "phone": "", "interest": "Not sure yet",
          "budget": "Not specified", "timeline": "Not specified",
          "description": "Dear Sir/Madam, we can put your website on Google page 1 in 7 days!! 10,000 backlinks for $99. Reply now for a free audit. Unsubscribe by replying STOP."}
         if spam else
         {"submission_id": f"test-{RUN}-real", "submitted_at": "2026-10-18T09:30:00Z", "intent": "project", "name": "Maria Shikongo",
          "organisation": "Okahandja Water Cooperative (fictional test)", "email": "maria@example.com", "phone": "+264 81 000 0000",
          "interest": "Engineering & Development", "budget": "N$50 000 – N$150 000", "timeline": "Within 3 months",
          "description": "We operate 4 borehole pump sites without monitoring. We want to see water level, pump run hours and power failures on a dashboard and get an SMS or email alert when a pump trips. Sites have patchy cellular coverage. We also need monthly usage reports per site."})
    payload = "AUV1." + base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=") + ".AUV"
    lines = "\n".join(f"{k.title()}: {v}" for k, v in d.items() if k not in ("submission_id", "submitted_at"))
    m = EmailMessage()
    m["From"] = "Web3Forms <notify@web3forms.com>"; m["To"] = INBOX; m["Reply-To"] = d["email"]
    m["Subject"] = f"[Auvetric enquiry] {'General Enquiry' if spam else 'Discuss a Project'} - {d['name']}"
    m.set_content(f"New form submission\n\n{lines}\n\nPayload: {payload}\n")
    return m


def newsletter() -> EmailMessage:
    m = EmailMessage()
    m["From"] = "Tech Weekly <news@techweekly.example>"; m["To"] = INBOX
    m["Subject"] = "This week in tech"; m.set_content("Unrelated newsletter: should be ignored by both workflows.")
    return m


def send(msgs):
    with smtplib.SMTP(*SMTP) as s:
        for m in msgs:
            s.send_message(m)


def partner_mail():
    im = imaplib.IMAP4(*IMAP); im.login(*PARTNERS); im.select("INBOX")
    _, ids = im.search(None, "ALL"); out = []
    for i in ids[0].split():
        _, data = im.fetch(i, "(RFC822)"); msg = email.message_from_bytes(data[0][1])
        out.append({"subject": str(email.header.make_header(email.header.decode_header(msg["Subject"]))), "reply_to": msg.get("Reply-To", "")})
    im.logout(); return out


def db_rows():
    tmp = Path(tempfile.mkdtemp())
    for f in ("database.sqlite", "database.sqlite-wal", "database.sqlite-shm"):
        subprocess.run(["docker", "cp", f"auvetric-n8n:/home/node/.n8n/{f}", str(tmp / f)], capture_output=True)
    con = sqlite3.connect(tmp / "database.sqlite"); con.row_factory = sqlite3.Row
    tabs = {r["name"]: r["id"] for r in con.execute("select id, name from data_table")}
    def rows(name):
        t = next((n for n in [r[0] for r in con.execute("select name from sqlite_master where type='table'")] if tabs[name] in n), None)
        return [dict(r) for r in con.execute(f'select * from "{t}"')] if t else []
    ex = [dict(r) for r in con.execute("select workflowId, status, startedAt from execution_entity order by id")]
    res = {"jobs": rows("auvetric_jobs"), "enquiries": rows("auvetric_enquiries"), "executions": ex}
    con.close(); shutil.rmtree(tmp, ignore_errors=True); return res


def wait_for(pred, timeout, label):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = db_rows()
        if pred(r):
            return r
        time.sleep(10)
    print(f"TIMEOUT waiting for {label}"); return db_rows()


if __name__ == "__main__":
    fails = []
    def check(cond, msg):
        print(("PASS " if cond else "FAIL ") + msg)
        if not cond: fails.append(msg)

    from datetime import datetime, timezone
    T0 = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")  # n8n stores UTC timestamps
    print(f"run id {RUN}: clearing partner test inbox, sending 5 test emails")
    im = imaplib.IMAP4(*IMAP); im.login(*PARTNERS); im.select("INBOX")
    _, ids = im.search(None, "ALL")
    for i in ids[0].split():
        im.store(i, "+FLAGS", "\\Deleted")
    im.expunge(); im.logout()
    send([upwork_alert(), linkedin_alert(), enquiry(), enquiry(spam=True), newsletter()])
    mine = lambda rows, key: [r for r in rows if RUN in r.get(key, "") or f"40{RUN_NUM}" in r.get(key, "")]
    r = wait_for(lambda r: len(mine(r["jobs"], "job_key")) >= 5 and len(mine(r["enquiries"], "enquiry_key")) >= 2, 900, "AI processing")
    jobs, enqs = mine(r["jobs"], "job_key"), mine(r["enquiries"], "enquiry_key")

    check(len(jobs) == 5, f"5 jobs stored from 2 alert emails (got {len(jobs)})")
    by = {j["title"][:30]: j for j in jobs}
    for j in sorted(jobs, key=lambda j: -j["fit_score"]):
        print(f"   {j['fit_score']:>3}  {j['action']:<9} {j['practice']:<12} {j['source']:<8} {j['title'][:60]} | {j['budget']} | {j['extraction_status']}")
    check(all(j["extraction_status"] == "ok" for j in jobs), "every job extracted by the local model")
    get = lambda frag: next((j for j in jobs if frag.lower() in j["title"].lower()), None)
    nr, pbi, logo, erp, clr = get("Node-RED"), get("Power BI"), get("Logo"), get("ERPNext"), get("Data Engineer")
    check(bool(nr and nr["fit_score"] >= 70), "Node-RED/MQTT job scored as a strong match (>= 70)")
    check(bool(pbi and pbi["fit_score"] >= 70), "Power BI + data cleansing job scored as a strong match (>= 70)")
    check(bool(erp and erp["fit_score"] >= 60), "ERPNext contract scored >= 60")
    check(bool(erp and erp["practice"] == "engineering"), f"ERPNext contract tagged engineering (got {erp and erp['practice']})")
    check(bool(pbi and pbi["practice"] == "data_bi"), f"Power BI job tagged data_bi (got {pbi and pbi['practice']})")
    check(bool(logo and logo["fit_score"] < 40), "logo design job scored as poor fit (< 40)")
    check(bool(clr and clr["fit_score"] < 50), "on-site London role needing UK clearance scored < 50")
    check(bool(nr and nr["url"].startswith("https://www.upwork.com/jobs/~")), "Upwork URL canonicalised")
    check(bool(erp and erp["url"].startswith("https://www.linkedin.com/jobs/view/")), "LinkedIn URL canonicalised")

    real = next((e for e in enqs if e["enquiry_key"].endswith("-real")), None)
    spam = next((e for e in enqs if e["enquiry_key"].endswith("-spam")), None)
    check(bool(real and real["name"] == "Maria Shikongo" and real["email"] == "maria@example.com"), "enquiry fields parsed from AUV1 payload")
    if real:
        print(f"   real: {real['category']} / {real['practice']} / {real['priority']} / spam {real['spam_score']}")
    if spam:
        print(f"   spam: {spam['category']} / spam {spam['spam_score']}")
    check(bool(real and real["spam_score"] < 70 and real["category"] in ("project", "consultation")), "real enquiry triaged as a project, not spam")
    check(bool(spam and (spam["spam_score"] >= 70 or spam["category"] in ("spam", "vendor_pitch"))), "SEO pitch flagged as spam / vendor pitch")
    check(bool(real and len(real["suggested_reply"]) > 80), "draft reply generated for the real enquiry")

    time.sleep(20)
    mail = partner_mail()
    subjects = [m["subject"] for m in mail]
    for s in subjects:
        print("   mail:", s)
    check(any("[Auvetric jobs]" in s and "strong match" in s for s in subjects), "strong-match job alert emailed to partners")
    check(any("[Auvetric lead]" in s and "Maria Shikongo" in s for s in subjects), "enquiry alert emailed to partners")
    check(any(m["reply_to"] == "maria@example.com" for m in mail if "Maria" in m["subject"]), "enquiry alert reply-to is the client")
    check(not any("RankBoost" in s or "Growth Team" in s for s in subjects), "spam enquiry not alerted")

    # dedupe: resend the same Upwork alert; job count must not grow
    send([upwork_alert()])
    time.sleep(60)
    r2 = db_rows()
    check(len(mine(r2["jobs"], "job_key")) == 5, f"re-sent alert de-duplicated (still {len(mine(r2['jobs'], 'job_key'))} jobs)")
    errs = [e for e in r2["executions"] if e["status"] == "error" and e["startedAt"] >= T0]
    check(not errs, f"no failed executions during this run ({len(errs)} errors)")
    print(f"\n{'ALL PASSED' if not fails else str(len(fails)) + ' FAILED'}")
    sys.exit(1 if fails else 0)
