# Week 14

Retrospective note for week 14 ending 2 May.

This week was more bug-heavy and practical.

I spent more time confronting implementation issues and edge cases. One of the recurring lessons was that it is easy to describe an escrow flow at a product level, but much harder to make the surrounding tooling, UI, and transaction building reflect the exact contract rules correctly. That forced me to think more carefully about how state transitions are represented and what the contract actually permits.

I kept learning more about agentic operations during this process. The more I worked through bugs, the more I understood that the value of an agent is not just in generating code quickly, but in helping me keep context across different technical layers. FiberX-related ideas were useful here because they reinforced a more operational view of agents: break work into stages, validate assumptions, inspect outputs, and move carefully instead of treating the process like a single prompt-response cycle.

This week also helped me notice how often product assumptions can drift away from protocol reality. Some things that seemed natural in the UI were not actually safe or complete from the perspective of on-chain truth. That was frustrating, but it was also one of the best learning moments so far. I started to see that one of the hardest parts of CKB development is keeping the product layer honest with respect to the contract layer.

By the end of the week, I felt less intimidated by the bugs. I was still hitting them, but I was getting better at identifying whether the issue lived in the contract, the transaction builder, the data layout, or the frontend assumption.
