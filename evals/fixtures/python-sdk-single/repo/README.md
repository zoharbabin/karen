# Prism SDK

Python client library for the Prism transcription platform. Used by data
engineering teams to submit audio for transcription, manage webhooks, and
export finished transcripts.

## Install

```bash
pip install prism-sdk
```

## Usage

```python
from prism_sdk import PrismClient

client = PrismClient(api_key="...")
job = client.transcribe("https://example.com/call.wav")
```

See `docs/internal/GAPS.md` for known limitations.
