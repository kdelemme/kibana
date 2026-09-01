#!/usr/bin/env python3
"""
Dispatcher load-test harness for alerting_v2.

Usage:
    python3 run.py [--rules N] [--policies M] [--duration S] [--verbose]

Phases:
    preflight → cleanup → provision → warmup → mark t0 → soak → collect → report → teardown
"""

import argparse
import os
import signal
import sys
import time
from typing import Any, Dict, Optional

# All imports from the same directory
sys.path.insert(0, os.path.dirname(__file__))

from kbn import KbnClient
from measure import collect_all, wait_for_warmup, _ts_iso
from provision import cleanup, provision_all, teardown
from report import print_report, write_json_report
from scenarios import PREFLIGHT_QUERIES, FAKE_STACK_PATTERNS


# -------------------------------------------------------------------------
# CLI
# -------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="alerting_v2 dispatcher load-test harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment variables:
  KIBANA_URL      Kibana base URL (overrides --kibana-url)
  ES_URL          Elasticsearch base URL (overrides --es-url)
  KBN_AUTH        auth string user:pass or ApiKey ... (overrides --auth)
""",
    )

    # Connection
    p.add_argument("--kibana-url", default=os.environ.get("KIBANA_URL", "http://localhost:5601"))
    p.add_argument("--es-url", default=os.environ.get("ES_URL", "http://localhost:9200"))
    p.add_argument("--auth", default=os.environ.get("KBN_AUTH", "elastic:changeme"),
                   help="user:pass or 'ApiKey <key>'")
    p.add_argument("--mailpit-url", default=os.environ.get("MAILPIT_URL", "http://localhost:8025"))
    p.add_argument("--space", default="default")

    # Scale
    p.add_argument("--rules", type=int, default=50, metavar="N")
    p.add_argument("--policies", type=int, default=20, metavar="M")

    # Timing
    p.add_argument("--rule-interval", default="1m",
                   help="Rule schedule interval, e.g. 1m or 10s")
    p.add_argument("--lookback", default="5m",
                   help="Rule lookback window, e.g. 5m")
    p.add_argument("--duration", type=int, default=300,
                   help="Measurement duration in seconds after warmup")
    p.add_argument("--warmup-timeout", type=int, default=120,
                   help="Max seconds to wait for warmup")
    p.add_argument("--warmup-ticks", type=int, default=3,
                   help="Minimum dispatcher ticks to observe before starting measurement")

    # Policy tuning
    p.add_argument("--per-group-interval", default="",
                   help="Throttle interval for per-field (hot) policies (empty = every tick)")
    p.add_argument("--throttle-interval", default="5m",
                   help="Throttle interval for per-field-throttled and digest policies")
    p.add_argument("--email-policies", type=int, default=2,
                   help="Number of policies that use the email workflow (others use noop)")
    p.add_argument("--no-catch-all", action="store_true",
                   help="Do not create the catch-all digest policy")

    # Output
    p.add_argument("--json-out", default="", metavar="PATH",
                   help="Write metrics to this JSON file")
    p.add_argument("--keep", action="store_true",
                   help="Skip teardown at the end (useful for post-run inspection)")
    p.add_argument("--cleanup-only", action="store_true",
                   help="Only run cleanup then exit")
    p.add_argument("--verbose", "-v", action="store_true")

    return p.parse_args()


# -------------------------------------------------------------------------
# Preflight checks
# -------------------------------------------------------------------------

def _preflight(client: KbnClient, mailpit_url: str, args: argparse.Namespace) -> None:
    """Fast-fail with actionable messages before touching any resources."""

    print("preflight:")

    # 1. Kibana reachable and alerting v2 enabled
    print("  [1/4] Kibana + alerting_v2 enabled...", end=" ", flush=True)
    try:
        status, resp = client.kbn("GET", "/api/alerting/v2/rules?per_page=1", space=args.space)
        if status == 503:
            raise RuntimeError(
                "alerting:v2:enabled is false.\n"
                "Add to config/kibana.dev.yml:\n"
                "  uiSettings.globalOverrides:\n"
                "    alerting:v2:enabled: true"
            )
        print("ok")
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Kibana unreachable ({args.kibana_url}): {exc}") from exc

    # 2. Mailpit reachable
    print("  [2/4] Mailpit...", end=" ", flush=True)
    try:
        client.mailpit("GET", mailpit_url, "/api/v1/info")
        print("ok")
    except Exception as exc:
        raise RuntimeError(
            f"Mailpit unreachable ({args.mailpit_url}): {exc}\n"
            "Start mailpit: mailpit --smtp :1025 --listen :8025"
        ) from exc

    # 3. Data-forge producing data
    print("  [3/4] data-forge index freshness...", end=" ", flush=True)
    cutoff = time.time() - 120  # 2 minutes
    cutoff_iso = _ts_iso(cutoff)
    stale = []
    for label, pattern in FAKE_STACK_PATTERNS.items():
        _, resp = client.es("POST", f"/{pattern}/_search", {
            "size": 0,
            "query": {"range": {"@timestamp": {"gte": cutoff_iso}}},
            "aggs": {"max_ts": {"max": {"field": "@timestamp"}}},
        }, ignore=(404,))
        if isinstance(resp, dict) and resp.get("hits", {}).get("total", {}).get("value", 0) == 0:
            stale.append(f"{label} ({pattern})")
    if stale:
        print("WARN")
        print(
            f"  WARNING: no data in last 2m for: {stale}\n"
            "  Rules over these datasets will produce zero episodes.\n"
            "  Ensure data-forge is running: node x-pack/scripts/data_forge.js --config <yaml>"
        )
    else:
        print("ok")

    # 4. ES|QL dry-run
    print("  [4/4] ES|QL dry-run...", end=" ", flush=True)
    failed_queries = []
    for name, query in PREFLIGHT_QUERIES:
        dry_run = f"{query} | LIMIT 1"
        try:
            _, resp = client.es("POST", "/_query", {"query": dry_run})
            rows = resp.get("values", resp.get("rows", [])) if isinstance(resp, dict) else []
            if not rows:
                failed_queries.append(f"{name} (no rows)")
        except Exception as exc:
            failed_queries.append(f"{name} ({exc})")
    if failed_queries:
        print("WARN")
        print(f"  WARNING: queries returned no data: {failed_queries}")
        print("  Episodes may not be created for these rule types.")
    else:
        print("ok")

    print()


# -------------------------------------------------------------------------
# Soak helper
# -------------------------------------------------------------------------

def _soak(duration: int, verbose: bool) -> None:
    """Wait `duration` seconds, printing a heartbeat every 30s."""
    deadline = time.time() + duration
    checkpoint = time.time() + 30
    print(f"soaking {duration}s...", end=" ", flush=True)
    while time.time() < deadline:
        remaining = deadline - time.time()
        if time.time() >= checkpoint:
            if verbose:
                print(f"[{int(duration - remaining)}s/{duration}s]", end=" ", flush=True)
            checkpoint += 30
        time.sleep(1)
    print("done")


# -------------------------------------------------------------------------
# Entry point
# -------------------------------------------------------------------------

def main() -> None:
    args = _parse_args()

    client = KbnClient(
        kibana_url=args.kibana_url,
        es_url=args.es_url,
        auth=args.auth,
        verbose=args.verbose,
    )

    per_group_interval: Optional[str] = args.per_group_interval or None

    # Assemble run config for reporting
    cfg: Dict[str, Any] = {
        "kibana_url": args.kibana_url,
        "es_url": args.es_url,
        "mailpit_url": args.mailpit_url,
        "space": args.space,
        "n_rules": args.rules,
        "n_policies": args.policies,
        "rule_interval": args.rule_interval,
        "lookback": args.lookback,
        "duration": args.duration,
        "warmup_timeout": args.warmup_timeout,
        "per_group_interval": per_group_interval,
        "throttle_interval": args.throttle_interval,
        "email_policies": args.email_policies,
        "no_catch_all": args.no_catch_all,
    }

    # Handle Ctrl-C: teardown before exit (unless --keep)
    _teardown_needed = [False]
    def _sigint_handler(sig: int, frame: Any) -> None:
        print("\ninterrupted", flush=True)
        if _teardown_needed[0] and not args.keep:
            print("teardown:", flush=True)
            teardown(client, args.space, args.verbose)
        sys.exit(130)

    signal.signal(signal.SIGINT, _sigint_handler)

    # ── Phase 1: preflight ────────────────────────────────────────────────
    try:
        _preflight(client, args.mailpit_url, args)
    except RuntimeError as exc:
        print(f"\nerror: {exc}", file=sys.stderr)
        sys.exit(1)

    # ── Cleanup-only mode ─────────────────────────────────────────────────
    if args.cleanup_only:
        print("cleanup:")
        removed = cleanup(client, args.space, args.verbose)
        print(f"  removed: {removed}")
        return

    # ── Phase 2: cleanup ──────────────────────────────────────────────────
    print("cleanup (removing any prior perf-* objects):")
    removed = cleanup(client, args.space, args.verbose)
    if any(removed.values()):
        print(f"  removed: rules={removed['rules']} policies={removed['policies']} "
              f"workflows={removed['workflows']} connector={removed['connector']}")
    else:
        print("  nothing to remove")
    print()

    # ── Phase 3: provision ────────────────────────────────────────────────
    print(f"provision: {args.rules} rules, {args.policies} policies...")
    t_provision = time.time()
    try:
        created = provision_all(
            client=client,
            space=args.space,
            n_rules=args.rules,
            n_policies=args.policies,
            rule_interval=args.rule_interval,
            lookback=args.lookback,
            per_group_interval=per_group_interval,
            digest_interval=args.throttle_interval,
            n_email_policies=args.email_policies,
            no_catch_all=args.no_catch_all,
            verbose=args.verbose,
        )
        _teardown_needed[0] = True
    except RuntimeError as exc:
        print(f"\nerror during provision: {exc}", file=sys.stderr)
        print("Hint: if the error mentions minimumScheduleInterval, add to kibana.dev.yml:")
        print("  xpack.alerting_v2.rules.minimumScheduleInterval: 5s")
        print("  xpack.alerting_v2.rules.maxScheduledPerMinute: 32000")
        sys.exit(1)

    print(f"  created: {len(created['rule_ids'])} rules, "
          f"{len(created['policy_ids'])} policies, "
          f"2 workflows, 1 connector")
    print()

    # ── Phase 4: warmup ───────────────────────────────────────────────────
    print(f"warmup (≥{args.warmup_ticks} dispatcher ticks, timeout {args.warmup_timeout}s)...")
    actual_ticks = wait_for_warmup(
        client, args.space, args.warmup_ticks, t_provision, args.warmup_timeout, args.verbose,
    )
    print(f"  observed {actual_ticks} ticks")
    if actual_ticks < args.warmup_ticks:
        print("  WARNING: warmup timed out before target ticks reached")
    print()

    # ── Phase 5: mark t0, clear mailpit, soak ─────────────────────────────
    t0 = time.time()
    print(f"measurement start: {_ts_iso(t0)}")

    # Clear mailpit so we only count emails dispatched during the measurement window
    try:
        client.mailpit("DELETE", args.mailpit_url, "/api/v1/messages")
    except Exception:
        pass  # not fatal

    _soak(args.duration, args.verbose)

    t1 = time.time()
    print(f"measurement end:   {_ts_iso(t1)}")
    print()

    # ── Phase 6: collect metrics ──────────────────────────────────────────
    print("collecting metrics...")
    metrics = collect_all(client, t0, t1, created["rule_ids"], args.mailpit_url)
    print()

    # ── Phase 7: report ───────────────────────────────────────────────────
    print_report(cfg, metrics)

    if args.json_out:
        write_json_report(args.json_out, cfg, metrics)

    # ── Phase 8: teardown ─────────────────────────────────────────────────
    if not args.keep:
        print("teardown:")
        teardown(client, args.space, args.verbose)
        _teardown_needed[0] = False
        print("  done")
    else:
        print("--keep: skipping teardown")


if __name__ == "__main__":
    main()
