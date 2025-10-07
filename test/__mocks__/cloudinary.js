module.exports = {
  v2: {
    config: () => ({}),
    uploader: {
      upload: async (p, opts) => ({ secure_url: 'https://example.com/fake.pdf' })
    }
  }
};
