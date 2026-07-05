"""Lazily-initialized shared Redis connection."""

import os

import redis

_client = None


def get_redis():
    """Return a process-wide Redis client, created on first use."""
    global _client
    if _client is None:
        _client = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    return _client
