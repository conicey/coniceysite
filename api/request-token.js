// api/request-token.js — Vercel serverless function
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

let lastRequestTime = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();
  if (now - lastRequestTime < 60000) {
    const wait = Math.ceil((60000 - (now - lastRequestTime)) / 1000);
    return res.status(429).json({ error: `Wait ${wait}s before requesting another token` });
  }
  lastRequestTime = now;

  function randomSegment() {
    return crypto.randomBytes(7).toString('base64url').slice(0, 9);
  }
  const token = Array.from({ length: 6 }, randomSegment).join('_');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: dbError } = await supabase
    .from('auth_tokens')
    .insert({ token_hash: tokenHash, expires_at: expiresAt, used: false });

  if (dbError) {
    console.error('[request-token] DB error:', dbError);
    return res.status(500).json({ error: 'Failed to store token' });
  }

  const vaultUrl = process.env.VAULT_URL || 'https://conicey.com/vault';

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #060608;
    font-family: 'JetBrains Mono', monospace;
    padding: 40px 20px;
    min-height: 100vh;
  }
  .wrap {
    max-width: 480px;
    margin: 0 auto;
    background: #0a0a0f;
    border: 1px solid #1a1a2e;
    border-top: 2px solid #6b21a8;
    border-radius: 4px;
    padding: 36px 32px;
    position: relative;
    overflow: hidden;
  }
  .wrap::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, #6b21a8, #dc2626, transparent);
  }
  .label {
    font-size: 10px;
    letter-spacing: 3px;
    color: #6b21a8;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  h2 {
    color: #e2e2e2;
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 10px;
    letter-spacing: -0.5px;
  }
  p {
    color: #555;
    font-size: 12px;
    line-height: 1.7;
    margin-bottom: 28px;
  }
  .btn {
    display: inline-block;
    background: transparent;
    color: #e2e2e2;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 28px;
    border: 1px solid #6b21a8;
    border-radius: 2px;
    text-decoration: none;
    position: relative;
    overflow: hidden;
  }
  .btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(107,33,168,0.15), transparent);
  }
  .divider {
    border: none;
    border-top: 1px solid #111;
    margin: 28px 0;
  }
  .note {
    font-size: 10px;
    color: #333;
    line-height: 1.8;
  }
  .note span { color: #dc2626; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="label">// vault.access_request</div>
    <h2>Access Token</h2>
    <p>A one-time access token has been generated for your vault session. Click below to copy the token and open the vault.</p>
    <a class="btn" href="${vaultUrl}?token=${encodeURIComponent(token)}">
      &#x25B6; COPY TOKEN &amp; ENTER
    </a>
    <hr class="divider" />
    <div class="note">
      expires_in: <span>10 minutes</span><br>
      use_count: <span>1 / 1</span><br>
      if_not_you: discard this email
    </div>
  </div>
</body>
</html>`;

  const { error: emailError } = await resend.emails.send({
    from:    'Vault <token@conicey.com>',
    to:      'conicey@null.net',
    subject: '// vault.access_request',
    html:    emailHtml,
  });

  if (emailError) {
    console.error('[request-token] Email error:', emailError);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ success: true });
}
