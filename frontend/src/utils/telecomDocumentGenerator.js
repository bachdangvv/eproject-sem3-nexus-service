import { STATUTORY_TAX_RATE_PERCENT } from '../services/taxConfig.js'
import { calculateInvoiceTotals } from '../services/billingService.js'
import { createPdfBuilder, toPdfSafeText, wrapPdfText } from './pdfBuilder.js'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeXml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function resolveInvoiceData(invoice = {}) {
  const defaultItems = [
    {
      desc: 'Broadband FTTx 500Mbps Metro Port Monthly Recurring Charge',
      quantity: 1,
      unitPrice: 3018.75,
      amount: 3018.75,
    },
  ]
  const items = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : defaultItems
  const totals = calculateInvoiceTotals(items, invoice.previousBalance || 0, 0)
  const paid =
    invoice.paidAmount !== undefined && invoice.paidAmount !== null
      ? Number(invoice.paidAmount)
      : invoice.status === 'PAID'
      ? totals.totalPayable
      : 0
  const balance =
    invoice.remainingBalance !== undefined
      ? Number(invoice.remainingBalance)
      : Math.max(0, Number((totals.totalPayable - paid).toFixed(2)))

  return {
    invoiceId: invoice.invoiceId || 'INV-2026-03-0881',
    customerName: invoice.customerName || 'AlphaCorp Technology Solutions JSC',
    taxId: invoice.taxId || 'N/A',
    accountId: invoice.accountId || 'B101000000000089',
    orderId: invoice.orderId || 'B0000001089',
    issuedDate: invoice.issuedDate || '2026-04-01',
    dueDate: invoice.dueDate || '2026-04-15',
    billingCycle: invoice.billingCycle || '01/03/2026 - 31/03/2026',
    status: invoice.status || 'PENDING',
    items,
    subtotal: totals.subtotal,
    tax: totals.serviceTax,
    previousBalance: totals.previousBalance,
    grandTotal: totals.totalPayable,
    paid,
    balance,
  }
}

function drawDocumentBanner(pdf, { title, subtitle, badgeText, referenceId, metaLine }) {
  pdf.drawText(title, 45, 792, { size: 16, bold: true, color: [0.12, 0.11, 0.29] })
  pdf.drawText(subtitle, 45, 775, { size: 9, color: [0.39, 0.45, 0.55] })

  pdf.drawRect(405, 783, 145, 18, { fillColor: [0.93, 0.95, 0.99], strokeColor: [0.78, 0.82, 0.98] })
  pdf.drawText(badgeText, 477.5, 788.5, { size: 7.5, bold: true, color: [0.26, 0.22, 0.79], align: 'center' })
  pdf.drawText(referenceId, 550, 767, { size: 12, bold: true, color: [0.26, 0.22, 0.79], align: 'right' })
  pdf.drawText(metaLine, 550, 753, { size: 8.5, color: [0.39, 0.45, 0.55], align: 'right' })

  pdf.drawLine(45, 742, 550, 742, [0.31, 0.27, 0.9], 1.5)
  pdf.setY(724)
}

/**
 * Generates an unsigned A4 PDF 1.4 binary for an invoice copy/preview.
 */
export function generateInvoicePdfBytes(invoice) {
  const data = resolveInvoiceData(invoice)
  const pdf = createPdfBuilder()

  drawDocumentBanner(pdf, {
    title: 'NEXUS TELECOM CORPORATION',
    subtitle: 'License: 198/GP-BTTTT - Carrier Tax ID: 0102345678',
    badgeText: 'INVOICE COPY (PREVIEW)',
    referenceId: `#${data.invoiceId}`,
    metaLine: `Issued: ${data.issuedDate} | Due: ${data.dueDate} | Status: ${data.status}`,
  })

  pdf.drawRect(45, 650, 245, 76, { fillColor: [0.97, 0.98, 0.99], strokeColor: [0.89, 0.91, 0.94] })
  pdf.drawText('SERVICE PROVIDER', 55, 712, { size: 8, bold: true, color: [0.39, 0.45, 0.55] })
  pdf.drawText('Nexus Telecom Corporation', 55, 697, { size: 10, bold: true, color: [0.06, 0.09, 0.16] })
  pdf.drawText('54 Lieu Giai, Ba Dinh, Hanoi', 55, 683, { size: 8.5, color: [0.28, 0.33, 0.41] })
  pdf.drawText('Tax ID: 0102345678 | Hotline: 1800-8098', 55, 670, { size: 8.5, color: [0.28, 0.33, 0.41] })
  pdf.drawText(`Cycle: ${data.billingCycle}`, 55, 657, { size: 8.5, color: [0.28, 0.33, 0.41] })

  pdf.drawRect(305, 650, 245, 76, { fillColor: [0.97, 0.98, 0.99], strokeColor: [0.89, 0.91, 0.94] })
  pdf.drawText('SUBSCRIBER / CLIENT', 315, 712, { size: 8, bold: true, color: [0.39, 0.45, 0.55] })
  const customerLines = wrapPdfText(data.customerName, 36).slice(0, 2)
  pdf.drawText(customerLines[0], 315, 697, { size: 9.5, bold: true, color: [0.06, 0.09, 0.16] })
  if (customerLines[1]) {
    pdf.drawText(customerLines[1], 315, 685, { size: 9, bold: true, color: [0.06, 0.09, 0.16] })
  }
  pdf.drawText(`Tax ID (MST): ${data.taxId}`, 315, 672, { size: 8.5, color: [0.28, 0.33, 0.41] })
  pdf.drawText(`Account: ${data.accountId} | Order: ${data.orderId}`, 315, 659, { size: 8.5, color: [0.26, 0.22, 0.79] })

  const drawItemsHeader = () => {
    const headerTop = pdf.getY()
    pdf.drawRect(45, headerTop - 22, 505, 22, { fillColor: [0.95, 0.96, 0.98], strokeColor: [0.85, 0.88, 0.92] })
    const textY = headerTop - 15
    pdf.drawText('#', 55, textY, { size: 8.5, bold: true, color: [0.28, 0.33, 0.41] })
    pdf.drawText('Description of Telecom Services / Equipment', 78, textY, { size: 8.5, bold: true, color: [0.28, 0.33, 0.41] })
    pdf.drawText('Qty', 375, textY, { size: 8.5, bold: true, color: [0.28, 0.33, 0.41], align: 'right' })
    pdf.drawText('Unit Price', 455, textY, { size: 8.5, bold: true, color: [0.28, 0.33, 0.41], align: 'right' })
    pdf.drawText('Amount (USD)', 542, textY, { size: 8.5, bold: true, color: [0.28, 0.33, 0.41], align: 'right' })
    pdf.setY(headerTop - 26)
  }

  pdf.setY(628)
  drawItemsHeader()

  data.items.forEach((it, idx) => {
    const descLines = wrapPdfText(it.desc || 'Telecom Service Charge', 48)
    const rowHeight = Math.max(20, descLines.length * 12 + 8)
    if (pdf.ensureSpace(rowHeight + 12)) {
      pdf.setY(780)
      drawItemsHeader()
    }

    const rowTop = pdf.getY()
    const firstLineY = rowTop - 12
    const qty = it.quantity || 1
    const unitPrice = Number(it.unitPrice ?? it.amount ?? 0).toFixed(2)
    const amount = Number(it.amount || 0).toFixed(2)

    pdf.drawText(String(idx + 1), 55, firstLineY, { size: 8.5 })
    descLines.forEach((line, lineIdx) => {
      pdf.drawText(line, 78, firstLineY - lineIdx * 12, { size: 8.5 })
    })
    pdf.drawText(String(qty), 375, firstLineY, { size: 8.5, align: 'right' })
    pdf.drawText(`$${unitPrice}`, 455, firstLineY, { size: 8.5, align: 'right' })
    pdf.drawText(`$${amount}`, 542, firstLineY, { size: 8.5, bold: true, align: 'right' })

    const bottomY = rowTop - rowHeight
    pdf.drawLine(45, bottomY, 550, bottomY, [0.9, 0.92, 0.95], 0.5)
    pdf.setY(bottomY)
  })

  pdf.ensureSpace(145)
  pdf.moveDown(18)

  const summaryLeftX = 315
  const summaryRightX = 545
  const drawSummaryRow = (label, value, { bold = false, color = [0.12, 0.16, 0.23], size = 9.5 } = {}) => {
    const y = pdf.getY()
    pdf.drawText(label, summaryLeftX, y, { size, bold, color })
    pdf.drawText(value, summaryRightX, y, { size, bold: true, color, align: 'right' })
    pdf.moveDown(16)
  }

  drawSummaryRow('Net Service Subtotal:', `$${data.subtotal.toFixed(2)}`)
  drawSummaryRow(`Statutory Telecom Tax (${STATUTORY_TAX_RATE_PERCENT}%):`, `+$${data.tax.toFixed(2)}`, {
    color: [0.26, 0.22, 0.79],
  })
  if (data.previousBalance > 0) {
    drawSummaryRow('Prior Balance Forward:', `+$${data.previousBalance.toFixed(2)}`)
  }

  pdf.drawLine(summaryLeftX, pdf.getY() + 8, summaryRightX, pdf.getY() + 8, [0.79, 0.83, 0.88], 1)
  pdf.moveDown(4)
  drawSummaryRow('Total Amount Due:', `$${data.grandTotal.toFixed(2)}`, {
    bold: true,
    size: 11,
    color: [0.12, 0.11, 0.29],
  })
  drawSummaryRow('Total Paid / Remitted:', `$${data.paid.toFixed(2)}`, {
    color: [0.02, 0.59, 0.41],
  })
  drawSummaryRow('Remaining Balance:', `$${data.balance.toFixed(2)}`, {
    bold: true,
    color: data.balance > 0 ? [0.73, 0.11, 0.11] : [0.02, 0.59, 0.41],
  })

  pdf.moveDown(10)
  const noticeBottom = pdf.getY() - 36
  pdf.drawRect(45, noticeBottom, 505, 38, { fillColor: [0.97, 0.98, 0.99], strokeColor: [0.85, 0.88, 0.92] })
  pdf.drawText(
    'SYSTEM PREVIEW DOCUMENT - UNSIGNED COPY FOR BILLING RECONCILIATION',
    297.5,
    noticeBottom + 23,
    { size: 8.5, bold: true, color: [0.28, 0.33, 0.41], align: 'center' }
  )
  pdf.drawText(
    `Generated: ${new Date().toISOString()} | Not a tax-authority certified electronic signature`,
    297.5,
    noticeBottom + 10,
    { size: 8, color: [0.39, 0.45, 0.55], align: 'center' }
  )

  return pdf.buildBytes()
}

export function downloadInvoiceDocument(invoice) {
  if (!invoice) return
  const data = resolveInvoiceData(invoice)
  const pdfBytes = generateInvoicePdfBytes(invoice)
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  triggerDownload(blob, `Invoice_${data.invoiceId}.pdf`)
}

/**
 * Generates an A4 PDF binary for the subscriber billing statement.
 */
export function generateStatementPdfBytes(customerProfile, circuits = [], invoices = [], totalOutstanding = 0) {
  const customerName = customerProfile?.customerName || 'Subscriber'
  const taxId = customerProfile?.taxId || 'N/A'
  const ident = customerProfile?.identifier || 'N/A'
  const pdf = createPdfBuilder()

  drawDocumentBanner(pdf, {
    title: 'NEXUS TELECOM CORPORATION',
    subtitle: `Period: Q1/2026 (01/01/2026 - 31/03/2026) - Generated: ${new Date().toLocaleDateString('en-GB')}`,
    badgeText: 'SUBSCRIBER STATEMENT',
    referenceId: ident,
    metaLine: `Total Outstanding Balance: $${Number(totalOutstanding).toFixed(2)}`,
  })

  pdf.drawRect(45, 672, 505, 56, { fillColor: [0.97, 0.98, 0.99], strokeColor: [0.89, 0.91, 0.94] })
  pdf.drawText('SUBSCRIBER IDENTITY', 55, 714, { size: 8.5, bold: true, color: [0.39, 0.45, 0.55] })
  pdf.drawText(`Corporate Name: ${customerName}`, 55, 699, { size: 9.5, bold: true })
  pdf.drawText(`Tax ID (MST): ${taxId}   |   Account Identifier: ${ident}`, 55, 684, { size: 8.5, color: [0.28, 0.33, 0.41] })

  pdf.setY(650)
  pdf.drawText('Bound Dedicated Circuits', 45, pdf.getY(), { size: 10.5, bold: true })
  pdf.moveDown(16)

  if (circuits.length === 0) {
    pdf.drawText('No active dedicated circuits currently registered.', 55, pdf.getY(), { size: 8.5, color: [0.45, 0.5, 0.58] })
    pdf.moveDown(16)
  } else {
    circuits.forEach((c) => {
      pdf.ensureSpace(20)
      const line = `- ${c.serviceTitle || c.planName || 'Circuit'} (${c.accountId || 'N/A'}) | IP WAN: ${c.networkConfig?.ipWan || c.ipWan || 'Dynamic'}`
      wrapPdfText(line, 90).forEach((chunk) => {
        pdf.drawText(chunk, 55, pdf.getY(), { size: 8.5 })
        pdf.moveDown(13)
      })
    })
  }

  pdf.moveDown(10)
  pdf.ensureSpace(60)
  pdf.drawText(`Invoice History & ${STATUTORY_TAX_RATE_PERCENT}% Statutory Tax Accounting`, 45, pdf.getY(), {
    size: 10.5,
    bold: true,
  })
  pdf.moveDown(12)

  const drawTableHeader = () => {
    const top = pdf.getY()
    pdf.drawRect(45, top - 20, 505, 20, { fillColor: [0.95, 0.96, 0.98], strokeColor: [0.85, 0.88, 0.92] })
    const ty = top - 13
    pdf.drawText('Invoice ID', 52, ty, { size: 8, bold: true })
    pdf.drawText('Billing Cycle', 155, ty, { size: 8, bold: true })
    pdf.drawText('Subtotal', 310, ty, { size: 8, bold: true, align: 'right' })
    pdf.drawText(`Tax ${STATUTORY_TAX_RATE_PERCENT}%`, 388, ty, { size: 8, bold: true, align: 'right' })
    pdf.drawText('Balance', 465, ty, { size: 8, bold: true, align: 'right' })
    pdf.drawText('Status', 542, ty, { size: 8, bold: true, align: 'right' })
    pdf.setY(top - 24)
  }

  drawTableHeader()

  if (invoices.length === 0) {
    pdf.drawText('No invoices found on record.', 297.5, pdf.getY() - 12, { size: 8.5, align: 'center' })
  } else {
    invoices.forEach((inv) => {
      if (pdf.ensureSpace(24)) {
        pdf.setY(780)
        drawTableHeader()
      }
      const resolved = resolveInvoiceData(inv)
      const rowY = pdf.getY() - 13
      pdf.drawText(resolved.invoiceId, 52, rowY, { size: 8.5, bold: true })
      pdf.drawText(resolved.billingCycle, 155, rowY, { size: 8 })
      pdf.drawText(`$${resolved.subtotal.toFixed(2)}`, 310, rowY, { size: 8.5, align: 'right' })
      pdf.drawText(`$${resolved.tax.toFixed(2)}`, 388, rowY, { size: 8.5, align: 'right' })
      pdf.drawText(`$${resolved.balance.toFixed(2)}`, 465, rowY, { size: 8.5, bold: true, align: 'right' })
      pdf.drawText(resolved.status, 542, rowY, { size: 8, bold: true, align: 'right' })
      const bottomY = pdf.getY() - 20
      pdf.drawLine(45, bottomY, 550, bottomY, [0.9, 0.92, 0.95], 0.5)
      pdf.setY(bottomY)
    })
  }

  return pdf.buildBytes()
}

export function downloadStatementDocument(customerProfile, circuits = [], invoices = [], totalOutstanding = 0) {
  const customerName = toPdfSafeText(customerProfile?.customerName || 'Subscriber')
  const pdfBytes = generateStatementPdfBytes(customerProfile, circuits, invoices, totalOutstanding)
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  triggerDownload(blob, `Statement_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_Q1_2026.pdf`)
}

/**
 * Builds an unsigned XML billing data payload without fake CA digital signature blocks.
 */
export function buildInvoiceXmlContent(invoice) {
  const data = resolveInvoiceData(invoice)
  const lineItemsXml = data.items
    .map(
      (it, idx) => `      <HHDVu>
        <STT>${idx + 1}</STT>
        <THHDVu>${escapeXml(it.desc)}</THHDVu>
        <DVTinh>Month</DVTinh>
        <SLuong>${Number(it.quantity || 1)}</SLuong>
        <DGia>${Number(it.unitPrice ?? it.amount ?? 0).toFixed(2)}</DGia>
        <TThien>${Number(it.amount || 0).toFixed(2)}</TThien>
        <TSuat>${STATUTORY_TAX_RATE_PERCENT}%</TSuat>
      </HHDVu>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<HDon xmlns="http://laphoadon.gdt.gov.vn/2026/v2">
  <TTChung>
    <PBan>2.0.1</PBan>
    <THDon>TELECOM BILLING INVOICE DRAFT (UNSIGNED PREVIEW)</THDon>
    <TrangThai>UNSIGNED_PREVIEW</TrangThai>
    <KHMSHDon>1</KHMSHDon>
    <KHHDon>C26TNB</KHHDon>
    <SHDon>${escapeXml(data.invoiceId)}</SHDon>
    <NLap>${escapeXml(data.issuedDate)}</NLap>
    <DVTTe>USD</DVTTe>
    <TGia>1.0</TGia>
  </TTChung>
  <NDHDon>
    <NBan>
      <Ten>NEXUS TELECOM CORPORATION</Ten>
      <MST>0102345678</MST>
      <DChi>54 Lieu Giai, Ngoc Khanh, Ba Dinh, Hanoi, Vietnam</DChi>
      <SDThoai>18008098</SDThoai>
      <DCTDTu>billing@nexus.vn</DCTDTu>
    </NBan>
    <NMua>
      <Ten>${escapeXml(data.customerName)}</Ten>
      <MST>${escapeXml(data.taxId)}</MST>
      <DChi>Corporate Premise</DChi>
      <MKHang>${escapeXml(data.accountId)}</MKHang>
    </NMua>
    <DSHangHoa>
${lineItemsXml}
    </DSHangHoa>
    <TToan>
      <TgTCThue>${data.subtotal.toFixed(2)}</TgTCThue>
      <TSThue>${STATUTORY_TAX_RATE_PERCENT}%</TSThue>
      <TgTThue>${data.tax.toFixed(2)}</TgTThue>
      <TgTTTToan>${data.grandTotal.toFixed(2)}</TgTTTToan>
    </TToan>
  </NDHDon>
</HDon>`
}

export function exportInvoiceXmlDocument(invoice) {
  const data = resolveInvoiceData(invoice)
  const xml = buildInvoiceXmlContent(invoice)
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  triggerDownload(blob, `Invoice_${data.invoiceId}.xml`)
}

/**
 * Exports rows as a UTF-8 BOM CSV file safe for spreadsheet tools and Windows locales.
 */
export function downloadCsvDocument(headers = [], rows = [], filename = 'export.csv') {
  const escapeCell = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`
  const csvContent = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

export function downloadCalculationSheetCsv(orderOrInvoice) {
  const data = resolveInvoiceData(orderOrInvoice || {})
  const hasCustomItems = Array.isArray(orderOrInvoice?.items) && orderOrInvoice.items.length > 0

  const csvRows = [
    ['NEXUS TELECOM FINANCIAL CALCULATION SHEET - BILLING PREVIEW'],
    ['Reference ID', data.invoiceId],
    ['Customer Name', data.customerName],
    ['Billing Period', data.billingCycle],
    ['Generated Time', new Date().toISOString()],
    [''],
    ['Component', 'Formula / Metric', 'Amount (USD)'],
    ...(hasCustomItems
      ? data.items.map((it) => [it.desc || 'Telecom Item', `Qty ${it.quantity || 1}`, Number(it.amount || 0).toFixed(2)])
      : [
          ['Broadband FTTx 500Mbps Metro Port MRC', 'Monthly Recurring Charge', '240.00'],
          ['Static Public Subnet /29 IPv4 Allocation Block', '8 IPs Add-on', '40.00'],
          ['Out-of-Profile Optical Traffic Overage', '450 GB @ $0.05/GB', '22.50'],
        ]),
    ['Taxable Net Revenue Base', 'Sum of invoice line items', data.subtotal.toFixed(2)],
    ['Statutory Telecom Tax', `${STATUTORY_TAX_RATE_PERCENT}% fixed rate on taxable base`, data.tax.toFixed(2)],
    ['Prior Period Balance', 'Carried forward', data.previousBalance.toFixed(2)],
    ['Total Cycle Charge Payable', 'Taxable base + Statutory tax + Prior balance', data.grandTotal.toFixed(2)],
    ['Paid / Settled Amount', 'Remitted payments', data.paid.toFixed(2)],
    ['Remaining Settlement Balance', 'Total payable less payments', data.balance.toFixed(2)],
    [''],
    ['Document Status', 'Draft worksheet for internal billing review', 'PREVIEW_ONLY'],
  ]

  downloadCsvDocument(csvRows[0], csvRows.slice(1), `Billing_Calculation_Sheet_${data.invoiceId}.csv`)
}

export function downloadWorkOrderDocument(order, dispatchDetails) {
  const orderId = order?.id || 'B0000001089'
  const ticketId = dispatchDetails?.ticketId || `DSP-${Date.now().toString().slice(-6)}`
  const pdf = createPdfBuilder()

  drawDocumentBanner(pdf, {
    title: 'NEXUS TELECOM - NOC FIELD WORK ORDER',
    subtitle: 'ODN Field Engineering & Premise Activation Ticket',
    badgeText: 'FIELD DISPATCH PDF',
    referenceId: `#${ticketId}`,
    metaLine: `Ref Order: ${orderId}`,
  })

  pdf.drawRect(45, 654, 505, 68, { fillColor: [0.97, 0.98, 0.99], strokeColor: [0.89, 0.91, 0.94] })
  pdf.drawText('CUSTOMER & PREMISE INSTALLATION INFORMATION', 55, 708, { size: 8.5, bold: true, color: [0.39, 0.45, 0.55] })
  pdf.drawText(`Customer: ${order?.customerName || 'TechNova Vietnam'}`, 55, 694, { size: 9.5, bold: true })
  pdf.drawText(
    `Representative: ${order?.contactPerson || 'Nguyen Hai Dang'} (${order?.phone || '0912 445 889'})`,
    55,
    681,
    { size: 8.5 }
  )
  pdf.drawText(`Installation Address: ${order?.address || 'Floor 8, Diamond Flower Tower, Hanoi'}`, 55, 668, { size: 8.5 })
  pdf.drawText(
    `Service Plan: ${order?.planName || 'Fiber ENTERPRISE 500'} | Branch: ${order?.branchName || 'Hanoi 101'}`,
    55,
    657,
    { size: 8.5 }
  )

  pdf.drawRect(45, 574, 505, 68, { fillColor: [0.97, 0.98, 0.99], strokeColor: [0.89, 0.91, 0.94] })
  pdf.drawText('ASSIGNED ENGINEERING CREW & EQUIPMENT', 55, 628, { size: 8.5, bold: true, color: [0.39, 0.45, 0.55] })
  pdf.drawText(`Lead Engineer: ${dispatchDetails?.technicianName || 'Nguyen Van Tuan (Senior Splicer #HN-42)'}`, 55, 613, { size: 9, bold: true })
  pdf.drawText(`Service Vehicle: ${dispatchDetails?.vehicle || 'Van #29C-881.24'}`, 55, 599, { size: 8.5 })
  pdf.drawText(`Scheduled Window: ${dispatchDetails?.window || 'Today 14:00 - 16:00 (SLA 4-Hour)'}`, 55, 586, { size: 8.5 })

  pdf.setY(548)
  pdf.drawText('Field Verification Checklist', 45, pdf.getY(), { size: 11, bold: true })
  pdf.moveDown(12)

  const headerTop = pdf.getY()
  pdf.drawRect(45, headerTop - 20, 505, 20, { fillColor: [0.93, 0.95, 0.98], strokeColor: [0.85, 0.88, 0.92] })
  pdf.drawText('Milestone', 55, headerTop - 13, { size: 8.5, bold: true })
  pdf.drawText('Target SLA', 225, headerTop - 13, { size: 8.5, bold: true })
  pdf.drawText('Sign-off Status', 425, headerTop - 13, { size: 8.5, bold: true })
  pdf.setY(headerTop - 20)

  const milestones = [
    ['ODF Junction Splicing', 'Optical loss <= 0.25 dB per splice', '[v] Calibrated'],
    ['Drop Cable Installation', 'HDPE Conduit / Armored 24-core', '[v] Routed'],
    ['ONT RX Optical Power', 'Target: -18 dBm to -22 dBm (< -24 dBm)', '[v] Measured: -18.2 dBm'],
    ['Subscriber Handover Acceptance', 'Customer signature & ID protocol', '[ Pending Field Signature ]'],
  ]

  milestones.forEach(([milestone, sla, status]) => {
    const rowBottom = pdf.getY() - 22
    pdf.drawRect(45, rowBottom, 505, 22, { strokeColor: [0.85, 0.88, 0.92], lineWidth: 0.5 })
    const ty = rowBottom + 7
    pdf.drawText(milestone, 55, ty, { size: 8.5 })
    pdf.drawText(sla, 225, ty, { size: 8.5 })
    pdf.drawText(status, 425, ty, { size: 8.5 })
    pdf.setY(rowBottom)
  })

  const blob = new Blob([pdf.buildBytes()], { type: 'application/pdf' })
  triggerDownload(blob, `Work_Order_${ticketId}.pdf`)
}
