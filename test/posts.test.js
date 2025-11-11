const Post = require('../models/Post');

describe('Post model basic', () => {
  beforeEach(async () => {
    await Post.deleteMany({});
  });

  test('create post - happy path', async () => {
    const payload = { message: { en: 'Hello world', ar: '' }, files: [{ filename: 'f.txt' }] };
    const p = await Post.create(payload);
    expect(p).toBeDefined();
    expect(p.message.en).toBe('Hello world');
    expect(Array.isArray(p.files)).toBe(true);
    expect(p.files[0].filename).toBe('f.txt');
  });

  test('create post without message should fail', async () => {
    await expect(Post.create({ files: [] })).rejects.toThrow();
  });
});
