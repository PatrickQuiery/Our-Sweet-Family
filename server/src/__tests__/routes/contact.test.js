jest.mock('../../lib/prisma');
jest.mock('../../lib/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ sent: true }),
}));

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../lib/prisma');
const { sendMail } = require('../../lib/mailer');

describe('POST /api/contact', () => {
  const valid = {
    name: 'Jane Tester',
    email: 'jane@example.com',
    subject: 'Question',
    message: 'How do I upgrade my plan?',
  };

  it('saves the message and emails support on a valid submission', async () => {
    prisma.contactMessage.create.mockResolvedValue({ id: 'cm1', ...valid });
    prisma.contactMessage.update.mockResolvedValue({ id: 'cm1', emailSent: true });

    const res = await request(app).post('/api/contact').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(prisma.contactMessage.create).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringMatching(/oursweetfamily\.com/i) })
    );
  });

  it('rejects a submission missing name/email/message', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('silently drops a bot that fills the honeypot field', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...valid, company: 'AcmeSpamCorp' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('still succeeds (message saved) if email delivery throws', async () => {
    prisma.contactMessage.create.mockResolvedValue({ id: 'cm2', ...valid });
    sendMail.mockRejectedValueOnce(new Error('SMTP down'));

    const res = await request(app).post('/api/contact').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(prisma.contactMessage.create).toHaveBeenCalled();
  });
});
