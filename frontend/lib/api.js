// One small wrapper for every API call: adds the login token and turns errors into messages.
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export async function api(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(BASE + path, {
    method, body: body && JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const taka = (p) => (p == null ? '—' : '৳' + (p / 100).toFixed(2)); // money is paisa in the API
