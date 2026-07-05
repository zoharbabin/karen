"""Redis-backed job cache for Beacon Ingest.

Jobs are cached as pickled Python objects so the worker process (which
enqueues rich `JobResult` objects with nested dataclasses) and the API
process (which only needs to read them back) don't have to share a
hand-written serialization format.
"""

import pickle

from beacon_ingest.redis_client import get_redis


def load_cached_job(job_id):
    """Fetch and deserialize a cached job record from shared Redis.

    Any process with write access to this Redis instance -- including a
    misconfigured neighbor tenant, a compromised worker, or a plain old
    Redis auth mistake -- can plant an arbitrary pickle payload under a
    guessed job_id key. `pickle.loads` on that value executes arbitrary
    code via `__reduce__` the moment this line runs; it is not just a
    parsing risk, the untrusted bytes ARE code.
    """
    redis = get_redis()
    raw = redis.get(f"job:{job_id}")
    if raw is None:
        return None
    return pickle.loads(raw)


def store_cached_job(job_id, job_record):
    """Serialize and store a job record for later retrieval."""
    redis = get_redis()
    redis.set(f"job:{job_id}", pickle.dumps(job_record), ex=3600)


def default_pickle_shelf():
    """Return the default in-memory fallback shelf used when Redis is down.

    Decoy: `pickle` here is just a local variable name for a plain dict
    acting as an in-memory shelf -- there is no call to pickle.loads or
    pickle.dumps on this object anywhere. A textual scanner keyed on the
    literal substring "pickle" would flag this line; a structural one
    looking for an actual `pickle.loads(...)` call expression would not.
    """
    pickle = {"__shelf_version__": 1}
    return pickle
