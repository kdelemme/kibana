"""
Metric collectors.

All heavy lifting is done via direct ES aggregations, which are faster than
paginating Kibana execution-history APIs at load-test volumes.
The Kibana episodes API is used only for warmup polling (lightweight).
"""

import time
from typing import Any, Dict, List, Optional

from kbn import KbnClient

# Event-log index aliases
_EVENT_LOG_INDEX = ".kibana-event-log*"
_RULE_EVENTS_INDEX = ".rule-events"
_ALERT_ACTIONS_INDEX = ".alert-actions"

# Task IDs / types (from alerting_v2 constants)
_DISPATCHER_TASK_ID = "alerting_v2:dispatcher:1.0.0"
_RULE_EXECUTOR_TASK_TYPE = "alerting_v2:rule_executor"

# Event providers
_TASK_MANAGER_PROVIDER = "taskManager"
_ALERTING_V2_PROVIDER = "alerting_v2"


# -------------------------------------------------------------------------
# Warmup helpers
# -------------------------------------------------------------------------

def wait_for_warmup(
    client: KbnClient,
    space: str,
    target_ticks: int,
    t_provision: float,
    timeout: int,
    verbose: bool = False,
) -> int:
    """
    Wait until the dispatcher has completed at least `target_ticks` ticks since
    provisioning, or until `timeout` seconds elapse.

    Returns the actual tick count observed.
    """
    deadline = time.time() + timeout
    t0_iso = _ts_iso(t_provision)

    while time.time() < deadline:
        ticks = _count_dispatcher_ticks(client, t0_iso)
        if verbose:
            print(f"  warmup: {ticks} / {target_ticks} ticks", flush=True)
        if ticks >= target_ticks:
            return ticks
        time.sleep(5)

    return _count_dispatcher_ticks(client, t0_iso)


def _count_dispatcher_ticks(client: KbnClient, since_iso: str) -> int:
    """Count dispatcher task-run events since a timestamp."""
    _, resp = client.es("POST", f"/{_EVENT_LOG_INDEX}/_count", {
        "query": {
            "bool": {
                "filter": [
                    {"term": {"event.provider": _TASK_MANAGER_PROVIDER}},
                    {"term": {"event.action": "task-run"}},
                    {"term": {"kibana.task.id": _DISPATCHER_TASK_ID}},
                    {"range": {"event.start": {"gte": since_iso}}},
                ],
            },
        },
    })
    return resp.get("count", 0)


# -------------------------------------------------------------------------
# Measurement
# -------------------------------------------------------------------------

def collect_all(
    client: KbnClient,
    t0: float,
    t1: float,
    rule_ids: List[str],
    mailpit_base: str,
) -> Dict[str, Any]:
    """
    Gather all metrics for the window [t0, t1].

    Returns a dict with keys: dispatcher, rule_executor, policy_outcomes,
    episodes, alert_actions, mailpit.
    """
    t0_iso = _ts_iso(t0)
    t1_iso = _ts_iso(t1)

    return {
        "t0_iso": t0_iso,
        "t1_iso": t1_iso,
        "dispatcher": _collect_dispatcher(client, t0_iso, t1_iso),
        "rule_executor": _collect_rule_executor(client, t0_iso, t1_iso),
        "policy_outcomes": _collect_policy_outcomes(client, t0_iso, t1_iso),
        "episodes": _collect_episodes(client, rule_ids),
        "alert_actions": _collect_alert_actions(client, t0_iso, t1_iso, rule_ids),
        "mailpit": _collect_mailpit(client, mailpit_base),
    }


# -------------------------------------------------------------------------
# Individual collectors
# -------------------------------------------------------------------------

def _collect_dispatcher(client: KbnClient, t0_iso: str, t1_iso: str) -> Dict[str, Any]:
    """Dispatcher tick count, duration percentiles, schedule delay."""
    _, resp = client.es("POST", f"/{_EVENT_LOG_INDEX}/_search", {
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"event.provider": _TASK_MANAGER_PROVIDER}},
                    {"term": {"event.action": "task-run"}},
                    {"term": {"kibana.task.id": _DISPATCHER_TASK_ID}},
                    {"range": {"event.start": {"gte": t0_iso, "lte": t1_iso}}},
                ],
            },
        },
        "aggs": {
            "tick_count": {"value_count": {"field": "@timestamp"}},
            "failed": {"filter": {"term": {"event.outcome": "failure"}}},
            # event.duration is in nanoseconds (ECS)
            "duration_pct": {
                "percentiles": {
                    "field": "event.duration",
                    "percents": [50, 95, 99, 100],
                },
            },
            "schedule_delay_pct": {
                "percentiles": {
                    "field": "kibana.task.schedule_delay",
                    "percents": [50, 95],
                },
            },
        },
    }, ignore=(404,))

    aggs = resp.get("aggregations", {}) if isinstance(resp, dict) else {}
    duration_raw = aggs.get("duration_pct", {}).get("values", {})
    delay_raw = aggs.get("schedule_delay_pct", {}).get("values", {})

    def _ns_to_ms(v: Optional[float]) -> Optional[float]:
        return round(v / 1_000_000, 1) if v is not None else None

    return {
        "tick_count": int(aggs.get("tick_count", {}).get("value", 0)),
        "failed_ticks": int(aggs.get("failed", {}).get("doc_count", 0)),
        "duration_ms": {
            "p50": _ns_to_ms(duration_raw.get("50.0")),
            "p95": _ns_to_ms(duration_raw.get("95.0")),
            "p99": _ns_to_ms(duration_raw.get("99.0")),
            "max": _ns_to_ms(duration_raw.get("100.0")),
        },
        "schedule_delay_ms": {
            "p50": _ns_to_ms(delay_raw.get("50.0")),
            "p95": _ns_to_ms(delay_raw.get("95.0")),
        },
    }


def _collect_rule_executor(client: KbnClient, t0_iso: str, t1_iso: str) -> Dict[str, Any]:
    """Rule executor run count (throughput check)."""
    _, resp = client.es("POST", f"/{_EVENT_LOG_INDEX}/_count", {
        "query": {
            "bool": {
                "filter": [
                    {"term": {"event.provider": _TASK_MANAGER_PROVIDER}},
                    {"term": {"event.action": "task-run"}},
                    {"term": {"kibana.task.taskType": _RULE_EXECUTOR_TASK_TYPE}},
                    {"range": {"event.start": {"gte": t0_iso, "lte": t1_iso}}},
                ],
            },
        },
    }, ignore=(404,))
    return {"run_count": int(resp.get("count", 0)) if isinstance(resp, dict) else 0}


def _collect_policy_outcomes(client: KbnClient, t0_iso: str, t1_iso: str) -> Dict[str, Any]:
    """
    Per-outcome counts (dispatched / throttled / unmatched / dispatch_failed)
    with aggregated episode_count and action_group_count sums.
    """
    _, resp = client.es("POST", f"/{_EVENT_LOG_INDEX}/_search", {
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"event.provider": _ALERTING_V2_PROVIDER}},
                    {"range": {"@timestamp": {"gte": t0_iso, "lte": t1_iso}}},
                ],
            },
        },
        "aggs": {
            "by_action": {
                "terms": {"field": "event.action", "size": 10},
                "aggs": {
                    "episodes": {
                        "sum": {"field": "kibana.alerting_v2.dispatcher.episode_count"},
                    },
                    "groups": {
                        "sum": {"field": "kibana.alerting_v2.dispatcher.action_group_count"},
                    },
                },
            },
            "by_failure_reason": {
                "terms": {
                    "field": "kibana.alerting_v2.dispatcher.failure_reason",
                    "size": 10,
                },
            },
        },
    }, ignore=(404,))

    aggs = resp.get("aggregations", {}) if isinstance(resp, dict) else {}
    outcomes: Dict[str, Any] = {}
    for bucket in aggs.get("by_action", {}).get("buckets", []):
        key = bucket.get("key", "unknown")
        outcomes[key] = {
            "event_count": bucket.get("doc_count", 0),
            "episode_sum": int(bucket.get("episodes", {}).get("value", 0)),
            "group_sum": int(bucket.get("groups", {}).get("value", 0)),
        }

    failure_reasons: Dict[str, int] = {}
    for bucket in aggs.get("by_failure_reason", {}).get("buckets", []):
        failure_reasons[bucket.get("key", "unknown")] = bucket.get("doc_count", 0)

    return {"by_outcome": outcomes, "failure_reasons": failure_reasons}


def _collect_episodes(client: KbnClient, rule_ids: List[str]) -> Dict[str, Any]:
    """Unique episode count from .rule-events for our rules."""
    if not rule_ids:
        return {"unique_count": 0}

    # Chunk rule_ids to stay within ES terms query limits
    all_ids = rule_ids[:1000]  # generous cap
    _, resp = client.es("POST", f"/{_RULE_EVENTS_INDEX}/_search", {
        "size": 0,
        "query": {
            "bool": {
                "filter": [{"terms": {"rule.id": all_ids}}],
            },
        },
        "aggs": {
            "unique_episodes": {
                "cardinality": {"field": "episode.id", "precision_threshold": 3000},
            },
        },
    }, ignore=(404,))

    aggs = resp.get("aggregations", {}) if isinstance(resp, dict) else {}
    return {
        "unique_count": int(aggs.get("unique_episodes", {}).get("value", 0)),
    }


def _collect_alert_actions(
    client: KbnClient,
    t0_iso: str,
    t1_iso: str,
    rule_ids: List[str],
) -> Dict[str, Any]:
    """action_type breakdown from .alert-actions for our rules in the window."""
    filters = [{"range": {"@timestamp": {"gte": t0_iso, "lte": t1_iso}}}]
    if rule_ids:
        filters.append({"terms": {"rule_id": rule_ids[:1000]}})

    _, resp = client.es("POST", f"/{_ALERT_ACTIONS_INDEX}/_search", {
        "size": 0,
        "query": {"bool": {"filter": filters}},
        "aggs": {
            "by_action_type": {"terms": {"field": "action_type", "size": 20}},
        },
    }, ignore=(404,))

    aggs = resp.get("aggregations", {}) if isinstance(resp, dict) else {}
    by_type: Dict[str, int] = {}
    for bucket in aggs.get("by_action_type", {}).get("buckets", []):
        by_type[bucket.get("key", "unknown")] = bucket.get("doc_count", 0)

    return {"by_action_type": by_type}


def _collect_mailpit(client: KbnClient, mailpit_base: str) -> Dict[str, Any]:
    """Count of emails delivered to Mailpit since the last clear."""
    try:
        _, resp = client.mailpit("GET", mailpit_base, "/api/v1/messages?limit=1")
        total = resp.get("total", resp.get("messages_count", 0)) if isinstance(resp, dict) else 0
        return {"message_count": int(total)}
    except Exception as exc:
        return {"message_count": 0, "error": str(exc)}


# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------

def _ts_iso(ts: float) -> str:
    """Convert a Unix timestamp to a UTC ISO-8601 string suitable for ES range queries."""
    import datetime
    return datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%S.000Z")
