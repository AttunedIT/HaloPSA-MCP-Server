import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HaloApiClient } from "../client/halo-api-client.js";
import type { HaloAppointment } from "../client/types.js";
import { errorResult } from "../utils/errors.js";

/**
 * HaloPSA agent To-Do items.
 *
 * The "To-Do" widget in the Halo agent UI is backed by the /Appointment entity
 * with `is_task: true` (Event Type = Task). The task text lives in `subject`,
 * `agent_id` determines whose To-Do list it appears in, and a linked ticket is
 * optional. This is distinct from the ticket-scoped /ToDo checklist endpoint.
 *
 * The agent To-Do widget only surfaces tasks that are due (start/end in the past
 * or present for the selected day). Future-dated slots are stored but hidden until due.
 */
const DEFAULT_TASK_MINUTES = 30;

function defaultWindow(): { start: string; end: string } {
  // Halo stores appointment times as naive local datetimes (no Z suffix).
  // Use current wall-clock time so new items appear immediately in the widget.
  const start = new Date();
  const end = new Date(start.getTime() + DEFAULT_TASK_MINUTES * 60 * 1000);
  const iso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  return { start: iso(start), end: iso(end) };
}

export function registerTodoTools(
  server: McpServer,
  client: HaloApiClient
): void {
  server.registerTool("halo_create_todo", {
    title: "Create To-Do",
    description:
      "Add an item to a HaloPSA agent's To-Do list. Backed by /Appointment with is_task=true; the text goes in `subject` and the item appears in the assigned agent's To-Do widget. A linked ticket is optional.",
    inputSchema: {
      subject: z.string().describe("The to-do item text"),
      agent_id: z.number().describe("Agent whose To-Do list this lands in"),
      start_date: z
        .string()
        .optional()
        .describe("Start date/time (ISO 8601). Defaults to now — controls which day the item shows under."),
      end_date: z
        .string()
        .optional()
        .describe("End date/time (ISO 8601). Defaults to 30 minutes after start."),
      ticket_id: z.number().optional().describe("Optional linked ticket ID"),
      client_id: z.number().optional().describe("Optional client ID"),
      is_private: z.boolean().optional().describe("Mark the to-do private to the agent"),
    },
  }, async (args) => {
    try {
      const window = defaultWindow();
      const result = await client.post<HaloAppointment>("/Appointment", {
        subject: args.subject,
        is_task: true,
        agent_id: args.agent_id,
        start_date: args.start_date ?? window.start,
        end_date: args.end_date ?? window.end,
        ticket_id: args.ticket_id,
        client_id: args.client_id,
        is_private: args.is_private,
      });
      return {
        content: [
          {
            type: "text",
            text: `To-do created:\n${JSON.stringify(
              {
                id: result.id,
                subject: result.subject,
                is_task: (result as Record<string, unknown>).is_task,
                agent_id: result.agent_id,
                start_date: result.start_date,
              },
              null,
              2
            )}`,
          },
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool("halo_list_todos", {
    title: "List To-Dos",
    description:
      "List an agent's HaloPSA To-Do items (is_task appointments). Optionally filter to a specific ticket.",
    inputSchema: {
      agent_id: z.number().describe("Agent whose To-Do list to read"),
      ticket_id: z.number().optional().describe("Filter to to-dos linked to this ticket"),
    },
  }, async (args) => {
    try {
      const result = await client.getList<HaloAppointment>("/Appointment", {
        agent_id: args.agent_id,
        ticket_id: args.ticket_id,
      });
      const todos = result.records
        .filter((a) => (a as Record<string, unknown>).is_task === true)
        .map((a) => ({
          id: a.id,
          subject: a.subject,
          start_date: a.start_date,
          end_date: a.end_date,
          ticket_id: a.ticket_id,
          complete_status: (a as Record<string, unknown>).complete_status,
        }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ record_count: todos.length, todos }, null, 2),
          },
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool("halo_complete_todo", {
    title: "Complete To-Do",
    description:
      "Mark a HaloPSA agent To-Do item complete (or reopen it) by appointment id. Sets complete_status (1 = complete, -1 = open).",
    inputSchema: {
      id: z.number().describe("The to-do (appointment) id"),
      complete: z.boolean().default(true).describe("Completion state (default true)"),
    },
  }, async (args) => {
    try {
      const result = await client.post<HaloAppointment>("/Appointment", {
        id: args.id,
        complete_status: (args.complete ?? true) ? 1 : -1,
      });
      return {
        content: [
          {
            type: "text",
            text: `To-do updated:\n${JSON.stringify(
              { id: result.id, complete_status: (result as Record<string, unknown>).complete_status },
              null,
              2
            )}`,
          },
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  });
}
