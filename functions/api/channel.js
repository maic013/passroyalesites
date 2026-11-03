// Cloudflare Pages Function: GET /api/channel
// The YouTube API key stays server-side in the YOUTUBE_API_KEY secret.
const CHANNEL_HANDLE = "PassRoyale2003";

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestGet({ env }) {
  if (!env?.YOUTUBE_API_KEY) {
    return respond({ error: "youtube_api_key_not_configured" }, 503);
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("forHandle", CHANNEL_HANDLE);
  url.searchParams.set("key", env.YOUTUBE_API_KEY);

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return respond({ error: "youtube_api_unavailable", upstreamStatus: response.status }, 502);
    }

    const channel = (await response.json())?.items?.[0];
    if (!channel) return respond({ error: "channel_not_found" }, 404);

    const raw = channel.statistics?.subscriberCount;
    const subscribers = raw == null ? NaN : Number(raw);
    if (channel.statistics?.hiddenSubscriberCount || !Number.isSafeInteger(subscribers)) {
      return respond({ error: "subscriber_count_unavailable" }, 503);
    }

    return respond({
      subscribers,
      subscriberCount: subscribers,
      count: subscribers,
      channelId: channel.id,
      title: channel.snippet?.title || "Pass Royale",
      updatedAt: new Date().toISOString()
    });
  } catch {
    return respond({ error: "youtube_request_failed" }, 502);
  }
}
