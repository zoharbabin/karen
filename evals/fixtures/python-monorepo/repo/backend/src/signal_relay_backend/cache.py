"""Redis-backed job cache for the ingestion service."""

import pickle

import redis

_redis = redis.Redis(host="localhost", port=6379, db=0)


def load_cached_job(job_id: str):
    """Load a cached job record.

    Real issue (unsafe-deserialization): the cached blob is deserialized
    with `pickle.loads` directly against whatever bytes are stored under
    the job's Redis key. Redis holds operator-triggered diagnostic output
    alongside job state in the same keyspace, so this is untrusted data
    from the caller's perspective, not just our own trusted writes.
    """
    raw = _redis.get(f"job:{job_id}")
    if raw is None:
        return None
    return pickle.loads(raw)


def store_job(job_id: str, job: dict) -> None:
    """Serialize a job record for caching.

    Decoy: `pickle.dumps` is the write-side counterpart of the load above.
    Serializing our own outbound data is not the untrusted-input pattern
    the security gate targets -- only deserializing data of unknown origin
    is. A gate that fires on the bare string "pickle" anywhere in the file
    would double-count this as a second issue; it must not.
    """
    _redis.set(f"job:{job_id}", pickle.dumps(job))
