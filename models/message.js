const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  title: { type: String, required: true, minlength: 1 },
  body: { type: String, required: true, minlength: 1 },
  datePosted: { type: Date, required: true },
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Message', messageSchema);
