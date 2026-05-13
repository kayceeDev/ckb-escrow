# Week 15

Retrospective note for week 15 ending 9 May.

This week felt like a stronger synthesis point between the Rust contract work, the product/frontend work, and my ongoing learning around agentic workflows.

A large part of the week was spent thinking about the escrow system as a state machine rather than as a collection of screens or isolated contract functions. That shift helped me reason more clearly about how the CKB contract, off-chain transaction construction, and frontend behavior need to stay aligned. I spent more time reviewing how the escrow cell data encodes buyer, seller, arbitrator, amount, deadline, and state, and why the contract only permits certain transitions depending on the current state and the required signer.

I also learned more from the mismatch between on-chain truth and product assumptions. One of the most useful technical lessons was realizing that the contract stores participant identity as lock hashes, while some settlement actions still need the full recipient lock script off chain in order to build valid transactions. That was a good reminder that understanding the cell model deeply matters for product design. It is not enough to know that a seller or arbitrator is allowed to act; the surrounding tooling also needs the right script data, witness shape, and chain context to express that action correctly.

This week also pushed me further in learning how to use agents in a more operational way. I kept exploring FiberX-related thinking and agentic workflow ideas, especially around stepwise reasoning, narrowing down bug sources, and preserving state across multiple layers of work. I found that agents are most valuable when I use them to help inspect assumptions, compare contract rules against frontend behavior, and break complex work into smaller verifiable steps rather than expecting a one-shot answer.

A practical example of that came from debugging role-based actions and escrow discovery. I had to reason about who should be able to see or perform a given action, how the frontend could infer that from connected wallets, and whether the contract actually supported that assumption. That led to a clearer understanding of why the buyer, seller, and arbitrator experiences all need to be derived from the same underlying escrow data and transition rules.

By the end of the week, I felt more comfortable moving between Rust contract logic, off-chain transaction planning, and frontend UX decisions without treating them as separate worlds. I also felt I was learning how to work with agents more intentionally in the context of CKB solutions: not just to write code, but to support reasoning, debugging, workflow design, and technical consistency across the full escrow system.
