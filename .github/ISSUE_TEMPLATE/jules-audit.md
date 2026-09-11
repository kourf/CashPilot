---
name: "Google Jules Code & Architecture Audit"
about: "Trigger an autonomous audit and refactoring task with Google Jules"
title: "[Jules] Architecture, Security and Performance Audit"
labels: ["jules", "audit", "enhancement"]
assignees: []
---

## Task Description for Google Jules

Google Jules, please read `JULES.md` and `.jules/instructions.md` at the repository root and perform an end-to-end audit of CashPilot.

### Scope of Audit
1. **Security & Secrets**: Ensure no credentials or service account tokens are exposed. Validate `firestore.rules`.
2. **Bundle Optimization**: Implement dynamic imports (`React.lazy` or dynamic `import()`) for `recharts` and other chunks > 500 kB.
3. **Type Strictness**: Audit `src/lib/kpiUtils.ts` and ensure all transaction interfaces have 100% type safety.
4. **Validation**: Run `npm run lint` and `npm run build` to ensure zero regressions before opening a Pull Request.
