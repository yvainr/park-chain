import { Badge, Button } from "../components/ui";

export function LoginPage({ app }: any) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-copy">
          <Badge>ParkChain</Badge>
          <h1>Sign in to your workspace</h1>
          <p>Choose the interface that matches your role. Wallet connection is required before sending transactions.</p>
        </div>

        <div className="login-actions">
          <Button onClick={() => app.run("Connect wallet", app.connect)}>
            {app.account ? `${app.account.slice(0, 6)}...${app.account.slice(-4)}` : "Connect Wallet"}
          </Button>
          <Badge variant={app.account ? "success" : "secondary"}>
            {app.account ? "Wallet connected" : "Wallet disconnected"}
          </Badge>
        </div>

        <div className="role-grid">
          <button className="role-card" onClick={() => app.loginAs("admin")}>
            <span>Admin</span>
            <strong>Configure platform</strong>
            <small>Register operators, manage tiers, and set treasury parameters.</small>
          </button>
          <button className="role-card" onClick={() => app.loginAs("operator")}>
            <span>Operator</span>
            <strong>Manage garage earnings</strong>
            <small>Set category prices, no-show fees, and withdraw accumulated earnings.</small>
          </button>
          <button className="role-card" onClick={() => app.loginAs("customer")}>
            <span>Customer</span>
            <strong>Reserve parking</strong>
            <small>Buy memberships, reserve slots, check in, check out, and view usage.</small>
          </button>
        </div>

        <pre className="login-output">{app.output}</pre>
      </section>
    </main>
  );
}
