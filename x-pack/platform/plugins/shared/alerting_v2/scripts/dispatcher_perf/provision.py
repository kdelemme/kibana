"""
Resource lifecycle: cleanup, connector, workflows, rules, action policies.

Everything here is idempotent: cleanup runs first, then creates fresh.
"""

import time
from typing import Any, Dict, List, Optional

from kbn import KbnClient
from scenarios import (
    CONNECTOR_BODY,
    CONNECTOR_ID,
    PERF_TAG,
    WORKFLOW_EMAIL_ID,
    WORKFLOW_EMAIL_YAML,
    WORKFLOW_NOOP_ID,
    WORKFLOW_NOOP_YAML,
    build_all_policy_specs,
    build_all_rule_bodies,
    policy_ids,
    rule_ids,
)


# -------------------------------------------------------------------------
# Cleanup
# -------------------------------------------------------------------------

def _paginated_list(client: KbnClient, path: str, space: str, extra_qs: str = "") -> List[str]:
    """Collect all resource IDs by paginating the given list endpoint."""
    ids: List[str] = []
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        _, resp = client.kbn("GET", f"{path}?per_page=100&page={page}{extra_qs}", space=space)
        items = resp.get("items", resp.get("data", []))
        if not items:
            break
        ids.extend(item["id"] for item in items if item.get("id"))
        total = resp.get("total", 0)
        if len(ids) >= total or len(items) < 100:
            break
        page += 1
    return ids


def cleanup(client: KbnClient, space: str, verbose: bool = False) -> Dict[str, int]:
    """
    Delete all perf-harness resources by prefix/tag.
    Non-destructive: only touches objects whose name starts with 'perf-'
    or carries the tag 'perf-harness'.  Never calls _reset_resources.
    """
    removed: Dict[str, int] = {"rules": 0, "policies": 0, "workflows": 0, "connector": 0}

    # --- Action policies --------------------------------------------------
    _, resp = client.kbn("GET", "/api/alerting/v2/action_policies?per_page=100&tags=perf-harness", space=space)
    pol_ids = [p["id"] for p in resp.get("items", []) if p.get("id")]
    if pol_ids:
        chunk_size = 100
        for i in range(0, len(pol_ids), chunk_size):
            client.kbn("POST", "/api/alerting/v2/action_policies/_bulk_delete",
                       {"ids": pol_ids[i:i + chunk_size]}, space=space)
        removed["policies"] = len(pol_ids)
        if verbose:
            print(f"  deleted {len(pol_ids)} action policies", flush=True)

    # --- Rules ------------------------------------------------------------
    # Search for perf rules by tag: perf-harness.
    # The rules list endpoint supports ?tags= filtering.
    page = 1
    all_rule_ids: List[str] = []
    while True:
        _, resp = client.kbn(
            "GET",
            f"/api/alerting/v2/rules?per_page=100&page={page}&tags=perf-harness",
            space=space,
        )
        items = resp.get("items", [])
        if not items:
            break
        all_rule_ids.extend(item["id"] for item in items if item.get("id"))
        total = resp.get("total", 0)
        if len(all_rule_ids) >= total or len(items) < 100:
            break
        page += 1

    if all_rule_ids:
        chunk_size = 100
        for i in range(0, len(all_rule_ids), chunk_size):
            client.kbn(
                "POST",
                "/api/alerting/v2/rules/_bulk_delete",
                {"ids": all_rule_ids[i:i + chunk_size]},
                space=space,
            )
        removed["rules"] = len(all_rule_ids)
        if verbose:
            print(f"  deleted {len(all_rule_ids)} rules", flush=True)

    # --- Workflows --------------------------------------------------------
    # Use ?force=true (hard delete) so the ID is freed for reuse.
    # Default soft-delete keeps the ID reserved, causing 409 on the next POST.
    wf_deleted = 0
    for wf_id in [WORKFLOW_NOOP_ID, WORKFLOW_EMAIL_ID]:
        status, _ = client.kbn(
            "DELETE",
            f"/api/workflows/workflow/{wf_id}?force=true",
            ignore=(404,),
            workflows=True,
            space=space,
        )
        if status not in (404,):
            wf_deleted += 1
    removed["workflows"] = wf_deleted
    if verbose:
        print(f"  deleted {wf_deleted} workflows", flush=True)

    # --- Connector --------------------------------------------------------
    client.kbn("DELETE", f"/api/actions/connector/{CONNECTOR_ID}", ignore=(404,), space=space)
    if verbose:
        print(f"  deleted connector {CONNECTOR_ID}", flush=True)

    return removed


# -------------------------------------------------------------------------
# Provision
# -------------------------------------------------------------------------

def create_connector(client: KbnClient, space: str) -> str:
    """Create the email connector with a deterministic id. Returns the connector id."""
    status, resp = client.kbn(
        "POST",
        f"/api/actions/connector/{CONNECTOR_ID}",
        CONNECTOR_BODY,
        space=space,
    )
    return resp.get("id", CONNECTOR_ID)


def create_workflows(client: KbnClient, space: str) -> None:
    """Create the noop and email workflows with deterministic ids."""
    for wf_id, yaml in [
        (WORKFLOW_NOOP_ID, WORKFLOW_NOOP_YAML),
        (WORKFLOW_EMAIL_ID, WORKFLOW_EMAIL_YAML),
    ]:
        # Hard-delete frees the ID for reuse. Soft-delete (default) keeps it
        # reserved, causing 409 on the subsequent POST.
        client.kbn(
            "DELETE",
            f"/api/workflows/workflow/{wf_id}?force=true",
            ignore=(404,),
            workflows=True,
            space=space,
        )
        status, _ = client.kbn(
            "POST",
            "/api/workflows/workflow",
            {"yaml": yaml, "id": wf_id},
            ignore=(409,),
            workflows=True,
            space=space,
        )
        if status == 409:
            # Workflow ID still in use (e.g. server-side async GC); reuse existing.
            print(f"  warning: workflow '{wf_id}' still exists after force-delete — reusing", flush=True)


def create_rules(
    client: KbnClient,
    space: str,
    n_rules: int,
    rule_interval: str,
    lookback: str,
    verbose: bool = False,
) -> List[str]:
    """Upsert N rules via PUT.  Returns the list of rule ids."""
    bodies = build_all_rule_bodies(n_rules, rule_interval, lookback)
    ids = rule_ids(n_rules)
    for i, (rid, body) in enumerate(zip(ids, bodies)):
        client.kbn("PUT", f"/api/alerting/v2/rules/{rid}", body, space=space)
        if verbose and (i + 1) % 10 == 0:
            print(f"  created {i + 1}/{n_rules} rules", flush=True)
    return ids


def create_policies(
    client: KbnClient,
    space: str,
    n_policies: int,
    per_group_interval: Optional[str],
    digest_interval: str,
    n_email_policies: int,
    no_catch_all: bool,
    verbose: bool = False,
) -> List[str]:
    """Upsert N action policies via PUT.  Returns the list of policy ids."""
    specs = build_all_policy_specs(
        n_policies,
        per_group_interval,
        digest_interval,
        n_email_policies,
        no_catch_all,
    )
    created_ids: List[str] = []
    for i, spec in enumerate(specs):
        client.kbn(
            "PUT",
            f"/api/alerting/v2/action_policies/{spec['id']}",
            spec["body"],
            space=space,
        )
        created_ids.append(spec["id"])
        if verbose and (i + 1) % 5 == 0:
            print(f"  created {i + 1}/{n_policies} policies", flush=True)
    return created_ids


def provision_all(
    client: KbnClient,
    space: str,
    n_rules: int,
    n_policies: int,
    rule_interval: str,
    lookback: str,
    per_group_interval: Optional[str],
    digest_interval: str,
    n_email_policies: int,
    no_catch_all: bool,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Run the full provisioning sequence. Returns ids of created resources."""
    connector_id = create_connector(client, space)
    create_workflows(client, space)
    r_ids = create_rules(client, space, n_rules, rule_interval, lookback, verbose)
    p_ids = create_policies(
        client, space, n_policies, per_group_interval, digest_interval,
        n_email_policies, no_catch_all, verbose,
    )
    return {"connector_id": connector_id, "rule_ids": r_ids, "policy_ids": p_ids}


def teardown(client: KbnClient, space: str, verbose: bool = False) -> None:
    """Alias for cleanup — called at the end of a run."""
    cleanup(client, space, verbose)
