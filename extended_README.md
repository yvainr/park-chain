# What are you most proud of in your project?
The reservation logic is the core of ParkChain and the part we are most proud of. We implemented the complete reservation lifecycle, including reservation creation, check-in, check-out, cancellation, overstay and no-show handling. Integrating these processes with memberships, operators, and ParkCredits token required careful coordination between several smart contracts.

We are also proud of our user interface. Since blockchain applications can easily become difficult to use, we focused on creating an intuitive frontend that hides as much blockchain complexity as possible from the users. The dashboard and role-specific interfaces make interacting with the platform straightforward for members, operators and administrators.

# Work Distribution
We worked closely together and held weekly meetings to discuss ParkChain, divide tasks, review each others work and coordinate the next development steps. Additionally, tasks where tracked using Linear where we could monitor others progress and coordinate development. 

| team member | work | cherry on top |
| :--- | :--- | :--- |
| **Gina** | smart contracts, graphics, frontend refinement, report | rating |
| **Yan** | smart contracts, frontend UI, infrastructure, git integration, hardhat-tests, code-reviews | free slots display, QR-code |
| **Vlad** | smart contracts, structure, git integration, hardhat-tests, frontend refinement | gas estimation |
| **Emily** | smart contracts, poster, graphics, report | statistics |

# Statement on the use of AI
AI tools were used throughout the development process to support productivity, but all architectural decisions, implementations, testing and integration were carried out by the team.
The following tools were used:
- ⁠Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for part of the development in form of explainations, code suggestions and debugging
- Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used to assist with frontend development, particularly for UI components and styling
- Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for ⁠Pull-Request Reviews
- ⁠ChatGPT was used for small LaTeX formatting tasks, such as creating tables and adjusting layouts

# How to run ParkChain 
Detailed setup instructions are available in:
- [README.md](https://github.com/yvainr/park-chain/blob/dev/README.md)
- [TEST_RUN_README.md](https://github.com/yvainr/park-chain/blob/dev/TEST_RUN_README.md)
The project can be deployedy locally using Hardhat with the provided deployment scripts. After deployment, the frontend automatically connects to the deployed contracts using the generated configuration.

# Reflection
ParkChain consists of six smart contrcats with clearly seperated responsibilities. Instead of implementing all functionality in a single contract, we devided the system into independent modules responsible for memberships, parking operators, reservations, ParkCredits, administration and ledger functionality. This modular architecture improves mantainability, scaling and extensibility.

We decided on a credit-based membership model instead of an hour-based. Credits provide greater flexibility and allow different parking categories and future pricing models without fundamentally changing the membership structure.

### Feedback from the Poster Session
The feedback we received during the poster session was generally positive. Visitors particularly appreciated ???. Several discussions focused on ??? and integration with real-world parking infrastructure.

Based on this feedback, we further refined the frontend, ???
