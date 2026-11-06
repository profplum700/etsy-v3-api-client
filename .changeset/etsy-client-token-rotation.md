---
"@profplum700/etsy-v3-api-client": minor
---

`EtsyClientConfig` takes a new `tokenRotation` option for proactive token rotation. The client's own token manager does the rotating, so requests and later refreshes use the rotated tokens, and each rotated set is saved through `refreshSave` / `refreshSaveAsync`. `EtsyClient.stopTokenRotation()` stops the background checks started by `autoSchedule`. The security and authentication docs used to show rotation settings as a third `EtsyClient` constructor argument, which the client ignored; they now use `tokenRotation`.
