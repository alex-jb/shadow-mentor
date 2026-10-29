# mcp-recorder 第三个工具族：保留未找到合格修复的筛选结果

2026 年 10 月 29 日，America/New_York。来源快照截至 17:44:17 UTC（纽约 13:44:17），不代表 10 月 29 日整日已结束。此轮只检索官方来源和阅读源码，没有安装或运行该工具，没有增加第三个工具族的执行案例。筛选不是预注册，仍只有两个工具族、三个已知历史缺陷的执行证据。

## 筛选范围与结果

按 [未来队列草案](../evidence-study-20261029b/study-plan.json) 的 2026-01-01 至 2026-10-29 范围，对 [devhelmhq/mcp-recorder](https://github.com/devhelmhq/mcp-recorder) 使用 `false pass`、`false positive`、`untestable`、`incomplete`、`coverage`、`verify`、`unchanged` 七个词，分别检索 issue 和 PR，共 14 个成功查询。初次未加类型限定的七次查询被 API 拒绝；错误及重试已保留。

为避免关键词遗漏后只挑成功案例，另外按创建时间阅读快照中完整 15 条 issue/PR 项目（14 个 PR、1 个普通 issue），并查看 7 个 release、31 个 main 历史 commit。每项集合第二页为空，成功查询均为 `incomplete_results=false`，没有检索时本轮所列集合的未取分页。不是对 forks、已删除记录、discussions 或所有未合并分支的完整调查，也不能代表当日稍后新增的记录。

审阅发现初版 JSON 的两条分页 URL 写错：字符串替换把 `per_page=100` 写成了 `per_page=200`。实际初次工具响应的 URL 是正确的 `per_page=100&page=2`；已重新发出两个正确请求并再次观察到空页。错误清单和校正记录已保留，未将错误的清单 URL 伪称为实际请求。

**合格的已公开修复验收／报告缺陷为 0；执行案例为 0。** 这个结果不证明工具没有缺陷，也不应换个项目后隐去此次排除。

| 重点候选 | 原始边界 | 本轮决定 |
| --- | --- | --- |
| [PR2](https://github.com/devhelmhq/mcp-recorder/pull/2) | 新增最初的 verifier | 新功能，不是历史缺陷修复 |
| [PR7](https://github.com/devhelmhq/mcp-recorder/pull/7) | 新增场景记录和 API | 没有已确认的漏检修复 |
| [PR8](https://github.com/devhelmhq/mcp-recorder/pull/8) | JSON 字符串结构比较及 ignore paths | 可研究格式等价／误报对照，不能当成假通过缺陷 |
| [PR9](https://github.com/devhelmhq/mcp-recorder/pull/9) | 新增 stdio，明确跳过 HTTP lifecycle | 范围／适用性对照提案，尚未执行，不算原生缺陷 |
| [PR10](https://github.com/devhelmhq/mcp-recorder/pull/10) | subprocess stream reader 从默认容量提高到 10 MB | 传输容量修复，没有已证实的静默接受结果；旧版运行表现未复现 |
| [PR11](https://github.com/devhelmhq/mcp-recorder/pull/11) | httpx 日志级别 | 日志问题，没有验收结果修复 |
| 其余项 | CI、依赖、资源、配置功能或格式互操作建议 | 全部排除理由和 ID 保留在 JSON |

[机器可读记录](./recorder-screening.json) 包含每个完整查询、页码、返回 ID、全部项目排除理由、release／commit 清单和相关 PR 的 base/head/merge SHA。筛选由一位编码代理完成，没有独立人工盲标。

## 一个可用但未执行的适用性对照

固定当前 main `44803e1cb47d7d4bb0b8dbd490550a3367eff674`。原始 [verifier.py 第 156–164 行](https://github.com/devhelmhq/mcp-recorder/blob/44803e1cb47d7d4bb0b8dbd490550a3367eff674/src/mcp_recorder/verifier.py#L156-L164) 在 transport 不支持 HTTP lifecycle 时，创建 `passed=True` 的 InteractionResult，并记录 `(lifecycle, skipped)`。PR9 正文明确这是 stdio 支持的预期行为。

因此可在后续研究中先声明消费者是否要求 HTTP lifecycle，再对同一 cassette 使用支持 HTTP 与不支持 HTTP 的 fake transport。stdio 自身无需实现 HTTP 行为，不能把合法跳过叫作协议违规；同时这条 `passed=True` 也不能证明 HTTP 要求已验证。

这是源码支持的控制提案，**没有运行结果**。现有 mcp-contracts 解释器只支持其自己的报告格式，不能直接推断它在 recorder 上会假通过；需要先声明新的格式适配器，才可做同信息比较。

## 下一步约束

保留此负向筛选结果。若扩展第三工具族，需要先记录队列修订与候选集合，再筛选；不能为补齐数字偷偷替换失败候选。本文档不增加缺陷数量、不提供留出结果，也不支持一般化安全保证。
