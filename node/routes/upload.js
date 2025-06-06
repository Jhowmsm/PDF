// node/routes/upload.js
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '../backend/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});
const upload = multer({ storage });

router.post('/', upload.single('pdf'), (req, res) => {
  const filename = req.file.filename;
  const filepath = path.resolve('../backend/uploads/', filename);

  // Ejecutar el script de Python y pasarle la ruta
  exec(`python3 ../backend/app.py "${filepath}"`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr || error.message });
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Error al parsear salida de Python' });
    }
  });
});

module.exports = router;
