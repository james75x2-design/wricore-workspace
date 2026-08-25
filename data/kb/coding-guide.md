# WriCoRe Coding Guide

## Code Review Principles
Effective code review focuses on correctness, readability, and maintainability rather than personal style. Reviewers should check for clear naming, small focused functions, and adequate test coverage, and leave specific, actionable comments.

## Debugging Methodology
Systematic debugging starts by reproducing the failure reliably, then narrowing the search space with logging, breakpoints, or bisection. Form a hypothesis, test one variable at a time, and confirm the root cause before applying a fix.

## Writing Unit Tests
Good unit tests are fast, isolated, and deterministic. Each test should verify one behavior, use clear arrange-act-assert structure, and cover edge cases such as empty inputs, boundary values, and error paths in addition to the happy path.

## Git Commit Hygiene
Commits should be small, atomic, and scoped to a single logical change. Write imperative commit messages that explain why the change was made, and avoid mixing refactoring with behavioral changes in the same commit.

## Refactoring Safely
Refactor only when tests are green, and change structure without changing behavior. Make one small transformation at a time, run the test suite after each step, and commit frequently so any regression is easy to isolate and revert.

## Error Handling Patterns
Robust code handles failures explicitly rather than letting them propagate silently. Validate inputs at boundaries, fail fast with clear messages, and degrade gracefully with timeouts and fallbacks when calling external services.

## Performance Profiling
Optimize based on measurement, not guesswork. Profile to find the real bottleneck, focus on the hottest paths, and confirm each change with before-and-after benchmarks so you avoid premature or ineffective optimizations.
