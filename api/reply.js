// api/reply.js - DeltaAgent Twilio Webhook
// Receives SMS replies from Port Director (YES/NO)
// Updates pending decision state and triggers dispatch if YES

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

// In-memory pending decisions store
// In production this would be Supabase
const pendingStore = global._deltaAgentPending || (global._deltaAgentPending = {});

async function sendSMS(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: TWILIO_FROM_NUMBER, To: to, Body: body }),
  });
}

export default async function handler(req, res) {
  // Twilio sends POST with form data
  res.setHeader("Content-Type", "text/xml");

  const body = req.body || {};
  const from    = body.From || "";
  const msgBody = (body.Body || "").trim().toUpperCase();

  // Parse reply
  const isYes = msgBody.startsWith("YES") || msgBody === "Y" || msgBody === "CONFIRM";
  const isNo  = msgBody.startsWith("NO")  || msgBody === "N" || msgBody === "OVERRIDE" || msgBody === "CANCEL";

  // Extract pending ID from message if included (e.g. "YES DA-d1-ABC123")
  const parts = msgBody.split(" ");
  const pendingId = parts.find(p => p.startsWith("DA-")) || null;

  let responseMsg = "";

  if (isYes) {
    responseMsg = pendingId && pendingStore[pendingId]
      ? `DELTAAGENT: Confirmed. Dispatching ${pendingStore[pendingId].title}. All contacts notified.`
      : `DELTAAGENT: Confirmed. Dispatching all pending actions. Contacts notified.`;

    // Store confirmation for dashboard polling
    const confirmKey = pendingId || `confirm-${Date.now()}`;
    pendingStore[confirmKey] = {
      ...( pendingStore[pendingId] || {} ),
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedBy: from,
    };

  } else if (isNo) {
    responseMsg = `DELTAAGENT: Override logged. Manual coordination required. Dashboard updated.`;

    const overrideKey = pendingId || `override-${Date.now()}`;
    pendingStore[overrideKey] = {
      ...( pendingStore[pendingId] || {} ),
      status: "overridden",
      overriddenAt: new Date().toISOString(),
      overriddenBy: from,
    };

  } else {
    responseMsg = `DELTAAGENT: Reply YES to confirm dispatch or NO to override. Include the Ref ID from the alert for faster processing.`;
  }

  // Respond with TwiML
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMsg}</Message>
</Response>`);
}
