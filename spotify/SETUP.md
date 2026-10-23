# Spotify "now playing" setup

The site can't hold your Spotify secret safely, so a tiny free Cloudflare Worker does it and the site asks the Worker what you're playing.

## 1. Add the scopes redirect (Spotify dashboard)
Your redirect URI `https://timothymasso.com/` is already set. Good.

## 2. Get a refresh token (one time)
Open this in your browser while logged into Spotify:

```
https://accounts.spotify.com/authorize?client_id=157e7c5541a642dbb0e676fab9f0a336&response_type=code&redirect_uri=https%3A%2F%2Ftimothymasso.com%2F&scope=user-read-currently-playing%20user-read-recently-played
```

Approve. You'll land on `https://timothymasso.com/?code=XXXX`. Copy the `XXXX` part.

Then in a terminal (replace CODE and SECRET — keep the secret private):

```
curl -X POST https://accounts.spotify.com/api/token \
  -u 157e7c5541a642dbb0e676fab9f0a336:SECRET \
  -d grant_type=authorization_code \
  -d code=CODE \
  -d redirect_uri=https://timothymasso.com/
```

The reply contains `"refresh_token": "..."`. Save it.

## 3. Create the Worker
1. dash.cloudflare.com → Workers & Pages → Create → Worker → name it `now-playing` → Deploy.
2. Edit code → paste `spotify/worker.js` → Deploy.
3. Settings → Variables and Secrets → add three **secrets**: `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.
4. Copy the Worker URL (like `https://now-playing.yourname.workers.dev`).

## 4. Connect the site
In `Timothy Masso Site.dc.html`, set:

```
const NOW_PLAYING_URL = 'https://now-playing.yourname.workers.dev';
const SPOTIFY_PROFILE = 'https://open.spotify.com/user/your-id';
```

Or just send both to me and I'll put them in.

Note: your app is in Development mode, which is fine — it only needs to read your own account.
