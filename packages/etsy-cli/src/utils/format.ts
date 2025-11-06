import { table } from 'table';
import chalk from 'chalk';

export function formatTable(headers: string[], rows: string[][]): string {
  const data = [headers.map(h => chalk.bold(h)), ...rows];
  return table(data, {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  });
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function formatList(items: string[]): string {
  return items.map(item => `  • ${item}`).join('\n');
}

export function formatError(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message;
  return chalk.red(`Error: ${message}`);
}

export function formatSuccess(message: string): string {
  return chalk.green(`✓ ${message}`);
}

export function formatInfo(message: string): string {
  return chalk.blue(`ℹ ${message}`);
}

export function formatWarning(message: string): string {
  return chalk.yellow(`⚠ ${message}`);
}
