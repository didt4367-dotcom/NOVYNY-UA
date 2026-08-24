const Parser = require("rss-parser");

const parser = new Parser();

const db = require("./database");

const RSS_SOURCES = [
{
name: "Українська правда",
url: "https://www.pravda.com.ua/rss/"
}
];

function detectCategory(title, text) {

const content = (
    String(title || "") +
    " " +
    String(text || "")
).toLowerCase();

if (
    content.includes("війна") ||
    content.includes("фронт") ||
    content.includes("зсу") ||
    content.includes("армі") ||
    content.includes("окупант") ||
    content.includes("ракет") ||
    content.includes("дрон")
) {
    return "Війна";
}

if (
    content.includes("президент") ||
    content.includes("рада") ||
    content.includes("уряд") ||
    content.includes("депутат") ||
    content.includes("політик") ||
    content.includes("зеленськ")
) {
    return "Політика";
}

if (
    content.includes("економ") ||
    content.includes("банк") ||
    content.includes("грив") ||
    content.includes("долар") ||
    content.includes("ціна") ||
    content.includes("бізнес")
) {
    return "Економіка";
}

if (
    content.includes("спорт") ||
    content.includes("футбол") ||
    content.includes("матч") ||
    content.includes("олімп") ||
    content.includes("теніс")
) {
    return "Спорт";
}

if (
    content.includes("технолог") ||
    content.includes("штучний інтелект") ||
    content.includes("смартфон") ||
    content.includes("iphone") ||
    content.includes("android")
) {
    return "Технології";
}

if (
    content.includes("сша") ||
    content.includes("європ") ||
    content.includes("нато") ||
    content.includes("трамп") ||
    content.includes("росі") ||
    content.includes("світ")
) {
    return "Світ";
}

return "Україна";

}

function cleanText(text) {

if (!text) {
    return "";
}

return String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

}

async function importSource(source) {

try {

    const feed =
        await parser.parseURL(source.url);

    let added = 0;

    for (const item of feed.items) {

        const title =
            cleanText(item.title);

        if (!title) {
            continue;
        }

        const link =
            item.link || "";

        if (!link) {
            continue;
        }

        const exists =
            db.prepare(
                "SELECT id FROM news WHERE source_url = ?"
            ).get(link);

        if (exists) {
            continue;
        }

        const text =
            cleanText(
                item.contentSnippet ||
                item.content ||
                item.description ||
                ""
            );

        const category =
            detectCategory(
                title,
                text
            );

        let image = null;

        if (
            item.enclosure &&
            item.enclosure.url
        ) {
            image =
                item.enclosure.url;
        }

        db.prepare(
            "INSERT INTO news (title, category, text, image, featured, source_url) VALUES (?, ?, ?, ?, 0, ?)"
        ).run(
            title,
            category,
            text ||
                "Деталі новини доступні за посиланням на джерело.",
            image,
            link
        );

        added++;
    }

    console.log(
        source.name +
        ": додано " +
        added +
        " новин."
    );

} catch (error) {

    console.error(
        source.name +
        ": помилка RSS:",
        error.message
    );
}

}

async function importNews() {

console.log(
    "Перевіряємо RSS-джерела..."
);

for (const source of RSS_SOURCES) {
    await importSource(source);
}

console.log(
    "Перевірку RSS завершено."
);

}

async function startRSS() {

await importNews();

setInterval(
    importNews,
    10 * 60 * 1000
);

}

module.exports = {
startRSS,
importNews
};