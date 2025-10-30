# CipherMarkets

> Privacy-preserving prediction markets powered by Zama FHEVM

CipherMarkets is a decentralized prediction market platform that keeps all user positions, orders, and strategies confidential using Zama’s Fully Homomorphic Encryption (FHE) and FHEVM. Create and trade markets with verifiable outcomes while your data stays encrypted end‑to‑end.

---

## Why CipherMarkets

Traditional prediction markets expose trades and positions on-chain, enabling copy-trading, front‑running and bias. CipherMarkets processes encrypted orders and aggregates encrypted outcomes while preserving public verifiability of market results.

- 🔐 Encrypted positions and orders (no plaintext on-chain)
- 🔒 On‑chain aggregation over ciphertexts (no decryption in contracts)
- 🌐 Verifiable market resolution without revealing individual bets
- 🧩 Fits governance polls, sports/finance/tech predictions, research markets

---

## Zama FHEVM Integration

FHEVM (Fully Homomorphic Encryption Virtual Machine) lets smart contracts compute over encrypted data. With Zama FHE, CipherMarkets keeps your trading intent private while enabling correct settlement.

```
Trader → FHE Encrypt → Encrypted Order → FHEVM AMM/OrderBook
                                 └──> Encrypted Aggregation → Verifiable Settlement
```

Key properties:
- No plaintext positions or order sizes stored on-chain
- Encrypted operations (place, cancel, settle)
- Public proofs and transparent resolution after market close

---

## Getting Started

Prerequisites
- Node.js 18+
- MetaMask (or compatible Web3 wallet)
- Sepolia ETH (testnet)

Setup
```bash
git clone https://github.com/bloonenjoyer/CipherMarkets
cd CipherMarkets
npm install
cp .env.example .env.local
```

Deploy
```bash
npm run deploy:sepolia
```

Run
```bash
npm run dev
```

---

## How It Works

1) Create market: define question, oracle, resolution rules
2) Place encrypted orders: client encrypts price/size locally
3) Match/AMM on FHEVM: contracts process encrypted orders
4) Resolve market: oracle posts outcome, settlement computed
5) Payouts: users redeem winnings without exposing trades

Privacy model
- Orders/positions: encrypted
- Matching/AMM math: over ciphertexts
- Result: public and verifiable
- Metadata: minimized; unlinkable user intent

---

## Architecture

| Layer            | Technology         | Role                                 |
|------------------|--------------------|--------------------------------------|
| Encryption       | Zama FHE           | Client‑side encryption of orders     |
| Smart contracts  | Solidity + FHEVM   | Encrypted matching/settlement        |
| Blockchain       | Ethereum Sepolia   | Decentralized execution and storage  |
| Frontend         | React + TypeScript | Trading UI and local FHE operations  |
| Tooling          | Hardhat, Ethers    | Build, test, deploy                  |

Core contracts
- MarketFactory: creates markets
- EncryptedOrderBook/AMM: handles encrypted orders/liquidity
- Oracle/Resolution: posts outcome and triggers settlement

---

## Market Types

- Sports and events (live and pre‑match)
- Crypto and macro predictions
- Tech, policy, and research questions
- DAO governance polls (private choices)

---

## Security & Privacy

- Ballots/orders never decrypted by contracts
- Zero‑knowledge‑style verifiability of outcomes
- No plaintext state for orders or positions on‑chain
- Recommended: independent audits for circuits and contracts

Best practices
- Use testnet keys during development
- Rotate FHE keys per market
- Minimize off‑chain metadata collection
- Monitor gas impact of FHE operations

---

## Roadmap

- v1: Core markets, encrypted orders, settlement on FHEVM
- v1.1: Encrypted liquidity pools, fee rebates
- v1.2: Cross‑market analytics (privacy‑preserving)
- v2: Mobile UI, cross‑chain deployment, oracle network

---

## Contributing

Contributions welcome:
- FHE performance and batching
- Contract security and audits
- Oracle and resolution mechanisms
- UX for private trading flows

---

## Resources

- Zama: https://www.zama.ai
- FHEVM Docs: https://docs.zama.ai/fhevm
- Sepolia Explorer: https://sepolia.etherscan.io

---

## License

MIT — see LICENSE.

---

Built with Zama FHEVM — encrypted intent, fair settlement, public verifiability.
