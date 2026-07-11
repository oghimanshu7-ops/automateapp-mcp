import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.AUTOMATEAPP_API_KEY || "0ce28b5b-0349-406b-b2e9-b06cb90a2fe6";
const BASE_URL = "https://api.automatebusiness.com/functions/v1";

const TOOLS = [
  {
    name: "get_users",
    description: "Get all users from Automateapp with their IDs and names.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_categories",
    description: "Get all task categories from Automateapp.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_team_summary",
    description: "Get Hindustan RMC team members with their IDs and roles.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "assign_task",
    description: "Assign a new task to a Hindustan RMC team member in Automateapp.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task details" },
        assigned_to_id: { type: "string", description: "User ID (get from get_team_summary)" },
        due_date: { type: "string", description: "Due date YYYY-MM-DD" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["title", "assigned_to_id"],
    },
  },
];

async function callAutomate(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json", "API-Key": API_KEY },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}/${endpoint}`, options);
  return res.json();
}

async function handleTool(name, input) {
  if (name === "get_users") {
    const data = await callAutomate("getTaskUsers");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
  if (name === "get_categories") {
    const data = await callAutomate("getTaskCategories");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
  if (name === "get_team_summary") {
    const KNOWN = {
      "c3d145dc-fc15-417d-a840-b68ee40f891d": "Rituraj Priyani — HR",
      "fb1f3c90-bdca-4f5b-bce0-97ffc88d037b": "Parth Dave — Sales",
      "2e2704b1-f770-4ccc-8ffe-902f877353a7": "Girish Sivaramakrishnan — Production",
      "20ca3a59-663b-4918-80f4-ee251e398f20": "Rishita Ramrakhyani — Accounts",
      "e7696867-3da6-41ef-8f67-f30680078493": "Sujit Devmurari — Quality",
      "1b3862e1-aded-445d-b1de-8821ab8c8e51": "Chirag Thakkar — CEO",
    };
    const summary = Object.entries(KNOWN).map(([id, name]) => ({ id, name }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
  if (name === "assign_task") {
    const payload = {
      title: input.title,
      description: input.description || "",
      assigned_to_id: input.assigned_to_id,
      assigned_by_id: "1b3862e1-aded-445d-b1de-8821ab8c8e51",
      due_date: input.due_date || null,
      priority: input.priority || "medium",
    };
    const data = await callAutomate("assignTask", "POST", payload);
    const msg = data.error
      ? `❌ Error: ${JSON.stringify(data)}`
      : `✅ Task assigned!\n${JSON.stringify(data, null, 2)}`;
    return { content: [{ type: "text", text: msg }] };
  }
  throw new Error(`Unknown tool: ${name}`);
}

// MCP JSON-RPC handler
app.post("/mcp", async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  try {
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "automateapp", version: "1.0.0" },
        },
      });
    }

    if (method === "tools/list") {
      return res.json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    }

    if (method === "tools/call") {
      const result = await handleTool(params.name, params.arguments || {});
      return res.json({ jsonrpc: "2.0", id, result });
    }

    if (method === "notifications/initialized") {
      return res.json({ jsonrpc: "2.0", id, result: {} });
    }

    return res.json({
      jsonrpc: "2.0", id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err) {
    return res.json({
      jsonrpc: "2.0", id,
      error: { code: -32000, message: err.message },
    });
  }
});

// SSE endpoint for Claude
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.write(`data: ${JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {}
  })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => clearInterval(keepAlive));
});

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/", (req, res) => res.json({ name: "automateapp-mcp", status: "running", endpoint: "/mcp" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP server running on port ${PORT}`));
