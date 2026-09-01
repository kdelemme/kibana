"""
Minimal stdlib-only HTTP client for Kibana, Elasticsearch, and Mailpit.

Pattern: x-pack/solutions/observability/plugins/nightshift/scripts/seed_nightshift_helpers.py
All auth, headers, and retry logic lives here; callers stay clean.
"""

import base64
import json
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple

# Headers sent with every Kibana request
_KBN_HEADERS: Dict[str, str] = {
    "kbn-xsrf": "true",
    "x-elastic-internal-origin": "kibana",
    "Content-Type": "application/json",
}

# Workflows management routes are versioned (API version 2023-10-31).
# Alerting v2, alerting (v1), and actions routes are NOT versioned — never
# send elastic-api-version for those.
_WORKFLOWS_HEADERS: Dict[str, str] = {
    **_KBN_HEADERS,
    "elastic-api-version": "2023-10-31",
}


def _auth_header(auth: str) -> str:
    """
    Normalise auth to an 'Authorization' header value.

    Accepts:
      "user:password"           → Basic base64(user:password)
      "ApiKey <key>"            → passed through
      "Basic <b64>"             → passed through
      "<bare-apikey-value>"     → ApiKey <value>
    """
    if auth.startswith("ApiKey ") or auth.startswith("Basic "):
        return auth
    if ":" in auth:
        return "Basic " + base64.b64encode(auth.encode()).decode()
    return "ApiKey " + auth


class KbnClient:
    """Thin HTTP client.  No third-party dependencies."""

    def __init__(
        self,
        kibana_url: str,
        es_url: str,
        auth: str,
        verbose: bool = False,
    ) -> None:
        self.kibana_url = kibana_url.rstrip("/")
        self.es_url = es_url.rstrip("/")
        self._auth_value = _auth_header(auth)
        self.verbose = verbose

    # ------------------------------------------------------------------ #
    #  Internal helper                                                     #
    # ------------------------------------------------------------------ #

    def _raw(
        self,
        method: str,
        url: str,
        extra_headers: Dict[str, str],
        body: Optional[Any] = None,
        ignore: Tuple[int, ...] = (),
        retries: int = 2,
    ) -> Tuple[int, Any]:
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Authorization": self._auth_value, **extra_headers}

        if self.verbose:
            print(f"  {method} {url}", flush=True)

        for attempt in range(retries + 1):
            try:
                req = urllib.request.Request(url, data=data, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw = resp.read().decode("utf-8", errors="replace")
                    try:
                        return resp.status, json.loads(raw)
                    except json.JSONDecodeError:
                        return resp.status, raw
            except urllib.error.HTTPError as exc:
                raw_bytes = b""
                try:
                    raw_bytes = exc.read()
                except Exception:
                    pass
                if exc.code in ignore:
                    try:
                        return exc.code, json.loads(raw_bytes.decode())
                    except Exception:
                        return exc.code, {}
                if exc.code < 500 or attempt == retries:
                    try:
                        detail = json.loads(raw_bytes.decode())
                    except Exception:
                        detail = raw_bytes.decode()[:300]
                    raise RuntimeError(
                        f"{method} {url} → HTTP {exc.code}: {json.dumps(detail)[:400]}"
                    ) from exc
                time.sleep(1 + attempt)
            except urllib.error.URLError as exc:
                if attempt == retries:
                    raise RuntimeError(f"{method} {url} → {exc}") from exc
                time.sleep(1 + attempt)

        raise RuntimeError("unreachable")  # pragma: no cover

    # ------------------------------------------------------------------ #
    #  Public                                                              #
    # ------------------------------------------------------------------ #

    def kbn(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        ignore: Tuple[int, ...] = (),
        workflows: bool = False,
        space: str = "default",
    ) -> Tuple[int, Any]:
        """
        Call a Kibana REST API path.

        Set ``workflows=True`` to add elastic-api-version (required by the
        workflows management routes which use the versioned router).
        """
        prefix = f"/s/{space}" if space != "default" else ""
        url = f"{self.kibana_url}{prefix}{path}"
        hdrs = _WORKFLOWS_HEADERS if workflows else _KBN_HEADERS
        return self._raw(method, url, hdrs, body, ignore)

    def es(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        ignore: Tuple[int, ...] = (),
    ) -> Tuple[int, Any]:
        """Call an Elasticsearch REST API path directly."""
        url = f"{self.es_url}{path}"
        return self._raw(
            method, url, {"Content-Type": "application/json"}, body, ignore
        )

    def mailpit(
        self,
        method: str,
        base: str,
        path: str,
        body: Optional[Any] = None,
    ) -> Tuple[int, Any]:
        """Call the Mailpit HTTP API (no auth, no retries)."""
        url = f"{base.rstrip('/')}{path}"
        return self._raw(method, url, {}, body, retries=0)
