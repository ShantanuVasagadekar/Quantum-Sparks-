## Invoice Anchoring Contract Schema

### Contract State Model

- `invoice_id` (string key): invoice identifier from DB
- `invoice_hash` (SHA-256 hex): deterministic hash of invoice payload
- `owner` (Algorand address): business/user wallet that owns the invoice
- `status` (enum string): `pending | paid | disputed`

### ABI Methods

- `create_invoice(invoice_id, invoice_hash, owner)`  
  Stores invoice metadata on-chain and initializes status as `pending`.

- `verify_invoice(invoice_id) -> (hash, owner, status)`  
  Reads the anchored tuple from app global state and returns it.

### DB to Contract Mapping

| DB Table | DB Column | Contract Field | Notes |
|---|---|---|---|
| `invoices` | `id` | `invoice_id` | Primary invoice identifier |
| `invoices` | `invoice_hash` or `anchor_hash` | `invoice_hash` | SHA-256 hash used for integrity |
| `users` | `wallet_address` (or `algo_wallet_address`) | `owner` | Owner wallet for invoice authority |
| `invoices` | `status` | `status` | Mapped: `draft/sent/partial -> pending`, `paid -> paid`, dispute flow -> `disputed` |

### Required Environment Variables

- `ALGO_NODE_URL`
- `ALGO_INDEXER_URL`
- `ALGO_ADMIN_MNEMONIC`
- `CONTRACT_APP_ID`

### Example Usage Snippets

```ts
import { deployContract, createInvoiceOnChain, verifyInvoiceOnChain } from '../backend/src/services/algorandContractService'

const deployment = await deployContract()
console.log(deployment.app_id, deployment.txn_id)

const anchored = await createInvoiceOnChain(invoice.id, invoice)
console.log(anchored.txn_id, anchored.invoice_hash)

const verification = await verifyInvoiceOnChain(invoice.id)
console.log(verification.hash, verification.owner, verification.status)
```
