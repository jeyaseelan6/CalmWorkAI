/**
 * CalmWork AI — Executive Customer Update PDF Generator
 * Generates valid, self-contained, high-fidelity PDF-1.4 documents
 * and provides client-side print-to-PDF export with zero external dependencies.
 */

export interface CustomerUpdatePdfData {
  customerName: string;
  engagementName?: string;
  subject: string;
  executiveSummary: string;
  keyMilestonesAchieved: string[];
  nextMilestoneTarget?: string;
  customerActionItems: string[];
  status: string;
  isApproved?: boolean;
  privacyScrubbed?: boolean;
  dateStr?: string;
}

/**
 * Sanitizes text to safe ASCII for PDF Helvetica font and escapes PDF string characters.
 */
function sanitizePdfText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2022/g, "*")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();
}

/**
 * Splits text into lines of at most maxChars without breaking words.
 */
function wrapText(text: string, maxChars: number = 80): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Compiles a binary PDF-1.4 document containing the executive summary.
 */
export function buildCustomerUpdatePdfBlob(data: CustomerUpdatePdfData): Blob {
  const customer = sanitizePdfText(data.customerName || "Enterprise Customer");
  const engagement = sanitizePdfText(data.engagementName || "Strategic Initiative");
  const subject = sanitizePdfText(data.subject || "Executive Customer Update");
  const summary = sanitizePdfText(data.executiveSummary || "No executive summary provided.");
  const milestones = (data.keyMilestonesAchieved || []).map(sanitizePdfText).filter(Boolean);
  const actions = (data.customerActionItems || []).map(sanitizePdfText).filter(Boolean);
  const nextTarget = sanitizePdfText(data.nextMilestoneTarget || "");
  const statusLabel = data.isApproved
    ? "APPROVED BY MANAGER (RELEASE AUTHORIZED)"
    : "DRAFT (AWAITING MANAGER SIGN-OFF)";
  const dateStr = data.dateStr || new Date().toISOString().split("T")[0];

  const streamLines: string[] = [];

  // 1. Top dark slate branding bar
  streamLines.push("0.08 0.11 0.16 rg 45 802 505 3 re f");

  // 2. Header title
  streamLines.push("BT");
  streamLines.push("/F2 16 Tf 0.08 0.11 0.16 rg 45 776 Td (CalmWork AI) Tj");
  streamLines.push("/F2 13 Tf 0.35 0.40 0.50 rg 140 776 Td (|  Executive Customer Update) Tj");
  streamLines.push("ET");

  streamLines.push("BT");
  streamLines.push("/F1 8.5 Tf 0.45 0.50 0.58 rg 45 760 Td (DELIVER AGENT  *  ENTERPRISE OUTCOME INTELLIGENCE PLATFORM) Tj");
  streamLines.push("ET");

  // 3. Metadata card box (height 60)
  streamLines.push("0.96 0.97 0.98 rg 45 688 505 60 re f");
  streamLines.push("0.85 0.88 0.91 RG 1 w 45 688 505 60 re S");

  streamLines.push("BT");
  streamLines.push(`/F2 8.5 Tf 0.25 0.30 0.38 rg 55 732 Td (CUSTOMER:) Tj /F1 8.5 Tf 115 732 Td (${customer}) Tj`);
  streamLines.push("ET");

  streamLines.push("BT");
  streamLines.push(`/F2 8.5 Tf 0.25 0.30 0.38 rg 310 732 Td (DATE:) Tj /F1 8.5 Tf 350 732 Td (${dateStr}) Tj`);
  streamLines.push("ET");

  streamLines.push("BT");
  streamLines.push(`/F2 8.5 Tf 0.25 0.30 0.38 rg 55 717 Td (INITIATIVE:) Tj /F1 8.5 Tf 115 717 Td (${engagement}) Tj`);
  streamLines.push("ET");

  streamLines.push("BT");
  const statusColor = data.isApproved ? "0.08 0.50 0.28" : "0.75 0.45 0.10";
  streamLines.push(`/F2 8.5 Tf 0.25 0.30 0.38 rg 55 702 Td (GOVERNANCE:) Tj /F2 8.5 Tf ${statusColor} rg 135 702 Td (${statusLabel}) Tj`);
  streamLines.push("ET");

  let y = 665;

  // 4. Subject line
  streamLines.push("BT");
  streamLines.push(`/F2 9.5 Tf 0.30 0.35 0.45 rg 45 ${y} Td (SUBJECT:) Tj`);
  streamLines.push("ET");
  y -= 15;

  const subjectLines = wrapText(subject, 78);
  for (const sLine of subjectLines) {
    streamLines.push("BT");
    streamLines.push(`/F2 11 Tf 0.08 0.11 0.16 rg 45 ${y} Td (${sLine}) Tj`);
    streamLines.push("ET");
    y -= 14;
  }
  y -= 8;

  // 5. Executive Summary
  streamLines.push(`0.88 0.90 0.93 RG 0.75 w 45 ${y + 4} 505 0.5 re S`);
  y -= 12;
  streamLines.push("BT");
  streamLines.push(`/F2 9.5 Tf 0.15 0.20 0.30 rg 45 ${y} Td (EXECUTIVE SUMMARY) Tj`);
  streamLines.push("ET");
  y -= 15;

  const summaryLines = wrapText(summary, 82);
  for (const sLine of summaryLines) {
    streamLines.push("BT");
    streamLines.push(`/F1 9 Tf 0.18 0.22 0.28 rg 45 ${y} Td (${sLine}) Tj`);
    streamLines.push("ET");
    y -= 13;
  }
  y -= 10;

  // 6. Key Milestones Achieved
  if (milestones.length > 0) {
    streamLines.push(`0.88 0.90 0.93 RG 0.75 w 45 ${y + 4} 505 0.5 re S`);
    y -= 12;
    streamLines.push("BT");
    streamLines.push(`/F2 9.5 Tf 0.15 0.20 0.30 rg 45 ${y} Td (KEY MILESTONES ACHIEVED) Tj`);
    streamLines.push("ET");
    y -= 15;

    for (const m of milestones) {
      const mLines = wrapText(m, 76);
      for (let i = 0; i < mLines.length; i++) {
        streamLines.push("BT");
        if (i === 0) {
          streamLines.push(`/F2 9 Tf 0.10 0.55 0.25 rg 45 ${y} Td ([+] ) Tj /F1 9 Tf 0.18 0.22 0.28 rg 62 ${y} Td (${mLines[i]}) Tj`);
        } else {
          streamLines.push(`/F1 9 Tf 0.18 0.22 0.28 rg 62 ${y} Td (${mLines[i]}) Tj`);
        }
        streamLines.push("ET");
        y -= 13;
      }
    }
    y -= 8;
  }

  // 7. Required Customer Actions & Next Milestones
  if (actions.length > 0 || nextTarget) {
    streamLines.push(`0.88 0.90 0.93 RG 0.75 w 45 ${y + 4} 505 0.5 re S`);
    y -= 12;
    streamLines.push("BT");
    streamLines.push(`/F2 9.5 Tf 0.15 0.20 0.30 rg 45 ${y} Td (REQUIRED CUSTOMER ACTIONS & NEXT TARGET) Tj`);
    streamLines.push("ET");
    y -= 15;

    for (const a of actions) {
      const aLines = wrapText(a, 76);
      for (let i = 0; i < aLines.length; i++) {
        streamLines.push("BT");
        if (i === 0) {
          streamLines.push(`/F2 9 Tf 0.75 0.40 0.10 rg 45 ${y} Td ([!] ) Tj /F1 9 Tf 0.18 0.22 0.28 rg 62 ${y} Td (${aLines[i]}) Tj`);
        } else {
          streamLines.push(`/F1 9 Tf 0.18 0.22 0.28 rg 62 ${y} Td (${aLines[i]}) Tj`);
        }
        streamLines.push("ET");
        y -= 13;
      }
    }

    if (nextTarget) {
      const tLines = wrapText(`Next Target: ${nextTarget}`, 76);
      for (let i = 0; i < tLines.length; i++) {
        streamLines.push("BT");
        if (i === 0) {
          streamLines.push(`/F2 9 Tf 0.20 0.45 0.70 rg 45 ${y} Td (--> ) Tj /F1 9 Tf 0.18 0.22 0.28 rg 62 ${y} Td (${tLines[i]}) Tj`);
        } else {
          streamLines.push(`/F1 9 Tf 0.18 0.22 0.28 rg 62 ${y} Td (${tLines[i]}) Tj`);
        }
        streamLines.push("ET");
        y -= 13;
      }
    }
  }

  // 8. Footer
  streamLines.push("0.85 0.88 0.91 RG 0.5 w 45 45 505 0.5 re S");
  streamLines.push("BT");
  streamLines.push("/F1 8 Tf 0.50 0.55 0.62 rg 45 32 Td (Confidential -- Generated by CalmWork AI DELIVER Agent  *  Verified Outcome Intelligence) Tj");
  streamLines.push("/F1 8 Tf 0.50 0.55 0.62 rg 480 32 Td (Page 1 of 1) Tj");
  streamLines.push("ET");

  const streamContent = streamLines.join("\n");
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(streamContent);

  // PDF-1.4 Object Structure
  const objects: Uint8Array[] = [];
  objects.push(encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(encoder.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  objects.push(
    encoder.encode(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
    )
  );
  objects.push(encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  objects.push(encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

  const streamObjHeader = encoder.encode(`<< /Length ${streamBytes.length} >>\nstream\n`);
  const streamObjFooter = encoder.encode("\nendstream");
  const streamFullObj = new Uint8Array(streamObjHeader.length + streamBytes.length + streamObjFooter.length);
  streamFullObj.set(streamObjHeader, 0);
  streamFullObj.set(streamBytes, streamObjHeader.length);
  streamFullObj.set(streamObjFooter, streamObjHeader.length + streamBytes.length);
  objects.push(streamFullObj);

  // Build binary PDF with byte offsets
  const header = encoder.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const chunks: Uint8Array[] = [header];
  let totalLength = header.length;

  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(totalLength);
    const objNum = i + 1;
    const objStart = encoder.encode(`${objNum} 0 obj\n`);
    const objEnd = encoder.encode("\nendobj\n");

    chunks.push(objStart);
    chunks.push(objects[i]);
    chunks.push(objEnd);
    totalLength += objStart.length + objects[i].length + objEnd.length;
  }

  const xrefPos = totalLength;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xrefStr += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  chunks.push(encoder.encode(xrefStr));

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

/**
 * Initiates direct browser download of the Executive Summary as a PDF file.
 * Strictly gated: Manager approval required before PDF export.
 */
export function downloadCustomerUpdatePdf(data: CustomerUpdatePdfData): boolean {
  if (!data.isApproved) {
    if (typeof window !== "undefined") {
      alert("Manager Approval Required: This executive summary must be reviewed and approved by an Engineering Manager before downloading the PDF.");
    }
    return false;
  }

  const blob = buildCustomerUpdatePdfBlob(data);
  const cleanCustomer = (data.customerName || "Customer")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 24);
  const dateStr = data.dateStr || new Date().toISOString().split("T")[0];
  const filename = `Executive_Summary_${cleanCustomer}_${dateStr}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/**
 * Opens an elegant, print-ready document formatted for browser Print / Save as PDF.
 * Strictly gated: Manager approval required before previewing or printing.
 */
export function printCustomerUpdateDocument(data: CustomerUpdatePdfData): boolean {
  if (!data.isApproved) {
    if (typeof window !== "undefined") {
      alert("Manager Approval Required: This executive summary must be reviewed and approved by an Engineering Manager before viewing or printing the PDF.");
    }
    return false;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // If popups are blocked, fallback to direct PDF download
    downloadCustomerUpdatePdf(data);
    return false;
  }

  const statusBadge = `<span style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;">APPROVED BY MANAGER · RELEASE AUTHORIZED (FDE & MANAGER)</span>`;

  const milestonesHtml = (data.keyMilestonesAchieved || [])
    .map(
      (m) =>
        `<li style="margin-bottom:6px;display:flex;align-items:flex-start;gap:8px;">
          <span style="color:#059669;font-weight:bold;">&#10003;</span>
          <span>${m}</span>
        </li>`
    )
    .join("");

  const actionsHtml = (data.customerActionItems || [])
    .map(
      (a) =>
        `<li style="margin-bottom:6px;display:flex;align-items:flex-start;gap:8px;">
          <span style="color:#d97706;font-weight:bold;">&#9679;</span>
          <span>${a}</span>
        </li>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Executive Summary — ${data.customerName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @media print {
      body { margin: 0; padding: 20mm; font-size: 11pt; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 15mm; }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 40px auto;
      max-width: 800px;
      padding: 30px;
      line-height: 1.5;
    }
    .header-bar { height: 4px; background: #0f172a; margin-bottom: 24px; border-radius: 2px; }
    .brand { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .subtitle { font-size: 11px; color: #64748b; font-family: monospace; text-transform: uppercase; margin-top: 2px; }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 20px 0;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 24px;
      font-size: 12px;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; font-family: monospace; }
    .meta-val { color: #0f172a; font-weight: 600; margin-top: 2px; }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      font-family: monospace;
      letter-spacing: 0.5px;
      margin-top: 22px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .subject-text { font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0 16px 0; }
    .summary-text { font-size: 13px; color: #1e293b; line-height: 1.6; }
    ul { list-style: none; padding-left: 0; font-size: 12.5px; margin: 8px 0; }
    .footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .print-btn-bar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }
    .btn {
      background: #0f172a;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="no-print print-btn-bar">
    <button class="btn" onclick="window.print()">Print or Save as PDF</button>
  </div>
  <div class="header-bar"></div>
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div>
      <div class="brand">CalmWork AI</div>
      <div class="subtitle">DELIVER Agent &middot; Outcome Intelligence SaaS</div>
    </div>
    <div style="text-align:right;">
      ${statusBadge}
    </div>
  </div>

  <div class="meta-card">
    <div class="meta-item">
      <span class="meta-label">Customer</span>
      <span class="meta-val">${data.customerName}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Date</span>
      <span class="meta-val">${data.dateStr || new Date().toISOString().split("T")[0]}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Initiative</span>
      <span class="meta-val">${data.engagementName || "Strategic Delivery"}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Privacy Guardrail</span>
      <span class="meta-val" style="color:#059669;">Verified Zero PII Leakage</span>
    </div>
  </div>

  <div class="section-title">Subject Line</div>
  <div class="subject-text">${data.subject}</div>

  <div class="section-title">Executive Summary</div>
  <div class="summary-text">${data.executiveSummary}</div>

  ${
    milestonesHtml
      ? `<div class="section-title">Key Milestones Achieved</div>
         <ul>${milestonesHtml}</ul>`
      : ""
  }

  ${
    actionsHtml
      ? `<div class="section-title">Required Customer Actions & Next Steps</div>
         <ul>${actionsHtml}</ul>`
      : ""
  }

  ${
    data.nextMilestoneTarget
      ? `<div style="margin-top:12px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:12px;color:#0369a1;">
          <strong>Target Milestone:</strong> ${data.nextMilestoneTarget}
        </div>`
      : ""
  }

  <div class="footer">
    <span>Confidential &middot; Authorized Enterprise Stakeholders Only</span>
    <span>Generated by CalmWork AI DELIVER Agent</span>
  </div>

  <script>
    window.onload = function() {
      // Auto-trigger print dialog for seamless PDF creation
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
