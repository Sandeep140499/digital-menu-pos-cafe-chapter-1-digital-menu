import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server';

describe('POST /api/orders', () => {
  it('returns 400 when body is missing', async () => {
    const res = await request(app).post('/api/orders').send();
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/orders').send({
      customerName: 'Test',
      // missing: tableNumber, branchId, customerMobile, items
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('returns 400 when customerMobile is invalid', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        tableNumber: 'T1',
        branchId: 1,
        customerName: 'Test User',
        customerMobile: '123',
        items: [{ name: 'Coffee', unitPrice: 100, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 when items array is empty', async () => {
    const res = await request(app).post('/api/orders').send({
      tableNumber: 'T1',
      branchId: 1,
      customerName: 'Test User',
      customerMobile: '9876543210',
      items: [],
    });
    expect(res.status).toBe(400);
  });
});
