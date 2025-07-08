const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse');
const Resume = require('./models/Resume');
require('dotenv').config();

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Root route to test backend is working
app.get('/', (req, res) => {
  res.send('✅ Backend is running and ready!');
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// OpenAI API setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Multer setup for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['text/plain', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only .txt or .pdf files allowed'));
  },
});

// Upload route
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    const file = req.file;
    let resumeText = '';

    if (file.mimetype === 'application/pdf') {
      const data = await pdfParse(file.buffer);
      resumeText = data.text;
    } else if (file.mimetype === 'text/plain') {
      resumeText = file.buffer.toString('utf-8');
    }

    const prompt = `
You are a professional recruiter. Analyze this resume and return structured JSON with:
{
  "strengths": [ "item 1", "item 2", ... ],
  "weaknesses": [ "item 1", "item 2", ... ],
  "suggestions": [ "item 1", "item 2", ... ]
}

Resume content:
${resumeText}
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 800,
    });

    const text = completion.choices[0].message.content;
    let feedback = {};

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      feedback = jsonMatch ? JSON.parse(jsonMatch[0]) : { general: text };
    } catch (err) {
      console.error('❗ AI JSON Parse Error:', err);
      return res.status(500).json({ error: 'Failed to parse AI response.' });
    }

    const saved = await Resume.create({
      filename: file.originalname,
      content: resumeText,
      feedback,
    });

    res.json({ feedback });
  } catch (err) {
    console.error('❌ Upload Error:', err);
    res.status(500).json({ error: 'Resume upload failed.' });
  }
});

// History route
app.get('/history', async (req, res) => {
  try {
    const allResumes = await Resume.find().sort({ uploadedAt: -1 });
    res.json(allResumes);
  } catch (err) {
    console.error('❌ History Fetch Error:', err);
    res.status(500).json({ error: 'Could not retrieve history' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
