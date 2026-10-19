// Run deterministic, dependency-free test suites. scripts/test-*.mjs are manual
// live network/Crawl4AI smoke checks and should not block offline CI.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const tests=readdirSync("tests").filter(name=>name.endsWith(".test.mjs")).sort().map(name=>path.join("tests",name));
if(!tests.length) throw Error("No unit tests found");
const result=spawnSync(process.execPath,["--test",...tests],{stdio:"inherit",shell:false,env:process.env});
if(result.error)throw result.error;
process.exitCode=result.status??1;
