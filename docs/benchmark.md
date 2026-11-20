# Model Arena

Four AI coding models got the same prompt at the same moment: Opus 5.5 and Fable 5.2 in Claude Code, Astra 6.2 and Sol 6.2 in Codex. High effort, one shot, no help. This repo holds every build exactly as the model handed it back.

**Play them:** https://clockendbader.github.io/model-arena/

| Round | Opus 5.5 | Fable 5.2 | Astra 6.2 | Sol 6.2 |
|---|---|---|---|---|
| 1. AAA parkour | [opus-5.5/parkour](opus-5.5/parkour) | [fable-5.2/parkour](fable-5.2/parkour) | [astra-6.2/parkour](astra-6.2/parkour) | [sol-6.2/parkour](sol-6.2/parkour) |
| 3. Breath (lungs) | [opus-5.5/breath](opus-5.5/breath) | [fable-5.2/breath](fable-5.2/breath) | [astra-6.2/breath](astra-6.2/breath) | [sol-6.2/breath](sol-6.2/breath) |

Round 2 is kept private because that game may become a real product.

The full write-up (times, API-equivalent costs, tokens, how each model talked to the developer) is in [benchmark.pdf](benchmark.pdf).

To run a build locally: `cd <model>/<round> && python3 -m http.server 8000`, then open http://localhost:8000.

Third-party assets keep their own licences. See the credits file in each build.
