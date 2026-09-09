# schema/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- Schema 读取必须限定 connectionId；扫描失败返回可操作错误。
- 返回字段与 `SchemaData` 保持同步。
