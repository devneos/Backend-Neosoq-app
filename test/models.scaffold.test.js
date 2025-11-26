const models = [
  'Transaction',
  'Escrow',
  'PromotionPlan',
  'PromotionPurchase',
  'Notification',
  'StaffActivity',
  'Conversation',
  'ChatMessage',
  'Follow',
  'SavedItem',
  'WithdrawalRequest',
];

describe('Scaffolded models exist', () => {
  test('models are registered with mongoose', () => {
    const mongoose = require('mongoose');
    models.forEach((name) => {
      // Require the model file to ensure it's loaded
      require(`../models/${name}`);
      const model = mongoose.models[name];
      expect(model).toBeDefined();
      expect(model.modelName).toBe(name);
      expect(model.schema).toBeDefined();
    });
  });
});
