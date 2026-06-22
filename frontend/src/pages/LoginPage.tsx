import { Badge, Button } from "../components/ui";

export function LoginPage({ app }: any) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-copy">
          <Badge>ParkChain</Badge>
          <h1>Sign in to your workspace</h1>
          <p>Connect your wallet, then choose the interface authorized for that on-chain account.</p>
        </div>

        <div className="login-actions">
          <Button onClick={() => app.run("Connect wallet", app.connect)}>
            {app.account ? `${app.account.slice(0, 6)}...${app.account.slice(-4)}` : "Connect Wallet"}
          </Button>
          <Badge variant={app.account ? "success" : "secondary"}>
            {app.account ? "Wallet connected" : "Wallet disconnected"}
          </Badge>
        </div>

        <button
          className="role-card customer-login-card"
          disabled={!app.account}
          onClick={() => app.loginAs("customer")}
        >
          <span>Customer</span>
          <strong>Find your next parking space</strong>
          <small>Buy memberships, reserve parking or EV charging, check in, and track your monthly usage.</small>
          <b>Open Customer Portal →</b>
        </button>

        {(app.canAccessAdmin || app.canAccessOperator) && (
          <div className="privileged-login-section">
            <p>Additional workspaces available for this wallet</p>
            <div className="privileged-role-row">
              {app.canAccessAdmin && (
                <button className="role-card privileged-role-card" onClick={() => app.loginAs("admin")}>
                  <span>Admin</span>
                  <strong>Configure platform</strong>
                  <small>Register operators, manage tiers, and set treasury parameters.</small>
                </button>
              )}
              {app.canAccessOperator && (
                <button className="role-card privileged-role-card" onClick={() => app.loginAs("operator")}>
                  <span>Operator</span>
                  <strong>Manage parking operations</strong>
                  <small>Update prices, capacity, fees, and operator earnings.</small>
                </button>
              )}
            </div>
          </div>
        )}

        {app.walletAccessPending && (
          <p className="wallet-access-status" role="status">
            Checking for additional wallet permissions…
          </p>
        )}

        <pre className="login-output">{app.output}</pre>
      </section>
    </main>
  );
}
