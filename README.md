# Budgeting Tool GH

A budgeting app for tracking income, expenses, debts, credit, loans, goals, and dashboard metrics in one place.

Built with React + Vite. Styled with Tailwind.

Yes, this project was vibe coded.

## What It Does

- Track core financial records across multiple categories.
- Calculate dashboard summaries and health metrics.
- Persist data locally and support import/export flows.
- Includes pure/impure core boundaries with tuple-based error handling.

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Run the app locally

```bash
npm run dev
```

Default dev URL:

`http://127.0.0.1:4000`

### 3) Run tests

```bash
npm run test
```

### 4) Build for production (outputs to `/docs`)

```bash
npm run build
```

### 5) Preview production build

```bash
npm run preview
```

## GitHub Pages

This repo is configured to publish the built app from the `/docs` folder.

In GitHub:

1. Go to `Settings -> Pages`.
2. Set source to `Deploy from a branch`.
3. Select your branch (usually `main`) and folder `/docs`.
4. Run `npm run build` and push changes.

## Project Notes

- App source lives in `src/`.
- Core logic is split into:
  - `src/core/pure.js` (deterministic logic)
  - `src/core/impure.js` (side effects/adapters)
- Test files live in `test/`.

