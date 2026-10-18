"""Temporary live round-trip test through the real mailbox (not part of the production set).

Builds test/roundtrip_workflow.json: POST /webhook/auvetric-mail-roundtrip on localhost sends a synthetic
website enquiry (clearly labelled TEST) from the mailbox to itself via the production SMTP credential.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_workflows as B

PAYLOAD_JS = r"""
const d = { submission_id: 'roundtrip-' + Date.now(), submitted_at: new Date().toISOString(), intent: 'project',
  name: 'EnZo connectivity test', organisation: 'Auvetric internal TEST', email: 'info@auvetric.com', phone: '',
  interest: 'Engineering & Development', budget: 'Not specified', timeline: 'Not specified',
  description: 'TEST ONLY: automated mailbox round-trip check from the n8n setup. We need remote monitoring for 3 water pumps with alarms on a dashboard. Please ignore.' };
const payload = 'AUV1.' + Buffer.from(JSON.stringify(d)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') + '.AUV';
return [{ json: { subject: `[Auvetric enquiry] Discuss a Project - ${d.name}`,
  text: `TEST round-trip from n8n (sent ${d.submitted_at}).\n\nName: ${d.name}\nMessage: ${d.description}\n\nPayload: ${payload}\n` } }];
"""
n = [
    B.node("Start round-trip (localhost)", "n8n-nodes-base.webhook", 2, [0, 0],
           {"httpMethod": "POST", "path": "auvetric-mail-roundtrip", "responseMode": "lastNode", "options": {}}, webhookId="auvetric-mail-roundtrip"),
    B.code("Build test enquiry", [220, 0], PAYLOAD_JS),
    B.node("Send via Zoho SMTP", "n8n-nodes-base.emailSend", 2.1, [440, 0], {
        "fromEmail": "info@auvetric.com", "toEmail": "info@auvetric.com", "subject": "={{ $json.subject }}",
        "emailFormat": "text", "text": "={{ $json.text }}", "options": {"appendAttribution": False}}, credentials=B.SMTP),
]
wf = B.workflow("99 Test · mailbox round-trip", n, B.chain(*[x["name"] for x in n]), "auvTestRoundtrp1")
Path(__file__).with_name("roundtrip_workflow.json").write_text(json.dumps(wf, indent=2), encoding="utf-8")
print("written")
