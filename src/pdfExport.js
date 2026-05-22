const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 48;
const fontSize = 10.5;
const lineHeight = 15;
const maxChars = 92;

export function downloadPlainTextPdf({ title = 'Ficha', filename = 'ficha.pdf', text = '' } = {}) {
  const blob = plainTextPdfBlob(title, text);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function plainTextPdfBlob(title = 'Ficha', text = '') {
  const pages = paginateLines([title, '', ...wrapText(text || 'Sin texto para exportar.')]);
  const objects = [];
  const pageIds = [];
  const fontId = 3;

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let nextId = 4;
  for (const pageLines of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    objects[contentId] = `<< /Length ${pdfTextContent(pageLines).length} >>\nstream\n${pdfTextContent(pageLines)}\nendstream`;
    objects[pageId] = [
      '<< /Type /Page',
      '/Parent 2 0 R',
      `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
      `/Resources << /Font << /F1 ${fontId} 0 R >> >>`,
      `/Contents ${contentId} 0 R`,
      '>>',
    ].join(' ');
  }

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const pdf = serializePdf(objects);
  return new Blob([pdf], { type: 'application/pdf' });
}

function paginateLines(lines) {
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  return pages.length ? pages : [['']];
}

function wrapText(text) {
  const lines = [];
  for (const rawLine of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of line.split(/\s+/)) {
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= maxChars) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function pdfTextContent(lines) {
  const chunks = ['BT', `/F1 ${fontSize} Tf`, `${lineHeight} TL`, `${margin} ${pageHeight - margin} Td`];
  for (const line of lines) {
    chunks.push(`${utf16PdfString(line)} Tj`);
    chunks.push('T*');
  }
  chunks.push('ET');
  return chunks.join('\n');
}

function utf16PdfString(value) {
  const text = String(value || '');
  let hex = 'FEFF';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hex += code.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

function serializePdf(objects) {
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length}\n`;
  body += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
}
