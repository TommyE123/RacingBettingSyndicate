"""Reading the text on a bet sheet photo with the Read (OCR) feature of Azure AI Vision.

What comes back is only a draft: the bet form shows it to a person, who checks and corrects
it against the photo before anything is saved. Nothing here writes to the database.
"""

import json
import urllib.error
import urllib.request
from typing import Any

API_VERSION = "2024-02-01"
TIMEOUT_SECONDS = 30
# Image types the Read feature accepts, out of those a sheet can be uploaded as (no HEIC).
READABLE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
TOO_MANY_REQUESTS = 429


class ReaderError(Exception):
    """The photo could not be read. The message is for the log, never for the key."""


class ReaderBusyError(ReaderError):
    """The service refused for now, as the free tier allows only a few reads a minute."""


def read_lines(endpoint: str, key: str, image: bytes) -> list[str]:
    """Send the photo to the service and return the lines of text it found, top to bottom."""
    url = (
        f"{endpoint.rstrip('/')}/computervision/imageanalysis:analyze"
        f"?api-version={API_VERSION}&features=read"
    )
    request = urllib.request.Request(  # noqa: S310 - Settings only allows an https:// endpoint
        url,
        data=image,
        method="POST",
        headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/octet-stream"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
            body = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == TOO_MANY_REQUESTS:
            raise ReaderBusyError("the service is limiting requests") from error
        raise ReaderError(f"the service answered {error.code}") from error
    except (OSError, ValueError) as error:
        # URLError and timeouts are OSErrors; a body that is not JSON is a ValueError.
        raise ReaderError(f"no usable answer from the service ({type(error).__name__})") from error
    return lines_from_result(body)


def lines_from_result(body: Any) -> list[str]:
    """The non-blank line texts from an analyze response, or [] when it holds none."""
    read_result = body.get("readResult") if isinstance(body, dict) else None
    blocks = read_result.get("blocks") if isinstance(read_result, dict) else None
    lines: list[str] = []
    for block in blocks if isinstance(blocks, list) else []:
        block_lines = block.get("lines") if isinstance(block, dict) else None
        for line in block_lines if isinstance(block_lines, list) else []:
            text = line.get("text") if isinstance(line, dict) else None
            if isinstance(text, str) and text.strip():
                lines.append(text.strip())
    return lines
