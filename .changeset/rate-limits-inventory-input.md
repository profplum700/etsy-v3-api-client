---
'@profplum700/etsy-v3-api-client': major
---

Keep partial rate-limit settings from erasing retry defaults, track the QPD fallback over a rolling 24-hour window, serialize concurrent request reservations, honor Etsy's shared Retry-After cooldown, avoid automatically replaying mutations, and align inventory update inputs with Etsy's accepted request fields.
