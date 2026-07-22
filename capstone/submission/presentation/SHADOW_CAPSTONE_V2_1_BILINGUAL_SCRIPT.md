# Shadow · Capstone I — 双语演讲稿 / Bilingual Speaking Script (V2.1)

对齐 `SHADOW_CAPSTONE_PRACTICE_PRESENTATION_V2_1.pptx`(16 页 = 12 主 + 4 备用)。数字用最新核实的:**1,892 / 1,895 通过,3 skip,0 fail**。篡改 demo 用 **sequence 3**。目标 ~8:30 讲完 + 问答。

> 口语版,尽量说人话。每页先 **EN**(上台直接念),后 **中文**(一样的意思)。选一种主讲,另一种当对照。

---

## Slide 1 — Title · 0:00–0:30

**EN:** Hi, I'm Alex. My project is called Shadow. Here's the simple version: an AI helps make a decision, and Shadow turns that into a piece of evidence that someone else can check on their own. The picture on the right is real — it's the system showing the steps of a decision in 3D. And the short story of the project is this: I started out building AI that gives you *answers*, and I moved to building AI that gives you *proof you can check*.

**中文:** 大家好,我是 Alex。我的项目叫 Shadow。说得简单点:AI 帮你做了个决定,Shadow 就把这个决定变成一份别人能自己去核对的证据。右边这张图是真的,是系统把一个决定的每一步用 3D 画出来。这个项目的故事其实一句话:我一开始做的是"给你答案"的 AI,后来改成做"给你能核对的证据"的 AI。

---

## Slide 2 — The trust gap · 0:30–1:20

**EN:** This is the problem I'm solving. When an AI gives you an answer, the answer is not proof of how it got there. Say you're the person who has to sign off on it. You need four things the answer doesn't give you: what did it look at, what did it actually do, did anyone change the record later, and can *you* check it yourself. A normal log won't do — you can edit it, and it only lives on one system. And when the AI explains itself, that's just more text it wrote — it can sound right and still be wrong.

**中文:** 这就是我要解决的问题。AI 给你一个答案,但这个答案不等于"它怎么得出来的"证据。假设你是那个要签字负责的人,你需要四样答案给不了你的东西:它看了什么、它到底做了什么、这份记录后来有没有被人改过、还有你自己能不能核对。普通日志不行——能改,而且只存在一台机器上。至于 AI 自己写的"解释",那也就是它又写的一段话——听着对,其实可能是错的。

---

## Slide 3 — Project evolution · 1:20–2:00

**EN:** A little bit of history, because it always comes up. This started as Orallexa — a few AI voices, like a bull and a bear and a judge, arguing about a question. It worked. But it taught me the real lesson: more opinions don't give you more trust. A bunch of AI voices can sound really convincing and you *still* can't check what they were based on. So Shadow keeps that analysis as just one feature, and puts trust one layer lower — on the evidence underneath, not the voices on top. Same question, sharper. Not a failure.

**中文:** 讲点来历,因为老师肯定会问。它最早叫 Orallexa——几个 AI 角色,像看多的、看空的、还有当裁判的,一起争一个问题。这个是能跑的。但它让我明白一个道理:意见更多,不代表更可信。一堆 AI 说得再有道理,你*还是*没法核对它们到底靠什么。所以 Shadow 把这个"分析"只当成一个功能,把信任往下压了一层——压到底下的证据,而不是上面那些声音。同一个问题,但更准了。不是失败。

---

## Slide 4 — How Shadow records evidence · 2:00–2:50

**EN:** Here's the main idea in one line. You start with a source, then an action — a tool or a model doing something — then that becomes a clean record, those records get chained together, and the whole thing gets signed. Then anyone can check it. Two words to remember. "Hash chain" just means each step is locked to the one before it — so if you change an early step, everything after it breaks, and you can *see* that it broke. And "offline" means you don't need my server or the internet to check it. That last part is really the whole point.

**中文:** 主要思路一句话。先有一个来源,然后一个动作——某个工具或模型做了件事——这就变成一条干净的记录,这些记录再一条一条串起来,最后整个签个名。之后谁都能核对。记两个词。"哈希链"就是说每一步都锁在前一步上——所以你改了前面某一步,后面全会断,而且你能*看到*它断了。"离线"就是说你不用我的服务器、也不用联网就能核。最后这点,其实就是全部的重点。

---

## Slide 5 — Architecture · 2:50–3:30

**EN:** Three layers. The bottom one is the evidence itself — the format, the signed chain, the checker. The middle is different domains. The top is the different ways you use it. And I'll be honest — these are not all at the same level of done, and I label which is which right on the slide. The command line, the server, and the browser checker all work and are tested. The Unity and 3D parts are real builds, but I haven't tested them on a device yet.

**中文:** 三层。最下面是证据本身——格式、签好名的链、还有验证器。中间是不同领域。上面是不同的用法。我说实话——这些做完的程度不一样,幻灯片上我标清楚了哪个是哪个。命令行、服务器、浏览器验证器,都能用、也测过。Unity 和 3D 那部分是真的构建出来了,但我还没在设备上测过。

---

## Slide 6 — Three profiles · 3:30–4:10

**EN:** The same machine works in different fields. Banking — a document leads to a risk call, tied back to where it came from; that's the real screen on the left, and notice those checks are never all green at once. Data science — a dataset, a model, a score, a pick. A coding agent — an issue, a code change, tests, a commit. Different words, but underneath it's exactly the same thing: a sequence, a chain, a signature, and a link back to the source. That's why it's a general tool, not just a bank thing.

**中文:** 同一套东西,换个领域也能用。银行——一份文件得出一个风险判断,再绑回到它的出处;左边那张是真实界面,你注意那些检查项从来不会一次全绿。数据科学——数据集、模型、分数、选一个。编码 agent——一个 issue、一段代码改动、测试、一次提交。词不一样,但底下是一模一样的:一串顺序、一条链、一个签名、再连回来源。所以它是个通用工具,不是只给银行用的。

---

## Slide 7 — Exact tamper localization · 4:10–6:00 ← 重点 / the moment

**EN:** This is the most important slide. If the live demo works, I run it here — and I use the same one on the slide, sequence 3. What you're seeing is real. I start with a clean, sealed record. Then I change one earlier step — just one field, step 3, the "council claims" one. And the checker tells me the *exact* step where it breaks — not "something's wrong," the exact one. Then everything after it — 4, 5, 6 — gets marked "not verified," because the signature covered a chain that doesn't exist anymore. So it's more than "one bad step" — the record is broken from there on. And here's the key part: even when it catches the change, look at the panel — "Analytical correctness: not evaluated." It never tells you if the original answer was actually right. Whether it was *tampered* and whether it was *correct* are two different questions, and I keep them separate on purpose.

**中文:** 这是最重要的一页。如果现场 demo 能跑,我就在这跑——用的就是幻灯片上这个,步骤 3。你看到的是真的。我先有一份干净、封好的记录。然后我改前面的一步——就一个字段,第 3 步,那个"council claims"。验证器就告诉我它*具体*在哪一步断了——不是"哪里不对",是那一步。然后它后面的 4、5、6 全标成"未验证",因为签名盖的是一条已经不存在的链了。所以这不只是"有一步坏了"——是从那开始整份都断了。重点在这:哪怕它抓到了改动,你看这个面板——"正确性:未评估"。它从不告诉你原来的答案对不对。"有没有被改"和"对不对"是两回事,我是故意把它们分开的。

---

## Slide 8 — Verify the Verifier · 6:00–6:50

**EN:** Fair question: okay, but why should I trust the checker page itself? The page carries a signed list and says "my files match the signed list." But — and this is the honest part — a page checking *itself* isn't real trust. Real trust means you take its file hashes and compare them to a list you got somewhere *else*, and you check the key's fingerprint separately. Until you do that, the page literally says "independent comparison not performed." And I'll just say it: right now the signing key is a test key, not a real one. I didn't make a real production key for this.

**中文:** 一个合理的问题:那我凭什么信这个验证器页面本身?这个页面带了一份签好的清单,说"我的文件和清单对得上"。但是——这是诚实的部分——一个页面自己验*自己*,不算真的信任。真的信任是:你拿它的文件哈希,去跟一份你从*别处*拿到的清单比,再单独核对一下密钥的指纹。在你这么做之前,页面上就写着"未做独立比对"。我直说:现在这个签名密钥是测试用的,不是正式的。我没给这个项目做正式的生产密钥。

---

## Slide 9 — Spatial audit replay · 6:50–7:30

**EN:** This is the part that connects to the XR course. You're seeing two real Three.js screens — one is the arc, one is the tamper at step 3. That Three.js version is tested and runs in the browser. There's also a Unity version — I built it, and I test its generated code against the shared rules — and there's an Android build. But I'm *not* showing a Unity screenshot, because I don't have a real one, and I won't fake it by labeling a Three.js picture as Unity. Device testing is still ahead. Quick note on the controls: you look at something to focus it — that's your *head* direction, not eye tracking, there's no full 3D motion on the mock, and I haven't run a user study yet.

**中文:** 这部分连着 XR 那门课。你看到两张真实的 Three.js 画面——一张是弧形的,一张是第 3 步被篡改的。这个 Three.js 版本测过、也能在浏览器里跑。还有一个 Unity 版本——我做出来了,也拿它生成的代码去对共享规则做测试——还有 Android 构建。但我*不*放 Unity 截图,因为我没有真的截图,我也不会拿 Three.js 的图假装成 Unity。设备测试还在后面。控制方式提一句:你看向哪儿就聚焦哪儿——那是*头*的朝向,不是眼动追踪,mock 上没有完整的空间移动,我也还没做用户研究。

---

## Slide 10 — Evaluation and evidence · 7:30–8:05

**EN:** The numbers, honestly. **1,892 out of 1,895 tests pass — zero fail, three skipped, and the three are skipped because they need a special key or network, not because I turned them off.** I re-ran that today. The browser checker was tested in a real browser, in English and Chinese, with zero outside requests. The Android app builds — 24.4 megabytes, hash recorded — but it's *built*, not tested on a device. The 3D contracts are tested, the Three.js part is tested and runs in the browser, and the Unity code is checked against the rules. The one thing I *haven't* done is a user study — so I'm not claiming yet that the 3D actually helps people. That's next.

**中文:** 说数字,诚实地说。**1,895 个测试过了 1,892 个——0 个失败,3 个跳过,而这三个跳过是因为要特殊密钥或联网,不是我关掉的。** 这是今天重跑的。浏览器验证器在真实浏览器里测过,中英文都测,零外部请求。Android 应用能构建——24.4 MB,哈希记下来了——但它是"构建好了",不是"在设备上测过"。3D 合约测过,Three.js 那部分测过也能在浏览器跑,Unity 的代码也对着规则查过。唯一我*没*做的是用户研究——所以我现在不敢说这个 3D 真的对人有帮助。那是下一步。

---

## Slide 11 — Current state and Capstone II · 8:05–8:25

**EN:** Two columns — what's done now, what's next. Done: the core evidence and checking, the claim-evidence graph, the two-language checker plus three explainer animations, the shared 3D contract (written and tested), the Three.js part (tested and running), the Unity code check, and the Android build. Next semester: putting Unity into real use and testing it properly, testing on the Beam Pro headset, native XREAL input, measuring performance on a device, the user study, and a real signing setup. One thing I want to say precisely — the ingest check: the *structure* part is tested; the *meaning* part still needs real-world evaluation. That's a "needs production testing" thing, not a "needs a device" thing.

**中文:** 两栏——现在做完的,和接下来的。做完的:核心证据和验证、claim-evidence 图、双语验证器加三个讲解动画、共享的 3D 合约(写好也测过)、Three.js 那部分(测过也能跑)、Unity 代码检查、还有 Android 构建。下学期:把 Unity 真正用起来并好好测、在 Beam Pro 头显上测、XREAL 原生输入、在设备上量性能、做用户研究、还有真正的签名方案。有一点我想说准——ingest 检查:*结构*那部分测过了;*语义*那部分还得在真实环境里评估。这是"需要生产测试",不是"需要设备"。

---

## Slide 12 — Contribution · 8:25–8:35

**EN:** So here's my project in one sentence. Shadow doesn't ask you to trust the AI's answer. It hands you evidence you can check yourself — the steps, the sources, the signature, and if someone changed it, exactly where it broke. And it's clear about its limit: it proves the record wasn't changed, not that the answer is right. Thank you — happy to take questions.

**中文:** 那我这个项目一句话说完。Shadow 不要求你去信 AI 的答案。它给你一份你能自己核对的证据——每一步、来源、签名,如果有人改过,还能指出它到底在哪断了。它也把话说清楚:它证明的是记录没被改过,不是答案是对的。谢谢——欢迎提问。

---

# 备用页 / Backup slides(问答时才翻 / for Q&A only)

**Slide 13 — 状态清单 / Status list.**
EN: If you want the full list, this is every piece with an honest tag — tested, runs-in-browser, test-key-signed, written-in-Unity, Android-built, or not-done. I'm not overselling anything.
中文:想看完整清单的话,这一页是每一样配一个诚实标签——测过 / 浏览器能跑 / 测试密钥签的 / Unity 里写的 / Android 构建 / 还没做。我没夸大任何东西。

**Slide 14 — 信任的边界 / Trust boundary.**
EN: What a good signature *does* prove — the files match, the chain is unbroken or you see where it breaks, it was signed by a known key, it fits the format. What it *doesn't* prove — that the source was telling the truth, that the answer is right, that the signing is production-grade, or that any law requires it.
中文:一个有效签名*能*证明什么——文件对得上、链没断或你能看到断在哪、是已知密钥签的、符合格式。它*不能*证明什么——来源说的是不是真的、答案对不对、签名是不是正式级、有没有法律要求它。

**Slide 15 — 局限 / Limitations.**
EN: I say these straight: it's test data, no real signing, Unity is written and its code is checked but not run on a device, device testing pending, no user study, the meaning-check still needs real testing, it doesn't prove the source is true or the answer is right, and there's no production key management.
中文:我直说这些:用的是测试数据、没有正式签名、Unity 是写好的、代码查过但没在设备上跑、设备测试待做、没用户研究、语义检查还得真实测试、不证明来源真实或答案正确、也没有生产级的密钥管理。

**Slide 16 — Demo 兜底 / Demo backup.**
EN: Four levels — the live app, the offline browser version, a saved backup video, and the screenshots on the slides. My rule: if the live app doesn't come up cleanly in 20 seconds, I open the backup video and keep talking.
中文:四级兜底——现场应用、离线浏览器版、存好的兜底视频、幻灯片上的截图。我的规矩:现场应用 20 秒内没干净起来,我就打开兜底视频,接着讲。

---

## 时间表 / Timing
| Slide | Window |
|---|---|
| 1 Title 开场 | 0:00–0:30 |
| 2 Trust gap 问题 | 0:30–1:20 |
| 3 Evolution 来历 | 1:20–2:00 |
| 4 How it records 怎么记录 | 2:00–2:50 |
| 5 Architecture 架构 | 2:50–3:30 |
| 6 Profiles 三个领域 | 3:30–4:10 |
| 7 Tamper 篡改 (步骤 3) | 4:10–6:00 |
| 8 Verify the Verifier | 6:00–6:50 |
| 9 Spatial 空间回放 | 6:50–7:30 |
| 10 Evaluation 评估 (1,892/1,895) | 7:30–8:05 |
| 11 Current state 现状 | 8:05–8:25 |
| 12 Contribution 总结 | 8:25–8:35 |

讲长了就压 5 和 6,保住 7。现场起不来就切兜底视频接着讲。
