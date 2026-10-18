# Auvetric automation (n8n)

Local n8n that triages **job-alert emails** (Upwork, LinkedIn) and **website enquiries** with a local AI model, stores everything in n8n Data Tables, and emails Jakes and Alex.

```
Upwork / LinkedIn job alerts ──┐
                               ├─► Auvetric mailbox ─IMAP─► 05 inbox router ─► 10 Jobs triage ──► auvetric_jobs ─► instant alert (fit ≥ 70)
Website form ─► Web3Forms ─────┘                                            │                                  └► 11 daily digest 07:30
                                                                            └► 20 Website enquiries ─► auvetric_enquiries ─► partner alert + draft reply
                                             AI: Ollama qwen3:8b on this PC (host.docker.internal:11434)
```

## Why it is built this way

- **No scraping.** Upwork shut down RSS feeds in August 2024, and LinkedIn's terms prohibit bots and scrapers, with account restriction as the penalty. Both platforms will email you saved-search alerts, and that is what this system reads. Your accounts stay safe.
- **Nothing exposed to the internet.** n8n listens on `127.0.0.1:5678` only. Every input arrives by email (IMAP). The website form goes through Web3Forms, which emails the mailbox.
- **Private AI.** Job and enquiry text is processed by Ollama on this PC; nothing is sent to an AI provider.
- **Untrusted text stays data.** The model only fills a fixed JSON schema. Its output is stored and emailed to the partners. It never triggers actions or contacts anyone.
- **Nothing is lost.** If the model fails, the record is stored with `extraction_status = failed` and the raw text.

## Workflows

| ID | Name | Trigger | What it does |
|---|---|---|---|
| `auvMailRouter001` | 05 Mail · inbox router | New unread email (IMAP) | Classifies each email: Upwork/LinkedIn sender domain → jobs, subject `[Auvetric enquiry]` → enquiries, anything else ignored. Does **not** mark or move emails. |
| `auvJobsTriage001` | 10 Jobs · triage alert emails | Called by router | Splits each alert into jobs by URL pattern, skips jobs already stored, extracts title/company/budget/skills, scores fit 0-100 against the Auvetric profile, stores, emails matches ≥ threshold. |
| `auvJobsDigest001` | 11 Jobs · daily digest | 07:30 Africa/Windhoek | Emails all undigested jobs, highest fit first, then marks them digested. |
| `auvEnquiries0001` | 20 Website · process enquiries | Called by router | Decodes the form payload, skips duplicates, classifies (project / consultation / vendor pitch / spam …), writes a summary, key requirements, questions to ask and a draft reply, stores, emails partners (reply-to = client). Spam score ≥ 70 is stored but not emailed. |
| `auvSetupTables01` | 00 Setup · create data tables | Manual | Creates `auvetric_jobs` and `auvetric_enquiries`. Safe to re-run. |

## One-time setup (you)

1. **Open n8n** at http://localhost:5678 and create the owner account (your own email and password).
2. **Mailbox credentials.** In *Overview → Credentials*, edit the two existing credentials. Workflows reference them by ID, so you never edit the workflows:
   - `Auvetric mailbox (IMAP)`: host, port 993, SSL on, username and password (use an app password if the provider supports one).
   - `Auvetric mailbox (SMTP)`: host, port 465 (SSL) or 587 (STARTTLS), the same username and password.
   They currently point at the local **test** mail server.
3. **Config.** Open workflows *10*, *11* and *20* and edit the **Config** node in each: `alertTo` (both partners' emails, comma-separated), `fromAddress` (the mailbox address) and `alertThreshold`.
4. **Job alerts.** Create saved searches with email alerts going to the Auvetric mailbox:
   - Upwork: *Find work → search → Save search → enable notifications* (and *Settings → Notification settings → job alerts*).
   - LinkedIn: *Jobs → search → Set alert → email, daily* (maximum 20 alerts per member).
   Use searches like `Node-RED`, `MQTT`, `ERPNext`, `Frappe`, `Power BI`, `data cleansing`, `IoT dashboard`. If alerts go to a personal inbox, add a mail rule forwarding them to the Auvetric mailbox.
5. **Website form.** Sign up at https://web3forms.com with the Auvetric mailbox address and copy the access key (it is public by design). Then add it as a **repository variable** (not a secret): GitHub → *auvetric-data-solutions → Settings → Secrets and variables → Actions → Variables → New*, name `WEB3FORMS_ACCESS_KEY`. Re-run the *Deploy GitHub Pages* workflow. The contact page switches from "unavailable" to the live form automatically.
6. **Stop the test mail server** once real credentials work: `docker compose --profile test stop mailtest`.

> **Changing mailbox (test → Zoho, or any switch later):** the router remembers the last message number it saw, and every mailbox numbers its messages independently. After pointing the IMAP credential at a different mailbox, reset the router's stored state or new mail is silently skipped:
> ```bash
> python -c "import json;w=json.load(open('workflows/auvMailRouter001.json',encoding='utf-8'));w['staticData']={};open('backups/router-reset.json','w',encoding='utf-8').write(json.dumps(w))"
> docker cp backups/router-reset.json auvetric-n8n:/tmp/r.json
> docker exec -e N8N_RUNNERS_BROKER_PORT=5691 auvetric-n8n sh -c 'n8n import:workflow --input=/tmp/r.json && n8n publish:workflow --id=auvMailRouter001'
> docker restart auvetric-n8n
> ```
> n8n's IMAP credential has no built-in test, so "No testing function found for this credential" in the editor is normal. Verify by sending a test email and checking *05 Mail · inbox router → Executions*.

**Zoho Mail (auvetric.com):** IMAP `imappro.zoho.com:993` SSL; SMTP `smtppro.zoho.com:465` SSL; user `info@auvetric.com`. IMAP access must be enabled in Zoho Mail settings, and with two-factor sign-in on you must use an app password. Set `fromAddress` to the same mailbox.

## Operating

```bash
cd "F:/Projects/Auvetric Data Solutions/automation"
docker compose ps                       # status
docker compose logs -f n8n              # logs
python test/status.py                   # recent executions + table row counts
docker compose pull && docker compose up -d   # update (pin N8N_VERSION in .env first; read n8n release notes)
```

- **Data:** *n8n → Overview → Data tables*: `auvetric_jobs` (set `status` to applied/declined as you go) and `auvetric_enquiries`.
- **Executions:** each workflow's *Executions* tab shows every run, input and output for 14 days.
- **Backups** (weekly suggested). The workflows are already in git (`workflows/*.json`, generated by `build_workflows.py`). The database also holds credentials and data tables, so back up the volume too:
  ```bash
  docker run --rm -v auvetric_n8n_data:/data -v "$PWD/backups":/backup alpine tar czf /backup/n8n-data-$(date +%F).tgz -C /data .
  ```
  Keep `automation/.env` safe and out of git. Its `N8N_ENCRYPTION_KEY` is needed to decrypt the stored credentials.
- **Ollama must be running** (it starts with Windows). The first job after a reboot takes about 4 minutes while the model loads, then about 15-20 s per job on the RTX 3050.

## Changing the workflows

Edit `build_workflows.py` (profile, prompts, schedule, threshold defaults), then:

```bash
python build_workflows.py
docker exec -e N8N_RUNNERS_BROKER_PORT=5691 auvetric-n8n sh -c 'n8n import:workflow --separate --input=/import/workflows && for w in auvMailRouter001 auvJobsTriage001 auvEnquiries0001 auvJobsDigest001 auvSetupTables01; do n8n publish:workflow --id=$w; done'
docker restart auvetric-n8n
```

Re-importing overwrites edits made in the n8n editor (including Config values), so make lasting changes in `build_workflows.py`.

## Tests

`python test/build_roundtrip.py` + import + `curl -X POST http://127.0.0.1:5678/webhook/auvetric-mail-roundtrip` sends a TEST enquiry through the real mailbox (SMTP → IMAP → triage → alert). `python test/e2e_test.py` runs the whole pipeline against the local GreenMail test server (point the credentials and Config at the test server first) (`docker compose --profile test up -d mailtest`). It sends synthetic Upwork and LinkedIn alerts, a real and a spam enquiry, a duplicate and an unrelated newsletter, then checks extraction, scoring, storage, alerts, reply-to, spam suppression, de-duplication and that no execution errored. `python test/probe_enquiry.py` runs the enquiry prompt directly against Ollama to tune it.

Parsing is format-tolerant: jobs are found by URL pattern (`upwork.com/jobs/…~0…`, `linkedin.com/(comm/)jobs/view/<id>`), not by the alert's layout. Real Upwork and LinkedIn emails were not available for testing. When the first real alerts arrive, check *10 Jobs → Executions* to confirm the jobs were split correctly.

## Where Hermes fits

n8n does the always-on intake. Hermes is the analyst on top:
- Ask Hermes "which jobs should we apply for this week?" or "draft a proposal for job X". Hermes can read the data tables through the n8n API: create an API key in *n8n → Settings → n8n API*, then give it to Hermes when asked (Hermes stores it in its vault, never in chat).
- A Hermes scheduled job can also do a weekly pipeline review (applied vs. skipped, enquiry response times) once the API key exists.
