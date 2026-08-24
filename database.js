const Database = require("better-sqlite3");

const db = new Database("news.db");

db.exec(
"CREATE TABLE IF NOT EXISTS news (" +
"id INTEGER PRIMARY KEY AUTOINCREMENT, " +
"title TEXT NOT NULL, " +
"category TEXT NOT NULL, " +
"text TEXT NOT NULL, " +
"image TEXT, " +
"featured INTEGER DEFAULT 0, " +
"source_url TEXT, " +
"created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
")"
);

let columns = db
.prepare("PRAGMA table_info(news)")
.all();

let hasImage = columns.some(
column => column.name === "image"
);

if (!hasImage) {
db.exec(
"ALTER TABLE news ADD COLUMN image TEXT"
);
}

columns = db
.prepare("PRAGMA table_info(news)")
.all();

let hasFeatured = columns.some(
column => column.name === "featured"
);

if (!hasFeatured) {
db.exec(
"ALTER TABLE news ADD COLUMN featured INTEGER DEFAULT 0"
);
}

columns = db
.prepare("PRAGMA table_info(news)")
.all();

let hasSourceUrl = columns.some(
column => column.name === "source_url"
);

if (!hasSourceUrl) {
db.exec(
"ALTER TABLE news ADD COLUMN source_url TEXT"
);
}

console.log("База даних готова!");

module.exports = db;