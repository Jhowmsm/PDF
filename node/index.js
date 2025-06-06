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
                    // Asigna cada número a la celda correspondiente
                    ws[conf.cells[0]] = { v: value[0] };
                    ws[conf.cells[1]] = { v: value[1] };
                } else if (conf.mode === 'until_dot' || conf.mode === 'until_newline' || conf.mode === 'between_phrases') {
                    ws[conf.cells[0]] = { v: value };
                }
            }

            // Calcula el rango de la hoja
            const cellAddresses = Object.keys(ws);
            const range = cellAddresses.length
                ? { s: XLSX.utils.decode_cell(cellAddresses[0]), e: XLSX.utils.decode_cell(cellAddresses[cellAddresses.length - 1]) }
                : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
            ws['!ref'] = XLSX.utils.encode_range(range);

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
