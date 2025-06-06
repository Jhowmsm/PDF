// node/index.js
const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 10 MB
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/procesar-balance', upload.single('pdf'), (req, res) => {
    const filePath = req.file.path;
    const scriptPath = path.join(__dirname, '../backend/processor/extract_balance.py');
    const configPath = path.join(__dirname, '../backend/processor/config.json');
    const outputPath = path.join(__dirname, '../backend/processor/output.json');

    execFile('python3', [scriptPath, filePath, configPath, outputPath], (error, stdout, stderr) => {
        fs.unlinkSync(filePath);
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }
        fs.readFile(outputPath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).json({ error: 'No se pudo leer el resultado' });
            }
            // Generar Excel
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const jsonData = JSON.parse(data);

            const ws = {};
            for (const [key, value] of Object.entries(jsonData)) {
                const conf = config.keywords[key];
                if (!conf) continue;
                if (conf.mode === 'two_numbers_after' && Array.isArray(value)) {
                    ws[conf.cells[0]] = { v: value[0] || "N/A" };
                    ws[conf.cells[1]] = { v: value[1] || "N/A" };
                } else if (conf.mode === 'until_dot' || conf.mode === 'until_newline' || conf.mode === 'between_phrases') {
                    ws[conf.cells[0]] = { v: value || "N/A" };
                }
            }

            // Calcular el rango real de la hoja
            const cellAddresses = Object.keys(ws);
            if (cellAddresses.length) {
                let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity;
                cellAddresses.forEach(addr => {
                    const { c, r } = XLSX.utils.decode_cell(addr);
                    if (c < minCol) minCol = c;
                    if (r < minRow) minRow = r;
                    if (c > maxCol) maxCol = c;
                    if (r > maxRow) maxRow = r;
                });
                ws['!ref'] = XLSX.utils.encode_range({ s: { c: minCol, r: minRow }, e: { c: maxCol, r: maxRow } });
            } else {
                ws['!ref'] = 'A1:A1';
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Balance");
            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Disposition', 'attachment; filename=balance.xlsx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(excelBuffer);
        });
    });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
