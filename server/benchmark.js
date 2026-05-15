async function run() {
  const baseUrl = 'http://localhost:3333';

  // Create an ecosystem to update
  const createRes = await fetch(`${baseUrl}/api/ecosystems?page=0&pageSize=10`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
    body: JSON.stringify({ name: 'Bench Ecosystem', slug: 'bench-eco' })
  });

  let created;
  try {
    created = await createRes.json();
  } catch(e) {
    console.error("Failed to parse json. Status:", createRes.status);
    return;
  }
  const id = created.items ? created.items[0].id : created.id || 'bench-eco';

  const iterations = 50;
  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    await fetch(`${baseUrl}/api/ecosystems/${id}?page=0&pageSize=10`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Roles': 'taxonomy:write' },
      body: JSON.stringify({ name: `Bench Ecosystem ${i}`, slug: 'bench-eco' })
    });
  }
  const end = Date.now();
  console.log(`Total time for ${iterations} updates: ${end - start} ms`);
  console.log(`Average time per update: ${(end - start) / iterations} ms`);
}

run().catch(console.error);
