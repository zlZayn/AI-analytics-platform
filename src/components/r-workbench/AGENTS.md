# r-workbench/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- R 数据只从 `session.result` 单向注入；不得回写 AnalysisSession。
- WebR 初始化、错误和取消状态必须可见，且保持单例边界。
