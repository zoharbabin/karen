import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../utils/config.js";

export const readConfigTool = {
  name: "read_config",
  description: "Returns the contents of a named non-secret config file from the server's config directory.",
  inputSchema: {
    type: "object",
    properties: {
      filename: { type: "string", description: "Config file name, relative to the config directory" },
    },
    required: ["filename"],
  },
};

interface ReadConfigArgs {
  filename: string;
}

// Real issue (path-traversal): `filename` is joined directly onto configDir
// with no check that the resolved path stays inside configDir — a caller can
// pass "../../etc/shadow" (or an absolute path) and read arbitrary files.
export function handleReadConfig(args: ReadConfigArgs): { content: Array<{ type: string; text: string }> } {
  const { configDir } = loadConfig();
  const target = path.join(configDir, args.filename);
  const text = fs.readFileSync(target, "utf8");
  return { content: [{ type: "text", text }] };
}
