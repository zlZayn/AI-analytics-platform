# scripts/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

scripts/ 特有约束：
- `seed.py` 只接受 `SEED_DATABASE_URL`，禁止回退应用 `DATABASE_URL`（防误写生产库）
- 烟测/E2E 脚本必须可离线运行，不得写死真实凭据或盘符路径
- 不写"有什么文件/怎么改"，那是 [README.md](README.md) 的职责