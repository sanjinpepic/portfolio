// js/terminal.js — Terminal window with retro commands

import { windows, S } from "./state.js";
import { openWindow, closeWindow } from "./window-manager.js";

const TERMINAL_HELP = `Available commands:
  help          Show this help
  whoami        About Sanjin
  ls            List filesystem
  ls projects   List portfolio projects
  cat about.txt About section
  cat skills.txt Skills list
  cat readme.md Welcome message
  open <id>     Open a window
  close <id>    Close a window
  date          Current date/time
  uname -a      System info
  clear         Clear terminal
  exit          Close terminal`;

const TERMINAL_WINDOWS = {
  about:    "about-window",
  projects: "projects-window",
  browser:  "browser-window",
  resume:   "resume-window",
  timeline: "timeline-window",
  contact:  "contact-window",
  dashboard: "dashboard-window",
  winamp:   "winamp-window",
  terminal: "terminal-window",
  error:    "easter-error",
};

let terminalOutput = null;
let terminalInput = null;
let terminalHistory = [];
let terminalHistoryIdx = -1;

function terminalPrint(text, cls = "t-out") {
  if (!terminalOutput) return;
  const line = document.createElement("span");
  line.className = `t-line ${cls}`;
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function terminalRunCommand(raw) {
  const input = raw.trim();
  if (!input) return;
  terminalPrint(`C:\\PORTFOLIO> ${input}`, "t-cmd");
  terminalHistory.unshift(input);
  if (terminalHistory.length > 50) terminalHistory.pop();
  terminalHistoryIdx = -1;

  const [cmd, ...args] = input.toLowerCase().split(/\s+/);

  if (cmd === "clear") {
    if (terminalOutput) terminalOutput.innerHTML = "";
    return;
  }
  if (cmd === "exit") {
    closeWindow("terminal-window");
    return;
  }
  if (cmd === "help") {
    terminalPrint(TERMINAL_HELP);
    return;
  }
  if (cmd === "whoami") {
    terminalPrint("Sanjin Pepic");
    terminalPrint("Strategy & Product Leader — Industrial + Sustainability");
    terminalPrint("Stockholm, Sweden · sanjin@pepic.me");
    return;
  }
  if (cmd === "date") {
    terminalPrint(new Date().toString());
    return;
  }
  if (cmd === "uname" && args[0] === "-a") {
    terminalPrint("PortfolioOS 1.0 (Retro Edition) #1 SMP 1993-01-01 i486");
    terminalPrint("CPU: Sanjin-1000 @ 500 MHz   RAM: 640 KB   VRAM: 256 KB");
    return;
  }
  if (cmd === "ls") {
    if (args[0] === "projects") {
      terminalPrint("Projects/");
      S.portfolioApps.forEach((app, i) => {
        const num = String(app.order || i + 1).padStart(2, "0");
        terminalPrint(`  ${num}  ${app.title}`);
      });
      return;
    }
    terminalPrint("Volume: PORTFOLIO");
    terminalPrint(" Directory of C:\\PORTFOLIO");
    terminalPrint("");
    terminalPrint("  about.txt      resume.txt     skills.txt");
    terminalPrint("  readme.md      projects/      apps/");
    terminalPrint("");
    terminalPrint(`${S.portfolioApps.length} project(s) — ${windows.length} window(s) available`);
    return;
  }
  if (cmd === "dir") {
    terminalPrint("Use 'ls' or 'ls projects'");
    return;
  }
  if (cmd === "cat") {
    const file = args[0] || "";
    if (file === "about.txt") {
      terminalPrint("Strategy and product leader delivering measurable");
      terminalPrint("commercial growth and operational transformation in");
      terminalPrint("industrial and sustainability-driven businesses.");
      terminalPrint("I align business strategy, product execution, and");
      terminalPrint("analytics adoption to move teams from insights to");
      terminalPrint("shipped outcomes.");
      return;
    }
    if (file === "skills.txt") {
      terminalPrint("Data & Analytics: dbt, SQL, Python, BigQuery, Tableau");
      terminalPrint("Product: Strategy, Roadmapping, A/B Testing, Analytics");
      terminalPrint("Domains: Metallurgy (Erasteel), Energy (Tibber),");
      terminalPrint("         Fintech (Anyfin), Education (SSE)");
      terminalPrint("Tools:   BI platforms, dbt Cloud, GCP, GitHub");
      return;
    }
    if (file === "readme.md") {
      terminalPrint("# Welcome to Sanjin's Portfolio OS");
      terminalPrint("");
      terminalPrint("This is a retro OS-themed portfolio built in");
      terminalPrint("vanilla HTML, CSS, and JavaScript. No frameworks.");
      terminalPrint("Just raw craft and a fondness for the 90s.");
      terminalPrint("");
      terminalPrint("Try: open projects, open resume, ls projects");
      terminalPrint("     sudo hire sanjin");
      return;
    }
    terminalPrint(`cat: ${file}: No such file or directory`, "t-err");
    return;
  }
  if (cmd === "open") {
    const key = args[0] || "";
    const winId = TERMINAL_WINDOWS[key] || (windows.find(w => w.id === key) ? key : null);
    if (winId) {
      openWindow(winId);
      terminalPrint(`Opening ${key}...`);
    } else {
      terminalPrint(`open: unknown window '${key}'. Try: ${Object.keys(TERMINAL_WINDOWS).join(", ")}`, "t-err");
    }
    return;
  }
  if (cmd === "close") {
    const key = args[0] || "";
    const winId = TERMINAL_WINDOWS[key] || (windows.find(w => w.id === key) ? key : null);
    if (winId) {
      closeWindow(winId);
      terminalPrint(`Closed ${key}.`);
    } else {
      terminalPrint(`close: unknown window '${key}'`, "t-err");
    }
    return;
  }
  if (cmd === "sudo") {
    if (args[0] === "hire" && args[1] === "sanjin") {
      terminalPrint("Granting elevated hiring privileges...");
      terminalPrint("Access granted. Excellent taste confirmed.");
      terminalPrint("Please reach out: sanjin@pepic.me");
      return;
    }
    if (args.join(" ") === "rm -rf /") {
      terminalPrint("Permission denied. Nice try.", "t-err");
      return;
    }
    terminalPrint(`sudo: command not found: ${args.join(" ")}`, "t-err");
    return;
  }

  terminalPrint(`'${cmd}' is not recognized. Type 'help' for commands.`, "t-err");
}

export function bindTerminal() {
  terminalOutput = document.getElementById("terminal-output");
  terminalInput  = document.getElementById("terminal-input");
  if (!terminalInput) return;

  // Welcome message
  terminalPrint("Portfolio Terminal v1.0 — Type 'help' to get started.", "t-dim");
  terminalPrint("", "t-dim");

  terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = terminalInput.value;
      terminalInput.value = "";
      terminalRunCommand(val);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      terminalHistoryIdx = Math.min(terminalHistoryIdx + 1, terminalHistory.length - 1);
      terminalInput.value = terminalHistory[terminalHistoryIdx] || "";
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      terminalHistoryIdx = Math.max(terminalHistoryIdx - 1, -1);
      terminalInput.value = terminalHistoryIdx >= 0 ? terminalHistory[terminalHistoryIdx] : "";
    }
  });

  // Click anywhere in terminal to focus input
  const termContent = document.querySelector(".terminal-content");
  if (termContent) {
    termContent.addEventListener("click", () => terminalInput.focus());
  }
}
