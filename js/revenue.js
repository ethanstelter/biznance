// revenue.js

// Assumes firebase was already initialized in the HTML page

// Wait until Firebase auth is ready
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "/login.html";
  } else {
    const db = firebase.firestore();
    const form = document.getElementById("revenue-form");
    const status = document.getElementById("revenue-status");

    form.addEventListener("submit", async (e) => {
      // Load and display revenue entries for this user
async function loadRevenueEntries() {
  const list = document.getElementById("revenue-list");
  list.innerHTML = "<p class='text-gray-500 text-center'>Loading...</p>";

  try {
    const snapshot = await db.collection("revenue")
      .where("uid", "==", user.uid)
      .orderBy("timestamp", "desc")
      .get();

    if (snapshot.empty) {
      list.innerHTML = "<p class='text-gray-500 text-center'>No revenue entries yet.</p>";
      return;
    }

    list.innerHTML = ""; // Clear loading state

    snapshot.forEach(doc => {
      const entry = doc.data();
      const id = doc.id;

      const item = document.createElement("div");
      item.className = "bg-white dark:bg-neutral-900 p-4 rounded shadow flex justify-between items-center";

      item.innerHTML = `
        <div>
          <p class="font-semibold text-black dark:text-white">${entry.source}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">$${entry.amount.toFixed(2)}</p>
        </div>
        <button data-id="${id}" class="text-red-500 hover:text-red-700 font-semibold delete-btn">Delete</button>
      `;

      list.appendChild(item);
    });

    // Hook up all delete buttons
    document.querySelectorAll(".delete-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.getAttribute("data-id");
        try {
          await db.collection("revenue").doc(id).delete();
          loadRevenueEntries(); // Refresh list
        } catch (err) {
          alert("Error deleting: " + err.message);
        }
      });
    });

  } catch (err) {
    list.innerHTML = `<p class='text-red-500'>Error loading revenue: ${err.message}</p>`;
  }
}

// Load entries after page load
loadRevenueEntries();

      e.preventDefault();

      const source = form.source.value;
      const amount = parseFloat(form.amount.value);
      const isRecurring = document.getElementById("recurring-revenue").checked;

   try {
  // First: Add the revenue entry
  await db.collection("revenue").add({
    uid: user.uid,
    source: source,
    amount: amount,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Then: If recurring, also save it to the "recurring" collection
  if (isRecurring) {
    await db.collection("recurring").add({
      uid: user.uid,
      type: "revenue",
      source: source,
      amount: amount,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  status.textContent = "✅ Revenue saved!";
  status.style.color = "green";
  form.reset();
  loadRevenueEntries(); // refresh the list

} catch (err) {
  status.textContent = "❌ " + err.message;
  status.style.color = "red";
}
    });
  }
});

