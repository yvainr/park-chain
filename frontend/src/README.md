# Frontend Structure

This React app is split by responsibility:

- `App.tsx` owns the shared state, wallet connection, contract address resolution, and simple hash routing.
- `pages/LoginPage.tsx` shows the role selector.
- `pages/AdminPage.tsx` contains admin-only actions.
- `pages/OperatorPage.tsx` contains operator-only actions.
- `pages/CustomerPage.tsx` contains customer membership and reservation actions.
- `components/ui.tsx` contains small reusable UI wrappers such as `Button`, `Card`, and `Input`.
- `components/shared-panels.tsx` contains panels reused across pages, such as contract addresses, shared inputs, and output.
- `types.ts` contains the small role and category type definitions.

The main pattern is:

```tsx
<SomePage app={app} />
```

`app` is a plain object created in `App.tsx`. It passes the values and functions each page needs without introducing advanced React concepts such as Context or reducers.
