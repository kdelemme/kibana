# Plan: Duration Input Component

**Date**: 2026-03-30
**Author**:
**Status**: Implemented

---

## Problem & Business Outcome

The throttle interval input is currently a raw text field where users type duration strings like `5m` or `1h`. This is error-prone (users must know the format) and provides poor validation feedback. The same duration input need exists in other parts of the form and potentially other forms (e.g. snooze).

**Success looks like:**
- Users see a structured input with a number field and unit selector instead of typing raw strings
- The component is standalone, testable in isolation, and has its own Storybook stories
- The component can be reused anywhere a duration input is needed
- Existing form behavior is preserved — the component outputs the same `"5m"` / `"1h"` string format

## Actors

- **Alert rule owners** — configure throttle intervals through the notification policy form
- **Developers** — reuse the component in other forms that need duration inputs

## Scope

### In Scope
- Create a standalone `DurationInput` component in `form/components/`
- Component layout: "Every" prepend label + number input + unit selector append (popover)
- Parse incoming string values (e.g. `"5m"`) into number + unit for display
- Combine number + unit back into string format on change
- Validate: number must be > 0 and an integer
- Unit options: second(s), minute(s), hour(s), day(s)
- Unit test file for the component
- Storybook stories for the component
- Replace the current `EuiFieldText` throttle interval input in `dispatch_section.tsx` with the new component
- Update form-level tests that interact with the interval input

### Out of Scope
- Server-side changes (no API schema or validation changes)
- Changes to `THROTTLE_INTERVAL_PATTERN` regex or `validateDuration` logic
- Changes to the `throttleInterval` form state type (stays as `string`)

---

## Implementation

### Component Design

**Props interface:**
```typescript
interface DurationInputProps {
  value: string;           // e.g. '5m', '1h', '' (empty for new)
  onChange: (value: string) => void;
  isInvalid?: boolean;
  'data-test-subj'?: string;
}
```

**Layout:** `EuiFieldNumber` with:
- `prepend`: Static "Every" label string
- `append`: `EuiSelect` (compact) for unit selection — simpler than a popover, matches the snooze form pattern already used in the codebase (`notification_policy_snooze_form.tsx`)
- `fullWidth`

**Internal state:**
- `durationValue: number | ''` — the numeric part
- `durationUnit: 's' | 'm' | 'h' | 'd'` — the unit part
- Derived from parsing the `value` prop on mount / when value changes externally
- On change of either value or unit, combine and call `onChange(${durationValue}${durationUnit})`

**Parsing logic** (`parseDuration` helper):
- Input `"5m"` → `{ value: 5, unit: 'm' }`
- Input `""` → `{ value: '', unit: 'm' }` (default unit)
- Input `"1h"` → `{ value: 1, unit: 'h' }`
- Uses regex match on `THROTTLE_INTERVAL_PATTERN` or simple `parseInt` + last char

**Unit options constant:**
```typescript
const DURATION_UNIT_OPTIONS = [
  { value: 's', text: 'second(s)' },
  { value: 'm', text: 'minute(s)' },
  { value: 'h', text: 'hour(s)' },
  { value: 'd', text: 'day(s)' },
];
```

**Default unit:** `'m'` (minutes) when no value is provided.

### Integration with dispatch_section.tsx

Replace the current `Controller` block for `throttleInterval` (the `EuiFieldText` with pattern/required validation rules) with:
```tsx
<Controller
  name="throttleInterval"
  control={control}
  rules={{
    validate: (val) => {
      if (!needsInterval(throttleStrategy)) return true;
      if (!val || !THROTTLE_INTERVAL_PATTERN.test(val)) return 'Repeat interval is required.';
      return true;
    },
  }}
  render={({ field, fieldState: { error } }) => (
    <EuiFormRow
      label="Repeat interval"
      fullWidth
      isInvalid={!!error}
      error={error?.message}
    >
      <DurationInput
        value={field.value}
        onChange={field.onChange}
        isInvalid={!!error}
        data-test-subj="throttleIntervalInput"
      />
    </EuiFormRow>
  )}
/>
```

The validation moves from separate `pattern` + `required` rules to a single `validate` function. Since the component enforces valid format through its structured inputs (number field + unit selector), the pattern validation becomes a safety net rather than the primary guard.

### Form state compatibility

No changes to `form_utils.ts` — the component outputs the same string format (`"5m"`, `"1h"`, etc.) that the existing `buildThrottle()` and `needsInterval()` functions expect. The `THROTTLE_INTERVAL_PATTERN` constant is still used for form-level validation.

---

## Open Questions & Risks

- [x] **Resolved**: Append uses `EuiSelect` (not popover) — matches existing snooze form pattern and is simpler. Confirmed by codebase research.

---

## Reference: Related Files

| File | Change type | Notes |
|------|-------------|-------|
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/duration_input.tsx` | Create | New standalone component |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/duration_input.test.tsx` | Create | Unit tests for component |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/duration_input.stories.tsx` | Create | Storybook stories |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/dispatch_section.tsx` | Modify | Replace EuiFieldText interval input with DurationInput |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.test.tsx` | Modify | Update interval input interaction tests |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/constants.ts` | Read-only | `THROTTLE_INTERVAL_PATTERN` still used for validation |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/form_utils.ts` | Read-only | No changes — same string format |
| `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/notification_policy_snooze_form.tsx` | Read-only | Reference for split number+unit pattern |

---

## Todo

> Generated: 2026-03-30
> Status: Complete — all 4 phases implemented, 8 tasks done.

<!-- Tasks are organised into phases. Complete each phase before starting the next.
     Each task references the specific file(s) it touches and what needs to happen.
     Check off tasks as they are completed during implementation. -->

### Phase 1: Standalone Component ✓

Create the DurationInput component with its own tests and stories. No integration with the form yet.

- [x] **Create DurationInput component** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/duration_input.tsx`
  > *Done: Created component with `parseDuration` helper, `DurationInputProps` interface, `DURATION_UNIT_OPTIONS` constant. Uses `EuiFieldNumber` with "Every" prepend and `EuiSelect` append. Only calls onChange with well-formed strings when value > 0.*
  Create a new file exporting `const DurationInput: React.FC<DurationInputProps>`. Define the props interface: `value: string`, `onChange: (value: string) => void`, `isInvalid?: boolean`, `'data-test-subj'?: string`. Define `DURATION_UNIT_OPTIONS` as a typed constant array: `[{ value: 's', text: 'second(s)' }, { value: 'm', text: 'minute(s)' }, { value: 'h', text: 'hour(s)' }, { value: 'd', text: 'day(s)' }]` — wrap each `text` in `i18n.translate()` following the `xpack.alertingV2.notificationPolicy.form.durationInput.*` id pattern. Define a `type DurationUnit = 's' | 'm' | 'h' | 'd'` local type. Implement a `parseDuration(value: string): { value: number | ''; unit: DurationUnit }` helper: parse the numeric prefix with `parseInt` and extract the last character as the unit; if the string is empty or unparseable, return `{ value: '', unit: 'm' }`. Use `useState` for `durationValue` (number | '') and `durationUnit` (DurationUnit), initialized from `parseDuration(value)`. Render an `EuiFieldNumber` with: `prepend` set to the i18n string "Every", `append` set to an `EuiSelect` (with `options={DURATION_UNIT_OPTIONS}`, `value={durationUnit}`, `compressed`, no separate label, `aria-label` for unit selection), `min={1}`, `value={durationValue}`, `fullWidth`, `isInvalid` passed through, `data-test-subj` passed through. On number change: parse `parseInt(e.target.value, 10)`, update `durationValue`, and if the parsed number is valid (> 0), call `onChange(\`\${parsedValue}\${durationUnit}\`)`. On unit change: update `durationUnit`, and if `durationValue` is a valid number (> 0), call `onChange(\`\${durationValue}\${newUnit}\`)`. This means `onChange` is only called with well-formed strings — empty/invalid intermediate states keep the previous `value` prop unchanged.

- [x] **Create DurationInput unit tests** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/duration_input.test.tsx`
  > *Done: 8 tests covering: parsed rendering, empty state, number change, unit change, empty number guard, isInvalid passthrough, 1d parsing, 30s parsing. All pass.*
  Create a new test file using `@testing-library/react` and `userEvent` (matching the pattern in `notification_policy_form.test.tsx`). Import `DurationInput` directly. Write tests: (1) `'renders with parsed value and unit from string prop'` — render with `value="5m"`, verify the number input has value `5`, verify the unit select has value `m`. (2) `'renders empty number with default unit when value is empty'` — render with `value=""`, verify number input is empty, unit select defaults to `m`. (3) `'calls onChange with combined string when number changes'` — render with `value="5m"`, clear and type `10` in the number input, assert `onChange` called with `"10m"`. (4) `'calls onChange with combined string when unit changes'` — render with `value="5m"`, change select to `h`, assert `onChange` called with `"5h"`. (5) `'does not call onChange when number is cleared to empty'` — render with `value="5m"`, clear the input, assert `onChange` not called (intermediate invalid state). (6) `'passes isInvalid to EuiFieldNumber'` — render with `isInvalid={true}`, verify the number input has `aria-invalid="true"`. (7) `'parses various duration formats'` — render with `value="1d"`, verify value `1` and unit `d`; then with `value="30s"`, verify value `30` and unit `s`.

- [x] **Create DurationInput Storybook stories** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/duration_input.stories.tsx`
  > *Done: 5 stories (Empty, FiveMinutes, OneHour, ThirtySeconds, Invalid) with interactive useState wrapper.*
  Create a new story file following the pattern in `notification_policy_form.stories.tsx` (import `Meta`, `StoryObj` from `@storybook/react`). Set `title: 'Alerting V2/Notification Policy/Form/Duration Input'`. Create a wrapper story component that uses `useState` to manage the `value` string (so the component is interactive in Storybook). Export stories: (1) `Empty` — `value: ''`, default state for new forms. (2) `FiveMinutes` — `value: '5m'`. (3) `OneHour` — `value: '1h'`. (4) `ThirtySeconds` — `value: '30s'`. (5) `Invalid` — `value: '5m'` with `isInvalid: true`.

### Phase 2: Integration ✓

Replace the current EuiFieldText interval input in the dispatch section with the new component.

- [x] **Replace EuiFieldText with DurationInput in dispatch_section.tsx** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/components/dispatch_section.tsx`
  > *Done: Removed EuiFieldText import, imported DurationInput, replaced Controller render with DurationInput, simplified validation to single `validate` function, removed helpText. Kept THROTTLE_INTERVAL_PATTERN for safety-net validation.*
  Import `DurationInput` from `./duration_input`. In the `{showInterval && (...)}` block (lines 124-168): replace the `Controller` for `throttleInterval`. Remove the `EuiFieldText` import (line 8, only if no longer used elsewhere — check first). Remove the `THROTTLE_INTERVAL_PATTERN` import (line 18) since validation will move to a `validate` function. Update the `Controller` rules: replace the separate `pattern` and `required` rules with a single `validate` function: `(val) => { if (!val || !THROTTLE_INTERVAL_PATTERN.test(val)) return i18n.translate('xpack.alertingV2.notificationPolicy.form.throttleInterval.required', { defaultMessage: 'Repeat interval is required.' }); return true; }`. Actually keep `THROTTLE_INTERVAL_PATTERN` imported for this validation. In the `render` callback: replace `EuiFieldText` with `<DurationInput value={field.value} onChange={field.onChange} isInvalid={!!error} data-test-subj="throttleIntervalInput" />`. Remove the `helpText` from the `EuiFormRow` (no longer needed — the structured input is self-documenting). Remove the `inputRef={ref}` and `value={field.value ?? ''}` patterns that were specific to `EuiFieldText`. Keep the `EuiFormRow` with label "Repeat interval", `fullWidth`, `isInvalid`, and `error`.

### Phase 3: Test Updates ✓

Update integration tests that interact with the interval input.

- [x] **Update form-level tests for DurationInput interaction** — `x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/notification_policy_form.test.tsx`
  > *Done: All 7 existing tests pass without changes. `data-test-subj="throttleIntervalInput"` passes through `EuiFieldNumber` correctly.*
  The existing tests check `screen.getByTestId('throttleIntervalInput')` and `screen.queryByTestId('throttleIntervalInput')` to verify presence/absence of the interval input. These tests should still pass since `DurationInput` receives the same `data-test-subj="throttleIntervalInput"` prop, which `EuiFieldNumber` will render as `data-test-subj` on the root element. Verify: (1) run the existing test suite first — if tests pass without changes, no modifications needed. (2) If `getByTestId('throttleIntervalInput')` no longer matches (because `EuiFieldNumber` renders `data-test-subj` differently than `EuiFieldText`), update the test to query for the number input within the `throttleIntervalInput` container. The tests at lines 97-106 (per_status_interval shows interval) and 131-138 (digest shows interval) check only for presence, not for typing, so they should work with the new component as-is.

### Phase 4: Validation ✓

Run all checks to ensure correctness.

- [x] **Type-check the alerting_v2 plugin** — run `node scripts/type_check --project x-pack/platform/plugins/shared/alerting_v2/tsconfig.json`
  > *Done: All form-related files compile cleanly (pre-existing server-side errors only).*

- [x] **Run unit tests** — run `node scripts/jest x-pack/platform/plugins/shared/alerting_v2/public/components/notification_policy/form/`
  > *Done: 5 suites, 37 tests all pass (duration_input: 8, form_utils: 7, hook: 9, form: 7, matcher: 6).*

- [x] **Run change validation** — run `node scripts/check_changes.ts`
  > *Done: ESLint passed for 4 files. All pre-commit checks passed.*
