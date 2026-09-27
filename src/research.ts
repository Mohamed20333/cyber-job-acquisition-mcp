export interface CompanyResearch {
  url: string;
  title?: string;
  text: string;
  fetchedAt: string;
}

export async function researchCompany(url: string): Promise<CompanyResearch> {
  const response = await fetch(url, {
    headers: { "User-Agent": "CyberJobAcquisitionEngine/2.0" },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch company page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const cleanText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  return {
    url,
    title,
    text: cleanText.slice(0, 12000),
    fetchedAt: new Date().toISOString(),
  };
}

export async function researchPerson(
  name: string,
  company: string,
  searchApiKey?: string,
) {
  if (!searchApiKey) {
    return {
      status: "INSUFFICIENT_PUBLIC_SEARCH_ACCESS",
      person: name,
      company,
      note: "No search API key is configured. Do not infer that this person is a recruiter or hiring manager.",
      suggestedQuery: `"${name}" "${company}" cybersecurity recruiter hiring manager`,
    };
  }

  const endpoint =
    "https://api.search.brave.com/res/v1/web/search?q=" +
    encodeURIComponent(`"${name}" "${company}" cybersecurity`);

  const response = await fetch(endpoint, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": searchApiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Public person research failed: HTTP ${response.status}`);
  }

  const data = await response.json() as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  return {
    status: "OK",
    person: name,
    company,
    results: (data.web?.results ?? []).slice(0, 10),
    note: "Search results are public evidence only; role and hiring authority must be verified from the evidence.",
  };
}
