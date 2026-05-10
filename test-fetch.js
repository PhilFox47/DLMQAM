fetch("http://localhost:3000/api/profiles").then(r=>r.text()).then(console.log).catch(console.error);
