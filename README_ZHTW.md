# aieventjs

小而嚴格的 typed event emitter，具備 ai*js lifecycle 慣例：`on()` 回傳 unsubscribe、內建 `once`、支援 `AbortSignal`、wildcard handlers，以及可重複呼叫的 `dispose()`。

> **狀態：0.5.9 - 穩定 1.0 軌道 API。** root entry 是公開 API。

## 安裝

```bash
pnpm add aieventjs
```

```ts
import { createEmitter } from "aieventjs";
```

## 快速開始

```ts
type Events = {
  "score/change": { value: number };
  "scene/end": void;
};

const events = createEmitter<Events>();

const off = events.on("score/change", ({ value }) => {
  console.log(value);
});

events.on("*", (type, payload) => console.log(type, payload), { sampleRate: 0.1 });
events.emit("score/change", { value: 10 });
off();
events.dispose();
```

## 核心 API

- `createEmitter<Events>(options?)` 建立 typed emitter。
- `on(type, handler, options?)` 訂閱並回傳 unsubscribe。
- `on("*", wildcard, options?)` 訂閱所有事件，且在 typed handlers 之後呼叫。
- `once(type, handler)` 是 typed one-shot handler 的 shorthand。
- `off(type, handler?)`、`clear()`、`dispose()` 用不同 scope 移除 handlers。
- `emit(type, payload)` 同步 dispatch，且會先 snapshot handler list。
- Options：`signal`、`once`、`captureErrors`、wildcard-only `sampleRate`、typed/wildcard `throttleMs`。

## 注意事項

- 預設錯誤策略與 mitt 類似：第一個 throw 的 handler 會中止 dispatch。可用 `captureHandlerErrors` 或單一 handler 的 `captureErrors` 改成吞掉/回報後繼續。
- Wildcard handler 收到 `(type, payload)`，不是只有 payload。
- wildcard once 請用 `on("*", handler, { once: true })`。`once("*")` 不屬於 typed public overload。
- `throttleMs` 使用 `Date.now()`。若系統時間往回跳，throttled handler 可能靜默到 wall time 追上為止。
- `sampleRate` 只支援 wildcard，且每次 dispatch 以 `Math.random()` 取樣。
- `dispose()` 是永久 teardown；dispose 後多數 API 會丟 `EmitterDisposedError`，cleanup 類呼叫則維持 no-op。

## AI Context

- 短索引：[`llms.txt`](llms.txt)
- 完整生成內容：[`llms-full.txt`](llms-full.txt)
- 穩定度契約：[`STABILITY.md`](STABILITY.md)
- 目前 review backlog：[`REVIEW.md`](REVIEW.md)
- 版本紀錄：[`CHANGELOG.md`](CHANGELOG.md)

## License

MIT
