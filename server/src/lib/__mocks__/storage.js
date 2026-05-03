const uploadFile = jest.fn().mockResolvedValue('http://localhost:3001/uploads/test/file.jpg');

module.exports = { uploadFile };
