# What are you most proud of in your project?
The reservation logic is the core of ParkChain and the part we are most proud of. We implemented the complete reservation flow (reservation creation, check-in, check-out, cancellation, overstay and no-show handling). Integrating these processes with memberships, operators, and ParkCredits required careful coordination between multiple smart contracts.

We are also proud of our UI. We tried to make the interaction with the blockchain as user friendly as possible for the stakeholders.

# Work Distribution
We worked closely together and had weekly meetings to discuss ParkChain, divide tasks and review each others work. Additionally, tasks where tracked using Linear where we could monitor others progress and coordinate development. 


| team member | work | cherry on top |
| :--- | :--- | :--- |
| **Gina** | smart contracts, graphics, frontend refinement, report | rating |
| **Yan** | smart contracts, frontend UI, infrastructure, git integration, hardhat-tests, code-reviews | fee slots display, QR-code |
| **Vlad** | smart contracts, structure, git integration, hardhat-tests, frontend refinement | gas estimation |
| **Emily** | smart contracts, poster, graphics, report | statistics |

# Statement on the use of AI
We used AI in the following ways:
(i) ⁠Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for part of the development in form of explainations, code suggestions and debugging

(ii) Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for elements of the ⁠frontend

(iii) Codex, ⁠Copilot (GPT-5.4/5.5), ⁠Claude and ⁠ChatGPT were used for ⁠Pull-Request Reviews

(iv)⁠ ⁠ChatGPT was used to suggest LaTeX for parts of the poster

# How to run ParkChain 
see [README.md](https://github.com/yvainr/park-chain/blob/dev/README.md) and [TEST_RUN_README.md](https://github.com/yvainr/park-chain/blob/dev/TEST_RUN_README.md)

# Reflection
Our architecture consists of 6 smart contrcats with cleary seperated responsibilities. This makes the system easier to mantain, scale and extend.  

We decided on a credit-based membership instead of an hour-based because credits provide greater flexibility. They allow different parking categories and future pricing models without changing the membership structure much. 
