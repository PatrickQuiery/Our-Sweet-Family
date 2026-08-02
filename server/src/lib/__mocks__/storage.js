const uploadFile = jest.fn().mockResolvedValue('http://localhost:3001/uploads/test/file.jpg');
const deleteFile = jest.fn().mockResolvedValue(undefined);

module.exports = { uploadFile, deleteFile };
