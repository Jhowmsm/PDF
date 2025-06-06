// node/index.js
const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

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
    const outputPath = path.join(__dirname, '../backend/processor/output.json'); // O usa un archivo temporal

    execFile('python3', [scriptPath, filePath, configPath, outputPath], (error, stdout, stderr) => {
        fs.unlinkSync(filePath); // Borra el archivo temporal
        if (error) {
            return res.status(500).json({ error: stderr || error.message });
        }
        // Lee el resultado del output.json y lo envía
        fs.readFile(outputPath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).json({ error: 'No se pudo leer el resultado' });
            }
            res.type('json').send(data);
        });
    });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
