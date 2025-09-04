import { open } from "sqlite";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";

async function createAdmin(username, password, role = "admin") {
  try {
    // Connect to the database
    const db = await open({
      filename: "./database.sqlite",
      driver: sqlite3.Database,
    });

    // Check if the username already exists
    const existingUser = await db.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );
    if (existingUser) {
      console.error(`Error: Username '${username}' already exists.`);
      await db.close();
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new admin user
    await db.run(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      username,
      hashedPassword,
      role
    );

    console.log(
      `Admin user '${username}' created successfully with role '${role}'.`
    );
    await db.close();
  } catch (error) {
    console.error("Error creating admin user:", error.message);
  }
}

// Run the script with default admin credentials
createAdmin("admin", "admin", "admin");
