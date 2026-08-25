const express = require("express");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "admin123";

const sessions = new Set();

const storage = multer.diskStorage({
destination: function (req, file, cb) {
cb(null, path.join(__dirname, "public", "uploads"));
},

filename: function (req, file, cb) {
    const extension = path.extname(file.originalname);
    const filename = Date.now() + extension;
    cb(null, filename);
}

});

const upload = multer({
storage: storage,

limits: {
    fileSize: 5 * 1024 * 1024
},

fileFilter: function (req, file, cb) {
    const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];

    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Дозволені тільки JPG, PNG, WEBP або GIF"));
    }
}

});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getSessionToken(req) {
const cookie = req.headers.cookie || "";

const match = cookie
    .split(";")
    .map(item => item.trim())
    .find(item => item.startsWith("session="));

if (!match) {
    return null;
}

return match.substring("session=".length);

}

function isAuthenticated(req) {
const token = getSessionToken(req);

return token && sessions.has(token);

}

function requireAuth(req, res, next) {
if (isAuthenticated(req)) {
return next();
}

if (req.path.startsWith("/api/")) {
    return res.status(401).json({
        error: "Потрібна авторизація"
    });
}

return res.redirect("/login.html");

}

app.get("/api/login", function (req, res) {
res.json({
authenticated: isAuthenticated(req)
});
});

app.post("/api/login", function (req, res) {
const login = String(req.body.login || "");
const password = String(req.body.password || "");

if (
    login !== ADMIN_LOGIN ||
    password !== ADMIN_PASSWORD
) {
    return res.status(401).json({
        error: "Неправильний логін або пароль"
    });
}

const token = crypto.randomBytes(32).toString("hex");

sessions.add(token);

res.setHeader(
    "Set-Cookie",
    "session=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400"
);

res.json({
    success: true
});

});

app.post("/api/logout", function (req, res) {
const token = getSessionToken(req);

if (token) {
    sessions.delete(token);
}

res.setHeader(
    "Set-Cookie",
    "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
);

res.json({
    success: true
});

});

app.get("/admin", function (req, res) {
if (!isAuthenticated(req)) {
return res.redirect("/login.html");
}

res.sendFile(
    path.join(
        __dirname,
        "public",
        "admin",
        "index.html"
    )
);

});

app.get("/admin/", function (req, res) {
if (!isAuthenticated(req)) {
return res.redirect("/login.html");
}

res.sendFile(
    path.join(
        __dirname,
        "public",
        "admin",
        "index.html"
    )
);

});

app.use("/admin", requireAuth);

app.use(
express.static(
path.join(__dirname, "public")
)
);

app.get("/", function (req, res) {
res.sendFile(
path.join(
__dirname,
"public",
"index.html"
)
);
});

app.get("/api/news", function (req, res) {
const news = db
.prepare(
"SELECT * FROM news ORDER BY created_at DESC"
)
.all();

res.json(news);

});

app.post(
"/api/news",
requireAuth,
upload.single("image"),
function (req, res) {
const title = req.body.title;
const category = req.body.category;
const text = req.body.text;

    if (!title || !category || !text) {
        return res.status(400).json({
            error: "Заповніть усі поля"
        });
    }

    let image = null;

    if (req.file) {
        image = "/uploads/" + req.file.filename;
    }

    const result = db
        .prepare(
            "INSERT INTO news (title, category, text, image, featured) VALUES (?, ?, ?, ?, 0)"
        )
        .run(
            title,
            category,
            text,
            image
        );

    const news = db
        .prepare(
            "SELECT * FROM news WHERE id = ?"
        )
        .get(result.lastInsertRowid);

    res.status(201).json(news);
}

);

app.put(
"/api/news/",
requireAuth,
upload.single("image"),
function (req, res) {
const id = req.params.id;

    const title = req.body.title;
    const category = req.body.category;
    const text = req.body.text;

    if (!title || !category || !text) {
        return res.status(400).json({
            error: "Заповніть усі поля"
        });
    }

    const oldNews = db
        .prepare(
            "SELECT * FROM news WHERE id = ?"
        )
        .get(id);

    if (!oldNews) {
        return res.status(404).json({
            error: "Новину не знайдено"
        });
    }

    let image = oldNews.image;

    if (req.file) {
        image = "/uploads/" + req.file.filename;
    }

    db.prepare(
        "UPDATE news SET title = ?, category = ?, text = ?, image = ? WHERE id = ?"
    ).run(
        title,
        category,
        text,
        image,
        id
    );

    const news = db
        .prepare(
            "SELECT * FROM news WHERE id = ?"
        )
        .get(id);

    res.json(news);
}

);

app.put(
"/api/news//featured",
requireAuth,
function (req, res) {
const id = req.params.id;

    const news = db
        .prepare(
            "SELECT * FROM news WHERE id = ?"
        )
        .get(id);

    if (!news) {
        return res.status(404).json({
            error: "Новину не знайдено"
        });
    }

    db.prepare(
        "UPDATE news SET featured = 0"
    ).run();

    db.prepare(
        "UPDATE news SET featured = 1 WHERE id = ?"
    ).run(id);

    const updatedNews = db
        .prepare(
            "SELECT * FROM news WHERE id = ?"
        )
        .get(id);

    res.json(updatedNews);
}

);

app.delete(
"/api/news//featured",
requireAuth,
function (req, res) {
const id = req.params.id;

    const news = db
        .prepare(
            "SELECT * FROM news WHERE id = ?"
        )
        .get(id);

    if (!news) {
        return res.status(404).json({
            error: "Новину не знайдено"
        });
    }

    db.prepare(
        "UPDATE news SET featured = 0 WHERE id = ?"
    ).run(id);

    res.json({
        success: true
    });
}

);

app.delete(
"/api/news/",
requireAuth,
function (req, res) {
const id = req.params.id;

    const result = db
        .prepare(
            "DELETE FROM news WHERE id = ?"
        )
        .run(id);

    if (result.changes === 0) {
        return res.status(404).json({
            error: "Новину не знайдено"
        });
    }

    res.json({
        success: true
    });
}

);

app.use(function (err, req, res, next) {
console.error(err);

res.status(400).json({
    error: err.message || "Помилка сервера"
});

});

app.listen(PORT, function () {
console.log(
"НОВИНИ UA запущено на порту " + PORT
);

console.log(
    "Логін: admin"
);

console.log(
    "Пароль: admin123"
);


});