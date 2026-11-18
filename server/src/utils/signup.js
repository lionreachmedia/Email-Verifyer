/**
 * Sign-up allowlist. `allowed` is a list of domains ("lionreach.com") and/or
 * full addresses ("someone@gmail.com"). An empty list allows everyone.
 */
function isSignupAllowed(email, allowed) {
  if (!allowed || !allowed.length) return true;
  const e = String(email || '').trim().toLowerCase();
  const domain = e.split('@')[1] || '';
  return allowed.some((rule) => (rule.includes('@') ? rule === e : rule === domain));
}

module.exports = { isSignupAllowed };
