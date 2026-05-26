// api/verify-token.js — Vercel serverless function
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'No token provided' });
  }

  // Hash the submitted token
  const tokenHash = crypto
    .createHash('sha256')
    .update(token.trim())
    .digest('hex');

  // Look up in DB
  const { data, error } = await supabase
    .from('auth_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('used', false)
    .single();

  if (error || !data) {
    return res.status(401).json({ valid: false, error: 'Access denied' });
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    return res.status(401).json({ valid: false, error: 'Token expired' });
  }

  // Mark as used
  await supabase
    .from('auth_tokens')
    .update({ used: true })
    .eq('id', data.id);

  return res.status(200).json({ valid: true });
}
