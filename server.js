 require("dotenv").config();

 const express = require("express");

const session = require("express-session");

const { MongoStore } = require("connect-mongo");

const multer = require("multer");

const connectDB = require("./config/db");

const Student = require("./models/Student");

const Fest = require("./models/fest");

const Attendance = require("./models/Attendance");

const AttendanceSession = require("./models/AttendanceSession");

const Message = require("./models/Message");

const Timetable = require("./models/Timetable");

const Teacher = require("./models/Teacher");

const MenuItem = require("./models/MenuItem");

const CanteenOwner = require("./models/CanteenOwner");

const Group = require("./models/Group");

const GroupMessage = require("./models/GroupMessage");

const Follow = require("./models/Follow");

const Notification = require("./models/Notification");

const path = require("path");

const app = express();

app.set("trust proxy", 1);

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server);

const mongoose = require("mongoose");

const compression = require("compression");

const onlineStudents = new Map();

const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./config/cloudinary");

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "attendease-chat",
        resource_type: "auto",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "mp3", "wav", "m4a", "ogg", "webm"]
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB max
    }
});

const menuStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "attendease-canteen",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"]
    }
});

const uploadMenuPhoto = multer({
    storage: menuStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const profileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "attendease-profiles",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"]
    }
});

const uploadProfilePhoto = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});


io.on("connection", (socket) => {

    console.log("A user connected:", socket.id);

    // ===============================
    // CANTEEN OWNER JOIN
    // ===============================

    socket.on("canteenOwnerJoin", () => {

        socket.join("canteen-owner");

        console.log(
            "Canteen Owner joined live order room:",
            socket.id
        );

    });

    

    // ===============================
    // STUDENT JOIN
    // ===============================

    socket.on("studentJoin", async (studentData) => {

    if (!studentData || !studentData._id) {
        return;
    }

    const studentId = studentData._id.toString();

// Save student as online
onlineStudents.set(studentId, socket.id);

// Join personal room
socket.join(`student:${studentId}`);

console.log(`Student joined personal room: student:${studentId}`);

    // Mark messages sent to this student as delivered
    const undeliveredMessages = await Message.find({
        receiver: studentId,
        status: "sent"
    });

    for (const msg of undeliveredMessages) {

        msg.status = "delivered";
        await msg.save();

        // Tell sender instantly
        io.to(`student:${msg.sender.toString()}`).emit(
            "messageDelivered",
            {
                messageId: msg._id.toString()
            }
        );
    }

    // YOUR EXISTING CODE CONTINUES HERE...
        

        // ===============================
// MESSAGE DELIVERED
// ===============================




        // ===============================
        // TELL NEW STUDENT WHO IS ALREADY ONLINE
        // ===============================

        for (const onlineStudentId of onlineStudents.keys()) {

            if (onlineStudentId !== studentId) {

                socket.emit("studentOnline", {
                    studentId: onlineStudentId
                });

            }

        }

        // ===============================
        // CLASS ROOM
        // ===============================

        if (
            studentData.department &&
            studentData.semester &&
            studentData.section
        ) {

            const roomName = buildRoomName(
                studentData.department,
                studentData.semester,
                studentData.section
            );

            socket.join(roomName);

            // Global student room
            socket.join("all-students");

            console.log(
                "Student joined class room:",
                roomName
            );
        }

        // ===============================
        // TELL EVERYONE THIS STUDENT IS ONLINE
        // ===============================

        

        io.emit("studentOnline", {
            studentId: studentId
        });

    });

    // ===============================
// MARK MESSAGES AS READ
// ===============================

socket.on("markMessagesRead", async (data) => {
    try {
        if (!data || !data.studentId || !data.otherStudentId) {
            return;
        }

        await Message.updateMany(
            {
                sender: data.otherStudentId,
                receiver: data.studentId,
                status: { $ne: "read" }
            },
            {
                $set: {
                    status: "read"
                }
            }
        );
                await Notification.updateMany(
            { recipient: data.studentId, sender: data.otherStudentId, type: "message" },
            { read: true, count: 0 }
        );
        

        console.log(
            `Messages marked as read: ${data.otherStudentId} -> ${data.studentId}`
        );

    } catch (error) {
        console.error("Mark messages read error:", error);
    }
});

// ===============================
// TYPING INDICATOR
// ===============================

socket.on("typing", (data) => {
    if (!data || !data.receiverId || !data.senderId) {
        return;
    }

    io.to(`student:${data.receiverId}`).emit("userTyping", {
        senderId: data.senderId
    });
});

socket.on("stopTyping", (data) => {
    if (!data || !data.receiverId || !data.senderId) {
        return;
    }

    io.to(`student:${data.receiverId}`).emit("userStoppedTyping", {
        senderId: data.senderId
    });
});

        // ===============================
    // GROUP CHAT - JOIN ROOM
    // ===============================

    socket.on("joinGroup", (data) => {

        if (!data || !data.groupId) {
            return;
        }

        socket.join(`group:${data.groupId}`);

        console.log(`Socket joined group room: group:${data.groupId}`);

    });

    // ===============================
    // GROUP CHAT - TYPING
    // ===============================

    socket.on("groupTyping", (data) => {

        if (!data || !data.groupId || !data.senderId || !data.senderName) {
            return;
        }

        socket.to(`group:${data.groupId}`).emit("userTypingGroup", {
            senderId: data.senderId,
            senderName: data.senderName
        });

    });

    socket.on("groupStopTyping", (data) => {

        if (!data || !data.groupId || !data.senderId) {
            return;
        }

        socket.to(`group:${data.groupId}`).emit("userStoppedTypingGroup", {
            senderId: data.senderId
        });

    });


    // ===============================
    // STUDENT DISCONNECT
    // ===============================

    socket.on("disconnect", () => {

        console.log(
            "User disconnected:",
            socket.id
        );

        // Find which student belongs to this socket
        for (
            const [studentId, socketId]
            of onlineStudents.entries()
        ) {

            if (socketId === socket.id) {

                onlineStudents.delete(studentId);

                // Tell everyone this student went offline
                io.emit("studentOffline", {
                    studentId: studentId
                });

                console.log(
                    "Student went offline:",
                    studentId
                );

                break;
            }

        }

    });

});



function buildRoomName(department, semester, section) {
    return `${department}-${semester}-${section}`.trim().toLowerCase();
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});

app.use(session({

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({

        mongoUrl: process.env.MONGODB_URI,

        collectionName: "sessions"

    }),

    cookie: {

        maxAge: 365 * 24 * 60 * 60 * 1000,

        httpOnly: true,

        sameSite: "lax",

        secure: false

    }

}));

app.use(async (req, res, next) => {

    res.locals.unreadNotifCount = 0;

    if (req.session.student) {

        try {

            res.locals.unreadNotifCount = await Notification.countDocuments({
                recipient: req.session.student._id,
                read: false
            });

        } catch (error) {
            console.error("Unread notification count error:", error);
        }

    }

    next();

});

app.set("view engine", "ejs");

app.use(express.static("public"));

// Serve CSS, JS and Images
app.use(express.static("public"));

app.get("/", (req,res)=>{

    res.render("login");

});

app.get("/login", (req, res) => {

    res.render("login");

});

app.get("/student-register", (req, res) => {

    res.render("student-register");

});

app.post("/student-register", async (req, res) => {

    try {

        // Check if email already exists
        const existingEmail = await Student.findOne({
            email: req.body.email
        });

        if (existingEmail) {
            return res.send("Email already registered.");
        }

        // Check if roll number already exists
        const existingRoll = await Student.findOne({
            rollNo: req.body.rollNo
        });

        if (existingRoll) {
            return res.send("Roll Number already exists.");
        }

        const student = new Student({

            name: req.body.name,
            fatherName: req.body.fatherName,
            rollNo: req.body.rollNo,
            semester: req.body.semester,
department: req.body.department,
section: req.body.section,
mobile: req.body.mobile,
            email: req.body.email,
            password: req.body.password,
            state: req.body.state,
            district: req.body.district,
            city: req.body.city,
            address: req.body.address,
            pincode: req.body.pincode,
            dob: req.body.dob

        });

        await student.save();

        res.redirect("/login");

    } catch (err) {

        console.log(err);

        res.send("Registration Failed");

    }

});
app.get("/fest", (req, res) => {

    res.render("fest");

});


app.post("/fest", async (req, res) => {

    try {

        // Check if roll number is already registered
        const existingRoll = await Fest.findOne({
            rollNo: req.body.rollNo
        });

        if (existingRoll) {
            return res.send("Roll Number already registered for the Youth Festival.");
        }


        // Create new Youth Festival registration
        const fest = new Fest({

            name: req.body.name,

            fatherName: req.body.fatherName,

            rollNo: req.body.rollNo,

            semester: req.body.semester,

            section: req.body.section,

            department: req.body.department,

            event: req.body.event,

            mobile: req.body.mobile

        });


        // Save registration
        await fest.save();


        // Success
        res.render("success");


    } catch (err) {

        console.log(err);

        res.status(500).send("Youth Festival Registration Failed.");

    }

});

app.get("/teacher-fest", async (req, res) => {

    try {

        const festStudents = await Fest.find().sort({
            event: 1,
            name: 1
        });

        res.render("teacher-fest", {
            festStudents
        });

    } catch (err) {

        console.log(err);

        res.send("Unable to load festival registrations.");

    }

});

app.get("/admin-login", (req, res) => {

    res.render("admin-login");

});

app.post("/admin-login", async (req, res) => {

    try {

        const username = req.body.username;
        const password = req.body.password;

        const teacher = await Teacher.findOne({
            username: username
        });

        if (!teacher) {

    return res.status(401).send(
        "Incorrect username or password. Please try again."
    );

}

if (teacher.password !== password) {

    return res.status(401).send(
        "Incorrect username or password. Please try again."
    );

}

        // Save teacher in session
        req.session.teacher = teacher;

        // Keep admin session for existing dashboard protection
        req.session.admin = true;

        res.redirect("/dashboard");

    } catch (err) {

        console.log(err);

        res.send("Login Failed");

    }

});

// ===============================
// CANTEEN OWNER LOGIN
// ===============================

// Show canteen owner login page
app.get("/canteen-login", (req, res) => {
    res.render("canteen-login");
});

// Handle canteen owner login
app.post("/canteen-login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const canteenOwner = await CanteenOwner.findOne({ username });

        if (!canteenOwner) {
            return res.status(401).send("Incorrect username or password.");
        }

        if (canteenOwner.password !== password) {
            return res.status(401).send("Incorrect username or password.");
        }

        // Create separate canteen owner session
        req.session.canteenOwner = canteenOwner;

        res.redirect("/canteen-dashboard");

    } catch (error) {
        console.error("Canteen owner login error:", error);
        res.status(500).send("Canteen login failed.");
    }
});

// TEMPORARY: Create Canteen Owner
app.get("/create-canteen-owner", async (req, res) => {
    try {
        const existingOwner = await CanteenOwner.findOne({
            username: "canteen"
        });

        if (existingOwner) {
            return res.send("Canteen owner already exists.");
        }

        await CanteenOwner.create({
            name: "Canteen Owner",
            username: "canteen",
            password: "123456"
        });

        res.send("Canteen owner created successfully.");
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to create canteen owner.");
    }
});

// ===============================
// CANTEEN OWNER DASHBOARD
// ===============================

app.get("/canteen-dashboard", (req, res) => {

    // Only Canteen Owner can access
    if (!req.session.canteenOwner) {
        return res.redirect("/canteen-login");
    }

    res.render("canteen-dashboard", {
        canteenOwner: req.session.canteenOwner
    });
});

// Canteen Owner Logout
app.get("/canteen-logout", (req, res) => {

    req.session.canteenOwner = null;

    res.redirect("/canteen-login");
});

app.patch("/order/:id/status", async (req, res) => {
    try {

        if (!req.session.canteenOwner) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const { status } = req.body;

        const allowedStatuses = [
            "placed",
            "accepted",
            "preparing",
            "ready",
            "completed",
            "cancelled"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status."
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        order.status = status;

        await order.save();

        io.to(`student:${order.orderedBy.toString()}`).emit("orderStatusUpdated", {
    orderId: order._id.toString(),
    status: order.status
});

        res.json({
            success: true,
            status: order.status
        });

    } catch (error) {

        console.error("Update order status error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update order status."
        });
    }
});

// ===============================
// TOGGLE MENU ITEM STOCK
// ===============================


app.patch("/menu-item/:id/toggle-stock", async (req, res) => {
    try {

        if (!req.session.canteenOwner) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const menuItem = await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found"
            });
        }

        menuItem.available = !menuItem.available;

        await menuItem.save();

        res.json({
            success: true,
            available: menuItem.available
        });

    } catch (error) {
        console.error("Toggle stock error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update stock."
        });
    }
});

app.post("/start-attendance", async (req, res) => {

    await AttendanceSession.create({

        department: "B.Sc Computer Science",

        semester: 3,

        date: new Date().toISOString().split("T")[0],

        isOpen: true,

        startTime: new Date(),

        endTime: new Date(Date.now() + 60000)

    });

    res.send("Attendance Session Started");

});
app.get("/dashboard", (req, res) => {

    if (!req.session.admin) {

        return res.redirect("/admin-login");

    }

    res.render("dashboard");

});
app.post("/login", async (req, res) => {

    const { email, password } = req.body;

    const student = await Student.findOne({ email: email });

    if (!student) {
    return res.status(404).send("We couldn't find an account with that email.");
}

  if (student.password !== password) {
    return res.status(401).send("Incorrect password. Please try again.");
}

// Save student in session
req.session.student = student;

res.redirect("/student-dashboard");

});

app.get("/student-dashboard", async (req, res) => {

    if (!req.session.student) {

        return res.redirect("/login");

    }

    const totalAttendance = await Attendance.countDocuments({

        studentId: req.session.student._id

    });

    const presentAttendance = await Attendance.countDocuments({

        studentId: req.session.student._id,

        present: true

    });

    const absentAttendance = totalAttendance - presentAttendance;

    let percentage = 0;

    if (totalAttendance > 0) {

        percentage = ((presentAttendance / totalAttendance) * 100).toFixed(2);

    }

        const unreadNotifCount = await Notification.countDocuments({
        recipient: req.session.student._id,
        read: false
    });

    res.render("student-dashboard", {

        student: req.session.student,

        totalAttendance,

        presentAttendance,

        absentAttendance,

        percentage

    });

});


app.get("/student-profile", async (req, res) => {

    if (!req.session.student) {
        return res.redirect("/login");
    }

    try {

        const currentStudentId = req.session.student._id;

        const followersCount = await Follow.countDocuments({
            following: currentStudentId
        });

        const followingCount = await Follow.countDocuments({
            follower: currentStudentId
        });

        res.render("student-profile", {
            student: req.session.student,
            followersCount,
            followingCount
        });

    } catch (error) {
        console.error("Student profile error:", error);
        res.status(500).send("Unable to load profile.");
    }

});

// View timetable with department/semester filter
app.get("/timetable", async (req, res) => {

    try {

        let selectedDepartment = req.query.department || "";
        let selectedSemester = req.query.semester || "";

        // Default to the logged-in student's own class if nothing selected
        if (!selectedDepartment && !selectedSemester && req.session.student) {
            selectedDepartment = req.session.student.department;
            selectedSemester = String(req.session.student.semester);
        }

        let entries = [];

        if (selectedDepartment && selectedSemester) {
            entries = await Timetable.find({
                department: selectedDepartment,
                semester: Number(selectedSemester)
            }).sort({ period: 1 });
        }

        const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const groupedByDay = {};
        dayOrder.forEach(day => { groupedByDay[day] = []; });

        entries.forEach(entry => {
            if (groupedByDay[entry.day]) {
                groupedByDay[entry.day].push(entry);
            }
        });

        res.render("timetable", {
            dayOrder,
            groupedByDay,
            selectedDepartment,
            selectedSemester,
            hasResults: entries.length > 0
        });

    } catch (error) {

        console.error("Timetable error:", error);
        res.status(500).send("Unable to load timetable.");

    }

});

// Admin: add a timetable entry
app.get("/add-timetable", (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    res.render("add-timetable");

});

app.post("/add-timetable", async (req, res) => {

    try {

        if (!req.session.teacher) {
            return res.redirect("/admin-login");
        }

        await Timetable.create({
    department: req.body.department,
    semester: Number(req.body.semester),
    day: req.body.day,
    period: Number(req.body.period),
    subject: req.body.subject,
    room: req.body.room,
    effectiveFrom: req.body.effectiveFrom,
    time: req.body.time
});

        res.redirect("/add-timetable");

    } catch (error) {

        console.error("Add timetable error:", error);
        res.send("Unable to add timetable entry.");

    }

});

app.get("/attendance", async (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    const students = await Student.find();
    res.render("attendance", { students });

});

app.get("/attendance-history", async (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const totalRecords = await Attendance.countDocuments();

    const attendance = await Attendance.find()
        .populate("studentId", "name rollNo department semester section")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    res.render("attendance-history", {
        attendance,
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit)
    });

});

app.get("/reports", async (req, res) => {
    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    const totalStudents = await Student.countDocuments();

    const presentToday = await Attendance.countDocuments({ present: true });

    const absentToday = totalStudents - presentToday;

    const percentage =
        totalStudents === 0
            ? 0
            : Math.round((presentToday / totalStudents) * 100);

    res.render("reports", {

        totalStudents,
        presentToday,
        absentToday,
        percentage

    });

});

app.get("/student-attendance", async (req, res) => {

    if (!req.session.student) {

        return res.redirect("/login");

    }

    const attendance = await Attendance.find({

        studentId: req.session.student._id

    }).sort({ date: -1 });

    res.render("student-attendance", {

        student: req.session.student,

        attendance

    });

});

app.post("/attendance/start", async (req, res) => {
    try {
        if (!req.session.teacher) {
            return res.redirect("/admin-login");
        }

        const { department, semester, section, subject } = req.body;
        const isGlobal = !department && !semester && !section;

        const now = new Date();
        const endTime = new Date(now.getTime() + 60 * 1000);

        let students;
        let roomTarget;
        let sessionData = {
            subject: subject || "General Attendance",
            date: now.toISOString().split("T")[0],
            isOpen: true,
            startTime: now,
            endTime,
            isGlobal
        };

        if (isGlobal) {
            students = await Student.find();
            roomTarget = "all-students";
        } else {
            students = await Student.find({
                department: { $regex: `^${escapeRegex(department.trim())}$`, $options: "i" },
                semester: Number(semester),
                section: { $regex: `^${escapeRegex(section.trim())}$`, $options: "i" }
            });
            roomTarget = buildRoomName(department, semester, section);
            sessionData.department = department;
            sessionData.semester = Number(semester);
            sessionData.section = section;
        }

        if (students.length === 0) {
            return res.status(404).send("No students found for this class.");
        }

        const session = await AttendanceSession.create(sessionData);

        await Attendance.insertMany(
            students.map(student => ({
                studentId: student._id,
                sessionId: session._id,
                present: false,
                markedAt: null,
                date: now
            }))
        );

        io.to(roomTarget).emit("attendanceStarted", {
            sessionId: session._id,
            department: sessionData.department || "All",
            semester: sessionData.semester || "All",
            section: sessionData.section || "All",
            subject: sessionData.subject,
            startTime: now,
            endTime,
            duration: 60
        });

         setTimeout(async () => {
            try {
                await AttendanceSession.findByIdAndUpdate(session._id, { isOpen: false });
            } catch (error) {
                console.error("Error closing attendance:", error);
            }
        }, 60 * 1000);

        res.redirect(`/attendance/today/${session._id}`);

    } catch (error) {
        console.error("Start attendance error:", error);
        res.status(500).send("Unable to start attendance.");
    }
 });

app.post("/attendance/present", async (req, res) => {

    try {

        // Make sure student is logged in
        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Student not logged in."
            });
        }

        const studentId = req.session.student._id;

        // Find the currently open attendance session
        const session = await AttendanceSession.findOne({
            isOpen: true,
            endTime: { $gt: new Date() }
        }).sort({
            startTime: -1
        });

        if (!session) {
            return res.json({
                success: false,
                message: "No attendance session is currently active."
            });
        }

        // Make sure this student belongs to this class
        const student = await Student.findById(studentId);

        if (!student) {
            return res.json({
                success: false,
                message: "Student not found."
            });
        }

        if (
    !session.isGlobal &&
    (
        student.department !== session.department ||
        Number(student.semester) !== Number(session.semester) ||
        student.section !== session.section
    )
) {
    return res.json({
        success: false,
        message: "This attendance session is not for your class."
    });
}

        // Find the attendance record created when
        // the teacher started the session
        const attendance = await Attendance.findOne({
            studentId: studentId,
            sessionId: session._id
        });

        if (!attendance) {
            return res.json({
                success: false,
                message: "Attendance record not found."
            });
        }

        // Prevent marking twice
        if (attendance.present === true) {
            return res.json({
                success: true,
                message: "Attendance already marked."
            });
        }

        // Mark present
        attendance.present = true;
        attendance.markedAt = new Date();
        attendance.date = new Date();

        await attendance.save();

        console.log(
            `Attendance marked PRESENT: ${student.name} - ${student.rollNo}`
        );

        return res.json({
            success: true,
            message: "Attendance marked successfully.",
            markedAt: attendance.markedAt
        });

    } catch (error) {

        console.error(
            "Present attendance error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to mark attendance."
        });

    }

});

app.get("/attendance/today/:sessionId", async (req, res) => {

    try {

        if (!req.session.teacher) {
            return res.redirect("/admin-login");
        }

        const { sessionId } = req.params;

        // Find the attendance session
        const session = await AttendanceSession.findById(sessionId);

        if (!session) {
            return res.status(404).send(
                "Attendance session not found."
            );
        }

        // Get every attendance record for this session
        // and also get student information
      let attendance = await Attendance.find({
    sessionId: session._id
}).populate(
    "studentId",
    "name rollNo department semester section"
);

// Present students first, absent below — then sorted by roll number within each group
attendance.sort((a, b) => {
    if (a.present !== b.present) {
        return a.present ? -1 : 1;
    }
    const rollA = a.studentId ? String(a.studentId.rollNo) : "";
    const rollB = b.studentId ? String(b.studentId.rollNo) : "";
    return rollA.localeCompare(rollB, undefined, { numeric: true });
});
        res.render(
            "today-attendance",
            {
                session,
                attendance
            }
        );

    } catch (error) {

        console.error(
            "Today's attendance error:",
            error
        );

        res.status(500).send(
            "Unable to load today's attendance."
        );

    }

});

app.post("/save-attendance", async (req, res) => {

    try {

        const students = await Student.find();

        const presentStudents = req.body.presentStudents || [];

        for (const student of students) {

            const isPresent = presentStudents.includes(student._id.toString());

            await Attendance.create({

                studentId: student._id,

                present: isPresent

            });

        }

        res.redirect("/attendance");

    } catch (err) {

        console.log(err);

        res.send("Something went wrong.");

    }

});

app.get("/add-student", (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    res.render("add-student");

});
app.post("/add-student", async (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    try {
        const student = new Student({
            name: req.body.name,
            rollNo: req.body.rollNo,
            semester: req.body.semester,
            department: req.body.department,
            section: req.body.section,
            email: req.body.email,
            password: req.body.password
        });

        await student.save();
        res.redirect("/add-student");

    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }

});


app.get("/students", async (req, res) => {
    if (!req.session.teacher) {
    return res.redirect("/admin-login");
}

    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const totalStudents = await Student.countDocuments();

    const students = await Student.find()
        .select("name rollNo department semester section email")
        .sort({ rollNo: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

    res.render("students", {
        students: students,
        currentPage: page,
        totalPages: Math.ceil(totalStudents / limit)
    });

});

app.get("/inbox", async (req, res) => {
    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudentId = new mongoose.Types.ObjectId(req.session.student._id);

        // ===============================
        // PRIMARY - one-to-one conversations
        // ===============================

        const conversations = await Message.aggregate([

            {
                $match: {
                    $or: [
                        { sender: currentStudentId },
                        { receiver: currentStudentId }
                    ]
                }
            },

            {
                $addFields: {
                    otherStudent: {
                        $cond: [
                            { $eq: ["$sender", currentStudentId] },
                            "$receiver",
                            "$sender"
                        ]
                    }
                }
            },

            {
                $sort: { createdAt: -1 }
            },

            {
                $group: {
                    _id: "$otherStudent",
                    lastMessage: { $first: "$message" },
                    lastMediaType: { $first: "$mediaType" },
                    lastCreatedAt: { $first: "$createdAt" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$receiver", currentStudentId] },
                                        { $ne: ["$status", "read"] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },

            {
                $sort: { lastCreatedAt: -1 }
            }

        ]);

                const otherStudentIds = conversations.map(convo => convo._id);

        const otherStudentsList = await Student.find({
            _id: { $in: otherStudentIds }
        })
            .select("name rollNo department semester section photo")
            .lean();

        const otherStudentsMap = {};
        otherStudentsList.forEach(student => {
            otherStudentsMap[student._id.toString()] = student;
        });

        const primaryChats = [];

        for (const convo of conversations) {

            const otherStudent = otherStudentsMap[convo._id.toString()];

            if (!otherStudent) {
                continue;
            }

            let previewText = convo.lastMessage;

            if (!previewText && convo.lastMediaType === "image") {
                previewText = "Photo";
            } else if (!previewText && convo.lastMediaType === "voice") {
                previewText = "Voice message";
            }

            primaryChats.push({
                student: otherStudent,
                lastMessage: previewText || "",
                unreadCount: convo.unreadCount,
                lastCreatedAt: convo.lastCreatedAt
            });

        }

        // ===============================
        // GENERAL - group chats
        // ===============================

        const groups = await Group.find({
            members: currentStudentId
        }).sort({ updatedAt: -1 });

        const generalChats = groups.map(group => ({
            _id: group._id,
            name: group.name,
            photoUrl: group.photoUrl,
            memberCount: group.members.length
        }));

        res.render("inbox", {
            student: req.session.student,
            primaryChats,
            generalChats
        });

    } catch (error) {

        console.error("Inbox error:", error);
        res.status(500).send("Unable to load inbox.");

    }
});

app.get("/studentss", async (req, res) => {
    try {
        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudentId = req.session.student._id;

        const students = await Student.find();

        // Find unread messages for the logged-in student
        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    receiver: new mongoose.Types.ObjectId(currentStudentId),
                    status: { $ne: "read" }
                }
            },
            {
                $group: {
                    _id: "$sender",
                    count: { $sum: 1 }
                }
            }
        ]);

        const unreadMap = {};

        unreadCounts.forEach(item => {
            unreadMap[item._id.toString()] = item.count;
        });

        console.log("Current student:", currentStudentId.toString());
        console.log("Unread messages:", unreadCounts);
        console.log("Unread map:", unreadMap);

        res.render("studentss", {
    students,
    currentStudentId: currentStudentId.toString(),
    unreadMap,
    student: req.session.student
});

    } catch (error) {
        console.error("Student list error:", error);
        res.status(500).send("Unable to load students.");
    }
});

app.get("/edit-student/:id", async (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    const student = await Student.findById(req.params.id);
    res.render("edit-student", { student });

});

app.post("/edit-student/:id", async (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    await Student.findByIdAndUpdate(req.params.id, {
        name: req.body.name,
        rollNo: req.body.rollNo,
        semester: req.body.semester,
        department: req.body.department
    });

    res.redirect("/students");

});

app.get("/delete-student/:id", async (req, res) => {

    if (!req.session.teacher) {
        return res.redirect("/admin-login");
    }

    await Student.findByIdAndDelete(req.params.id);
    res.redirect("/students");

});

app.get("/create-teacher", async (req, res) => {

    try {

        const teacher = new Teacher({

            name: "Teacher",

            username: "teacher",

            email: "teacher@attendease.com",

            password: "teacher123"

        });

        await teacher.save();

        res.send("Teacher Created Successfully");

    } catch (err) {

        console.log(err);

        res.send("Teacher creation failed");

    }

});

//message//
app.get("/messages/:studentId", async (req, res) => {

    try {

        // Student must be logged in
        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const currentStudentId = req.session.student._id;
        const otherStudentId = req.params.studentId;
        const limit = 50;

        const messages = await Message.find({

            $or: [

                {
                    sender: currentStudentId,
                    receiver: otherStudentId
                },

                {
                    sender: otherStudentId,
                    receiver: currentStudentId
                }

            ]

        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Flip back to oldest-first for display
        messages.reverse();

        res.json({
            success: true,
            messages
        });

    } catch (error) {

        console.error("Message loading error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load messages."
        });

    }

});

app.post("/messages", upload.single("image"), async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const sender = req.session.student._id;

        const { receiver, message, replyTo } = req.body;

        // ===============================
        // CHECK RECEIVER
        // ===============================

        if (!receiver) {
            return res.status(400).json({
                success: false,
                message: "Receiver is required."
            });
        }

        const student = await Student.findById(receiver);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // ===============================
        // CHECK MESSAGE / IMAGE
        // ===============================

        const hasText = message && message.trim();
        const hasImage = req.file;

        if (!hasText && !hasImage) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty."
            });
        }

        // ===============================
        // CREATE MESSAGE
        // ===============================

        const newMessage = await Message.create({

            sender,
            receiver,

            message: hasText ? message.trim() : "",

            mediaUrl: hasImage ? req.file.path : "",

            mediaType: hasImage ? "image" : "",

            status: "sent",

            replyTo: replyTo || null

        });

        // ===============================
        // POPULATE REPLY
        // ===============================

        await newMessage.populate(
            "replyTo",
            "message sender mediaUrl mediaType deleted"
        );

                await Notification.findOneAndUpdate(
            { recipient: receiver, sender, type: "message" },
            { read: false, $inc: { count: 1 } },
            { upsert: true, new: true }
        );

        // ===============================
        // PAYLOAD
        // ===============================

        const payload = {

            _id: newMessage._id,

            sender: sender.toString(),

            receiver: receiver.toString(),

            message: newMessage.message,

            mediaUrl: newMessage.mediaUrl,

            mediaType: newMessage.mediaType,

            createdAt: newMessage.createdAt,

            status: newMessage.status,

            replyTo: newMessage.replyTo
                ? {
                    _id: newMessage.replyTo._id,

                    message: newMessage.replyTo.message,

                    sender: newMessage.replyTo.sender.toString(),

                    mediaUrl: newMessage.replyTo.mediaUrl,

                    mediaType: newMessage.replyTo.mediaType,

                    deleted: newMessage.replyTo.deleted
                }
                : null

        };

        // ===============================
        // SOCKET
        // ===============================

        io.to(`student:${receiver}`).emit(
            "newMessage",
            payload
        );

        io.to(`student:${sender}`).emit(
            "messageSent",
            payload
        );

        // ===============================
        // RESPONSE
        // ===============================

        res.json({
            success: true,
            message: payload
        });

    } catch (error) {

        console.error("Send message error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send message."
        });

    }

});

// ================= EDIT MESSAGE =================

app.put("/messages/:id", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty."
            });
        }

        const existing = await Message.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Message not found."
            });
        }

        // Only the sender can edit their own message
        if (existing.sender.toString() !== req.session.student._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only edit your own messages."
            });
        }

        existing.message = message.trim();
        existing.edited = true;

        await existing.save();

        const payload = {
            _id: existing._id.toString(),
            message: existing.message,
            sender: existing.sender.toString(),
            receiver: existing.receiver.toString()
        };

        io.to(`student:${existing.sender}`).emit("messageEdited", payload);
        io.to(`student:${existing.receiver}`).emit("messageEdited", payload);

        res.json({
            success: true,
            message: payload
        });

    } catch (error) {

        console.error("Edit message error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to edit message."
        });

    }

});

// ================= DELETE MESSAGE =================

app.delete("/messages/:id", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const existing = await Message.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Message not found."
            });
        }

        if (existing.sender.toString() !== req.session.student._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own messages."
            });
        }

        existing.deleted = true;
        existing.message = "";

        await existing.save();

        const payload = {
            _id: existing._id.toString(),
            sender: existing.sender.toString(),
            receiver: existing.receiver.toString()
        };

        io.to(`student:${existing.sender}`).emit("messageDeleted", payload);
        io.to(`student:${existing.receiver}`).emit("messageDeleted", payload);

        res.json({
            success: true
        });

    } catch (error) {

        console.error("Delete message error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete message."
        });

    }

});

// ================= CHAT PAGE =================

app.get("/chat/:studentId", async (req, res) => {

    try {

        // Student must be logged in
        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudent = req.session.student;
        const otherStudentId = req.params.studentId;

        // Mark messages from this student as read
        await Message.updateMany(
            {
                sender: otherStudentId,
                receiver: currentStudent._id,
                status: { $ne: "read" }
            },
            
            {
                $set: {
                    status: "read"
                }
            }
        );
                await Notification.updateMany(
            { recipient: currentStudent._id, sender: otherStudentId, type: "message" },
            { read: true, count: 0 }
        );

        // Don't allow messaging yourself
        if (currentStudent._id.toString() === otherStudentId) {
            return res.redirect("/studentss");
        }

        // Find the student we want to chat with
        const otherStudent = await Student.findById(otherStudentId);

        if (!otherStudent) {
            return res.status(404).send("Student not found.");
        }

        // Get previous conversation
        const messages = await Message.find({

            $or: [

                {
                    sender: currentStudent._id,
                    receiver: otherStudent._id
                },

                {
                    sender: otherStudent._id,
                    receiver: currentStudent._id
                }

            ]

        })
            .sort({ createdAt: 1 })
            .populate("replyTo", "message sender mediaUrl mediaType deleted");

        res.render("chat", {

            currentStudent,
            otherStudent,
            messages

        });

    } catch (error) {

        console.error("Chat page error:", error);

        res.status(500).send("Unable to open chat.");

    }

});

// Canteen: show add menu item form
app.get("/add-menu-item", (req, res) => {
    if (!req.session.canteenOwner) {
        return res.redirect("/canteen-login");
    }

    res.render("add-menu-item");
});

// Teacher: create menu item
app.post("/add-menu-item", uploadMenuPhoto.single("photo"), async (req, res) => {
    try {
        if (!req.session.canteenOwner) {
    return res.redirect("/canteen-login");
}

        const menuItem = new MenuItem({
            name: req.body.name,
            price: req.body.price,
            category: req.body.category,
            photoUrl: req.file ? req.file.path : "",
            available: true,
        });

        await menuItem.save();
        res.redirect("/add-menu-item");

    } catch (error) {
        console.error("Add menu item error:", error);
        res.send("Unable to add menu item.");
    }
});

// Student & Teacher: browse the menu
// Student & Teacher: browse the menu (ORDERING PAGE)
app.get("/menu", async (req, res) => {

    if (!req.session.student && !req.session.teacher) {
        return res.redirect("/login");
    }

    const menuItems = await MenuItem.find({ available: true }).sort({ category: 1, name: 1 });

    res.render("menu", {
        menuItems
    });

});

// Teacher: manage menu (ADMIN PAGE)
app.get("/manage-menu", async (req, res) => {

    if (!req.session.canteenOwner) {
        return res.redirect("/canteen-login");
    }

    const menuItems = await MenuItem.find()
        .sort({ category: 1, name: 1 });

    res.render("manage-menu", {
        menuItems
    });
});

// Teacher: delete a menu item
app.delete("/menu-item/:id", async (req, res) => {

    try {

        if (!req.session.canteenOwner) {
            return res.status(401).json({ success: false });
        }

        await MenuItem.findByIdAndDelete(req.params.id);

        res.json({ success: true });

    } catch (error) {
        console.error("Delete menu item error:", error);
        res.status(500).json({ success: false });
    }

});

const Order = require("./models/Order");

// ================= CHECKOUT PAGE =================

app.get("/checkout", (req, res) => {

    if (!req.session.student && !req.session.teacher) {
        return res.redirect("/login");
    }

    const currentUser = req.session.student || req.session.teacher;

    res.render("checkout", {
        currentUser,
        isStudent: !!req.session.student
    });

});

// ================= PLACE ORDER (stub — no real payment yet) =================

app.post("/place-order", async (req, res) => {

    try {

        if (!req.session.student && !req.session.teacher) {
            return res.status(401).json({ success: false, message: "Please login first." });
        }

        const { items, orderType, department, semester, section } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty." });
        }

        // Check that every ordered item is currently available
for (const item of items) {

    const menuItem = await MenuItem.findById(item.id);

    if (!menuItem) {
        return res.status(400).json({
            success: false,
            message: `${item.name} is no longer available.`
        });
    }

    if (!menuItem.available) {
        return res.status(400).json({
            success: false,
            message: `${menuItem.name} is currently out of stock.`
        });
    }
}

        if (!["delivery", "pickup"].includes(orderType)) {
            return res.status(400).json({ success: false, message: "Invalid order type." });
        }

        const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const deliveryFee = orderType === "delivery" ? 15 : 0;
        const totalAmount = itemsTotal + deliveryFee;

        let orderedBy, orderedByModel, orderedByName;

        if (req.session.student) {
            orderedBy = req.session.student._id;
            orderedByModel = "Student";
            orderedByName = req.session.student.name;
        } else {
            orderedBy = req.session.teacher._id;
            orderedByModel = "Teacher";
            orderedByName = req.session.teacher.name;
        }

        const orderData = {
            orderedBy,
            orderedByModel,
            orderedByName,
            items: items.map(item => ({
                menuItemId: item.id,
                name: item.name,
                price: item.price,
                qty: item.qty
            })),
            itemsTotal,
            deliveryFee,
            totalAmount,
            orderType,
            paymentStatus: "pending" // Step 4 will flip this to "paid" after real payment
        };

        if (orderType === "delivery") {

            if (!department || !semester || !section) {
                return res.status(400).json({ success: false, message: "Delivery details are required." });
            }

            orderData.deliveryDetails = { department, semester, section };
        }

        const newOrder = await Order.create(orderData);

        io.to("canteen-owner").emit("newOrder", {
    orderId: newOrder._id.toString(),
    orderedByName: newOrder.orderedByName,
    items: newOrder.items,
    itemsTotal: newOrder.itemsTotal,
    deliveryFee: newOrder.deliveryFee,
    totalAmount: newOrder.totalAmount,
    orderType: newOrder.orderType,
    deliveryDetails: newOrder.deliveryDetails || null,
    status: newOrder.status,
    paymentStatus: newOrder.paymentStatus,
    createdAt: newOrder.createdAt
});

        res.json({
            success: true,
            orderId: newOrder._id
        });

    } catch (error) {
        console.error("Place order error:", error);
        res.status(500).json({ success: false, message: "Unable to place order." });
    }

});

app.get("/canteen-orders", async (req, res) => {
    try {

        if (!req.session.canteenOwner) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const orders = await Order.find({
            status: {
                $in: ["placed", "accepted", "preparing", "ready"]
            }
        })
        .sort({ createdAt: -1 })
        .lean();

        res.json({
            success: true,
            orders
        });

    } catch (error) {

        console.error("Canteen orders error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load orders."
        });
    }
});

// ================= ORDER CONFIRMATION PAGE =================

app.get("/order-confirmation/:id", async (req, res) => {

    try {

        if (!req.session.student && !req.session.teacher) {
            return res.redirect("/login");
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).send("Order not found.");
        }

        res.render("order-confirmation", { order });

    } catch (error) {
        console.error("Order confirmation error:", error);
        res.status(500).send("Unable to load order.");
    }

});

app.get("/create-group", async (req, res) => {
    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const students = await Student.find({
            _id: { $ne: req.session.student._id }
        }).select("name email department semester section");

        res.render("create-group", {
            students,
            currentStudent: req.session.student
        });

    } catch (error) {
        console.error("Create group page error:", error);
        res.status(500).send("Unable to load create group page.");
    }
});

app.post("/create-group", async (req, res) => {
    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const { groupName, members } = req.body;

        if (!groupName || !groupName.trim()) {
            return res.status(400).send("Group name is required.");
        }

        // Convert selected member into an array
        let selectedMembers = [];

        if (members) {
            selectedMembers = Array.isArray(members)
                ? members
                : [members];
        }

        // Creator automatically becomes a member
        const allMembers = [
            req.session.student._id,
            ...selectedMembers
        ];

        // Remove duplicate student IDs
        const uniqueMembers = [
            ...new Set(allMembers.map(id => id.toString()))
        ];

        const group = await Group.create({
            name: groupName.trim(),
            createdBy: req.session.student._id,
            members: uniqueMembers
        });

        console.log("New group created:", group._id.toString());

        res.redirect("/studentss");

    } catch (error) {

        console.error("Create group error:", error);

        res.status(500).send("Unable to create group.");

    }
});

// ================= GROUP CHAT PAGE =================

app.get("/group-chat/:groupId", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudent = req.session.student;
        const groupId = req.params.groupId;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).send("Group not found.");
        }

        // Only members can open the group chat
        const isMember = group.members.some(
            memberId => memberId.toString() === currentStudent._id.toString()
        );

        if (!isMember) {
            return res.status(403).send("You are not a member of this group.");
        }

        const messages = await GroupMessage.find({
            groupId: group._id
        }).sort({ createdAt: 1 });

        res.render("group-chat", {

            currentStudent,
            group,
            messages

        });

    } catch (error) {

        console.error("Group chat page error:", error);

        res.status(500).send("Unable to open group chat.");

    }

});


app.get("/group-info/:groupId", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudent = req.session.student;
        const groupId = req.params.groupId;

        const group = await Group.findById(groupId)
            .populate("members", "name email department semester section")
            .populate("createdBy", "name email");

        if (!group) {
            return res.status(404).send("Group not found.");
        }

        // Only group members can see group information
        const isMember = group.members.some(
            member => member._id.toString() === currentStudent._id.toString()
        );

        if (!isMember) {
            return res.status(403).send("You are not a member of this group.");
        }

        const isAdmin =
            group.createdBy._id.toString() === currentStudent._id.toString();

        const allStudents = await Student.find({})
    .select("name email department semester section")
    .lean();

res.render("group-info", {
    group,
    currentStudent,
    isAdmin,
    allStudents
});

    } catch (error) {

        console.error("Group info error:", error);

        res.status(500).send("Unable to load group information.");

    }

});

// ===============================
// EDIT GROUP
// ===============================

app.patch("/group/:groupId/edit", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const currentStudentId = req.session.student._id.toString();

        if (group.createdBy.toString() !== currentStudentId) {
            return res.status(403).json({
                success: false,
                message: "Only the group admin can edit the group."
            });
        }

        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required."
            });
        }

        group.name = name.trim();

        await group.save();

        io.to(`group:${group._id}`).emit("groupUpdated", {
            groupId: group._id.toString(),
            name: group.name
        });

        res.json({
            success: true,
            name: group.name
        });

    } catch (error) {

        console.error("Edit group error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to edit group."
        });

    }

});


// ===============================
// ADD MEMBER
// ===============================

app.post("/group/:groupId/add-member", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const currentStudent = req.session.student;

        // Only admin can add members
        if (
            group.createdBy.toString() !==
            currentStudent._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the group admin can add members."
            });
        }

        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Student is required."
            });
        }

        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const alreadyMember = group.members.some(
            memberId =>
                memberId.toString() === studentId.toString()
        );

        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: "Student is already a member."
            });
        }

        group.members.push(student._id);

        await group.save();

        // Create WhatsApp-style system message
        const systemText =
            `${currentStudent.name} added ${student.name} to the group`;

        const systemMessage = await GroupMessage.create({

            groupId: group._id,

            sender: currentStudent._id,

            senderName: currentStudent.name,

            messageType: "system",

            text: systemText

        });

        const payload = {

            _id: systemMessage._id,

            groupId: group._id.toString(),

            sender: currentStudent._id.toString(),

            senderName: currentStudent.name,

            messageType: "system",

            text: systemText,

            createdAt: systemMessage.createdAt

        };

        io.to(`group:${group._id}`).emit(
            "groupMemberChanged",
            {
                groupId: group._id.toString(),
                action: "added",
                studentId: student._id.toString(),
                studentName: student.name,
                memberCount: group.members.length
            }
        );

        io.to(`group:${group._id}`).emit(
            "newGroupMessage",
            payload
        );

        res.json({
            success: true,
            message: payload,
            memberCount: group.members.length
        });

    } catch (error) {

        console.error("Add group member error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to add member."
        });

    }

});


// ===============================
// REMOVE MEMBER
// ===============================

app.delete("/group/:groupId/member/:studentId", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const currentStudent = req.session.student;

        // Only admin can remove members
        if (
            group.createdBy.toString() !==
            currentStudent._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the group admin can remove members."
            });
        }

        const student = await Student.findById(req.params.studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // Admin cannot remove themselves
        if (
            student._id.toString() ===
            group.createdBy.toString()
        ) {
            return res.status(400).json({
                success: false,
                message: "The group admin cannot be removed."
            });
        }

        const isMember = group.members.some(
            memberId =>
                memberId.toString() ===
                student._id.toString()
        );

        if (!isMember) {
            return res.status(400).json({
                success: false,
                message: "Student is not a group member."
            });
        }

        group.members = group.members.filter(
            memberId =>
                memberId.toString() !==
                student._id.toString()
        );

        await group.save();

        // WhatsApp-style system message
        const systemText =
            `${currentStudent.name} removed ${student.name} from the group`;

        const systemMessage = await GroupMessage.create({

            groupId: group._id,

            sender: currentStudent._id,

            senderName: currentStudent.name,

            messageType: "system",

            text: systemText

        });

        const payload = {

            _id: systemMessage._id,

            groupId: group._id.toString(),

            sender: currentStudent._id.toString(),

            senderName: currentStudent.name,

            messageType: "system",

            text: systemText,

            createdAt: systemMessage.createdAt

        };

        io.to(`group:${group._id}`).emit(
            "groupMemberChanged",
            {
                groupId: group._id.toString(),
                action: "removed",
                studentId: student._id.toString(),
                studentName: student.name,
                memberCount: group.members.length
            }
        );

        io.to(`group:${group._id}`).emit(
            "newGroupMessage",
            payload
        );

        res.json({
            success: true,
            message: payload,
            memberCount: group.members.length
        });

    } catch (error) {

        console.error("Remove group member error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove member."
        });

    }

});

// ================= SEND GROUP MESSAGE =================

app.post("/group-messages", upload.single("image"), async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const sender = req.session.student._id;
        const senderName = req.session.student.name;

        const { groupId, message } = req.body;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group is required."
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        const isMember = group.members.some(
            memberId => memberId.toString() === sender.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group."
            });
        }

        const hasText = message && message.trim();
        const hasImage = req.file;

        if (!hasText && !hasImage) {
            return res.status(400).json({
                success: false,
                message: "Message cannot be empty."
            });
        }

        const newMessage = await GroupMessage.create({

            groupId,
            sender,
            senderName,

            text: hasText ? message.trim() : "",

            imageUrl: hasImage ? req.file.path : "",

            status: "sent"

        });

        const payload = {

            _id: newMessage._id,

            groupId: groupId.toString(),

            sender: sender.toString(),

            senderName,

            text: newMessage.text,

            imageUrl: newMessage.imageUrl,

            createdAt: newMessage.createdAt

        };

        io.to(`group:${groupId}`).emit("newGroupMessage", payload);

        res.json({
            success: true,
            message: payload
        });

    } catch (error) {

        console.error("Send group message error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send message."
        });

    }

});

// ================= PROFILE PICTURE UPLOAD =================

app.post("/profile-picture", uploadProfilePhoto.single("photo"), async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        if (!req.file) {
            return res.redirect("/student-profile");
        }

        const updatedStudent = await Student.findByIdAndUpdate(
            req.session.student._id,
            { photo: req.file.path },
            { new: true }
        );

        // Keep session in sync so the new photo shows immediately
        req.session.student = updatedStudent;

        res.redirect("/student-profile");

    } catch (error) {

        console.error("Profile picture upload error:", error);
        res.status(500).send("Unable to upload profile picture.");

    }

});

// ================= VIEW ANOTHER STUDENT'S PROFILE =================

app.get("/profile/:studentId", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudentId = req.session.student._id;
        const profileStudentId = req.params.studentId;

        const profileStudent = await Student.findById(profileStudentId);

        if (!profileStudent) {
            return res.status(404).send("Student not found.");
        }

        const followersCount = await Follow.countDocuments({
            following: profileStudentId
        });

        const followingCount = await Follow.countDocuments({
            follower: profileStudentId
        });

        const existingFollow = await Follow.findOne({
            follower: currentStudentId,
            following: profileStudentId
        });

        const isOwnProfile =
            currentStudentId.toString() === profileStudentId;

        res.render("profile", {

            profileStudent,
            followersCount,
            followingCount,
            isFollowing: !!existingFollow,
            isOwnProfile

        });

    } catch (error) {

        console.error("Profile page error:", error);
        res.status(500).send("Unable to load profile.");

    }

});

// ================= FOLLOW / UNFOLLOW =================

app.post("/follow/:studentId", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const followerId = req.session.student._id;
        const followingId = req.params.studentId;

        if (followerId.toString() === followingId) {
            return res.redirect("/profile/" + followingId);
        }

        const existingFollow = await Follow.findOne({
            follower: followerId,
            following: followingId
        });

        if (!existingFollow) {
            await Follow.create({
                follower: followerId,
                following: followingId
            });

                    await Notification.findOneAndUpdate(
            { recipient: followingId, sender: followerId, type: "follow" },
            { read: false },
            { upsert: true, new: true }
        );
        }

        res.redirect("/profile/" + followingId);

    } catch (error) {

        console.error("Follow error:", error);
        res.status(500).send("Unable to follow student.");

    }

});

app.post("/unfollow/:studentId", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const followerId = req.session.student._id;
        const followingId = req.params.studentId;

        await Follow.deleteOne({
            follower: followerId,
            following: followingId
        });

        res.redirect("/profile/" + followingId);

    } catch (error) {

        console.error("Unfollow error:", error);
        res.status(500).send("Unable to unfollow student.");

    }

});

app.get("/notifications", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.redirect("/login");
        }

        const currentStudentId = req.session.student._id;

        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const skip = (page - 1) * limit;

        const totalNotifications = await Notification.countDocuments({
            recipient: currentStudentId
        });

        const notifications = await Notification.find({
            recipient: currentStudentId
        })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", "name photo")
            .lean();

        // Mark everything as read now that the person has opened the feed
        await Notification.updateMany(
            { recipient: currentStudentId, read: false },
            { read: true }
        );

        res.render("notifications", {
            notifications,
            currentPage: page,
            totalPages: Math.ceil(totalNotifications / limit)
        });

    } catch (error) {

        console.error("Notifications error:", error);
        res.status(500).send("Unable to load notifications.");

    }

});

app.delete("/notifications/:id", async (req, res) => {

    try {

        if (!req.session.student) {
            return res.status(401).json({ success: false, message: "Please login first." });
        }

        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found." });
        }

        if (notification.recipient.toString() !== req.session.student._id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized." });
        }

        await Notification.findByIdAndDelete(req.params.id);

        res.json({ success: true });

    } catch (error) {

        console.error("Delete notification error:", error);
        res.status(500).json({ success: false, message: "Unable to delete notification." });

    }

});






connectDB();

app.get("/logout", (req, res) => {

    req.session.destroy((err) => {

        if (err) {

            return res.send("Error while logging out");

        }

        res.redirect("/");

    });

});

server.listen(3000, () => {
    console.log("Server Started");
});