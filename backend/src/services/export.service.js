import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Shared Excel / PDF download for admin list pages (Sanchalaks, Surveyors, Farmers).
//
// columns: [{ header, value: (row) => string | number | Date, width, pdf }]
//   width is the Excel column width in characters. PDF columns are sized from their content;
//   `pdf: false` leaves a column out of the PDF (landscape A4 fits about 16 columns).

export const EXPORT_FORMATS = ['xlsx', 'pdf'];
export const EXPORT_ROW_LIMIT = 10000;

export const formatExportDate = (value) =>
    value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';

const generatedAt = () =>
    new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

const cellText = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return formatExportDate(value);
    return String(value);
};

// PDF standard fonts only cover Latin-1; show "Rs." for the rupee sign and "?" for other scripts.
// The Excel file keeps the original text (including Hindi).
const pdfSafe = (text) => text.replace(/₹/g, 'Rs.').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');

const writeXlsx = async (res, { title, columns, rows, meta }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KuroAgro Admin';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });

    sheet.columns = columns.map((col) => ({ header: col.header, key: col.header, width: col.width || 16 }));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 22;

    rows.forEach((row) => {
        sheet.addRow(columns.map((col) => {
            const value = col.value(row);
            return value === undefined || value === null ? '' : value;
        }));
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    // Second sheet: what this file contains, so a forwarded file still explains itself.
    const info = workbook.addWorksheet('Info');
    info.columns = [{ width: 18 }, { width: 60 }];
    [['Report', title], ['Generated', generatedAt()], ['Rows', rows.length], ...meta].forEach((line) => info.addRow(line));
    info.getColumn(1).font = { bold: true };

    await workbook.xlsx.write(res);
    res.end();
};

const PAD = 3;
const FONT_SIZE = 7;
const MAX_NATURAL = 150; // a long cell wraps rather than taking the whole page

/**
 * Column widths that fit the page: each column gets at least its longest word (so words are not
 * split), and the remaining space goes to columns whose text would otherwise wrap the most.
 */
const fitColumnWidths = (doc, headers, bodyRows, usable) => {
    const measure = (text, font) => {
        doc.font(font).fontSize(FONT_SIZE);
        return doc.widthOfString(text);
    };
    const longestWord = (text, font) => Math.max(0, ...String(text).split(/\s+/).map((w) => measure(w, font)));

    const sample = bodyRows.slice(0, 300);
    const mins = headers.map((h, i) =>
        Math.max(longestWord(h, 'Helvetica-Bold'), ...sample.map((r) => Math.min(longestWord(r[i], 'Helvetica'), MAX_NATURAL))) + PAD * 2
    );
    const naturals = headers.map((h, i) =>
        Math.max(mins[i], Math.min(MAX_NATURAL, Math.max(measure(h, 'Helvetica-Bold'), ...sample.map((r) => measure(r[i], 'Helvetica'))) + PAD * 2))
    );

    const minTotal = mins.reduce((a, b) => a + b, 0);
    const naturalTotal = naturals.reduce((a, b) => a + b, 0);
    if (naturalTotal <= usable) return naturals.map((w) => (w * usable) / naturalTotal);
    if (minTotal >= usable) return mins.map((w) => (w * usable) / minTotal);
    const spare = usable - minTotal;
    const wanted = naturalTotal - minTotal;
    return mins.map((w, i) => w + ((naturals[i] - w) * spare) / wanted);
};

const writePdf = (res, { title, columns: allColumns, rows, meta }) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28, bufferPages: true });
    doc.pipe(res);

    const columns = allColumns.filter((col) => col.pdf !== false);
    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const headerCells = columns.map((col) => pdfSafe(col.header));
    const bodyRows = rows.map((row) => columns.map((col) => pdfSafe(cellText(col.value(row)))));
    const widths = fitColumnWidths(doc, headerCells, bodyRows, usable);

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1b5e20').text(pdfSafe(title), left, doc.y);
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    doc.text(pdfSafe([`Generated ${generatedAt()}`, `${rows.length} record${rows.length === 1 ? '' : 's'}`, ...meta.map(([k, v]) => `${k}: ${v}`)].join('   ·   ')));
    doc.moveDown(0.6);

    const rowHeight = (cells, font) => {
        doc.font(font).fontSize(FONT_SIZE);
        return Math.max(...cells.map((text, i) => doc.heightOfString(text, { width: widths[i] - PAD * 2 }))) + PAD * 2;
    };

    const drawRow = (cells, y, { font, fill, color }) => {
        const height = rowHeight(cells, font);
        if (fill) doc.rect(left, y, usable, height).fill(fill);
        doc.font(font).fontSize(FONT_SIZE).fillColor(color);
        let x = left;
        cells.forEach((text, i) => {
            doc.text(text, x + PAD, y + PAD, { width: widths[i] - PAD * 2 });
            x += widths[i];
        });
        doc.moveTo(left, y + height).lineTo(left + usable, y + height).lineWidth(0.3).strokeColor('#dddddd').stroke();
        return height;
    };

    const drawHeader = (y) => drawRow(headerCells, y, { font: 'Helvetica-Bold', fill: '#2e7d32', color: '#ffffff' });
    const bottom = () => doc.page.height - doc.page.margins.bottom;

    let y = doc.y;
    y += drawHeader(y);

    if (!rows.length) {
        doc.font('Helvetica').fontSize(9).fillColor('#777777').text('No records match the selected filters.', left, y + 8);
    }

    bodyRows.forEach((cells, index) => {
        if (y + rowHeight(cells, 'Helvetica') > bottom()) {
            doc.addPage();
            y = doc.page.margins.top;
            y += drawHeader(y);
        }
        y += drawRow(cells, y, { font: 'Helvetica', fill: index % 2 ? '#f5f7f5' : null, color: '#222222' });
    });

    // Page numbers, written once all pages exist. The footer sits in the bottom margin, so lift the
    // margin while writing it, otherwise PDFKit starts a new page.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        const { bottom: marginBottom } = doc.page.margins;
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7).fillColor('#888888').text(
            `${pdfSafe(title)}  ·  Page ${i + 1} of ${range.count}`,
            left,
            doc.page.height - marginBottom + 6,
            { width: usable, align: 'right', lineBreak: false }
        );
        doc.page.margins.bottom = marginBottom;
    }
    doc.end();
};

/**
 * Streams `rows` as an Excel or PDF download.
 * @param {Object}   options
 * @param {'xlsx'|'pdf'} options.format
 * @param {string}   options.title     Report title, e.g. "Surveyors"
 * @param {string}   options.filename  Base file name without extension
 * @param {Array}    options.columns   See top of file
 * @param {Array}    options.rows
 * @param {Array}    [options.meta]    Extra [label, value] lines, e.g. the filters used
 */
export const sendExport = async (res, { format, title, filename, columns, rows, meta = [] }) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `${filename}-${stamp}.${format}`;
    const allMeta = rows.length >= EXPORT_ROW_LIMIT ? [...meta, ['Note', `Limited to the first ${EXPORT_ROW_LIMIT} records`]] : meta;

    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        writePdf(res, { title, columns, rows, meta: allMeta });
    } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await writeXlsx(res, { title, columns, rows, meta: allMeta });
    }
};
