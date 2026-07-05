# signal-relay-client

Python client SDK for the Signal Relay ingestion backend. Not SOC2-scoped
— it holds no customer data itself; see the repo root
[`SECURITY.md`](../SECURITY.md) for the scoping rationale.

## Usage

```python
from signal_relay_client import SignalRelayClient
from signal_relay_client.config import ClientConfig

client = SignalRelayClient(ClientConfig(base_url="https://ingest.signalrelay.example.com"))
client.send("batch-1", {"events": [...]})
```

## Testing

```bash
pytest --cov=signal_relay_client --cov-report=xml
```
