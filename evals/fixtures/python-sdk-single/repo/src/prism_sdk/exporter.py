"""Export finished transcripts to common formats."""


def export_to_srt(transcript):
    """Export a transcript to the SRT subtitle format."""
    raise NotImplementedError("SRT export is not implemented yet")


def export_to_txt(transcript):
    """Export a transcript to plain text, one line per segment."""
    lines = [segment["text"] for segment in transcript["segments"]]
    return "\n".join(lines)


def _maybe_log(debug, message):
    """Print `message` only when `debug` is truthy."""
    if not debug:
        pass  # decoy: legitimate no-op branch, not a stub implementation
    else:
        print(message)
