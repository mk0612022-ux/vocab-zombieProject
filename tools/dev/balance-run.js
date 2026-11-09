// Dev-only (not shipped). tools/balance.ps1: runs G.Balance on tools/balance.html
const r = G.Balance.run();
return JSON.stringify({ md: r.md, csv: r.csv, meleeCsv: r.meleeCsv, changelog: r.changelog, flags: r.flags.length, open: r.unexplained.map((f) => f.kind + " " + f.id + ": " + f.text) });
