const firestore = require("../services/firestore");
const db = firestore.db;

class User {
  constructor({ name, email, phoneNumber, role }) {
    this.email = email;
  }

  static async findById(id) {
    console.log("id", id);
    const userDoc = await firestore.db.collection("users").doc(id).get();
    if (userDoc.exists) {
      console.log("user found");
      return { id: userDoc.id, ...userDoc.data() };
    } else {
      throw new Error("user not found");
    }
  }

  static async findUserByEmail(email) {
    console.log("email", email);
    const userDoc = await firestore.db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (userDoc.docs.length != 0) {
      const doc = userDoc.docs[0];
      const userData = { id: doc.id, ...doc.data() };
      return userData;
    } else {
      return null;
    }
  }
}

module.exports = User;
