const express = require("express");
const db = require("../modules/mysql2");
const dayjs = require("dayjs");
const router = express.Router();
const bcrypt = require("bcrypt");
const upload = require(__dirname + "/../modules/img-upload");
const jwt = require("jsonwebtoken");

// 登入會員並給驗證token的API
router.post("/login", async (req, res) => {
    const output = {
        success: false,
        code: 0,
        error: "",
    };
    if (!req.body.account || !req.body.password) {
        output.error = "欄位資料不足";
        return res.json(output);
    }

    const sql = "SELECT * FROM member_info WHERE account=?";
    const [rows] = await db.query(sql, [req.body.account]);
    if (!rows.length) {
        output.code = 402;
        output.error = "帳號或密碼錯誤";
        return res.json(output);
    }
    const verified = await bcrypt.compare(req.body.password, rows[0].password);
    if (!verified) {
        output.code = 406;
        output.error = "帳號或密碼錯誤";
        return res.json(output);
    }
    output.success = true;

    // 包 jwt 傳給前端
    const token = jwt.sign(
        {
            id: rows[0].sid,
            account: rows[0].account,
        },
        process.env.JWT_SECRET
    );

    output.data = {
        sid: rows[0].sid,
        account: rows[0].account,
        nickname: rows[0].nickname,
        length: req.body.password.length,
        token,
    };
    res.json(output);
});

// 拿到會員基本資料的API
router.get("/", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };
    if (!res.locals.jwtData) {
        console.log("step1");
        output.error = "沒有 token 驗證";
        return res.json(output);
    }
    const sql = `SELECT 
    member_info.*,
    CASE 
        WHEN member_achievement.name IS NOT NULL THEN member_achievement.name 
        ELSE member_info.achieve 
    END AS achieve_name,
    CASE 
        WHEN member_achievement.image IS NOT NULL THEN member_achievement.image 
        ELSE member_info.achieve 
    END AS achieve_image 
FROM 
    member_info 
LEFT JOIN 
    member_achievement 
ON 
    member_info.achieve = member_achievement.sid 
WHERE 
    account = ?;
`;
    const [rows] = await db.query(sql, [res.locals.jwtData.account]);
    res.json(rows);
});

// 修改會員基本資料的API
router.post("/", async (req, res) => {
    const { info, sid, title } = req.body; // 請確保你的請求正確包含 info、sid 和 title 欄位

    try {
        if (title === "password") {
            // 使用 bcrypt 套件將密碼進行雜湊
            const hashedPassword = await bcrypt.hash(info, 10);
            // 將雜湊後的密碼儲存到資料庫中
            const t_sql = "UPDATE `member_info` SET ?? = ? WHERE `sid` = ?";
            await db.query(t_sql, [title, hashedPassword, sid]);
            res.json({ success: true });
        } else {
            // 如果不是處理密碼，直接將資料儲存到資料庫中
            const t_sql = "UPDATE `member_info` SET ?? = ? WHERE `sid` = ?";
            await db.query(t_sql, [title, info, sid]);
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 拿到升級會員卡資料的API
router.get("/moneyCard", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };
    if (!res.locals.jwtData) {
        console.log("step1");
        output.error = "沒有 token 驗證";
        return res.json(output);
    }
    const sql = `SELECT * FROM member_level_card WHERE 1`;
    const [rows] = await db.query(sql);
    res.json(rows);
});

// 修改會員照片的API
router.post("/changeImage", upload.single("preImg"), async (req, res) => {
    const image = req.file.filename;
    const sql = "UPDATE `member_info` SET `photo`=? WHERE `account`=?";
    const [rows] = await db.query(sql, [image, res.locals.jwtData.account]);
    res.json(req.file);
});

// 註冊會員的API
router.post("/add", upload.single("photo"), async (req, res) => {
    const sql = `INSERT INTO member_info(
        account, 
        password, 
        name, 
        nickname, 
        mobile, 
        birthday, 
        address, 
        level, 
        wallet, 
        photo, 
        creat_at, 
        achieve
        ) VALUES (
            ?,?,?,?,?,
            ?,?,?,?,?,
            NOW(),?)`;

    let birthday = dayjs(req.body.birthday);
    if (birthday.isValid()) {
        birthday = birthday.format("YYYY-MM-DD");
    } else {
        birthday = null;
    }

    const [result] = await db.query(sql, [
        req.body.account,
        bcrypt.hashSync(req.body.password, 10),
        req.body.name,
        req.body.nickname,
        req.body.mobile,
        birthday,
        req.body.address,
        1,
        0,
        req.file.filename,
        1,
    ]);

    res.json({
        result,
        postData: req.body,
    });
});

// 拿到會員優惠券資料的API
router.get("/coupon", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };

    if (!res.locals.jwtData) {
        output.error = "沒有 token 驗證";
        return res.json(output);
    }

    const sql = `SELECT user_coupon.*, coupon.coupon_title, coupon.coupon_discount
    FROM user_coupon
    JOIN coupon ON user_coupon.coupon_sid = coupon.coupon_sid
    WHERE user_coupon.member_id = ?`;
    const [rows] = await db.query(sql, [res.locals.jwtData.id]);
    res.json(rows);
});

// 拿到會員發文資料的API
router.get("/article", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };

    if (!res.locals.jwtData) {
        output.error = "沒有 token 驗證";
        return res.json(output);
    }

    const sql = `SELECT publishedTime,header,content,category FROM article WHERE user_id = ?`;

    const [rows] = await db.query(sql, [res.locals.jwtData.id]);
    res.json(rows);
});

// 拿到會員錢包紀錄的API
router.get("/walletRecord", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };

    if (!res.locals.jwtData) {
        output.error = "沒有 token 驗證";
        return res.json(output);
    }

    const sql = `SELECT * FROM member_wallet_record WHERE member_id=?`;

    const [rows] = await db.query(sql, [res.locals.jwtData.id]);
    res.json(rows);
});

// 拿到會員成就的API
router.get("/achieveRecord", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };

    if (!res.locals.jwtData) {
        output.error = "沒有 token 驗證";
        return res.json(output);
    }

    const sql = `SELECT member_achieve_record.*, member_achievement.name, member_achievement.image
    FROM member_achieve_record 
    JOIN member_achievement ON member_achieve_record.achieve_id = member_achievement.sid
    WHERE member_achieve_record.member_id = ?`;

    const [rows] = await db.query(sql, [res.locals.jwtData.id]);
    res.json(rows);
});

// 更換配戴成就的API
router.post("/changeAchieve", async (req, res) => {
    const output = {
        success: false,
        error: "",
        data: null,
    };

    if (!res.locals.jwtData) {
        output.error = "沒有 token 驗證";
        return res.json(output);
    }

    const achieveImage = req.body.image;
    const getAchieveSidQuery = `SELECT sid FROM member_achievement WHERE image = ?`;
    const [row1] = await db.query(getAchieveSidQuery, [achieveImage]);
    const changeMemberAchieve = `UPDATE member_info SET achieve = ? WHERE sid = ?`;
    const [row2] = await db.query(changeMemberAchieve, [
        row1[0].sid,
        res.locals.jwtData.id,
    ]);
    res.json(row2);
});

module.exports = router;
