# Playback spike (P2-T05)

Prove the default video path: a generated 9:16 master goes through `VideoProvider`
to Bunny Stream (or the in-memory Fake in CI), encodes ABR HLS, and plays in
`expo-video` from a short-lived URL that **Django** mints. Django never serves
video bytes. The app never uses Bunny’s web player.

**Never commit Bunny keys, paste signed URLs, or check in mp4/m3u8/vtt/srt.**

## Local Fake (default)

`.env.example` sets `VIDEO_PROVIDER=fake`. Pytest and Application CI need no
Bunny credentials. Map an eligible episode public id to a Fake asset id in
Django settings (tests use `override_settings`; live local mapping is optional
JSON in `PLAYBACK_SPIKE_ASSETS`).

Authorize:

```shell
curl -sS -X POST \
  -H "X-Territory: FR" -H "X-Platform: android" -H "X-Language: en" \
  http://127.0.0.1:8000/v1/playback/<episode_public_id>/authorize
```

Play the returned `playback_url` on the isolated mobile route `/playback-spike?episodeId=<id>`.
Do not convert the catalog episode-selected screen into a player (P2-T08).
Required live play is an Android development build (D-026). iOS device play is deferred to the iOS ship pass, not dropped from the product.

## Non-production Bunny Stream

Missing credentials are **not** a Bunny failure and must not reopen D-014.

1. Create a non-production Stream library. Copy library id, Stream API key, CDN
   hostname (for example `vz-….b-cdn.net`), and pull-zone token authentication
   key into a **local, untracked** environment. Leave production unset.
2. Enable CDN token authentication on the library pull zone. Use directory /
   path-style tokens so HLS segments inherit access. Configure allowed referrers
   / block direct file access for hotlink denial.
3. Set:

   ```text
   VIDEO_PROVIDER=bunny
   BUNNY_STREAM_LIBRARY_ID=…
   BUNNY_STREAM_API_KEY=…
   BUNNY_STREAM_CDN_HOSTNAME=…
   BUNNY_STREAM_TOKEN_KEY=…
   ```

4. Generate a short 9:16 clip (ffmpeg) and upload:

   ```shell
   uv run python backend/manage.py spike_bunny_playback
   ```

   The command prints **redacted** status (rendition names, duration, captions,
   portrait flag). It prints the provider asset id so you can map it. It must
   never print a usable signed URL (signing query/path values are replaced with
   `redacted`).
5. Map `PLAYBACK_SPIKE_ASSETS={"<episode_public_id>":"<asset_id>"}` in the local
   untracked env. Restart Django. Call authorize as above. Play in `expo-video`.
6. Confirm unsigned, expired, and disallowed-referrer requests fail at the CDN.
   Django remains the authorizer.

If Bunny is attempted and fails encode, tokens, hotlink, residency, or cost,
record a GCP Cloud CDN fallback spike and update D-014. Do not treat absent
credentials as that failure.

## Isolated mobile route

`/playback-spike?episodeId=<episode_public_id>` calls authorize with catalog
headers and plays the opaque HLS URL in `expo-video`. Bunny keys must never
appear in `EXPO_PUBLIC_*`. Android is the required live play; iOS is deferred
per D-026.
