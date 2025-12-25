# HiddenLuck

HiddenLuck is a privacy-preserving on-chain slot machine built with Zama FHEVM. Players pay 0.001 ETH to spin three
reels (numbers 1-4). Matching all three wins an encrypted 10,000 LUCK jackpot that can be decrypted on demand.

## Project Summary

HiddenLuck combines provably on-chain randomness with fully homomorphic encryption to create a fair, verifiable, and
privacy-aware game loop. The smart contract mints encrypted LuckCoin rewards, while the frontend presents a slot
machine experience with real on-chain reads and writes. No mocks, no fake data, and no local storage are used.

## Core Gameplay

1. Connect a wallet on Sepolia and click Spin.
2. A transaction of exactly 0.001 ETH is sent to the LuckCoin contract.
3. The contract generates three numbers (1-4) on-chain.
4. If all three match, the player receives 10,000 LUCK in encrypted form.
5. The encrypted handle is shown in the UI, and a decrypt action reveals the clear balance through the Zama relayer.

## User Experience Goals

- Slot-machine UI with three animated reels and a clear "Spin" call-to-action.
- Live on-chain status: last spin, spin price, jackpot size, and transaction link.
- Encrypted balance visibility with a one-click decrypt flow.
- Network gating to Sepolia only, avoiding localhost and local storage.

## Problems Solved

- Fairness: random results are generated on-chain, not in the UI.
- Privacy: LuckCoin balances are encrypted at rest on-chain.
- Trust minimization: rewards are minted by the contract, not an off-chain service.
- Verifiability: every spin and reward is recorded through events and state updates.

## Advantages

- Confidential rewards: encrypted LuckCoin balances keep user holdings private.
- Simple economics: a fixed 0.001 ETH entry cost and a deterministic jackpot payout.
- Transparent logic: all rules live on-chain with clear events for indexing.
- Relayer-backed decrypt flow: users can safely request plaintext balances.
- Deterministic local testing: a seeded spin function exists for chain id 31337.

## Tech Stack

### Smart Contracts

- Solidity 0.8.27
- Hardhat for builds, deployments, and tasks
- Zama FHEVM libraries (FHE, ZamaConfig)
- OpenZeppelin confidential ERC7984 token standard

### Frontend

- React 19 + Vite 7
- viem for contract reads
- ethers v6 for contract writes
- RainbowKit + wagmi for wallet connection
- Zama relayer SDK for decrypt requests
- TypeScript + custom CSS (no Tailwind)

## Architecture and Key Files

- `contracts/LuckCoin.sol`: main slot machine and LuckCoin minting logic.
- `contracts/FHECounter.sol`: template contract kept for reference.
- `deploy/`: deployment scripts for local and Sepolia networks.
- `tasks/`: Hardhat tasks for utilities and workflows.
- `test/`: automated tests for contract behavior.
- `deployments/sepolia/`: generated deployments and ABI output.
- `home/`: React frontend (required folder name).
- `home/src/config/contracts.ts`: LuckCoin address and ABI.
- `home/src/components/LuckGame.tsx`: slot machine UI and transaction flow.

## Smart Contract Details (LuckCoin)

- `SPIN_PRICE`: 0.001 ETH entry cost.
- `JACKPOT_REWARD`: 10,000 LUCK minted on jackpot.
- `play()`: public paid spin, uses on-chain randomness.
- `playWithSeed(uint256)`: seeded spin for local chain id 31337 tests.
- `getLastSpin(address)`: view last spin result for any player address.
- `withdraw(address payable)`: owner-only withdrawal of contract ETH.
- Events:
  - `SpinPlayed`: player, slots, jackpot flag, encrypted reward handle.
  - `Withdrawal`: recipient and amount.

Randomness is derived on-chain using a per-spin nonce and current block data. Rewards are minted only when all three
slot values match.

## Frontend Behavior

- Uses `useReadContract` (viem) for `SPIN_PRICE`, `JACKPOT_REWARD`, `getLastSpin`, and `confidentialBalanceOf`.
- Uses `ethers.Contract` for paid `play()` transactions.
- Displays the encrypted balance handle and decrypts via Zama relayer with EIP-712 authorization.
- No frontend environment variables. Configuration lives in `home/src/config/contracts.ts`.
- No local storage and no localhost network configuration.

## Configuration Notes

- After deploying to Sepolia, paste the deployed address into `home/src/config/contracts.ts`.
- Copy the ABI from `deployments/sepolia/LuckCoin.json` into `home/src/config/contracts.ts`.
  The frontend must not import JSON directly.

## Setup and Development

### Prerequisites

- Node.js 20+
- npm
- A Sepolia wallet funded with test ETH

### Install dependencies

```bash
npm install
cd home
npm install
```

### Compile and test contracts

```bash
npm run compile
npm run test
```

### Local chain (contracts only)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

Use `playWithSeed` in tests on chain id 31337. The frontend remains configured for Sepolia only.

### Deployment configuration

Create a root `.env` with the following fields:

```
PRIVATE_KEY=your_private_key_without_0x
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=optional_for_verification
```

Deployments must use a private key, not a mnemonic.

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Run the frontend

```bash
cd home
npm run dev
```

Open the app, connect a Sepolia wallet, and spin.

## Usage Flow

1. Connect your wallet in the UI.
2. Click "Spin for 0.001 ETH" and confirm the transaction.
3. Watch the reels animate while the transaction settles.
4. Review the last spin result and jackpot status.
5. Decrypt your LuckCoin balance when needed.

## Security and Privacy Notes

- LuckCoin balances are encrypted on-chain through ERC7984.
- Decrypt requests use per-session keypairs and EIP-712 signatures.
- Owner-only withdrawal keeps contract funds controllable for treasury management.

## Future Roadmap

- Multi-line paylines and variable bet sizes.
- Configurable symbol sets and payout tables.
- Randomness improvements and optional VRF integration.
- Jackpots funded by a rolling treasury pool.
- Multi-chain deployments beyond Sepolia.
- Better analytics dashboards and player history views.
- Gas optimizations and batched reads for the UI.

## License

BSD-3-Clause-Clear. See `LICENSE`.
