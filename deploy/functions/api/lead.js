// Cloudflare Pages Function behind the site's lead form (POST /api/lead).
// Reconstructed 2026-09-01 — the original file was lost from this checkout
// after the 2026-08-20 VPS -> Pages Functions migration; only its behavior
// survived in project memory. Rebuilt from that description:
//   - validate the payload
//   - send 2 emails via Resend (business notification in Portuguese,
//     lead confirmation in English) and fail the request if either send
//     errors (the original had a silent-failure bug here from the Resend
//     Node SDK swallowing errors — using raw fetch to Resend's REST API
//     avoids that class of bug since a failed send surfaces as a non-2xx
//     HTTP status we check directly)
//   - forward the lead to the Liun.app CRM, best-effort, never allowed to
//     affect the response sent back to the site visitor
//   - notify the business by SMS via SimpleTexting, best-effort
//   - a simple in-isolate rate limit (5 requests/min/IP) — not distributed,
//     resets on cold start, matching the original's documented trade-off
//
// The SimpleTexting call shape (endpoint + payload) is a best-effort
// reconstruction — SimpleTexting's exact request format wasn't recorded
// anywhere retrievable, so verify a real lead actually produces an SMS
// before relying on this path; it's wrapped so a wrong shape only drops
// the SMS, never the email/CRM delivery.

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitState = new Map(); // ip -> { count, windowStart }

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitState.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitState.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function corsHeaders(origin, allowedOrigins) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function validatePayload(body) {
  const errors = [];
  const name = sanitizeText(body.name, 120);
  const phone = sanitizeText(body.phone, 30);
  const email = sanitizeText(body.email, 200);
  const city = sanitizeText(body.city, 80);
  const service = sanitizeText(body.service, 120);
  const details = sanitizeText(body.details, 2000);

  if (!name) errors.push("Name is required.");
  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) errors.push("A valid phone number is required.");
  if (!email || !isValidEmail(email)) errors.push("A valid email is required.");

  return {
    errors,
    clean: { name, phone, email, city, service, details },
  };
}

async function sendResendEmail(env, { to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${errBody}`);
  }
  return res.json();
}

function businessNotificationHtml(lead) {
  return `
    <h2>Novo lead recebido — EZClean Pros</h2>
    <p><strong>Nome:</strong> ${lead.name}</p>
    <p><strong>Telefone:</strong> ${lead.phone}</p>
    <p><strong>Email:</strong> ${lead.email}</p>
    <p><strong>Cidade:</strong> ${lead.city || "-"}</p>
    <p><strong>Serviço:</strong> ${lead.service || "-"}</p>
    <p><strong>Detalhes:</strong> ${lead.details || "-"}</p>
    <hr>
    <p><strong>UTM source:</strong> ${lead.utm_source || "-"}</p>
    <p><strong>UTM medium:</strong> ${lead.utm_medium || "-"}</p>
    <p><strong>UTM campaign:</strong> ${lead.utm_campaign || "-"}</p>
    <p><strong>gclid:</strong> ${lead.gclid || "-"}</p>
  `;
}

function leadConfirmationHtml(lead) {
  return `
    <h2>Thanks for reaching out to EZClean Pros!</h2>
    <p>Hi ${lead.name},</p>
    <p>We received your request${lead.city ? ` for cleaning in ${lead.city}` : ""} and a member of our team will reach out shortly to confirm your free quote.</p>
    <p>If anything is urgent, feel free to call us at (858) 370-5205.</p>
    <p>— EZClean Pros</p>
  `;
}

async function forwardLeadToCrm(env, lead) {
  try {
    await fetch(env.CRM_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CRM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.city,
        service_type: lead.service,
        notes: lead.details,
        origin: "site",
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    // Best-effort — CRM being down/unreachable must never affect the
    // response sent back to the site visitor.
  }
}

async function notifyBusinessBySms(env, lead) {
  try {
    if (!env.SIMPLETEXT_API_KEY || !env.LEAD_NOTIFICATION_PHONE) return;
    await fetch("https://api-app2.simpletexting.com/v2/api/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SIMPLETEXT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountPhone: env.SIMPLETEXT_APP_ID,
        contactPhone: env.LEAD_NOTIFICATION_PHONE,
        mode: "AUTO",
        text: `New lead: ${lead.name} - ${lead.phone} (${lead.city || "no city"})`,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    // Best-effort — same rule as the CRM push.
  }
}

export async function onRequestOptions(context) {
  const allowedOrigins = (context.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const origin = context.request.headers.get("Origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const allowedOrigins = (env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin, allowedOrigins);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (isRateLimited(ip)) {
    return jsonResponse({ success: false, error: "Too many requests. Please try again in a minute." }, 429, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ success: false, error: "Invalid request body." }, 400, headers);
  }

  const { errors, clean } = validatePayload(body);
  if (errors.length) {
    return jsonResponse({ success: false, error: errors.join(" ") }, 400, headers);
  }

  const lead = {
    ...clean,
    utm_source: sanitizeText(body.utm_source, 200),
    utm_medium: sanitizeText(body.utm_medium, 200),
    utm_campaign: sanitizeText(body.utm_campaign, 200),
    gclid: sanitizeText(body.gclid, 200),
  };

  try {
    const businessSend = sendResendEmail(env, {
      to: env.NOTIFY_EMAIL.split(",").map((email) => email.trim()).filter(Boolean),
      subject: `Novo lead — ${lead.name}${lead.city ? ` (${lead.city})` : ""}`,
      html: businessNotificationHtml(lead),
    });
    const confirmationSend = sendResendEmail(env, {
      to: lead.email,
      subject: "We got your request — EZClean Pros",
      html: leadConfirmationHtml(lead),
    });
    await Promise.all([businessSend, confirmationSend]);
  } catch (err) {
    console.error("lead_email_send_failed", err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: "Failed to send email. Please try again." }, 502, headers);
  }

  // Best-effort side effects — never block or fail the response for these.
  context.waitUntil(forwardLeadToCrm(env, lead));
  context.waitUntil(notifyBusinessBySms(env, lead));

  return jsonResponse({ success: true }, 200, headers);
}
