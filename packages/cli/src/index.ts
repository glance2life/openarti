#!/usr/bin/env node
import { Command } from "commander";
import { registerRead } from "./commands/read.js";
import { registerWrite } from "./commands/write.js";
import { registerEdit } from "./commands/edit.js";
import { registerLs } from "./commands/ls.js";
import { registerRm } from "./commands/rm.js";
import { registerGrep } from "./commands/grep.js";
import { registerGlob } from "./commands/glob.js";
import { registerLog } from "./commands/log.js";
import { registerDiff } from "./commands/diff.js";
import { registerBlame } from "./commands/blame.js";
import { registerRepo } from "./commands/repo.js";

const program = new Command();

program
  .name("arti")
  .description("CLI for OpenArti — shared knowledge base for AI Agents")
  .version("0.0.1")
  .option("--token <token>", "API token for authentication")
  .option("--endpoint <url>", "API endpoint URL");

registerRead(program);
registerWrite(program);
registerEdit(program);
registerLs(program);
registerRm(program);
registerGrep(program);
registerGlob(program);
registerLog(program);
registerDiff(program);
registerBlame(program);
registerRepo(program);

program.parseAsync().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
