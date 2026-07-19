# Pump UI

Real-time web interface for monitoring and controlling a water pump over WebSocket.

It streams device telemetry, visualizes metrics, and lets the operator change device
configuration and toggle the motor with validation, timeouts, and connection-state handling.

This README is written for **backend/firmware developers and AI agents** who need to
implement or reason about the device side of the protocol. It documents every wire
message, the config-parameter schema, and exactly how each parameter is rendered as a
UI control.

---

## Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Transport & Connection Lifecycle](#transport--connection-lifecycle)
- [Message Protocol](#message-protocol)
  - [Envelope](#envelope)
  - [Client → Server messages](#client--server-messages-deviceclientmessage)
  - [Server → Client messages](#server--client-messages-deviceservermessage)
  - [Shared payload shapes](#shared-payload-shapes)
- [Config Parameter Schema](#config-parameter-schema)
  - [The `DeviceConfigParam` object](#the-deviceconfigparam-object)
  - [Values, multipliers & booleans](#values-multipliers--booleans)
  - [Config read/write flow](#config-readwrite-flow)
- [Parameter → UI Control Mapping](#parameter--ui-control-mapping)
- [Internationalization of labels](#internationalization-of-labels)
- [Timing & Tunables](#timing--tunables)
- [Mock Device Server](#mock-device-server)
- [License](#license)

---

## Tech Stack

- SvelteKit + Svelte 5 (runes)
- TypeScript
- Tailwind CSS + Flowbite Svelte
- WebSocket transport (JSON messages)
- Paraglide (inlang) for i18n

## Getting Started

Install dependencies:

```bash
npm install
```

Run the dev server (talks to a **real device** at `ws://<host>:81`):

```bash
npm run dev
```

Run the dev server against the **in-browser mock device** (no hardware needed):

```bash
NEARBY_MOCKS=true npm run dev
```

Build / preview a static production bundle:

```bash
npm run build
npm run preview
```

Type-check, lint, format:

```bash
npm run check
npm run lint
npm run format
```

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/lib/device/device.svelte.ts` | Singleton device client + reactive `deviceState`; computes the WS URL. |
| `src/lib/device/device-client.svelte.ts` | Stateful device client: wires the socket, polls telemetry, tracks staleness, and drives the update lifecycle. |
| `src/lib/device/types.ts` | **Source of truth** for all wire types (messages, config params, telemetry). |
| `src/lib/device/validations.ts` | Runtime validation of every incoming server message (networks lie). |
| `src/lib/device/utils.ts` | Label/description lookup and multiplier→decimals helpers. |
| `src/lib/device/DeviceControl*.svelte` | Renders each config param as an editable control. |
| `src/lib/socket/connector.ts` | Reusable transport: reconnect + backoff, heartbeat, send queue. |
| `src/lib/socket/adapter.ts` | Thin `WebSocket` wrapper (swapped for a mock in dev). |
| `src/lib/device/device-server.dev-mock.ts` | Simulated device: answers every command and mutates telemetry. |

## Transport & Connection Lifecycle

- **Endpoint:** `ws://<host>:81` (or `wss://` when the page is served over HTTPS). See
  `getWsUrl()` in `device.svelte.ts`.
- **Encoding:** every frame is a single JSON object. All messages carry a `cmd` string.
- **Heartbeat:** the client sends `{ "cmd": "ping" }` and expects `{ "cmd": "pong" }`.
  The pong is consumed by the transport layer and never surfaces to app logic. If no pong
  arrives within the heartbeat timeout, the socket is closed and reconnect kicks in.
- **Reconnect:** automatic, with exponential backoff + jitter.
- **Send queue:** while disconnected, most commands are queued and flushed on reconnect
  (telemetry polls are sent with queueing disabled so they don't pile up).

On every (re)connect the client immediately sends, in order:

1. `{ "cmd": "pump:info" }`
2. `{ "cmd": "pump:config_list" }`
3. `{ "cmd": "pump:monitor" }` (then keeps polling on an interval)

A device implementation should be ready to answer all three right after the socket opens.

## Message Protocol

### Envelope

Every message is a JSON object with a `cmd` discriminator and an optional `data` payload:

```jsonc
{ "cmd": "<string>", "data": <payload | omitted> }
```

Incoming messages are validated at runtime (`validateDeviceServerMessage`). Invalid or
unknown messages are rejected and reported as errors.

### Client → Server messages ([`DeviceClientMessage`](src/lib/device/types.ts))

| `cmd` | `data` | Purpose | Expected reply |
| --- | --- | --- | --- |
| `ping` | — | Transport liveness check (heartbeat). | `pong` |
| `pump:info` | — | Request static device identity/firmware. | `pump:info` |
| `pump:monitor` | — | Request a fresh telemetry snapshot. | `pump:monitor` |
| `pump:config_list` | — | Request the list of available config params (names only). | `pump:config_list` |
| `pump:config_get` | `{ name: string }[]` | Read the current value + metadata of one or more params. Client sends **one name per message**. | `pump:config_get` |
| `pump:config_set` | `{ name: string, value: number \| string }[]` | Write one or more params. | `pump:config_set` |
| `pump:toggle` | — | Toggle the motor on/off. | `pump:toggle` |

Examples:

```json
{ "cmd": "pump:config_get", "data": [{ "name": "NUMBER_RANGE" }] }
```

```json
{ "cmd": "pump:config_set", "data": [{ "name": "NUMBER_RANGE", "value": 40 }] }
```

### Server → Client messages ([`DeviceServerMessage`](src/lib/device/types.ts))

| `cmd` | `data` | Purpose |
| --- | --- | --- |
| `pong` | — | Heartbeat reply (data-less). |
| `pump:info` | `DeviceRemoteInfo` | Device identity + firmware versions. |
| `pump:monitor` | `DeviceRemoteMonitor` | Telemetry snapshot: metrics + status + error. |
| `pump:config_list` | `DeviceConfigParam[]` | Available params. **Names only** — no `value`; metadata optional. |
| `pump:config_get` | `DeviceConfigParam[]` | Full param objects **with `value`** and metadata. |
| `pump:config_set` | `string[]` (+ optional root `error`) | Ack: names of the params that were actually applied. On failure, include a root-level `error` string. |
| `pump:toggle` | `{ motor_current_state: number }` (+ optional root `error`) | New motor state after toggle (0/1). On failure, include a root-level `error` string. |
| `error` | `DeviceRemoteError` | Unsolicited/unexpected error report (`{ message, code }`), not tied to a specific request. |

> Notes for device authors:
> - `pump:config_set` returns **only names**, not values. The client then re-reads those
>   names via `pump:config_get` to confirm the applied values.
> - `pump:config_list` should return objects shaped `{ name }`; the rich metadata
>   (`label`, `type`, `measure`, `multiplier`, `options`, `value`) is delivered later via
>   `pump:config_get`.
> - `pump:toggle` replies with the fresh `motor_current_state` so the UI can reflect it
>   without waiting for the next telemetry poll.
> - **Command failures:** `pump:config_set` and `pump:toggle` may carry a **root-level
>   `error` string** (alongside or instead of their normal `data`). When present, the
>   client fails the in-flight update immediately (instead of waiting for the update
>   timeout) and shows the message briefly (`DEVICE_ERROR_DISPLAY_MS`, ~5s) before it
>   auto-clears — it does **not** treat the command as successful.
> - The standalone **`error`** command is for asynchronous/unexpected problems that are
>   not the response to any request; the client simply displays its `message` transiently.
> - Don't confuse either of the above with the `error` field **inside** a `pump:monitor`
>   snapshot (`DeviceRemoteError`), which reports the device's ongoing operating-error
>   state (e.g. `OVER_VOLT`) and is shown persistently until it clears.

### Shared payload shapes

All wire types are defined in [`src/lib/device/types.ts`](src/lib/device/types.ts) — treat
it as the source of truth:

| Type | Used by | Key fields |
| --- | --- | --- |
| [`DeviceRemoteInfo`](src/lib/device/types.ts) | `pump:info` | `name`, `firmware_hw`, `firmware_sw`, `type` |
| [`DeviceRemoteMonitor`](src/lib/device/types.ts) | `pump:monitor` | `metrics`, `status`, `error` |
| [`DeviceRemoteMonitorMetrics`](src/lib/device/types.ts) | `pump:monitor` | `voltage`, `current`, `frequency`, `pressure`, `temperature`, `flow` |
| [`DeviceRemoteMonitorStatus`](src/lib/device/types.ts) | `pump:monitor` | `DryWorkStop`, `PressureStop`, `temp_stop`, `user_stop`, `motor_current_state` (0/1) |
| [`DeviceRemoteError`](src/lib/device/types.ts) | `pump:monitor`, `error` | `message` (e.g. `NO_ERROR`, `OVER_VOLT`, `HIGH_PRESSURE`, `HIGH_TEMP`), `code` (0 = no error) |

> The exact field names (including the mixed casing of `DryWorkStop`, `PressureStop` vs
> `temp_stop`, `user_stop`) are the **wire contract** and must match the device output
> byte-for-byte.

## Config Parameter Schema

Configuration is a flat list of named parameters. The UI knows nothing about specific
parameters up front — it discovers them from `pump:config_list`, reads each value with
`pump:config_get`, and renders an appropriate control based purely on the parameter's
metadata (see [Parameter → UI Control Mapping](#parameter--ui-control-mapping)).

### The `DeviceConfigParam` object

Defined as `DeviceConfigParam` in [`src/lib/device/types.ts`](src/lib/device/types.ts).
Every field except `name` is optional; missing metadata degrades gracefully (e.g. a number
with no `options` becomes a plain number input):

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Stable identifier / key (required). |
| `value` | `number \| string` | Absent in `config_list`; present in `config_get`. |
| `label` | `string` | Device-provided display label. |
| `type` | `'number' \| 'text'` | Value kind (inferred from `value` when absent). |
| `measure` | `string` | Unit suffix shown in UI, e.g. `"A"`, `"atm"`, `"°C"`. |
| `multiplier` | `number` | Integer scaling factor (see below). |
| `options.min` | `number` | Numeric min **or** text `minlength`. |
| `options.max` | `number` | Numeric max **or** text `maxlength`. |
| `options.step` | `number` | Numeric step (raw units). |
| `options.items` | `{ id: number; value: string }[]` | Enumerated choices. |

### Values, multipliers & booleans

- **`value` is always a `number` or a `string`.** There is **no boolean type on the
  wire** — booleans are encoded as the numbers `0` and `1`.
- **`multiplier`** lets the device store fixed-point values as integers while the UI shows
  human units. `value`, `min`, `max`, and `step` are all stored **pre-scaled (raw)**.
  - UI value shown = `raw / multiplier`
  - Value sent back on save = `round(humanValue * multiplier)`
  - Decimal places shown = powers of ten map cleanly: `10 → 1`, `100 → 2`, `1000 → 3`.
  - Example: `multiplier: 10`, raw `value: 30`, `measure: "atm"` → UI shows `3.0 atm`;
    saving `4.5 atm` sends raw `45`.
- **Enumerated params** (`options.items`) store the **option `id`** as the value when
  `type: 'number'`, or the **option `value` string** when `type: 'text'`.

### Config read/write flow

```
Client                                  Device
  |-- pump:config_list --------------->  |
  |<-- pump:config_list [{name}, ...] --|
  |                                      |
  |-- pump:config_get [{name:A}] ------> |   (one message per name)
  |<-- pump:config_get [{name:A,value,...metadata}]
  |-- pump:config_get [{name:B}] ------> |
  |<-- pump:config_get [{name:B,...}] --|
  |                                      |
  |-- pump:config_set [{name:A,value}]-> |
  |<-- pump:config_set ["A"] -----------|   (names acked)
  |-- pump:config_get [{name:A}] ------> |   (client re-reads to confirm)
  |<-- pump:config_get [{name:A,value}]-|
```

## Parameter → UI Control Mapping

`DeviceControlFieldEditor.svelte` picks exactly one control per parameter. Rules are
evaluated **top to bottom; the first match wins**:

| # | Condition | Rendered control | Value semantics |
| --- | --- | --- | --- |
| 1 | `options.items.length > 1` | **Select / dropdown** | Stores option `id` (if `type: 'number'`) or option `value` string (if `type: 'text'`). |
| 2 | `options.items.length === 1` | **Read-only input** (disabled) | Displays the single option's `value`; not editable. |
| 3 | `type === 'text'` | **Text input** | `options.min`/`options.max` act as `minlength`/`maxlength`. |
| 4 | `type === 'number'` and `options.min === 0` and `options.max === 1` | **Toggle switch** | Boolean encoded as `0`/`1`. Checked before range on purpose. |
| 5 | `type === 'number'` and `min`, `max`, `step` **all** set | **Range slider** | Operates in human units (`raw / multiplier`); scaled back on save. |
| 6 | otherwise (numeric) | **Number input** | Uses `min`/`max`/`step` if present; unbounded otherwise. |

Notes:

- The value type is `param.type`, falling back to `typeof param.value` when `type` is
  absent.
- A `step` **without** both `min` and `max` falls back to a plain number input (rule 6),
  not a slider.
- Number inputs and range sliders both apply the `multiplier` scaling; selects, toggles,
  text, and read-only controls do not.
- The **motor toggle** (Switch ON/OFF) is a separate control driven by `pump:toggle` and
  `status.motor_current_state`, not by a config parameter.

The dev mock (`device-server.dev-mock.ts`) intentionally defines one parameter for each
branch above (`NUMBER_DROPDOWN_3`, `TEXT_DROPDOWN_3`, `READONLY_SINGLE`, `TEXT_INPUT`,
`TOGGLE_BOOL`, `NUMBER_RANGE`, `NUMBER_RANGE_X10`, `NUMBER_BOUNDED`, `NUMBER_UNBOUNDED`,
`NUMBER_STEP_FALLBACK`, …) — it is the best reference for concrete, valid param shapes.

## Internationalization of labels

Labels and descriptions can be localized without any device changes:

- **Label** resolution order: i18n key `field_label__<name>` → `param.label` → `param.name`.
- **Description** (helper text): i18n key `field_desc__<name>` (params carry no description
  field of their own).

Message catalogs live in `messages/*.json`. Example:

```json
{
  "field_label__NUMBER_RANGE": "Number range [i18n label]",
  "field_desc__NUMBER_RANGE": "[i18n description]"
}
```

## Timing & Tunables

Device client (`src/lib/device/config.ts`):

| Constant | Default | Meaning |
| --- | --- | --- |
| `DEVICE_DEFAULT_TELEMETRY_POLL_INTERVAL_MS` | `2000` | How often `pump:monitor` is polled. |
| `DEVICE_DEFAULT_STALE_DATA_AFTER_MS` | `5000` | Telemetry older than this marks state `stale`. |
| `DEVICE_STALE_CHECK_INTERVAL_MS` | `1000` | How often staleness is re-evaluated. |
| `DEVICE_DEFAULT_UPDATE_TIMEOUT_MS` | `5000` | How long an `update()` waits for its ack before failing. |
| `DEVICE_ERROR_DISPLAY_MS` | `5000` | How long a one-off/transient error message is shown before auto-clearing. |

Transport (`src/lib/socket/config.ts`):

| Constant | Default | Meaning |
| --- | --- | --- |
| `SOCKET_DEFAULT_CONNECTION_TIMEOUT_MS` | `8000` | Max time in `CONNECTING` before failing the attempt. |
| `SOCKET_DEFAULT_RECONNECTION_INITIAL_DELAY_MS` | `1000` | First reconnect delay. |
| `SOCKET_DEFAULT_RECONNECTION_MAX_DELAY_MS` | `15000` | Reconnect delay cap. |
| `SOCKET_DEFAULT_RECONNECTION_BACKOFF_MULTIPLIER` | `1.8` | Backoff growth factor. |
| `SOCKET_CONNECTION_HEARTBEAT_INTERVAL_MS` | `2000` | Ping cadence. |
| `SOCKET_CONNECTION_HEARTBEAT_TIMEOUT_MS` | `6000` | No-pong window before the socket is closed. |
| `SOCKET_COMMANDS_QUEUE_MAX_SIZE` | `100` | Max queued outgoing messages while disconnected. |

> The device client overrides a few reconnect/heartbeat values when constructing the
> connector (see `device-client.svelte.ts`).

## Mock Device Server

A full in-browser device simulator lets you develop without hardware. Enable it with:

```bash
NEARBY_MOCKS=true npm run dev
```

How it works:

- `vite.nearby-mock.ts` is a dev-only Vite plugin. When `NEARBY_MOCKS=true`, any import of
  `foo.ts` is transparently redirected to a sibling `foo.mock.ts` if one exists.
- This swaps `src/lib/socket/adapter.ts` for `src/lib/socket/adapter.mock.ts`, which
  fulfills the same `SocketAdapter` interface but routes messages to
  `createMockDeviceServer()` instead of a real socket.
- The mock server (`device-server.dev-mock.ts`) answers every command, mutates telemetry
  on each `pump:monitor` tick (drifting voltage/current/pressure/temperature and raising
  `OVER_VOLT` / `HIGH_PRESSURE` / `HIGH_TEMP` errors), and persists `config_set` writes in
  memory. The mock adapter also simulates a connect delay and per-request latency.

To model a new device parameter or behavior, edit the `config` map and `handle()` switch
in `device-server.dev-mock.ts`.

## License

WTFPL
