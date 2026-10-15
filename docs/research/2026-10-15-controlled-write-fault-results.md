# Controlled write fault verification results

2026 年 10 月 15 日。对现有 Shadow 本地写入器进行了故障复现、修复与回归验证；未新增预测模型、业务工单系统或比赛专用实现。

## 两项修复

| 情况 | 修复前观察 | 修复后行为 |
| --- | --- | --- |
| 重新签名的矛盾事件顺序 | 展示失败缺少原始返回、展示失败或读回事件先于原始返回，仍可能被标为 CONSISTENT；其中提前展示失败后跟读回的记录还可显示 LOCAL_READBACK_MATCH | 展示结果与失败必须依赖唯一、更早的 RAW_RETURN；读回结果与失败必须在 RAW_RETURN 及已记录的展示步骤之后，否则 capture_shape 为 INCONSISTENT，效果与返回关系为 NOT_EVALUATED |
| 写入后目标变为管道或过大文件 | 普通只读 open 在 FIFO 上可能一直阻塞；原有 readFileSync 没有读回字节上限 | 非阻塞打开，先确认普通文件；最多读 65,537 字节以检测超出 65,536 字节上限，并比较读取前后的大小与修改时间。无法取得稳定有界观察时记录 READBACK_UNAVAILABLE，效果为 UNCONFIRMED |

顺序反例由测试持有者重新签名，用来检查复核器是否把签名完整性与事件语义一致性混淆。它不代表陌生攻击者可以伪造受信任签名。读回仍是可信主机范围内的最佳努力观察，双 stat 也不构成原子快照或独立效果证明。

## 保留的失败语义

在隔离 Node 子进程中，只对目标文件描述符的 fsync 注入 EIO：文件实际已经存在且内容完整，但工具原始返回为 FAILED，复核效果保持 UNCONFIRMED。同一 grant 的再次尝试被 GRANT_ALREADY_CONSUMED 阻止，首次 capture JSONL 仍有封存记录。

因此，FAILED 表示工具报告错误，不能据此推断没有发生副作用，也不能直接复用许可重试。此回归不改变现有写入与许可行为。

## 验证范围

相关回归共 **104 项通过，0 失败，0 跳过**。其中本轮新增十项：六项事件顺序或依赖检查、超限增长、空内容与满 65,536 字节边界、同步错误及 FIFO 故障。故障注入在独立子进程进行，不向生产库添加测试钩子；FIFO 子进程设三秒超时以防测试自身挂起。

六份此前使用公开行情生成的真实本地研究收据，在修复后的复核器中仍为 CONSISTENT、GRANT_MATCH、LOCAL_READBACK_MATCH。完整浏览器交互、移动布局及真实模型/提供方接入未在本轮验收。

复现命令：

```bash
node --test test/research-cockpit.test.js test/controlled-execution-evidence.test.js test/controlled-write-failure-observations.test.js test/session-api.test.js test/session-crash-recovery.test.js test/attest-core-contract.test.js test/adapter-claude-code-permissions.test.js
```

FIFO 回归使用 POSIX `mkfifo` 命令。本次验证环境为 Linux、Node 24.19.0；没有宣称已验证所有受支持运行环境。

这是现有本地写入器的窄范围验证。[64 例跨领域方案](./2026-10-15-effect-verification-protocol.md)仍为未执行的设计提案；不能把这 104 项相关回归称作该方案的结果，也不能据此报告模型能力或通用安全率。
