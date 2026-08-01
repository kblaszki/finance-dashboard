---
name: advanced-planning
description: Deep, validated planning pass for complex or ambiguous tasks. Spawns parallel research subagents and a fresh validator subagent to produce a grounded, testable plan, then stops before implementation. Use when explicitly invoked (/advanced-planning) for high-stakes or multi-file work, especially in auto mode.
disable-model-invocation: true
---

# Advanced Planning

Produce a grounded, testable plan for a complex or ambiguous task, then stop.
Implementation is handed off to the normal agent under the project's behavioral rules
(typically a karpathy-style / golden-rule).

This skill hardens **process** (research, acceptance criteria, external validation) for
cheaper models in auto mode. It does not ask the model to "think harder".

## Boundaries

- **Plan-only.** Do not edit application code, docs, or config. Do not start implementation.
- **Complements golden-rule.** Do not restate it. Point to
  [`.cursor/rules/golden-rule.mdc`](../../rules/golden-rule.mdc); test gates live in
  [`.cursor/rules/verification.mdc`](../../rules/verification.mdc).
- **Skip over-orchestration.** If the task is small/obvious (single file, clear change), skip
  parallel research and the validator; draft a short plan and stop. Prefer fewer agents.

## Workflow

```
- [ ] 1. Frame
- [ ] 2. Ground (parallel research)
- [ ] 3. Draft plan
- [ ] 4. Validate (fresh subagent)
- [ ] 5. Revise and hand off
```

### 1. Frame

Before any research or planning:

1. Restate the goal in **one line**.
2. List **constraints** (explicit and inferred).
3. List **assumptions** explicitly. Mark anything uncertain.
4. List **open questions**. Ask the author the blocking ones before researching.
5. Define **acceptance criteria** up front: concrete, testable checks that prove success.
   Prefer the fewest criteria that cover the goal. Prefer project verify commands
   (`npm test`, `npm run test:coverage`; see [ADAPT.md](ADAPT.md)).

Do not proceed to step 2 while a blocking question is unanswered.

### 2. Ground (parallel research)

Ground the plan in the real codebase. Prefer evidence over memory.

**When to use parallel subagents:**
- Use **2-4** `explore` subagents (Task tool) when the work spans independent areas
  (e.g. API + UI + tests, or two disjoint modules).
- Use a **single** research pass (no subagents) when the scope is one area or the
  relevant files are already known.

**Brief each research subagent** with a self-contained prompt that includes:
- The one-line goal and the slice of the codebase to inspect.
- What to return: real file paths, symbols, and short notes on how they relate to the goal.
- Explicit ban: do not invent paths, APIs, or types; if not found, say so.

Require every finding to cite **real file paths and symbols**. Drop or re-check any claim
that cannot be grounded.

Project-specific research targets (key directories, entry points) live in [ADAPT.md](ADAPT.md).

### 3. Draft plan

Produce a structured draft plan with these sections:

1. **Goal** - one-line restatement.
2. **Chosen approach** - what you will do and why.
3. **Rejected alternatives** - 1-2 options considered and why they lose (keep short).
4. **Affected files** - paths that will change or be created (from research).
5. **Ordered steps** - numbered, each small enough to verify.
6. **Risks / edge cases** - what can go wrong; what to watch.
7. **Acceptance criteria** - from step 1, unchanged unless the author revised them.

Keep the plan minimal. No speculative scope. No gold-plating.

### 4. Validate (fresh subagent)

Launch **one** `generalPurpose` subagent with a **clean context** (no conversation history).
Feed it:

1. The full text of [validator-prompt.md](validator-prompt.md).
2. The draft plan from step 3.
3. The acceptance criteria from step 1.

Its only job is adversarial critique. Do not ask it to rewrite the plan or implement anything.

### 5. Revise and hand off

1. Fold Blockers and clear Warnings from the validator into the plan.
2. If a Blocker needs an author decision, ask and wait. Do not invent answers.
3. Present the **final plan** (use CreatePlan when in plan mode).
4. **STOP.** Do not implement. Hand off to the normal agent under
   [`.cursor/rules/golden-rule.mdc`](../../rules/golden-rule.mdc).

## Adaptation

This skill is a portable template. Before first serious use in a new repo, run the adaptation
checklist in [ADAPT.md](ADAPT.md) (or ask an agent: "adapt advanced-planning to this project").
