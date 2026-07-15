import { Logger } from 'tslog';

// One logger per entry point ('fetch' | 'notify'), timestamped local time so
// log lines line up with the launchd schedule (19:00 / 20:00). tslog's pretty
// type is uncolored when stdout is not a TTY, so the launchd log files stay
// plain text.
export function createLogger(name: 'fetch' | 'notify') {
  return new Logger({
    name,
    minLevel: 'INFO',
    pretty: {
      template:
        '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}} {{logLevelName}} [{{name}}] ',
      timeZone: 'local',
    },
  });
}
