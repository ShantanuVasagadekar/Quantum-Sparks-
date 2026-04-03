import { useNavigate } from 'react-router-dom'
import InvoiceForm from '../components/InvoiceForm'

function CreateInvoicePage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Create Invoice</h2>
        <p className="mt-1 text-sm text-slate-400">Prepare invoice details, itemized charges, and billing dates.</p>
      </div>
      <InvoiceForm onSuccess={() => navigate('/invoices')} />
    </section>
  )
}

export default CreateInvoicePage
