// Mock cloudinary and fileQueue for tests to avoid network/IO
jest.mock('cloudinary', () => ({
  v2: {
    config: () => ({}),
    uploader: { upload: jest.fn(async (p) => ({ secure_url: 'https://example.com/fake.pdf' })) }
  }
}));

jest.mock('../utils/fileQueue', () => ({ enqueueJob: jest.fn(async () => true), dequeueJob: jest.fn() }));
