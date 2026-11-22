import http.client
import io
import json
import urllib.error

import pytest

from app import ocr

RESULT = {
    "modelVersion": "2024-02-01",
    "readResult": {
        "blocks": [
            {
                "lines": [
                    {"text": " 1:30 Mystical Power "},
                    {"text": "   "},
                    {"text": "2.10 Gaelic"},
                ]
            },
            {"lines": [{"text": "Lucky 15 £1 e/w", "words": []}]},
        ]
    },
}


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def test_lines_are_read_in_order_and_blank_ones_dropped():
    assert ocr.lines_from_result(RESULT) == [
        "1:30 Mystical Power",
        "2.10 Gaelic",
        "Lucky 15 £1 e/w",
    ]


@pytest.mark.parametrize(
    "body",
    [
        None,
        [],
        {},
        {"readResult": None},
        {"readResult": {"blocks": "x"}},
        {"readResult": {"blocks": ["x", {"lines": None}, {"lines": [7, {"text": 3}]}]}},
    ],
)
def test_unexpected_shapes_give_no_lines(body):
    assert ocr.lines_from_result(body) == []


def test_read_lines_sends_the_photo_with_the_key(monkeypatch):
    seen = {}

    def fake_urlopen(request, timeout):
        seen.update(
            url=request.full_url,
            method=request.get_method(),
            data=request.data,
            key=request.get_header("Ocp-apim-subscription-key"),
            content_type=request.get_header("Content-type"),
            timeout=timeout,
        )
        return FakeResponse(json.dumps(RESULT).encode())

    monkeypatch.setattr(ocr.urllib.request, "urlopen", fake_urlopen)
    lines = ocr.read_lines("https://example.cognitiveservices.azure.com/", "secret", b"photo")
    assert lines == ["1:30 Mystical Power", "2.10 Gaelic", "Lucky 15 £1 e/w"]
    assert seen == {
        "url": "https://example.cognitiveservices.azure.com/computervision/imageanalysis:analyze"
        "?api-version=2024-02-01&features=read",
        "method": "POST",
        "data": b"photo",
        "key": "secret",
        "content_type": "application/octet-stream",
        "timeout": ocr.TIMEOUT_SECONDS,
    }


def http_error(code):
    return urllib.error.HTTPError("https://x", code, "nope", {}, io.BytesIO(b"{}"))  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("raised", "expected", "message"),
    [
        (http_error(429), ocr.ReaderBusyError, "limiting requests"),
        (http_error(401), ocr.ReaderError, "answered 401"),
        (urllib.error.URLError("no route"), ocr.ReaderError, "URLError"),
        (TimeoutError(), ocr.ReaderError, "TimeoutError"),
        (http.client.IncompleteRead(b"{"), ocr.ReaderError, "IncompleteRead"),
    ],
)
def test_failures_become_reader_errors_without_the_key(monkeypatch, raised, expected, message):
    def fake_urlopen(_request, timeout):
        raise raised

    monkeypatch.setattr(ocr.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(expected, match=message) as caught:
        ocr.read_lines("https://example.com", "secret", b"photo")
    assert "secret" not in str(caught.value)


def test_a_body_that_is_not_json_is_a_reader_error(monkeypatch):
    monkeypatch.setattr(
        ocr.urllib.request, "urlopen", lambda _request, timeout: FakeResponse(b"<html>")
    )
    with pytest.raises(ocr.ReaderError, match="JSONDecodeError"):
        ocr.read_lines("https://example.com", "secret", b"photo")
    with pytest.raises(ocr.ReaderError) as caught:
        ocr.read_lines("https://example.com", "secret", b"photo")
    assert not isinstance(caught.value, ocr.ReaderBusyError)
