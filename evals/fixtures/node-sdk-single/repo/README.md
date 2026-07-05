# teaching-avatar-sdk

Browser SDK for an AI teaching avatar. Used by edtech customers to embed
a conversational avatar directly into their own lesson pages.

## Install

```html
<script
  src="https://cdn.example-avatar.com/sdk/v1.4.0/sdk.js"
  integrity="sha384-QWERTYUIOPASDFGHJKLZXCVBNM1234567890abcdefghijklmno=="
  crossorigin="anonymous"
></script>
```

Or via npm:

```bash
npm install @example/teaching-avatar-sdk
```

## Usage

```ts karen:runnable
import { TeachingAvatarSDK } from '@example/teaching-avatar-sdk';

const avatar = new TeachingAvatarSDK({ container: '#lesson-avatar' });
avatar.reflow();
avatar.destroy();
```

## Microphone access

Lessons that use voice commands need `enableMicrophone: true`. The host
page must grant `Permissions-Policy: microphone=(self)` for this to work.

## Support

See [SECURITY.md](./SECURITY.md) for the vulnerability disclosure process.
