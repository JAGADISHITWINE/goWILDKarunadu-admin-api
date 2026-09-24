const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const loginModel = require("../models/User");
const db = require("../config/db");
const rbacService = require("../service/rbac.service");
require("dotenv").config();
const { encrypt, decrypt } = require("../service/cryptoHelper");
const { formatDateOnlyForMySQL } = require("../utils/helpers");

async function login(req, res) {
  try {
    const payload = req.body?.encryptedPayload ? decrypt(req.body.encryptedPayload) : req.body;
    const { email, password } = payload || {};

    // 1. Check if user exists
    const user = await loginModel.findUser(email);
    if (!user) {
      return res.status(401).json({
        response: false,
        message: "User not found",
      });
    }

    // 2. Validate password
    const isValid = await loginModel.validatePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        response: false,
        message: "Invalid credentials",
      });
    }

    // 3. Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set in environment');
      return res.status(500).json({ response: false, message: 'Server misconfiguration' });
    }

    const access = await rbacService.getRoleContextForAdmin(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: access.roleKey,
        roleName: access.roleName,
        permissions: access.permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 4. Save token to admins table
    await loginModel.saveToken(user.id, token); // <- make sure this function exists in your model

    // 5. Set HttpOnly cookie and send minimal user info
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    };

    res.cookie('token', token, cookieOptions);

    const encryptedResponse = encrypt({
      response: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: access.roleKey,
        roleName: access.roleName,
        permissions: access.permissions,
      },
      token
    });

    return res.status(200).json({ data: encryptedResponse });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ response: false, message: 'Internal server error' });
  }
}

async function logout(req, res) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });
    const encryptedResponse = encrypt({ response: true, message: 'Logged out' });
    return res.status(200).json({ data: encryptedResponse });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ response: false, message: 'Internal server error' });
  }
}

async function me(req, res) {
  try {
    // Return user info from req.user (set by auth middleware)
    if (!req.user) return res.status(401).json({ response: false, message: 'Unauthorized' });
    const access = await rbacService.getRoleContextForAdmin(req.user.id);
    const encryptedResponse = encrypt({
      response: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: access.roleKey,
        roleName: access.roleName,
        permissions: access.permissions,
      }
    });
    return res.status(200).json({ data: encryptedResponse });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ response: false, message: 'Internal server error' });
  }
}

async function getDashboardData(req, res) {
  try {
    const now = new Date();
    const monthStart = (offset = 0) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const toDbDate = (date) => formatDateOnlyForMySQL(date);

    const currentMonthStart = monthStart(0);
    const nextMonthStart = monthStart(1);
    const previousMonthStart = monthStart(-1);

    const currentRange = [toDbDate(currentMonthStart), toDbDate(nextMonthStart)];
    const previousRange = [toDbDate(previousMonthStart), toDbDate(currentMonthStart)];

    /* -------- COUNTS -------- */
    const [[userCount]] = await db.query(
      "SELECT COUNT(id) AS totalUsers FROM users",
    );
    const [[activeUserCount]] = await db.query(
      "SELECT COUNT(id) AS totalactiveUsers FROM users where is_active = 1",
    );
    const [[trekCount]] = await db.query(
      "SELECT COUNT(id) AS totaltrekCount FROM treks",
    );
    const [[bookingCount]] = await db.query(
      "SELECT COUNT(id) AS totalbookingCount FROM bookings",
    );
    const [[revenue]] = await db.query(
      "SELECT SUM(total_amount) AS totalRevenue FROM bookings WHERE payment_status = 'paid' AND booking_status IN ('confirmed','completed')",
    );
    const [[blogCount]] = await db.query(
      "SELECT COUNT(id) AS totalpostsCount FROM posts",
    );
    const [[commentCount]] = await db.query(
      "SELECT COUNT(id) AS totalCommentCount FROM comments",
    );

    const [
      [[currentMonthUsers]],
      [[previousMonthUsers]],
      [[currentMonthActiveUsers]],
      [[previousMonthActiveUsers]],
      [[currentMonthTreks]],
      [[previousMonthTreks]],
      [[currentMonthBookings]],
      [[previousMonthBookings]],
      [[currentMonthRevenue]],
      [[previousMonthRevenue]],
      [[currentMonthBlogs]],
      [[previousMonthBlogs]],
      [[currentMonthComments]],
      [[previousMonthComments]],
    ] = await Promise.all([
      db.query(
        "SELECT COUNT(id) AS total FROM users WHERE created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM users WHERE created_at >= ? AND created_at < ?",
        previousRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM users WHERE is_active = 1 AND created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM users WHERE is_active = 1 AND created_at >= ? AND created_at < ?",
        previousRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM treks WHERE created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM treks WHERE created_at >= ? AND created_at < ?",
        previousRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM bookings WHERE created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM bookings WHERE created_at >= ? AND created_at < ?",
        previousRange
      ),
      db.query(
        "SELECT COALESCE(SUM(total_amount), 0) AS total FROM bookings WHERE payment_status = 'paid' AND booking_status IN ('confirmed','completed') AND created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COALESCE(SUM(total_amount), 0) AS total FROM bookings WHERE payment_status = 'paid' AND booking_status IN ('confirmed','completed') AND created_at >= ? AND created_at < ?",
        previousRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM posts WHERE created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM posts WHERE created_at >= ? AND created_at < ?",
        previousRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM comments WHERE created_at >= ? AND created_at < ?",
        currentRange
      ),
      db.query(
        "SELECT COUNT(id) AS total FROM comments WHERE created_at >= ? AND created_at < ?",
        previousRange
      ),
    ]);

    /* -------- RECENT BOOKINGS -------- */
    const [recentBookings] = await db.query(`
      SELECT
        id,
        customer_name AS customerName,
        customer_email AS email,
        customer_phone AS phone,
        trek_name AS trekName,
        participants,
        total_amount AS amount,
        booking_status AS status,
        payment_status AS paymentStatus,
        DATE_FORMAT(created_at, '%d %b %Y') AS bookingDate
      FROM bookings
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const response = {
      totalUsers: userCount.totalUsers,
      totalactiveUsers: activeUserCount.totalactiveUsers,
      totaltrekCount: trekCount.totaltrekCount,
      totalbookingCount: bookingCount.totalbookingCount,
      totalRevenue: revenue.totalRevenue,
      recentBookings,
      totalBlog : blogCount.totalpostsCount,
      totalComments: commentCount.totalCommentCount,
      periodComparison: {
        periodLabel: 'vs last month',
        users: {
          current: Number(currentMonthUsers.total || 0),
          previous: Number(previousMonthUsers.total || 0),
        },
        activeUsers: {
          current: Number(currentMonthActiveUsers.total || 0),
          previous: Number(previousMonthActiveUsers.total || 0),
        },
        treks: {
          current: Number(currentMonthTreks.total || 0),
          previous: Number(previousMonthTreks.total || 0),
        },
        bookings: {
          current: Number(currentMonthBookings.total || 0),
          previous: Number(previousMonthBookings.total || 0),
        },
        revenue: {
          current: Number(currentMonthRevenue.total || 0),
          previous: Number(previousMonthRevenue.total || 0),
        },
        blogs: {
          current: Number(currentMonthBlogs.total || 0),
          previous: Number(previousMonthBlogs.total || 0),
        },
        comments: {
          current: Number(currentMonthComments.total || 0),
          previous: Number(previousMonthComments.total || 0),
        },
      },
    }

    const encryptedResponse = encrypt(response);

    /* -------- RESPONSE -------- */
    return res.status(200).json({
      success: true,
      data: encryptedResponse,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
}

module.exports = { login, logout, me, getDashboardData };
