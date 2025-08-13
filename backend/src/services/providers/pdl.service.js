const PDL_API = "https://api.peopledatalabs.com/v5/person/search";
const DEFAULT_FIELDS = [
  "full_name","first_name","last_name",
  "work_email","personal_emails","phone_numbers.number",
  "job_title","job_company_name",
  "location_country","location_country_code"
];

// pageCursor: PDL supports from/scroll; we’ll use "from" pagination here
export async function pdlSearchPage({ query, titleFilters = [], country = "", industry = "", size = 25, from = 0, signal }) {
  const key = process.env.PDL_API_KEY || process.env.PDL_KEY || "";
  if (!key) {
    return {
      items: [{
        full_name: "Alex Rivera",
        work_email: "alex.rivera@example.com",
        phone_numbers: [{ number: "+1 555 0100" }],
        job_title: "Head of Procurement",
        job_company_name: "Example Corp",
        location_country: "US"
      }],
      nextFrom: null
    };
  }

  const must = [{ multi_match: { query, fields: ["job_title","job_title_role","job_title_subrole","summary","skills"] } }];
  if (titleFilters?.length) must.push({ terms: { job_title_role: titleFilters.map(s=>String(s).toLowerCase()) } });
  if (country) must.push({ term: { location_country_code: String(country).toUpperCase() } });
  if (industry) must.push({ multi_match: { query: industry, fields: ["industry","industries"] } });

  const body = {
    query: { bool: { must } },
    size: Math.min(Math.max(size, 1), 100),
    fields: DEFAULT_FIELDS,
    dataset: "person",
    from
  };

  const resp = await fetch(PDL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: JSON.stringify(body),
    signal
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`PDL ${resp.status}: ${t}`);
  }
  const json = await resp.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  const nextFrom = data.length < body.size ? null : from + body.size;
  return { items: data, nextFrom };
}