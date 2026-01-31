/**
 * Fetch a Twitter/X user's bio content for verification.
 * Tries multiple approaches since Twitter's pages are JS-heavy.
 */

export async function fetchTwitterBio(handle: string): Promise<string> {
  const errors: string[] = [];

  // Approach 1: Try x.com meta tags (og:description often has the bio)
  try {
    const bio = await fetchFromXDotCom(handle);
    if (bio) return bio;
  } catch (e: any) {
    errors.push(`x.com: ${e.message}`);
  }

  // Approach 2: Try syndication API
  try {
    const bio = await fetchFromSyndication(handle);
    if (bio) return bio;
  } catch (e: any) {
    errors.push(`syndication: ${e.message}`);
  }

  // Approach 3: Try nitter instances
  try {
    const bio = await fetchFromNitter(handle);
    if (bio) return bio;
  } catch (e: any) {
    errors.push(`nitter: ${e.message}`);
  }

  throw new Error(
    `Could not fetch Twitter bio for @${handle}. Tried multiple sources. Errors: ${errors.join("; ")}`
  );
}

async function fetchFromXDotCom(handle: string): Promise<string | null> {
  const res = await fetch(`https://x.com/${handle}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Accept": "text/html",
    },
    redirect: "follow",
  });

  if (!res.ok) return null;

  const html = await res.text();

  // Try og:description meta tag
  const ogMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+property="og:description"/i);
  if (ogMatch) return ogMatch[1];

  // Try description meta tag
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+name="description"/i);
  if (descMatch) return descMatch[1];

  // Return full HTML as fallback (the code might be somewhere in the page)
  return html;
}

async function fetchFromSyndication(handle: string): Promise<string | null> {
  const res = await fetch(
    `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      redirect: "follow",
    }
  );

  if (!res.ok) return null;

  const html = await res.text();
  // The syndication page contains profile info in the HTML
  return html;
}

async function fetchFromNitter(handle: string): Promise<string | null> {
  // Try a few nitter instances
  const nitterInstances = [
    "nitter.net",
    "nitter.privacydev.net",
    "nitter.poast.org",
  ];

  for (const instance of nitterInstances) {
    try {
      const res = await fetch(`https://${instance}/${handle}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const html = await res.text();
      // Nitter has the bio in a <p class="bio-text"> or <div class="profile-bio">
      const bioMatch = html.match(/<p[^>]*class="[^"]*bio[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
        || html.match(/<div[^>]*class="[^"]*bio[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (bioMatch) {
        // Strip HTML tags
        return bioMatch[1].replace(/<[^>]+>/g, " ").trim();
      }

      // Return full page as fallback
      return html;
    } catch {
      continue;
    }
  }

  return null;
}
