#!/usr/bin/env python3
"""
Episode-flood harness for alerting_v2.

Creates one ungrouped rule with recovery_strategy=none over the
kbn-data-forge admin-console dataset.  Each result row in each tick
mints a new permanent episode, so episode count grows as:

    rows_per_tick × elapsed_ticks

Usage:
    python3 flood_episodes.py [--rules N] [--interval 1m] [--verbose]

Prerequisites:
    - Kibana running locally with alerting:v2:enabled: true
    - kbn-data-forge producing fake_stack data (admin-console-* indices)
    - Add to kibana.dev.yml for sub-minute intervals:
        xpack.alerting_v2.rules.minimumScheduleInterval: 5s
        xpack.alerting_v2.rules.maxScheduledPerMinute: 32000
"""

import argparse
import os
import signal
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from kbn import KbnClient
from measure import _ts_iso
from scenarios import (
    FLOOD_RULE_ID,
    PERF_TAG,
    build_episode_flood_rule_body,
)


FLOOD_TAG = "perf-flood"


# -------------------------------------------------------------------------
# Cleanup
# -------------------------------------------------------------------------

def cleanup(client: KbnClient, space: str, verbose: bool = False) -> int:
    """Delete all perf-flood tagged rules. Returns count removed."""
    page = 1
    ids: list = []
    while True:
        _, resp = client.kbn(
            "GET",
            f"/api/alerting/v2/rules?per_page=100&page={page}&tags={FLOOD_TAG}",
            space=space,
        )
        items = resp.get("items", [])
        if not items:
            break
        ids.extend(item["id"] for item in items if item.get("id"))
        if len(items) < 100:
            break
        page += 1

    if not ids:
        return 0

    for i in range(0, len(ids), 100):
        client.kbn(
            "POST",
            "/api/alerting/v2/rules/_bulk_delete",
            {"ids": ids[i : i + 100]},
            space=space,
        )
    if verbose:
        print(f"  deleted {len(ids)} flood rule(s)", flush=True)
    return len(ids)


# -------------------------------------------------------------------------
# Episode counter
# -------------------------------------------------------------------------

def _count_episodes(client: KbnClient, rule_ids: list) -> int:
    if not rule_ids:
        return 0
    _, resp = client.es("POST", "/.rule-events/_search", {
        "size": 0,
        "query": {"bool": {"filter": [{"terms": {"rule.id": rule_ids}}]}},
        "aggs": {
            "unique": {"cardinality": {"field": "episode.id", "precision_threshold": 40000}},
        },
    }, ignore=(404,))
    return int(
        (resp.get("aggregations") or {}).get("unique", {}).get("value", 0)
        if isinstance(resp, dict)
        else 0
    )


def _count_rule_events(client: KbnClient, rule_ids: list) -> int:
    if not rule_ids:
        return 0
    _, resp = client.es("POST", "/.rule-events/_count", {
        "query": {"bool": {"filter": [{"terms": {"rule.id": rule_ids}}]}},
    }, ignore=(404,))
    return int(resp.get("count", 0) if isinstance(resp, dict) else 0)


# -------------------------------------------------------------------------
# CLI
# -------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="alerting_v2 episode-flood harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--kibana-url", default=os.environ.get("KIBANA_URL", "http://localhost:5601"))
    p.add_argument("--es-url", default=os.environ.get("ES_URL", "http://localhost:9200"))
    p.add_argument("--auth", default=os.environ.get("KBN_AUTH", "elastic:changeme"))
    p.add_argument("--space", default="default")
    p.add_argument("--rules", type=int, default=1, metavar="N",
                   help="Number of flood rules (each independently creates rows_per_tick new episodes)")
    p.add_argument("--interval", default="1m",
                   help="Rule schedule interval, e.g. 1m or 10s")
    p.add_argument("--lookback", default="5m",
                   help="Query lookback window")
    p.add_argument("--cleanup-only", action="store_true",
                   help="Remove existing flood rules and exit")
    p.add_argument("--keep", action="store_true",
                   help="Do not remove rules on exit")
    p.add_argument("--verbose", "-v", action="store_true")
    return p.parse_args()


# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------

def main() -> None:
    args = _parse_args()
    client = KbnClient(
        kibana_url=args.kibana_url,
        es_url=args.es_url,
        auth=args.auth,
        verbose=args.verbose,
    )

    # Preflight
    print("preflight: checking Kibana...", end=" ", flush=True)
    try:
        status, _ = client.kbn("GET", "/api/alerting/v2/rules?per_page=1", space=args.space)
        if status == 503:
            print("FAIL")
            print("error: alerting:v2:enabled is false — set it in kibana.dev.yml")
            sys.exit(1)
        print("ok")
    except Exception as exc:
        print("FAIL")
        print(f"error: Kibana unreachable: {exc}")
        sys.exit(1)

    if args.cleanup_only:
        removed = cleanup(client, args.space, verbose=True)
        print(f"removed: {removed} rule(s)")
        return

    # Cleanup prior flood rules
    prior = cleanup(client, args.space, args.verbose)
    if prior:
        print(f"cleanup: removed {prior} prior flood rule(s)")

    # Create rules
    rule_ids: list = []
    body = build_episode_flood_rule_body(args.interval, args.lookback)
    print(f"provision: creating {args.rules} flood rule(s)...", flush=True)
    for i in range(args.rules):
        rid = FLOOD_RULE_ID if args.rules == 1 else f"{FLOOD_RULE_ID}-{i + 1:03d}"
        b = dict(body)
        if args.rules > 1:
            b = dict(body)
            b["metadata"] = dict(body["metadata"])
            b["metadata"]["name"] = f"perf-episode-flood-{i + 1:03d}"
        client.kbn("PUT", f"/api/alerting/v2/rules/{rid}", b, space=args.space)
        rule_ids.append(rid)
        if args.verbose:
            print(f"  created {rid}", flush=True)
    print(f"  rule ids: {rule_ids}")
    print()

    # SIGINT teardown handler
    _keep = [args.keep]
    def _sigint(sig, frame):  # noqa: ANN001
        print("\ninterrupted", flush=True)
        if not _keep[0]:
            print("teardown...", flush=True)
            cleanup(client, args.space)
            print("done")
        sys.exit(130)

    signal.signal(signal.SIGINT, _sigint)

    # Watch loop — print episode count every 30s
    t_start = time.time()
    print(f"watching (Ctrl-C to stop): interval={args.interval} lookback={args.lookback}")
    print(f"{'elapsed':>8}  {'episodes':>10}  {'rule_events':>12}  {'eps/min':>8}")
    print("-" * 46)

    last_count = 0
    last_t = t_start
    while True:
        time.sleep(30)
        now = time.time()
        elapsed = int(now - t_start)
        count = _count_episodes(client, rule_ids)
        events = _count_rule_events(client, rule_ids)
        delta = count - last_count
        dt = now - last_t
        rate = delta / dt * 60 if dt > 0 else 0.0
        print(f"{elapsed:>7}s  {count:>10}  {events:>12}  {rate:>7.0f}/m", flush=True)
        last_count = count
        last_t = now

    # Unreachable; SIGINT handler exits.


if __name__ == "__main__":
    main()
