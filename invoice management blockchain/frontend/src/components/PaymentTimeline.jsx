import { formatCurrency, formatDateTime } from '../utils/format'
import AlgorandBadge from './AlgorandBadge'
import PaymentSourceBadge from './PaymentSourceBadge'
import TxnLink from './TxnLink'

export default function PaymentTimeline({ payments }) {
  if (!payments?.length) {
    return <p className="text-sm text-gray-500">No payment events yet.</p>
  }

  const ordered = [...payments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
  return (
    <div className="space-y-3">
      {ordered.map((payment) => {
        const txnId = payment.txn_id || payment.algo_tx_id || payment.reference_number
        const source = payment.source || (payment.payment_method === 'algo' ? 'algorand' : 'manual')
        const status = payment.status || (payment.algo_verified ? 'confirmed' : 'pending')
        const isVerified = source === 'algorand' && status === 'confirmed'
        return (
          <div key={payment.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">{formatCurrency(payment.amount)}</div>
              <div className="flex items-center gap-2">
                <PaymentSourceBadge source={source} method={payment.payment_method} />
                <span className="text-xs font-medium text-gray-600 capitalize">{status}</span>
                <AlgorandBadge show={isVerified} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">{formatDateTime(payment.payment_date)}</span>
              {source === 'algorand' ? <TxnLink txnId={txnId} /> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
