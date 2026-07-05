# chat-widget

Embeddable chat widget SDK. Loads via `<script src>` or `npm install`
directly into a customer's page — there is no sandbox, so every release
follows the instance-isolation pattern documented below.

## Quick start (CDN)

```html
<script src="https://cdn.example.com/chat-widget@2.3.1/widget.js"></script>
<script>
  const widget = new ChatWidget({ container: '#chat-widget-root' });
</script>
```

## Quick start (npm)

```bash
npm install @example/chat-widget
```

```js
import { ChatWidget } from '@example/chat-widget';

const widget = new ChatWidget({ container: '#chat-widget-root' });
// All state held internally. Nothing outside #chat-widget-root is touched.

widget.destroy();
// Every listener removed. Every timer cleared. Every reference nulled.
// Page is identical to pre-instantiation state.
```

## Microphone (voice input)

Voice input is optional and disabled by default. Enabling it requires the
customer page to grant `Permissions-Policy: microphone=(self)` — see
[Permissions](#permissions) below.

```js
const widget = new ChatWidget({
  container: '#chat-widget-root',
  enableMicrophone: true,
});
```

## Permissions

| Capability | Minimum required policy |
|---|---|
| `microphone` | `Permissions-Policy: microphone=(self)` |

The widget never requires `unsafe-eval` or `unsafe-inline` in `script-src`,
and never requires a wildcard in any CSP directive.

## Supported versions

Only the latest published version on the CDN and npm receives security
fixes. See [SECURITY.md](./SECURITY.md).
