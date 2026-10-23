// Cloudflare Worker: returns what Timothy is playing on Spotify as JSON.
// Secrets (set in the Worker settings, never in the site code):
//   CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN
export default {
  async fetch(req, env) {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' };
    try {
      const tok = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(env.CLIENT_ID + ':' + env.CLIENT_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.REFRESH_TOKEN })
      }).then((r) => r.json());
      const H = { Authorization: 'Bearer ' + tok.access_token };
      let item = null, playing = false;
      const cur = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: H });
      if (cur.status === 200) { const j = await cur.json(); if (j.item) { item = j.item; playing = !!j.is_playing; } }
      if (!item) {
        const j = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers: H }).then((r) => r.json());
        item = j.items && j.items[0] ? j.items[0].track : null;
      }
      if (!item) return new Response('{}', { headers });
      const imgs = (item.album && item.album.images) || [];
      return new Response(JSON.stringify({
        playing,
        title: item.name,
        artist: (item.artists || []).map((a) => a.name).join(', '),
        url: item.external_urls && item.external_urls.spotify,
        art: (imgs[imgs.length - 1] || imgs[0] || {}).url || ''
      }), { headers });
    } catch (e) {
      return new Response('{}', { headers });
    }
  }
};
