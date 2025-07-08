const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
  filename: String,
  content: String,
  feedback: Object,
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Resume', ResumeSchema);
