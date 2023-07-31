// 引入dotenv
if (process.argv[2] === "production") {
    require("dotenv").config({
        path: __dirname + "/production.env",
    });
} else {
    require("dotenv").config();
}

const upload = require(__dirname + "/modules/img-upload");
const express = require("express");
const session = require("express-session");
const MysqlStore = require("express-mysql-session")(session);
const db = require(__dirname + "/modules/mysql2");
const sessionStore = new MysqlStore({}, db);
const moment = require("moment-timezone");
const dayjs = require("dayjs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
const bodyParser = require("body-parser");

// 設定使用的樣版引擎(白名單)
app.set("view engine", "ejs");
const whitelist = ["http://localhost:5500"];
const corsOptions = {
    credentials: true,
    origin: (origin, cb) => {
        console.log({ origin });
        cb(null, true);
    },
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(bodyParser.json());
app.use(
    session({
        saveUninitialized: false,
        resave: false,
        secret: "jdfkhHSD86758374fjsdhsj",
        store: sessionStore,

        cookie: {
            maxAge: 1200_000,
            domain: ".shinder.com",
        },
    })
);

// 自訂 middleware
app.use((req, res, next) => {
    // template helper functions
    res.locals.toDateString = (d) => {
        const fm = "YYYY-MM-DD";
        const djs = dayjs(d);
        return djs.format(fm);
    };
    res.locals.toDatetimeString = (d) => {
        const fm = "YYYY-MM-DD  HH:mm:ss";
        const djs = dayjs(d);
        return djs.format(fm);
    };

    // 抓取前端傳來的req
    const auth = req.get("Authorization");
    if (auth && auth.indexOf("Bearer ") === 0) {
        const token = auth.slice(7);
        console.log(token);
        let jwtData = null;
        try {
            jwtData = jwt.verify(token, process.env.JWT_SECRET);
        } catch (ex) {}
        if (jwtData) {
            res.locals.jwtData = jwtData;
            console.log("jwtData", res.locals.jwtData.id);
        }
    }

    next();
});

// 路由引導
app.use("/member", require(__dirname + "/routes/member"));

// 設定靜態內容的資料夾
app.get("*", express.static("public"));
app.get("*", express.static("node_modules/bootstrap/dist"));
app.get("*", express.static("node_modules/jquery/dist"));

app.use((req, res) => {
    res.type("text/html").status(404).send(`<h1>找不到頁面</h1>`);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`啟動~ port: ${port}`);
});
