import { openSync, closeSync } from "node:fs";
closeSync(openSync(new URL("./demo.db", import.meta.url), "a"));
