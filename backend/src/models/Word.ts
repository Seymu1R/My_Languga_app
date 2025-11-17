import mongoose, { Document, Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IWord extends Document {
  _id: string;
  english: string;
  translation: string;
  pronunciation?: string;
  dateAdded: Date;
}

const wordSchema = new Schema<IWord>({
  _id: {
    type: String,
    default: () => randomUUID()
  },
  english: {
    type: String,
    required: true,
    trim: true
  },
  translation: {
    type: String,
    required: true,
    trim: true
  },
  pronunciation: {
    type: String,
    trim: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
}, {
  _id: false, // Disable auto ObjectId generation
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for faster lookups
wordSchema.index({ english: 1 });

export const Word = mongoose.model<IWord>('Word', wordSchema);
