const path = require('path');
const { execSync } = require('child_process');

// Apply migrations to the test database once before the integration run.
module.exports = async () => {
  const databaseUrl =
    process.env.DATABASE_URL_TEST ||
    'postgresql://postgres@localhost:5433/our_sweet_family_test?host=/tmp';

  const serverDir = path.resolve(__dirname, '../..');
  execSync('npx prisma migrate deploy', {
    cwd: serverDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      LANG: process.env.LANG || 'en_US.UTF-8',
    },
  });
};
