"""
Console table renderer and JSON report writer.
No external deps — plain stdlib formatting.
"""

import json
import os
from typing import Any, Dict, List, Optional


# -------------------------------------------------------------------------
# Console output
# -------------------------------------------------------------------------

def _hr(width: int = 72, char: str = "-") -> str:
    return char * width


def _table(headers: List[str], rows: List[List[str]], col_widths: Optional[List[int]] = None) -> str:
    if col_widths is None:
        col_widths = [max(len(h), max((len(str(r[i])) for r in rows), default=0)) for i, h in enumerate(headers)]

    def _row(cells: List[str]) -> str:
        return "  " + "  ".join(str(c).ljust(col_widths[i]) for i, c in enumerate(cells))

    lines = [_row(headers), "  " + "  ".join("-" * w for w in col_widths)]
    for row in rows:
        lines.append(_row([str(c) for c in row]))
    return "\n".join(lines)


def _ms(val: Optional[float]) -> str:
    if val is None:
        return "-"
    if val >= 1000:
        return f"{val / 1000:.1f}s"
    return f"{val:.0f}ms"


def print_report(
    cfg: Dict[str, Any],
    metrics: Dict[str, Any],
) -> None:
    """Print a structured report to stdout."""

    print()
    print(_hr(72, "="))
    print("DISPATCHER PERF REPORT")
    print(_hr(72, "="))

    # Config summary
    print(f"\nRun config:")
    print(f"  rules      : {cfg.get('n_rules')}  (interval {cfg.get('rule_interval')}, lookback {cfg.get('lookback')})")
    print(f"  policies   : {cfg.get('n_policies')}")
    print(f"  duration   : {cfg.get('duration')}s")
    print(f"  window     : {metrics.get('t0_iso')}  →  {metrics.get('t1_iso')}")

    # --- Dispatcher ticks -------------------------------------------------
    d = metrics.get("dispatcher", {})
    dur = d.get("duration_ms", {})
    delay = d.get("schedule_delay_ms", {})

    print(f"\n{_hr()}")
    print("DISPATCHER TICKS")
    print(_hr())
    print(f"  tick_count   : {d.get('tick_count', 0)}")
    print(f"  failed_ticks : {d.get('failed_ticks', 0)}")
    print(f"  duration ms  :  p50={_ms(dur.get('p50'))}  p95={_ms(dur.get('p95'))}  "
          f"p99={_ms(dur.get('p99'))}  max={_ms(dur.get('max'))}")
    print(f"  sched delay  :  p50={_ms(delay.get('p50'))}  p95={_ms(delay.get('p95'))}")

    # --- Rule executor ----------------------------------------------------
    re = metrics.get("rule_executor", {})
    print(f"\n{_hr()}")
    print("RULE EXECUTOR")
    print(_hr())
    print(f"  run_count : {re.get('run_count', 0)}")

    # --- Policy outcomes --------------------------------------------------
    po = metrics.get("policy_outcomes", {})
    outcomes = po.get("by_outcome", {})
    print(f"\n{_hr()}")
    print("POLICY OUTCOMES")
    print(_hr())

    outcome_rows: List[List[str]] = []
    for outcome in ["dispatched", "throttled", "unmatched", "dispatch_failed"]:
        d2 = outcomes.get(outcome, {})
        outcome_rows.append([
            outcome,
            str(d2.get("event_count", 0)),
            str(d2.get("episode_sum", 0)),
            str(d2.get("group_sum", 0)),
        ])

    print(_table(
        ["outcome", "event_count", "episode_sum", "group_sum"],
        outcome_rows,
        col_widths=[16, 12, 12, 10],
    ))

    fr = po.get("failure_reasons", {})
    if fr:
        print(f"\n  failure reasons: {json.dumps(fr)}")

    # --- Episodes ---------------------------------------------------------
    ep = metrics.get("episodes", {})
    print(f"\n{_hr()}")
    print("EPISODES")
    print(_hr())
    print(f"  unique_count : {ep.get('unique_count', 0)}")

    # --- Alert actions ---------------------------------------------------
    aa = metrics.get("alert_actions", {})
    at = aa.get("by_action_type", {})
    print(f"\n{_hr()}")
    print("ALERT ACTIONS (in .alert-actions)")
    print(_hr())
    for action_type, count in sorted(at.items()):
        print(f"  {action_type:<20}: {count}")
    if not at:
        print("  (none in window)")

    # --- Mailpit ----------------------------------------------------------
    mp = metrics.get("mailpit", {})
    print(f"\n{_hr()}")
    print("EMAIL DELIVERY (mailpit)")
    print(_hr())
    print(f"  message_count : {mp.get('message_count', 0)}")
    if "error" in mp:
        print(f"  error         : {mp['error']}")

    print(f"\n{_hr(72, '=')}")
    print()


# -------------------------------------------------------------------------
# JSON report
# -------------------------------------------------------------------------

def write_json_report(
    path: str,
    cfg: Dict[str, Any],
    metrics: Dict[str, Any],
) -> None:
    """Write the full run config + metrics as a JSON file."""
    report = {"config": cfg, "metrics": metrics}
    with open(path, "w") as fh:
        json.dump(report, fh, indent=2)
    print(f"json report: {os.path.abspath(path)}")
