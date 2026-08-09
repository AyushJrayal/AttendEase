const express = require("express");

const session = require("express-session");

const connectDB = require("./config/db");

const Student = require("./models/Student");

const Attendance = require("./models/Attendance");

const AttendanceSession = require("./models/AttendanceSession");

const Teacher = require("./models/Teacher");

const path = require("path");

const app = express();

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {

    console.log("A user connected:", socket.id);

    socket.on("studentJoin", (studentData) => {

        if (!studentData) {
            return;
        }

        const roomName =
            `${studentData.department}-${studentData.semester}-${studentData.section}`;

        socket.join(roomName);

        console.log(
            "Student joined room:",
            roomName
        );

    });

});

app.use(express.urlencoded({ extended: true }));

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

app.get("/student-login", (req, res) => {

    res.render("student-login");

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

        res.redirect("/student-login");

    } catch (err) {

        console.log(err);

        res.send("Registration Failed");

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

            return res.send("Teacher Not Found");

        }

        if (teacher.password !== password) {

            return res.send("Wrong Password");

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

        return res.send("Student Not Found");

    }

   if (student.password !== password) {

    return res.send("Wrong Password");

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

        // Make sure teacher is logged in
        if (!req.session.teacher) {
            return res.redirect("/admin-login");
        }

        const {
            department,
            semester,
            section,
            subject
        } = req.body;

        // Find only students belonging to this class
        const students = await Student.find({
            department,
            semester: Number(semester),
            section
        });

        if (students.length === 0) {
            return res.status(404).send(
                "No students found for this class."
            );
        }

        // Current date
        const now = new Date();

        // Attendance ends after 60 seconds
        const endTime = new Date(
            now.getTime() + 60 * 1000
        );

        // Create attendance session
        const session = await AttendanceSession.create({

            department,

            semester: Number(semester),

            section,

            subject,

            date: now.toISOString().split("T")[0],

            isOpen: true,

            startTime: now,

            endTime

        });

        // Create an ABSENT record for every student
        // in this particular class.
        await Attendance.insertMany(

            students.map(student => ({

                studentId: student._id,

                sessionId: session._id,

                present: false,

                markedAt: null,

                date: now

            }))

        );

        // Notify only students from this class
        io.to(
            `${department}-${semester}-${section}`
        ).emit(
            "attendanceStarted",
            {
                sessionId: session._id,

                department,

                semester: Number(semester),

                section,

                subject,

                startTime: now,

                endTime,

                duration: 60
            }
        );

        // Automatically close attendance after 60 seconds
        setTimeout(async () => {

            try {

                await AttendanceSession.findByIdAndUpdate(
                    session._id,
                    {
                        isOpen: false
                    }
                );

                console.log(
                    `Attendance closed: ${session._id}`
                );

            } catch (error) {

                console.error(
                    "Error closing attendance:",
                    error
                );

            }

        }, 60 * 1000);

        // Open the NEW teacher attendance page
        res.redirect(
            `/attendance/today/${session._id}`
        );

    } catch (error) {

        console.error(
            "Start attendance error:",
            error
        );

        res.status(500).send(
            "Unable to start attendance."
        );

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
            student.department !== session.department ||
            Number(student.semester) !== Number(session.semester) ||
            student.section !== session.section
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
        const attendance = await Attendance.find({
            sessionId: session._id
        })
        .populate(
            "studentId",
            "name rollNo department semester section"
        )
        .sort({
            "studentId.rollNo": 1
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