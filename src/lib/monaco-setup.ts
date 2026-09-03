import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "monaco-editor/esm/vs/basic-languages/r/r";

// 本地托管 monaco：不从 CDN 拉取引擎（离线/内网可用）
loader.config({ monaco });

export { monaco };