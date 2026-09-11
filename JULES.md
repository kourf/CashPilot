# Project Context & Audit Directives for Google Jules

Welcome, Google Jules. You are acting as a Senior Staff Software Engineer and Security Specialist reviewing **CashPilot** (Financial Statement & Cash Flow Analyzer).

---

## 1. Project Overview & Architecture

- **Application**: CashPilot – Personal finance & cash flow tracking platform.
- **Frontend**:
  - React 19 + TypeScript
  - Vite 8 + TailwindCSS
  - Lucide React (icons)
  - Recharts (visualizations: AreaChart, PieChart, Sankey flux diagram)
- **Backend / Cloud Services**:
  - Firebase Cloud Functions (`europe-west1`, Node.js 20 / TypeScript)
  - Cloud Firestore (Multi-tenant document storage using device identification and user profiles)
  - Cloud Storage (encrypted bank statement uploads, temporary staging)
  - Google Gemini API (document parsing, multi-month transaction extraction, smart financial categorization)
- **Production URL**: `https://cashpilot-app-2026.web.app`

---

## 2. Core Business Logic & Financial Principles

1. **Transaction Normalization**:
   - Every transaction has:
     - `date`: string (ISO or DD/MM/YYYY standardized)
     - `monthKey`: string formatted as `YYYY-MM` extracted from the transaction's real date (never force-grouped to import month)
     - `description` / `rawLabel`: string
     - `amount`: signed float (negative = debit/expense, positive = credit/income)
     - `category`: string (Logement, Alimentation, Transports, Santé, Loisirs, Shopping, Abonnements, Épargne, Frais bancaires, Revenus, Autres)
     - `nature`: `"fixe"` | `"variable"` | `"exceptionnelle"`
2. **Expense Classification ("Nature")**:
   - **Fixe**: Recurrent essential bills (rent, mortgage, insurance, electricity, internet, phone, gym membership, subscriptions).
   - **Variable**: Daily living costs fluctuating month-to-month (groceries, dining out, transport/fuel, leisure, shopping).
   - **Exceptionnelle**: Irregular one-off large purchases (car repairs, appliances, vacations/travel, moving costs).
3. **Budget & KPI Integrity**:
   - Real Expenses = Total variable + fixe + exceptionnelle (excluding internal account transfers).
   - Reste à vivre (Discretionary Cash Flow) = Real Income - Real Expenses.
   - Internal Transfers (`Virements internes`) and Savings (`Épargne`) must remain distinct from operational consumption expenses.

---

## 3. High-Priority Audit Checklist for Google Jules

Please perform a thorough audit across the codebase and propose pull requests / patches for:

### A. Architecture & Code Quality
- [ ] Ensure strict typing consistency across `Transaction`, `KPIResult`, and Firestore payloads in `src/lib/kpiUtils.ts` and `src/pages/BankStatements/index.tsx`.
- [ ] Eliminate dead code, unused imports, and duplicate parsing branches.
- [ ] Verify clean separation of concerns between UI state, data enrichment, and Firebase communication.

### B. Security & Data Protection
- [ ] Confirm no secrets, API keys, or service credentials are leakable via client-side bundles or repository history.
- [ ] Validate Firestore security rules (`firestore.rules`) to ensure strict isolation per `deviceId` / user UID without permission leaks.
- [ ] Validate Cloud Functions input sanitation to protect against malformed CSV or oversized PDF payloads.

### C. Performance & Bundle Optimization
- [ ] Optimize Vite bundle chunks: code-split heavy visualization libraries (`recharts`, `jspdf`, `html2canvas`) using dynamic `import()` to resolve chunk size warnings (> 500 kB).
- [ ] Prevent unnecessary re-renders in `Dashboard` and `BankStatements` tabs with optimized `useMemo` / `useCallback` dependencies.

### D. Error Boundaries & Reliability
- [ ] Ensure robust handling for edge cases in CSV parsing (varying delimiters `;`, `,`, `\t`, European decimal formats `1.234,56 €`, missing headers).
- [ ] Guarantee that charts (Recharts Sankey, PieChart) render gracefully with clean empty states when datasets are empty or unbalanced, avoiding any client-side runtime crashes.

---

## 4. Verification Commands

Before proposing changes, ensure the repository builds cleanly:
```bash
# Type check and lint
npm run lint

# Production build
npm run build
```
