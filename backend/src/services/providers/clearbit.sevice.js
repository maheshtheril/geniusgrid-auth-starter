const CLEARBIT_API = "https://person-stream.clearbit.com/v2/combined/find";

export async function clearbitLookupByEmail(email, { signal }) {
  const key = process.env.CLEARBIT_KEY || process.env.CLEARBIT_API_KEY;
  if (!key || !email) return null;

  const url = new URL(CLEARBIT_API);
  url.searchParams.set("email", email);

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Clearbit ${resp.status}`);
  const json = await resp.json();
  return json;
}