const algosdk = require('algosdk')
const crypto = require('crypto')
const { computeInvoiceHash } = require('../utils/invoice.util')

const algodClient = new algosdk.Algodv2(
  process.env.ALGORAND_ALGOD_TOKEN || '',
  process.env.ALGORAND_ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
  process.env.ALGORAND_ALGOD_PORT || 443
)

/**
 * Anchor an invoice to Algorand by storing its canonical SHA-256 hash in a txn note.
 * Requires the full invoice object + line_items array.
 */
async function anchorInvoiceToAlgorand(invoice, lineItems) {
  const hash = computeInvoiceHash(invoice, lineItems)
  const mnemonic = process.env.ALGORAND_ANCHOR_MNEMONIC
  const receiver = process.env.ALGORAND_ANCHOR_RECEIVER

  if (!mnemonic || !receiver) {
    const simulatedTxId = `SIM_${crypto.randomBytes(16).toString('hex').toUpperCase()}`
    return {
      txId: simulatedTxId,
      hash,
      simulated: true,
      explorerUrl: null
    }
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic)
  const suggestedParams = await algodClient.getTransactionParams().do()

  const noteText = JSON.stringify({
    app: 'invoice-tracker',
    version: 2,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    sha256: hash,
    timestamp: new Date().toISOString()
  })
  const note = new TextEncoder().encode(noteText)

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: account.addr.toString(),
    to: receiver,
    amount: 0,
    note,
    suggestedParams
  })

  const signedTxn = txn.signTxn(account.sk)
  const { txId } = await algodClient.sendRawTransaction(signedTxn).do()
  await algosdk.waitForConfirmation(algodClient, txId, 4)

  return {
    txId,
    hash,
    simulated: false,
    explorerUrl: `${process.env.ALGORAND_EXPLORER_BASE_URL || 'https://testnet.algoexplorer.io/tx/'}${txId}`
  }
}

/**
 * Verify an invoice by:
 *  1. Recomputing the hash from current DB data (invoice + line items)
 *  2. Fetching the on-chain txn note
 *  3. Comparing recomputed hash vs on-chain hash
 *
 * This catches post-anchor tampering because the hash is recomputed, not pulled from a stored column.
 */
async function verifyInvoiceOnChain(txId, invoice, lineItems) {
  try {
    if (!txId) {
      return { verified: false, message: 'No chain proof is linked to this invoice' }
    }
    if (txId.startsWith('SIM_')) {
      return {
        verified: false,
        simulated: true,
        message: 'Simulated — not a real on-chain transaction'
      }
    }

    // Step 1: Recompute hash from current data
    const recomputedHash = computeInvoiceHash(invoice, lineItems)

    // Step 2: Fetch the on-chain txn and extract the note
    const txInfo = await algodClient.pendingTransactionInformation(txId).do()
    const noteRaw = txInfo?.txn?.txn?.note
    if (!noteRaw) return { verified: false, message: 'No note found on transaction' }

    const noteString = typeof noteRaw === 'string'
      ? Buffer.from(noteRaw, 'base64').toString('utf8')
      : Buffer.from(noteRaw).toString('utf8')
    const note = JSON.parse(noteString)

    // Step 3: Three-way comparison
    const onChainHash = note.sha256
    const hashesMatch = recomputedHash === onChainHash
    const dataIntact = hashesMatch // data hasn't changed since anchoring

    return {
      verified: dataIntact,
      recomputedHash,
      onChainHash,
      invoiceId: note.invoice_id,
      timestamp: note.timestamp,
      message: dataIntact
        ? 'Integrity verified — invoice data matches on-chain hash'
        : 'INTEGRITY FAILURE — invoice data has been modified since anchoring'
    }
  } catch (err) {
    return { verified: false, message: err.message }
  }
}

module.exports = {
  algodClient,
  computeInvoiceHash,
  anchorInvoiceToAlgorand,
  verifyInvoiceOnChain
}
