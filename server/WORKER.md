# Video transcode worker

Free-plan videos are compressed by a **durable, DB-backed queue** (`TranscodeJob`
table). On upload the API stores the original, marks the memory `processing`, and
**enqueues** a job. A worker claims the job (`FOR UPDATE SKIP LOCKED`, so many
workers are safe), transcodes with ffmpeg to a smaller H.264 MP4, swaps it into
the memory, reclaims the original's storage, and marks the job done. Failures
retry up to 3× then give up (keeping the original). Crashed jobs (stuck
`processing` > 15 min) are auto-reclaimed.

## Running the worker

**Default (single service):** the API runs the worker loop **inline** on boot, so
video compression works with no extra setup.

**Dedicated worker (recommended at scale)** — moves transcoding off the API's CPU:

1. Create a **second Railway service** from this same repo.
2. Root directory: `server`. Start command: `npm run worker`.
3. Give it the same env as the API: `DATABASE_URL`, `STORAGE_PROVIDER`,
   `AWS_*` (bucket/keys/endpoint). It does **not** need the Clerk vars.
4. On the **API** service, set `DISABLE_INLINE_WORKER=true` so only the dedicated
   worker(s) transcode.

Scale throughput by running **multiple** worker instances — the queue hands each a
different job. Optional: `WORKER_POLL_MS` (default 5000) controls idle poll cadence.
