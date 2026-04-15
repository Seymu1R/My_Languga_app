import mongoose, { Document, Schema } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IWord extends Document {
  _id: string;
  english: string;
  translation: string;
  pronunciation?: string;
  referenceSentence?: string;
  imageUrl?: string;
  dateAdded: Date;
  status: 'learning' | 'known';
  nextReviewDate: Date | null;
  reviewIntervalDays: number;
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
  referenceSentence: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['learning', 'known'],
    default: 'learning'
  },
  nextReviewDate: {
    type: Date,
    default: null
  },
  reviewIntervalDays: {
    type: Number,
    default: 7,
    min: 1
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
