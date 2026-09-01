# alerting_v2 Dispatcher Performance Harness

Measures dispatcher tick latency, per-policy dispatch outcomes, and end-to-end email delivery against a **local** ES + Kibana instance with `kbn-data-forge` producing `fake_stack` events.

## Prerequisites

1. **Elasticsearch + Kibana running locally** — typically started via:
   ```sh
   node scripts/es snapshot
   node scripts/kibana
   ```

2. **`alerting:v2:enabled`** must be `true`. Your `config/kibana.dev.yml` should contain:
   ```yaml
   xpack.alerting_v2.enabled: true
   uiSettings.globalOverrides:
     alerting:v2:enabled: true
   ```

3. **For sub-minute rule intervals** (e.g. `--rule-interval 10s`), also add:
   ```yaml
   xpack.alerting_v2.rules.minimumScheduleInterval: 5s
   xpack.alerting_v2.rules.maxScheduledPerMinute: 32000
   ```
   Rate ceiling: `(60 / interval_seconds) × N_rules ≤ maxScheduledPerMinute`.

4. **[Mailpit](https://mailpit.axllent.org/)** — a fake SMTP service. Install and run:
   ```sh
   brew install mailpit   # macOS
   mailpit --smtp :1025 --listen :8025
   ```
   UI at `http://localhost:8025`; SMTP on `:1025`.

5. **kbn-data-forge** running and producing `fake_stack` data:
   ```sh
   node x-pack/scripts/data_forge.js --config x-pack/platform/packages/shared/kbn-data-forge/example_config/fake_stack.yaml
   ```

6. **Python 3.8+** (stdlib only — no `pip install` required).

## Usage

```sh
cd x-pack/platform/plugins/shared/alerting_v2/scripts/dispatcher_perf

# Quick smoke test (4 rules, 4 policies, 60s)
python3 run.py --rules 4 --policies 4 --duration 60 --verbose

# Default scale (50 rules, 20 policies, 5 min measurement)
python3 run.py

# With JSON output for comparison across branches
python3 run.py --json-out /tmp/run-branch-a.json
diff <(jq .metrics /tmp/run-branch-a.json) <(jq .metrics /tmp/run-branch-b.json)

# Cleanup only (removes all perf-* objects without running)
python3 run.py --cleanup-only

# Keep resources after run (for manual inspection)
python3 run.py --keep
```

## CLI reference

| Flag | Default | Description |
|------|---------|-------------|
| `--kibana-url` | `http://localhost:5601` | Env: `KIBANA_URL` |
| `--es-url` | `http://localhost:9200` | Env: `ES_URL` |
| `--auth` | `elastic:changeme` | `user:pass` or `ApiKey …`. Env: `KBN_AUTH` |
| `--mailpit-url` | `http://localhost:8025` | Env: `MAILPIT_URL` |
| `--space` | `default` | Kibana space |
| `--rules N` | 50 | Total rules to create |
| `--policies M` | 20 | Total action policies |
| `--rule-interval` | `1m` | Rule schedule, e.g. `1m`, `10s` |
| `--lookback` | `5m` | Query lookback window |
| `--duration S` | 300 | Measurement window in seconds |
| `--warmup-timeout` | 120 | Max warmup wait in seconds |
| `--warmup-ticks` | 3 | Min dispatcher ticks before measurement starts |
| `--per-group-interval` | `""` | Throttle for hot per-field policies (`""` = every tick) |
| `--throttle-interval` | `5m` | Throttle for per-field-throttled and digest policies |
| `--email-policies` | 2 | Policies pointing at the email workflow (rest use no-op) |
| `--no-catch-all` | false | Omit the catch-all digest policy |
| `--json-out PATH` | | Write full run metrics to a JSON file |
| `--keep` | false | Skip teardown after run |
| `--cleanup-only` | false | Run cleanup only and exit |
| `--verbose / -v` | false | Print each HTTP request |

## Resources created

| Name | Description |
|------|-------------|
| `perf-mailpit-email` | `.email` connector → mailpit SMTP (localhost:1025) |
| `perf-dispatcher-noop` | Workflow with a `console` step (cost-free; used by most policies) |
| `perf-dispatcher-email` | Workflow with an `email` step (used by 2 policies by default) |
| `perf-rule-NNNN-*` | alerting_v2 rules over `fake_stack` data |
| `perf-policy-*` | Action policies, one per strategy/shard combination |

All names are prefixed with `perf-` and tagged `perf-harness`. Cleanup is prefix-scoped and non-destructive: only these objects are removed, never other alerting_v2 state.

## Rule shapes

| Type | % of N | Grouping field | Expected episodes |
|------|---------|---------------|-------------------|
| `admin-console-errors` | 40% | `host.name` | ~30 episodes each (30 admin-console hosts) |
| `processor-rejects` | 20% | `host.name` | ~10 episodes each (10 message_processor hosts) |
| `single-episode` | 40% | `scope` (constant `"global"`) | exactly 1 episode each |

**Why `scope` instead of no grouping?**  Without a `grouping.fields` entry the rule executor derives the group hash from the execution UUID, minting a brand-new episode every run.  A constant `EVAL scope = "global"` with `grouping: {fields: ["scope"]}` produces one stable, long-lived episode per rule.

## Policy strategies

| Group | Mode | Throttle | Matcher | Notes |
|-------|------|----------|---------|-------|
| per-episode | `per_episode` | `on_status_change` | `perf-shard-{i}` | Fires when episode status changes |
| per-group | `per_field` | none (= every tick) | `perf-shard-{i}` | Hot path — ~200 dispatches/5s at N=50 |
| per-group-throttled | `per_field` | `time_interval 5m` | `perf-shard-{i}` | Cooled version of above |
| digest | `all` | `time_interval 5m` | `perf-shard-{i}` | One group per policy tick |
| catch-all digest | `all` | `time_interval 5m` | none | Matches everything; large payload |

**`group_by: ["data.host.name"]`** — the dispatcher reads episode `data.*` fields (expanded from the ES|QL `host.name` column by `parseDataJson`).  Use `data.host.name`, not `host.name`.

## Metrics

| Metric | Source |
|--------|--------|
| Dispatcher tick count, duration p50/p95/max, schedule delay | `.kibana-event-log*` — `event.provider: taskManager`, `event.action: task-run`, `kibana.task.id: alerting_v2:dispatcher:1.0.0` |
| Rule executor run count | `.kibana-event-log*` — `kibana.task.taskType: alerting_v2:rule_executor` |
| Policy outcomes (dispatched / throttled / unmatched / dispatch_failed) | `.kibana-event-log*` — `event.provider: alerting_v2` |
| Episode inventory | `.rule-events` — `cardinality(episode.id)` |
| Alert action records | `.alert-actions` — terms on `action_type` |
| Emails delivered | Mailpit API `GET /api/v1/messages` |

## Cross-branch comparison

```sh
# On branch A
python3 run.py --json-out /tmp/run-a.json

# Switch to branch B, restart Kibana, then
python3 run.py --json-out /tmp/run-b.json

# Compare
diff <(python3 -c "import json,sys; m=json.load(open('/tmp/run-a.json'))['metrics']; print(json.dumps(m,indent=2))") \
     <(python3 -c "import json,sys; m=json.load(open('/tmp/run-b.json'))['metrics']; print(json.dumps(m,indent=2))")
```
