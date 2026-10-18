"""Reproduce the enquiry-triage prompt outside n8n to debug classification quality."""
import json, re, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_workflows as B

js = B.ENQ_PROMPT_JS
system = re.search(r"const system = `(.*?)`;", js, re.S).group(1).replace("${profile}", B.PROFILE)
e = {"name": "Maria Shikongo", "organisation": "Okahandja Water Cooperative", "email": "maria@example.com", "intent": "project",
     "interest": "Engineering & Development", "budget": "N$50 000 – N$150 000", "timeline": "Within 3 months",
     "message": "We operate 4 borehole pump sites without monitoring. We want to see water level, pump run hours and power failures on a dashboard and get an SMS or email alert when a pump trips. Sites have patchy cellular coverage. We also need monthly usage reports per site."}
user = (f"Name: {e['name']}\nOrganisation: {e['organisation']}\nEmail: {e['email']}\nIntent selected: {e['intent']}\nArea of interest: {e['interest']}\n"
        f"Budget: {e['budget']}\nTimeline: {e['timeline']}\n\nMessage:\n<<<\n{e['message']}\n>>>")
body = {"model": "qwen3:8b", "stream": False, "think": False, "options": {"temperature": 0.2, "num_ctx": 8192}, "format": B.ENQ_SCHEMA,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
r = json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:11434/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=600))
out = json.loads(r["message"]["content"])
print(json.dumps({k: out[k] for k in ("who_is_selling", "category", "practice", "priority", "spam_score")}, indent=1))
