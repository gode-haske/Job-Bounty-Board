# Job Bounty Board

A decentralized job bounty board built on Clarity for the Stacks blockchain. This contract allows employers to post tasks with bounties, and workers to submit proofs of work to earn payment upon approval.

## Features

- Employers can post tasks with STX bounties
- Workers can submit proofs of work for tasks
- Employers can approve submissions and release payment
- Workers receive payment automatically upon approval

## Contract Functions

### For Employers

- `post-task`: Post a new task with a description and bounty amount
- `approve-submission`: Approve a worker's submission and release payment
- `cancel-task`: Cancel a task and retrieve the bounty (if no submissions)

### For Workers

- `submit-proof`: Submit proof of work for a specific task
- `withdraw-submission`: Withdraw a submission (if not yet approved)

## Getting Started

1. Deploy the contract to the Stacks blockchain
2. Interact with the contract using the Stacks API or a compatible wallet
