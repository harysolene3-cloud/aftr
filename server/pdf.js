// Générateur PDF minimal (A4, polices Helvetica standard) : aucune dépendance.
// Gère les accents français via l'encodage WinAnsi.

const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const SPECIAL = { '€': 0x80, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95, ' ': 0x20, ' ': 0x20, 'œ': 0x9c, 'Œ': 0x8c };

function toWinAnsi(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0);
    if (SPECIAL[ch] !== undefined) out += String.fromCharCode(SPECIAL[ch]);
    else if (code < 256) out += ch;
    else out += '?';
  }
  return out;
}
const escape = s => toWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function textWidth(s, size, bold = false) {
  let w = 0;
  for (const ch of String(s ?? '')) {
    const base = ch.normalize('NFD')[0];
    const c = base.charCodeAt(0);
    w += c >= 32 && c <= 126 ? W[c - 32] : 556;
  }
  return (w * size / 1000) * (bold ? 1.06 : 1);
}

export class Pdf {
  constructor() { this.ops = []; }
  color(r, g, b) { this.ops.push(`${r / 255} ${g / 255} ${b / 255} rg ${r / 255} ${g / 255} ${b / 255} RG`); return this; }
  // y est mesuré depuis le haut de la page (plus naturel pour la mise en page)
  text(x, y, s, { size = 10, bold = false, align = 'left' } = {}) {
    if (align === 'right') x -= textWidth(s, size, bold);
    if (align === 'center') x -= textWidth(s, size, bold) / 2;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${(841.89 - y).toFixed(2)} Td (${escape(s)}) Tj ET`);
    return this;
  }
  wrap(x, y, s, maxWidth, opts = {}) {
    const size = opts.size || 10, lh = opts.lineHeight || size * 1.4;
    let line = '', yy = y;
    for (const word of String(s ?? '').split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (textWidth(test, size, opts.bold) > maxWidth && line) { this.text(x, yy, line, opts); yy += lh; line = word; }
      else line = test;
    }
    if (line) { this.text(x, yy, line, opts); yy += lh; }
    return yy;
  }
  rect(x, y, w, h) { this.ops.push(`${x} ${(841.89 - y - h).toFixed(2)} ${w} ${h} re f`); return this; }
  line(x1, y1, x2, y2, width = 0.5) { this.ops.push(`${width} w ${x1} ${(841.89 - y1).toFixed(2)} m ${x2} ${(841.89 - y2).toFixed(2)} l S`); return this; }
  watermark(s) {
    const a = Math.PI / 7, c = Math.cos(a).toFixed(4), sn = Math.sin(a).toFixed(4);
    this.ops.push(`q /GS1 gs 0.85 0.2 0.15 rg BT /F2 46 Tf ${c} ${sn} ${-sn} ${c} 70 250 Tm (${escape(s)}) Tj ET Q`);
    return this;
  }
  build() {
    const stream = Buffer.from(this.ops.join('\n'), 'latin1');
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /ExtGState << /GS1 7 0 R >> >> /Contents 6 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      null,
      '<< /Type /ExtGState /ca 0.10 /CA 0.10 >>',
    ];
    const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    const offsets = [];
    let pos = parts[0].length;
    objs.forEach((o, i) => {
      const chunk = o === null
        ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream\nendobj\n', 'latin1')])
        : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
      offsets.push(pos); pos += chunk.length; parts.push(chunk);
    });
    const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
      `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;
    parts.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(parts);
  }
}

const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const fdate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export function totals(lines, vatRate) {
  const ht = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const vat = Math.round(ht * vatRate) / 100;
  return { ht, vat, ttc: ht + vat };
}

/** Devis ou facture du Business Studio, filigrané « document fictif ». */
export function documentPdf(kind, doc, seller) {
  const p = new Pdf();
  const isInvoice = kind === 'invoice';
  p.watermark('DOCUMENT FICTIF - DÉMONSTRATION');
  // Bandeau
  p.color(20, 20, 24).rect(0, 0, 595.28, 92);
  p.color(255, 210, 63).text(40, 52, 'AFTR', { size: 26, bold: true });
  p.color(255, 255, 255).text(555, 44, isInvoice ? 'FACTURE' : 'DEVIS', { size: 20, bold: true, align: 'right' });
  p.text(555, 62, `N° ${doc.number}`, { size: 10, align: 'right' });
  // Émetteur / client
  p.color(110, 110, 120).text(40, 125, 'ÉMETTEUR', { size: 8, bold: true }).text(320, 125, 'CLIENT', { size: 8, bold: true });
  p.color(20, 20, 24);
  let y = 142;
  for (const [i, l] of [seller.legal_name || seller.stage_name, seller.address, seller.siret ? `SIRET ${seller.siret}` : null, seller.email].filter(Boolean).entries()) p.text(40, y + i * 14, l, { size: 10, bold: i === 0 });
  [doc.client_name, doc.client_address, doc.client_email].filter(Boolean).forEach((l, i) => p.text(320, y + i * 14, l, { size: 10, bold: i === 0 }));
  y = 220;
  p.color(110, 110, 120);
  const meta = isInvoice
    ? [['Date d\'émission', fdate(doc.issue_date)], ['Échéance', fdate(doc.due_date)], ['Prestation le', fdate(doc.event_date)]]
    : [['Date', fdate(doc.created_at?.slice(0, 10))], ['Valable jusqu\'au', fdate(doc.valid_until)], ['Prestation le', fdate(doc.event_date)]];
  meta.forEach(([k, v], i) => { p.color(110, 110, 120).text(40 + i * 175, y, k.toUpperCase(), { size: 7.5, bold: true }); p.color(20, 20, 24).text(40 + i * 175, y + 14, v, { size: 10 }); });
  y = 268;
  p.text(40, y, doc.title, { size: 13, bold: true });
  // Lignes
  y += 26;
  p.color(244, 242, 236).rect(40, y - 14, 515, 22);
  p.color(80, 80, 90).text(50, y, 'DÉSIGNATION', { size: 8, bold: true }).text(380, y, 'QTÉ', { size: 8, bold: true, align: 'right' })
    .text(465, y, 'PRIX UNIT. HT', { size: 8, bold: true, align: 'right' }).text(545, y, 'TOTAL HT', { size: 8, bold: true, align: 'right' });
  y += 24;
  p.color(20, 20, 24);
  for (const l of doc.lines) {
    const ny = p.wrap(50, y, l.label, 290, { size: 10 });
    p.text(380, y, String(l.qty), { size: 10, align: 'right' }).text(465, y, eur(l.unit_price), { size: 10, align: 'right' }).text(545, y, eur(l.qty * l.unit_price), { size: 10, align: 'right' });
    y = Math.max(ny, y + 14) + 6;
    p.color(225, 222, 214).line(40, y - 8, 555, y - 8).color(20, 20, 24);
  }
  const t = totals(doc.lines, doc.vat_rate);
  y += 10;
  const row = (k, v, bold) => { p.text(440, y, k, { size: bold ? 11 : 10, bold, align: 'right' }).text(545, y, v, { size: bold ? 11 : 10, bold, align: 'right' }); y += 18; };
  row('Total HT', eur(t.ht));
  row(doc.vat_rate ? `TVA ${doc.vat_rate} %` : 'TVA', doc.vat_rate ? eur(t.vat) : '—');
  p.color(255, 210, 63).rect(330, y - 13, 225, 24); p.color(20, 20, 24);
  y += 2; row(isInvoice ? 'Net à payer' : 'Total TTC', eur(t.ttc), true);
  y += 14;
  p.color(90, 90, 100);
  if (!doc.vat_rate) y = p.wrap(40, y, 'TVA non applicable, art. 293 B du CGI.', 515, { size: 8.5 });
  if (doc.notes) y = p.wrap(40, y + 4, doc.notes, 515, { size: 9 });
  if (isInvoice) {
    y = p.wrap(40, y + 6, 'Paiement par virement à réception. En cas de retard : pénalités au taux de 3 fois le taux d\'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement.', 515, { size: 8.5 });
    if (seller.iban) p.text(40, y + 4, `IBAN : ${seller.iban}`, { size: 9 });
  } else {
    p.wrap(40, y + 6, 'Bon pour accord : date et signature du client précédées de la mention « Bon pour accord ».', 515, { size: 8.5 });
  }
  // Pied de page
  p.color(200, 60, 40).wrap(40, 790, 'Document fictif généré dans le cadre d\'une démonstration (projet de Master 2). Il n\'a aucune valeur comptable ni légale et n\'a pas fait l\'objet d\'une vérification réglementaire.', 515, { size: 7.5 });
  p.color(140, 140, 150).text(555, 822, 'Généré avec AFTR Business Studio', { size: 7, align: 'right' });
  return p.build();
}
