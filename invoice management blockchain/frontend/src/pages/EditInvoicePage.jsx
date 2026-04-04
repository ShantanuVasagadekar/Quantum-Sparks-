import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import InvoiceForm from '../components/InvoiceForm'

function EditInvoicePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    api.get(`/invoices/${id}`)
      .then(res => {
        if (mounted) {
          setInvoice(res.data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load invoice')
          setLoading(false)
        }
      })
    return () => { mounted = false }
  }, [id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  if (!invoice) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Edit Invoice {invoice.invoice_number}</h2>
        <p className="mt-1 text-sm text-gray-500">Update invoice details and resend if necessary.</p>
      </div>

      <InvoiceForm 
        invoice={invoice} 
        onSuccess={() => navigate('/invoices')} 
      />
    </div>
  )
}

export default EditInvoicePage
