/**
 * Must be the first import in index.ts. Node reads files on a small pool of helper threads (4 by
 * default). A movie streamed from the network share keeps several of them waiting on the NAS, so
 * two people watching could use them all up — and then every other file read in the app (pages,
 * thumbnails, photos) waits too, which looks like the Pi froze. More threads keep the rest moving.
 * It only takes effect if set before the pool is first used, hence here. (Also set in
 * scripts/familyhomecenter.service.)
 */
process.env.UV_THREADPOOL_SIZE ||= '32';
export {};
