export interface ParsedCommand {
  command: "eskalasi" | "tutup" | "tunda" | "lanjut" | "gangguan-massal";
  argument: string;
}

const VALID_COMMANDS = ["eskalasi", "tutup", "tunda", "lanjut", "gangguan-massal"] as const;

export function parseTicketCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIndex = trimmed.indexOf(" ");
  const command = (spaceIndex === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIndex)).toLowerCase();
  const argument = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim();

  if (!VALID_COMMANDS.includes(command as any)) return null;

  return { command: command as ParsedCommand["command"], argument };
}
