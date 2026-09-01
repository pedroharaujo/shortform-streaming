# Historical Bunny playback proof

This file preserves the result of the August 2026 playback spike. Its temporary
Django management command and mobile proof route were removed from the MVP on
2026-09-02. Do not recreate them as production surfaces.

## Result

- A generated, self-owned 9:16 clip was uploaded directly to a non-production
  Bunny Stream library and encoded successfully.
- An Android Pixel emulator played adaptive HLS through `expo-video` using a
  short-lived URL returned by Django authorization.
- Unsigned and expired requests were denied by the provider.
- Bunny met the proof criteria, so the GCP Cloud CDN fallback was not activated.
- No licensed media, production master, provider secret, signed URL, or provider
  payload belongs in this repository or its test evidence.

## Current MVP workflow

Staff initiate the self-owned master upload in Django Admin. The existing
workflow verifies its checksum, submits it to Bunny Stream, records processing
and ready metadata, and provides Admin retry and takedown actions. Production
uploads use a private signed landing bucket; consumer APIs never accept or serve
video bytes. The Android app calls the normal playback authorization endpoint;
France, Android, and English are fixed server-side and no market headers are
accepted.

Before production activation, validate a generated/self-owned asset end to end
on a real Android device, confirm short-lived URL expiry and takedown, and record
only redacted evidence. Provider residency and retention remain governed by
D-020.
