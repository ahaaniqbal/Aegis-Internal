/**
 * Machine-readable PDF: embedded pretty-printed canonical JSON only (no LLM prose).
 */
export async function downloadAuditPdf(canonicalExport: object, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const json = JSON.stringify(canonicalExport, null, 2);
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  const lineH = 3.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  let y = margin;

  const title = 'Aegis audit export (canonical JSON)';
  doc.text(title, margin, y);
  y += 6;
  doc.setFontSize(8);

  const lines = doc.splitTextToSize(json, maxW) as string[];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineH;
  }

  doc.save(filename);
}