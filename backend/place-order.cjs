async function main() {
  const url = 'https://digital-menu-api-production.up.railway.app/api/orders';
  const payload = {
    tableNumber: '1',
    customerName: 'Test User',
    orderType: 'DINE_IN',
    items: [
      {
        menuItemId: 15,
        name: 'Cold Coffee',
        unitPrice: 99,
        quantity: 1
      }
    ],
    branchId: 1
  };

  console.log('Placing order...');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
