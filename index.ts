// local-upload.ts
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const app = express();

// Ensure the upload directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Configure Multer's diskStorage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename: UUID + original extension
    const uniqueSuffix = crypto.randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  },
});

// 2. (Optional) Add a file filter for validation
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

// 3. Create the Multer instance with the storage configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// 4. Define the upload route
app.post(
  '/upload/local',
  upload.single('file'), // 'file' is the name of the form field
  (req: Request, res: Response) => {
    // TypeScript now knows req.file is of type Express.Multer.File | undefined
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    res.status(200).json({
      message: 'File uploaded successfully to local disk.',
      file: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  }
);

// 5. Centralized error handler for Multer and other errors
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // Handle specific Multer errors (e.g., file size limit)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message.includes('not allowed')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

app.listen(3000, () => console.log('Server running on port 3000'));
