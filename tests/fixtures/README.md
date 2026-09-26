# Saved workspace compatibility fixture

`workspace-v1.json` is a fictional built-in demo saved by the previous CareThread
release (`sha256:b2e111b6e9f0b1fa9f291baf54c447b3bff21795c19c786ef65cb06c68aea792`),
captured from real IndexedDB on 25 September 2026. The frozen source archive was
built separately for this capture. It contains no real patient data.

`fixtureBytes` serializes each retained Blob as a byte array solely for the test
fixture. The compatibility test restores the original `blob` field before
writing the record. This is not a change to the application's storage schema.

Keep this fixture independent of current model output: it verifies that the
current application can open an older saved episode, preserve its source bytes,
edit it, save it, and reopen it without a migration.
