// api/dispatch.js - add this near the top before any Twilio calls
if (process.env.TWILIO_ENABLED !== 'true') {
  return res.status(200).json({ ok: true, disabled: true, message: 'SMS disabled - pending carrier verification' });
}
// api/dispatch.js - DeltaAgent SMS Dispatch
// Sends alert SMS when decision arrives in inbox
// Also handles manual CONFIRM & DISPATCH from dashboard

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

// Demo mode: just send to Port Director
// Production: map decision types to contact lists
function getRecipients(decisionType) {
  const portDirector = {
    name: process.env.DEMO_CONTACT_NAME || "Port Director",
    phone: process.env.DEMO_PHONE_NUMBER,
    role: "PORT_DIRECTOR",
  };
  const guest = process.env.GUEST_PHONE_NUMBER ? {
    name: process.env.GUEST_CONTACT_NAME || "Guest",
    phone: process.env.GUEST_PHONE_NUMBER,
    role: "GUEST",
  } : null;

  return [portDirector, guest].filter(Boolean);
}

function buildAlertSMS(decision, gaugeContext, pendingId) {
  const ts = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const gaugeInfo = decision.disruptionType === "FLOOD"
    ? `Carrollton Gauge: ${gaugeContext.ft}ft`
    : decision.disruptionType === "FOG"
    ? `SW Pass Visibility: ${gaugeContext.vis}nm`
    : decision.disruptionType === "ICE"
    ? `Corps Ice Index: ${gaugeContext.ice}/10`
    : `Storm Distance: ${gaugeContext.dist}mi Cat${gaugeContext.cat}`;

  return [
    `DELTAAGENT ALERT - ${ts} CST`,
    `${decision.disruptionType}: ${decision.disruptionLabel}`,
    ``,
    decision.title,
    gaugeInfo,
    `Advance Warning: ${decision.advanceWarning}`,
    `Est. Savings: $${decision.costAvoided.toLocaleString()}`,
    ``,
    `Reply YES to dispatch`,
    `Reply NO to override`,
    ``,
    `Ref: ${pendingId}`,
    `DeltaAgent AI | deltaagent.ai`,
  ].join("\n");
}

function buildDispatchSMS(decision, gaugeContext) {
  const ts = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  return [
    `DELTAAGENT DISPATCHED - ${ts} CST`,
    `CONFIRMED: ${decision.title}`,
    ``,
    `Actions dispatched:`,
    ...decision.actions.slice(0, 3).map((a, i) => `${i+1}. ${a}`),
    decision.actions.length > 3 ? `+${decision.actions.length - 3} more actions` : "",
    ``,
    `Cost avoided: $${decision.costAvoided.toLocaleString()}`,
    `DeltaAgent AI | deltaagent.ai`,
  ].filter(l => l !== "").join("\n");
}

async function sendSMS(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: TWILIO_FROM_NUMBER, To: to, Body: body }),
  });
  const d = await r.json();
  return { sid: d.sid, status: d.status, error: d.message };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { decision, gaugeContext, mode } = req.body;
    if (!decision) return res.status(400).json({ error: "No decision provided" });
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      return res.status(500).json({ error: "Twilio not configured" });
    }

    const recipients = getRecipients(decision.disruptionType);
    const pendingId = `DA-${decision.id}-${Date.now().toString(36).toUpperCase()}`;

    // mode = "alert" (inbox arrival) or "dispatch" (confirmed action)
    const isAlert = mode !== "dispatch";
    const message = isAlert
      ? buildAlertSMS(decision, gaugeContext || {}, pendingId)
      : buildDispatchSMS(decision, gaugeContext || {});

    const results = await Promise.all(
      recipients.map(async (contact) => {
        const result = await sendSMS(contact.phone, message);
        return {
          contact: contact.name,
          role: contact.role,
          sid: result.sid,
          status: result.error ? "failed" : "sent",
          error: result.error || null,
        };
      })
    );

    return res.json({
      success: true,
      mode: isAlert ? "alert" : "dispatch",
      pendingId,
      dispatched: results.filter(r => r.status === "sent").length,
      failed: results.filter(r => r.status === "failed").length,
      recipients: results,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
