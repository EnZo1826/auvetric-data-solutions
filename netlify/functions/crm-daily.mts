// Netlify Scheduled Function: runs the CRM daily job at 04:00 UTC (06:00 Windhoek).
// Scheduled functions only run on published production deploys.
// Needs CRM_CRON_SECRET (same value as the site's runtime variable). URL is set by Netlify.
const crmDaily = async () => {
  const secret = process.env.CRM_CRON_SECRET;
  const base = process.env.URL;
  if (!secret || !base) {
    console.error("crm-daily: CRM_CRON_SECRET or URL missing; skipped.");
    return;
  }
  const res = await fetch(`${base}/api/crm/cron`, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(25_000) });
  const body = await res.text();
  if (!res.ok) throw new Error(`crm-daily: ${res.status} ${body.slice(0, 300)}`);
  console.log(`crm-daily: ${body.slice(0, 500)}`);
};

export default crmDaily;

export const config = { schedule: "0 4 * * *" };
