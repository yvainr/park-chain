# What are you most proud of in your project?
The reservation logic is the core of ParkChain and the part we are most proud of. We implemented the complete reservation lifecycle, including reservation creation, check-in, check-out, cancellation, overstay and no-show handling. Integrating these processes with memberships, operators, and ParkCredits token required careful coordination between several smart contracts.

We are also proud of the usability of our user interface. Since blockchain applications can easily become difficult to use, we focused on creating an intuitive frontend that hides as much blockchain complexity as possible from the users. The dashboard and role-specific interfaces make interacting with the platform straightforward for members, operators and administrators.

# Work Distribution
We worked closely together and held weekly meetings to discuss ParkChain, divide tasks, review each other's work and coordinate the next development steps. Additionally, tasks where tracked using Linear where we could monitor others progress and coordinate development. 

| team member | work | cherry on top |
| :--- | :--- | :--- |
| **Gina** | smart contracts, graphics, frontend refinement, report | rating |
| **Yan** | smart contracts, frontend UI, infrastructure, git integration, hardhat-tests, code-reviews | free slots display, QR-code |
| **Vlad** | smart contracts, structure, git integration, hardhat-tests, frontend refinement | gas estimation |
| **Emily** | smart contracts, posters, graphics, report | statistics |

# Statement on the use of AI
AI tools were used throughout the development process to support productivity, but all architectural decisions, implementations, testing and integration were carried out by the team.
The following tools were used:
- ⁠Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for part of the development in form of explanations, code suggestions and debugging
- Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used to assist with frontend development, particularly for UI components and styling
- Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for ⁠pull request reviews
- ⁠ChatGPT was used for small LaTeX formatting tasks, such as creating tables and adjusting layouts

# How to run ParkChain 
Install the contract and frontend dependencies from the project root:

```bash
npm install
npm install --prefix frontend
```

Then start the complete local ParkChain stack with one command:

```bash
npm start
```

This starts a local Hardhat node, waits until it is ready, deploys and configures the smart contracts, and launches the frontend with the generated `ParkChainRouter` address. Open [http://localhost:5173](http://localhost:5173) in a browser.

Detailed test and manual deployment instructions are available in:

- [README.md](https://github.com/yvainr/park-chain/blob/dev/README.md)
- [TEST_RUN_README.md](https://github.com/yvainr/park-chain/blob/dev/TEST_RUN_README.md)

# Reflection
ParkChain consists of six smart contrcats with clearly seperated responsibilities. Instead of implementing all functionality in a single contract, we devided the system into independent modules responsible for memberships, parking operators, reservations, ParkCredits, administration and ledger functionality. This modular architecture improves mantainability, scaling and extensibility while keeping the individual contracts easier to understand and test.

At the same time, developing a modular system taught us that these advantages come with additional complexity. Splitting the functionality across multiple smart contracts introduced integration challenges, since changes in one contract often affected interactions with several others. As a result, designing clear interfaces, keeping responsibilities well separated, and testing contract interactions became essential parts of the development process.

Another important architectural decision was to use a credit-based membership model instead of an hour-based one. Credits provide greater flexibility and allow different parking categories and future pricing models without fundamentally changing the membership structure. This approach makes the platform easier to extend while keeping the smart contracts relatively stable.

### Feedback from the Poster Session
The feedback we received during the poster session was generally positive. Visitors particularly appreciated the modular smart contract architecture, the Router contract as a single entry point, and the user-friendly frontend. Several discussions focused on overstay handling, reservation constraints, and the integration of ParkChain with real-world parking infrastructure. For example, visitors asked about edge cases, such as how the platform should handle situations where a user overstays their reservation and the same parking spot has already been booked by the next customer. Although ParkChain already discourages this behavior through configurable overstay fees, the discussion highlighted an important limitation of blockchain-based systems: smart contracts can only enforce digital rules and cannot directly influence events in the physical world. A real-world deployment would therefore require additional infrastructure.

The discussions also inspired several ideas for future extensions. For example, ParkChain could automatically reassign affected reservations to alternative available parking spaces, compensate users with ParkCredits if no replacement is available, or notify parking operators so they can manually resolve conflicts. These additions would complement the existing smart contract logic and further improve the user experience in real-world scenarios.
 
The poster session also provided valuable feedback on the usability of the application. Based on the suggestions we received, we further refined the frontend usability and implemented the statistics dashboard for operators. While these improvements do not directly address the physical challenges discussed above, they strengthen the practical usability of ParkChain and provide a solid foundation for future extensions.
