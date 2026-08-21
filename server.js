const express = require("express");

const session = require("express-session");

const connectDB = require("./config/db");

const Student = require("./models/Student");

const Fest = require("./models/fest");

const Attendance = require("./models/Attendance");

const AttendanceSession = require("./models/AttendanceSession");

const Message = require("./models/Message");

const Timetable = require("./models/Timetable");

const Teacher = require("./models/Teacher");

const path = require("path");

const app = express();

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server);

const mongoose = require("mongoose");

const onlineStudents = new Map();


io.on("connection", (socket) => {

    console.log("A user connected:", socket.id);
    

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

socket.on("messageDelivered", async (data) => {
    try {

        if (!data || !data.messageId) {
            return;
        }

        const updatedMessage = await Message.findByIdAndUpdate(
            data.messageId,
            {
                $set: {
                    status: "delivered"
                }
            },
            { new: true }
        );

        if (!updatedMessage) {
            return;
        }

        // Tell the sender that message was delivered
        io.to(`student:${updatedMessage.sender}`).emit(
            "messageDelivered",
            {
                messageId: updatedMessage._id.toString()
            }
        );

    } catch (error) {
        console.error(
            "Message delivered error:",
            error
        );
    }
});

// ===============================
// MESSAGE READ
// ===============================

socket.on("markMessagesRead", async (data) => {

    try {

        if (
            !data ||
            !data.studentId ||
            !data.otherStudentId
        ) {
            return;
        }

        const messages = await Message.find({
            sender: data.otherStudentId,
            receiver: data.studentId,
            status: { $ne: "read" }
        }).select("_id");

        if (messages.length === 0) {
            return;
        }

        const messageIds = messages.map(
            message => message._id
        );

        await Message.updateMany(
            {
                _id: { $in: messageIds }
            },
            {
                $set: {
                    status: "read"
                }
            }
        );

        // Tell the sender EXACTLY which messages were read
        io.to(`student:${data.otherStudentId}`).emit(
            "messagesRead",
            {
                messageIds: messageIds.map(
                    id => id.toString()
                )
            }
        );

    } catch (error) {

        console.error(
            "Mark messages read error:",
            error
        );

    }

});



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

app.use(session({

    secret: "mysecretkey",

    resave: false,

    saveUninitialized: false,

    cookie: {

        maxAge: 30 * 24 * 60 * 60 * 1000,

        httpOnly: true,

        sameSite: "lax"

    }

}));

app.set("view engine", "ejs");

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

        return res.redirect("/student-login");

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

    res.render("student-dashboard", {

        student: req.session.student,

        totalAttendance,

        presentAttendance,

        absentAttendance,

        percentage

    });

});


app.get("/student-profile", (req, res) => {

    if (!req.session.student) {

        return res.redirect("/student-login");

    }

    res.render("student-profile", {

        student: req.session.student

    });

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

    const students = await Student.find();

    res.render("attendance", { students });

});

app.get("/attendance-history", async (req, res) => {

    const attendance = await Attendance.find()
        .populate("studentId")
        .sort({ date: -1 });

    res.render("attendance-history", {
        attendance
    });

});

app.get("/reports", async (req, res) => {

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

        return res.redirect("/student-login");

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

    res.render("add-student");

});
app.post("/add-student", async (req, res) => {

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

    const students = await Student.find();

    res.render("students", {
        students: students
    });

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
            unreadMap
        });

    } catch (error) {
        console.error("Student list error:", error);
        res.status(500).send("Unable to load students.");
    }
});

app.get("/edit-student/:id", async (req, res) => {

    const student = await Student.findById(req.params.id);

    res.render("edit-student", {

        student

    });

});

app.post("/edit-student/:id", async (req, res) => {

    await Student.findByIdAndUpdate(req.params.id, {

        name: req.body.name,

        rollNo: req.body.rollNo,

        semester: req.body.semester,

        department: req.body.department

    });

    res.redirect("/students");

});

app.get("/delete-student/:id", async (req, res) => {

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

        }).sort({
            createdAt: 1
        });

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

app.post("/messages", async (req, res) => {

    try {

        // Student must be logged in
        if (!req.session.student) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const sender = req.session.student._id;
        const { receiver, message } = req.body;

        // Basic validation
        if (!receiver || !message || !message.trim()) {

            return res.status(400).json({
                success: false,
                message: "Message cannot be empty."
            });

        }

        // Check receiver exists
        const student = await Student.findById(receiver);

        if (!student) {

            return res.status(404).json({
                success: false,
                message: "Student not found."
            });

        }

const newMessage = await Message.create({
    sender,
    receiver,
    message: message.trim(),
    status: "sent"
});
//debug
console.log("MESSAGE CREATED:");
console.log("Sender:", newMessage.sender.toString());
console.log("Receiver:", newMessage.receiver.toString());
console.log("Status:", newMessage.status);
console.log("Message:", newMessage.message);

// Send message instantly to receiver
io.to(`student:${receiver}`).emit("newMessage", {

    _id: newMessage._id,

    sender: sender.toString(),

    receiver: receiver.toString(),

    message: newMessage.message,

    createdAt: newMessage.createdAt,

    status: newMessage.status

});

// Also send it back to sender's other connected tabs/devices
io.to(`student:${sender}`).emit("messageSent", {

    _id: newMessage._id,
    sender: sender.toString(),
    receiver: receiver.toString(),
    message: newMessage.message,
    createdAt: newMessage.createdAt

});

res.json({

    success: true,
    message: newMessage

});

    } catch (error) {

        console.error("Send message error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send message."
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

        }).sort({
            createdAt: 1
        });

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