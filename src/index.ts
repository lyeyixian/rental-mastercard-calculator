import { run } from './scraper/calculator';

run().catch((err: Error) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
