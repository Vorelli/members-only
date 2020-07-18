const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const moment = require('moment');

const messageSchema = new Schema({
  title: { type: String, required: true, minlength: 1 },
  body: { type: String, required: true, minlength: 1 },
  datePosted: { type: Date, required: true },
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true }
});

messageSchema.virtual('dateFormatted').get(function() {
  return moment(this.datePosted).format('YYYY-MM-DD');
})

module.exports = mongoose.model('Message', messageSchema);
