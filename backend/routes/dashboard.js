import { Router } from "express";
import { dbPromise } from "../database/sqliteConnection.js";

const router = Router();

router.post("/save", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  const { dashboardName, layout } = req.body;
  try {
    await db.run(
      "INSERT INTO dashboards (user_id, name, layout) VALUES (?, ?, ?)",
      user.userId,
      dashboardName,
      JSON.stringify(layout)
    );
    res.json({ success: true, message: "Dashboard saved successfully" });
  } catch (error) {
    console.error("Error saving dashboard:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: `Failed to save dashboard: ${error.message}`,
      });
  }
});

router.get("/list", async (req, res) => {
  const db = await dbPromise;
  const { user } = req;
  try {
    const dashboards = await db.all(
      "SELECT id, name, layout FROM dashboards WHERE user_id = ?",
      user.userId
    );
    res.json({ success: true, dashboards });
  } catch (error) {
    console.error("Error fetching dashboards:", error.message);
    res
      .status(500)
      .json({
        success: false,
        error: `Failed to fetch dashboards: ${error.message}`,
      });
  }
});

export default router;
