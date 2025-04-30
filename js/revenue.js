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
      e.preventDefault();

      const source = form.source.value;
      const amount = parseFloat(form.amount.value);

      try {
        await db.collection("revenue").add({
          uid: user.uid,
          source: source,
          amount: amount,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        status.textContent = "✅ Revenue saved!";
        status.style.color = "green";
        form.reset();
      } catch (err) {
        status.textContent = "❌ " + err.message;
        status.style.color = "red";
      }
    });
  }
});

