#!/usr/bin/env node

import split from 'split';
import { exec } from 'child_process';
import program from 'commander';
import { mainStory, addListener, chalk } from 'storyboard';
import consoleListener from 'storyboard-listener-console';
import fileListener from 'storyboard-listener-file';
import wsServerListener from 'storyboard-listener-ws-server';

const pkg = require('../package.json');

let cmdWithArgs;
program
  .version(pkg.version)
  .option('--no-console', 'Disable console output', false)
  .option('--stderr', 'Enable stderr for errors', false)
  .option('--no-colors', 'Disable color output', false)
  .option('-f, --file <path>', 'Save logs to file')
  .option('-s, --server', 'Launch web server for logs', false)
  .option('-p, --port <port>', 'Port for web server', parseInt)
  .arguments('<command> [args...]')
  .action((command, args) => {
    cmdWithArgs = [command].concat(args).join(' ');
  })
  .parse(process.argv);

/* eslint-disable no-console */
if (cmdWithArgs == null) {
  console.log(chalk.red.bold('Missing command'));
  program.help(chalk.yellow.bold);
}
/* eslint-enable no-console */

// Setting `useStderr` to `false` aims to reduce out-of-order
// logs (Storyboard will output everything through `stdout`).
// Note: if you use launcher.js on a Node application, you still
// may get out-of-order logs since the application itself may flush
// stderr / stdout asynchronously:
// https://nodejs.org/api/console.html#console_asynchronous_vs_synchronous_consoles
// (there's nothing we can do to prevent that!)
if (program.console) {
  addListener(consoleListener, { useStderr: program.stderr, colors: program.colors });
}
if (program.file) addListener(fileListener, { filePath: program.file });
if (program.server) addListener(wsServerListener, { port: program.port });

const child = exec(cmdWithArgs);

const exit = () => { process.exit(); };
process.stdin.on('error', exit);
process.stdout.on('error', exit);
process.stderr.on('error', exit);

// Connect all pipes
process.stdin.pipe(child.stdin);

child.stdout.pipe(split())
  .on('data', (line) => mainStory.info(line))
  .on('end', () => { if (!program.server) process.exit(); });

child.stderr.pipe(split())
  .on('data', (line) => {
    if (!line.length) return;
    mainStory.error(line);
  })
  .on('end', () => { if (!program.server) process.exit(); });

process.on('SIGINT', () => {
  mainStory.info('storyboard', 'SIGINT received');
  process.exit(0);
});
