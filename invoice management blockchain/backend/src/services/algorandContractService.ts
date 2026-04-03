import algosdk from 'algosdk'
import crypto from 'crypto'

const algod = new algosdk.Algodv2(
  process.env.ALGORAND_ALGOD_TOKEN || '',
  process.env.ALGO_NODE_URL || process.env.ALGORAND_ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
  process.env.ALGORAND_ALGOD_PORT || 443
)

function getAdminAccount() {
  const mnemonic = process.env.ALGO_ADMIN_MNEMONIC || process.env.ALGORAND_ANCHOR_MNEMONIC
  if (!mnemonic) throw new Error('ALGO_ADMIN_MNEMONIC is required')
  return algosdk.mnemonicToSecretKey(mnemonic)
}

async function withRetry(fn: () => Promise<any>, retries = 3) {
  let lastError: unknown = null
  for (let i = 0; i < retries; i += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)))
    }
  }
  throw lastError
}

export async function deployContract() {
  const approvalProgram = new Uint8Array()
  const clearProgram = new Uint8Array()
  const account = getAdminAccount()
  const suggested = await algod.getTransactionParams().do()

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: account.addr,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 64,
    numGlobalInts: 8,
    numLocalByteSlices: 0,
    numLocalInts: 0,
    suggestedParams: suggested,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
  })

  const signed = txn.signTxn(account.sk)
  const submit = await withRetry(() => algod.sendRawTransaction(signed).do())
  const confirmation = await algosdk.waitForConfirmation(algod, submit.txId, 4)
  return {
    app_id: confirmation['application-index'],
    txn_id: submit.txId,
  }
}

export async function createInvoiceOnChain(invoice_id: string, invoice_data: unknown) {
  const appId = Number(process.env.CONTRACT_APP_ID)
  if (!appId) throw new Error('CONTRACT_APP_ID is required')

  const account = getAdminAccount()
  const suggested = await algod.getTransactionParams().do()
  const hash = crypto.createHash('sha256').update(JSON.stringify(invoice_data)).digest('hex')

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    from: account.addr,
    appIndex: appId,
    suggestedParams: suggested,
    appArgs: [
      new TextEncoder().encode('create_invoice'),
      new TextEncoder().encode(invoice_id),
      new TextEncoder().encode(hash),
      new TextEncoder().encode(account.addr.toString()),
    ],
  })

  const signed = txn.signTxn(account.sk)
  const submit = await withRetry(() => algod.sendRawTransaction(signed).do())
  await algosdk.waitForConfirmation(algod, submit.txId, 4)

  return {
    app_id: appId,
    txn_id: submit.txId,
    invoice_hash: hash,
  }
}

export async function verifyInvoiceOnChain(invoice_id: string) {
  const appId = Number(process.env.CONTRACT_APP_ID)
  if (!appId) throw new Error('CONTRACT_APP_ID is required')

  const app = await withRetry(() => algod.getApplicationByID(appId).do())
  const state = app.params?.['global-state'] || []
  const prefix = `inv:${invoice_id}:`

  const read = (key: string) => {
    const encoded = Buffer.from(`${prefix}${key}`).toString('base64')
    const match = state.find((entry: any) => entry.key === encoded)
    if (!match) return null
    if (match.value?.type === 1) return Buffer.from(match.value.bytes, 'base64').toString('utf8')
    return match.value?.uint ?? null
  }

  return {
    hash: read('invoice_hash'),
    owner: read('owner'),
    status: read('status'),
  }
}

export const algorandContractService = {
  deployContract,
  createInvoiceOnChain,
  verifyInvoiceOnChain,
}
