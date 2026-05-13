# Weekly Learning Report

This document records retrospective weekly learning notes for:

- Week 13 ending 25 April
- Week 14 ending 2 May
- Week 15 ending 9 May

The main focus across these weeks was learning how to use agents meaningfully while working on CKB-based solutions, especially around escrow flows, debugging, and understanding where agentic operations can support protocol work.

## Week 13 ending 25 April

This week was mostly about consolidation.

A lot of my effort went into revisiting the CKB basics and making sure I was not just copying patterns without understanding them. I spent more time thinking through the cell model, transaction flow, and the differences between lock scripts, type scripts, and off-chain transaction construction. I realized I had been mixing those layers mentally, so I slowed down and tried to understand what the chain is responsible for versus what the frontend or tooling is responsible for.

I also started looking more seriously at agentic workflows. Instead of seeing an agent as just a code assistant, I tried to understand how it could support structured problem solving across multiple steps. I explored ideas around FiberX and agentic operations with that in mind. The main takeaway for me was that agents are more useful when they help maintain reasoning across moving parts, especially when working with contract logic, off-chain tooling, and frontend state at the same time.

I hit a few bugs and sources of confusion, especially when trying to reason about where a failure actually came from. Sometimes the issue looked like a Rust or contract issue, but it was really a misunderstanding of the transaction shape or the intended state transition. That pushed me to become more disciplined about debugging by layers.

Overall this week felt slower, but it was important. I came away with a stronger foundation and a clearer sense that understanding CKB internals is necessary if I want to use agents well on top of CKB solutions.

## Week 14 ending 2 May

This week was more bug-heavy and practical.

I spent more time confronting implementation issues and edge cases. One of the recurring lessons was that it is easy to describe an escrow flow at a product level, but much harder to make the surrounding tooling, UI, and transaction building reflect the exact contract rules correctly. That forced me to think more carefully about how state transitions are represented and what the contract actually permits.

I kept learning more about agentic operations during this process. The more I worked through bugs, the more I understood that the value of an agent is not just in generating code quickly, but in helping me keep context across different technical layers. FiberX-related ideas were useful here because they reinforced a more operational view of agents: break work into stages, validate assumptions, inspect outputs, and move carefully instead of treating the process like a single prompt-response cycle.

This week also helped me notice how often product assumptions can drift away from protocol reality. Some things that seemed natural in the UI were not actually safe or complete from the perspective of on-chain truth. That was frustrating, but it was also one of the best learning moments so far. I started to see that one of the hardest parts of CKB development is keeping the product layer honest with respect to the contract layer.

By the end of the week, I felt less intimidated by the bugs. I was still hitting them, but I was getting better at identifying whether the issue lived in the contract, the transaction builder, the data layout, or the frontend assumption.

## Week 15 ending 9 May

This week felt like a stronger synthesis of what I had been learning.

I spent more time connecting the dots between CKB internals, Rust contract behavior, off-chain logic, and the role of agents in helping manage all of that complexity. Instead of thinking about each problem separately, I started thinking more in terms of systems: state, transitions, permissions, transaction construction, and how an agent can help track those relationships.

One of the biggest insights this week was that CKB escrow is naturally a stateful, multi-step workflow, which makes it a good place to learn how agents can support structured development. I kept exploring how agentic workflows and FiberX-style operational thinking could help with reasoning about valid actions, debugging contract-aligned behavior, and reducing the cognitive load of switching between protocol and product concerns.

I still ran into bugs, but I handled them better than before. I found it easier to separate conceptual confusion from actual code defects. I also became more comfortable using the agent as a collaborator for narrowing problems down instead of expecting it to solve everything in one pass. That feels like a meaningful shift in how I am learning.

By the end of this period, I felt I was not only learning CKB and Rust, but also learning how to work with agents more intentionally in the context of CKB solutions. That was the main value of these weeks.
