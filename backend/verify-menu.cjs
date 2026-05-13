async function main() {
  const url = 'https://digital-menu-api-production.up.railway.app/api/menu?branchId=1';
  console.log('Fetching menu...');
  const res = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const data = await res.json();
  const categories = Array.isArray(data) ? data : (data.categories || []);
  console.log('Category names:', categories.map(c => c.name));
  console.log('Total categories:', categories.length);
}

main().catch(console.error);
