# Plan: Dispatch Section UI

**Date**: 2026-03-30
**Author**:
**Status**: Implemented

---

## Problem & Business Outcome

The notification policy form currently separates "Grouping configuration" and "Frequency and timing" into two independent sections. The server-side already supports `groupingMode` (per_episode, per_field, all) and `throttle.strategy` (on_status_change, per_status_interval, time_interval, every_time), but the form has no way to set these fields. Users see a flat group-by field selector and a simple immediate/throttle toggle that don't express the actual dispatch semantics.

**Success looks like:**
- Users can choose between 3 dispatch modes: Per Episode, Per Group, and Digest
- Each mode exposes only the relevant frequency/throttle options
- The form correctly maps to the server-side `groupingMode` + `throttle` fields
- Existing policies load correctly in edit mode with the new form layout

## Actors

- **Alert rule owners** — configure notification policies through the form flyout

## Scope

### In Scope
- Replace the "Grouping configuration" and "Frequency and timing" form sections with a single "Dispatch" section
- 3-mode toggle: Per Episode, Per Group, Digest
- Mode-specific sub-fields (frequency selectors, group-by, interval input)
- Update form state types, constants, conversion utilities, validation, and hook
- Update unit tests, form tests, and storybook stories

### Out of Scope
- Server-side changes (already implemented in the parent plan)
- API schema changes (already done)
- New shared components (reuse EUI components)

---

## UI Design

### Section Header
- **Title**: "Dispatch"
- **Subtitle**: "How should matched episodes be grouped, and how often should they be dispatched?"

### Mode Toggle (EuiButtonGroup, single select)

| Mode value    | Label        |
|---------------|--------------|
| `per_episode` | Per Episode  |
| `per_field`   | Per Group    |
| `all`         | Digest       |

### Per Episode (groupingMode: `per_episode`)

Shows a **Frequency** select (`EuiSelect`) with options:

| Select value          | Label                                    | Maps to strategy        |
|-----------------------|------------------------------------------|-------------------------|
| `on_status_change`    | On status change                         | `on_status_change`      |
| `per_status_interval` | On status change + repeat on interval    | `per_status_interval`   |
| `every_time`          | Every evaluation (no throttle)           | `every_time`            |

When `per_status_interval` is selected, shows a **Repeat interval** text input (e.g. `5m`, `1h`).

### Per Group (groupingMode: `per_field`)

Shows the **Group by** combo box (existing field selector from `useFetchDataFields()`).

Shows a **Frequency** select (`EuiSelect`) with options:

| Select value     | Label                    | Maps to strategy   |
|------------------|--------------------------|--------------------|
| `time_interval`  | At most once every...    | `time_interval`    |
| `every_time`     | Every evaluation         | `every_time`       |

When `time_interval` is selected, shows a **Repeat interval** text input.

### Digest (groupingMode: `all`)

Shows a **Frequency** select (`EuiSelect`) with options:

| Select value     | Label                    | Maps to strategy   |
|------------------|--------------------------|--------------------|
| `time_interval`  | At most once every...    | `time_interval`    |
| `every_time`     | Every evaluation         | `every_time`       |

When `time_interval` is selected, shows a **Repeat interval** text input.

---

## Implementation

### 1. Form State Types (`types.ts`)

Replace the current frequency discriminated union with flat fields that directly map to server concepts.

**Remove**: `ThrottleFrequency`, `ImmediateFrequency`, `NotificationPolicyFrequency`

**New `NotificationPolicyFormState`**:
```typescript
import type { GroupingMode, ThrottleStrategy } from '@kbn/alerting-v2-schemas';

export interface NotificationPolicyFormState {
  name: string;
  description: string;
  matcher: string;
  groupingMode: GroupingMode;       // 'per_episode' | 'per_field' | 'all'
  groupBy: string[];                // only meaningful when groupingMode === 'per_field'
  throttleStrategy: ThrottleStrategy; // 'on_status_change' | 'per_status_interval' | 'time_interval' | 'every_time'
  throttleInterval: string;         // only meaningful when strategy requires an interval
  destinations: NotificationPolicyDestination[];
}
```

### 2. Constants (`constants.ts`)

**Remove**: `FREQUENCY_OPTIONS`

**Add**:
```typescript
export const GROUPING_MODE_OPTIONS = [
  { id: 'per_episode', label: 'Per Episode' },
  { id: 'per_field', label: 'Per Group' },
  { id: 'all', label: 'Digest' },
];

export const PER_EPISODE_STRATEGY_OPTIONS = [
  { value: 'on_status_change', text: 'On status change' },
  { value: 'per_status_interval', text: 'On status change + repeat on interval' },
  { value: 'every_time', text: 'Every evaluation (no throttle)' },
];

export const AGGREGATE_STRATEGY_OPTIONS = [
  { value: 'time_interval', text: 'At most once every...' },
  { value: 'every_time', text: 'Every evaluation (no throttle)' },
];
```

**Update `DEFAULT_FORM_STATE`**:
```typescript
export const DEFAULT_FORM_STATE: NotificationPolicyFormState = {
  name: '',
  description: '',
  matcher: '',
  groupingMode: 'per_episode',
  groupBy: [],
  throttleStrategy: 'on_status_change',
  throttleInterval: '',
  destinations: [],
};
```

**Update `DEFAULT_STRATEGIES`** (defaults when switching modes):
```typescript
export const DEFAULT_STRATEGY_FOR_MODE: Record<GroupingMode, ThrottleStrategy> = {
  per_episode: 'on_status_change',
  per_field: 'time_interval',
  all: 'time_interval',
};
```

### 3. Form Utilities (`form_utils.ts`)

**`toFormState(response)`**: Map server response to form state:
- `groupingMode`: `response.groupingMode ?? 'per_episode'`
- `throttleStrategy`: `response.throttle?.strategy ?? DEFAULT_STRATEGY_FOR_MODE[groupingMode]`
- `throttleInterval`: `response.throttle?.interval ?? ''`
- `groupBy`: `response.groupBy ?? []`

**`toCreatePayload(state)`**: Map form state to create payload:
- Always include `groupingMode`
- Include `groupBy` only when `groupingMode === 'per_field'` and `groupBy.length > 0`
- Include `throttle: { strategy, interval }` — omit `interval` when strategy doesn't need it (`on_status_change`, `every_time`)

**`toUpdatePayload(state, version)`**: Map form state to update payload:
- Always include `groupingMode`
- `groupBy`: send array when `per_field`, send `null` otherwise
- `throttle`: always include `{ strategy }`, add `interval` only when strategy needs it

### 4. Dispatch Section Component (`components/dispatch_section.tsx`)

New component extracted from the form to encapsulate the dispatch section's conditional rendering logic.

```typescript
export const DispatchSection: React.FC = () => {
  const { control, setValue } = useFormContext<NotificationPolicyFormState>();
  const groupingMode = useWatch({ control, name: 'groupingMode' });
  const throttleStrategy = useWatch({ control, name: 'throttleStrategy' });
  const { data: dataFieldNames } = useFetchDataFields();

  // When groupingMode changes, reset throttleStrategy to the default for that mode
  // Use setValue with shouldValidate to keep form state consistent

  return (
    <>
      {/* EuiButtonGroup for groupingMode toggle */}
      {/* Conditional: Per Episode frequency select */}
      {/* Conditional: Per Group — group-by combo + frequency select */}
      {/* Conditional: Digest — frequency select */}
      {/* Conditional: interval input when strategy requires it */}
    </>
  );
};
```

**Key behavior**: When the user switches `groupingMode`, reset `throttleStrategy` to `DEFAULT_STRATEGY_FOR_MODE[newMode]` and clear `throttleInterval`. This prevents invalid strategy/mode combinations.

**Interval input visibility**: Show when `throttleStrategy` is `per_status_interval` or `time_interval`.

### 5. Main Form (`notification_policy_form.tsx`)

- Remove the "Grouping configuration" section (lines 165-213)
- Remove the "Frequency and timing configuration" section (lines 217-304)
- Add a single "Dispatch" section using `<DispatchSection />`
- Remove `FREQUENCY_OPTIONS` import, `useFetchDataFields` call (moved to DispatchSection), `groupByOptions` memo
- Keep `useWatch` for `frequency` → change to watch new fields if needed by parent (likely not — the hook handles validation)

### 6. Form Hook (`use_notification_policy_form.ts`)

**Update `isSubmitEnabled`**:
- Remove old `hasValidThrottleInterval` check on `frequency.type === 'throttle'`
- Add new check: when `throttleStrategy` is `per_status_interval` or `time_interval`, validate `throttleInterval` matches `THROTTLE_INTERVAL_PATTERN`
- Watch `groupingMode`, `throttleStrategy`, `throttleInterval` instead of `frequency`

### 7. Tests

**`form_utils.test.ts`**:
- Update `toCreatePayload` tests: verify `groupingMode` is included, `throttle` has `strategy`+`interval`, `groupBy` only included for `per_field`
- Update `toUpdatePayload` tests: verify nullable handling for `groupingMode`, `throttle`, `groupBy`
- Add `toFormState` tests: verify mapping from server response with `groupingMode` and `throttle.strategy`

**`use_notification_policy_form.test.ts`**:
- Update `EXISTING_POLICY` fixture: add `groupingMode: 'per_field'`, update `throttle` to `{ strategy: 'time_interval', interval: '5m' }`
- Update `DEFAULT_FORM_STATE` references to include new fields
- Update `isSubmitEnabled` tests for new validation rules
- Update create/update payload assertions

**`notification_policy_form.test.tsx`**:
- Remove throttle-specific tests (moved to dispatch section)
- Add tests for dispatch section: mode toggle renders, switching modes changes visible fields
- Test interval input visibility based on strategy selection

**`notification_policy_form.stories.tsx`**:
- Update `EditMode` story: replace `frequency` with `groupingMode`, `throttleStrategy`, `throttleInterval`
- Add stories for each mode: PerEpisode, PerGroup, Digest

---

## Open Questions & Risks

- [x] **Resolved**: Switching `groupingMode` away from `per_field` clears the `groupBy` array. Confirmed by user.
- [x] **Resolved**: `GroupingMode` and `ThrottleStrategy` types will be exported from `@kbn/alerting-v2-schemas` if not already.

---

## Reference: Related Files

| File | Change type | Notes |
|------|-------------|-------|
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/types.ts` | Modify | Replace frequency union with flat `groupingMode`, `throttleStrategy`, `throttleInterval` |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/constants.ts` | Modify | Replace `FREQUENCY_OPTIONS` with mode/strategy options, update default state |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/form_utils.ts` | Modify | Update all 3 conversion functions for new form state shape |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.tsx` | Modify | Remove grouping + frequency sections, add Dispatch section |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/use_notification_policy_form.ts` | Modify | Update watched fields and validation logic |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/dispatch_section.tsx` | Create | New component for the dispatch section |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/form_utils.test.ts` | Modify | Update conversion tests for new state shape |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/use_notification_policy_form.test.ts` | Modify | Update fixtures, validation, and payload tests |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.test.tsx` | Modify | Replace throttle tests with dispatch section tests |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.stories.tsx` | Modify | Update stories for new form state and add per-mode stories |
| `x-pack/platform/packages/shared/response-ops/alerting-v2-schemas/src/notification_policy_response.ts` | Read-only | Source of `GroupingMode`, `ThrottleStrategy` types |
| `x-pack/platform/packages/shared/response-ops/alerting-v2-schemas/src/notification_policy_data_schema.ts` | Read-only | Source of `CreateNotificationPolicyData`, `UpdateNotificationPolicyBody` types |

---

## Todo

> Generated: 2026-03-30
> Status: Complete — all 6 phases implemented, 10 tasks done.

<!-- Tasks are organised into phases. Complete each phase before starting the next.
     Each task references the specific file(s) it touches and what needs to happen.
     Check off tasks as they are completed during implementation. -->

### Phase 1: Types & Constants Foundation ✓

Type and constant changes that downstream code depends on. Nothing in this phase changes runtime behavior.

- [x] **Replace frequency union types with flat dispatch fields** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/types.ts`
  > *Done: Removed `ThrottleFrequency`, `ImmediateFrequency`, `NotificationPolicyFrequency`. Added `groupingMode: GroupingMode`, `throttleStrategy: ThrottleStrategy`, `throttleInterval: string` to `NotificationPolicyFormState`. Imported types from `@kbn/alerting-v2-schemas`. Downstream files will break until updated in later phases.*

- [x] **Replace frequency options with dispatch constants and update default state** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/constants.ts`
  > *Done: Removed `FREQUENCY_OPTIONS`. Added `GROUPING_MODE_OPTIONS`, `PER_EPISODE_STRATEGY_OPTIONS`, `AGGREGATE_STRATEGY_OPTIONS`, `DEFAULT_STRATEGY_FOR_MODE`. Updated `DEFAULT_FORM_STATE` with new fields. All strings wrapped in `i18n.translate()`. Kept `THROTTLE_INTERVAL_PATTERN`.*

### Phase 2: Form Utilities ✓

Update bidirectional conversion between form state and API payloads. Depends on Phase 1 types.

- [x] **Update toFormState, toCreatePayload, and toUpdatePayload for new form state shape** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/form_utils.ts`
  > *Done: Updated all 3 conversion functions. `toFormState` maps `groupingMode`, `throttleStrategy`, `throttleInterval` from server response with defaults. `toCreatePayload` always includes `groupingMode` and `throttle.strategy`, conditionally includes `interval`. `toUpdatePayload` same pattern with nullable `groupBy`.*
  Import `DEFAULT_STRATEGY_FOR_MODE` from `./constants`. **toFormState** (lines 15-26): replace the `frequency` mapping (`response.throttle ? { type: 'throttle', interval } : { type: 'immediate' }`) with three fields: `groupingMode: response.groupingMode ?? 'per_episode'`, `throttleStrategy: response.throttle?.strategy ?? DEFAULT_STRATEGY_FOR_MODE[groupingMode]` (compute `groupingMode` first), `throttleInterval: response.throttle?.interval ?? ''`. **toCreatePayload** (lines 28-41): always include `groupingMode: state.groupingMode`. Replace the `groupBy` spread (line 35) with: include `groupBy` only when `state.groupingMode === 'per_field' && state.groupBy.length > 0`. Replace the `throttle` spread (lines 36-38) with: for strategies `per_status_interval` and `time_interval`, include `throttle: { strategy: state.throttleStrategy, interval: state.throttleInterval }`; for `on_status_change` and `every_time`, include `throttle: { strategy: state.throttleStrategy }` (no interval). **toUpdatePayload** (lines 43-56): always include `groupingMode: state.groupingMode`. Set `groupBy` to `state.groupBy` when `state.groupingMode === 'per_field' && state.groupBy.length > 0`, else `null`. Set `throttle` to `{ strategy: state.throttleStrategy, interval: state.throttleInterval }` for interval strategies, or `{ strategy: state.throttleStrategy }` for non-interval strategies.

### Phase 3: Form Hook ✓

Update validation and watched fields. Depends on Phase 1 types.

- [x] **Update watched fields and submit validation in useNotificationPolicyForm** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/use_notification_policy_form.ts`
  > *Done: Updated `useWatch` to watch `throttleStrategy` and `throttleInterval` instead of `frequency`. Updated `isSubmitEnabled` to validate interval when strategy is `per_status_interval` or `time_interval`.*
  Update the `useWatch` call (lines 43-46): change `name: ['name', 'destinations', 'frequency']` to `name: ['name', 'destinations', 'throttleStrategy', 'throttleInterval']`. Update destructuring accordingly. Update `isSubmitEnabled` (lines 48-55): remove the old `hasValidThrottleInterval` check on `frequency.type === 'throttle'`. Add new check: `const needsInterval = throttleStrategy === 'per_status_interval' || throttleStrategy === 'time_interval'`; `const hasValidInterval = !needsInterval || THROTTLE_INTERVAL_PATTERN.test(throttleInterval)`. Return `hasName && hasDestinations && hasValidInterval`. Update the `useMemo` dependency array to reference the new watched values.

### Phase 4: UI Components ✓

Rendering changes. Depends on Phases 1-3.

- [x] **Create DispatchSection component** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/dispatch_section.tsx`
  > *Done: Created component with EuiButtonGroup for groupingMode toggle, conditional group-by ComboBox for per_field, strategy EuiSelect with mode-specific options, and conditional interval input. Mode switching resets strategy to default and clears groupBy when leaving per_field.*
  Create a new file exporting `const DispatchSection: React.FC`. Use `useFormContext<NotificationPolicyFormState>()` for `control` and `setValue`. Use `useWatch` to read `groupingMode` and `throttleStrategy`. Call `useFetchDataFields()` for the group-by options (moved from the parent form). Build `groupByOptions` with `useMemo` from `dataFieldNames`. **Grouping mode toggle**: render a `Controller` for `groupingMode` using `EuiButtonGroup` (`type="single"`, `isFullWidth`, `legend` i18n string, `options={GROUPING_MODE_OPTIONS}`, `idSelected={field.value}`, `onChange` calls `field.onChange(id)` then resets dependent fields via `setValue('throttleStrategy', DEFAULT_STRATEGY_FOR_MODE[id])`, `setValue('throttleInterval', '')`, and when switching away from `per_field` also `setValue('groupBy', [])`). Use `data-test-subj="groupingModeToggle"`. **Strategy select**: render conditionally based on `groupingMode`. For `per_episode`: a `Controller` for `throttleStrategy` with `EuiSelect` using `PER_EPISODE_STRATEGY_OPTIONS`, label "Frequency", `data-test-subj="strategySelect"`. For `per_field`: first render the group-by `Controller` (move the existing `EuiComboBox` from `notification_policy_form.tsx` lines 183-209 verbatim), then the strategy `EuiSelect` using `AGGREGATE_STRATEGY_OPTIONS`. For `all`: the strategy `EuiSelect` using `AGGREGATE_STRATEGY_OPTIONS`. **Interval input**: if `throttleStrategy` is `per_status_interval` or `time_interval`, render a `Controller` for `throttleInterval` with `EuiFieldText`, label "Repeat interval", help text "e.g. 1h, 5m, 30s", validation rules matching the existing pattern+required rules (lines 258-274 of the current form), `data-test-subj="throttleIntervalInput"`.

- [x] **Replace grouping and frequency sections with DispatchSection in the main form** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.tsx`
  > *Done: Removed grouping and frequency sections. Added Dispatch section with title/subtitle and DispatchSection component. Kept `useFetchDataFields` for MatcherInput. Removed unused EUI imports. Types compile clean (19 pre-existing server-side errors unrelated to this change).*
  Remove imports: `EuiComboBox`, `EuiSelect`, `FREQUENCY_OPTIONS`, `THROTTLE_INTERVAL_PATTERN`, `useFetchDataFields`. Remove the `useWatch` for `frequency` (line 31), the `useFetchDataFields` call (line 32), and the `groupByOptions` memo (lines 33-36). Add import for `DispatchSection` from `./components/dispatch_section`. Remove the "Grouping configuration" `EuiSplitPanel.Outer` block (lines 165-213). Remove the "Frequency and timing configuration" `EuiSplitPanel.Outer` block (lines 217-304). In their place, add a single `EuiSplitPanel.Outer` with header title "Dispatch" (`id="xpack.alertingV2.notificationPolicy.form.dispatch.title"`) and subtitle "How should matched episodes be grouped, and how often should they be dispatched?" (`id="xpack.alertingV2.notificationPolicy.form.dispatch.description"`). In the inner panel, render `<DispatchSection />`. Keep the `EuiSpacer` between sections.

### Phase 5: Tests & Stories ✓

Update all tests and storybook stories for the new form state shape.

- [x] **Update form utility conversion tests** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/form_utils.test.ts`
  > *Done: Updated state fixture, rewrote 3 existing tests, added 2 new `toFormState` tests and 1 new `toCreatePayload` test. 7 tests pass.*
  Update the `state` fixture (lines 11-18): replace `frequency: { type: 'immediate' as const }` with `groupingMode: 'per_episode' as const`, `throttleStrategy: 'on_status_change' as const`, `throttleInterval: ''`. Update the `'omits empty nullable fields from create payloads'` test: expected payload should now include `groupingMode: 'per_episode'` and `throttle: { strategy: 'on_status_change' }` (no interval for `on_status_change`). Update the `'sends explicit null values'` test: expected payload should include `groupingMode: 'per_episode'`, `throttle: { strategy: 'on_status_change' }` instead of `throttle: null` (since every mode now has a strategy). Update the `'preserves concrete nullable values'` test (lines 40-60): change `frequency: { type: 'throttle', interval: '5m' }` to `groupingMode: 'per_field' as const`, `throttleStrategy: 'time_interval' as const`, `throttleInterval: '5m'`. Expected payload should have `groupingMode: 'per_field'`, `groupBy: ['host.name']`, `throttle: { strategy: 'time_interval', interval: '5m' }`. Add a new test `'maps toFormState from a server response'`: create a mock `NotificationPolicyResponse` with `groupingMode: 'per_field'`, `throttle: { strategy: 'time_interval', interval: '5m' }`, `groupBy: ['host.name']`, call `toFormState()`, and assert the result has the correct flat form state fields. Add a second `toFormState` test with `groupingMode: null`, `throttle: null` to verify defaults (`per_episode`, `on_status_change`, `''`).

- [x] **Update hook tests for new form state and validation** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/use_notification_policy_form.test.ts`
  > *Done: Updated `EXISTING_POLICY` fixture with `groupingMode: 'per_field'` and `throttle: { strategy: 'time_interval', interval: '5m' }`. Updated all assertions. Renamed throttle mapping test. 9 tests pass.*
  Update `EXISTING_POLICY` fixture (lines 13-34): add `groupingMode: 'per_field' as const` (or `'per_field'`). Update `throttle` from `{ interval: '5m' }` to `{ strategy: 'time_interval' as const, interval: '5m' }`. Update the `'initializes form with values derived from the existing policy'` test (line 135-142): replace `frequency: { type: 'throttle', interval: '5m' }` with `groupingMode: 'per_field'`, `throttleStrategy: 'time_interval'`, `throttleInterval: '5m'`. Update the `'maps immediate frequency when no throttle is present'` test (lines 145-159): rename to `'maps default strategy when no throttle is present'`. Use `{ ...EXISTING_POLICY, throttle: null, groupingMode: null }`. Assert `getValues().throttleStrategy` equals `'on_status_change'` and `getValues().groupingMode` equals `'per_episode'`. Update the create payload assertions (lines 78-83): the create payload from a fresh form should now include `groupingMode: 'per_episode'` and `throttle: { strategy: 'on_status_change' }`. Update the `'omits optional empty fields'` test: `groupBy` and `throttle.interval` omitted is still correct, but `groupingMode` and `throttle.strategy` should always be present. Update the edit-mode submit assertion (lines 176-184): expected payload should now include `groupingMode: 'per_field'`, `throttle: { strategy: 'time_interval', interval: '5m' }`.

- [x] **Replace throttle tests with dispatch section tests** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.test.tsx`
  > *Done: Replaced 2 old throttle tests with 6 new dispatch section tests: default toggle, strategy select, interval visibility, per group mode, digest mode, digest interval. 7 total tests pass.*
  Update `TEST_SUBJ` (lines 62-67): remove `frequencySelect`, add `groupingModeToggle: 'groupingModeToggle'`, `strategySelect: 'strategySelect'`. Keep `throttleIntervalInput`. Remove the two throttle-specific tests (lines 79-104). Add new tests: (1) `'renders grouping mode toggle with Per Episode selected by default'` — render form, find `groupingModeToggle`, verify `per_episode` button has `aria-pressed="true"`. (2) `'shows strategy select for per_episode mode'` — render form, verify `strategySelect` is visible with `on_status_change` as default. (3) `'shows interval input when per_status_interval strategy is selected'` — render form, select `per_status_interval` in `strategySelect`, verify `throttleIntervalInput` appears. (4) `'shows group by and strategy when Per Group mode is selected'` — render form, click `per_field` in the toggle, verify `groupByInput` and `strategySelect` are visible. (5) `'shows strategy select when Digest mode is selected'` — render form, click `all` in the toggle, verify `strategySelect` is visible with aggregate options. (6) `'shows interval input when time_interval strategy is selected in digest mode'` — click `all`, select `time_interval`, verify `throttleIntervalInput` appears.

- [x] **Update storybook stories for new form state** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.stories.tsx`
  > *Done: Updated CreateMode and EditMode stories. Added PerEpisodeWithInterval and DigestMode stories.*
  Update the `CreateMode` story args (lines 44-53): replace `frequency: { ...DEFAULT_FORM_STATE.frequency }` with the new default state shape (no `frequency` field — the spread of `DEFAULT_FORM_STATE` will include `groupingMode`, `throttleStrategy`, `throttleInterval`). Update the `EditMode` story args (lines 55-66): replace `frequency: { type: 'throttle', interval: '5m' }` with `groupingMode: 'per_field' as const`, `throttleStrategy: 'time_interval' as const`, `throttleInterval: '5m'`. Add two new stories: `PerEpisodeWithInterval` with `groupingMode: 'per_episode'`, `throttleStrategy: 'per_status_interval'`, `throttleInterval: '1h'`; and `DigestMode` with `groupingMode: 'all'`, `throttleStrategy: 'time_interval'`, `throttleInterval: '15m'`, `groupBy: []`.

### Phase 6: Validation ✓

Run all checks to ensure correctness.

- [x] **Type-check the alerting_v2 plugin** — run `node scripts/type_check --project x-pack/platform/plugins/shared/alerting_v2/tsconfig.json`
  > *Done: 11 pre-existing errors in server-side `store_actions_step.test.ts` only. All form-related files compile cleanly.*

- [x] **Run unit tests** — run `node scripts/jest x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/`
  > *Done: 4 suites, 29 tests all pass (form_utils: 7, hook: 9, form: 7, matcher: 6).*

- [x] **Run change validation** — run `node scripts/check_changes.ts`
  > *Done: ESLint passed for 10 files. All pre-commit checks passed.*
