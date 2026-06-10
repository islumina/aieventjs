# aieventjs

[![npm version](https://img.shields.io/npm/v/aieventjs.svg)](https://www.npmjs.com/package/aieventjs)
[![CI](https://github.com/islumina/aieventjs/actions/workflows/ci.yml/badge.svg)](https://github.com/islumina/aieventjs/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)
[![AI Generated](https://img.shields.io/badge/AI_Generated-Claude_Code_Opus_4.7_Max-blueviolet.svg)](https://www.anthropic.com/claude-code)
[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md)

> 一個小而嚴格的 typed event emitter ── `on()` 回傳 unsubscribe function、內建 `once`、`AbortSignal` 一級公民、`dispose()` 冪等、保留 wildcard `*` handler。形似 mitt 的 API、但裡裡外外都是 ai\*js convention。

隸屬 [ai\*js micro-runtime 生態系](https://github.com/islumina) ─ 另見 [aifsmjs](https://github.com/islumina/aifsmjs)（FSM）、[aiecsjs](https://github.com/islumina/aiecsjs)（ECS）、[aibridgejs](https://github.com/islumina/aibridgejs)（cross-context RPC）、[aipooljs](https://github.com/islumina/aipooljs)（物件池）、[aiquadtreejs](https://github.com/islumina/aiquadtreejs)（空間分割）、[aiaudiojs](https://github.com/islumina/aiaudiojs)（Web Audio 薄殼）。

> **狀態：0.5.5。** 完整實作已上線、所有 method 皆可用。Coverage ≥ 95/90/100/100；~1050 B gzip（budget 1100 B）。

---

## 為什麼有 aieventjs

為什麼不直接用 `mitt`？老實說 `mitt` 對很多專案來說是正確選擇 ── MIT、~282 bytes gzip、API 本身造型很好。我們評估過之後選擇自寫。三個理由：

- **mitt 自 2023-07-04 起停止維護。** 社群最想要的 PR ── `on()` 回傳 unsubscribe、`AbortSignal`、`sideEffects: false`、nodenext 相容 ── 全部 open 但沒人處理。fork 等於我們扛一份「上面寫人家名字」的副本，且就算改進了上游也接不回去。
- **實作是 ~35 行純邏輯。** 那種尺寸沒有「fork 然後改良」這回事 ── 任何非 trivial 修改都等於重寫；繼承上游 copyright notice 的成本超過效益。
- **ai\*js convention 太多，硬塞進 mitt API 等於每個 method 都要改 signature。** `on()` 回傳 `void` vs 回傳 unsubscribe 是看得到的差異；strict TS（`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、不用 `!` non-null assertion）是看不到但每一行都會碰到的差異。

所以 `aieventjs` 就是 ai\*js 形狀的 event emitter：

- **`on()` 回傳 unsubscribe function。** 用「呼叫它就撤銷」的標準 idiom 清理 ── 不 close over 任何東西、handler 改名不會壞、直接餵進 `$effect()` / `onScopeDispose()` / `useEffect` cleanup 不需要儀式。
- **`AbortSignal` 用在每個合理的位置。** `on(type, handler, { signal })`，signal abort 即解綁。Pre-aborted 的 signal 永遠不註冊。整個 library 用 `fetch` 等 platform API 一樣的取消原語。
- **`dispose()` 冪等。** dispose 後 `on` / `emit` / `once` 拋 `EmitterDisposedError`。這是家族通用 convention；「看起來還活著但其實 no-op」的 emitter 是經典 leak 來源，我們拒絕出貨那種東西。
- **保留 wildcard `*`。** `bus.on("*", (type, payload) => ...)` 行為與 `mitt` 完全相同；wildcard handler 在 type-matched handler 之後觸發。~80 bytes gzip 成本，保留以讓 mitt 用戶遷移成本歸零。
- **`emit` 走訪前先 snapshot handler array。** Handler 內 unsubscribe 自己不會跳過下一個兄弟（mitt 自 2.x 就有，保留）。
- **Functional、可解構。** `const { on, emit } = bus` 可行 ── 任何地方都不抓 `this`。

明確**不做**的：不做 async event bus（handler 同步）、不做 namespaced bus（`user.*` 那種 wildcard 不在）、不做 priority queue、不做 transport。它就是 in-process 同步 fan-out 原語 ── 不多不少。

---

## Quick Start

```bash
pnpm add aieventjs
```

```typescript
import { createEmitter } from "aieventjs";

type Events = {
  "user:login":  { id: string };
  "user:logout": void;
  "score:tick":  { delta: number };
};

const bus = createEmitter<Events>();

// 1. 訂閱；拿到 unsubscribe handle。
const off = bus.on("user:login", (u) => console.log("hi", u.id));

// 2. 或接到 AbortSignal 走 framework 原生 cleanup。
const ctrl = new AbortController();
bus.on("score:tick", (e) => render(e.delta), { signal: ctrl.signal });

// 3. Wildcard 收 (type, payload) ── 在 type-matched handler 之後觸發。
bus.on("*", (type, payload) => trace(type, payload));

// 4. 派送。
bus.emit("user:login", { id: "alice" });

// 5. 拆除。
off();
ctrl.abort();
bus.dispose(); // 冪等；dispose 後再呼叫拋 EmitterDisposedError
```

`createEmitter()` 回傳的 method 不抓 `this` ── `const { on, emit } = bus` 解構沒問題。

> **event map 要用 `type` 宣告、不要用 `interface`。** `Events` generic 受限於 `Record<string, unknown>`。**純** TypeScript `interface` 沒有隱含的 index signature，傳進去會違反 constraint、報 *"Index signature for type 'string' is missing in type ..."*；`type` 物件字面值則在結構上滿足它。（加了顯式 index signature、或 `extends Record<string, unknown>` 的 `interface` 也能通過，但會把 `keyof Events` 擴成 `string`、失去嚴格的事件名稱檢查，故建議用 `type`。）
>
> ```typescript
> // ❌ interface ── 違反 Record<string, unknown> constraint（TS2344）
> interface Events { "user:login": { id: string } }
> const bus = createEmitter<Events>();
>
> // ✅ type ── 滿足 constraint
> type Events = { "user:login": { id: string } };
> const bus = createEmitter<Events>();
> ```

---

## 能做 / 不做

| 會做（v1）                                                 | 不會做                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| Typed `createEmitter<Events>()`                            | 無型別字串 key bus（型別本身就是賣點）                 |
| `on()` 回傳 unsubscribe function                           | Async / promise-returning handler（同步 only）         |
| `once(type, handler)` + `on(..., { once: true })`          | Namespaced wildcard（`"user.*"`）── 不在範圍          |
| `on(..., { signal })` ── `AbortSignal` cleanup            | Priority / weight / ordering 提示                     |
| Wildcard `"*"` handler ── `(type, payload)`               | Cross-context transport（去用 `aibridgejs`）           |
| `dispose()` 冪等；dispose 後呼叫拋錯                       | Error-event 特殊處理（Node EventEmitter 風格不做）     |
| `emit` 走訪前 snapshot handler array（reentrant 安全）     | 持久化 / replay（不是它的工作）                       |
| Method 可解構（`const { on, emit } = bus`）                | 零配置 `emit`（每次派送需 snapshot，re-entrancy 安全所需）|
| `on('*', fn, { sampleRate })` ── 機率性派送（wildcard only）| |
| `on(type, fn, { throttleMs })` ── per-handler leading-edge throttle，typed **與** wildcard 皆可（如每幀觸發的 `credits/change` HUD 事件）| |
| `createEmitter({ captureHandlerErrors })` ── opt-in 錯誤策略；`OnOptions.captureErrors` 個別 handler 覆蓋 | |

---

## API 草稿

```typescript
type EventHandler<P> = (payload: P) => void;

type WildcardHandler<Events extends Record<string, unknown>> =
  <K extends keyof Events>(type: K, payload: Events[K]) => void;

interface OnOptions {
  signal?: AbortSignal;
  once?: boolean;
  captureErrors?: boolean | ((err: unknown, type: string, payload: unknown) => void); // 僅限 typed handler
  sampleRate?: number;  // wildcard "*" only — 機率 (0, 1]
  throttleMs?: number;  // typed 或 wildcard — per-handler leading-edge throttle，使用 Date.now()
                        // 注意：Date.now() 非單調時鐘；系統時鐘往回跳時，handler 會被靜默
                        // mute 直到 wall time 再次超過紀錄的時間戳。切換 performance.now()
                        // 延至下個 minor。（EVT-R-02）
}

interface EmitterOptions {
  // 預設錯誤策略。undefined/false（預設）：第一個拋錯即中斷派送。
  // true：吞掉錯誤並繼續走完所有 handler。
  // (err, type, payload) => void：每個拋錯的 handler 呼叫一次 callback（若此 callback 自身拋錯，會被靜默忽略並繼續派送）。
  // OnOptions.captureErrors 可覆蓋個別 handler 的策略。
  captureHandlerErrors?: boolean | ((err: unknown, type: string, payload: unknown) => void);
}

interface Emitter<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>, opts?: OnOptions): () => void;
  on(type: "*", handler: WildcardHandler<Events>, opts?: OnOptions): () => void;
  once<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void;
  // 注意：once() 只接受 typed 事件 key。wildcard-once 請改用
  // on("*", handler, { once: true })——handler 收 (type, payload)
  // 而非 (payload)。型別層修正延至下個 minor。（EVT-B-02）
  off<K extends keyof Events>(type: K, handler?: EventHandler<Events[K]>): void;
  off(type: "*", handler?: WildcardHandler<Events>): void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  clear(): void;
  dispose(): void;
  readonly disposed: boolean;
}

class EmitterError extends Error {}
class EmitterDisposedError extends Error {}

function createEmitter<Events extends Record<string, unknown> = Record<string, unknown>>(
  opts?: EmitterOptions,
): Emitter<Events>;
```

完整 JSDoc 在 [`src/index.ts`](src/index.ts)。

---

## Roadmap

| 版本       | 加入內容                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **0.0.1**  | Scaffold 落地 ── 凍結 API surface 為 `throw` stub；完整配置 + CI 跑得起來。                                                              |
| **0.1.0**  | 第一個 npm release。`on` / `once` / `off` / `emit` / `clear` / `dispose` 實作完；coverage ≥ 95/90/100/100；≤ 800 B gzip（strict-TS 額外負擔實測落在 ~747 B）。 |
| **0.3.0**  | `captureHandlerErrors` + wildcard sampling/throttling。v0.2 編號跳過以配合四套件 v0.3 同步釋出。                                          |
| **0.4.0**  | 相依整理 + 穩定凍結：移除未使用的 `tsx`、`fast-check` 對齊 `^4.8.0`、凍結 0.3.x 公開 API surface。無 runtime API 異動；bundle 與 0.3.1 完全相同。 |
| **0.6+**   | Async handler 追蹤（草案）── 詳見 [STABILITY.md](STABILITY.md)。                                                                        |

---

## License

[MIT](LICENSE)。
