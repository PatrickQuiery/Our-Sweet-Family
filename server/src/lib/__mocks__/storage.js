const { Readable } = require('stream');

const uploadFile = jest.fn().mockResolvedValue('memories/test.jpg');
const deleteFile = jest.fn().mockResolvedValue(undefined);
const readFile = jest.fn().mockImplementation(async () => ({
  stream: Readable.from([Buffer.from('fake-bytes')]),
  contentType: 'image/jpeg',
}));
const isAbsoluteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);
const contentTypeForKey = jest.fn().mockReturnValue('image/jpeg');

module.exports = { uploadFile, deleteFile, readFile, isAbsoluteUrl, contentTypeForKey };
