import process from "node:process";
import readline from "node:readline";

// ANSI styling helpers
export const c = {
  reset: (s) => `\x1b[0m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  italic: (s) => `\x1b[3m${s}\x1b[23m`,
  underline: (s) => `\x1b[4m${s}\x1b[24m`,
  cyan: (s) => `\x1b[36m${s}\x1b[39m`,
  brightCyan: (s) => `\x1b[96m${s}\x1b[39m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s) => `\x1b[33m${s}\x1b[39m`,
  blue: (s) => `\x1b[34m${s}\x1b[39m`,
  magenta: (s) => `\x1b[35m${s}\x1b[39m`,
  red: (s) => `\x1b[31m${s}\x1b[39m`,
  gray: (s) => `\x1b[90m${s}\x1b[39m`,
  orange: (s) => `\x1b[38;5;208m${s}\x1b[39m`,
};

export const symbols = {
  pointer: "❯",
  selected: "◉",
  unselected: "○",
  check: "✔",
  cross: "✖",
  info: "ℹ",
  sparkle: "⚡",
};

/**
 * Text input prompt
 */
export async function promptText({ message, defaultValue = "", placeholder = "" }) {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${message} (${defaultValue}): `, (answer) => {
        rl.close();
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  process.stdout.write(`\n${c.green("?")} ${c.bold(message)} `);
  if (defaultValue) {
    process.stdout.write(c.gray(`(${defaultValue}) `));
  }

  return new Promise((resolve) => {
    let input = "";
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (str, key) => {
      if (key.ctrl && key.name === "c") {
        process.stdout.write("\n\n" + c.red("Aborted by user.") + "\n");
        process.exit(1);
      }

      if (key.name === "return") {
        cleanup();
        const result = input.trim() || defaultValue;
        process.stdout.write("\n");
        resolve(result);
        return;
      }

      if (key.name === "backspace") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      // Normal printable character
      if (str && !key.ctrl && !key.meta && str.length === 1) {
        input += str;
        process.stdout.write(str);
      }
    };

    function cleanup() {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    process.stdin.on("keypress", onKey);
  });
}

/**
 * Interactive Single Select prompt with Arrow navigation
 */
export async function promptSelect({ message, choices, defaultIndex = 0 }) {
  if (!process.stdin.isTTY) {
    console.log(`\n? ${message}`);
    choices.forEach((ch, i) => {
      console.log(`  [${i + 1}] ${ch.title} ${ch.hint ? `(${ch.hint})` : ""}`);
    });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`Select (1-${choices.length}): `, (answer) => {
        rl.close();
        const num = parseInt(answer.trim(), 10) - 1;
        const valid = !isNaN(num) && num >= 0 && num < choices.length;
        resolve(valid ? choices[num].value : choices[defaultIndex].value);
      });
    });
  }

  let selectedIndex = defaultIndex;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  // Hide cursor during selection
  process.stdout.write("\x1b[?25l");

  function render(firstTime = false) {
    if (!firstTime) {
      // Move cursor up by (choices.length + 1) lines
      process.stdout.write(`\x1b[${choices.length + 1}A\r`);
    }

    // Print question line
    process.stdout.write(`${c.green("?")} ${c.bold(message)} ${c.gray("(Use arrow keys or numbers)")}\x1b[K\n`);

    // Print choices
    choices.forEach((choice, idx) => {
      const isSelected = idx === selectedIndex;
      const pointer = isSelected ? c.orange(symbols.pointer) : " ";
      const radio = isSelected ? c.orange(symbols.selected) : c.gray(symbols.unselected);
      const title = isSelected ? c.bold(c.brightCyan(choice.title)) : choice.title;
      const hint = choice.hint ? c.gray(` - ${choice.hint}`) : "";

      process.stdout.write(`  ${pointer} ${radio} ${title}${hint}\x1b[K\n`);
    });
  }

  process.stdout.write("\n");
  render(true);

  return new Promise((resolve) => {
    const onKey = (str, key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n" + c.red("Aborted by user.") + "\n");
        process.exit(1);
      }

      if (key.name === "up" || key.name === "k") {
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
        render();
        return;
      }

      if (key.name === "down" || key.name === "j") {
        selectedIndex = (selectedIndex + 1) % choices.length;
        render();
        return;
      }

      // Check number keys
      const num = parseInt(str, 10);
      if (!isNaN(num) && num >= 1 && num <= choices.length) {
        selectedIndex = num - 1;
        render();
        return;
      }

      if (key.name === "return" || key.name === "space") {
        cleanup();
        // Clear options, print final answer line
        process.stdout.write(`\x1b[${choices.length + 1}A\r`);
        process.stdout.write(`${c.green(symbols.check)} ${c.bold(message)} ${c.orange(choices[selectedIndex].title)}\x1b[K\n`);
        for (let i = 0; i < choices.length; i++) {
          process.stdout.write(`\x1b[K\n`);
        }
        process.stdout.write(`\x1b[${choices.length}A\r`);
        resolve(choices[selectedIndex].value);
      }
    };

    function cleanup() {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      // Show cursor back
      process.stdout.write("\x1b[?25h");
    }

    process.stdin.on("keypress", onKey);
  });
}

/**
 * Confirm Prompt (Y/n)
 */
export async function promptConfirm({ message, defaultValue = true }) {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(`${message} (${defaultValue ? "Y/n" : "y/N"}): `, (ans) => {
        rl.close();
        const a = ans.trim().toLowerCase();
        if (a === "") resolve(defaultValue);
        resolve(a === "y" || a === "yes");
      });
    });
  }

  process.stdout.write(`\n${c.green("?")} ${c.bold(message)} ${c.gray(defaultValue ? "(Y/n)" : "(y/N)")} `);

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (str, key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n" + c.red("Aborted by user.") + "\n");
        process.exit(1);
      }

      let res = defaultValue;
      if (str === "y" || str === "Y") res = true;
      else if (str === "n" || str === "N") res = false;
      else if (key.name === "return") res = defaultValue;
      else return; // Ignore other keys

      cleanup();
      process.stdout.write(c.orange(res ? "Yes" : "No") + "\n");
      resolve(res);
    };

    function cleanup() {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    process.stdin.on("keypress", onKey);
  });
}
