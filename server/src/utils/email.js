// Address normalisation used everywhere: trim + lowercase only.
// We deliberately do NOT strip Gmail dots or +tags — that would verify a
// different address from the one the user typed.
const normalize = (email) => String(email || '').trim().toLowerCase();

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Quote a CSV cell and neutralise spreadsheet formula injection.
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

module.exports = { normalize, escapeRegex, csvCell };
