// components.js

// Function to load external HTML into an element
async function loadComponent(id, file) {
  const res = await fetch(file);
  const html = await res.text();
  document.getElementById(id).innerHTML = html;
}

// Load header and footer after the page loads
window.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', '/components/header.html');
  loadComponent('footer', '/components/footer.html');
});

