const mongoose = require('mongoose');

const PromotionPlanSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  durationDays: {
    type: Number,
    default: 7,
    min: 1
  },
  adminFeePercent: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  active: {
    type: Boolean,
    default: true
  },
  meta: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

PromotionPlanSchema.index({ price: 1 });

module.exports = mongoose.model('PromotionPlan', PromotionPlanSchema);
