const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  firstName: { type: String, required: true, minlength: 1 },
  lastName: { type: String, required: true, minlength: 1 },
  username: { type: String, required: true, minlength: 4 },
  password: { type: String, required: true },
  isMember: { type: Boolean, required: true },
  isAdmin: { type: Boolean, required: true }
});

module.exports = mongoose.model('User', userSchema);
