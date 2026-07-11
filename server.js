const app = require('./lib/app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\n  Synex Deploy Console — running`);
    console.log(`  http://localhost:${PORT}\n`);
});
