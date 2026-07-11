import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.AUTOMATEAPP_API_KEY || "0ce28b5b-0349-406b-b2e9-b06cb90a2fe6";
const BASE_URL = "https://api.automatebusiness.com/functions/v1";

async function callAutomate(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "API-Key": API_KEY,
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}/${endpoint}`, options);
  return res.json();
}

// MCP manifest
app.get("/", (req, res) => {
  res.json({
    name: "automateapp",
    version: "1.0.0",
    description: "Automateapp Task Manager — assign tasks, get users, get categories",
    tools: [
      {
        name: "get_users",
        description: "Get all users from Automateapp (name + ID). Use this to find user IDs before assigning tasks.",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_categories",
        description: "Get all task categories from Automateapp.",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "assign_task",
        description: "Assign a new task to a team member in Automateapp.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description / details" },
            assigned_to_id: { type: "string", description: "User ID to assign task to (get from get_users)" },
            assigned_by_id: { type: "string", description: "User ID who is assigning (default: Chirag Thakkar)" },
            due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
            category_id: { type: "string", description: "Category ID (optional, get from get_categories)" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          },
          required: ["title", "assigned_to_id"],
        },
      },
      {
        name: "get_team_summary",
        description: "Get a summary of all team members with their IDs — useful for knowing who to assign tasks to.",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
    ],
  });
});

// MCP tools endpoint
app.post("/tools/call", async (req, res) => {
  const { name, input } = req.body;

  try {
    if (name === "get_users") {
      const data = await callAutomate("getTaskUsers");
      return res.json({
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    }

    if (name === "get_categories") {
      const data = await callAutomate("getTaskCategories");
      return res.json({
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      });
    }

    if (name === "get_team_summary") {
      const users = await callAutomate("getTaskUsers");
      const KNOWN = {
        "c3d145dc-fc15-417d-a840-b68ee40f891d": "Rituraj Priyani — HR",
        "fb1f3c90-bdca-4f5b-bce0-97ffc88d037b": "Parth Dave — Sales",
        "2e2704b1-f770-4ccc-8ffe-902f877353a7": "Girish Sivaramakrishnan — Production",
        "20ca3a59-663b-4918-80f4-ee251e398f20": "Rishita Ramrakhyani — Accounts",
        "e7696867-3da6-41ef-8f67-f30680078493": "Sujit Devmurari — Quality",
        "1b3862e1-aded-445d-b1de-8821ab8c8e51": "Chirag Thakkar — CEO",
      };
      const summary = Array.isArray(users)
        ? users.map((u) => ({
            id: u.id,
            name: u.first_name + (u.last_name ? " " + u.last_name : ""),
            role: KNOWN[u.id] || "Team Member",
          }))
        : Object.entries(KNOWN).map(([id, name]) => ({ id, name }));

      return res.json({
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      });
    }

    if (name === "assign_task") {
      const payload = {
        title: input.title,
        description: input.description || "",
        assigned_to_id: input.assigned_to_id,
        assigned_by_id: input.assigned_by_id || "1b3862e1-aded-445d-b1de-8821ab8c8e51",
        due_date: input.due_date || null,
        category_id: input.category_id || null,
        priority: input.priority || "medium",
      };
      const data = await callAutomate("assignTask", "POST", payload);
      return res.json({
        content: [
          {
            type: "text",
            text: data.error
              ? `❌ Error: ${JSON.stringify(data)}`
              : `✅ Task assigned successfully!\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      });
    }

    return res.status(400).json({ error: `Unknown tool: ${name}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Automateapp MCP server running on port ${PORT}`));
