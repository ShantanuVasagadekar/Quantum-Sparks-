import { useNavigate } from 'react-router-dom'
import InvoiceForm from '../components/InvoiceForm'

function CreateInvoicePage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-6">
      <div className="mb-2 border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
        <p className="mt-1 text-sm text-gray-500">Prepare invoice details, itemized charges, and billing dates.</p>
      </div>
      <InvoiceForm onSuccess={() => navigate('/invoices')} />
    </section>
  )
}

export default CreateInvoicePage
