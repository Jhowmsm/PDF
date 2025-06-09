// backend/routes/upload.js

const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configuración de almacenamiento de archivos PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '../uploads/')); // Carpeta donde se guardan los PDFs
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}_${file.originalname}`);
  }
});
const upload = multer({ storage });

// Ruta POST para subir el archivo PDF y procesarlo
router.post('/', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const filename = req.file.filename;
  const filepath = path.resolve(__dirname, '../uploads/', filename);
  const outputExcelPath = path.resolve(__dirname, '../outputs/', `${filename}.xlsx`);

  // Ruta al archivo de configuración JSON
  const configPath = path.resolve(__dirname, '../config/config_document3.json');

  // Ejecutar script Python con PDF, config y output path como argumentos
  const command = `python3 ${path.resolve(__dirname, '../app.py')} "${filepath}" "${configPath}" "${outputExcelPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Error al ejecutar Python:', stderr || error.message);
      return res.status(500).json({ error: stderr || error.message });
    }

    // Verificar que se generó el archivo Excel
    fs.access(outputExcelPath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error('Archivo Excel no generado');
        return res.status(500).json({ error: 'No se generó el archivo Excel.' });
      }

      // Configurar headers para enviar el archivo Excel
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputExcelPath)}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // Enviar el archivo Excel como stream
      const fileStream = fs.createReadStream(outputExcelPath);
      fileStream.pipe(res);

      // Limpiar archivos después del envío
      fileStream.on('end', () => {
        fs.unlink(outputExcelPath, (unlinkErr) => {
          if (unlinkErr) console.error('Error al borrar archivo Excel:', unlinkErr);
        });
        fs.unlink(filepath, (unlinkErr) => {
          if (unlinkErr) console.error('Error al borrar archivo PDF:', unlinkErr);
        });
      });
    });
  });
});

module.exports = router;
