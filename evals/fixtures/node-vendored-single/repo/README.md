# scaffold-kit

Node/TypeScript SDK for fetching and rendering codegen scaffolding templates
from a private template registry. Used by internal CLI tools to pull a
template bundle and render it into a target project.

## Install

```bash
npm install @example/scaffold-kit
```

## Usage

```ts
import { RegistryClient } from "@example/scaffold-kit";

const client = new RegistryClient({ apiKey: process.env.SCAFFOLD_API_KEY });
const bundle = await client.fetchTemplate("react-service");
```

## Third-party code

See `THIRD_PARTY.md` for vendored code provenance.

## Testing

```bash
npm test
```
