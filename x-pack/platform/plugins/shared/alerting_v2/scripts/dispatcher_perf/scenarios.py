"""
Rule and action-policy scenario catalog.

Pure data / builders — no side effects, no network calls.
"""

import math
from typing import Any, Dict, List, Optional

# -------------------------------------------------------------------------
# Shared identifiers
# -------------------------------------------------------------------------

PERF_PREFIX = "perf-"
PERF_TAG = "perf-harness"
CONNECTOR_ID = "perf-mailpit-email"
WORKFLOW_NOOP_ID = "perf-dispatcher-noop"
WORKFLOW_EMAIL_ID = "perf-dispatcher-email"

# Fake-stack index patterns (from kbn-data-forge calculateIndexName).
# Patterns are glob-safe for ES queries.
FAKE_STACK_PATTERNS = {
    "admin_console": "kbn-data-forge-fake_stack.admin-console-*",
    "message_processor": "kbn-data-forge-fake_stack.message_processor-*",
    "nginx_proxy": "kbn-data-forge-fake_stack.nginx_proxy-*",
    "mongodb": "kbn-data-forge-fake_stack.mongodb-*",
}

# The dispatcher reads `data.*` from the episode's flattened row document
# (parseDataJson expands "host.name" → {host: {name: ...}}).
# Use "data.host.name" in group_by and matcher.expression, never bare "host.name".
GROUP_BY_HOST = ["data.host.name"]

# -------------------------------------------------------------------------
# ES|QL breach queries
# -------------------------------------------------------------------------

# Each query is a *complete* standalone ES|QL statement.
# The rule executor adds a `@timestamp` range filter at run time (lookback window).
# No time predicate is needed inside the query itself.
#
# The `severity` column is recognized by extractSeverity() and stored on the episode.
# Grouping columns must match the rule's grouping.fields exactly.

QUERY_ADMIN_CONSOLE_ERRORS = (
    "FROM kbn-data-forge-fake_stack.admin-console-* "
    "| WHERE log.level == \"ERROR\" "
    "| STATS error_count = COUNT(*) BY host.name "
    "| WHERE error_count >= 1 "
    "| EVAL severity = CASE(error_count > 20, \"critical\", error_count > 5, \"high\", \"medium\")"
)

QUERY_PROCESSOR_REJECTS = (
    "FROM kbn-data-forge-fake_stack.message_processor-* "
    "| STATS accepted = SUM(processor.accepted), processed = SUM(processor.processed) BY host.name "
    "| WHERE accepted > 0 "
    "| EVAL rejected_pct = 1.0 - TO_DOUBLE(processed) / TO_DOUBLE(accepted) "
    "| WHERE rejected_pct > 0 "
    "| EVAL severity = \"high\""
)

# Grouping on a constant column is intentional: without a grouping field the
# rule executor builds a group hash from the execution UUID, minting a brand-new
# episode every run.  `EVAL scope = "global"` + `grouping.fields: ["scope"]`
# produces exactly one stable, long-lived episode per rule.
QUERY_SINGLE_EPISODE = (
    "FROM kbn-data-forge-fake_stack.nginx_proxy-* "
    "| WHERE http.response.status_code >= 500 "
    "| STATS error_count = COUNT(*) "
    "| WHERE error_count > 0 "
    "| EVAL scope = \"global\", severity = \"medium\""
)

# -------------------------------------------------------------------------
# Workflow YAML templates
# -------------------------------------------------------------------------

WORKFLOW_NOOP_YAML = """\
name: "perf-dispatcher-noop"
enabled: true
description: "alerting_v2 dispatcher perf harness - no-op destination"
triggers:
  - type: manual
steps:
  - name: log
    type: console
    with:
      message: "perf dispatch"
"""

# The $ref declares the payload input schema so the email step can template it.
# KIBANA_WORKFLOW_INPUT_DEFINITION_REF_PREFIX = '#/kibana/definitions/'
# ALERTING_V2_NOTIFICATION_GROUP_INPUT_DEFINITION_ID = 'alertingV2NotificationGroup'
WORKFLOW_EMAIL_YAML = """\
name: "perf-dispatcher-email"
enabled: true
description: "alerting_v2 dispatcher perf harness - email destination"
triggers:
  - type: manual
    inputs:
      type: object
      properties:
        payload:
          $ref: "#/kibana/definitions/alertingV2NotificationGroup"
      required:
        - payload
steps:
  - name: notify
    type: email
    connector-id: {connector_id}
    with:
      to:
        - "dispatcher-perf@example.com"
      subject: "[perf] {{{{ inputs.payload.policyId }}}}"
      message: "group {{{{ inputs.payload.id }}}}"
""".format(connector_id=CONNECTOR_ID)

# -------------------------------------------------------------------------
# Email connector body
# -------------------------------------------------------------------------

CONNECTOR_BODY: Dict[str, Any] = {
    "name": "perf-mailpit",
    "connector_type_id": ".email",
    "config": {
        "service": "other",
        "from": "kibana-perf@example.com",
        "host": "localhost",
        "port": 1025,
        "secure": False,
        "hasAuth": False,
    },
    "secrets": {},
}

# -------------------------------------------------------------------------
# Rule builders
# -------------------------------------------------------------------------

# Rule shape definitions: (name_prefix, query, grouping_fields, fraction_of_N)
_RULE_SHAPES = [
    ("admin-console-errors", QUERY_ADMIN_CONSOLE_ERRORS, ["host.name"], 0.40),
    ("processor-rejects", QUERY_PROCESSOR_REJECTS, ["host.name"], 0.20),
    ("single-episode", QUERY_SINGLE_EPISODE, ["scope"], 0.40),
]


def rule_ids(n_rules: int) -> List[str]:
    """Return the deterministic IDs that will be created for N rules."""
    return [f"perf-rule-{i + 1:04d}" for i in range(n_rules)]


def build_rule_body(
    index: int,
    n_rules: int,
    rule_interval: str,
    lookback: str,
    n_shards: int = 5,
) -> Dict[str, Any]:
    """
    Build the PUT body for rule number ``index`` (0-based).

    Shape assignment: ceil-proportional from _RULE_SHAPES.
    Shard tag: ``perf-shard-{index % n_shards}`` — used as the policy matcher key.
    """
    # Assign shape
    remaining = n_rules
    cumulative = 0
    chosen_shape = _RULE_SHAPES[-1]
    for name_prefix, query, grouping, fraction in _RULE_SHAPES:
        count = math.ceil(n_rules * fraction)
        if index < cumulative + count:
            chosen_shape = (name_prefix, query, grouping, fraction)
            break
        cumulative += count

    name_prefix, query, grouping_fields, _ = chosen_shape
    shard = index % n_shards
    rule_name = f"perf-rule-{index + 1:04d}-{name_prefix}"

    return {
        "kind": "alert",
        "metadata": {
            "name": rule_name,
            "description": f"Dispatcher perf harness rule #{index + 1}",
            "tags": [PERF_TAG, f"perf-shard-{shard}"],
        },
        "time_field": "@timestamp",
        "schedule": {
            "every": rule_interval,
            "lookback": lookback,
        },
        "recovery_strategy": "no_breach",
        "state_transition": {
            # Zero so episodes reach `active` on the first run immediately.
            "pending_count": 0,
            "recovering_count": 0,
        },
        "query": {
            "format": "standalone",
            "breach": {"query": query},
        },
        "grouping": {"fields": grouping_fields},
    }


def build_all_rule_bodies(
    n_rules: int,
    rule_interval: str,
    lookback: str,
    n_shards: int = 5,
) -> List[Dict[str, Any]]:
    """Return one body dict per rule, in order."""
    return [
        build_rule_body(i, n_rules, rule_interval, lookback, n_shards)
        for i in range(n_rules)
    ]


# -------------------------------------------------------------------------
# Policy builders
# -------------------------------------------------------------------------

# Policy strategy groups — shard-scoped (matcher.tags = perf-shard-N).
# The catch-all (no matcher) is always exactly 1 policy; it is handled separately.
_STRATEGY_GROUPS = [
    # (suffix, grouping_mode, group_by, base_strategy)
    ("per-episode", "per_episode", None, "on_status_change"),
    # per-group with no interval → fires every dispatcher tick (interval resolved at build time)
    ("per-group", "per_field", GROUP_BY_HOST, "time_interval"),
    ("per-group-throttled", "per_field", GROUP_BY_HOST, "time_interval"),
    ("digest", "all", None, "time_interval"),
]


def policy_ids(n_policies: int) -> List[str]:
    """Return the deterministic IDs for N policies."""
    _all = _build_policy_specs(n_policies, None, "5m", 2, False, 5)
    return [spec["id"] for spec in _all]


def _make_policy_body(
    suffix: str,
    index: int,
    mode: str,
    group_by: Optional[List[str]],
    strategy: str,
    resolved_interval: Optional[str],
    shard: Optional[int],
    uses_email: bool,
) -> Dict[str, Any]:
    """Build the PUT body for a single action policy."""
    throttle: Optional[Dict[str, Any]] = None
    if strategy == "on_status_change":
        throttle = {"strategy": "on_status_change"}
    elif strategy == "time_interval" and resolved_interval:
        throttle = {"strategy": "time_interval", "interval": resolved_interval}
    # omit throttle when resolved_interval is None → per_field fires every tick

    body: Dict[str, Any] = {
        "name": f"perf-{suffix}-{index:02d}",
        "description": f"Dispatcher perf harness - {suffix} policy #{index}",
        "destinations": [
            {"type": "workflow", "id": WORKFLOW_EMAIL_ID if uses_email else WORKFLOW_NOOP_ID}
        ],
        "tags": [PERF_TAG],
        "grouping_mode": mode,
    }
    if group_by is not None:
        body["group_by"] = group_by
    if throttle is not None:
        body["throttle"] = throttle
    if shard is not None:
        body["matcher"] = {"tags": [f"perf-shard-{shard}"]}
    # shard is None → catch-all (no matcher key)
    return body


def _build_policy_specs(
    n_policies: int,
    per_group_interval: Optional[str],
    digest_interval: str,
    n_email_policies: int,
    no_catch_all: bool,
    n_shards: int,
) -> List[Dict[str, Any]]:
    """
    Internal: compute the full spec list for N policies.
    Returns list of dicts with keys: id, body, uses_email.

    Layout:
      - 1 catch-all digest (unless --no-catch-all)
      - Remaining N-1 policies split equally across 4 strategy groups
    """
    n_catchall = 0 if no_catch_all else 1
    n_remaining = max(0, n_policies - n_catchall)
    n_groups = len(_STRATEGY_GROUPS)
    per_group_base = max(1, n_remaining // n_groups) if n_remaining > 0 else 0
    remainder = n_remaining - per_group_base * n_groups

    email_used = 0
    specs: List[Dict[str, Any]] = []

    for gi, (suffix, mode, group_by, strategy) in enumerate(_STRATEGY_GROUPS):
        count = per_group_base + (1 if gi < remainder else 0)
        for si in range(count):
            shard = si % n_shards

            # Resolve throttle interval per group type
            if strategy == "time_interval":
                if suffix == "per-group":
                    # per_group_interval=None means fire every dispatcher tick
                    resolved_interval = per_group_interval  # may be None
                elif suffix == "per-group-throttled":
                    resolved_interval = digest_interval
                elif suffix == "digest":
                    resolved_interval = digest_interval
                else:
                    resolved_interval = None
            else:
                resolved_interval = None  # on_status_change needs no interval

            pid = f"perf-policy-{suffix}-{si + 1:02d}"
            uses_email = email_used < n_email_policies
            if uses_email:
                email_used += 1

            body = _make_policy_body(
                suffix, si + 1, mode, group_by, strategy, resolved_interval, shard, uses_email
            )
            specs.append({"id": pid, "body": body, "uses_email": uses_email})

    # Catch-all (exactly 1, no matcher)
    if not no_catch_all:
        uses_email = email_used < n_email_policies
        body = _make_policy_body(
            "catch-all", 1, "all", None, "time_interval", digest_interval, None, uses_email
        )
        specs.append({"id": "perf-policy-catch-all-01", "body": body, "uses_email": uses_email})

    return specs


def build_all_policy_specs(
    n_policies: int,
    per_group_interval: Optional[str],
    digest_interval: str,
    n_email_policies: int,
    no_catch_all: bool,
    n_shards: int = 5,
) -> List[Dict[str, Any]]:
    """
    Return one spec dict per action policy.
    Each spec has: {'id': str, 'body': dict, 'uses_email': bool}
    """
    return _build_policy_specs(
        n_policies,
        per_group_interval,
        digest_interval,
        n_email_policies,
        no_catch_all,
        n_shards,
    )


# -------------------------------------------------------------------------
# Unique ES|QL queries for dry-run preflight
# -------------------------------------------------------------------------

PREFLIGHT_QUERIES = [
    ("admin_console_errors", QUERY_ADMIN_CONSOLE_ERRORS),
    ("processor_rejects", QUERY_PROCESSOR_REJECTS),
    ("single_episode", QUERY_SINGLE_EPISODE),
]
