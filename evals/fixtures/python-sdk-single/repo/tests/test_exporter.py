from prism_sdk.exporter import export_to_txt


def test_export_to_txt_joins_segment_text():
    transcript = {"segments": [{"text": "hello"}, {"text": "world"}]}
    assert export_to_txt(transcript) == "hello\nworld"
