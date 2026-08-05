const express = require("express");

const session = require("express-session");

const connectDB = require("./config/db");

const Student = require("./models/Student");

const Attendance = require("./models/Attendance");

const path = require("path");

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(session({

    secret: "mysecretkey",

    resave: false,

    saveUninitialized: false

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

app.post("/admin-login", (req, res) => {

    const username = req.body.username;

    const password = req.body.password;

    if (username === "admin" && password === "admin123") {

        req.session.admin = true;

        return res.redirect("/dashboard");

    }

    res.send("Wrong Admin Username or Password");

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

connectDB();

app.get("/logout", (req, res) => {

    req.session.destroy((err) => {

        if (err) {

            return res.send("Error while logging out");

        }

        res.redirect("/");

    });

});

app.listen(3000, () => {
    console.log("Server Started");
});