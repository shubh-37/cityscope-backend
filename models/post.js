const mongoose = require('mongoose');
const postSchema = new mongoose.Schema({
    content: {
      type: String,
      required: true,
      maxlength: 280
    },
    type: {
      type: String,
      enum: ['recommendation', 'ask_for_help', 'local_update', 'event_announcement'],
      required: true
    },
    images: [String],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      content: {
        type: String,
        required: true,
        maxlength: 200
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    location: {
      type: String,
    },
  }, {
    timestamps: true
  });

  module.exports = postSchema;