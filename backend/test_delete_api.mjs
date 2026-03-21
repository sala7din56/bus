async function test() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@erbiltransit.com', password: 'password123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  if (!token) {
    console.error("Login failed", loginData);
    return;
  }

  // Create a route
  const crRes = await fetch('http://localhost:5000/api/routes', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: "Test Delete Route " + Date.now(),
      nameKurdish: "تێست",
      colorHex: "#FF0000"
    })
  });
  const createdRoute = await crRes.json();
  console.log("Created route:", createdRoute.id);

  // Delete the route
  const delRes = await fetch(`http://localhost:5000/api/routes/${createdRoute.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const delData = await delRes.text();
  console.log("Delete status:", delRes.status);
  console.log("Delete response:", delData);
}

test().catch(console.error);
