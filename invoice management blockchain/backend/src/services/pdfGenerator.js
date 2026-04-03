const fs = require('fs')
const PDFDocument = require('pdfkit')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function pickFonts(doc) {
  const regularCandidates = [
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/Library/Fonts/Arial.ttf'
  ]
  const boldCandidates = [
    'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/Library/Fonts/Arial Bold.ttf'
  ]

  const regular = regularCandidates.find((path) => fs.existsSync(path))
  const bold = boldCandidates.find((path) => fs.existsSync(path))

  if (regular && bold) {
    doc.registerFont('InvoiceRegular', regular)
    doc.registerFont('InvoiceBold', bold)
    return { regular: 'InvoiceRegular', bold: 'InvoiceBold' }
  }

  return { regular: 'Helvetica', bold: 'Helvetica-Bold' }
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN')
}

function formatCurrency(value) {
  return `₹ ${Number(value || 0).toFixed(2)}`
}

function statusLabel(status) {
  const map = {
    paid: 'Paid',
    partial: 'Partly Paid',
    overdue: 'Overdue',
    sent: 'Invoice Sent',
    draft: 'Not Sent Yet',
    cancelled: 'Cancelled'
  }
  return map[status] || 'Not Sent Yet'
}

function shortTxId(txId) {
  if (!txId) return '-'
  if (txId.length <= 24) return txId
  return `${txId.slice(0, 12)}...${txId.slice(-8)}`
}

function drawHeader(doc, invoice, business, fonts) {
  const leftX = MARGIN
  const rightX = MARGIN + CONTENT_WIDTH - 210
  let y = MARGIN

  doc.font(fonts.bold).fontSize(19).fillColor('#111827')
  doc.text(business?.company_name || 'Your Business Name', leftX, y, { width: 270 })

  y += 28
  doc.font(fonts.regular).fontSize(10).fillColor('#4B5563')
  doc.text(business?.address || '123 Street Address', leftX, y, { width: 290 })
  y += 14
  doc.text(business?.city_state_zip || 'Mumbai, MH 400001', leftX, y, { width: 290 })
  y += 14
  doc.text(`Phone: ${business?.phone || '(000) 000-0000'}`, leftX, y, { width: 290 })
  y += 14
  doc.text(`Email: ${business?.email || 'contact@yourbusiness.com'}`, leftX, y, { width: 290 })
  if (business?.gst_number) {
    y += 14
    doc.text(`GST No: ${business.gst_number}`, leftX, y, { width: 290 })
  }

  let rightY = MARGIN
  doc.font(fonts.bold).fontSize(30).fillColor('#111827')
  doc.text('INVOICE', rightX, rightY, { width: 210, align: 'right' })

  rightY += 42
  const labels = [
    ['Invoice Number', invoice.invoice_number || '-'],
    ['Issue Date', formatDate(invoice.issue_date || invoice.created_at)],
    ['Due Date', formatDate(invoice.due_date)],
    ['Status', statusLabel(invoice.status)]
  ]

  for (const [label, value] of labels) {
    doc.font(fonts.bold).fontSize(9).fillColor('#6B7280')
    doc.text(label, rightX, rightY, { width: 90 })
    doc.font(fonts.regular).fontSize(10).fillColor('#111827')
    doc.text(value, rightX + 90, rightY, { width: 120, align: 'right' })
    rightY += 16
  }

  const endY = Math.max(y, rightY) + 14
  doc.moveTo(MARGIN, endY).lineTo(MARGIN + CONTENT_WIDTH, endY).strokeColor('#D1D5DB').lineWidth(1).stroke()
  return endY + 18
}

function drawBillTo(doc, client, y, fonts) {
  doc.font(fonts.bold).fontSize(12).fillColor('#111827')
  doc.text('Bill To', MARGIN, y)

  const boxY = y + 16
  const boxHeight = 72
  doc.rect(MARGIN, boxY, CONTENT_WIDTH, boxHeight).strokeColor('#E5E7EB').lineWidth(1).stroke()

  const clientName = client?.name || 'Client Name'
  const companyName = client?.company_name || ''
  const email = client?.email || '-'
  const phone = client?.phone || '-'

  doc.font(fonts.bold).fontSize(11).fillColor('#111827')
  doc.text(clientName, MARGIN + 12, boxY + 12, { width: CONTENT_WIDTH - 24 })

  doc.font(fonts.regular).fontSize(10).fillColor('#4B5563')
  if (companyName) {
    doc.text(companyName, MARGIN + 12, boxY + 28, { width: CONTENT_WIDTH - 24 })
    doc.text(`Email: ${email}   |   Phone: ${phone}`, MARGIN + 12, boxY + 44, { width: CONTENT_WIDTH - 24 })
  } else {
    doc.text(`Email: ${email}   |   Phone: ${phone}`, MARGIN + 12, boxY + 32, { width: CONTENT_WIDTH - 24 })
  }

  return boxY + boxHeight + 22
}

function drawTableHeader(doc, y, columns, fonts) {
  const headerHeight = 26
  doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight).fillColor('#F3F4F6').fill()
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor('#D1D5DB').lineWidth(1).stroke()
  doc.moveTo(MARGIN, y + headerHeight).lineTo(MARGIN + CONTENT_WIDTH, y + headerHeight).strokeColor('#D1D5DB').lineWidth(1).stroke()

  doc.font(fonts.bold).fontSize(10).fillColor('#374151')
  doc.text('Description', columns.description.x + 8, y + 8, { width: columns.description.width - 16, align: 'left' })
  doc.text('Quantity', columns.quantity.x, y + 8, { width: columns.quantity.width, align: 'center' })
  doc.text('Rate', columns.rate.x, y + 8, { width: columns.rate.width - 8, align: 'right' })
  doc.text('Amount', columns.amount.x, y + 8, { width: columns.amount.width - 8, align: 'right' })

  return y + headerHeight
}

function drawTable(doc, invoice, lineItems, y, fonts) {
  const quantityWidth = 80
  const rateWidth = 100
  const amountWidth = 110
  const descriptionWidth = CONTENT_WIDTH - quantityWidth - rateWidth - amountWidth
  const columns = {
    description: { x: MARGIN, width: descriptionWidth },
    quantity: { x: MARGIN + descriptionWidth, width: quantityWidth },
    rate: { x: MARGIN + descriptionWidth + quantityWidth, width: rateWidth },
    amount: { x: MARGIN + descriptionWidth + quantityWidth + rateWidth, width: amountWidth }
  }

  let cursorY = drawTableHeader(doc, y, columns, fonts)
  const rowHeight = 24
  let computedSubtotal = 0

  for (const item of lineItems) {
    if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN - 220) {
      doc.addPage()
      cursorY = MARGIN
      cursorY = drawTableHeader(doc, cursorY, columns, fonts)
    }

    const quantity = Number(item.quantity ?? item.qty ?? 0)
    const rate = Number(item.unit_price ?? item.rate ?? 0)
    const amount = Number((quantity * rate).toFixed(2))
    computedSubtotal += amount

    doc.moveTo(MARGIN, cursorY + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, cursorY + rowHeight).strokeColor('#E5E7EB').lineWidth(1).stroke()

    doc.font(fonts.regular).fontSize(10).fillColor('#111827')
    doc.text(item.description || item.name || '-', columns.description.x + 8, cursorY + 7, {
      width: columns.description.width - 16,
      align: 'left',
      ellipsis: true
    })
    doc.text(quantity.toFixed(2), columns.quantity.x, cursorY + 7, { width: columns.quantity.width, align: 'center' })
    doc.text(formatCurrency(rate), columns.rate.x, cursorY + 7, { width: columns.rate.width - 8, align: 'right' })
    doc.text(formatCurrency(amount), columns.amount.x, cursorY + 7, { width: columns.amount.width - 8, align: 'right' })

    cursorY += rowHeight
  }

  if (lineItems.length === 0) {
    doc.moveTo(MARGIN, cursorY + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, cursorY + rowHeight).strokeColor('#E5E7EB').lineWidth(1).stroke()
    doc.font(fonts.regular).fontSize(10).fillColor('#6B7280')
    doc.text('No line items', MARGIN + 8, cursorY + 7)
    cursorY += rowHeight
  }

  return { y: cursorY + 20, computedSubtotal }
}

function drawTotals(doc, invoice, computedSubtotal, y, fonts) {
  const subtotal = Number(invoice.subtotal_amount ?? computedSubtotal ?? 0)
  const cgst = Number(invoice.cgst_amount || 0)
  const sgst = Number(invoice.sgst_amount || 0)
  const igst = Number(invoice.igst_amount || 0)
  const tax = Number(invoice.tax_amount || 0)
  const discount = Number(invoice.discount_amount || 0)
  const total = Number(invoice.total_amount ?? subtotal + tax - discount)

  const boxWidth = 230
  const boxX = MARGIN + CONTENT_WIDTH - boxWidth
  let rowY = y

  const rows = [
    ['Taxable Amount', formatCurrency(subtotal)]
  ]
  if (cgst > 0 || sgst > 0) {
    rows.push(['CGST', formatCurrency(cgst)])
    rows.push(['SGST', formatCurrency(sgst)])
  } else if (igst > 0) {
    rows.push(['IGST', formatCurrency(igst)])
  } else if (tax > 0) {
    rows.push(['Tax Amount', formatCurrency(tax)])
  }
  
  if (discount > 0) {
    rows.push(['Discount', formatCurrency(discount)])
  }

  doc.moveTo(boxX, rowY - 8).lineTo(boxX + boxWidth, rowY - 8).strokeColor('#D1D5DB').lineWidth(1).stroke()

  for (const [label, value] of rows) {
    doc.font(fonts.regular).fontSize(10).fillColor('#374151')
    doc.text(label, boxX, rowY, { width: 90 })
    doc.text(value, boxX + 90, rowY, { width: 140, align: 'right' })
    rowY += 18
  }

  doc.moveTo(boxX, rowY - 4).lineTo(boxX + boxWidth, rowY - 4).strokeColor('#9CA3AF').lineWidth(1).stroke()
  doc.font(fonts.bold).fontSize(12).fillColor('#111827')
  doc.text('TOTAL', boxX, rowY + 4, { width: 90 })
  doc.text(formatCurrency(total), boxX + 90, rowY + 4, { width: 140, align: 'right' })

  return rowY + 28
}

function drawVerification(doc, invoice, y, fonts) {
  const txId = invoice.anchor_tx_id || invoice.algo_anchor_tx_id
  const isVerified = Boolean(txId) && !invoice.anchor_simulated
  const verifyStatus = isVerified ? 'Verified on Algorand' : 'Not Verified'

  const boxHeight = 64
  doc.rect(MARGIN, y, CONTENT_WIDTH, boxHeight).strokeColor('#E5E7EB').lineWidth(1).stroke()

  doc.font(fonts.bold).fontSize(11).fillColor('#111827')
  doc.text('Verification', MARGIN + 12, y + 10)
  doc.font(fonts.regular).fontSize(10).fillColor('#374151')
  doc.text(`Status: ${verifyStatus}`, MARGIN + 12, y + 28, { width: 260 })
  doc.text(`Transaction ID: ${shortTxId(txId)}`, MARGIN + 12, y + 44, { width: 300 })
  doc.font(fonts.regular).fontSize(9).fillColor('#6B7280')
  doc.text('This invoice is secured using blockchain technology.', MARGIN + 300, y + 36, {
    width: CONTENT_WIDTH - 312,
    align: 'right'
  })

  return y + boxHeight + 20
}

function drawFooter(doc, business, fonts) {
  const y = PAGE_HEIGHT - 78
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor('#D1D5DB').lineWidth(1).stroke()
  doc.font(fonts.regular).fontSize(10).fillColor('#374151')
  doc.text('Thank you for your business', MARGIN, y + 14, { width: CONTENT_WIDTH, align: 'center' })
  doc.font(fonts.regular).fontSize(9).fillColor('#6B7280')
  doc.text(`${business?.company_name || ''}  |  ${business?.phone || ''}  |  ${business?.email || ''}`, MARGIN, y + 30, {
    width: CONTENT_WIDTH,
    align: 'center'
  })
}

function generateInvoicePDF(invoice, client, lineItems, payments, business) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const fonts = pickFonts(doc)

  const items = Array.isArray(lineItems) ? lineItems : []

  let y = drawHeader(doc, invoice || {}, business || {}, fonts)
  y = drawBillTo(doc, client || {}, y, fonts)
  const tableResult = drawTable(doc, invoice || {}, items, y, fonts)
  y = tableResult.y

  if (y > PAGE_HEIGHT - 220) {
    doc.addPage()
    y = MARGIN
  }

  y = drawTotals(doc, invoice || {}, tableResult.computedSubtotal, y, fonts)
  y = drawVerification(doc, invoice || {}, y, fonts)

  if (y > PAGE_HEIGHT - 130) {
    doc.addPage()
  }

  drawFooter(doc, business || {}, fonts)

  doc.end()
  return doc
}

module.exports = {
  generateInvoicePDF
}
